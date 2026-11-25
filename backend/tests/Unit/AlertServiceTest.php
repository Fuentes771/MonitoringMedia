<?php

namespace Tests\Unit;

use Tests\TestCase;
use App\Models\User;
use App\Models\Workspace;
use App\Models\Topic;
use App\Models\Mention;
use App\Models\MentionTopicMatch;
use App\Models\SentimentResult;
use App\Models\Alert;
use App\Models\AlertEvent;
use App\Models\Notification;
use App\Services\AlertService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Carbon\Carbon;

class AlertServiceTest extends TestCase
{
    use RefreshDatabase;

    protected Workspace $workspace;
    protected Topic $topic;
    protected Alert $alert;
    protected AlertService $alertService;

    protected function setUp(): void
    {
        parent::setUp();

        $user = User::create([
            'name' => 'Operator User',
            'email' => 'operator@pulsescope.local',
            'password' => bcrypt('password'),
        ]);

        $this->workspace = Workspace::create([
            'name' => 'Alert Intelligence Workspace',
            'slug' => 'alert-intel',
            'owner_id' => $user->id,
        ]);

        $this->topic = Topic::create([
            'workspace_id' => $this->workspace->id,
            'name' => 'Bank Mandiri Digital',
            'status' => 'active',
            'match_mode' => 'any',
            'language_filters' => ['id'],
            'providers' => ['rss'],
        ]);

        $this->alert = Alert::create([
            'workspace_id' => $this->workspace->id,
            'topic_id' => $this->topic->id,
            'name' => 'Lonjakan Isu Negatif',
            'type' => 'negative_surge',
            'threshold_json' => [
                'min_volume' => 5,
                'negative_share_percent' => 30.0,
            ],
            'channels_json' => ['in_app'],
            'cooldown_minutes' => 60,
            'is_active' => true,
        ]);

        $this->alertService = new AlertService();
    }

    public function test_alert_does_not_trigger_below_min_volume(): void
    {
        $events = $this->alertService->evaluateTopicAlerts($this->topic);
        $this->assertCount(0, $events);
        $this->assertDatabaseCount('alert_events', 0);
    }

    public function test_alert_triggers_when_negative_threshold_exceeded(): void
    {
        $now = Carbon::now('Asia/Jakarta');

        // Create 10 mentions: 4 negative (40%), 6 positive (60%)
        for ($i = 0; $i < 10; $i++) {
            $isNeg = $i < 4;
            $mention = Mention::create([
                'workspace_id' => $this->workspace->id,
                'provider' => 'rss',
                'external_id' => "neg_test_{$i}",
                'source_url' => "https://example.com/neg/{$i}",
                'author_name' => "Netizen {$i}",
                'text' => $isNeg ? "Aplikasi sering error dan mengecewakan {$i}" : "Fitur baru sangat bagus dan memuaskan {$i}",
                'text_normalized' => $isNeg ? "aplikasi sering error dan mengecewakan {$i}" : "fitur baru sangat bagus dan memuaskan {$i}",
                'language' => 'id',
                'published_at' => $now->copy()->subHours(1),
                'collected_at' => $now,
            ]);

            MentionTopicMatch::create([
                'mention_id' => $mention->id,
                'topic_id' => $this->topic->id,
                'matched_keywords_json' => ['Bank Mandiri'],
            ]);

            SentimentResult::create([
                'mention_id' => $mention->id,
                'model_name' => 'lexicon_id_v1',
                'label' => $isNeg ? 'negative' : 'positive',
                'confidence' => 0.88,
                'scores_json' => [
                    'positive' => $isNeg ? 0.05 : 0.88,
                    'neutral' => 0.07,
                    'negative' => $isNeg ? 0.88 : 0.05,
                ],
                'analyzed_at' => $now,
            ]);
        }

        $events = $this->alertService->evaluateTopicAlerts($this->topic);

        $this->assertCount(1, $events);
        $this->assertDatabaseCount('alert_events', 1);
        $this->assertDatabaseCount('notifications', 1);

        $event = $events[0];
        $this->assertEquals('open', $event->status);
        $this->assertEquals('high', $event->severity);
        $this->assertEquals(40.0, $event->evidence_json['negative_share_percent']);

        // Check that alert last_triggered_at was updated
        $this->alert->refresh();
        $this->assertNotNull($this->alert->last_triggered_at);

        // Immediate subsequent evaluation should be suppressed by cooldown
        $secondRunEvents = $this->alertService->evaluateTopicAlerts($this->topic);
        $this->assertCount(0, $secondRunEvents);
        // Event count still 1
        $this->assertDatabaseCount('alert_events', 1);
    }

