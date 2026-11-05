<?php

namespace App\Services;

use App\Models\Alert;
use App\Models\AlertEvent;
use App\Models\Notification;
use App\Models\Topic;
use Carbon\Carbon;

class AlertService
{
    /**
     * Evaluate active alert rules for a topic.
     * @return array<int, AlertEvent>
     */
    public function evaluateTopicAlerts(Topic $topic): array
    {
        $now = Carbon::now('Asia/Jakarta');
        $alerts = Alert::where('topic_id', $topic->id)
            ->where('is_active', true)
            ->get();

        $triggeredEvents = [];

        foreach ($alerts as $alert) {
            // Check cooldown
            if ($alert->last_triggered_at) {
                $cooldownEnds = $alert->last_triggered_at->copy()->addMinutes($alert->cooldown_minutes);
                if ($now->lt($cooldownEnds)) {
                    continue; // In cooldown
                }
            }

            $threshold = $alert->threshold_json ?: [];

            if ($alert->type === 'negative_surge') {
                $minVolume = $threshold['min_volume'] ?? 5;
                $thresholdPercent = $threshold['negative_share_percent'] ?? 30.0;

                // Recent mentions in 24 hours
                $recentMentions = $topic->mentions()
                    ->with('sentiment')
                    ->where('mentions.published_at', '>=', $now->copy()->subHours(24))
                    ->get();

                $total = $recentMentions->count();
                if ($total < $minVolume) {
                    continue;
                }

                $negCount = $recentMentions->filter(fn($m) => $m->sentiment && $m->sentiment->label === 'negative')->count();
                $actualPercent = round(($negCount / $total) * 100, 1);

                if ($actualPercent >= $thresholdPercent) {
                    $event = AlertEvent::create([
                        'alert_id' => $alert->id,
                        'status' => 'open',
                        'severity' => $actualPercent > 50 ? 'critical' : 'high',
                        'evidence_json' => [
                            'topic_name' => $topic->name,
                            'negative_share_percent' => $actualPercent,
                            'threshold_percent' => $thresholdPercent,
                            'sample_count' => $total,
                            'negative_count' => $negCount,
                            'sample_text' => $recentMentions->firstWhere(fn($m) => $m->sentiment && $m->sentiment->label === 'negative')?->text,
                        ],
                        'triggered_at' => $now,
                    ]);

                    Notification::create([
                        'workspace_id' => $topic->workspace_id,
                        'type' => 'negative_surge',
                        'title' => "Lonjakan Sentimen Negatif: {$topic->name}",
                        'message' => "Proporsi sentimen negatif mencapai {$actualPercent}% (ambang batas: {$thresholdPercent}%) pada 24 jam terakhir.",
                        'payload_json' => [
                            'alert_id' => $alert->id,
                            'event_id' => $event->id,
                            'topic_id' => $topic->id,
                        ],
                    ]);

                    $alert->update(['last_triggered_at' => $now]);
                    $triggeredEvents[] = $event;
                }
            }
        }

        return $triggeredEvents;
    }
}
