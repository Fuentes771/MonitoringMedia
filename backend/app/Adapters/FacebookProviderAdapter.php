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

class FacebookProviderAdapter implements ProviderAdapterInterface
{
    use ResolvesRapidApiKey;
    use HandlesHybridSocialIngestion;

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
        ['query' => $query, 'include_keywords' => $includeKeywords] = $this->extractTopicQuery($topic, 2);
        $validator = app(SocialLinkValidator::class);

        $apiKey = $this->resolveRapidApiKey($topic->workspace_id, 'facebook');
        $rapidError = null;

        // 1. Primary API path when RapidAPI key is configured
        if (!empty($apiKey)) {
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

                if (in_array($response->status(), [401, 403, 429])) {
                    $rapidError = new IngestionResult(
                        errorCode: 'QUOTA_EXCEEDED',
                        errorMessage: 'RapidAPI Facebook quota exceeded atau API Key tidak valid.'
                    );
                } elseif (!$response->successful()) {
                    $rapidError = new IngestionResult(
                        errorCode: 'FACEBOOK_API_ERROR_' . $response->status(),
                        errorMessage: 'Facebook RapidAPI error: ' . $response->body()
                    );
                } else {
                    $data = $response->json();
                    $posts = $data['results'] ?? $data['posts'] ?? $data['data'] ?? [];
                    $nextCursor = $data['cursor'] ?? $data['next_cursor'] ?? null;

                    $records = [];
                    foreach ($posts as $item) {
                        $postId = (string) ($item['post_id'] ?? $item['id'] ?? '');
                        if ($postId === '') {
                            continue;
                        }

                        $text = (string) ($item['message'] ?? $item['text'] ?? $item['post_text'] ?? '');
                        $author = $item['author']['name'] ?? $item['author_name'] ?? $item['publisher'] ?? 'Facebook User';
                        $time = $item['time'] ?? $item['created_time'] ?? $item['published_at'] ?? null;
                        $publishedAt = $time ? Carbon::parse($time)->setTimezone('Asia/Jakarta') : Carbon::now('Asia/Jakarta');

                        $metrics = [
                            'reactions_count' => (int) ($item['reactions_count'] ?? $item['likes'] ?? 0),
                            'comments_count' => (int) ($item['comments_count'] ?? $item['comments'] ?? 0),
                            'shares_count' => (int) ($item['shares_count'] ?? $item['shares'] ?? 0),
                        ];

                        $parentExternalId = 'fb_' . $postId;
                        $rawUrl = $item['url'] ?? $item['post_url'] ?? ("https://www.facebook.com/permalink.php?story_fbid={$postId}");
                        $checkedUrl = $validator->validateAndNormalize('facebook', $rawUrl, $query);

                        $displayText = $text !== '' ? $text : 'Postingan Facebook oleh ' . $author;
                        $records[] = [
                            'provider' => 'facebook',
                            'external_id' => $parentExternalId,
                            'source_url' => $checkedUrl['url'],
                            'author_name' => $author,
                            'published_at' => $publishedAt,
                            'collected_at' => Carbon::now('Asia/Jakarta'),
                            'text' => $displayText,
                            'text_normalized' => Str::lower($displayText),
                            'language' => 'id',
                            'deletion_status' => 'active',
                            'is_demo' => false,
                            'metadata_json' => [
                                'post_id' => $postId,
                                'is_comment' => false,
                                'metrics' => $metrics,
                                'metrics_available' => true,
                                'link_status' => $checkedUrl['link_status'],
                                'source' => 'rapidapi',
                            ],
                            'matched_keywords' => $this->matchKeywordsInText($includeKeywords, $displayText),
                        ];

                        $comments = $item['top_comments'] ?? $item['comments_list'] ?? [];
                        if (is_array($comments)) {
                            foreach (array_slice($comments, 0, 15) as $idx => $comment) {
                                $commentId = $comment['comment_id'] ?? $comment['id'] ?? ($postId . '_c_' . $idx);
                                $commentText = (string) ($comment['text'] ?? $comment['message'] ?? '');
                                if (trim($commentText) === '') {
                                    continue;
                                }

                                $commentAuthor = $comment['author']['name'] ?? $comment['author_name'] ?? 'Netizen Facebook';
                                $commentTime = $comment['time'] ?? $comment['created_time'] ?? null;
                                $commentPublishedAt = $commentTime ? Carbon::parse($commentTime)->setTimezone('Asia/Jakarta') : $publishedAt;

                                $records[] = [
                                    'provider' => 'facebook',
                                    'external_id' => 'fb_comment_' . $commentId,
                                    'source_url' => $checkedUrl['url'],
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
                                        'likes' => (int) ($comment['likes'] ?? 0),
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
                Log::warning("Facebook RapidAPI exception, trying hybrid local fallback: {$e->getMessage()}");
                $rapidError = new IngestionResult(errorCode: 'FACEBOOK_NETWORK_ERROR', errorMessage: $e->getMessage());
            }
        }

        // 2. Hybrid Local Enriched Fallback
        $localScraper = app(LocalScraperService::class);
        $localItems = $localScraper->scrape('facebook', $query, 12);
        $mapped = $this->mapLocalItemsToRecords('facebook', $localItems, $includeKeywords, $query);

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
            errorMessage: 'Scraper lokal tidak menemukan postingan Facebook terverifikasi dan RapidAPI belum dikonfigurasi.'
        );
    }
}
