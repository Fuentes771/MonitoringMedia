<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Connector;
use App\Models\IngestionRun;
use App\Models\Mention;
use App\Models\Topic;
use App\Services\MuseIngestService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Throwable;

class MuseConnectorController extends Controller
{
    public function health(): JsonResponse
    {
        $nowWib = Carbon::now('Asia/Jakarta');
        $dbStatus = 'ok';
        $httpStatus = 200;

        try {
            DB::select('SELECT 1');
        } catch (Throwable) {
            $dbStatus = 'error';
            $httpStatus = 503;
        }

        $configuredKeys = config('services.muse.api_keys', []);
        if (is_string($configuredKeys)) {
            $configuredKeys = array_filter(array_map('trim', explode(',', $configuredKeys)));
        }

        return response()->json([
            'status' => $dbStatus === 'ok' ? 'ok' : 'degraded',
            'service' => 'TRINETRA API',
            'version' => 'v1',
            'timezone' => 'Asia/Jakarta',
            'timestamp' => $nowWib->toIso8601String(),
            'database' => $dbStatus,
            'muse_configured' => is_array($configuredKeys) && count(array_filter($configuredKeys)) > 0,
        ], $httpStatus);
    }

    public function activeTopics(Request $request): JsonResponse
    {
        $workspaceId = (int) $request->attributes->get('muse_workspace_id');

        $topics = Topic::where('workspace_id', $workspaceId)
            ->where('status', 'active')
            ->with('keywords')
            ->orderBy('id', 'asc')
            ->get();

        $formatted = [];
        foreach ($topics as $topic) {
            $providers = is_array($topic->providers) ? $topic->providers : [];
            $metaPlatforms = array_values(array_intersect(MuseIngestService::META_PLATFORMS, $providers));

            if (empty($metaPlatforms)) {
                continue;
            }

            $includeKeywords = $topic->keywords
                ->where('type', 'include')
                ->pluck('keyword')
                ->map(fn ($k) => trim((string) $k))
                ->filter()
                ->values()
                ->all();

            if (empty($includeKeywords)) {
                $includeKeywords = [$topic->name];
            }

            $excludeKeywords = $topic->keywords
                ->where('type', 'exclude')
                ->pluck('keyword')
                ->map(fn ($k) => trim((string) $k))
                ->filter()
                ->values()
                ->all();

            $priority = $this->resolveTopicPriority($topic);

            $formatted[] = [
                'topic_id' => $topic->resolveTopicIdentifier(),
                'id' => (int) $topic->id,
                'name' => $topic->name,
                'category' => $topic->category ?? 'national_program',
                'keywords' => $includeKeywords,
                'exclude_keywords' => $excludeKeywords,
                'platforms' => $metaPlatforms,
                'priority' => $priority,
                'active' => true,
                'last_collected_at' => $topic->last_collected_at?->timezone('Asia/Jakarta')->toIso8601String(),
                'collect_interval_minutes' => (int) ($topic->collect_interval_minutes ?: 60),
            ];
        }

        usort($formatted, function (array $a, array $b) {
            if ($b['priority'] !== $a['priority']) {
                return $b['priority'] <=> $a['priority'];
            }
            return $a['id'] <=> $b['id'];
        });

        return response()->json([
            'topics' => $formatted,
        ]);
    }

    public function ingestMentions(Request $request, MuseIngestService $ingestService): JsonResponse
    {
        $workspaceId = (int) $request->attributes->get('muse_workspace_id');

        $validated = $request->validate([
            'source' => 'nullable|string|max:100',
            'collected_at' => 'nullable|string|max:64',
            'topic_id' => 'nullable',
            'mentions' => 'required|array|min:1|max:50',
        ]);

        $result = $ingestService->ingestBatch($workspaceId, $validated);

        return response()->json($result, 200);
    }

