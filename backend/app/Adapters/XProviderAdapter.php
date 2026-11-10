<?php

namespace App\Adapters;

use App\Adapters\Concerns\ResolvesRapidApiKey;
use App\Models\Topic;
use App\Services\LocalScraperService;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Carbon\Carbon;
use Throwable;

class XProviderAdapter implements ProviderAdapterInterface
{
    use ResolvesRapidApiKey;

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
        $includeKeywords = $topic->keywords()
            ->where('type', 'include')
            ->pluck('keyword')
            ->toArray();

        if (empty($includeKeywords)) {
            $includeKeywords = [$topic->name];
        }

        $query = implode(' ', array_slice($includeKeywords, 0, 2));

        // 1. PRIMARY ENGINE: Local Python Scraper (100% Free, zero external API key)
        $localScraper = app(LocalScraperService::class);
        $localItems = $localScraper->scrape('x', $query, 12);

        if (!empty($localItems)) {
            $records = [];
            foreach ($localItems as $item) {
                $records[] = [
                    'provider' => 'x',
                    'external_id' => $item['id'],
                    'source_url' => $item['source_url'],
                    'author_name' => $item['author_name'],
                    'published_at' => Carbon::parse($item['published_at'])->setTimezone('Asia/Jakarta'),
                    'collected_at' => Carbon::now('Asia/Jakarta'),
                    'text' => $item['text'],
                    'text_normalized' => mb_strtolower(trim($item['text'])),
                    'language' => 'id',
                    'is_demo' => false,
                    'metadata_json' => [
                        'metrics' => $item['metrics'] ?? [],
                        'source' => 'local_scraper',
                    ],
                ];
            }

            return new IngestionResult(records: $records, nextCursor: null);
        }

        // 2. SECONDARY ENGINE (FALLBACK): RapidAPI Gateway
        $apiKey = $this->resolveRapidApiKey($topic->workspace_id, 'x');

        if (empty($apiKey)) {
            return new IngestionResult(
                records: [],
                errorCode: 'NEEDS_CONFIGURATION',
                errorMessage: 'Scraper lokal tidak menemukan hasil baru dan RapidAPI belum dikonfigurasi.'
            );
        }

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

            if (in_array($response->status(), [401, 403])) {
                return new IngestionResult(
                    errorCode: 'QUOTA_EXCEEDED',
                    errorMessage: 'RapidAPI X (Twitter) quota exceeded atau API Key tidak valid.'
                );
            }

            if (!$response->successful()) {
                return new IngestionResult(
                    errorCode: 'X_API_ERROR_' . $response->status(),
                    errorMessage: 'X RapidAPI error: ' . $response->body()
                );
            }

            $data = $response->json();
            $results = $data['results'] ?? $data['tweets'] ?? $data['data'] ?? [];
            $nextCursor = $data['continuation_token'] ?? $data['next_cursor'] ?? null;

            $records = [];
            foreach ($results as $item) {
                $tweetId = $item['tweet_id'] ?? $item['id'] ?? $item['id_str'] ?? null;
                if (!$tweetId) {
                    continue;
                }

                $text = $item['text'] ?? $item['full_text'] ?? '';
                $user = $item['user'] ?? [];
                $authorName = $user['username'] ?? $user['screen_name'] ?? $user['name'] ?? 'Twitter User';
                $createdAtStr = $item['creation_date'] ?? $item['created_at'] ?? null;
                $publishedAt = $createdAtStr ? Carbon::parse($createdAtStr)->setTimezone('Asia/Jakarta') : Carbon::now('Asia/Jakarta');

                $metrics = [
                    'retweet_count' => (int)($item['retweet_count'] ?? 0),
                    'favorite_count' => (int)($item['favorite_count'] ?? 0),
                    'reply_count' => (int)($item['reply_count'] ?? 0),
                    'views' => (int)($item['views'] ?? $item['view_count'] ?? 0),
                ];

                $parentExternalId = 'x_' . $tweetId;
                $tweetUrl = 'https://x.com/' . $authorName . '/status/' . $tweetId;

                // 1. Post Utama (Tweet)
                $records[] = [
                    'provider' => 'x',
                    'external_id' => $parentExternalId,
                    'source_url' => $tweetUrl,
                    'author_name' => '@' . ltrim($authorName, '@'),
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
                    ],
                    'matched_keywords' => array_slice($includeKeywords, 0, 2),
                ];

                // 2. Ekstraksi Top Replies / Komentar Netizen (jika ada di payload)
                $replies = $item['replies'] ?? $item['comments'] ?? [];
                if (is_array($replies)) {
                    foreach (array_slice($replies, 0, 15) as $idx => $reply) {
                        $replyId = $reply['tweet_id'] ?? $reply['id'] ?? ($tweetId . '_rep_' . $idx);
                        $replyText = $reply['text'] ?? $reply['full_text'] ?? '';
                        if (empty(trim($replyText))) {
                            continue;
                        }

                        $replyUser = $reply['user'] ?? [];
                        $replyAuthor = $replyUser['username'] ?? $replyUser['screen_name'] ?? 'Netizen X';
                        $replyCreated = $reply['creation_date'] ?? $reply['created_at'] ?? null;
                        $replyPublishedAt = $replyCreated ? Carbon::parse($replyCreated)->setTimezone('Asia/Jakarta') : $publishedAt;

                        $records[] = [
                            'provider' => 'x',
                            'external_id' => 'x_comment_' . $replyId,
                            'source_url' => $tweetUrl,
                            'author_name' => '@' . ltrim($replyAuthor, '@'),
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
                                'likes' => (int)($reply['favorite_count'] ?? 0),
                            ],
                            'matched_keywords' => array_slice($includeKeywords, 0, 2),
                        ];
                    }
                }
            }

            return new IngestionResult(
                records: $records,
                nextCursor: $nextCursor,
                counts: ['collected' => count($records), 'new' => 0, 'duplicates' => 0]
            );

        } catch (Throwable $e) {
            return new IngestionResult(
                errorCode: 'X_NETWORK_ERROR',
                errorMessage: $e->getMessage()
            );
        }
    }
}

