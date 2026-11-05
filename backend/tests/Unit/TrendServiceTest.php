<?php

namespace Tests\Unit;

use Tests\TestCase;
use App\Models\User;
use App\Models\Workspace;
use App\Models\Topic;
use App\Models\Mention;
use App\Models\MentionTopicMatch;
use App\Models\Connector;
use App\Services\TrendService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Carbon\Carbon;

class TrendServiceTest extends TestCase
{
    use RefreshDatabase;

    protected Workspace $workspace;
    protected Topic $topic;
    protected TrendService $trendService;

    protected function setUp(): void
    {
        parent::setUp();

        $user = User::create([
            'name' => 'Test User',
            'email' => 'test@pulsescope.id',
            'password' => bcrypt('password'),
        ]);

        $this->workspace = Workspace::create([
            'name' => 'Test Workspace',
            'slug' => 'test-workspace',
            'owner_id' => $user->id,
        ]);

        $this->topic = Topic::create([
            'workspace_id' => $this->workspace->id,
            'name' => 'AI Indonesia',
            'status' => 'active',
            'match_mode' => 'any',
            'language_filters' => ['id'],
            'providers' => ['rss'],
        ]);

        $this->trendService = new TrendService();
    }

    public function test_zero_mentions_yields_minimum_baseline_score(): void
    {
        $result = $this->trendService->computeTopicTrend($this->topic, 24);

        $this->assertEquals($this->topic->id, $result['topic_id']);
        $this->assertEquals(0, $result['sample_count']);
        // Score should be clamped at minimum baseline (e.g. 5.0)
        $this->assertGreaterThanOrEqual(5.0, $result['score']);
        $this->assertLessThanOrEqual(100.0, $result['score']);
        $this->assertArrayHasKey('components', $result);
        $this->assertEquals(0, $result['components']['raw_volume']);
    }

    public function test_high_volume_and_growth_increases_momentum_score(): void
    {
        $now = Carbon::now('Asia/Jakarta');

        $connector = Connector::create([
            'workspace_id' => $this->workspace->id,
            'provider' => 'rss',
            'status' => 'connected',
        ]);

        // Insert 20 mentions in current window
        for ($i = 0; $i < 20; $i++) {
            $mention = Mention::create([
                'workspace_id' => $this->workspace->id,
                'provider' => 'rss',
                'external_id' => "ext_test_{$i}",
                'source_url' => "https://example.com/{$i}",
                'author_name' => "Reporter {$i}",
                'text' => "Konten teknologi AI terkini di Indonesia {$i}",
                'text_normalized' => "konten teknologi ai terkini di indonesia {$i}",
                'language' => 'id',
                'published_at' => $now->copy()->subHours(2),
                'collected_at' => $now,
            ]);

            MentionTopicMatch::create([
                'mention_id' => $mention->id,
                'topic_id' => $this->topic->id,
                'matched_keywords_json' => ['AI'],
            ]);
        }

        $result = $this->trendService->computeTopicTrend($this->topic, 24);

        $this->assertEquals(20, $result['sample_count']);
        $this->assertGreaterThan(25.0, $result['score']);
        $this->assertNotEmpty($result['explanation']);
        $this->assertDatabaseHas('trend_snapshots', [
            'topic_id' => $this->topic->id,
            'sample_count' => 20,
        ]);
    }
}
