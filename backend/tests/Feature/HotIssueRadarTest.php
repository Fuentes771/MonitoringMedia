<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Workspace;
use App\Models\Topic;
use App\Models\Mention;
use App\Models\MentionTopicMatch;
use App\Models\SentimentResult;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Carbon\Carbon;
use Laravel\Sanctum\Sanctum;

class HotIssueRadarTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected Workspace $workspace;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'name' => 'Operator Intelijen',
            'email' => 'operator@pulsescope.local',
            'password' => bcrypt('password'),
        ]);

        $this->workspace = Workspace::create([
            'name' => 'Pulse Intelligence Hub',
            'slug' => 'pulsescope-hub',
            'owner_id' => $this->user->id,
        ]);

        Sanctum::actingAs($this->user);
    }

    public function test_hot_issues_endpoint_returns_surging_data(): void
    {
        $now = Carbon::now('Asia/Jakarta');

        $hotTopic = Topic::create([
            'workspace_id' => $this->workspace->id,
            'name' => 'Dugaan Penyadapan Istana',
            'category' => 'trending_issue',
            'urgency_level' => 'critical',
            'surge_detected_at' => $now->copy()->subHours(4),
            'status' => 'active',
        ]);

        $mention = Mention::create([
            'workspace_id' => $this->workspace->id,
            'provider' => 'x',
            'external_id' => 'x_surge_test_1',
            'source_url' => 'https://x.com/test/status/1',
            'author_name' => '@test_account',
            'published_at' => $now->copy()->subHours(2),
            'collected_at' => $now,
            'text' => 'Penyadapan komunikasi presiden jadi isu panas hari ini.',
            'text_normalized' => 'penyadapan komunikasi presiden jadi isu panas hari ini.',
            'language' => 'id',
            'metadata_json' => ['is_comment' => false, 'likes' => 150],
        ]);

        MentionTopicMatch::create([
            'mention_id' => $mention->id,
            'topic_id' => $hotTopic->id,
        ]);

        SentimentResult::create([
            'mention_id' => $mention->id,
            'label' => 'negative',
            'confidence' => 0.92,
            'analyzed_at' => $now,
        ]);

        $response = $this->getJson('/api/v1/hot-issues?workspace_id=' . $this->workspace->id);

        $response->assertStatus(200);
        $response->assertJson([
            'status' => 'success',
            'data' => [
                'system_state' => 'surging_detected',
            ],
        ]);

        $issues = $response->json('data.hot_issues');
        $this->assertCount(1, $issues);
        $this->assertEquals('Dugaan Penyadapan Istana', $issues[0]['title']);
        $this->assertEquals('critical', $issues[0]['urgency_level']);
        $this->assertGreaterThan(0, $issues[0]['surge_multiplier']);
        $this->assertNotEmpty($issues[0]['netizen_quotes']);
    }

    public function test_create_hot_issue_via_post_endpoint(): void
    {
        $payload = [
            'workspace_id' => $this->workspace->id,
            'name' => 'Erupsi Gunung Lewotobi NTT',
            'description' => 'Evakuasi warga terdampak abu vulkanik di Flores Timur.',
            'urgency_level' => 'critical',
            'keywords' => ['gunung lewotobi', 'erupsi lewotobi', 'evakuasi flores timur'],
        ];

        $response = $this->postJson('/api/v1/hot-issues', $payload);

        $response->assertStatus(201);
        $response->assertJson([
            'status' => 'success',
            'data' => [
                'name' => 'Erupsi Gunung Lewotobi NTT',
                'category' => 'trending_issue',
                'urgency_level' => 'critical',
            ],
        ]);

        $this->assertDatabaseHas('topics', [
            'name' => 'Erupsi Gunung Lewotobi NTT',
            'category' => 'trending_issue',
        ]);
    }

    public function test_topic_category_scopes(): void
    {
        Topic::create([
            'workspace_id' => $this->workspace->id,
            'name' => 'Makan Bergizi Gratis',
            'category' => 'national_program',
            'status' => 'active',
        ]);

        Topic::create([
            'workspace_id' => $this->workspace->id,
            'name' => 'Isu Viral Medsos',
            'category' => 'trending_issue',
            'status' => 'active',
        ]);

        $this->assertEquals(1, Topic::nationalPrograms()->count());
        $this->assertEquals(1, Topic::trendingIssues()->count());
    }
}

