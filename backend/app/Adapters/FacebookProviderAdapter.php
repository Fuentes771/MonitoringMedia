<?php

namespace App\Adapters;

use App\Adapters\Concerns\ResolvesRapidApiKey;
use App\Models\Topic;
use App\Services\LocalScraperService;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Carbon\Carbon;
use Throwable;

class FacebookProviderAdapter implements ProviderAdapterInterface
{
    use ResolvesRapidApiKey;

    public function getProviderKey(): string
    {
        return 'facebook';
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
        $localItems = $localScraper->scrape('facebook', $query, 12);

        if (!empty($localItems)) {
            $records = [];
            foreach ($localItems as $item) {
                $records[] = [
                    'provider' => 'facebook',
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
        $apiKey = $this->resolveRapidApiKey($topic->workspace_id, 'facebook');

        if (empty($apiKey)) {
            return new IngestionResult(
                records: [],
                errorCode: 'NEEDS_CONFIGURATION',
                errorMessage: 'Scraper lokal tidak menemukan hasil baru dan RapidAPI belum dikonfigurasi.'
            );
        }

        $url = config('services.rapidapi.facebook.search_url', 'https://facebook-scraper3.p.rapidapi.com/search/posts');
        $host = config('services.rapidapi.facebook.host', 'facebook-scraper3.p.rapidapi.com');

        try {
            $response = Http::timeout(12)
                ->withHeaders([
                    'X-RapidAPI-Key' => $apiKey,
                    'X-RapidAPI-Host' => $host,
                ])
                ->get($url, [
                    'query' => $query,
                    'recent' => 'true',
                    'cursor' => $cursor,
                ]);

            if (in_array($response->status(), [401, 403])) {
                return new IngestionResult(
                    errorCode: 'QUOTA_EXCEEDED',
                    errorMessage: 'RapidAPI Facebook quota exceeded atau API Key tidak valid.'
                );
            }

            if (!$response->successful()) {
                return new IngestionResult(
                    errorCode: 'FACEBOOK_API_ERROR_' . $response->status(),
                    errorMessage: 'Facebook RapidAPI error: ' . $response->body()
                );
            }

            $data = $response->json();
            $posts = $data['results'] ?? $data['posts'] ?? $data['data'] ?? [];
            $nextCursor = $data['cursor'] ?? $data['next_cursor'] ?? null;

            $records = [];
            foreach ($posts as $item) {
                $postId = $item['post_id'] ?? $item['id'] ?? null;
                if (!$postId) {
                    continue;
                }

                $text = $item['message'] ?? $item['text'] ?? $item['post_text'] ?? '';
                $author = $item['author']['name'] ?? $item['author_name'] ?? $item['publisher'] ?? 'Facebook User';
                $time = $item['time'] ?? $item['created_time'] ?? $item['published_at'] ?? null;
                $publishedAt = $time ? Carbon::parse($time)->setTimezone('Asia/Jakarta') : Carbon::now('Asia/Jakarta');

                $metrics = [
                    'reactions_count' => (int)($item['reactions_count'] ?? $item['likes'] ?? 0),
                    'comments_count' => (int)($item['comments_count'] ?? $item['comments'] ?? 0),
                    'shares_count' => (int)($item['shares_count'] ?? $item['shares'] ?? 0),
                ];

                $parentExternalId = 'fb_' . $postId;
                $postUrl = $item['url'] ?? ('https://www.facebook.com/' . $postId);

                // 1. Post Utama
                $records[] = [
                    'provider' => 'facebook',
                    'external_id' => $parentExternalId,
                    'source_url' => $postUrl,
                    'author_name' => $author,
                    'published_at' => $publishedAt,
                    'collected_at' => Carbon::now('Asia/Jakarta'),
                    'text' => $text ?: 'Postingan Facebook oleh ' . $author,
                    'text_normalized' => Str::lower($text),
                    'language' => 'id',
                    'deletion_status' => 'active',
                    'is_demo' => false,
                    'metadata_json' => [
                        'post_id' => $postId,
                        'is_comment' => false,
                        'metrics' => $metrics,
                    ],
                    'matched_keywords' => array_slice($includeKeywords, 0, 2),
                ];

                // 2. Ekstraksi Top Komentar Netizen
                $comments = $item['top_comments'] ?? $item['comments_list'] ?? [];
                if (is_array($comments)) {
                    foreach (array_slice($comments, 0, 15) as $idx => $comment) {
                        $commentId = $comment['comment_id'] ?? $comment['id'] ?? ($postId . '_c_' . $idx);
                        $commentText = $comment['text'] ?? $comment['message'] ?? '';
                        if (empty(trim($commentText))) {
                            continue;
                        }

                        $commentAuthor = $comment['author']['name'] ?? $comment['author_name'] ?? 'Netizen Facebook';
                        $commentTime = $comment['time'] ?? $comment['created_time'] ?? null;
                        $commentPublishedAt = $commentTime ? Carbon::parse($commentTime)->setTimezone('Asia/Jakarta') : $publishedAt;

                        $records[] = [
                            'provider' => 'facebook',
                            'external_id' => 'fb_comment_' . $commentId,
                            'source_url' => $postUrl,
                            'author_name' => $commentAuthor,
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
                                'post_id' => $postId,
                                'likes' => (int)($comment['likes'] ?? 0),
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
                errorCode: 'FACEBOOK_NETWORK_ERROR',
                errorMessage: $e->getMessage()
            );
        }
    }
}

