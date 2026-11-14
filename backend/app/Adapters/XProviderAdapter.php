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

class XProviderAdapter implements ProviderAdapterInterface
{
    use ResolvesRapidApiKey;
    use HandlesHybridSocialIngestion;

    public function getProviderKey(): string
    {
        return 'x';
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

        $apiKey = $this->resolveRapidApiKey($topic->workspace_id, 'x');
        $rapidError = null;

        // 1. Primary API path when RapidAPI key is configured (delivers comments + metrics)
        if (!empty($apiKey)) {
            $url = config('services.rapidapi.x.search_url', 'https://twitter154.p.rapidapi.com/search/search');
            $host = config('services.rapidapi.x.host', 'twitter154.p.rapidapi.com');

            try {
                $response = Http::timeout(12)
                    ->withHeaders([
                        'X-RapidAPI-Key' => $apiKey,
                        'X-RapidAPI-Host' => $host,
                    ])
                    ->get($url, [
                        'query' => $query,
                        'section' => 'top',
                        'limit' => 15,
                        'language' => 'id',
                        'continuation_token' => $cursor,
                    ]);

                if (in_array($response->status(), [401, 403, 429])) {
                    $rapidError = new IngestionResult(
                        errorCode: 'QUOTA_EXCEEDED',
                        errorMessage: 'RapidAPI X (Twitter) quota exceeded atau API Key tidak valid.'
                    );
                } elseif (!$response->successful()) {
                    $rapidError = new IngestionResult(
                        errorCode: 'X_API_ERROR_' . $response->status(),
                        errorMessage: 'X RapidAPI error: ' . $response->body()
                    );
                } else {
                    $data = $response->json();
                    $results = $data['results'] ?? $data['tweets'] ?? $data['data'] ?? [];
                    $nextCursor = $data['continuation_token'] ?? $data['next_cursor'] ?? null;

                    $records = [];
                    foreach ($results as $item) {
                        $tweetId = (string) ($item['tweet_id'] ?? $item['id'] ?? $item['id_str'] ?? '');
                        if ($tweetId === '') {
                            continue;
                        }

                        $text = (string) ($item['text'] ?? $item['full_text'] ?? '');
                        if (trim($text) === '') {
                            continue;
                        }

                        $user = $item['user'] ?? [];
                        $rawHandle = $user['username'] ?? $user['screen_name'] ?? null;
                        $displayName = $user['name'] ?? null;
                        // Sanitize handle strictly so spaces in display names never corrupt tweet URLs
                        $safeHandle = preg_replace('/[^a-zA-Z0-9_]/', '', (string) ($rawHandle ?: ''));
                        $rawUrl = $safeHandle !== ''
                            ? "https://x.com/{$safeHandle}/status/{$tweetId}"
                            : "https://x.com/i/web/status/{$tweetId}";

                        $checkedUrl = $validator->validateAndNormalize('x', $rawUrl, $query);
                        $createdAtStr = $item['creation_date'] ?? $item['created_at'] ?? null;
                        $publishedAt = $createdAtStr ? Carbon::parse($createdAtStr)->setTimezone('Asia/Jakarta') : Carbon::now('Asia/Jakarta');

                        $metrics = [
                            'retweet_count' => (int) ($item['retweet_count'] ?? 0),
                            'favorite_count' => (int) ($item['favorite_count'] ?? 0),
                            'reply_count' => (int) ($item['reply_count'] ?? 0),
                            'views' => (int) ($item['views'] ?? $item['view_count'] ?? 0),
                        ];

                        $parentExternalId = 'x_' . $tweetId;
                        $authorLabel = $safeHandle !== '' ? '@' . ltrim($safeHandle, '@') : ($displayName ?: '@netizen_x');

                        $records[] = [
                            'provider' => 'x',
                            'external_id' => $parentExternalId,
                            'source_url' => $checkedUrl['url'],
                            'author_name' => $authorLabel,
                            'published_at' => $publishedAt,
                            'collected_at' => Carbon::now('Asia/Jakarta'),
                            'text' => $text,
                            'text_normalized' => Str::lower($text),
                            'language' => 'id',
                            'deletion_status' => 'active',
                            'is_demo' => false,
                            'metadata_json' => [
                                'tweet_id' => $tweetId,
                                'is_comment' => false,
                                'metrics' => $metrics,
                                'metrics_available' => true,
                                'link_status' => $checkedUrl['link_status'],
                                'source' => 'rapidapi',
                            ],
                            'matched_keywords' => $this->matchKeywordsInText($includeKeywords, $text),
                        ];

                        $replies = $item['replies'] ?? $item['comments'] ?? [];
                        if (is_array($replies)) {
                            foreach (array_slice($replies, 0, 15) as $idx => $reply) {
                                $replyId = $reply['tweet_id'] ?? $reply['id'] ?? ($tweetId . '_rep_' . $idx);
                                $replyText = (string) ($reply['text'] ?? $reply['full_text'] ?? '');
                                if (trim($replyText) === '') {
                                    continue;
                                }

                                $replyUser = $reply['user'] ?? [];
                                $replyHandle = $replyUser['username'] ?? $replyUser['screen_name'] ?? 'NetizenX';
                                $replyCreated = $reply['creation_date'] ?? $reply['created_at'] ?? null;
                                $replyPublishedAt = $replyCreated ? Carbon::parse($replyCreated)->setTimezone('Asia/Jakarta') : $publishedAt;

                                $records[] = [
                                    'provider' => 'x',
                                    'external_id' => 'x_comment_' . $replyId,
                                    'source_url' => $checkedUrl['url'],
                                    'author_name' => '@' . ltrim(preg_replace('/\s+/', '', (string) $replyHandle), '@'),
                                    'published_at' => $replyPublishedAt,
                                    'collected_at' => Carbon::now('Asia/Jakarta'),
                                    'text' => $replyText,
                                    'text_normalized' => Str::lower($replyText),
                                    'language' => 'id',
                                    'deletion_status' => 'active',
                                    'is_demo' => false,
                                    'metadata_json' => [
                                        'is_comment' => true,
                                        'parent_external_id' => $parentExternalId,
                                        'reply_to_tweet_id' => $tweetId,
                                        'likes' => (int) ($reply['favorite_count'] ?? 0),
                                        'metrics_available' => true,
                                        'link_status' => $checkedUrl['link_status'],
                                        'source' => 'rapidapi',
                                    ],
                                    'matched_keywords' => $this->matchKeywordsInText($includeKeywords, $replyText),
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
                Log::warning("X RapidAPI exception, trying hybrid local fallback: {$e->getMessage()}");
                $rapidError = new IngestionResult(errorCode: 'X_NETWORK_ERROR', errorMessage: $e->getMessage());
            }
        }

        // 2. Hybrid Local Enriched Fallback (DuckDuckGo + X Syndication / oEmbed)
        $localScraper = app(LocalScraperService::class);
        $localItems = $localScraper->scrape('x', $query, 12);
        $mapped = $this->mapLocalItemsToRecords('x', $localItems, $includeKeywords, $query);

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
            errorMessage: 'Scraper lokal tidak menemukan postingan X terverifikasi dan RapidAPI belum dikonfigurasi.'
        );
    }
}
