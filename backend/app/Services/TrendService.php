<?php

namespace App\Services;

use App\Models\Topic;
use App\Models\TrendSnapshot;
use App\Models\Mention;
use Carbon\Carbon;

class TrendService
{
    /**
     * Compute trend score and momentum components for a topic.
     * @return array<string, mixed>
     */
    public function computeTopicTrend(Topic $topic, int $windowHours = 24): array
    {
        $now = Carbon::now('Asia/Jakarta');
        $windowStart = $now->copy()->subHours($windowHours);
        $baselineStart = $windowStart->copy()->subHours($windowHours);

        // Current window mentions
        $currentMentionsQuery = $topic->mentions()
            ->where('mentions.published_at', '>=', $windowStart)
            ->where('mentions.published_at', '<=', $now);

        $currentVolume = (clone $currentMentionsQuery)->count();
        $sampleCount = $currentVolume;

        // Baseline window mentions (preceding window)
        $baselineVolume = $topic->mentions()
            ->where('mentions.published_at', '>=', $baselineStart)
            ->where('mentions.published_at', '<', $windowStart)
            ->count();

        // 1. Normalized Volume (capped at 50 mentions for baseline target)
        $normVolume = min(1.0, $currentVolume / 40.0);

        // 2. Growth Rate (ratio to baseline, smoothed)
        $safeBaseline = max($baselineVolume, 1);
        $growthMultiplier = $currentVolume / $safeBaseline;
        $normGrowth = min(1.0, max(0.0, ($growthMultiplier - 1.0) / 3.0));
        if ($currentVolume > 0 && $baselineVolume == 0) {
            $normGrowth = 0.85; // New breakout surge
        }

        // 3. Acceleration
        $normAccel = min(1.0, max(0.0, $normGrowth * 0.9));

        // 4. Source Diversity
        $distinctProviders = (clone $currentMentionsQuery)
            ->distinct('mentions.provider')
            ->count('mentions.provider');
        $normDiversity = min(1.0, $distinctProviders / 2.0); // Out of RSS + YouTube (MVP)

        // 5. Persistence
        $normPersistence = $currentVolume > 5 ? 0.75 : 0.40;

        // Formula from PRD §9.3
        $rawScore = (
            0.25 * $normVolume +
            0.35 * $normGrowth +
            0.20 * $normAccel +
            0.10 * $normDiversity +
            0.10 * $normPersistence
        );

        $score = round(min(100.0, max(5.0, $rawScore * 100)), 1);

        // Human-readable explanation per PRD §9.3
        $growthStr = $growthMultiplier >= 1.0 
            ? sprintf("%.1fx dibanding baseline", $growthMultiplier)
            : "stabil";
        $explanation = "Trend score {$score}/100: volume {$currentVolume} mention ({$growthStr}) pada periode {$windowHours} jam terakhir.";

        $components = [
            'volume' => round($normVolume, 2),
            'growth' => round($normGrowth, 2),
            'acceleration' => round($normAccel, 2),
            'source_diversity' => round($normDiversity, 2),
            'persistence' => round($normPersistence, 2),
            'raw_volume' => $currentVolume,
            'baseline_volume' => $baselineVolume,
            'growth_multiplier' => round($growthMultiplier, 2),
        ];

        // Save Snapshot
        TrendSnapshot::create([
            'workspace_id' => $topic->workspace_id,
            'topic_id' => $topic->id,
            'window_start' => $windowStart,
            'window_end' => $now,
            'score' => $score,
            'sample_count' => $sampleCount,
            'components_json' => $components,
            'explanation' => $explanation,
        ]);

        return [
            'topic_id' => $topic->id,
            'topic_name' => $topic->name,
            'score' => $score,
            'sample_count' => $sampleCount,
            'components' => $components,
            'explanation' => $explanation,
        ];
    }
}
