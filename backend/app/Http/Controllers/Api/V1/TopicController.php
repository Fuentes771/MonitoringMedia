<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Topic;
use App\Models\TopicKeyword;
use App\Services\IngestionService;
use App\Services\TrendService;
use App\Services\AlertService;
use Illuminate\Http\Request;

class TopicController extends Controller
{
    public function index(Request $request, $workspaceId)
    {
        $status = $request->input('status', 'active');
        $query = Topic::where('workspace_id', $workspaceId)
            ->with(['keywords', 'trendSnapshots' => fn($q) => $q->latest()->limit(1)])
            ->withCount([
                'mentions',
                'mentions as positive_count' => fn($q) => $q->whereHas('sentiment', fn($s) => $s->where('label', 'positive')),
                'mentions as neutral_count' => fn($q) => $q->whereHas('sentiment', fn($s) => $s->where('label', 'neutral')),
                'mentions as negative_count' => fn($q) => $q->whereHas('sentiment', fn($s) => $s->where('label', 'negative')),
            ]);

        if ($status !== 'all') {
            $query->where('status', $status);
        }

        $topics = $query->orderBy('mentions_count', 'desc')
            ->orderBy('id', 'asc')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $topics,
        ]);
    }

    public function store(Request $request, $workspaceId)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'include_keywords' => 'required|array|min:1',
            'include_keywords.*' => 'string|max:100',
            'exclude_keywords' => 'nullable|array',
            'exclude_keywords.*' => 'string|max:100',
            'providers' => 'nullable|array',
            'match_mode' => 'nullable|in:any,all',
        ]);

        $topic = Topic::create([
            'workspace_id' => $workspaceId,
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'status' => 'active',
            'match_mode' => $validated['match_mode'] ?? 'any',
            'providers' => $validated['providers'] ?? ['rss'],
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

        return response()->json([
            'status' => 'success',
            'message' => 'Topik monitoring berhasil dibuat.',
            'data' => $topic->load('keywords'),
        ], 201);
    }

    public function show($id)
    {
        $topic = Topic::with(['keywords', 'trendSnapshots' => fn($q) => $q->latest()->limit(1)])
            ->withCount('mentions')
            ->findOrFail($id);

        return response()->json([
            'status' => 'success',
            'data' => $topic,
        ]);
    }

    public function update(Request $request, $id)
    {
        $topic = Topic::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'status' => 'sometimes|in:active,paused,archived',
            'providers' => 'nullable|array',
        ]);

        $topic->update($validated);

        return response()->json([
            'status' => 'success',
            'message' => 'Topik berhasil diperbarui.',
            'data' => $topic->fresh(['keywords']),
        ]);
    }

    public function destroy($id)
    {
        $topic = Topic::findOrFail($id);
        $topic->update(['status' => 'archived']);

        return response()->json([
            'status' => 'success',
            'message' => 'Topik berhasil diarsipkan.',
        ]);
    }

    public function sync(Request $request, $id, IngestionService $ingestionService, TrendService $trendService, AlertService $alertService)
    {
        $topic = Topic::findOrFail($id);

        $ingestionResults = $ingestionService->ingestTopic($topic);
        $trendSnapshot = $trendService->computeTopicTrend($topic);
        $alertsTriggered = $alertService->evaluateTopicAlerts($topic);

        return response()->json([
            'status' => 'success',
            'message' => "Sinkronisasi topik '{$topic->name}' selesai.",
            'ingestion' => $ingestionResults,
            'trend' => $trendSnapshot,
            'alerts_triggered' => count($alertsTriggered),
        ]);
    }
}

