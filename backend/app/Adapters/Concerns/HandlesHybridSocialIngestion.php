<?php

namespace App\Adapters\Concerns;

use App\Models\Topic;
use App\Services\SocialLinkValidator;
use Carbon\Carbon;
use Illuminate\Support\Str;

trait HandlesHybridSocialIngestion
{
    /**
     * Extract search query string and include keywords for a topic.
     *
     * @return array{query: string, include_keywords: array<int, string>}
     */
    protected function extractTopicQuery(Topic $topic, int $keywordSlice = 2): array
    {
        $includeKeywords = $topic->keywords()
            ->where('type', 'include')
            ->pluck('keyword')
            ->filter(fn ($k) => is_string($k) && trim($k) !== '')
            ->values()
            ->toArray();

        if (empty($includeKeywords)) {
            $includeKeywords = [$topic->name];
        }

        $query = implode(' ', array_slice($includeKeywords, 0, $keywordSlice));

        return [
            'query' => $query,
            'include_keywords' => $includeKeywords,
        ];
    }

    /**
     * Match include keywords against ingested text for accurate pivot telemetry.
     *
     * @param array<int, string> $includeKeywords
     * @return array<int, string>
     */
    protected function matchKeywordsInText(array $includeKeywords, string $text): array
    {
        $lower = Str::lower($text);
        $matched = [];

        foreach ($includeKeywords as $kw) {
            $needle = Str::lower(trim($kw));
            if ($needle !== '' && str_contains($lower, $needle)) {
                $matched[] = $kw;
            }
        }

        if (empty($matched)) {
            return array_slice($includeKeywords, 0, 2);
        }

        return array_values(array_unique($matched));
    }

    /**
     * Convert raw items from LocalScraperService into validated, ingestion-ready mention records.
     *
     * @param array<int, array<string, mixed>> $localItems
     * @param array<int, string> $includeKeywords
     * @return array<int, array<string, mixed>>
     */
    protected function mapLocalItemsToRecords(
        string $provider,
        array $localItems,
        array $includeKeywords,
        string $query
    ): array {
        $validator = app(SocialLinkValidator::class);
        $records = [];

        foreach ($localItems as $item) {
            $text = trim((string) ($item['text'] ?? ''));
            if ($text === '') {
                continue;
            }

            $isDemo = (bool) ($item['is_demo'] ?? false);
            $declaredStatus = $item['link_status'] ?? null;
            $checked = $validator->validateAndNormalize(
                provider: $provider,
                rawUrl: $item['source_url'] ?? null,
                queryHint: $query,
                isDemo: $isDemo,
                declaredStatus: $declaredStatus
            );

            if ($checked['link_status'] === SocialLinkValidator::STATUS_BROKEN_LEGACY) {
                continue;
            }

            $publishedAt = Carbon::now('Asia/Jakarta');
            if (!empty($item['published_at'])) {
                try {
                    $publishedAt = Carbon::parse($item['published_at'])->setTimezone('Asia/Jakarta');
                } catch (\Throwable) {
                    // Keep ingestion clock fallback when source timestamp cannot be parsed
                }
            }

            $metrics = is_array($item['metrics'] ?? null) ? $item['metrics'] : null;
            $metricsAvailable = (bool) ($item['metrics_available'] ?? ($metrics !== null && count($metrics) > 0));

            $records[] = [
                'provider' => $provider,
                'external_id' => $item['id'] ?? ($provider . '_' . sha1($checked['url'] ?? $text)),
                'source_url' => $checked['url'],
                'author_name' => $item['author_name'] ?? ucfirst($provider),
                'published_at' => $publishedAt,
                'collected_at' => Carbon::now('Asia/Jakarta'),
                'text' => $text,
                'text_normalized' => Str::lower($text),
                'language' => 'id',
                'deletion_status' => 'active',
                'is_demo' => $isDemo,
                'metadata_json' => [
                    'is_comment' => (bool) ($item['is_comment'] ?? false),
                    'parent_external_id' => $item['parent_external_id'] ?? null,
                    'metrics' => $metrics ?? [],
                    'metrics_available' => $metricsAvailable,
                    'link_status' => $checked['link_status'],
                    'link_reason' => $checked['reason'],
                    'original_discovered_url' => $item['original_discovered_url'] ?? null,
                    'source' => $item['source'] ?? 'local_scraper',
                ],
                'matched_keywords' => $this->matchKeywordsInText($includeKeywords, $text),
            ];
        }

        return $records;
    }
}

