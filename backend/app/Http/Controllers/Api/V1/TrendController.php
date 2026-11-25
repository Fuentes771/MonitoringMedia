<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\V1\Concerns\ResolvesAuthorizedWorkspace;
use App\Http\Controllers\Controller;
use App\Models\Topic;
use App\Models\TrendSnapshot;
use App\Models\MentionKeyword;
use App\Services\TrendService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class TrendController extends Controller
{
    use ResolvesAuthorizedWorkspace;

    public function index(Request $request, TrendService $trendService)
    {
        $workspaceId = $this->resolveAuthorizedWorkspaceId($request);
        $cacheKey = "trends_index_v2:{$workspaceId}";

        if (!app()->runningUnitTests() && !$request->boolean('refresh')) {
            $cached = Cache::get($cacheKey);
            if ($cached !== null) {
                return response()->json($cached);
            }
        }

        // Rising Topics based on latest Trend Snapshot
        $topics = Topic::where('workspace_id', $workspaceId)
            ->where('status', 'active')
            ->with(['trendSnapshots' => fn($q) => $q->latest('window_end')->limit(1)])
            ->withCount('mentions')
            ->get();

        $risingTopics = $topics->map(function ($t) use ($trendService) {
            $snap = $t->trendSnapshots->first();
            if ($snap) {
                $score = $snap->score;
                $sampleCount = $snap->sample_count;
                $rawExplanation = $snap->explanation;
                $components = is_array($snap->components_json) ? $snap->components_json : [];
            } else {
                $computed = $trendService->computeTopicTrend($t);
                $score = $computed['score'];
                $sampleCount = $computed['sample_count'];
                $rawExplanation = $computed['explanation'];
                $components = $computed['components'] ?? [];
            }

            $explanation = str_replace('—', ':', (string) ($rawExplanation ?: 'Volume stabil pada periode observasi.'));

            return [
                'id' => $t->id,
                'name' => $t->name,
                'description' => $t->description,
                'mentions_count' => $t->mentions_count,
                'trend_score' => $score,
                'sample_count' => $sampleCount,
                'explanation' => $explanation,
                'components' => $components ?: null,
                'driving_keywords' => $components['driving_keywords'] ?? [],
                'active_providers' => $components['active_providers'] ?? [],
                'sample_mention' => $components['sample_mention'] ?? null,
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

        $payload = [
            'status' => 'success',
            'data' => [
                'rising_topics' => $risingTopics->all(),
                'top_keywords' => $topKeywords->toArray(),
            ],
        ];

        if (!app()->runningUnitTests()) {
            Cache::put($cacheKey, $payload, 60);
        }

        return response()->json($payload);
    }
}

