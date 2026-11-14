<?php

namespace App\Adapters;

use App\Adapters\Concerns\HandlesHybridSocialIngestion;
use App\Adapters\Concerns\ResolvesRapidApiKey;
use App\Models\Connector;
use App\Models\Topic;
use App\Services\LocalScraperService;
use App\Services\SocialLinkValidator;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class YouTubeProviderAdapter implements ProviderAdapterInterface
{
    use ResolvesRapidApiKey;
    use HandlesHybridSocialIngestion;

    public function getProviderKey(): string
    {
        return 'youtube';
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
        ['query' => $query, 'include_keywords' => $includeKeywords] = $this->extractTopicQuery($topic, 3);
        $apiKey = $this->resolveYouTubeKey($topic->workspace_id);
        $apiError = null;

        // 1. Official YouTube Data API v3 when valid API key is present
        if (!empty($apiKey)) {
            $params = [
                'part' => 'snippet',
                'q' => $query,
                'type' => 'video',
                'maxResults' => 12,
                'relevanceLanguage' => 'id',
                'key' => $apiKey,
            ];
            if ($cursor) {
                $params['pageToken'] = $cursor;
            }

            try {
                $response = Http::timeout(10)->get('https://www.googleapis.com/youtube/v3/search', $params);

                if ($response->status() === 403 || $response->status() === 400) {
                    $apiError = new IngestionResult(
                        errorCode: 'QUOTA_EXCEEDED',
                        errorMessage: 'YouTube Data API v3 quota exceeded atau API key tidak valid.'
                    );
                } elseif (!$response->successful()) {
                    $apiError = new IngestionResult(
                        errorCode: 'YOUTUBE_API_ERROR_' . $response->status(),
                        errorMessage: 'YouTube API error: ' . $response->body()
                    );
                } else {
                    $data = $response->json();
                    $items = $data['items'] ?? [];
                    $nextPageToken = $data['nextPageToken'] ?? null;

                    $videoIds = array_values(array_filter(array_map(
                        fn ($it) => $it['id']['videoId'] ?? null,
                        $items
                    )));
                    $statsMap = $this->fetchVideoStatistics($videoIds, $apiKey);

                    $records = [];
                    foreach ($items as $index => $item) {
                        $videoId = $item['id']['videoId'] ?? null;
                        if (!$videoId) {
                            continue;
                        }

                        $snippet = $item['snippet'] ?? [];
                        $title = (string) ($snippet['title'] ?? '');
                        $description = (string) ($snippet['description'] ?? '');
                        $channelTitle = (string) ($snippet['channelTitle'] ?? 'YouTube Creator');
                        $publishedAtStr = $snippet['publishedAt'] ?? null;

                        $fullText = trim($title . ($description ? '. ' . $description : ''));
                        if ($fullText === '') {
                            continue;
                        }

                        $publishedAt = $publishedAtStr ? Carbon::parse($publishedAtStr)->setTimezone('Asia/Jakarta') : Carbon::now('Asia/Jakarta');
                        $videoUrl = 'https://www.youtube.com/watch?v=' . $videoId;
                        $parentExternalId = 'yt_' . $videoId;
                        $stats = $statsMap[$videoId] ?? null;

                        $records[] = [
                            'provider' => 'youtube',
                            'external_id' => $parentExternalId,
                            'source_url' => $videoUrl,
                            'author_name' => $channelTitle,
                            'published_at' => $publishedAt,
                            'collected_at' => Carbon::now('Asia/Jakarta'),
                            'text' => $fullText,
                            'text_normalized' => Str::lower($fullText),
                            'language' => 'id',
                            'deletion_status' => 'active',
                            'is_demo' => false,
                            'metadata_json' => [
                                'video_id' => $videoId,
                                'is_comment' => false,
                                'metrics' => $stats ?? [],
                                'metrics_available' => $stats !== null,
                                'link_status' => SocialLinkValidator::STATUS_VERIFIED_POST,
                                'thumbnails' => $snippet['thumbnails'] ?? null,
                                'source' => 'youtube_data_api_v3',
                            ],
                            'matched_keywords' => $this->matchKeywordsInText($includeKeywords, $fullText),
                        ];

                        // Fetch top public comments on the top 3 videos to enrich netizen sentiment
                        if ($index < 3) {
                            foreach ($this->fetchVideoComments($videoId, $videoUrl, $parentExternalId, $apiKey, $includeKeywords) as $commentRecord) {
                                $records[] = $commentRecord;
                            }
                        }
                    }

                    if (!empty($records)) {
                        return new IngestionResult(
                            records: $records,
                            nextCursor: $nextPageToken,
                            counts: ['collected' => count($records), 'new' => 0, 'duplicates' => 0]
                        );
                    }
                }
            } catch (Throwable $e) {
                Log::warning("YouTube Data API v3 exception, falling back to local ytInitialData scraper: {$e->getMessage()}");
                $apiError = new IngestionResult(errorCode: 'YOUTUBE_NETWORK_ERROR', errorMessage: $e->getMessage());
            }
        }

        // 2. Seamless free local fallback via Python ytInitialData search (no API key needed)
        $localScraper = app(LocalScraperService::class);
        $localItems = $localScraper->scrape('youtube', $query, 12);
        $mapped = $this->mapLocalItemsToRecords('youtube', $localItems, $includeKeywords, $query);

        if (!empty($mapped)) {
            return new IngestionResult(
                records: $mapped,
                nextCursor: null,
                counts: ['collected' => count($mapped), 'new' => 0, 'duplicates' => 0]
            );
        }

        if ($apiError !== null) {
            return $apiError;
        }

        return new IngestionResult(
            records: [],
            errorCode: 'NEEDS_CONFIGURATION',
            errorMessage: 'YouTube Data API v3 Key belum dikonfigurasi dan scraper YouTube lokal tidak merespons.'
        );
    }

    private function resolveYouTubeKey(int $workspaceId): ?string
    {
        $connector = Connector::where('workspace_id', $workspaceId)
            ->where('provider', 'youtube')
            ->first();

        if ($connector && $connector->credential) {
            $payload = $connector->credential->encrypted_payload;
            if (is_array($payload) && $this->isUsableApiKey($payload['api_key'] ?? null)) {
                return trim($payload['api_key']);
            }
            if (is_string($payload) && $this->isUsableApiKey($payload)) {
                return trim($payload);
            }
        }

        $envKey = config('services.youtube.api_key', env('YOUTUBE_API_KEY'));
        return $this->isUsableApiKey($envKey) ? trim((string) $envKey) : null;
    }

    /**
     * @param array<int, string> $videoIds
     * @return array<string, array<string, int>>
     */
    private function fetchVideoStatistics(array $videoIds, string $apiKey): array
    {
        if (empty($videoIds)) {
            return [];
        }

        try {
            $resp = Http::timeout(8)->get('https://www.googleapis.com/youtube/v3/videos', [
                'part' => 'statistics',
                'id' => implode(',', array_slice($videoIds, 0, 15)),
                'key' => $apiKey,
            ]);

            if (!$resp->successful()) {
                return [];
            }

            $out = [];
            foreach ($resp->json('items', []) as $it) {
                $id = $it['id'] ?? null;
                $s = $it['statistics'] ?? [];
                if ($id) {
                    $out[$id] = [
                        'views' => (int) ($s['viewCount'] ?? 0),
                        'likes' => (int) ($s['likeCount'] ?? 0),
                        'comments' => (int) ($s['commentCount'] ?? 0),
                    ];
                }
            }
            return $out;
        } catch (Throwable) {
            return [];
        }
    }

    /**
     * @param array<int, string> $includeKeywords
     * @return array<int, array<string, mixed>>
     */
    private function fetchVideoComments(
        string $videoId,
        string $videoUrl,
        string $parentExternalId,
        string $apiKey,
        array $includeKeywords
    ): array {
        try {
            $resp = Http::timeout(8)->get('https://www.googleapis.com/youtube/v3/commentThreads', [
                'part' => 'snippet',
                'videoId' => $videoId,
                'order' => 'relevance',
                'maxResults' => 5,
                'textFormat' => 'plainText',
                'key' => $apiKey,
            ]);

            if (!$resp->successful()) {
                return [];
            }

            $records = [];
            foreach ($resp->json('items', []) as $thread) {
                $top = $thread['snippet']['topLevelComment'] ?? null;
                if (!$top) {
                    continue;
                }
                $cId = $top['id'] ?? null;
                $cSnippet = $top['snippet'] ?? [];
                $cText = trim((string) ($cSnippet['textDisplay'] ?? ''));
                if (!$cId || $cText === '') {
                    continue;
                }

                $cPub = !empty($cSnippet['publishedAt'])
                    ? Carbon::parse($cSnippet['publishedAt'])->setTimezone('Asia/Jakarta')
                    : Carbon::now('Asia/Jakarta');

                $records[] = [
                    'provider' => 'youtube',
                    'external_id' => 'yt_comment_' . $cId,
                    'source_url' => $videoUrl,
                    'author_name' => $cSnippet['authorDisplayName'] ?? 'Netizen YouTube',
                    'published_at' => $cPub,
                    'collected_at' => Carbon::now('Asia/Jakarta'),
                    'text' => $cText,
                    'text_normalized' => Str::lower($cText),
                    'language' => 'id',
                    'deletion_status' => 'active',
                    'is_demo' => false,
                    'metadata_json' => [
                        'is_comment' => true,
                        'parent_external_id' => $parentExternalId,
                        'video_id' => $videoId,
                        'likes' => (int) ($cSnippet['likeCount'] ?? 0),
                        'metrics_available' => true,
                        'link_status' => SocialLinkValidator::STATUS_VERIFIED_POST,
                        'source' => 'youtube_data_api_v3',
                    ],
                    'matched_keywords' => $this->matchKeywordsInText($includeKeywords, $cText),
                ];
            }

            return $records;
        } catch (Throwable) {
            return [];
        }
    }
}
