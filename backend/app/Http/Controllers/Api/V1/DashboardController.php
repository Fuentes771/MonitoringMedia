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
        $excludeInauthentic = $request->boolean('exclude_inauthentic');
        $fromStr = $request->input('from', Carbon::now('Asia/Jakarta')->subDays(7)->toIso8601String());
        $toStr = $request->input('to', Carbon::now('Asia/Jakarta')->toIso8601String());

        $from = Carbon::parse($fromStr)->setTimezone('Asia/Jakarta');
        $to = Carbon::parse($toStr)->setTimezone('Asia/Jakarta');

        $query = Mention::where('mentions.workspace_id', $workspaceId)
            ->whereBetween('mentions.published_at', [$from, $to]);

        if ($excludeInauthentic) {
            $query->where('mentions.is_inauthentic', false);
        }

        if ($topicId) {
            $query->whereHas('topics', fn($q) => $q->where('topics.id', $topicId));
        }

        if ($provider) {
            $providers = explode(',', $provider);
            $query->whereIn('mentions.provider', $providers);
        }

        $totalMentions = (clone $query)->count();

        // Baseline comparison (preceding equal period)
        $durationHours = max(1, $from->diffInHours($to));
        $prevFrom = $from->copy()->subHours($durationHours);
        $prevTo = $from->copy();

        $prevQuery = Mention::where('workspace_id', $workspaceId)
            ->whereBetween('published_at', [$prevFrom, $prevTo]);
        if ($excludeInauthentic) {
            $prevQuery->where('is_inauthentic', false);
        }
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

        // Executive Daily Intelligence Briefing Window: 00:00 Kemarin s/d 09:00 WIB Hari Ini
        $nowWib = Carbon::now('Asia/Jakarta');
        $dailyStart = $nowWib->copy()->subDay()->startOfDay(); // 00:00 Kemarin
        $dailyEnd = $nowWib->copy()->startOfDay()->setHour(9); // 09:00 Hari Ini

        $dailyQuery = Mention::where('workspace_id', $workspaceId)
            ->whereBetween('published_at', [$dailyStart, $dailyEnd]);

        $dailyTotal = (clone $dailyQuery)->count();
        $dailySentiments = (clone $dailyQuery)
            ->join('sentiment_results', 'mentions.id', '=', 'sentiment_results.mention_id')
            ->select('sentiment_results.label', DB::raw('count(*) as count'))
            ->groupBy('sentiment_results.label')
            ->pluck('count', 'label')
            ->toArray();

        $dPos = $dailySentiments['positive'] ?? 0;
        $dNeu = $dailySentiments['neutral'] ?? 0;
        $dNeg = $dailySentiments['negative'] ?? 0;
        $dTotalSent = max(1, $dPos + $dNeu + $dNeg);

        // Top programs discussed in this daily window
        $dailyTopTopics = Topic::where('workspace_id', $workspaceId)
            ->where('status', 'active')
            ->whereHas('mentions', function ($q) use ($dailyStart, $dailyEnd) {
                $q->whereBetween('published_at', [$dailyStart, $dailyEnd]);
            })
            ->withCount(['mentions' => function ($q) use ($dailyStart, $dailyEnd) {
                $q->whereBetween('published_at', [$dailyStart, $dailyEnd]);
            }])
            ->orderBy('mentions_count', 'desc')
            ->limit(3)
            ->get(['id', 'name', 'mentions_count']);

        // Chronological factual events in this 33-hour window
        $chronologicalEvents = Mention::where('workspace_id', $workspaceId)
            ->whereBetween('published_at', [$dailyStart, $dailyEnd])
            ->with(['sentiment', 'topics:id,name'])
            ->orderBy('published_at', 'desc')
            ->limit(5)
            ->get()
            ->map(function ($m) {
                $lines = explode("\n", trim($m->text));
                $headline = trim($lines[0] ?? $m->text);
                if (strlen($headline) > 110) {
                    $headline = substr($headline, 0, 107) . '...';
                }

                return [
                    'id' => $m->id,
                    'time_label' => $m->published_at ? $m->published_at->timezone('Asia/Jakarta')->format('d M H:i') . ' WIB' : 'Waktu tidak diketahui',
                    'program_name' => $m->topics->first()?->name ?? 'Program Prioritas',
                    'headline' => $headline,
                    'sentiment' => $m->sentiment?->label ?? 'neutral',
                    'source' => $m->author_name ?? ucfirst($m->provider),
                    'url' => $m->source_url,
                ];
            });

        // 33-Hour Activity Curve (Hourly Velocity Sparkline in memory)
        $windowMentions = Mention::where('mentions.workspace_id', $workspaceId)
            ->whereBetween('mentions.published_at', [$dailyStart, $dailyEnd])
            ->leftJoin('sentiment_results', 'mentions.id', '=', 'sentiment_results.mention_id')
            ->select('mentions.published_at', 'sentiment_results.label as sentiment')
            ->get();

        $hourlyVelocity = [];
        $cursor = $dailyStart->copy();
        while ($cursor < $dailyEnd) {
            $bucketEnd = $cursor->copy()->addHours(3);
            if ($bucketEnd > $dailyEnd) {
                $bucketEnd = $dailyEnd->copy();
            }

            $inBucket = $windowMentions->filter(function ($item) use ($cursor, $bucketEnd) {
                if (!$item->published_at) return false;
                $t = Carbon::parse($item->published_at);
                return $t >= $cursor && $t < $bucketEnd;
            });

            $bPos = $inBucket->where('sentiment', 'positive')->count();
            $bNeg = $inBucket->where('sentiment', 'negative')->count();

            $isToday = $cursor->isToday();
            $labelPrefix = $isToday ? 'Hari Ini ' : 'Kemarin ';

            $hourlyVelocity[] = [
                'time_label' => $labelPrefix . $cursor->format('H:i'),
                'count' => $inBucket->count(),
                'positive' => $bPos,
                'negative' => $bNeg,
            ];

            $cursor->addHours(3);
        }

        $aiSummary = app(\App\Services\AiIntelligenceService::class)->getDailyExecutiveSummary($workspaceId, $dailyStart, $dailyEnd);

        $dailyBriefing = [
            'window_label' => 'Periode 00:00 Kemarin s/d 09:00 WIB Hari Ini',
            'start' => $dailyStart->toIso8601String(),
            'end' => $dailyEnd->toIso8601String(),
            'total_mentions' => $dailyTotal,
            'positive' => $dPos,
            'neutral' => $dNeu,
            'negative' => $dNeg,
            'pos_percent' => round(($dPos / $dTotalSent) * 100),
            'neu_percent' => round(($dNeu / $dTotalSent) * 100),
            'neg_percent' => round(($dNeg / $dTotalSent) * 100),
            'top_programs' => $dailyTopTopics->map(fn($t) => [
                'id' => $t->id,
                'name' => $t->name,
                'mentions' => $t->mentions_count,
            ]),
            'chronological_events' => $chronologicalEvents,
            'hourly_velocity' => $hourlyVelocity,
            'ai_summary' => $aiSummary,
        ];

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
            'daily_briefing' => $dailyBriefing,
            'platform_breakdown' => $platformBreakdown,
        ]);
    }

    public function timeseries(Request $request)
    {
        $workspaceId = $request->input('workspace_id', 1);
        $topicId = $request->input('topic_id');
        $provider = $request->input('provider');
        $excludeInauthentic = $request->boolean('exclude_inauthentic');
        $days = (int)$request->input('days', 7);

        $now = Carbon::now('Asia/Jakarta');
        $start = $now->copy()->subDays($days)->startOfDay();

        $query = Mention::where('mentions.workspace_id', $workspaceId)
            ->where('mentions.published_at', '>=', $start)
            ->leftJoin('sentiment_results', 'mentions.id', '=', 'sentiment_results.mention_id');

        if ($excludeInauthentic) {
            $query->where('mentions.is_inauthentic', false);
        }

        if ($topicId) {
            $query->whereHas('topics', fn($q) => $q->where('topics.id', $topicId));
        }

        if ($provider) {
            $query->where('mentions.provider', $provider);
        }

        $isSqlite = DB::connection()->getDriverName() === 'sqlite';
        $dayExpression = $isSqlite
            ? "strftime('%Y-%m-%d', mentions.published_at) as day"
            : "date_trunc('day', mentions.published_at AT TIME ZONE 'Asia/Jakarta') as day";

        $rows = $query->select(
            DB::raw($dayExpression),
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

