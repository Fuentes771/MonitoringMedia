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

class InstagramProviderAdapter implements ProviderAdapterInterface
{
    use ResolvesRapidApiKey;
    use HandlesHybridSocialIngestion;

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
        ['query' => $query, 'include_keywords' => $includeKeywords] = $this->extractTopicQuery($topic, 2);
        $validator = app(SocialLinkValidator::class);

        $apiKey = $this->resolveRapidApiKey($topic->workspace_id, 'instagram');
        $rapidError = null;

        // 1. Primary API path when RapidAPI key is configured
        if (!empty($apiKey)) {
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

                if (in_array($response->status(), [401, 403, 429])) {
                    $rapidError = new IngestionResult(
                        errorCode: 'QUOTA_EXCEEDED',
                        errorMessage: 'RapidAPI Instagram quota exceeded atau API Key tidak valid.'
                    );
                } elseif (!$response->successful()) {
                    $rapidError = new IngestionResult(
                        errorCode: 'INSTAGRAM_API_ERROR_' . $response->status(),
                        errorMessage: 'Instagram RapidAPI error: ' . $response->body()
                    );
                } else {
                    $data = $response->json();
                    $items = $data['data']['items'] ?? $data['items'] ?? $data['data'] ?? [];
                    $nextCursor = $data['pagination_token'] ?? $data['next_max_id'] ?? null;

                    $records = [];
                    foreach ($items as $item) {
                        $postCode = $item['code'] ?? $item['shortcode'] ?? null;
                        $postId = $postCode ?? $item['id'] ?? $item['pk'] ?? null;
                        if (!$postId) {
                            continue;
                        }

                        $caption = $item['caption']['text'] ?? $item['caption'] ?? '';
                        if (is_array($caption)) {
                            $caption = $caption['text'] ?? '';
                        }
                        $caption = (string) $caption;

                        $user = $item['user'] ?? [];
                        $username = $user['username'] ?? 'instagram_user';
                        $takenAt = $item['taken_at'] ?? $item['device_timestamp'] ?? null;
                        $publishedAt = $takenAt ? Carbon::createFromTimestamp($takenAt)->setTimezone('Asia/Jakarta') : Carbon::now('Asia/Jakarta');

                        $metrics = [
                            'like_count' => (int) ($item['like_count'] ?? 0),
                            'comment_count' => (int) ($item['comment_count'] ?? 0),
                            'view_count' => (int) ($item['view_count'] ?? 0),
                        ];

                        $parentExternalId = 'ig_' . $postId;
                        $rawPostUrl = $item['permalink'] ?? $item['url'] ?? ($postCode ? "https://www.instagram.com/p/{$postCode}/" : null);
                        $checkedUrl = $validator->validateAndNormalize('instagram', $rawPostUrl, $query);

                        $displayText = $caption !== '' ? $caption : 'Postingan Instagram dari @' . $username;
                        $records[] = [
                            'provider' => 'instagram',
                            'external_id' => $parentExternalId,
                            'source_url' => $checkedUrl['url'],
                            'author_name' => '@' . ltrim((string) $username, '@'),
                            'published_at' => $publishedAt,
                            'collected_at' => Carbon::now('Asia/Jakarta'),
                            'text' => $displayText,
                            'text_normalized' => Str::lower($displayText),
                            'language' => 'id',
                            'deletion_status' => 'active',
                            'is_demo' => false,
                            'metadata_json' => [
                                'post_code' => $postCode ?? $postId,
                                'is_comment' => false,
                                'metrics' => $metrics,
                                'metrics_available' => true,
                                'link_status' => $checkedUrl['link_status'],
                                'source' => 'rapidapi',
                            ],
                            'matched_keywords' => $this->matchKeywordsInText($includeKeywords, $displayText),
                        ];

                        $comments = $item['comments'] ?? $item['preview_comments'] ?? [];
                        if (is_array($comments)) {
                            foreach (array_slice($comments, 0, 15) as $idx => $comment) {
                                $commentId = $comment['pk'] ?? $comment['id'] ?? ($postId . '_c_' . $idx);
                                $commentText = (string) ($comment['text'] ?? '');
                                if (trim($commentText) === '') {
                                    continue;
                                }

                                $commentUser = $comment['user'] ?? [];
                                $commentAuthor = $commentUser['username'] ?? 'NetizenInstagram';
                                $createdTime = $comment['created_at'] ?? $comment['created_at_utc'] ?? null;
                                $commentPublishedAt = $createdTime ? Carbon::createFromTimestamp($createdTime)->setTimezone('Asia/Jakarta') : $publishedAt;

                                $records[] = [
                                    'provider' => 'instagram',
                                    'external_id' => 'ig_comment_' . $commentId,
                                    'source_url' => $checkedUrl['url'],
                                    'author_name' => '@' . ltrim((string) $commentAuthor, '@'),
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
                                        'post_code' => $postCode ?? $postId,
                                        'likes' => (int) ($comment['comment_like_count'] ?? 0),
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
                Log::warning("Instagram RapidAPI exception, trying hybrid local fallback: {$e->getMessage()}");
                $rapidError = new IngestionResult(errorCode: 'INSTAGRAM_NETWORK_ERROR', errorMessage: $e->getMessage());
            }
        }

        // 2. Hybrid Local Enriched Fallback (DuckDuckGo + IG Embed)
        $localScraper = app(LocalScraperService::class);
        $localItems = $localScraper->scrape('instagram', $query, 12);
        $mapped = $this->mapLocalItemsToRecords('instagram', $localItems, $includeKeywords, $query);

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
            errorMessage: 'Scraper lokal tidak menemukan postingan Instagram terverifikasi dan RapidAPI belum dikonfigurasi.'
        );
    }
}