    public function test_ensure_default_alerts_provisions_both_rules_for_new_topic(): void
    {
        $freshTopic = Topic::create([
            'workspace_id' => $this->workspace->id,
            'name' => 'Program Swasembada Pangan',
            'status' => 'active',
            'match_mode' => 'any',
            'providers' => ['rss'],
        ]);

        $this->alertService->evaluateTopicAlerts($freshTopic);

        $this->assertDatabaseHas('alerts', [
            'topic_id' => $freshTopic->id,
            'type' => 'negative_surge',
            'is_active' => true,
        ]);
        $this->assertDatabaseHas('alerts', [
            'topic_id' => $freshTopic->id,
            'type' => 'volume_spike',
            'is_active' => true,
        ]);
    }

    public function test_negative_surge_ignores_bot_and_near_duplicate_noise_and_auto_resolves(): void
    {
        $now = Carbon::now('Asia/Jakarta');

        // 5 bot / near-duplicate negative mentions should NOT trigger alert when organic mentions are positive
        for ($i = 0; $i < 5; $i++) {
            $m = Mention::create([
                'workspace_id' => $this->workspace->id,
                'provider' => 'x',
                'external_id' => "noise_{$i}",
                'author_name' => "@bot_noise_{$i}",
                'text' => "Serangan spam terkoordinasi {$i}",
                'text_normalized' => "serangan spam terkoordinasi {$i}",
                'language' => 'id',
                'is_inauthentic' => $i < 3,
                'inauthentic_score' => $i < 3 ? 0.9 : 0.1,
                'metadata_json' => ['is_near_duplicate' => $i >= 3],
                'published_at' => $now->copy()->subHours(1),
                'collected_at' => $now,
            ]);
            MentionTopicMatch::create(['mention_id' => $m->id, 'topic_id' => $this->topic->id]);
            SentimentResult::create([
                'mention_id' => $m->id,
                'label' => 'negative',
                'confidence' => 0.9,
                'analyzed_at' => $now,
            ]);
        }

        // 5 organic positive mentions -> 0% organic negative -> should NOT trigger negative_surge
        for ($i = 0; $i < 5; $i++) {
            $m = Mention::create([
                'workspace_id' => $this->workspace->id,
                'provider' => 'rss',
                'external_id' => "org_pos_{$i}",
                'author_name' => "Warga {$i}",
                'text' => "Layanan digital sangat membantu {$i}",
                'text_normalized' => "layanan digital sangat membantu {$i}",
                'language' => 'id',
                'published_at' => $now->copy()->subHours(1),
                'collected_at' => $now,
            ]);
            MentionTopicMatch::create(['mention_id' => $m->id, 'topic_id' => $this->topic->id]);
            SentimentResult::create([
                'mention_id' => $m->id,
                'label' => 'positive',
                'confidence' => 0.9,
                'analyzed_at' => $now,
            ]);
        }

        $eventsBefore = $this->alertService->evaluateTopicAlerts($this->topic);
        $this->assertCount(0, $eventsBefore);

        // Now add 4 organic negative mentions -> 4/9 organic = 44.4% >= 30% -> should trigger!
        for ($i = 0; $i < 4; $i++) {
            $m = Mention::create([
                'workspace_id' => $this->workspace->id,
                'provider' => 'rss',
                'external_id' => "org_neg_{$i}",
                'author_name' => "Nasabah {$i}",
                'text' => "Gangguan sistem menghambat transaksi {$i}",
                'text_normalized' => "gangguan sistem menghambat transaksi {$i}",
                'language' => 'id',
                'published_at' => $now->copy()->subHours(1),
                'collected_at' => $now,
            ]);
            MentionTopicMatch::create(['mention_id' => $m->id, 'topic_id' => $this->topic->id]);
            SentimentResult::create([
                'mention_id' => $m->id,
                'label' => 'negative',
                'confidence' => 0.88,
                'analyzed_at' => $now,
            ]);
        }

        $eventsTriggered = $this->alertService->evaluateTopicAlerts($this->topic);
        $this->assertCount(1, $eventsTriggered);
        $this->assertEquals(3, $eventsTriggered[0]->evidence_json['inauthentic_filtered_count']);
        $this->assertEquals(2, $eventsTriggered[0]->evidence_json['near_duplicate_filtered_count']);
        $this->assertEquals(9, $eventsTriggered[0]->evidence_json['organic_sample_count']);

        // Add 6 more organic positive mentions -> 4/15 = 26.7% < 30% -> should auto-resolve!
        for ($i = 5; $i < 11; $i++) {
            $m = Mention::create([
                'workspace_id' => $this->workspace->id,
                'provider' => 'rss',
                'external_id' => "org_pos_{$i}",
                'author_name' => "Warga {$i}",
                'text' => "Perbaikan berjalan lancar {$i}",
                'text_normalized' => "perbaikan berjalan lancar {$i}",
                'language' => 'id',
                'published_at' => $now->copy()->subMinutes(30),
                'collected_at' => $now,
            ]);
            MentionTopicMatch::create(['mention_id' => $m->id, 'topic_id' => $this->topic->id]);
            SentimentResult::create([
                'mention_id' => $m->id,
                'label' => 'positive',
                'confidence' => 0.9,
                'analyzed_at' => $now,
            ]);
        }

        $this->alertService->evaluateTopicAlerts($this->topic);
        $resolvedEvent = $eventsTriggered[0]->fresh();
        $this->assertEquals('resolved', $resolvedEvent->status);
        $this->assertNotNull($resolvedEvent->resolved_at);
        $this->assertTrue((bool) ($resolvedEvent->evidence_json['auto_resolved'] ?? false));
    }

