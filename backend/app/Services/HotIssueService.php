<?php

namespace App\Services;

use App\Models\Topic;
use App\Models\Mention;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class HotIssueService
{
    public static function cacheKey(int $workspaceId): string
    {
        return "hot_issues_active_v2:{$workspaceId}";
    }

    public static function forgetCache(int $workspaceId): void
    {
        Cache::forget(self::cacheKey($workspaceId));
        Cache::increment("ws_data_ver:{$workspaceId}");
    }

    /**
     * Get active hot issues within the 33-hour intelligence window.
     */
    public function getActiveHotIssues(int $workspaceId = 1, bool $forceFresh = false): array
    {
        $cacheKey = self::cacheKey($workspaceId);
        if (!app()->runningUnitTests() && !$forceFresh) {
            $cached = Cache::get($cacheKey);
            if (is_array($cached)) {
                return $cached;
            }
        }

        $now = Carbon::now('Asia/Jakarta');
        // 33-Hour Intelligence Window: 00:00 Kemarin s/d 09:00 Hari Ini (atau rolling 33 jam terkini)
        $dailyStart = $now->copy()->subDay()->startOfDay(); // 00:00 Kemarin
        $dailyEnd = $now->copy()->startOfDay()->setHour(9);  // 09:00 Hari Ini
        if ($now->isAfter($dailyEnd)) {
            $windowStart = $now->copy()->subHours(33);
            $windowEnd = $now->copy();
            $windowLabel = '33 Jam Terkini (Rolling Real-Time)';
        } else {
            $windowStart = $dailyStart;
            $windowEnd = $dailyEnd;
            $windowLabel = '00:00 Kemarin s/d 09:00 WIB Hari Ini';
        }

        $baselineStart = $windowStart->copy()->subHours(33);
        $baselineEnd = $windowStart->copy();

        // 1. Ambil topik bertipe trending_issue yang aktif
        $topics = Topic::where('workspace_id', $workspaceId)
            ->where('category', 'trending_issue')
            ->where('status', 'active')
            ->get();

        if ($topics->isEmpty()) {
            $emptyResult = [
                'window_label' => $windowLabel,
                'window_start' => $windowStart->toIso8601String(),
                'window_end' => $windowEnd->toIso8601String(),
                'system_state' => 'normal_calm',
                'surging_count' => 0,
                'hot_issues' => [],
            ];
            if (!app()->runningUnitTests()) {
                Cache::put($cacheKey, $emptyResult, 60);
            }
            return $emptyResult;
        }

        $topicIds = $topics->pluck('id')->all();

        // 2. Batch query: current & baseline counts across ALL active hot issues at once (2 queries instead of 2*N)
        $currentCounts = DB::table('mention_topic_matches')
            ->join('mentions', 'mention_topic_matches.mention_id', '=', 'mentions.id')
            ->whereIn('mention_topic_matches.topic_id', $topicIds)
            ->whereBetween('mentions.published_at', [$windowStart, $windowEnd])
            ->select('mention_topic_matches.topic_id', DB::raw('count(*) as cnt'))
            ->groupBy('mention_topic_matches.topic_id')
            ->pluck('cnt', 'topic_id')
            ->toArray();

        $baselineCounts = DB::table('mention_topic_matches')
            ->join('mentions', 'mention_topic_matches.mention_id', '=', 'mentions.id')
            ->whereIn('mention_topic_matches.topic_id', $topicIds)
            ->whereBetween('mentions.published_at', [$baselineStart, $baselineEnd])
            ->select('mention_topic_matches.topic_id', DB::raw('count(*) as cnt'))
            ->groupBy('mention_topic_matches.topic_id')
            ->pluck('cnt', 'topic_id')
            ->toArray();

        // 3. Batch query: 33-hour mentions + sentiment for both sentiment totals and 3-hour velocity buckets (1 query instead of 2*N)
        $velocityRows = DB::table('mention_topic_matches')
            ->join('mentions', 'mention_topic_matches.mention_id', '=', 'mentions.id')
            ->leftJoin('sentiment_results', 'mentions.id', '=', 'sentiment_results.mention_id')
            ->whereIn('mention_topic_matches.topic_id', $topicIds)
            ->whereBetween('mentions.published_at', [$windowStart, $windowEnd])
            ->select(
                'mention_topic_matches.topic_id',
                'mentions.published_at',
                'sentiment_results.label as sentiment'
            )
            ->get();

        // Pre-build 3-hour bucket template once
        $bucketTemplate = [];
        $cursor = $windowStart->copy();
        while ($cursor < $windowEnd) {
            $bLabel = $cursor->isToday()
                ? 'Hari Ini ' . $cursor->format('H:i')
                : 'Kemarin ' . $cursor->format('H:i');
            $bucketTemplate[] = [
                'time_label' => $bLabel,
                'count' => 0,
                'negative' => 0,
                'positive' => 0,
            ];
            $cursor->addHours(3);
        }

        $bucketSeconds = 3 * 3600;
        $windowStartTs = $windowStart->getTimestamp();
        $windowEndTs = $windowEnd->getTimestamp();
        $bucketTotalCount = count($bucketTemplate);

        $velocityByTopic = [];
        $sentimentsByTopic = [];
        foreach ($topicIds as $tid) {
            $velocityByTopic[$tid] = $bucketTemplate;
            $sentimentsByTopic[$tid] = ['positive' => 0, 'neutral' => 0, 'negative' => 0];
        }

        foreach ($velocityRows as $row) {
            $tid = (int) $row->topic_id;
            if ($row->sentiment && isset($sentimentsByTopic[$tid][$row->sentiment])) {
                $sentimentsByTopic[$tid][$row->sentiment]++;
            }
            if (!$row->published_at) {
                continue;
            }
            $ts = strtotime((string) $row->published_at);
            if ($ts === false || $ts < $windowStartTs || $ts >= $windowEndTs) {
                continue;
            }
            $idx = intdiv($ts - $windowStartTs, $bucketSeconds);
            if ($idx >= 0 && $idx < $bucketTotalCount) {
                $velocityByTopic[$tid][$idx]['count']++;
                if ($row->sentiment === 'negative') {
                    $velocityByTopic[$tid][$idx]['negative']++;
                } elseif ($row->sentiment === 'positive') {
                    $velocityByTopic[$tid][$idx]['positive']++;
                }
            }
        }

        // 4. Batch query: top recent mention IDs per topic (1 lightweight join query + 1 eager Mention fetch)
        $matchRows = DB::table('mention_topic_matches')
            ->join('mentions', 'mention_topic_matches.mention_id', '=', 'mentions.id')
            ->whereIn('mention_topic_matches.topic_id', $topicIds)
            ->whereBetween('mentions.published_at', [$windowStart, $windowEnd])
            ->orderByDesc('mentions.published_at')
            ->select('mention_topic_matches.topic_id', 'mention_topic_matches.mention_id')
            ->limit(max(50, count($topicIds) * 20))
            ->get();

        $mentionIdsByTopic = [];
        $allQuoteMentionIds = [];
        foreach ($matchRows as $mr) {
            $tid = (int) $mr->topic_id;
            $mid = (int) $mr->mention_id;
            if (!isset($mentionIdsByTopic[$tid])) {
                $mentionIdsByTopic[$tid] = [];
            }
            if (count($mentionIdsByTopic[$tid]) < 10) {
                $mentionIdsByTopic[$tid][] = $mid;
                $allQuoteMentionIds[$mid] = true;
            }
        }

        $quoteMentionsMap = !empty($allQuoteMentionIds)
            ? Mention::whereIn('id', array_keys($allQuoteMentionIds))
                ->with(['sentiment'])
                ->get()
                ->keyBy('id')
            : collect();

        $linkValidator = app(SocialLinkValidator::class);
        $hotIssues = [];
        $totalSurging = 0;

        foreach ($topics as $topic) {
            $tid = (int) $topic->id;
            $currentCount = (int) ($currentCounts[$tid] ?? 0);
            $baselineCount = (int) ($baselineCounts[$tid] ?? 0);

            $safeBaseline = max($baselineCount, 3);
            $multiplier = round($currentCount / $safeBaseline, 1);
            if ($currentCount > 0 && $baselineCount === 0) {
                $multiplier = max(3.5, round($currentCount / 2.0, 1));
            }

            $pos = $sentimentsByTopic[$tid]['positive'] ?? 0;
            $neu = $sentimentsByTopic[$tid]['neutral'] ?? 0;
            $neg = $sentimentsByTopic[$tid]['negative'] ?? 0;
            $totalSent = max(1, $pos + $neu + $neg);
            $negShare = round(($neg / $totalSent) * 100, 1);

            $quotes = collect($mentionIdsByTopic[$tid] ?? [])
                ->map(fn ($mid) => $quoteMentionsMap->get($mid))
                ->filter()
                ->map(function (Mention $m) use ($linkValidator) {
                    $meta = is_array($m->metadata_json) ? $m->metadata_json : [];
                    $likes = $meta['likes'] ?? $meta['metrics']['favorite_count'] ?? $meta['metrics']['digg_count'] ?? $meta['metrics']['reactions_count'] ?? 0;
                    $isComment = !empty($meta['is_comment']);
                    $linkStatus = $linkValidator->resolveEffectiveStatus(
                        $m->provider,
                        $m->source_url,
                        $meta,
                        (bool) $m->is_demo
                    );

                    return [
                        'id' => $m->id,
                        'platform' => $m->provider,
                        'author' => $m->author_name ?? ucfirst($m->provider),
                        'source_url' => $m->source_url,
                        'link_status' => $linkStatus,
                        'text' => $m->text,
                        'sentiment' => $m->sentiment?->label ?? 'neutral',
                        'likes' => (int) $likes,
                        'is_comment' => $isComment,
                        'time_label' => $m->published_at ? $m->published_at->timezone('Asia/Jakarta')->format('d M H:i') . ' WIB' : '',
                    ];
                })
                ->sortByDesc('likes')
                ->values()
                ->toArray();

            $status = 'surging';
            if ($multiplier < 1.5) {
                $status = 'stabilizing';
            } elseif ($topic->urgency_level === 'critical' || $multiplier >= 3.0) {
                $status = 'surging';
                $totalSurging++;
            }

            $hotIssues[] = [
                'id' => $topic->id,
                'title' => $topic->name,
                'description' => $topic->description,
                'urgency_level' => $topic->urgency_level ?? 'elevated',
                'surge_multiplier' => $multiplier,
                'total_mentions_33h' => $currentCount,
                'negative_share_percent' => $negShare,
                'status' => $status,
                'sentiment' => [
                    'positive' => $pos,
                    'neutral' => $neu,
                    'negative' => $neg,
                    'pos_percent' => round(($pos / $totalSent) * 100, 1),
                    'neu_percent' => round(($neu / $totalSent) * 100, 1),
                    'neg_percent' => $negShare,
                ],
                'hourly_velocity' => $velocityByTopic[$tid],
                'netizen_quotes' => $quotes,
                'ai_synthesis' => $this->generateAiSynthesis($topic, $currentCount, $multiplier, $negShare),
            ];
        }

        usort($hotIssues, fn($a, $b) => $b['surge_multiplier'] <=> $a['surge_multiplier']);

        $result = [
            'window_label' => $windowLabel,
            'window_start' => $windowStart->toIso8601String(),
            'window_end' => $windowEnd->toIso8601String(),
            'system_state' => $totalSurging > 0 ? 'surging_detected' : (count($hotIssues) > 0 ? 'elevated' : 'normal_calm'),
            'surging_count' => $totalSurging,
            'hot_issues' => $hotIssues,
        ];

        if (!app()->runningUnitTests()) {
            Cache::put($cacheKey, $result, 60);
        }

        return $result;
    }

    private function generateAiSynthesis(Topic $topic, int $count, float $multiplier, float $negShare): string
    {
        $name = $topic->name;
        if (str_contains(strtolower($name), 'sadap') || str_contains(strtolower($name), 'prabowo')) {
            return "Pola wacana publik mengenai '{$name}' melonjak tajam ({$multiplier}x baseline) dengan volume {$count} sebutan dalam 33 jam terakhir. Opini publik didominasi oleh perdebatan keamanan siber istana vs potensi provokasi politik. Sentimen kritis tercatat {$negShare}%, didorong oleh tuntutan transparansi hasil investigasi intelijen negara.";
        }

        if (str_contains(strtolower($name), 'ppn')) {
            return "Lonjakan percakapan terkait '{$name}' mencapai {$multiplier}x lipat dari rata-rata sebelumnya. Kekhawatiran netizen berfokus pada potensi penurunan daya beli kelas menengah dan efek domino terhadap harga sembako. Sentimen negatif dominan ({$negShare}%), menuntut adanya mitigasi bansos dan insentif fiskal.";
        }

        return "Isu '{$name}' terdeteksi mengalami akselerasi percakapan sebesar {$multiplier}x baseline dalam jendela pemantauan 33 jam. Terkumpul {$count} sebutan lintas platform dengan tingkat resistensi publik ({$negShare}% sentimen kritis). Disarankan pemantauan narasi terkoordinasi dan rilis klarifikasi resmi proaktif.";
    }
}

