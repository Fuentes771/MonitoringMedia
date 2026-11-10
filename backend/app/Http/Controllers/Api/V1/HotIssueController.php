<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\HotIssueService;
use App\Models\Topic;
use App\Models\TopicKeyword;
use Illuminate\Http\Request;
use Carbon\Carbon;

class HotIssueController extends Controller
{
    public function index(Request $request, HotIssueService $hotIssueService)
    {
        $workspaceId = (int)$request->input('workspace_id', 1);
        $data = $hotIssueService->getActiveHotIssues($workspaceId);

        return response()->json([
            'status' => 'success',
            'data' => $data,
        ]);
    }

    public function store(Request $request)
    {
        $workspaceId = (int)$request->input('workspace_id', 1);

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

        return response()->json([
            'status' => 'success',
            'message' => "Isu hangat '{$topic->name}' berhasil ditambahkan ke Radar Pantauan.",
            'data' => $topic->load('keywords'),
        ], 201);
    }
}