    public function test_volume_spike_rule_triggers_against_baseline(): void
    {
        $now = Carbon::now('Asia/Jakarta');

        Alert::create([
            'workspace_id' => $this->workspace->id,
            'topic_id' => $this->topic->id,
            'type' => 'volume_spike',
            'threshold_json' => [
                'min_volume' => 5,
                'spike_multiplier' => 2.0,
            ],
            'cooldown_minutes' => 60,
            'is_active' => true,
        ]);

        // 6 baseline mentions over days -6 to -2 (baseline daily avg = 1.0)
        for ($i = 0; $i < 6; $i++) {
            $m = Mention::create([
                'workspace_id' => $this->workspace->id,
                'provider' => 'rss',
                'external_id' => "base_{$i}",
                'text' => "Berita reguler harian {$i}",
                'text_normalized' => "berita reguler harian {$i}",
                'language' => 'id',
                'published_at' => $now->copy()->subDays(2 + ($i % 4)),
                'collected_at' => $now,
            ]);
            MentionTopicMatch::create(['mention_id' => $m->id, 'topic_id' => $this->topic->id]);
            SentimentResult::create(['mention_id' => $m->id, 'label' => 'neutral', 'confidence' => 0.8, 'analyzed_at' => $now]);
        }

        // 5 mentions in last 24h (5.0x baseline daily avg >= 2.0) all positive so only volume_spike triggers
        for ($i = 0; $i < 5; $i++) {
            $m = Mention::create([
                'workspace_id' => $this->workspace->id,
                'provider' => 'youtube',
                'external_id' => "spike_{$i}",
                'text' => "Video viral bahas topik {$i}",
                'text_normalized' => "video viral bahas topik {$i}",
                'language' => 'id',
                'published_at' => $now->copy()->subHours(2),
                'collected_at' => $now,
            ]);
            MentionTopicMatch::create(['mention_id' => $m->id, 'topic_id' => $this->topic->id]);
            SentimentResult::create(['mention_id' => $m->id, 'label' => 'positive', 'confidence' => 0.85, 'analyzed_at' => $now]);
        }

        $events = $this->alertService->evaluateTopicAlerts($this->topic);
        $this->assertCount(1, $events);
        $this->assertEquals(5.0, $events[0]->evidence_json['actual_multiplier']);
        $this->assertEquals(5, $events[0]->evidence_json['current_24h_volume']);
    }
}

