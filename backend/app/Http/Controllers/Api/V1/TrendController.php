<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Topic;
use App\Models\TrendSnapshot;
use App\Models\MentionKeyword;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class TrendController extends Controller
{
    public function index(Request $request)
    {
        $workspaceId = $request->input('workspace_id', 1);

        // Rising Topics based on latest Trend Snapshot
        $topics = Topic::where('workspace_id', $workspaceId)
            ->where('status', 'active')
            ->with(['trendSnapshots' => fn($q) => $q->latest('window_end')->limit(1)])
            ->withCount('mentions')
            ->get();

        $risingTopics = $topics->map(function ($t) {
            $snap = $t->trendSnapshots->first();
            return [
                'id' => $t->id,
                'name' => $t->name,
                'description' => $t->description,
                'mentions_count' => $t->mentions_count,
                'trend_score' => $snap ? $snap->score : 45.0,
                'sample_count' => $snap ? $snap->sample_count : $t->mentions_count,
                'explanation' => $snap ? $snap->explanation : "Volume stabil pada periode observasi.",
                'components' => $snap ? $snap->components_json : null,
            ];
        })->sortByDesc('trend_score')->values();

        // Top Keywords across the workspace in last 7 days
        $topKeywords = MentionKeyword::join('mentions', 'mention_keywords.mention_id', '=', 'mentions.id')
            ->where('mentions.workspace_id', $workspaceId)
            ->where('mentions.published_at', '>=', Carbon::now('Asia/Jakarta')->subDays(7))
            ->select('mention_keywords.keyword', DB::raw('count(*) as count'), DB::raw('avg(mention_keywords.score) as avg_score'))
            ->groupBy('mention_keywords.keyword')
            ->orderBy('count', 'desc')
            ->limit(15)
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => [
                'rising_topics' => $risingTopics,
                'top_keywords' => $topKeywords,
            ],
        ]);
    }
}

