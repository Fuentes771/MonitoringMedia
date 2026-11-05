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
            'name' => 'Analyst User',
            'email' => 'analyst@pulsescope.id',
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
}
