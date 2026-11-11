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
        try {
            $response = Http::timeout(4)->get("{$this->nlpUrl}/ai/health");
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
        $sevenDaysAgo = \Carbon\Carbon::now('Asia/Jakarta')->subDays(7);

        // Strict 7-day cutoff to guarantee freshness and prevent stale news contamination
        $mentionsQuery = Mention::where('workspace_id', $workspaceId)
            ->where('published_at', '>=', $sevenDaysAgo)
            ->with(['sentiment', 'topics:id,name'])
            ->orderBy('published_at', 'desc');

        if ($topicId) {
            $topic = Topic::find($topicId);
            if ($topic) {
                $topicName = $topic->name;
                $mentionsQuery->whereHas('topics', fn($q) => $q->where('topics.id', $topicId));
            }
        } else {
            // Check if any of the 17 programs is mentioned in the query
            $matchedTopic = Topic::where('status', 'active')
                ->where(function ($q) use ($query) {
                    $lowerQuery = Str::lower($query);
                    $q->whereRaw('LOWER(name) LIKE ?', ["%{$lowerQuery}%"]);
                })
                ->first();

            if ($matchedTopic) {
                $topicName = $matchedTopic->name;
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

        // Fetch top 20 relevant mentions
        $mentions = $mentionsQuery->limit(20)->get();

        // If no keyword-specific mentions were found, fallback to recent mentions for the topic (within 7 days)
        if ($mentions->isEmpty() && $topicId) {
            $mentions = Mention::where('workspace_id', $workspaceId)
                ->where('published_at', '>=', $sevenDaysAgo)
                ->whereHas('topics', fn($q) => $q->where('topics.id', $topicId))
                ->with(['sentiment', 'topics:id,name'])
                ->orderBy('published_at', 'desc')
                ->limit(15)
                ->get();
        }

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
        $dateKey = $end->format('Ymd_H');
        $cacheKey = "daily_briefing_ai_{$workspaceId}_{$dateKey}";

        return Cache::remember($cacheKey, 1800, function () use ($workspaceId, $start, $end) {
            $mentions = Mention::where('workspace_id', $workspaceId)
                ->whereBetween('published_at', [$start, $end])
                ->with(['sentiment', 'topics:id,name'])
                ->orderBy('published_at', 'desc')
                ->limit(20)
                ->get();

            if ($mentions->isEmpty()) {
                return "Dalam kurun waktu monitoring 33 jam terakhir, belum ada pergerakan isu signifikan atau anomali baru yang terdeteksi pada 17 Program Prioritas Nasional.";
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
                $response = Http::timeout(20)->post("{$this->nlpUrl}/ai/daily-summary", [
                    'mentions' => $contextMentions,
                    'window_label' => "Periode " . $start->format('d M H:i') . " s/d " . $end->format('d M H:i') . " WIB",
                ]);

                if ($response->successful()) {
                    $resData = $response->json();
                    if (!empty($resData['summary'])) {
                        return trim($resData['summary']);
                    }
                }
            } catch (Throwable $e) {
                Log::warning("Failed to generate AI daily executive summary: {$e->getMessage()}");
            }

            // Factual fallback
            $total = $mentions->count();
            $pos = $mentions->filter(fn($m) => $m->sentiment?->label === 'positive')->count();
            $neg = $mentions->filter(fn($m) => $m->sentiment?->label === 'negative')->count();
            return "Dalam kurun waktu 33 jam terakhir tercatat {$total} perkembangan peristiwa di lapangan, dengan kecenderungan persepsi {$pos} positif dan {$neg} catatan kritis publik.";
        });
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
