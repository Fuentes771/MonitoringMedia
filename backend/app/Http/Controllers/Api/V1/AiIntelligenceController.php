<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\V1\Concerns\ResolvesAuthorizedWorkspace;
use App\Http\Controllers\Controller;
use App\Models\Topic;
use App\Services\AiIntelligenceService;
use Illuminate\Http\Request;

class AiIntelligenceController extends Controller
{
    use ResolvesAuthorizedWorkspace;

    protected AiIntelligenceService $aiService;

    public function __construct(AiIntelligenceService $aiService)
    {
        $this->aiService = $aiService;
    }

    /**
     * Check 9Router and AI Gateway status.
     */
    public function status()
    {
        $status = $this->aiService->getGatewayStatus();

        return response()->json([
            'status' => 'success',
            'data' => $status,
        ]);
    }

    /**
     * Context-bounded RAG Chatbot restricted strictly to PulseScope database mentions.
     */
    public function chat(Request $request)
    {
        $validated = $request->validate([
            'query' => 'required|string|max:1000',
            'topic_id' => 'nullable|integer|exists:topics,id',
            'conversation_history' => 'nullable|array',
            'workspace_id' => 'nullable|integer',
        ]);

        $workspaceId = $this->resolveAuthorizedWorkspaceId($request, $validated['workspace_id'] ?? null);
        $topicId = $validated['topic_id'] ?? null;
        if ($topicId !== null) {
            $topic = Topic::findOrFail($topicId);
            $this->authorizeResourceWorkspace($request, (int) $topic->workspace_id);
            if ((int) $topic->workspace_id !== $workspaceId) {
                abort(403, 'Topik bukan milik workspace yang dipilih.');
            }
        }
        $history = $validated['conversation_history'] ?? [];

        $result = $this->aiService->chat(
            query: $validated['query'],
            topicId: $topicId,
            conversationHistory: $history,
            workspaceId: $workspaceId
        );

        return response()->json([
            'status' => 'success',
            'data' => $result,
        ]);
    }

    /**
     * Get or regenerate AI Executive Intelligence Briefing for a national priority program.
     */
    public function topicSummary(Request $request, $id)
    {
        $topic = Topic::findOrFail((int) $id);
        $this->authorizeResourceWorkspace($request, (int) $topic->workspace_id);

        $forceRefresh = filter_var($request->query('refresh', false), FILTER_VALIDATE_BOOLEAN);

        $summary = $this->aiService->getTopicSummary((int) $topic->id, $forceRefresh);

        return response()->json([
            'status' => 'success',
            'data' => $summary,
        ]);
    }

    /**
     * Generate optimized news/social search queries for a program.
     */
    public function generateQueries(Request $request)
    {
        $validated = $request->validate([
            'program_name' => 'required|string|max:255',
        ]);

        $queries = $this->aiService->generateQueriesForProgram($validated['program_name']);

        return response()->json([
            'status' => 'success',
            'data' => $queries,
        ]);
    }
}

