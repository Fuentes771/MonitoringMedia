<?php

namespace App\Services;

use App\Models\Alert;
use App\Models\AlertEvent;
use App\Models\Mention;
use App\Models\Notification;
use App\Models\Topic;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class AlertService
{
    /**
     * Ensure every non-archived topic in a workspace has default zero-touch alert rules.
     */
    public function ensureDefaultAlertsForWorkspace(int $workspaceId): void
    {
        $topics = Topic::where('workspace_id', $workspaceId)
            ->where('status', '!=', 'archived')
            ->get();

        foreach ($topics as $topic) {
            $this->ensureDefaultAlertsForTopic($topic);
        }
    }

    /**
     * Automatically provision default negative_surge and volume_spike alert rules
     * when a topic has no alert rules configured yet.
     */
    public function ensureDefaultAlertsForTopic(Topic $topic): void
    {
        if ($topic->status === 'archived') {
            return;
        }

        if (Alert::where('topic_id', $topic->id)->exists()) {
            return;
        }

        Alert::create([
            'workspace_id' => $topic->workspace_id,
            'topic_id' => $topic->id,
            'type' => 'negative_surge',
            'threshold_json' => [
                'min_volume' => 4,
                'negative_share_percent' => 35.0,
            ],
            'cooldown_minutes' => 60,
            'is_active' => true,
        ]);

        Alert::create([
            'workspace_id' => $topic->workspace_id,
            'topic_id' => $topic->id,
            'type' => 'volume_spike',
            'threshold_json' => [
                'min_volume' => 5,
                'spike_multiplier' => 1.8,
            ],
            'cooldown_minutes' => 60,
            'is_active' => true,
        ]);
    }

    /**
     * Evaluate active alert rules for a topic with zero-touch organic filtering and auto-resolve.
     *
     * @return array<int, AlertEvent>
     */
    public function evaluateTopicAlerts(Topic $topic): array
    {
        $this->ensureDefaultAlertsForTopic($topic);

        if ($topic->status === 'paused' || $topic->status === 'archived') {
            return [];
        }

        $now = Carbon::now('Asia/Jakarta');
        $alerts = Alert::where('topic_id', $topic->id)
            ->where('is_active', true)
            ->get();

        if ($alerts->isEmpty()) {
            return [];
        }

        $recentMentions = $topic->mentions()
            ->with(['sentiment', 'keywords'])
            ->where('mentions.published_at', '>=', $now->copy()->subHours(24))
            ->get();

        $partition = $this->partitionOrganicMentions($recentMentions);
        $baselineCount = $this->countBaselineOrganicMentions($topic, $now);

        $triggeredEvents = [];

        foreach ($alerts as $alert) {
            $evaluation = $this->evaluateSingleRule($alert, $topic, $partition, $baselineCount);
            if ($evaluation === null) {
                continue;
            }

            if (!$evaluation['triggered']) {
                $this->autoResolveOpenEvents($alert, $now, $evaluation['resolve_reason']);
                continue;
            }

            if ($this->isInCooldown($alert, $now)) {
                continue;
            }

            $event = AlertEvent::create([
                'alert_id' => $alert->id,
                'status' => 'open',
                'severity' => $evaluation['severity'],
                'evidence_json' => $evaluation['evidence'],
                'triggered_at' => $now,
            ]);

            Notification::create([
                'workspace_id' => $topic->workspace_id,
                'type' => $alert->type,
                'title' => $evaluation['notification_title'],
                'message' => $evaluation['notification_message'],
                'payload_json' => [
                    'alert_id' => $alert->id,
                    'event_id' => $event->id,
                    'topic_id' => $topic->id,
                ],
            ]);

            $alert->update(['last_triggered_at' => $now]);
            $triggeredEvents[] = $event;
        }

        return $triggeredEvents;
    }

    /**
     * Partition 24h mentions into unique organic signals vs filtered bot/near-duplicate noise.
     *
     * @param Collection<int, Mention> $mentions
     * @return array<string, mixed>
     */
    protected function partitionOrganicMentions(Collection $mentions): array
    {
        $inauthenticCount = 0;
        $nearDuplicateCount = 0;
        $organicUnique = collect();

        foreach ($mentions as $mention) {
            $isBot = (bool) $mention->is_inauthentic;
            $meta = is_array($mention->metadata_json) ? $mention->metadata_json : [];
            $isNearDup = !empty($meta['is_near_duplicate']);

            if ($isBot) {
                $inauthenticCount++;
                continue;
            }
            if ($isNearDup) {
                $nearDuplicateCount++;
                continue;
            }

            $organicUnique->push($mention);
        }

        return [
            'raw_total' => $mentions->count(),
            'organic' => $organicUnique,
            'organic_count' => $organicUnique->count(),
            'inauthentic_count' => $inauthenticCount,
            'near_duplicate_count' => $nearDuplicateCount,
        ];
    }

    /**
     * Count organic non-duplicate baseline mentions from days -7 to -1.
     */
    protected function countBaselineOrganicMentions(Topic $topic, Carbon $now): int
    {
        return $topic->mentions()
            ->whereBetween('mentions.published_at', [
                $now->copy()->subDays(7),
                $now->copy()->subHours(24),
            ])
            ->where(function ($q) {
                $q->where('mentions.is_inauthentic', false)
                    ->orWhereNull('mentions.is_inauthentic');
            })
            ->where(function ($q) {
                $q->whereNull('mentions.metadata_json')
                    ->orWhereNull('mentions.metadata_json->is_near_duplicate')
                    ->orWhere('mentions.metadata_json->is_near_duplicate', false);
            })
            ->count();
    }

    /**
     * Evaluate a single alert rule against partitioned organic metrics.
     *
     * @param array<string, mixed> $partition
     * @return array<string, mixed>|null
     */
    protected function evaluateSingleRule(Alert $alert, Topic $topic, array $partition, int $baselineCount): ?array
    {
        $threshold = $alert->threshold_json ?: [];
        /** @var Collection<int, Mention> $organic */
        $organic = $partition['organic'];
        $organicCount = $partition['organic_count'];

        if ($alert->type === 'negative_surge') {
            $minVolume = (int) ($threshold['min_volume'] ?? 5);
            $thresholdPercent = (float) ($threshold['negative_share_percent'] ?? 30.0);

            if ($organicCount < $minVolume) {
                return [
                    'triggered' => false,
                    'resolve_reason' => "Volume opini organik 24 jam ({$organicCount}) berada di bawah ambang minimum ({$minVolume}).",
                ];
            }

            $negMentions = $organic->filter(fn (Mention $m) => $m->sentiment && $m->sentiment->label === 'negative');
            $negCount = $negMentions->count();
            $actualPercent = round(($negCount / $organicCount) * 100, 1);

            if ($actualPercent < $thresholdPercent) {
                return [
                    'triggered' => false,
                    'resolve_reason' => "Proporsi sentimen negatif organik turun ke {$actualPercent}% (di bawah ambang {$thresholdPercent}%).",
                ];
            }

            $drivingKeywords = $this->extractTopKeywords($negMentions, 3);

            return [
                'triggered' => true,
                'severity' => $actualPercent > 50.0 ? 'critical' : 'high',
                'notification_title' => "Lonjakan Sentimen Negatif: {$topic->name}",
                'notification_message' => "Proporsi sentimen negatif organik mencapai {$actualPercent}% (ambang batas: {$thresholdPercent}%) pada 24 jam terakhir.",
                'evidence' => [
                    'topic_name' => $topic->name,
                    'negative_share_percent' => $actualPercent,
                    'threshold_percent' => $thresholdPercent,
                    'sample_count' => $organicCount,
                    'organic_sample_count' => $organicCount,
                    'negative_count' => $negCount,
                    'inauthentic_filtered_count' => $partition['inauthentic_count'],
                    'near_duplicate_filtered_count' => $partition['near_duplicate_count'],
                    'driving_keywords' => $drivingKeywords,
                    'sample_text' => $negMentions->first()?->text,
                ],
            ];
        }

        if ($alert->type === 'volume_spike') {
            $minVolume = (int) ($threshold['min_volume'] ?? 5);
            $spikeMultiplier = (float) ($threshold['spike_multiplier'] ?? 1.8);
            $baselineDailyAvg = $baselineCount > 0 ? round($baselineCount / 6.0, 2) : 0.0;
            $safeBaseline = max(1.0, $baselineDailyAvg);
            $actualMultiplier = $organicCount > 0 ? round($organicCount / $safeBaseline, 2) : 0.0;

            $dayOneBurstThreshold = max(15, $minVolume * 2);
            $isSpike = $organicCount >= $minVolume && (
                ($baselineCount > 0 && $actualMultiplier >= $spikeMultiplier) ||
                ($baselineCount === 0 && $organicCount >= $dayOneBurstThreshold)
            );

            if (!$isSpike) {
                return [
                    'triggered' => false,
                    'resolve_reason' => "Laju percakapan organik 24 jam ({$organicCount} dok, {$actualMultiplier}x) kembali normal.",
                ];
            }

            $drivingKeywords = $this->extractTopKeywords($organic, 3);

            return [
                'triggered' => true,
                'severity' => $actualMultiplier >= 3.0 ? 'critical' : 'high',
                'notification_title' => "Lonjakan Volume Percakapan: {$topic->name}",
                'notification_message' => "Volume opini organik 24 jam mencapai {$organicCount} dokumen ({$actualMultiplier}x rata-rata harian).",
                'evidence' => [
                    'topic_name' => $topic->name,
                    'spike_multiplier' => $spikeMultiplier,
                    'actual_multiplier' => $actualMultiplier,
                    'current_24h_volume' => $organicCount,
                    'baseline_daily_avg' => $baselineDailyAvg,
                    'sample_count' => $organicCount,
                    'organic_sample_count' => $organicCount,
                    'inauthentic_filtered_count' => $partition['inauthentic_count'],
                    'near_duplicate_filtered_count' => $partition['near_duplicate_count'],
                    'driving_keywords' => $drivingKeywords,
                    'sample_text' => $organic->first()?->text,
                ],
            ];
        }

        return null;
    }

    /**
     * Extract top recurring keywords across a set of mentions for incident evidence.
     *
     * @param Collection<int, Mention> $mentions
     * @return array<int, string>
     */
    protected function extractTopKeywords(Collection $mentions, int $limit = 3): array
    {
        $freq = [];
        foreach ($mentions as $mention) {
            foreach ($mention->keywords as $kw) {
                $term = trim((string) $kw->keyword);
                if ($term === '') {
                    continue;
                }
                $freq[$term] = ($freq[$term] ?? 0) + 1;
            }
        }

        arsort($freq);
        return array_slice(array_keys($freq), 0, $limit);
    }

    protected function isInCooldown(Alert $alert, Carbon $now): bool
    {
        if (!$alert->last_triggered_at) {
            return false;
        }

        $cooldownEnds = $alert->last_triggered_at->copy()->addMinutes($alert->cooldown_minutes);
        return $now->lt($cooldownEnds);
    }

    /**
     * Zero-touch auto-resolve any open or acknowledged events once the surge has subsided.
     */
    protected function autoResolveOpenEvents(Alert $alert, Carbon $now, string $reason): void
    {
        $activeEvents = AlertEvent::where('alert_id', $alert->id)
            ->whereIn('status', ['open', 'acknowledged'])
            ->get();

        foreach ($activeEvents as $event) {
            $evidence = is_array($event->evidence_json) ? $event->evidence_json : [];
            $event->update([
                'status' => 'resolved',
                'resolved_at' => $now,
                'evidence_json' => array_merge($evidence, [
                    'auto_resolved' => true,
                    'auto_resolved_at' => $now->toIso8601String(),
                    'auto_resolved_reason' => $reason,
                ]),
            ]);
        }
    }
}

