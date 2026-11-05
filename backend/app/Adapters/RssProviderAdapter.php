<?php

namespace App\Adapters;

use App\Models\Topic;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Carbon\Carbon;
use Throwable;

class RssProviderAdapter implements ProviderAdapterInterface
{
    public function getProviderKey(): string
    {
        return 'rss';
    }

    public function getCapabilities(): array
    {
        return [
            'keyword_search' => true,
            'public_content' => true,
            'comments' => false,
            'public_metrics' => false,
            'historical_backfill' => 'limited',
            'streaming' => false,
        ];
    }

    public function fetch(Topic $topic, ?string $cursor = null): IngestionResult
    {
        // 1. Extract include and exclude keywords
        $includeKeywords = $topic->keywords()
            ->where('type', 'include')
            ->pluck('keyword')
            ->toArray();

        $excludeKeywords = $topic->keywords()
            ->where('type', 'exclude')
            ->pluck('keyword')
            ->map(fn($k) => Str::lower($k))
            ->toArray();

        if (empty($includeKeywords)) {
            $includeKeywords = [$topic->name];
        }

        // Build search query for Google News RSS (Indonesia)
        $query = implode(' OR ', array_map(fn($k) => '"' . trim($k) . '"', array_slice($includeKeywords, 0, 5)));
        $feedUrl = 'https://news.google.com/rss/search?q=' . urlencode($query) . '&hl=id&gl=ID&ceid=ID:id';

        try {
            $response = Http::timeout(12)
                ->withHeaders([
                    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PulseScope/1.0 NewsIngestionBot',
                ])
                ->get($feedUrl);

            if (!$response->successful()) {
                return new IngestionResult(
                    errorCode: 'HTTP_ERROR_' . $response->status(),
                    errorMessage: 'Failed to fetch RSS feed from source. Status: ' . $response->status()
                );
            }

            $xmlString = $response->body();
            // Prevent XXE
            $prevEntityLoader = libxml_disable_entity_loader(true);
            $xml = simplexml_load_string($xmlString, 'SimpleXMLElement', LIBXML_NOCDATA);
            libxml_disable_entity_loader($prevEntityLoader);

            if ($xml === false || !isset($xml->channel->item)) {
                return new IngestionResult(records: []);
            }

            $records = [];
            foreach ($xml->channel->item as $item) {
                $title = trim((string)$item->title);
                $link = trim((string)$item->link);
                $guid = trim((string)$item->guid);
                $pubDateStr = trim((string)$item->pubDate);
                $description = strip_tags(html_entity_decode((string)$item->description));

                $fullText = $title . ($description ? '. ' . $description : '');
                $lowerText = Str::lower($fullText);

                // Exclude keyword filter check
                $hasExcluded = false;
                foreach ($excludeKeywords as $ex) {
                    if (str_contains($lowerText, $ex)) {
                        $hasExcluded = true;
                        break;
                    }
                }
                if ($hasExcluded) {
                    continue;
                }

                // Check matched keywords
                $matchedKeywords = [];
                foreach ($includeKeywords as $inc) {
                    if (str_contains($lowerText, Str::lower($inc))) {
                        $matchedKeywords[] = $inc;
                    }
                }
                if (empty($matchedKeywords)) {
                    // Still record if query produced it
                    $matchedKeywords = [reset($includeKeywords)];
                }

                $publishedAt = $pubDateStr ? Carbon::parse($pubDateStr)->setTimezone('Asia/Jakarta') : Carbon::now('Asia/Jakarta');
                $externalId = hash('sha256', 'rss_' . ($guid ?: $link));

                $sourceName = 'Media Berita';
                if (isset($item->source)) {
                    $sourceName = (string)$item->source;
                } elseif (preg_match('/ - ([^-]+)$/', $title, $matches)) {
                    $sourceName = trim($matches[1]);
                }

                $records[] = [
                    'provider' => 'rss',
                    'external_id' => $externalId,
                    'source_url' => $link,
                    'author_name' => $sourceName,
                    'published_at' => $publishedAt,
                    'collected_at' => Carbon::now('Asia/Jakarta'),
                    'text' => $fullText,
                    'text_normalized' => Str::lower($fullText),
                    'language' => 'id',
                    'deletion_status' => 'active',
                    'is_demo' => false,
                    'metadata_json' => [
                        'feed' => 'google_news_id',
                        'raw_title' => $title,
                    ],
                    'matched_keywords' => $matchedKeywords,
                ];
            }

            return new IngestionResult(
                records: $records,
                counts: ['collected' => count($records), 'new' => 0, 'duplicates' => 0]
            );

        } catch (Throwable $e) {
            return new IngestionResult(
                errorCode: 'FEED_PARSE_EXCEPTION',
                errorMessage: $e->getMessage()
            );
        }
    }
}
