<?php

namespace App\Adapters;

use App\Adapters\Concerns\ResolvesRapidApiKey;
use App\Models\Topic;
use App\Services\LocalScraperService;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Carbon\Carbon;
use Throwable;

class InstagramProviderAdapter implements ProviderAdapterInterface
{
    use ResolvesRapidApiKey;

    public function getProviderKey(): string
    {
        return 'instagram';
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
        $localItems = $localScraper->scrape('instagram', $query, 12);

        if (!empty($localItems)) {
            $records = [];
            foreach ($localItems as $item) {
                $records[] = [
                    'provider' => 'instagram',
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
        $apiKey = $this->resolveRapidApiKey($topic->workspace_id, 'instagram');

        if (empty($apiKey)) {
            return new IngestionResult(
                records: [],
                errorCode: 'NEEDS_CONFIGURATION',
                errorMessage: 'Scraper lokal tidak menemukan hasil baru dan RapidAPI belum dikonfigurasi.'
            );
        }

        // Instagram hashtag queries typically use clean single-word slug
        $firstKeyword = $includeKeywords[0];
        $tag = Str::slug(str_replace('#', '', $firstKeyword), '');

        $url = config('services.rapidapi.instagram.search_url', 'https://instagram-scraper-api2.p.rapidapi.com/v1/hashtag');
        $host = config('services.rapidapi.instagram.host', 'instagram-scraper-api2.p.rapidapi.com');

        try {
            $response = Http::timeout(12)
                ->withHeaders([
                    'X-RapidAPI-Key' => $apiKey,
                    'X-RapidAPI-Host' => $host,
                ])
                ->get($url, [
                    'tag' => $tag ?: 'indonesia',
                    'feed_type' => 'top',
                    'pagination_token' => $cursor,
                ]);

            if (in_array($response->status(), [401, 403])) {
                return new IngestionResult(
                    errorCode: 'QUOTA_EXCEEDED',
                    errorMessage: 'RapidAPI Instagram quota exceeded atau API Key tidak valid.'
                );
            }

            if (!$response->successful()) {
                return new IngestionResult(
                    errorCode: 'INSTAGRAM_API_ERROR_' . $response->status(),
                    errorMessage: 'Instagram RapidAPI error: ' . $response->body()
                );
            }

            $data = $response->json();
            $items = $data['data']['items'] ?? $data['items'] ?? $data['data'] ?? [];
            $nextCursor = $data['pagination_token'] ?? $data['next_max_id'] ?? null;

            $records = [];
            foreach ($items as $item) {
                $postId = $item['code'] ?? $item['id'] ?? $item['pk'] ?? null;
                if (!$postId) {
                    continue;
                }

                $caption = $item['caption']['text'] ?? $item['caption'] ?? '';
                if (is_array($caption)) {
                    $caption = $caption['text'] ?? '';
                }

                $user = $item['user'] ?? [];
                $username = $user['username'] ?? 'instagram_user';
                $takenAt = $item['taken_at'] ?? $item['device_timestamp'] ?? null;
                $publishedAt = $takenAt ? Carbon::createFromTimestamp($takenAt)->setTimezone('Asia/Jakarta') : Carbon::now('Asia/Jakarta');

                $metrics = [
                    'like_count' => (int)($item['like_count'] ?? 0),
                    'comment_count' => (int)($item['comment_count'] ?? 0),
                    'view_count' => (int)($item['view_count'] ?? 0),
                ];

                $parentExternalId = 'ig_' . $postId;
                $postUrl = 'https://www.instagram.com/p/' . $postId . '/';

                // 1. Post Utama
                $records[] = [
                    'provider' => 'instagram',
                    'external_id' => $parentExternalId,
                    'source_url' => $postUrl,
                    'author_name' => '@' . ltrim($username, '@'),
                    'published_at' => $publishedAt,
                    'collected_at' => Carbon::now('Asia/Jakarta'),
                    'text' => $caption ?: 'Postingan Instagram dari @' . $username,
                    'text_normalized' => Str::lower($caption),
                    'language' => 'id',
                    'deletion_status' => 'active',
                    'is_demo' => false,
                    'metadata_json' => [
                        'post_code' => $postId,
                        'is_comment' => false,
                        'metrics' => $metrics,
                    ],
                    'matched_keywords' => array_slice($includeKeywords, 0, 2),
                ];

                // 2. Ekstraksi Top Komentar Netizen
                $comments = $item['comments'] ?? $item['preview_comments'] ?? [];
                if (is_array($comments)) {
                    foreach (array_slice($comments, 0, 15) as $idx => $comment) {
                        $commentId = $comment['pk'] ?? $comment['id'] ?? ($postId . '_c_' . $idx);
                        $commentText = $comment['text'] ?? '';
                        if (empty(trim($commentText))) {
                            continue;
                        }

                        $commentUser = $comment['user'] ?? [];
                        $commentAuthor = $commentUser['username'] ?? 'Netizen Instagram';
                        $createdTime = $comment['created_at'] ?? $comment['created_at_utc'] ?? null;
                        $commentPublishedAt = $createdTime ? Carbon::createFromTimestamp($createdTime)->setTimezone('Asia/Jakarta') : $publishedAt;

                        $records[] = [
                            'provider' => 'instagram',
                            'external_id' => 'ig_comment_' . $commentId,
                            'source_url' => $postUrl,
                            'author_name' => '@' . ltrim($commentAuthor, '@'),
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
                                'post_code' => $postId,
                                'likes' => (int)($comment['comment_like_count'] ?? 0),
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
                errorCode: 'INSTAGRAM_NETWORK_ERROR',
                errorMessage: $e->getMessage()
            );
        }
    }
}

