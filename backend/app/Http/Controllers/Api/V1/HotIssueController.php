<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\V1\Concerns\ResolvesAuthorizedWorkspace;
use App\Http\Controllers\Controller;
use App\Services\HotIssueService;
use App\Services\HotIssueDiscoveryService;
use App\Services\IngestionService;
use App\Services\TrendService;
use App\Services\AlertService;
use App\Models\Topic;
use App\Models\TopicKeyword;
use Illuminate\Http\Request;
use Carbon\Carbon;

class HotIssueController extends Controller
{
    use ResolvesAuthorizedWorkspace;

    public function index(Request $request, HotIssueService $hotIssueService)
    {
        $workspaceId = $this->resolveAuthorizedWorkspaceId($request);
        $data = $hotIssueService->getActiveHotIssues($workspaceId);

        return response()->json([
            'status' => 'success',
            'data' => $data,
        ]);
    }

    public function store(
        Request $request, 
        IngestionService $ingestionService, 
        TrendService $trendService, 
        AlertService $alertService
    ) {
        $workspaceId = $this->resolveAuthorizedWorkspaceId($request);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'urgency_level' => 'nullable|in:normal,elevated,critical',
            'keywords' => 'required|array|min:1',
            'keywords.*' => 'string|max:100',
        ]);

        $topic = Topic::create([
            'workspace_id' => $workspaceId,
            'name' => $validated['name'],
            'description' => $validated['description'] ?? 'Pantauan isu hangat dan lonjakan percakapan publik real-time.',
            'category' => 'trending_issue',
            'urgency_level' => $validated['urgency_level'] ?? 'elevated',
            'surge_detected_at' => Carbon::now('Asia/Jakarta'),
            'status' => 'active',
            'match_mode' => 'any',
            'providers' => ['rss', 'youtube', 'x', 'tiktok', 'instagram', 'facebook'],
            'is_demo' => false,
        ]);

        foreach ($validated['keywords'] as $kw) {
            TopicKeyword::create([
                'topic_id' => $topic->id,
                'keyword' => trim($kw),
                'type' => 'include',
                'match_mode' => 'broad',
            ]);
        }

        // Immediately trigger initial ingestion and trend calculation
        $ingestionService->ingestTopic($topic);
        $trendService->computeTopicTrend($topic);
        $alertService->evaluateTopicAlerts($topic);

        return response()->json([
            'status' => 'success',
            'message' => "Isu hangat '{$topic->name}' berhasil ditambahkan ke Radar Pantauan dan data terbaru telah ditarik.",
            'data' => $topic->load('keywords'),
        ], 201);
    }

    /**
     * Trigger immediate automated discovery & ingestion for hot issues from Google News.
     */
    public function scan(
        Request $request, 
        HotIssueDiscoveryService $discoveryService, 
        HotIssueService $hotIssueService
    ) {
        $workspaceId = $this->resolveAuthorizedWorkspaceId($request);

        $result = $discoveryService->discoverAndIngest($workspaceId);
        $radarData = $hotIssueService->getActiveHotIssues($workspaceId);

        return response()->json([
            'status' => 'success',
            'message' => $result['message'],
            'discovery' => $result,
            'data' => $radarData,
        ]);
    }

    /**
     * Archive or dismiss a hot issue from active radar.
     */
    public function destroy(Request $request, $id)
    {
        $topic = Topic::where('category', 'trending_issue')->findOrFail($id);
        $this->authorizeResourceWorkspace($request, (int) $topic->workspace_id);
        $topic->update(['status' => 'archived']);

        return response()->json([
            'status' => 'success',
            'message' => "Isu '{$topic->name}' berhasil diarsipkan dari Radar Pantauan.",
        ]);
    }
}