    public function collectorStatus(Request $request): JsonResponse
    {
        $workspaceId = (int) $request->attributes->get('muse_workspace_id');
        $nowWib = Carbon::now('Asia/Jakarta');
        $since24h = $nowWib->copy()->subHours(24);

        $connectors = Connector::where('workspace_id', $workspaceId)
            ->whereIn('provider', MuseIngestService::META_PLATFORMS)
            ->get()
            ->keyBy('provider');

        $totalByPlatform = Mention::where('workspace_id', $workspaceId)
            ->whereIn('provider', MuseIngestService::META_PLATFORMS)
            ->select('provider', DB::raw('COUNT(*) as total'))
            ->groupBy('provider')
            ->pluck('total', 'provider')
            ->toArray();

        $last24hByPlatform = Mention::where('workspace_id', $workspaceId)
            ->whereIn('provider', MuseIngestService::META_PLATFORMS)
            ->where('collected_at', '>=', $since24h)
            ->select('provider', DB::raw('COUNT(*) as total'))
            ->groupBy('provider')
            ->pluck('total', 'provider')
            ->toArray();

        $platforms = [];
        foreach (MuseIngestService::META_PLATFORMS as $platform) {
            $conn = $connectors->get($platform);
            $platforms[$platform] = [
                'status' => $conn?->status ?? 'connected',
                'engine_mode' => 'muse_push',
                'last_successful_sync_at' => $conn?->last_successful_sync_at?->timezone('Asia/Jakarta')->toIso8601String(),
                'mentions_24h' => (int) ($last24hByPlatform[$platform] ?? 0),
                'total_mentions' => (int) ($totalByPlatform[$platform] ?? 0),
            ];
        }

        $activeTopicsCount = Topic::where('workspace_id', $workspaceId)
            ->where('status', 'active')
            ->get(['providers'])
            ->filter(function (Topic $topic) {
                $providers = is_array($topic->providers) ? $topic->providers : [];
                return !empty(array_intersect(MuseIngestService::META_PLATFORMS, $providers));
            })
            ->count();

        $connectorIds = $connectors->pluck('id')->all();
        $recentRuns = !empty($connectorIds)
            ? IngestionRun::whereIn('connector_id', $connectorIds)
                ->with(['connector:id,provider', 'topic:id,name,external_key'])
                ->orderByDesc('started_at')
                ->limit(5)
                ->get()
                ->map(fn (IngestionRun $run) => [
                    'ingest_id' => $run->counts_json['ingest_id'] ?? null,
                    'platform' => $run->connector?->provider,
                    'topic_id' => $run->topic?->resolveTopicIdentifier(),
                    'topic_name' => $run->topic?->name,
                    'status' => $run->status,
                    'counts' => $run->counts_json,
                    'started_at' => $run->started_at?->timezone('Asia/Jakarta')->toIso8601String(),
                    'finished_at' => $run->finished_at?->timezone('Asia/Jakarta')->toIso8601String(),
                ])
                ->values()
                ->all()
            : [];

        return response()->json([
            'status' => 'ok',
            'mode' => 'muse_push',
            'timezone' => 'Asia/Jakarta',
            'generated_at' => $nowWib->toIso8601String(),
            'active_topics_count' => $activeTopicsCount,
            'rate_limit_per_minute' => (int) config('services.muse.ingest_rate_limit', 10),
            'platforms' => $platforms,
            'recent_runs' => $recentRuns,
        ]);
    }

    public function deleteMention(
        Request $request,
        string $platform,
        string $platformPostId,
        MuseIngestService $ingestService
    ): JsonResponse {
        $workspaceId = (int) $request->attributes->get('muse_workspace_id');
        $normalizedPlatform = strtolower(trim($platform));

        if (!in_array($normalizedPlatform, MuseIngestService::ALLOWED_PLATFORMS, true)) {
            return response()->json([
                'status' => 'error',
                'error' => 'invalid_platform',
                'message' => "Platform '{$platform}' tidak valid.",
            ], 422);
        }

        $deleted = $ingestService->deleteByPlatformPostId(
            workspaceId: $workspaceId,
            platform: $normalizedPlatform,
            platformPostId: $platformPostId,
            ipAddress: $request->ip(),
            reason: is_string($request->input('reason')) ? $request->input('reason') : null
        );

        if ($deleted === null) {
            return response()->json([
                'status' => 'error',
                'error' => 'not_found',
                'message' => 'Mention tidak ditemukan.',
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Mention berhasil dihapus sesuai permintaan takedown.',
            'data' => $deleted,
        ], 200);
    }

    private function resolveTopicPriority(Topic $topic): int
    {
        if ($topic->urgency_level === 'critical') {
            return 95;
        }
        if ($topic->urgency_level === 'elevated' || $topic->category === 'trending_issue') {
            return 85;
        }
        if ($topic->category === 'national_program') {
            return 80;
        }

        return 70;
    }
}
