<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\V1\Concerns\ResolvesAuthorizedWorkspace;
use App\Http\Controllers\Controller;
use App\Models\Topic;
use App\Models\TopicKeyword;
use App\Services\IngestionService;
use App\Services\TrendService;
use App\Services\AlertService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class TopicController extends Controller
{
    use ResolvesAuthorizedWorkspace;

    private static function forgetWorkspaceTopicCaches(int $workspaceId): void
    {
        foreach (['active', 'manage', 'all', 'paused', 'archived'] as $st) {
            Cache::forget("topics_index_v2:{$workspaceId}:{$st}");
        }
        Cache::forget("trends_index_v2:{$workspaceId}");
        Cache::increment("ws_data_ver:{$workspaceId}");
    }

    public function index(Request $request, $workspaceId)
    {
        $workspaceId = $this->resolveAuthorizedWorkspaceId($request, $workspaceId);
        $status = (string) $request->input('status', 'active');
        $cacheKey = "topics_index_v2:{$workspaceId}:{$status}";

        if (!app()->runningUnitTests() && !$request->boolean('refresh')) {
            $cached = Cache::get($cacheKey);
            if ($cached !== null) {
                return response()->json($cached);
            }
        }

        $query = Topic::where('workspace_id', $workspaceId)
            ->with(['keywords', 'trendSnapshots' => fn($q) => $q->latest()->limit(1)]);

        if ($status === 'manage') {
            $query->whereIn('status', ['active', 'paused']);
        } elseif ($status !== 'all') {
            $query->where('status', $status);
        }

        $topics = $query->orderBy('id', 'asc')->get();

        // Single aggregated query replaces 4 correlated whereHas subqueries per topic
        if ($topics->isNotEmpty()) {
            $topicIds = $topics->pluck('id')->all();
            $stats = DB::table('mention_topic_matches')
                ->leftJoin('sentiment_results', 'mention_topic_matches.mention_id', '=', 'sentiment_results.mention_id')
                ->whereIn('mention_topic_matches.topic_id', $topicIds)
                ->select(
                    'mention_topic_matches.topic_id',
                    DB::raw('COUNT(*) as mentions_count'),
                    DB::raw("SUM(CASE WHEN sentiment_results.label = 'positive' THEN 1 ELSE 0 END) as positive_count"),
                    DB::raw("SUM(CASE WHEN sentiment_results.label = 'neutral' THEN 1 ELSE 0 END) as neutral_count"),
                    DB::raw("SUM(CASE WHEN sentiment_results.label = 'negative' THEN 1 ELSE 0 END) as negative_count")
                )
                ->groupBy('mention_topic_matches.topic_id')
                ->get()
                ->keyBy('topic_id');

            foreach ($topics as $topic) {
                $row = $stats->get($topic->id);
                $topic->setAttribute('mentions_count', $row ? (int) $row->mentions_count : 0);
                $topic->setAttribute('positive_count', $row ? (int) $row->positive_count : 0);
                $topic->setAttribute('neutral_count', $row ? (int) $row->neutral_count : 0);
                $topic->setAttribute('negative_count', $row ? (int) $row->negative_count : 0);
            }

            $topics = $topics->sort(function ($a, $b) {
                if ((int) $b->mentions_count !== (int) $a->mentions_count) {
                    return (int) $b->mentions_count <=> (int) $a->mentions_count;
                }
                return (int) $a->id <=> (int) $b->id;
            })->values();
        }

        $payload = [
            'status' => 'success',
            'data' => $topics->toArray(),
        ];

        if (!app()->runningUnitTests()) {
            Cache::put($cacheKey, $payload, 60);
        }

        return response()->json($payload);
    }

    public function store(
        Request $request,
        $workspaceId,
        IngestionService $ingestionService,
        TrendService $trendService,
        AlertService $alertService
    ) {
        $workspaceId = $this->resolveAuthorizedWorkspaceId($request, $workspaceId);
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'include_keywords' => 'required|array|min:1',
            'include_keywords.*' => 'string|max:100',
            'exclude_keywords' => 'nullable|array',
            'exclude_keywords.*' => 'string|max:100',
            'providers' => 'nullable|array',
            'match_mode' => 'nullable|in:any,all',
            'collect_interval_minutes' => 'nullable|integer|min:30|max:1440',
            'external_key' => 'nullable|string|max:64|unique:topics,external_key',
        ]);

        $defaultProviders = ['rss', 'youtube', 'threads', 'facebook', 'instagram', 'x', 'tiktok'];
        $providers = !empty($validated['providers']) ? $validated['providers'] : $defaultProviders;

        $topic = Topic::create([
            'workspace_id' => $workspaceId,
            'external_key' => $validated['external_key'] ?? null,
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'status' => 'active',
            'match_mode' => $validated['match_mode'] ?? 'any',
            'providers' => $providers,
            'collect_interval_minutes' => $validated['collect_interval_minutes'] ?? 60,
            'language_filters' => ['id'],
            'is_demo' => false,
        ]);

        foreach ($validated['include_keywords'] as $kw) {
            TopicKeyword::create([
                'topic_id' => $topic->id,
                'keyword' => trim($kw),
                'type' => 'include',
            ]);
        }

        if (!empty($validated['exclude_keywords'])) {
            foreach ($validated['exclude_keywords'] as $kw) {
                TopicKeyword::create([
                    'topic_id' => $topic->id,
                    'keyword' => trim($kw),
                    'type' => 'exclude',
                ]);
            }
        }

        // Zero-touch: auto-provision default negative_surge & volume_spike alert rules
        $alertService->ensureDefaultAlertsForTopic($topic);

        $autoSynced = false;
        $alertsTriggeredCount = 0;

        $shouldRunInitialSync = !app()->runningUnitTests()
            || app()->bound(IngestionService::class)
            || $request->boolean('force_sync');

        if ($shouldRunInitialSync) {
            try {
                $ingestionService->ingestTopic($topic);
                $trendService->computeTopicTrend($topic);
                $alertsTriggered = $alertService->evaluateTopicAlerts($topic);
                $alertsTriggeredCount = count($alertsTriggered);
                $autoSynced = true;
            } catch (\Throwable $e) {
                Log::warning("Zero-touch initial sync failed for topic {$topic->id}: {$e->getMessage()}");
            }
        }

        self::forgetWorkspaceTopicCaches($workspaceId);

        return response()->json([
            'status' => 'success',
            'message' => $autoSynced
                ? "Topik '{$topic->name}' dibuat, aturan alert otomatis aktif, dan sinkronisasi awal selesai."
                : "Topik '{$topic->name}' berhasil dibuat dengan aturan alert otomatis aktif.",
            'auto_alerts_provisioned' => true,
            'auto_synced' => $autoSynced,
            'alerts_triggered' => $alertsTriggeredCount,
            'data' => $topic->load('keywords')->fresh(['keywords', 'trendSnapshots']) ?? $topic->load('keywords'),
        ], 201);
    }

    public function show(Request $request, $id)
    {
        $topic = Topic::with(['keywords', 'trendSnapshots' => fn($q) => $q->latest()->limit(1)])
            ->withCount('mentions')
            ->findOrFail($id);
        $this->authorizeResourceWorkspace($request, (int) $topic->workspace_id);

        return response()->json([
            'status' => 'success',
            'data' => $topic,
        ]);
    }

    public function update(Request $request, $id)
    {
        $topic = Topic::findOrFail($id);
        $this->authorizeResourceWorkspace($request, (int) $topic->workspace_id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'status' => 'sometimes|in:active,paused,archived',
            'providers' => 'nullable|array',
            'collect_interval_minutes' => 'sometimes|integer|min:30|max:1440',
        ]);

        $topic->update($validated);
        self::forgetWorkspaceTopicCaches((int) $topic->workspace_id);

        return response()->json([
            'status' => 'success',
            'message' => 'Topik berhasil diperbarui.',
            'data' => $topic->fresh(['keywords']),
        ]);
    }

    public function destroy(Request $request, $id)
    {
        $topic = Topic::findOrFail($id);
        $this->authorizeResourceWorkspace($request, (int) $topic->workspace_id);
        $topic->update(['status' => 'archived']);
        self::forgetWorkspaceTopicCaches((int) $topic->workspace_id);

        return response()->json([
            'status' => 'success',
            'message' => 'Topik berhasil diarsipkan.',
        ]);
    }

    public function sync(Request $request, $id, IngestionService $ingestionService, TrendService $trendService, AlertService $alertService)
    {
        $topic = Topic::findOrFail($id);
        $this->authorizeResourceWorkspace($request, (int) $topic->workspace_id);

        $ingestionResults = $ingestionService->ingestTopic($topic);
        $trendSnapshot = $trendService->computeTopicTrend($topic);
        $alertsTriggered = $alertService->evaluateTopicAlerts($topic);
        self::forgetWorkspaceTopicCaches((int) $topic->workspace_id);

        return response()->json([
            'status' => 'success',
            'message' => "Sinkronisasi topik '{$topic->name}' selesai.",
            'ingestion' => $ingestionResults,
            'trend' => $trendSnapshot,
            'alerts_triggered' => count($alertsTriggered),
        ]);
    }
}

