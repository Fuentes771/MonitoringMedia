<?php

namespace Tests\Feature;

use App\Models\Mention;
use App\Models\SentimentResult;
use App\Models\User;
use App\Models\Workspace;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MentionFilteringTest extends TestCase
{
    use RefreshDatabase;

    protected Workspace $workspace;

    protected function setUp(): void
    {
        parent::setUp();

        $user = User::create([
            'name' => 'Operator ZeroTouch',
            'email' => 'zerotouch@pulsescope.id',
            'password' => bcrypt('password'),
        ]);

        $this->workspace = Workspace::create([
            'name' => 'ZeroTouch Intelligence',
            'slug' => 'zerotouch-intel',
            'owner_id' => $user->id,
        ]);

        Sanctum::actingAs($user);

        $now = Carbon::now('Asia/Jakarta');

        $organic = Mention::create([
            'workspace_id' => $this->workspace->id,
            'provider' => 'x',
            'external_id' => 'm_org_1',
            'source_url' => 'https://x.com/warga_asli/status/101',
            'author_name' => '@warga_asli',
            'text' => 'Program bantuan berjalan baik di lapangan.',
            'text_normalized' => 'program bantuan berjalan baik di lapangan.',
            'language' => 'id',
            'is_inauthentic' => false,
            'metadata_json' => ['is_near_duplicate' => false],
            'published_at' => $now->copy()->subMinutes(15),
            'collected_at' => $now,
        ]);
        SentimentResult::create([
            'mention_id' => $organic->id,
            'label' => 'positive',
            'confidence' => 0.9,
            'analyzed_at' => $now,
        ]);

        $nearDup = Mention::create([
            'workspace_id' => $this->workspace->id,
            'provider' => 'x',
            'external_id' => 'm_dup_1',
            'source_url' => 'https://x.com/akun_kedua/status/102',
            'author_name' => '@akun_kedua',
            'text' => 'Program bantuan berjalan baik di lapangan!!',
            'text_normalized' => 'program bantuan berjalan baik di lapangan!!',
            'language' => 'id',
            'is_inauthentic' => false,
            'metadata_json' => [
                'is_near_duplicate' => true,
                'near_duplicate_of_id' => $organic->id,
            ],
            'published_at' => $now->copy()->subMinutes(10),
            'collected_at' => $now,
        ]);
        SentimentResult::create([
            'mention_id' => $nearDup->id,
            'label' => 'positive',
            'confidence' => 0.9,
            'analyzed_at' => $now,
        ]);

        $botCluster = Mention::create([
            'workspace_id' => $this->workspace->id,
            'provider' => 'tiktok',
            'external_id' => 'm_bot_1',
            'source_url' => 'https://tiktok.com/@bot99/video/202',
            'author_name' => '@bot_kampanye99',
            'text' => 'Kawal terus kebijakan unggulan tanpa kompromi #fyp',
            'text_normalized' => 'kawal terus kebijakan unggulan tanpa kompromi #fyp',
            'language' => 'id',
            'is_inauthentic' => true,
            'inauthentic_score' => 0.88,
            'bot_cluster_id' => 'cp_a1b2c3d4',
            'metadata_json' => ['is_near_duplicate' => true],
            'published_at' => $now->copy()->subMinutes(5),
            'collected_at' => $now,
        ]);
        SentimentResult::create([
            'mention_id' => $botCluster->id,
            'label' => 'neutral',
            'confidence' => 0.72,
            'analyzed_at' => $now,
        ]);
    }

    public function test_exclude_near_duplicates_hides_duplicates_and_reports_meta_counts(): void
    {
        $res = $this->getJson("/api/v1/mentions?workspace_id={$this->workspace->id}&exclude_near_duplicates=1");

        $res->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.author_name', '@warga_asli')
            ->assertJsonPath('data.0.is_near_duplicate', false)
            ->assertJsonPath('meta_counts.hidden_near_duplicates', 2)
            ->assertJsonPath('meta_counts.total_near_duplicates', 2);

        $all = $this->getJson("/api/v1/mentions?workspace_id={$this->workspace->id}");
        $all->assertStatus(200)
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('meta_counts.hidden_near_duplicates', 0)
            ->assertJsonPath('meta_counts.total_near_duplicates', 2);
    }

    public function test_drilldown_filters_by_bot_cluster_and_author_name(): void
    {
        $clusterRes = $this->getJson("/api/v1/mentions?workspace_id={$this->workspace->id}&bot_cluster_id=cp_a1b2c3d4");
        $clusterRes->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.bot_cluster_id', 'cp_a1b2c3d4')
            ->assertJsonPath('data.0.author_name', '@bot_kampanye99');

        $authorRes = $this->getJson("/api/v1/mentions?workspace_id={$this->workspace->id}&author_name=@akun_kedua");
        $authorRes->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.author_name', '@akun_kedua')
            ->assertJsonPath('data.0.is_near_duplicate', true);
    }
}

