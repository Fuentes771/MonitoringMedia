<?php

namespace App\Adapters;

use App\Adapters\Concerns\HandlesHybridSocialIngestion;
use App\Adapters\Concerns\ResolvesRapidApiKey;
use App\Models\Topic;
use App\Services\LocalScraperService;
use App\Services\SocialLinkValidator;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class TikTokProviderAdapter implements ProviderAdapterInterface
{
    use ResolvesRapidApiKey;
    use HandlesHybridSocialIngestion;

    public function getProviderKey(): string
    {
        return 'tiktok';
    }

    public function getCapabilities(): array
    {
        return [
            'keyword_search' => true,
            'public_content' => true,
            'comments' => true,
            'public_metrics' => true,
            'historical_backfill' => 'limited',
            'streaming' => false,
        ];
    }

    public function fetch(Topic $topic, ?string $cursor = null): IngestionResult
    {
        ['query' => $query, 'include_keywords' => $includeKeywords] = $this->extractTopicQuery($topic, 2);
        $validator = app(SocialLinkValidator::class);

        $apiKey = $this->resolveRapidApiKey($topic->workspace_id, 'tiktok');
        $rapidError = null;

        // 1. Primary API path when RapidAPI key is configured
        if (!empty($apiKey)) {
            $url = config('services.rapidapi.tiktok.search_url', 'https://tiktok-scraper7.p.rapidapi.com/feed/search');
            $host = config('services.rapidapi.tiktok.host', 'tiktok-scraper7.p.rapidapi.com');

            try {
                $response = Http::timeout(12)
                    ->withHeaders([
                        'X-RapidAPI-Key' => $apiKey,
                        'X-RapidAPI-Host' => $host,
                    ])
                    ->get($url, [
                        'keywords' => $query,
                        'count' => 12,
                        'cursor' => $cursor ?: 0,
                        'region' => 'ID',
                    ]);

                if (in_array($response->status(), [401, 403, 429])) {
                    $rapidError = new IngestionResult(
                        errorCode: 'QUOTA_EXCEEDED',
                        errorMessage: 'RapidAPI TikTok quota exceeded atau API Key tidak valid.'
                    );
                } elseif (!$response->successful()) {
                    $rapidError = new IngestionResult(
                        errorCode: 'TIKTOK_API_ERROR_' . $response->status(),
                        errorMessage: 'TikTok RapidAPI error: ' . $response->body()
                    );
                } else {
                    $data = $response->json();
                    $videos = $data['data']['videos'] ?? $data['items'] ?? $data['data'] ?? [];
                    $nextCursor = isset($data['data']['cursor']) ? (string) $data['data']['cursor'] : null;

                    $records = [];
                    foreach ($videos as $item) {
                        $videoId = (string) ($item['video_id'] ?? $item['aweme_id'] ?? $item['id'] ?? '');
                        if ($videoId === '') {
                            continue;
                        }

                        $text = (string) ($item['title'] ?? $item['desc'] ?? '');
                        $author = $item['author'] ?? [];
                        $rawHandle = $author['unique_id'] ?? $author['uniqueId'] ?? $author['nickname'] ?? 'tiktok_creator';
                        $safeHandle = preg_replace('/\s+/', '', (string) $rawHandle) ?: 'tiktok_creator';

                        $rawUrl = $item['share_url'] ?? $item['url'] ?? ("https://www.tiktok.com/@{$safeHandle}/video/{$videoId}");
                        $checkedUrl = $validator->validateAndNormalize('tiktok', $rawUrl, $query);

                        $createTime = $item['create_time'] ?? null;
                        $publishedAt = $createTime ? Carbon::createFromTimestamp($createTime)->setTimezone('Asia/Jakarta') : Carbon::now('Asia/Jakarta');

                        $stats = [
                            'play_count' => (int) ($item['play_count'] ?? $item['stats']['playCount'] ?? 0),
                            'digg_count' => (int) ($item['digg_count'] ?? $item['stats']['diggCount'] ?? 0),
                            'comment_count' => (int) ($item['comment_count'] ?? $item['stats']['commentCount'] ?? 0),
                            'share_count' => (int) ($item['share_count'] ?? $item['stats']['shareCount'] ?? 0),
                        ];

                        $parentExternalId = 'tiktok_' . $videoId;
                        $caption = $text !== '' ? $text : 'Video TikTok dari @' . $safeHandle;

                        $records[] = [
                            'provider' => 'tiktok',
                            'external_id' => $parentExternalId,
                            'source_url' => $checkedUrl['url'],
                            'author_name' => '@' . ltrim($safeHandle, '@'),
                            'published_at' => $publishedAt,
                            'collected_at' => Carbon::now('Asia/Jakarta'),
                            'text' => $caption,
                            'text_normalized' => Str::lower($caption),
                            'language' => 'id',
                            'deletion_status' => 'active',
                            'is_demo' => false,
                            'metadata_json' => [
                                'video_id' => $videoId,
                                'is_comment' => false,
                                'metrics' => $stats,
                                'metrics_available' => true,
                                'link_status' => $checkedUrl['link_status'],
                                'cover' => $item['cover'] ?? null,
                                'source' => 'rapidapi',
                            ],
                            'matched_keywords' => $this->matchKeywordsInText($includeKeywords, $caption),
                        ];

                        $comments = $item['comments'] ?? $item['top_comments'] ?? [];
                        if (is_array($comments)) {
                            foreach (array_slice($comments, 0, 15) as $idx => $comment) {
                                $commentId = $comment['cid'] ?? $comment['id'] ?? ($videoId . '_c_' . $idx);
                                $commentText = (string) ($comment['text'] ?? '');
                                if (trim($commentText) === '') {
                                    continue;
                                }

                                $commentUser = $comment['user'] ?? [];
                                $commentAuthor = $commentUser['unique_id'] ?? $commentUser['nickname'] ?? 'NetizenTikTok';
                                $commentTime = $comment['create_time'] ?? null;
                                $commentPublishedAt = $commentTime ? Carbon::createFromTimestamp($commentTime)->setTimezone('Asia/Jakarta') : $publishedAt;

                                $records[] = [
                                    'provider' => 'tiktok',
                                    'external_id' => 'tiktok_comment_' . $commentId,
                                    'source_url' => $checkedUrl['url'],
                                    'author_name' => '@' . ltrim(preg_replace('/\s+/', '', (string) $commentAuthor), '@'),
                                    'published_at' => $commentPublishedAt,
                                    'collected_at' => Carbon::now('Asia/Jakarta'),
                                    'text' => $commentText,
                                    'text_normalized' => Str::lower($commentText),
                                    'language' => 'id',
                                    'deletion_status' => 'active',
                                    'is_demo' => false,
                                    'metadata_json' => [
                                        'is_comment' => true,
                                        'parent_external_id' => $parentExternalId,
                                        'video_id' => $videoId,
                                        'likes' => (int) ($comment['digg_count'] ?? 0),
                                        'metrics_available' => true,
                                        'link_status' => $checkedUrl['link_status'],
                                        'source' => 'rapidapi',
                                    ],
                                    'matched_keywords' => $this->matchKeywordsInText($includeKeywords, $commentText),
                                ];
                            }
                        }
                    }

                    if (!empty($records)) {
                        return new IngestionResult(
                            records: $records,
                            nextCursor: $nextCursor,
                            counts: ['collected' => count($records), 'new' => 0, 'duplicates' => 0]
                        );
                    }
                }
            } catch (Throwable $e) {
                Log::warning("TikTok RapidAPI exception, trying hybrid local fallback: {$e->getMessage()}");
                $rapidError = new IngestionResult(errorCode: 'TIKTOK_NETWORK_ERROR', errorMessage: $e->getMessage());
            }
        }

        // 2. Hybrid Local Enriched Fallback
        $localScraper = app(LocalScraperService::class);
        $localItems = $localScraper->scrape('tiktok', $query, 12);
        $mapped = $this->mapLocalItemsToRecords('tiktok', $localItems, $includeKeywords, $query);

        if (!empty($mapped)) {
            return new IngestionResult(
                records: $mapped,
                nextCursor: null,
                counts: ['collected' => count($mapped), 'new' => 0, 'duplicates' => 0]
            );
        }

        if ($rapidError !== null) {
            return $rapidError;
        }

        return new IngestionResult(
            records: [],
            errorCode: 'NEEDS_CONFIGURATION',
            errorMessage: 'Scraper lokal tidak menemukan video TikTok terverifikasi dan RapidAPI belum dikonfigurasi.'
        );
    }
}
