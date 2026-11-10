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

        // Split keywords into chunks of 2-3 to maximize coverage from Google News RSS
        $keywordChunks = array_chunk($includeKeywords, 3);
        $records = [];
        $seenExternalIds = [];

        foreach ($keywordChunks as $chunk) {
            $query = implode(' OR ', array_map(fn($k) => '"' . trim($k) . '"', $chunk));
            $feedUrl = 'https://news.google.com/rss/search?q=' . urlencode($query) . '&hl=id&gl=ID&ceid=ID:id';

            try {
                $response = Http::timeout(10)
                    ->withHeaders([
                        'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PulseScope/1.0 NewsIngestionBot',
                    ])
                    ->get($feedUrl);

                if (!$response->successful()) {
                    continue;
                }

                $xmlString = $response->body();
                // Prevent XXE
                $prevEntityLoader = libxml_disable_entity_loader(true);
                $xml = simplexml_load_string($xmlString, 'SimpleXMLElement', LIBXML_NOCDATA);
                libxml_disable_entity_loader($prevEntityLoader);

                if ($xml === false || !isset($xml->channel->item)) {
                    continue;
                }

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
                        $matchedKeywords = [$chunk[0]];
                    }

                    $publishedAt = $pubDateStr ? Carbon::parse($pubDateStr)->setTimezone('Asia/Jakarta') : Carbon::now('Asia/Jakarta');

                    // Strict 30-day retention cutoff: ignore older articles
                    if ($publishedAt->lt(Carbon::now('Asia/Jakarta')->subDays(30))) {
                        continue;
                    }

                    $externalId = hash('sha256', 'rss_' . ($guid ?: $link));

                    // Avoid duplicates within this ingestion run
                    if (isset($seenExternalIds[$externalId])) {
                        continue;
                    }
                    $seenExternalIds[$externalId] = true;

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
            } catch (Throwable $e) {
                // If one chunk fails, continue to next chunk
                continue;
            }
        }

        return new IngestionResult(
            records: $records,
            counts: ['collected' => count($records), 'new' => 0, 'duplicates' => 0]
        );
    }
}
