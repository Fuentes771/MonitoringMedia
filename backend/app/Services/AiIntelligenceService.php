<?php

namespace App\Services;

use App\Models\Topic;
use App\Models\Mention;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class AiIntelligenceService
{
    protected string $nlpUrl;

    public function __construct()
    {
        $this->nlpUrl = rtrim(env('NLP_SERVICE_URL', 'http://127.0.0.1:8001'), '/');
    }

    /**
     * Check 9Router and NLP service connection status.
     * @return array<string, mixed>
     */
    public function getGatewayStatus(): array
    {
        $fetcher = function (): array {
            try {
                $response = Http::connectTimeout(1)->timeout(2)->get("{$this->nlpUrl}/ai/health");
                if ($response->successful()) {
                    return $response->json();
                }
                return [
                    'status' => 'degraded',
                    'http_status' => $response->status(),
                    'service' => 'pulsescope-ai-gateway',
                    '9router' => ['status' => 'unreachable'],
                ];
            } catch (Throwable $e) {
                return [
                    'status' => 'offline',
                    'error' => $e->getMessage(),
                    'service' => 'pulsescope-ai-gateway',
                    '9router' => ['status' => 'offline'],
                ];
            }
        };

        if (app()->runningUnitTests()) {
            return $fetcher();
        }

        return Cache::remember('ai_gateway_status_v1', 30, $fetcher);
    }

    /**
     * Context-bounded RAG chat strictly grounded in PulseScope database mentions.
     *
     * @param string $query
     * @param int|null $topicId
     * @param array $conversationHistory
     * @param int $workspaceId
     * @return array<string, mixed>
     */
    public function chat(
        string $query,
        ?int $topicId = null,
        array $conversationHistory = [],
        int $workspaceId = 1
    ): array {
        $topicName = null;
        $now = \Carbon\Carbon::now('Asia/Jakarta');
        $sevenDaysAgo = $now->copy()->subDays(7);

        // Strict 7-day cutoff to guarantee freshness and prevent stale news contamination
        $mentionsQuery = Mention::where('workspace_id', $workspaceId)
            ->where('published_at', '>=', $sevenDaysAgo)
            ->with(['sentiment', 'topics:id,name'])
            ->orderBy('published_at', 'desc');

        $resolvedTopicId = $topicId;
        if ($topicId) {
            $topic = Topic::find($topicId);
            if ($topic) {
                $topicName = $topic->name;
                $mentionsQuery->whereHas('topics', fn($q) => $q->where('topics.id', $topicId));
            }
        } else {
            // Auto-detect monitored topic via name, parenthetical acronym (e.g., MBG), or include keywords
            $activeTopics = Topic::where('workspace_id', $workspaceId)
                ->where('status', 'active')
                ->with('keywords')
                ->get();

            $matchedTopic = $this->matchTopicFromQuery($activeTopics, Str::lower($query));
            if ($matchedTopic) {
                $topicName = $matchedTopic->name;
                $resolvedTopicId = $matchedTopic->id;
                $mentionsQuery->whereHas('topics', fn($q) => $q->where('topics.id', $matchedTopic->id));
            }
        }

        // Apply keyword / semantic search filter if query has search terms
        $searchTerms = $this->extractQueryKeywords($query);
        if (!empty($searchTerms)) {
            $mentionsQuery->where(function ($q) use ($searchTerms) {
                foreach ($searchTerms as $term) {
                    $lowerTerm = '%' . Str::lower($term) . '%';
                    $q->orWhereRaw('LOWER(text) LIKE ?', [$lowerTerm]);
                }
            });
        }

        // Fetch up to 60 candidates, then rank by keyword density, organic authenticity, link provenance, and recency
        $candidates = $mentionsQuery->limit(60)->get();

        // If no keyword-specific mentions were found, fallback to recent mentions for the resolved topic (within 7 days)
        if ($candidates->isEmpty() && $resolvedTopicId) {
            $candidates = Mention::where('workspace_id', $workspaceId)
                ->where('published_at', '>=', $sevenDaysAgo)
                ->whereHas('topics', fn($q) => $q->where('topics.id', $resolvedTopicId))
                ->with(['sentiment', 'topics:id,name'])
                ->orderBy('published_at', 'desc')
                ->limit(60)
                ->get();
        }

        $mentions = $this->rankMentionsForRag($candidates, $searchTerms, $now)->take(20);

        // Format context mentions for the NLP service
        $contextMentions = [];
        foreach ($mentions as $m) {
            $contextMentions[] = [
                'id' => $m->id,
                'author_name' => $m->author_name ?? ucfirst($m->provider),
                'provider' => $m->provider,
                'source_url' => $m->source_url,
                'published_at' => $m->published_at ? $m->published_at->format('Y-m-d H:i') : null,
                'sentiment' => $m->sentiment?->label ?? 'neutral',
                'confidence' => $m->sentiment?->confidence ?? 0.5,
                'text' => $m->text,
                'topic' => $m->topics->pluck('name')->join(', '),
            ];
        }

        // Send to FastAPI /ai/chat
        try {
            $response = Http::timeout(30)->post("{$this->nlpUrl}/ai/chat", [
                'query' => $query,
                'context_mentions' => $contextMentions,
                'topic_name' => $topicName,
                'conversation_history' => $conversationHistory,
            ]);

            if ($response->successful()) {
                $data = $response->json();
                $data['topic_filtered'] = $topicName;
                return $data;
            }

            Log::warning("AI chat service returned status: {$response->status()} - {$response->body()}");
        } catch (Throwable $e) {
            Log::error("Failed to connect to AI chat service: {$e->getMessage()}");
        }

        // Fallback response if NLP service unreachable
        return [
            'answer' => 'Layanan pemrosesan AI sedang tidak tersedia saat ini. Silakan coba beberapa saat lagi.',
            'citations' => [],
            'mentions_count' => count($contextMentions),
            'grounded' => false,
            'engine' => 'error-fallback',
        ];
    }

    /**
     * Get or generate Executive Intelligence Briefing for a national priority topic.
     *
     * @param int $topicId
     * @param bool $forceRefresh
     * @return array<string, mixed>
     */
    public function getTopicSummary(int $topicId, bool $forceRefresh = false): array
    {
        $cacheKey = "ai_topic_summary_{$topicId}";

        if (!$forceRefresh && Cache::has($cacheKey)) {
            return Cache::get($cacheKey);
        }

        $topic = Topic::findOrFail($topicId);

        $mentions = Mention::whereHas('topics', fn($q) => $q->where('topics.id', $topicId))
            ->with('sentiment')
            ->orderBy('published_at', 'desc')
            ->limit(25)
            ->get();

        if ($mentions->isEmpty()) {
            return [
                'topic_name' => $topic->name,
                'mentions_analyzed' => 0,
                'executive_overview' => "Belum ada sebutan berita publik yang tersimpan untuk topik '{$topic->name}'. Silakan lakukan sinkronisasi data melalui tombol Sync atau 'php artisan trinetra:sync-programs'.",
                'dominant_sentiment' => 'neutral',
                'key_positive_themes' => [],
                'key_critical_themes' => [],
                'strategic_recommendations' => ['Jalankan sinkronisasi berita dari Google News RSS untuk topik ini.'],
                'cached_at' => now()->toIso8601String(),
                'engine' => 'no-data',
            ];
        }

        $formattedMentions = [];
        foreach ($mentions as $m) {
            $formattedMentions[] = [
                'id' => $m->id,
                'text' => $m->text,
                'author_name' => $m->author_name ?? ucfirst($m->provider),
                'published_at' => $m->published_at ? $m->published_at->format('Y-m-d') : null,
                'sentiment' => $m->sentiment?->label ?? 'neutral',
            ];
        }

        try {
            $response = Http::timeout(30)->post("{$this->nlpUrl}/ai/summarize-topic", [
                'topic_name' => $topic->name,
                'mentions' => $formattedMentions,
            ]);

            if ($response->successful()) {
                $summary = $response->json();
                $summary['cached_at'] = now()->toIso8601String();
                // Cache for 30 minutes
                Cache::put($cacheKey, $summary, 1800);
                return $summary;
            }
        } catch (Throwable $e) {
            Log::error("Failed to generate topic summary: {$e->getMessage()}");
        }

        return [
            'topic_name' => $topic->name,
            'mentions_analyzed' => $mentions->count(),
            'executive_overview' => "Gagal menghasilkan ringkasan AI. Menampilkan statistik dasar: {$mentions->count()} sebutan tersimpan.",
            'dominant_sentiment' => 'neutral',
            'key_positive_themes' => [],
            'key_critical_themes' => [],
            'strategic_recommendations' => ['Periksa koneksi 9Router di port 20128.'],
            'cached_at' => now()->toIso8601String(),
            'engine' => 'fallback',
        ];
    }

    /**
     * Generate an AI Executive Summary for the 33-hour daily monitoring window.
     *
     * @param int $workspaceId
     * @param \Carbon\Carbon $start
     * @param \Carbon\Carbon $end
     * @return string
     */
    public function getDailyExecutiveSummary(int $workspaceId, \Carbon\Carbon $start, \Carbon\Carbon $end): string
    {
        $hourBucket = (int) floor(((int) $end->format('H')) / 2);
        $dateKey = $end->format('Ymd') . '_b' . $hourBucket;
        $cacheKey = "daily_briefing_ai_{$workspaceId}_{$dateKey}";
        $lastGoodKey = "daily_briefing_ai_last_{$workspaceId}";

        $cached = Cache::get($cacheKey);
        if (is_string($cached) && $cached !== '') {
            return $cached;
        }

        $mentions = Mention::where('workspace_id', $workspaceId)
            ->whereBetween('published_at', [$start, $end])
            ->with(['sentiment', 'topics:id,name'])
            ->orderBy('published_at', 'desc')
            ->limit(20)
            ->get();

        if ($mentions->isEmpty()) {
            $emptyMsg = "Dalam kurun waktu monitoring 33 jam terakhir, belum ada pergerakan isu signifikan atau anomali baru yang terdeteksi pada 17 Program Prioritas Nasional.";
            Cache::put($cacheKey, $emptyMsg, 300);
            return $emptyMsg;
        }

        $total = $mentions->count();
        $pos = $mentions->filter(fn($m) => $m->sentiment?->label === 'positive')->count();
        $neg = $mentions->filter(fn($m) => $m->sentiment?->label === 'negative')->count();
        $factualFallback = "Dalam kurun waktu 33 jam terakhir tercatat {$total} perkembangan peristiwa di lapangan, dengan kecenderungan persepsi {$pos} positif dan {$neg} catatan kritis publik.";

        // Prevent concurrent request stampedes from blocking multiple PHP workers on LLM generation
        $lockKey = "daily_briefing_ai_lock_{$workspaceId}";
        if (!Cache::add($lockKey, 1, 15)) {
            $stale = Cache::get($lastGoodKey);
            return (is_string($stale) && $stale !== '') ? $stale : $factualFallback;
        }

        $contextMentions = [];
        foreach ($mentions as $m) {
            $contextMentions[] = [
                'author_name' => $m->author_name ?? ucfirst($m->provider),
                'text' => $m->text,
                'published_at' => $m->published_at ? $m->published_at->format('Y-m-d H:i') : null,
                'sentiment' => $m->sentiment?->label ?? 'neutral',
                'topic' => $m->topics->pluck('name')->join(', '),
            ];
        }

        try {
            // Keep HTTP dashboard latency bounded (fail fast if NLP/LLM is slow)
            $response = Http::connectTimeout(2)->timeout(5)->post("{$this->nlpUrl}/ai/daily-summary", [
                'mentions' => $contextMentions,
                'window_label' => "Periode " . $start->format('d M H:i') . " s/d " . $end->format('d M H:i') . " WIB",
            ]);

            if ($response->successful()) {
                $resData = $response->json();
                if (!empty($resData['summary'])) {
                    $summaryText = trim($resData['summary']);
                    Cache::put($cacheKey, $summaryText, 7200);
                    Cache::put($lastGoodKey, $summaryText, 43200);
                    return $summaryText;
                }
            }
        } catch (Throwable $e) {
            Log::warning("Failed to generate AI daily executive summary: {$e->getMessage()}");
        } finally {
            Cache::forget($lockKey);
        }

        // Cache fallback briefly (120s) so subsequent dashboard loads do not keep timing out on NLP
        $stale = Cache::get($lastGoodKey);
        $fallback = (is_string($stale) && $stale !== '') ? $stale : $factualFallback;
        Cache::put($cacheKey, $fallback, 120);

        return $fallback;
    }

    /**
     * Generate query expansion for a monitored program.
     *
     * @param string $programName
     * @return array<string, mixed>
     */
    public function generateQueriesForProgram(string $programName): array
    {
        try {
            $response = Http::timeout(6)->post("{$this->nlpUrl}/ai/search-queries", [
                'program_name' => $programName,
            ]);

            if ($response->successful()) {
                return $response->json();
            }
        } catch (Throwable $e) {
            Log::warning("Search queries generation failed: {$e->getMessage()}");
        }

        return [
            'program_name' => $programName,
            'google_news_queries' => [$programName],
            'social_media_keywords' => [Str::lower($programName)],
            'exclude_keywords' => ['lowongan', 'loker'],
            'engine' => 'local-fallback',
        ];
    }

    /**
     * Match a user query against active workspace topics by full name, base name, parenthetical acronym, or keywords.
     *
     * @param \Illuminate\Support\Collection<int, Topic> $activeTopics
     */
    protected function matchTopicFromQuery($activeTopics, string $lowerQuery): ?Topic
    {
        foreach ($activeTopics as $topic) {
            $fullName = Str::lower(trim($topic->name));
            $baseName = trim((string) preg_replace('/\s*\([^)]*\)/', '', $fullName));
            if ($fullName !== '' && str_contains($lowerQuery, $fullName)) {
                return $topic;
            }
            if ($baseName !== '' && strlen($baseName) >= 4 && str_contains($lowerQuery, $baseName)) {
                return $topic;
            }
        }

        foreach ($activeTopics as $topic) {
            if (preg_match_all('/\(([^)]+)\)/', Str::lower($topic->name), $matches)) {
                foreach ($matches[1] as $acronym) {
                    $acronym = trim($acronym);
                    if (strlen($acronym) >= 3 && preg_match('/\b' . preg_quote($acronym, '/') . '\b/u', $lowerQuery)) {
                        return $topic;
                    }
                }
            }
        }

        foreach ($activeTopics as $topic) {
            foreach ($topic->keywords->where('type', 'include') as $kw) {
                $kwLower = Str::lower(trim($kw->keyword));
                if (strlen($kwLower) >= 4 && str_contains($lowerQuery, $kwLower)) {
                    return $topic;
                }
            }
        }

        return null;
    }

    /**
     * Score and rank candidate mentions for RAG context grounding.
     *
     * @param \Illuminate\Support\Collection<int, Mention> $candidates
     * @param array<int, string> $searchTerms
     */
    protected function rankMentionsForRag($candidates, array $searchTerms, \Carbon\Carbon $now)
    {
        return $candidates->sortByDesc(function (Mention $m) use ($searchTerms, $now) {
            $lowerText = Str::lower($m->text ?? '');
            $kwScore = 0.0;
            foreach ($searchTerms as $term) {
                if (str_contains($lowerText, Str::lower($term))) {
                    $kwScore += 3.0;
                }
            }

            $organicScore = $m->is_inauthentic ? -2.5 : 2.0;

            $linkStatus = $m->metadata_json['link_status'] ?? '';
            $linkScore = in_array($linkStatus, ['verified_post', 'verified_article'], true) ? 1.5 : 0.0;

            $hoursAge = $m->published_at
                ? max(0.0, ($now->timestamp - $m->published_at->timestamp) / 3600.0)
                : 168.0;
            $recencyScore = max(0.0, 1.5 - ($hoursAge / 112.0));

            return $kwScore + $organicScore + $linkScore + $recencyScore;
        })->values();
    }

    /**
     * Helper to extract key informative terms from user query.
     *
     * @param string $query
     * @return array<string>
     */
    protected function extractQueryKeywords(string $query): array
    {
        $stopwords = ['bagaimana', 'apa', 'saja', 'yang', 'di', 'ke', 'dari', 'pada', 'untuk', 'dengan', 'adalah', 'ini', 'itu', 'apakah', 'siapa', 'mengapa', 'kenapa', 'tentang', 'terkait', 'program', 'banyak', 'dan', 'atau'];
        $words = preg_split('/\s+/', Str::lower(trim($query)));
        $filtered = [];

        foreach ($words as $w) {
            $cleaned = preg_replace('/[^a-z0-9_-]/', '', $w);
            if (strlen($cleaned) >= 3 && !in_array($cleaned, $stopwords)) {
                $filtered[] = $cleaned;
            }
        }

        return array_slice($filtered, 0, 5);
    }
}
