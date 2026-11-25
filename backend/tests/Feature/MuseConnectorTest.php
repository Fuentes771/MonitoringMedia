<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Connector;
use App\Models\IngestionRun;
use App\Models\Mention;
use App\Models\Topic;
use App\Models\TrendSnapshot;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\RateLimiter;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MuseConnectorTest extends TestCase
{
    use RefreshDatabase;

    private const VALID_KEY = 'muse-secret-test-key-001';
    private const ROTATED_KEY = 'muse-secret-test-key-002';

    protected User $operator;
    protected Workspace $workspace;
    protected Topic $kopdesTopic;
    protected Topic $febrieTopic;

    protected function setUp(): void
    {
        parent::setUp();

        $this->operator = User::create([
            'name' => 'Operator TRINETRA',
            'email' => 'operator@pulsescope.local',
            'password' => bcrypt('password'),
        ]);

        $this->workspace = Workspace::create([
            'name' => 'PulseScope Intelligence Hub',
            'slug' => 'pulsescope-hub',
            'owner_id' => $this->operator->id,
        ]);

        WorkspaceMember::create([
            'workspace_id' => $this->workspace->id,
            'user_id' => $this->operator->id,
            'role' => WorkspaceMember::ROLE,
        ]);

        $this->kopdesTopic = Topic::create([
            'workspace_id' => $this->workspace->id,
            'external_key' => 'top_kopdes_001',
            'name' => 'Koperasi Desa/Kelurahan Merah Putih',
            'category' => 'national_program',
            'urgency_level' => 'normal',
            'status' => 'active',
            'match_mode' => 'any',
            'providers' => ['rss', 'youtube', 'threads', 'facebook', 'instagram'],
            'collect_interval_minutes' => 60,
        ]);
        foreach (['Koperasi Desa Merah Putih', 'Kopdes Merah Putih', 'KDMP'] as $kw) {
            $this->kopdesTopic->keywords()->create(['keyword' => $kw, 'type' => 'include']);
        }

        $this->febrieTopic = Topic::create([
            'workspace_id' => $this->workspace->id,
            'external_key' => 'top_febrie_001',
            'name' => 'Febrie Adriansyah ex Jampidsus',
            'category' => 'trending_issue',
            'urgency_level' => 'critical',
            'status' => 'active',
            'match_mode' => 'any',
            'providers' => ['threads', 'facebook', 'instagram'],
            'collect_interval_minutes' => 30,
        ]);
        foreach (['Febrie Adriansyah', 'Febrie Kejaksaan', 'Febrie TPPU'] as $kw) {
            $this->febrieTopic->keywords()->create(['keyword' => $kw, 'type' => 'include']);
        }

        Config::set('services.muse.api_keys', [self::VALID_KEY, self::ROTATED_KEY]);
        Config::set('services.muse.workspace_id', $this->workspace->id);
        Config::set('services.muse.ingest_rate_limit', 10);

        RateLimiter::clear('muse-ingest:' . hash('sha256', self::VALID_KEY));
        RateLimiter::clear('muse-ingest:' . hash('sha256', self::ROTATED_KEY));
    }

    public function test_health_endpoint_is_public_and_returns_wib_timestamp(): void
    {
        $res = $this->getJson('/api/v1/health');

        $res->assertStatus(200)
            ->assertJson([
                'status' => 'ok',
                'service' => 'TRINETRA API',
                'version' => 'v1',
                'timezone' => 'Asia/Jakarta',
                'database' => 'ok',
                'muse_configured' => true,
            ]);
        $this->assertStringContainsString('+07:00', (string) $res->json('timestamp'));
    }

    public function test_muse_endpoints_require_valid_api_key(): void
    {
        // Missing header -> 401
        $this->getJson('/api/v1/topics/active')->assertStatus(401);
        $this->postJson('/api/v1/ingest/mentions', ['mentions' => []])->assertStatus(401);

        // Wrong key -> 403
        $this->withHeader('X-TRINETRA-API-KEY', 'wrong-key')
            ->getJson('/api/v1/topics/active')
            ->assertStatus(403);

        // Valid primary key -> 200
        $this->withHeader('X-TRINETRA-API-KEY', self::VALID_KEY)
            ->getJson('/api/v1/topics/active')
            ->assertStatus(200);

        // Valid rotated secondary key -> 200
        $this->withHeader('X-TRINETRA-API-KEY', self::ROTATED_KEY)
            ->getJson('/api/v1/topics/active')
            ->assertStatus(200);
    }

    public function test_active_topics_returns_only_active_meta_enabled_topics(): void
    {
        // Paused topic should not appear
        Topic::create([
            'workspace_id' => $this->workspace->id,
            'name' => 'Topik Dijeda',
            'status' => 'paused',
            'providers' => ['threads', 'facebook'],
        ]);

        // RSS-only active topic should not appear
        Topic::create([
            'workspace_id' => $this->workspace->id,
            'name' => 'Topik Khusus RSS',
            'status' => 'active',
            'providers' => ['rss', 'youtube'],
        ]);

        $res = $this->withHeader('X-TRINETRA-API-KEY', self::VALID_KEY)
            ->getJson('/api/v1/topics/active');

        $res->assertStatus(200);
        $topics = $res->json('topics');

        $this->assertCount(2, $topics);
        // Critical trending issue comes first (priority 95 > 80)
        $this->assertEquals('top_febrie_001', $topics[0]['topic_id']);
        $this->assertEquals(30, $topics[0]['collect_interval_minutes']);
        $this->assertEquals(['threads', 'facebook', 'instagram'], $topics[0]['platforms']);
        $this->assertContains('Febrie Adriansyah', $topics[0]['keywords']);

        $this->assertEquals('top_kopdes_001', $topics[1]['topic_id']);
        $this->assertEquals(60, $topics[1]['collect_interval_minutes']);
        $this->assertEquals(['threads', 'facebook', 'instagram'], $topics[1]['platforms']);
    }

    public function test_ingest_is_idempotent_validates_items_and_feeds_existing_dashboard_pipeline(): void
    {
        $this->fakeNlpBatchService();

        $payload = [
            'source' => 'muse-connector',
            'collected_at' => '2026-11-25T11:13:46+07:00',
            'topic_id' => 'top_febrie_001',
            'mentions' => [
                [
                    'platform' => 'threads',
                    'platform_post_id' => '18446101459181119',
                    'platform_post_code' => 'DgHYtzLkaaT',
                    'url' => 'https://www.threads.com/@bkmedan_/post/DgHYtzLkaaT',
                    'author_username' => 'bkmedan_',
                    'author_display_name' => 'Medan | BK Medan | Berita Medan',
                    'author_follower_count' => null,
                    'author_is_verified' => false,
                    'author_profile_url' => 'https://www.threads.net/@bkmedan_',
                    'posted_at' => now('Asia/Jakarta')->subHours(2)->toIso8601String(),
                    'text' => 'Mantan Jampidsus Febrie Adriansyah menyatakan kasus TPPU yang menjeratnya merupakan kriminalisasi.',
                    'media_type' => 'video',
                    'like_count' => 37,
                    'comment_count' => 5,
                    'repost_count' => 6,
                    'quote_count' => 1,
                    'language' => 'id',
                    'raw_source' => 'threads-cli search',
                    'collector_note' => 'contoh dari spec',
                ],
                [
                    'platform' => 'instagram',
                    'platform_post_id' => 'ig_media_990011',
                    'url' => 'https://www.instagram.com/p/De8TYP6lIm4/',
                    'author_username' => 'warga_media',
                    'posted_at' => now('Asia/Jakarta')->subHour()->toIso8601String(),
                    'text' => '',
                    'media_type' => 'video', // empty caption allowed for video
                    'like_count' => 12,
                    'comment_count' => 2,
                    'raw_source' => 'instagram-cli post',
                ],
                [
                    'platform' => 'tiktok', // disallowed by spec allowlist
                    'platform_post_id' => 'bad_01',
                    'url' => 'https://www.tiktok.com/@a/video/1234567890123456789',
                    'posted_at' => now('Asia/Jakarta')->toIso8601String(),
                    'text' => 'Seharusnya ditolak karena platform tidak masuk allowlist Muse Fase 1.',
                ],
            ],
        ];

        // First ingest: 2 accepted, 0 duplicates, 1 rejected
        $first = $this->withHeader('X-TRINETRA-API-KEY', self::VALID_KEY)
            ->postJson('/api/v1/ingest/mentions', $payload);

        $first->assertStatus(200)
            ->assertJson([
                'status' => 'success',
                'accepted' => 2,
                'duplicates_skipped' => 0,
                'rejected' => 1,
            ]);
        $this->assertNotEmpty($first->json('ingest_id'));
        $this->assertCount(1, $first->json('errors'));
        $this->assertEquals(2, Mention::count());

        // Second ingest with identical batch: 0 accepted, 2 duplicates_skipped, DB row count unchanged
        $second = $this->withHeader('X-TRINETRA-API-KEY', self::VALID_KEY)
            ->postJson('/api/v1/ingest/mentions', $payload);

        $second->assertStatus(200)
            ->assertJson([
                'status' => 'success',
                'accepted' => 0,
                'duplicates_skipped' => 2,
                'rejected' => 1,
            ]);
        $this->assertEquals(2, Mention::count());

        // Verify existing TRINETRA analytics & telemetry were triggered automatically
        $threadsMention = Mention::where('provider', 'threads')
            ->where('external_id', '18446101459181119')
            ->with(['sentiment', 'keywords', 'topics'])
            ->firstOrFail();

        $this->assertEquals('verified_post', $threadsMention->metadata_json['link_status']);
        $this->assertEquals('muse-connector', $threadsMention->metadata_json['ingestion_source']);
        $this->assertEquals(37, $threadsMention->metadata_json['metrics']['likes']);
        $this->assertEquals(6, $threadsMention->metadata_json['metrics']['shares']);
        $this->assertEquals('negative', $threadsMention->sentiment?->label);
        $this->assertTrue($threadsMention->topics->contains('id', $this->febrieTopic->id));
        $this->assertNotNull($this->febrieTopic->fresh()->last_collected_at);
        $this->assertGreaterThan(0, TrendSnapshot::where('topic_id', $this->febrieTopic->id)->count());
        $this->assertGreaterThan(0, IngestionRun::count());

        $threadsConnector = Connector::where('workspace_id', $this->workspace->id)
            ->where('provider', 'threads')
            ->firstOrFail();
        $this->assertEquals('connected', $threadsConnector->status);
        $this->assertNotNull($threadsConnector->last_successful_sync_at);

        // Verify ingested data immediately shows up on existing operator Dashboard, Mentions, and Buzzer Radar endpoints
        Sanctum::actingAs($this->operator);

        $overview = $this->getJson("/api/v1/dashboard/overview?workspace_id={$this->workspace->id}&days=7");
        $overview->assertStatus(200);
        $this->assertEquals(1, $overview->json('platform_breakdown.threads'));
        $this->assertEquals(1, $overview->json('platform_breakdown.instagram'));

        $mentionsThreads = $this->getJson("/api/v1/mentions?workspace_id={$this->workspace->id}&provider=threads");
        $mentionsThreads->assertStatus(200);
        $this->assertCount(1, $mentionsThreads->json('data'));
        $this->assertEquals('muse-connector', $mentionsThreads->json('data.0.ingestion_source'));

        $mentionsSocial = $this->getJson("/api/v1/mentions?workspace_id={$this->workspace->id}&provider=social");
        $mentionsSocial->assertStatus(200);
        $this->assertCount(2, $mentionsSocial->json('data'));

        $radar = $this->getJson("/api/v1/buzzer-radar/overview?workspace_id={$this->workspace->id}&days=7");
        $radar->assertStatus(200);
        $this->assertEquals(2, $radar->json('data.authenticity_index.total_mentions'));
    }

    public function test_ingest_rate_limit_returns_429_with_retry_after_on_11th_request(): void
    {
        $this->fakeNlpBatchService();

        for ($i = 1; $i <= 10; $i++) {
            $res = $this->withHeader('X-TRINETRA-API-KEY', self::VALID_KEY)
                ->postJson('/api/v1/ingest/mentions', [
                    'source' => 'muse-connector',
                    'topic_id' => (string) $this->kopdesTopic->id, // numeric ID also accepted
                    'mentions' => [
                        [
                            'platform' => 'threads',
                            'platform_post_id' => "rate_test_{$i}",
                            'url' => "https://www.threads.com/@warga/post/RateTest{$i}ab",
                            'author_username' => 'warga',
                            'posted_at' => now('Asia/Jakarta')->toIso8601String(),
                            'text' => "Koperasi Desa Merah Putih laporan ke-{$i}.",
                        ],
                    ],
                ]);
            $res->assertStatus(200);
        }

        $eleventh = $this->withHeader('X-TRINETRA-API-KEY', self::VALID_KEY)
            ->postJson('/api/v1/ingest/mentions', [
                'source' => 'muse-connector',
                'topic_id' => 'top_kopdes_001',
                'mentions' => [
                    [
                        'platform' => 'threads',
                        'platform_post_id' => 'rate_test_11',
                        'url' => 'https://www.threads.com/@warga/post/RateTest11ab',
                        'author_username' => 'warga',
                        'posted_at' => now('Asia/Jakarta')->toIso8601String(),
                        'text' => 'Koperasi Desa Merah Putih laporan ke-11.',
                    ],
                ],
            ]);

        $eleventh->assertStatus(429);
        $this->assertTrue($eleventh->headers->has('Retry-After'));
    }

    public function test_collector_status_and_takedown_delete_and_connector_controller_muse_mode(): void
    {
        $this->fakeNlpBatchService();

        $this->withHeader('X-TRINETRA-API-KEY', self::VALID_KEY)
            ->postJson('/api/v1/ingest/mentions', [
                'source' => 'muse-connector',
                'topic_id' => 'top_kopdes_001',
                'mentions' => [
                    [
                        'platform' => 'threads',
                        'platform_post_id' => '18147271879581204',
                        'url' => 'https://www.threads.com/@realemo87/post/DgAbCdEfGh1',
                        'author_username' => 'realemo87',
                        'posted_at' => '2026-11-25T11:02:18+07:00',
                        'text' => 'Koperasi Desa Merah Putih sangat membantu petani desa.',
                        'raw_source' => 'threads-cli search',
                    ],
                ],
            ])
            ->assertStatus(200);

        // Collector status endpoint
        $status = $this->withHeader('X-TRINETRA-API-KEY', self::VALID_KEY)
            ->getJson('/api/v1/collector/status');

        $status->assertStatus(200)
            ->assertJson([
                'status' => 'ok',
                'mode' => 'muse_push',
                'active_topics_count' => 2,
                'rate_limit_per_minute' => 10,
            ]);
        $this->assertEquals(1, $status->json('platforms.threads.total_mentions'));
        $this->assertNotEmpty($status->json('recent_runs'));

        $syncIso = (string) $status->json('platforms.threads.last_successful_sync_at');
        $this->assertStringContainsString('+07:00', $syncIso);
        $this->assertLessThanOrEqual(
            120,
            abs(\Carbon\Carbon::parse($syncIso)->diffInSeconds(\Carbon\Carbon::now('Asia/Jakarta')))
        );

        // ConnectorController shows muse_push for Meta platforms & blocks local live-preview
        Sanctum::actingAs($this->operator);
        $connectorsResp = $this->getJson("/api/v1/connectors?workspace_id={$this->workspace->id}")
            ->assertStatus(200);
        $connectorsByProvider = collect($connectorsResp->json('data'))->keyBy('provider');
        $this->assertEquals('muse_push', $connectorsByProvider['threads']['engine_mode']);
        $this->assertEquals('muse_push', $connectorsByProvider['facebook']['engine_mode']);
        $this->assertEquals('muse_push', $connectorsByProvider['instagram']['engine_mode']);
        $this->assertEquals('connected', $connectorsByProvider['threads']['status']);

        $this->postJson('/api/v1/connectors/threads/test', ['workspace_id' => $this->workspace->id])
            ->assertStatus(200)
            ->assertJson(['status' => 'success', 'engine' => 'muse_push']);

        $this->postJson('/api/v1/connectors/instagram/live-preview', ['workspace_id' => $this->workspace->id])
            ->assertStatus(400);

        // Compliance takedown DELETE endpoint
        $del = $this->withHeader('X-TRINETRA-API-KEY', self::VALID_KEY)
            ->deleteJson('/api/v1/ingest/mentions/threads/18147271879581204', [
                'reason' => 'Permintaan takedown pemilik konten',
            ]);

        $del->assertStatus(200)
            ->assertJson([
                'status' => 'success',
                'data' => [
                    'platform' => 'threads',
                    'platform_post_id' => '18147271879581204',
                ],
            ]);

        $this->assertDatabaseMissing('mentions', [
            'provider' => 'threads',
            'external_id' => '18147271879581204',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'workspace_id' => $this->workspace->id,
            'action' => 'muse_takedown_delete',
        ]);

        // Second delete returns 404
        $this->withHeader('X-TRINETRA-API-KEY', self::VALID_KEY)
            ->deleteJson('/api/v1/ingest/mentions/threads/18147271879581204')
            ->assertStatus(404);
    }

    private function fakeNlpBatchService(): void
    {
        Http::fake([
            '*/batch-analyze' => function ($request) {
                $results = [];
                foreach ($request->data()['items'] as $item) {
                    $text = strtolower((string) ($item['text'] ?? ''));
                    $isNeg = str_contains($text, 'kriminalisasi') || str_contains($text, 'tppu');
                    $results[] = [
                        'id' => $item['id'],
                        'sentiment' => [
                            'label' => $isNeg ? 'negative' : 'positive',
                            'confidence' => 0.89,
                            'probabilities' => $isNeg
                                ? ['positive' => 0.04, 'neutral' => 0.07, 'negative' => 0.89]
                                : ['positive' => 0.85, 'neutral' => 0.10, 'negative' => 0.05],
                            'is_sarcasm' => false,
                            'sarcasm_score' => 0.0,
                            'aspect' => 'hukum',
                            'key_reason' => 'Analisis batch otomatis',
                            'urgency' => $isNeg ? 'high' : 'low',
                        ],
                        'keywords' => [
                            ['keyword' => $isNeg ? 'kriminalisasi' : 'koperasi desa', 'score' => 1.0],
                        ],
                        'bot_analysis' => [
                            'is_inauthentic' => false,
                            'inauthentic_score' => 0.08,
                            'bot_signals' => [],
                        ],
                    ];
                }

                return Http::response(['results' => $results], 200);
            },
        ]);
    }
}
