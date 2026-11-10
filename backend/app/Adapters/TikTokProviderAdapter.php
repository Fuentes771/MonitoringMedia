<?php

namespace App\Adapters;

use App\Adapters\Concerns\ResolvesRapidApiKey;
use App\Models\Topic;
use App\Services\LocalScraperService;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Carbon\Carbon;
use Throwable;

class TikTokProviderAdapter implements ProviderAdapterInterface
{
    use ResolvesRapidApiKey;

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
        $localItems = $localScraper->scrape('tiktok', $query, 12);

        if (!empty($localItems)) {
            $records = [];
            foreach ($localItems as $item) {
                $records[] = [
                    'provider' => 'tiktok',
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
        $apiKey = $this->resolveRapidApiKey($topic->workspace_id, 'tiktok');

        if (empty($apiKey)) {
            return new IngestionResult(
                records: [],
                errorCode: 'NEEDS_CONFIGURATION',
                errorMessage: 'Scraper lokal tidak menemukan hasil baru dan RapidAPI belum dikonfigurasi.'
            );
        }

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

            if (in_array($response->status(), [401, 403])) {
                return new IngestionResult(
                    errorCode: 'QUOTA_EXCEEDED',
                    errorMessage: 'RapidAPI TikTok quota exceeded atau API Key tidak valid.'
                );
            }

            if (!$response->successful()) {
                return new IngestionResult(
                    errorCode: 'TIKTOK_API_ERROR_' . $response->status(),
                    errorMessage: 'TikTok RapidAPI error: ' . $response->body()
                );
            }

            $data = $response->json();
            $videos = $data['data']['videos'] ?? $data['items'] ?? $data['data'] ?? [];
            $nextCursor = isset($data['data']['cursor']) ? (string)$data['data']['cursor'] : null;

            $records = [];
            foreach ($videos as $item) {
                $videoId = $item['video_id'] ?? $item['aweme_id'] ?? $item['id'] ?? null;
                if (!$videoId) {
                    continue;
                }

                $text = $item['title'] ?? $item['desc'] ?? '';
                $author = $item['author'] ?? [];
                $authorHandle = $author['unique_id'] ?? $author['uniqueId'] ?? $author['nickname'] ?? 'tiktok_creator';
                $createTime = $item['create_time'] ?? null;
                $publishedAt = $createTime ? Carbon::createFromTimestamp($createTime)->setTimezone('Asia/Jakarta') : Carbon::now('Asia/Jakarta');

                $stats = [
                    'play_count' => (int)($item['play_count'] ?? $item['stats']['playCount'] ?? 0),
                    'digg_count' => (int)($item['digg_count'] ?? $item['stats']['diggCount'] ?? 0),
                    'comment_count' => (int)($item['comment_count'] ?? $item['stats']['commentCount'] ?? 0),
                    'share_count' => (int)($item['share_count'] ?? $item['stats']['shareCount'] ?? 0),
                ];

                $parentExternalId = 'tiktok_' . $videoId;
                $videoUrl = 'https://www.tiktok.com/@' . $authorHandle . '/video/' . $videoId;

                // 1. Post Utama (Video Caption)
                $records[] = [
                    'provider' => 'tiktok',
                    'external_id' => $parentExternalId,
                    'source_url' => $videoUrl,
                    'author_name' => '@' . ltrim($authorHandle, '@'),
                    'published_at' => $publishedAt,
                    'collected_at' => Carbon::now('Asia/Jakarta'),
                    'text' => $text ?: 'Video TikTok dari @' . $authorHandle,
                    'text_normalized' => Str::lower($text),
                    'language' => 'id',
                    'deletion_status' => 'active',
                    'is_demo' => false,
                    'metadata_json' => [
                        'video_id' => $videoId,
                        'is_comment' => false,
                        'metrics' => $stats,
                        'cover' => $item['cover'] ?? null,
                    ],
                    'matched_keywords' => array_slice($includeKeywords, 0, 2),
                ];

                // 2. Ekstraksi Top Komentar Netizen (jika ada di payload)
                $comments = $item['comments'] ?? $item['top_comments'] ?? [];
                if (is_array($comments)) {
                    foreach (array_slice($comments, 0, 15) as $idx => $comment) {
                        $commentId = $comment['cid'] ?? $comment['id'] ?? ($videoId . '_c_' . $idx);
                        $commentText = $comment['text'] ?? '';
                        if (empty(trim($commentText))) {
                            continue;
                        }

                        $commentUser = $comment['user'] ?? [];
                        $commentAuthor = $commentUser['unique_id'] ?? $commentUser['nickname'] ?? 'Netizen TikTok';
                        $commentTime = $comment['create_time'] ?? null;
                        $commentPublishedAt = $commentTime ? Carbon::createFromTimestamp($commentTime)->setTimezone('Asia/Jakarta') : $publishedAt;

                        $records[] = [
                            'provider' => 'tiktok',
                            'external_id' => 'tiktok_comment_' . $commentId,
                            'source_url' => $videoUrl,
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
                                'video_id' => $videoId,
                                'likes' => (int)($comment['digg_count'] ?? 0),
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
                errorCode: 'TIKTOK_NETWORK_ERROR',
                errorMessage: $e->getMessage()
            );
        }
    }
}

