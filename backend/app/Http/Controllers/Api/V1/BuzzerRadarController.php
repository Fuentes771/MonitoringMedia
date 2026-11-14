<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\V1\Concerns\ResolvesAuthorizedWorkspace;
use App\Http\Controllers\Controller;
use App\Services\BuzzerDetectionService;
use Illuminate\Http\Request;

class BuzzerRadarController extends Controller
{
    use ResolvesAuthorizedWorkspace;

    public function overview(Request $request, BuzzerDetectionService $buzzerService)
    {
        $workspaceId = $this->resolveAuthorizedWorkspaceId($request);
        $days = (int)$request->input('days', 7);
        $topicId = $request->input('topic_id') ? (int)$request->input('topic_id') : null;

        $data = $buzzerService->getRadarOverview($workspaceId, $days, $topicId);

        return response()->json([
            'status' => 'success',
            'data' => $data,
        ]);
    }

    public function scan(Request $request, BuzzerDetectionService $buzzerService)
    {
        $workspaceId = $this->resolveAuthorizedWorkspaceId($request);
        $days = (int)$request->input('days', 7);
        $topicId = $request->input('topic_id') ? (int)$request->input('topic_id') : null;

        $data = $buzzerService->forceScanWorkspace($workspaceId, $days, $topicId);

        $inauthCount = $data['authenticity_index']['inauthentic_count'] ?? 0;
        $sarcCount = $data['authenticity_index']['sarcasm_count'] ?? 0;
        $clustersCount = $data['authenticity_index']['clusters_count'] ?? 0;

        return response()->json([
            'status' => 'success',
            'message' => "Pemindaian jaringan selesai: {$clustersCount} kluster copypasta, {$inauthCount} indikasi bot/buzzer, dan {$sarcCount} komentar sarkasme terdeteksi.",
            'data' => $data,
        ]);
    }
}

