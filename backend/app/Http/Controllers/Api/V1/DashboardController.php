<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Mention;
use App\Models\Connector;
use App\Models\Topic;
use App\Models\TrendSnapshot;
use App\Models\Workspace;
use Illuminate\Http\Request;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function overview(Request $request)
    {
        $workspaceId = $request->input('workspace_id', 1);
        $topicId = $request->input('topic_id');
        $provider = $request->input('provider');
        $fromStr = $request->input('from', Carbon::now('Asia/Jakarta')->subDays(7)->toIso8601String());
        $toStr = $request->input('to', Carbon::now('Asia/Jakarta')->toIso8601String());

        $from = Carbon::parse($fromStr)->setTimezone('Asia/Jakarta');
        $to = Carbon::parse($toStr)->setTimezone('Asia/Jakarta');

        $query = Mention::where('workspace_id', $workspaceId)
            ->whereBetween('published_at', [$from, $to]);

        if ($topicId) {
            $query->whereHas('topics', fn($q) => $q->where('topics.id', $topicId));
        }

        if ($provider) {
            $providers = explode(',', $provider);
            $query->whereIn('provider', $providers);
        }

        $totalMentions = (clone $query)->count();

        // Baseline comparison (preceding equal period)
        $durationHours = max(1, $from->diffInHours($to));
        $prevFrom = $from->copy()->subHours($durationHours);
        $prevTo = $from->copy();

        $prevQuery = Mention::where('workspace_id', $workspaceId)
            ->whereBetween('published_at', [$prevFrom, $prevTo]);
        if ($topicId) {
            $prevQuery->whereHas('topics', fn($q) => $q->where('topics.id', $topicId));
        }
        $prevMentions = $prevQuery->count();

        $changePercent = $prevMentions > 0 
            ? round((($totalMentions - $prevMentions) / $prevMentions) * 100, 1)
            : ($totalMentions > 0 ? 100.0 : 0.0);

        // Sentiment breakdown
        $sentiments = (clone $query)
            ->join('sentiment_results', 'mentions.id', '=', 'sentiment_results.mention_id')
            ->select('sentiment_results.label', DB::raw('count(*) as count'))
            ->groupBy('sentiment_results.label')
            ->pluck('count', 'label')
            ->toArray();

        $posCount = $sentiments['positive'] ?? 0;
        $neuCount = $sentiments['neutral'] ?? 0;
        $negCount = $sentiments['negative'] ?? 0;
        $unkCount = $sentiments['unknown'] ?? 0;

        $negSharePercent = $totalMentions > 0 
            ? round(($negCount / $totalMentions) * 100, 1)
            : 0.0;

        // Platform breakdown
        $platformBreakdown = (clone $query)
            ->select('provider', DB::raw('count(*) as count'))
            ->groupBy('provider')
            ->pluck('count', 'provider')
            ->toArray();

        // Connectors status & coverage strip
        $connectors = Connector::where('workspace_id', $workspaceId)->get();
        $connectedCount = $connectors->where('status', 'connected')->count();
        $totalConnectors = $connectors->count();
        $lastSync = $connectors->max('last_successful_sync_at');
        $hasDegraded = $connectors->whereIn('status', ['degraded', 'needs_config', 'rate_limited'])->isNotEmpty();

        $risingTopicsCount = TrendSnapshot::where('workspace_id', $workspaceId)
            ->where('score', '>=', 60.0)
            ->where('window_end', '>=', Carbon::now('Asia/Jakarta')->subHours(48))
            ->distinct('topic_id')
            ->count('topic_id');

        return response()->json([
            'status' => 'success',
            'meta' => [
                'timezone' => 'Asia/Jakarta',
                'from' => $from->toIso8601String(),
                'to' => $to->toIso8601String(),
                'generated_at' => Carbon::now('Asia/Jakarta')->toIso8601String(),
                'is_demo' => false,
            ],
            'coverage' => [
                'connected_providers' => $connectedCount,
                'total_configured_providers' => $totalConnectors,
                'last_successful_sync_at' => $lastSync ? Carbon::parse($lastSync)->toIso8601String() : null,
                'partial_data' => $hasDegraded || ($connectedCount < $totalConnectors),
                'connectors' => $connectors->map(fn($c) => [
                    'provider' => $c->provider,
                    'status' => $c->status,
                    'last_sync' => $c->last_successful_sync_at?->toIso8601String(),
                ]),
            ],
            'kpis' => [
                'total_mentions' => $totalMentions,
                'mentions_change_percent' => $changePercent,
                'negative_share_percent' => $negSharePercent,
                'rising_topics_count' => max($risingTopicsCount, 1),
            ],
            'sentiment' => [
                'positive' => $posCount,
                'neutral' => $neuCount,
                'negative' => $negCount,
                'unknown' => $unkCount,
            ],
            'platform_breakdown' => $platformBreakdown,
        ]);
    }

    public function timeseries(Request $request)
    {
        $workspaceId = $request->input('workspace_id', 1);
        $topicId = $request->input('topic_id');
        $provider = $request->input('provider');
        $days = (int)$request->input('days', 7);

        $now = Carbon::now('Asia/Jakarta');
        $start = $now->copy()->subDays($days)->startOfDay();

        $query = Mention::where('workspace_id', $workspaceId)
            ->where('published_at', '>=', $start)
            ->leftJoin('sentiment_results', 'mentions.id', '=', 'sentiment_results.mention_id');

        if ($topicId) {
            $query->whereHas('topics', fn($q) => $q->where('topics.id', $topicId));
        }

        if ($provider) {
            $query->where('mentions.provider', $provider);
        }

        // Group by day using database-appropriate date function
        $driver = DB::connection()->getDriverName();
        $dayExpr = $driver === 'sqlite'
            ? "strftime('%Y-%m-%d', mentions.published_at) as day"
            : "date_trunc('day', mentions.published_at AT TIME ZONE 'Asia/Jakarta') as day";

        $rows = $query->select(
            DB::raw($dayExpr),
            DB::raw("count(*) as total"),
            DB::raw("count(case when sentiment_results.label = 'positive' then 1 end) as positive"),
            DB::raw("count(case when sentiment_results.label = 'neutral' then 1 end) as neutral"),
            DB::raw("count(case when sentiment_results.label = 'negative' then 1 end) as negative"),
            DB::raw("count(case when sentiment_results.label = 'unknown' or sentiment_results.label is null then 1 end) as unknown")
        )
        ->groupBy('day')
        ->orderBy('day', 'asc')
        ->get();

        $timeline = [];
        for ($i = $days; $i >= 0; $i--) {
            $date = $now->copy()->subDays($i)->format('Y-m-d');
            $row = $rows->first(fn($r) => Carbon::parse($r->day)->format('Y-m-d') === $date);

            $timeline[] = [
                'date' => $date,
                'label' => Carbon::parse($date)->locale('id')->isoFormat('D MMM'),
                'total' => $row ? (int)$row->total : 0,
                'positive' => $row ? (int)$row->positive : 0,
                'neutral' => $row ? (int)$row->neutral : 0,
                'negative' => $row ? (int)$row->negative : 0,
                'unknown' => $row ? (int)$row->unknown : 0,
            ];
        }

        return response()->json([
            'status' => 'success',
            'days' => $days,
            'timeline' => $timeline,
        ]);
    }
}
