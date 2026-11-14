<?php

namespace App\Services;

use App\Models\Topic;
use App\Models\Mention;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class HotIssueService
{
    /**
     * Get active hot issues within the 33-hour intelligence window.
     */
    public function getActiveHotIssues(int $workspaceId = 1): array
    {
        $now = Carbon::now('Asia/Jakarta');
        // 33-Hour Intelligence Window: 00:00 Kemarin s/d 09:00 Hari Ini (atau rolling 33 jam terkini)
        $dailyStart = $now->copy()->subDay()->startOfDay(); // 00:00 Kemarin
        $dailyEnd = $now->copy()->startOfDay()->setHour(9);  // 09:00 Hari Ini
        if ($now->isAfter($dailyEnd)) {
            // Jika sudah lewat pk 09:00, gunakan jendela rolling 33 jam terakhir agar data selalu real-time
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

        $hotIssues = [];
        $totalSurging = 0;

        foreach ($topics as $topic) {
            $currentMentionsQuery = $topic->mentions()
                ->whereBetween('mentions.published_at', [$windowStart, $windowEnd]);

            $currentCount = (clone $currentMentionsQuery)->count();

            $baselineCount = $topic->mentions()
                ->whereBetween('mentions.published_at', [$baselineStart, $baselineEnd])
                ->count();

            $safeBaseline = max($baselineCount, 3);
            $multiplier = round($currentCount / $safeBaseline, 1);
            if ($currentCount > 0 && $baselineCount === 0) {
                $multiplier = max(3.5, round($currentCount / 2.0, 1));
            }

            // Sentiment breakdown
            $sentiments = (clone $currentMentionsQuery)
                ->join('sentiment_results', 'mentions.id', '=', 'sentiment_results.mention_id')
                ->select('sentiment_results.label', DB::raw('count(*) as count'))
                ->groupBy('sentiment_results.label')
                ->pluck('count', 'label')
                ->toArray();

            $pos = $sentiments['positive'] ?? 0;
            $neu = $sentiments['neutral'] ?? 0;
            $neg = $sentiments['negative'] ?? 0;
            $totalSent = max(1, $pos + $neu + $neg);
            $negShare = round(($neg / $totalSent) * 100, 1);

            // 33-Hour activity velocity (11 intervals of 3 hours)
            $windowMentions = (clone $currentMentionsQuery)
                ->leftJoin('sentiment_results', 'mentions.id', '=', 'sentiment_results.mention_id')
                ->select('mentions.published_at', 'sentiment_results.label as sentiment')
                ->get();

            $velocityPoints = [];
            $cursor = $windowStart->copy();
            while ($cursor < $windowEnd) {
                $bEnd = $cursor->copy()->addHours(3);
                if ($bEnd > $windowEnd) $bEnd = $windowEnd->copy();

                $inB = $windowMentions->filter(function ($item) use ($cursor, $bEnd) {
                    if (!$item->published_at) return false;
                    $t = Carbon::parse($item->published_at);
                    return $t >= $cursor && $t < $bEnd;
                });

                $bLabel = $cursor->isToday()
                    ? 'Hari Ini ' . $cursor->format('H:i')
                    : 'Kemarin ' . $cursor->format('H:i');

                $velocityPoints[] = [
                    'time_label' => $bLabel,
                    'count' => $inB->count(),
                    'negative' => $inB->where('sentiment', 'negative')->count(),
                    'positive' => $inB->where('sentiment', 'positive')->count(),
                ];
                $cursor->addHours(3);
            }

            $linkValidator = app(SocialLinkValidator::class);

            // Top netizen quotes across X, TikTok, IG, FB, RSS
            $quotes = (clone $currentMentionsQuery)
                ->with(['sentiment'])
                ->orderBy('published_at', 'desc')
                ->limit(10)
                ->get()
                ->map(function ($m) use ($linkValidator) {
                    $meta = $m->metadata_json ?? [];
                    $likes = $meta['likes'] ?? $meta['metrics']['favorite_count'] ?? $meta['metrics']['digg_count'] ?? $meta['metrics']['reactions_count'] ?? 0;
                    $isComment = !empty($meta['is_comment']);
                    $linkStatus = $linkValidator->resolveEffectiveStatus(
                        $m->provider,
                        $m->source_url,
                        is_array($meta) ? $meta : [],
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
                        'likes' => (int)$likes,
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
                'hourly_velocity' => $velocityPoints,
                'netizen_quotes' => $quotes,
                'ai_synthesis' => $this->generateAiSynthesis($topic, $currentCount, $multiplier, $negShare),
            ];
        }

        // Urutkan berdasarkan tingkat urgensi dan multiplier tertinggi
        usort($hotIssues, fn($a, $b) => $b['surge_multiplier'] <=> $a['surge_multiplier']);

        return [
            'window_label' => $windowLabel,
            'window_start' => $windowStart->toIso8601String(),
            'window_end' => $windowEnd->toIso8601String(),
            'system_state' => $totalSurging > 0 ? 'surging_detected' : (count($hotIssues) > 0 ? 'elevated' : 'normal_calm'),
            'surging_count' => $totalSurging,
            'hot_issues' => $hotIssues,
        ];
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

