<?php

namespace App\Adapters;

use App\Models\Topic;
use App\Models\Connector;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Carbon\Carbon;
use Throwable;

class YouTubeProviderAdapter implements ProviderAdapterInterface
{
    public function getProviderKey(): string
    {
        return 'youtube';
    }

    public function getCapabilities(): array
    {
        return [
            'keyword_search' => true,
            'public_content' => true,
            'comments' => false,
            'public_metrics' => true,
            'historical_backfill' => 'limited',
            'streaming' => false,
        ];
    }

    public function fetch(Topic $topic, ?string $cursor = null): IngestionResult
    {
        // 1. Resolve API Key from Connector credentials or environment
        $connector = Connector::where('workspace_id', $topic->workspace_id)
            ->where('provider', 'youtube')
            ->first();

        $apiKey = env('YOUTUBE_API_KEY');
        if ($connector && $connector->credential) {
            $payload = $connector->credential->encrypted_payload;
            if (is_array($payload) && !empty($payload['api_key'])) {
                $apiKey = $payload['api_key'];
            } elseif (is_string($payload) && !empty($payload)) {
                $apiKey = $payload;
            }
        }

        if (empty($apiKey)) {
            return new IngestionResult(
                errorCode: 'NEEDS_CONFIGURATION',
                errorMessage: 'YouTube Data API v3 Key belum dikonfigurasi. Masukkan API Key pada halaman Data Sources atau .env.'
            );
        }

        // 2. Extract include keywords
        $includeKeywords = $topic->keywords()
            ->where('type', 'include')
            ->pluck('keyword')
            ->toArray();

        if (empty($includeKeywords)) {
            $includeKeywords = [$topic->name];
        }

        $query = implode(' ', array_slice($includeKeywords, 0, 3));

        $params = [
            'part' => 'snippet',
            'q' => $query,
            'type' => 'video',
            'maxResults' => 15,
            'relevanceLanguage' => 'id',
            'key' => $apiKey,
        ];
        if ($cursor) {
            $params['pageToken'] = $cursor;
        }

        try {
            $response = Http::timeout(10)->get('https://www.googleapis.com/youtube/v3/search', $params);

            if ($response->status() === 403) {
                return new IngestionResult(
                    errorCode: 'QUOTA_EXCEEDED',
                    errorMessage: 'YouTube Data API v3 quota exceeded or access forbidden.'
                );
            }

            if (!$response->successful()) {
                return new IngestionResult(
                    errorCode: 'YOUTUBE_API_ERROR_' . $response->status(),
                    errorMessage: 'YouTube API error: ' . $response->body()
                );
            }

            $data = $response->json();
            $items = $data['items'] ?? [];
            $nextPageToken = $data['nextPageToken'] ?? null;

            $records = [];
            foreach ($items as $item) {
                $videoId = $item['id']['videoId'] ?? null;
                if (!$videoId) {
                    continue;
                }

                $snippet = $item['snippet'] ?? [];
                $title = $snippet['title'] ?? '';
                $description = $snippet['description'] ?? '';
                $channelTitle = $snippet['channelTitle'] ?? 'YouTube Creator';
                $publishedAtStr = $snippet['publishedAt'] ?? null;

                $fullText = $title . ($description ? '. ' . $description : '');
                $publishedAt = $publishedAtStr ? Carbon::parse($publishedAtStr)->setTimezone('Asia/Jakarta') : Carbon::now('Asia/Jakarta');

                $records[] = [
                    'provider' => 'youtube',
                    'external_id' => 'yt_' . $videoId,
                    'source_url' => 'https://www.youtube.com/watch?v=' . $videoId,
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
                        'thumbnails' => $snippet['thumbnails'] ?? null,
                    ],
                    'matched_keywords' => array_slice($includeKeywords, 0, 2),
                ];
            }

            return new IngestionResult(
                records: $records,
                nextCursor: $nextPageToken,
                counts: ['collected' => count($records), 'new' => 0, 'duplicates' => 0]
            );

        } catch (Throwable $e) {
            return new IngestionResult(
                errorCode: 'YOUTUBE_NETWORK_ERROR',
                errorMessage: $e->getMessage()
            );
        }
    }
}

