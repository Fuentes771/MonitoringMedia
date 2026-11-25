<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Connector;
use App\Models\IngestionRun;
use App\Models\Mention;
use App\Models\MentionTopicMatch;
use App\Models\Topic;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class MuseIngestService
{
    public const ALLOWED_PLATFORMS = ['facebook', 'threads', 'instagram', 'youtube', 'rss'];
    public const META_PLATFORMS = ['threads', 'facebook', 'instagram'];
    private const MEDIA_ONLY_TYPES = ['video', 'image', 'carousel', 'reel'];

    public function __construct(
        private readonly IngestionService $ingestionService,
        private readonly SocialLinkValidator $linkValidator,
        private readonly BuzzerDetectionService $buzzerDetectionService,
        private readonly TrendService $trendService,
        private readonly AlertService $alertService,
    ) {}

    /**
     * Ingest a normalized batch of mentions pushed from Muse into existing TRINETRA tables and analytics.
     *
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function ingestBatch(int $workspaceId, array $payload): array
    {
        $nowWib = Carbon::now('Asia/Jakarta');
        // Audit/sync timestamps use app.timezone so Eloquent datetime casts convert cleanly to Asia/Jakarta on read
        $startedAt = Carbon::now();
        $ingestId = 'ing_' . $nowWib->format('Ymd_His') . '_' . strtolower(Str::random(4));

        $source = trim((string) ($payload['source'] ?? 'muse-connector')) ?: 'muse-connector';
        $batchCollectedAt = $this->parseIso8601ToWib($payload['collected_at'] ?? null) ?? $nowWib->copy();

        $rawTopicId = isset($payload['topic_id']) ? trim((string) $payload['topic_id']) : '';
        $targetTopic = $rawTopicId !== '' ? $this->resolveTopic($workspaceId, $rawTopicId) : null;

        /** @var Collection<int, Topic> $activeTopicsForMatching */
        $activeTopicsForMatching = $targetTopic === null
            ? Topic::where('workspace_id', $workspaceId)->where('status', 'active')->with('keywords')->get()
            : collect();

        $accepted = 0;
        $duplicatesSkipped = 0;
        $rejected = 0;
        $errors = [];
        /** @var array<int, Mention> $newMentions */
        $newMentions = [];
        /** @var array<int, Topic> $affectedTopics */
        $affectedTopics = [];
        /** @var array<string, array<string, mixed>> $platformStats */
        $platformStats = [];

        if ($targetTopic !== null) {
            $affectedTopics[$targetTopic->id] = $targetTopic;
        }

        $nearDupCutoff = $nowWib->copy()->subHours(24);
        $items = is_array($payload['mentions'] ?? null) ? $payload['mentions'] : [];

        foreach ($items as $index => $item) {
            if (!is_array($item)) {
                $rejected++;
                $errors[] = ['index' => $index, 'error' => 'Item mention harus berupa objek JSON.'];
                continue;
            }

            $validation = $this->validateItem($item);
            $platformForStats = $validation['platform'] ?? null;

            if ($platformForStats !== null && !isset($platformStats[$platformForStats])) {
                $platformStats[$platformForStats] = [
                    'collected' => 0,
                    'accepted' => 0,
                    'duplicates_skipped' => 0,
                    'rejected' => 0,
                    'errors' => [],
                ];
            }

            if ($platformForStats !== null) {
                $platformStats[$platformForStats]['collected']++;
            }

            if (!$validation['valid']) {
                $rejected++;
                $errEntry = [
                    'index' => $index,
                    'platform_post_id' => $item['platform_post_id'] ?? null,
                    'error' => $validation['error'],
                ];
                $errors[] = $errEntry;
                if ($platformForStats !== null) {
                    $platformStats[$platformForStats]['rejected']++;
                    $platformStats[$platformForStats]['errors'][] = $errEntry;
                }
                continue;
            }

            $normalized = $validation['data'];
            $platform = $normalized['platform'];
            $externalId = $normalized['platform_post_id'];

            // Idempotent deduplication by unique (provider, external_id)
            $existing = Mention::where('provider', $platform)
                ->where('external_id', $externalId)
                ->first();

            if ($existing) {
                $duplicatesSkipped++;
                $platformStats[$platform]['duplicates_skipped']++;

                // Refresh metrics or upgrade link status if previously unverified (same workspace only)
                if ((int) $existing->workspace_id === $workspaceId) {
                    $existingMeta = is_array($existing->metadata_json) ? $existing->metadata_json : [];
                    $mergedMeta = array_merge($existingMeta, [
                        'metrics' => $normalized['metrics'],
                        'metrics_available' => true,
                    ]);

                    $existingLinkStatus = $this->linkValidator->resolveEffectiveStatus(
                        $existing->provider,
                        $existing->source_url,
                        $existingMeta,
                        (bool) $existing->is_demo
                    );

                    $updateData = ['metadata_json' => $mergedMeta];
                    if (
                        $existingLinkStatus !== SocialLinkValidator::STATUS_VERIFIED_POST
                        && $normalized['link_status'] === SocialLinkValidator::STATUS_VERIFIED_POST
                    ) {
                        $updateData['source_url'] = $normalized['url'];
                        $mergedMeta['link_status'] = $normalized['link_status'];
                        $mergedMeta['link_reason'] = $normalized['link_reason'];
                        $updateData['metadata_json'] = $mergedMeta;
                    }
                    $existing->update($updateData);

                    $this->attachTopicsForMention($existing, $targetTopic, $activeTopicsForMatching, $affectedTopics);
                }

                continue;
            }

            // Secondary near-duplicate detection within workspace (24h window, flag without dropping)
            $text = $normalized['text'];
            $textNormalized = mb_strtolower(trim($text));
            $textHash = $this->ingestionService->computeNormalizedTextHash($text);

            $meta = [
                'ingestion_source' => $source,
                'raw_source' => $normalized['raw_source'],
                'collector_note' => $normalized['collector_note'],
                'post_code' => $normalized['platform_post_code'],
                'media_type' => $normalized['media_type'],
                'has_empty_caption' => $normalized['has_empty_caption'],
                'author_username' => $normalized['author_username'],
                'author_handle' => $normalized['author_username'] ? '@' . ltrim($normalized['author_username'], '@') : null,
                'author_follower_count' => $normalized['author_follower_count'],
                'author_is_verified' => $normalized['author_is_verified'],
                'author_profile_url' => $normalized['author_profile_url'],
                'is_comment' => $normalized['is_comment'],
                'metrics' => $normalized['metrics'],
                'metrics_available' => true,
                'link_status' => $normalized['link_status'],
                'link_reason' => $normalized['link_reason'],
                'text_hash' => $textHash,
            ];

            $nearDup = Mention::where('workspace_id', $workspaceId)
                ->where('published_at', '>=', $nearDupCutoff)
                ->where(function ($q) use ($textHash, $textNormalized) {
                    $q->where('metadata_json->text_hash', $textHash)
                        ->orWhere('text_normalized', $textNormalized);
                })
                ->first();

            if ($nearDup) {
                $meta['is_near_duplicate'] = true;
                $meta['near_duplicate_of_id'] = $nearDup->id;
            } else {
                $meta['is_near_duplicate'] = false;
            }

            $mention = Mention::create([
                'workspace_id' => $workspaceId,
                'provider' => $platform,
                'external_id' => $externalId,
                'source_url' => $normalized['url'],
                'author_name' => $normalized['author_name'],
                'published_at' => $normalized['posted_at'],
                'collected_at' => $batchCollectedAt,
                'text' => $text,
                'text_normalized' => $textNormalized,
                'language' => $normalized['language'],
                'deletion_status' => 'active',
                'is_demo' => false,
                'metadata_json' => $meta,
            ]);

            $this->attachTopicsForMention($mention, $targetTopic, $activeTopicsForMatching, $affectedTopics);

            $newMentions[] = $mention;
            $accepted++;
            $platformStats[$platform]['accepted']++;
        }

        // Run existing TRINETRA analytics synchronously so dashboard reflects new data immediately
        if (!empty($newMentions)) {
            $this->ingestionService->analyzeBatchAndStoreNlp($newMentions);
            $this->runPostIngestAnalytics($newMentions, $affectedTopics);
        }

        // Record topic collection timestamps (stored in app.timezone for consistent Eloquent casts)
        $finishedAt = Carbon::now();
        foreach ($affectedTopics as $topic) {
            $topic->update(['last_collected_at' => $finishedAt]);
        }

        // Record audit runs and update connector sync telemetry per platform
        foreach ($platformStats as $platform => $stats) {
            $connector = Connector::firstOrCreate(
                ['workspace_id' => $workspaceId, 'provider' => $platform],
                [
                    'status' => 'connected',
                    'capabilities_json' => [
                        'keyword_search' => $platform === 'threads',
                        'public_content' => true,
                        'comments' => true,
                        'public_metrics' => true,
                        'ingestion_mode' => in_array($platform, self::META_PLATFORMS, true) ? 'muse_push' : 'api_push',
                    ],
                ]
            );

            $hasValidActivity = ($stats['accepted'] > 0 || $stats['duplicates_skipped'] > 0);
            if ($hasValidActivity) {
                $connector->update([
                    'status' => 'connected',
                    'last_successful_sync_at' => $finishedAt,
                ]);
            }

            IngestionRun::create([
                'connector_id' => $connector->id,
                'topic_id' => $targetTopic?->id,
                'status' => $hasValidActivity ? 'success' : 'failed',
                'counts_json' => [
                    'ingest_id' => $ingestId,
                    'source' => $source,
                    'collected' => $stats['collected'],
                    'new' => $stats['accepted'],
                    'accepted' => $stats['accepted'],
                    'duplicates' => $stats['duplicates_skipped'],
                    'duplicates_skipped' => $stats['duplicates_skipped'],
                    'rejected' => $stats['rejected'],
                    'errors' => array_slice($stats['errors'], 0, 10),
                ],
                'error_code' => $hasValidActivity ? null : 'VALIDATION_REJECTED',
                'error_message' => $hasValidActivity ? null : 'Seluruh item untuk platform ini gagal validasi.',
                'started_at' => $startedAt,
                'finished_at' => $finishedAt,
            ]);
        }

        if ($accepted > 0) {
            $this->invalidateWorkspaceCaches($workspaceId, array_keys($affectedTopics));
        }

        return [
            'status' => 'success',
            'accepted' => $accepted,
            'duplicates_skipped' => $duplicatesSkipped,
            'rejected' => $rejected,
            'errors' => $errors,
            'ingest_id' => $ingestId,
        ];
    }

    /**
     * Remove a mention by (platform, platform_post_id) for compliance takedown requests.
     *
     * @return array<string, mixed>|null
     */
    public function deleteByPlatformPostId(
        int $workspaceId,
        string $platform,
        string $platformPostId,
        ?string $ipAddress = null,
        ?string $reason = null
    ): ?array {
        $normalizedPlatform = strtolower(trim($platform));
        $normalizedPostId = trim($platformPostId);

        $mention = Mention::where('workspace_id', $workspaceId)
            ->where('provider', $normalizedPlatform)
            ->where('external_id', $normalizedPostId)
            ->first();

        if (!$mention) {
            return null;
        }

        $topicIds = $mention->topics()->pluck('topics.id')->all();
        $deletedId = (int) $mention->id;
        $sourceUrl = $mention->source_url;

        $mention->delete();

        AuditLog::create([
            'workspace_id' => $workspaceId,
            'actor_id' => null,
            'action' => 'muse_takedown_delete',
            'target_type' => 'mention',
            'target_id' => $deletedId,
            'metadata_json' => [
                'platform' => $normalizedPlatform,
                'platform_post_id' => $normalizedPostId,
                'source_url' => $sourceUrl,
                'reason' => $reason ?: 'Takedown request via Muse API',
            ],
            'ip_address' => $ipAddress,
        ]);

        $this->invalidateWorkspaceCaches($workspaceId, $topicIds);

        return [
            'deleted_mention_id' => $deletedId,
            'platform' => $normalizedPlatform,
            'platform_post_id' => $normalizedPostId,
        ];
    }

    private function resolveTopic(int $workspaceId, string $topicIdentifier): Topic
    {
        $query = Topic::where('workspace_id', $workspaceId)->with('keywords');

        $topic = (clone $query)->where('external_key', $topicIdentifier)->first();
        if (!$topic && ctype_digit($topicIdentifier)) {
            $topic = (clone $query)->where('id', (int) $topicIdentifier)->first();
        }

        if (!$topic) {
            throw ValidationException::withMessages([
                'topic_id' => ["Topik '{$topicIdentifier}' tidak ditemukan di workspace TRINETRA."],
            ]);
        }

        return $topic;
    }

    /**
     * Validate and normalize a single mention payload item according to spec section 5.2B.
     *
     * @param array<string, mixed> $item
     * @return array{valid: bool, platform?: string, error?: string, data?: array<string, mixed>}
     */
    private function validateItem(array $item): array
    {
        $platform = strtolower(trim((string) ($item['platform'] ?? '')));
        if (!in_array($platform, self::ALLOWED_PLATFORMS, true)) {
            return [
                'valid' => false,
                'error' => "Platform '{$platform}' tidak didukung. Pilihan valid: " . implode(', ', self::ALLOWED_PLATFORMS) . '.',
            ];
        }

        $postId = trim((string) ($item['platform_post_id'] ?? ''));
        if ($postId === '' || mb_strlen($postId) > 191) {
            return [
                'valid' => false,
                'platform' => $platform,
                'error' => 'Field platform_post_id wajib diisi (maks 191 karakter).',
            ];
        }

        $rawUrl = trim((string) ($item['url'] ?? ''));
        if ($rawUrl === '' || !$this->isValidHttpUrl($rawUrl)) {
            return [
                'valid' => false,
                'platform' => $platform,
                'error' => 'Field url wajib berupa URL http/https yang valid.',
            ];
        }

        $checkedUrl = $this->linkValidator->validateAndNormalize(
            provider: $platform,
            rawUrl: $rawUrl,
            queryHint: null,
            isDemo: false
        );

        if ($checkedUrl['link_status'] === SocialLinkValidator::STATUS_BROKEN_LEGACY || empty($checkedUrl['url'])) {
            return [
                'valid' => false,
                'platform' => $platform,
                'error' => $checkedUrl['reason'] ?? 'Format URL tidak valid atau rusak.',
            ];
        }

        $postedAtRaw = isset($item['posted_at']) ? trim((string) $item['posted_at']) : '';
        $postedAt = $this->parseIso8601ToWib($postedAtRaw);
        if ($postedAt === null) {
            return [
                'valid' => false,
                'platform' => $platform,
                'error' => 'Field posted_at wajib menggunakan format ISO 8601 yang valid.',
            ];
        }

        $mediaType = isset($item['media_type']) && is_string($item['media_type'])
            ? strtolower(trim($item['media_type']))
            : null;
        if ($mediaType === '') {
            $mediaType = null;
        }

        $authorUsername = isset($item['author_username']) ? ltrim(trim((string) $item['author_username']), '@') : null;
        if ($authorUsername === '') {
            $authorUsername = null;
        }
        $authorDisplayName = isset($item['author_display_name']) ? trim((string) $item['author_display_name']) : '';
        $authorName = $authorDisplayName !== ''
            ? $authorDisplayName
            : ($authorUsername !== null ? '@' . $authorUsername : ucfirst($platform) . ' User');

        $rawText = isset($item['text']) && is_string($item['text']) ? trim($item['text']) : '';
        $hasEmptyCaption = false;
        if ($rawText === '') {
            if ($mediaType !== null && in_array($mediaType, self::MEDIA_ONLY_TYPES, true)) {
                $rawText = "Postingan {$mediaType} oleh {$authorName}";
                $hasEmptyCaption = true;
            } else {
                return [
                    'valid' => false,
                    'platform' => $platform,
                    'error' => 'Field text wajib diisi kecuali media_type adalah video atau image.',
                ];
            }
        }

        $authorProfileUrl = isset($item['author_profile_url']) ? trim((string) $item['author_profile_url']) : null;
        if ($authorProfileUrl !== null && $authorProfileUrl !== '' && !$this->isValidHttpUrl($authorProfileUrl)) {
            $authorProfileUrl = null;
        } elseif ($authorProfileUrl === '') {
            $authorProfileUrl = null;
        }

        $likeCount = max(0, (int) ($item['like_count'] ?? 0));
        $commentCount = max(0, (int) ($item['comment_count'] ?? 0));
        $repostCount = max(0, (int) ($item['repost_count'] ?? 0));
        $quoteCount = max(0, (int) ($item['quote_count'] ?? 0));

        $followerCount = null;
        if (isset($item['author_follower_count']) && is_numeric($item['author_follower_count'])) {
            $followerCount = max(0, (int) $item['author_follower_count']);
        }

        $language = isset($item['language']) && is_string($item['language']) && trim($item['language']) !== ''
            ? strtolower(substr(trim($item['language']), 0, 10))
            : 'id';

        return [
            'valid' => true,
            'platform' => $platform,
            'data' => [
                'platform' => $platform,
                'platform_post_id' => $postId,
                'platform_post_code' => isset($item['platform_post_code']) ? trim((string) $item['platform_post_code']) ?: null : null,
                'url' => $checkedUrl['url'],
                'link_status' => $checkedUrl['link_status'],
                'link_reason' => $checkedUrl['reason'],
                'author_username' => $authorUsername,
                'author_name' => mb_substr($authorName, 0, 255),
                'author_follower_count' => $followerCount,
                'author_is_verified' => array_key_exists('author_is_verified', $item) && $item['author_is_verified'] !== null
                    ? (bool) $item['author_is_verified']
                    : null,
                'author_profile_url' => $authorProfileUrl,
                'posted_at' => $postedAt,
                'text' => $rawText,
                'has_empty_caption' => $hasEmptyCaption,
                'media_type' => $mediaType,
                'is_comment' => (bool) ($item['is_comment'] ?? false),
                'language' => $language,
                'raw_source' => isset($item['raw_source']) ? trim((string) $item['raw_source']) ?: null : null,
                'collector_note' => isset($item['collector_note']) ? trim((string) $item['collector_note']) ?: null : null,
                'metrics' => [
                    'likes' => $likeCount,
                    'comments' => $commentCount,
                    'shares' => $repostCount,
                    'repost_count' => $repostCount,
                    'quote_count' => $quoteCount,
                ],
            ],
        ];
    }

    private function parseIso8601ToWib(mixed $raw): ?Carbon
    {
        if (!is_string($raw)) {
            return null;
        }
        $trimmed = trim($raw);
        if ($trimmed === '') {
            return null;
        }

        if (!preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/', $trimmed)) {
            return null;
        }

        try {
            return Carbon::parse($trimmed)->setTimezone('Asia/Jakarta');
        } catch (Throwable) {
            return null;
        }
    }

    private function isValidHttpUrl(string $url): bool
    {
        if (!filter_var($url, FILTER_VALIDATE_URL)) {
            return false;
        }

        $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));
        return in_array($scheme, ['http', 'https'], true);
    }

    /**
     * Attach mention to explicit target topic or auto-matched active topics via include/exclude keywords.
     *
     * @param Collection<int, Topic> $activeTopics
     * @param array<int, Topic> $affectedTopics
     */
    private function attachTopicsForMention(
        Mention $mention,
        ?Topic $targetTopic,
        Collection $activeTopics,
        array &$affectedTopics
    ): void {
        if ($targetTopic !== null) {
            $matchedKeywords = $this->findMatchedKeywords($targetTopic, (string) $mention->text);
            MentionTopicMatch::firstOrCreate(
                [
                    'mention_id' => $mention->id,
                    'topic_id' => $targetTopic->id,
                ],
                [
                    'matched_keywords_json' => $matchedKeywords,
                ]
            );
            $affectedTopics[$targetTopic->id] = $targetTopic;
            return;
        }

        foreach ($activeTopics as $topic) {
            if ($this->matchesTopicExcludeKeywords($topic, (string) $mention->text)) {
                continue;
            }
            $matchedKeywords = $this->findMatchedKeywords($topic, (string) $mention->text);
            if (!empty($matchedKeywords)) {
                MentionTopicMatch::firstOrCreate(
                    [
                        'mention_id' => $mention->id,
                        'topic_id' => $topic->id,
                    ],
                    [
                        'matched_keywords_json' => $matchedKeywords,
                    ]
                );
                $affectedTopics[$topic->id] = $topic;
            }
        }
    }

    /**
     * @return array<int, string>
     */
    private function findMatchedKeywords(Topic $topic, string $text): array
    {
        $lowerText = Str::lower($text);
        $matched = [];

        foreach ($topic->keywords->where('type', 'include') as $kw) {
            $term = trim((string) $kw->keyword);
            if ($term !== '' && Str::contains($lowerText, Str::lower($term))) {
                $matched[] = $term;
            }
        }

        return array_values(array_unique($matched));
    }

    private function matchesTopicExcludeKeywords(Topic $topic, string $text): bool
    {
        $lowerText = Str::lower($text);
        foreach ($topic->keywords->where('type', 'exclude') as $kw) {
            $term = trim((string) $kw->keyword);
            if ($term !== '' && Str::contains($lowerText, Str::lower($term))) {
                return true;
            }
        }

        return false;
    }

    /**
     * Execute existing TRINETRA buzzer, trend, and alert services on ingested mentions.
     *
     * @param array<int, Mention> $newMentions
     * @param array<int, Topic> $affectedTopics
     */
    private function runPostIngestAnalytics(array $newMentions, array $affectedTopics): void
    {
        if (!empty($affectedTopics)) {
            $cutoff = Carbon::now('Asia/Jakarta')->subDays(7);
            foreach ($affectedTopics as $topic) {
                try {
                    $recentTopicMentions = $topic->mentions()
                        ->with('sentiment')
                        ->where('mentions.published_at', '>=', $cutoff)
                        ->orderBy('mentions.published_at', 'desc')
                        ->limit(200)
                        ->get();

                    if ($recentTopicMentions->isNotEmpty()) {
                        $this->buzzerDetectionService->evaluateMentionsBatch($recentTopicMentions);
                    }

                    $this->trendService->computeTopicTrend($topic);
                    $this->alertService->evaluateTopicAlerts($topic);
                } catch (Throwable $e) {
                    Log::warning("Post-ingest analytics warning for topic {$topic->id}: {$e->getMessage()}");
                }
            }
            return;
        }

        try {
            $collection = collect($newMentions)->each(fn (Mention $m) => $m->load('sentiment'));
            $this->buzzerDetectionService->evaluateMentionsBatch($collection);
        } catch (Throwable $e) {
            Log::warning("Post-ingest buzzer evaluation warning: {$e->getMessage()}");
        }
    }

    /**
     * @param array<int, int> $affectedTopicIds
     */
    private function invalidateWorkspaceCaches(int $workspaceId, array $affectedTopicIds = []): void
    {
        Cache::increment("ws_data_ver:{$workspaceId}");
        Cache::forget("trends_index_v2:{$workspaceId}");
        HotIssueService::forgetCache($workspaceId);

        foreach (['active', 'manage', 'all', 'paused', 'archived'] as $st) {
            Cache::forget("topics_index_v2:{$workspaceId}:{$st}");
        }

        foreach ([1, 2, 7, 14, 30] as $days) {
            Cache::forget("buzzer_radar_v2:{$workspaceId}:{$days}:all");
            foreach ($affectedTopicIds as $tid) {
                Cache::forget("buzzer_radar_v2:{$workspaceId}:{$days}:{$tid}");
            }
        }
    }
}
