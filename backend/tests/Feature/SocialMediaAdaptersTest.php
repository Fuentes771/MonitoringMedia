<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Workspace;
use App\Models\Topic;
use App\Models\Connector;
use App\Adapters\XProviderAdapter;
use App\Adapters\TikTokProviderAdapter;
use App\Adapters\InstagramProviderAdapter;
use App\Adapters\FacebookProviderAdapter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Config;
use Laravel\Sanctum\Sanctum;

class SocialMediaAdaptersTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected Workspace $workspace;
    protected Topic $topic;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'name' => 'Test User',
            'email' => 'test@pulsescope.local',
            'password' => bcrypt('password'),
        ]);

        $this->workspace = Workspace::create([
            'name' => 'Pulse Intelligence Lab',
            'slug' => 'pulse-lab',
            'owner_id' => $this->user->id,
        ]);

        Sanctum::actingAs($this->user);

        $this->topic = Topic::create([
            'workspace_id' => $this->workspace->id,
            'name' => 'Makan Bergizi Gratis',
            'status' => 'active',
            'match_mode' => 'any',
            'providers' => ['x', 'tiktok', 'instagram', 'facebook'],
        ]);

        $this->topic->keywords()->create([
            'keyword' => 'MBG',
            'type' => 'include',
        ]);
    }

    public function test_adapters_return_needs_config_without_api_key(): void
    {
        Config::set('services.rapidapi.key', null);

        $mockLocal = $this->createMock(\App\Services\LocalScraperService::class);
        $mockLocal->method('scrape')->willReturn([]);
        $this->app->instance(\App\Services\LocalScraperService::class, $mockLocal);

        $xAdapter = new XProviderAdapter();
        $ttAdapter = new TikTokProviderAdapter();
        $igAdapter = new InstagramProviderAdapter();
        $fbAdapter = new FacebookProviderAdapter();

        $resX = $xAdapter->fetch($this->topic);
        $this->assertFalse($resX->isSuccess());
        $this->assertEquals('NEEDS_CONFIGURATION', $resX->errorCode);

        $resTT = $ttAdapter->fetch($this->topic);
        $this->assertFalse($resTT->isSuccess());
        $this->assertEquals('NEEDS_CONFIGURATION', $resTT->errorCode);

        $resIG = $igAdapter->fetch($this->topic);
        $this->assertFalse($resIG->isSuccess());
        $this->assertEquals('NEEDS_CONFIGURATION', $resIG->errorCode);

        $resFB = $fbAdapter->fetch($this->topic);
        $this->assertFalse($resFB->isSuccess());
        $this->assertEquals('NEEDS_CONFIGURATION', $resFB->errorCode);
    }

    public function test_x_adapter_ingests_tweet_and_comments(): void
    {
        Config::set('services.rapidapi.key', 'test-rapid-key');

        $mockLocal = $this->createMock(\App\Services\LocalScraperService::class);
        $mockLocal->method('scrape')->willReturn([]);
        $this->app->instance(\App\Services\LocalScraperService::class, $mockLocal);

        Http::fake([
            'https://twitter154.p.rapidapi.com/*' => Http::response([
                'results' => [
                    [
                        'tweet_id' => '1234567890',
                        'text' => 'Program MBG Makan Bergizi Gratis diuji coba di 5 sekolah hari ini.',
                        'user' => ['username' => 'media_nasional', 'name' => 'Media Nasional'],
                        'creation_date' => '2026-11-09 10:00:00',
                        'retweet_count' => 15,
                        'favorite_count' => 120,
                        'replies' => [
                            [
                                'tweet_id' => '99887766',
                                'text' => 'Bagus sekali program ini sangat membantu gizi anak sekolah.',
                                'user' => ['username' => 'warga_netizen'],
                                'creation_date' => '2026-11-09 10:05:00',
                                'favorite_count' => 8,
                            ],
                        ],
                    ],
                ],
            ], 200),
        ]);

        $adapter = new XProviderAdapter();
        $result = $adapter->fetch($this->topic);

        $this->assertTrue($result->isSuccess());
        $this->assertCount(2, $result->records); // 1 main tweet + 1 comment

        $mainTweet = $result->records[0];
        $this->assertEquals('x', $mainTweet['provider']);
        $this->assertEquals('x_1234567890', $mainTweet['external_id']);
        $this->assertFalse($mainTweet['metadata_json']['is_comment']);

        $comment = $result->records[1];
        $this->assertEquals('x', $comment['provider']);
        $this->assertEquals('x_comment_99887766', $comment['external_id']);
        $this->assertTrue($comment['metadata_json']['is_comment']);
        $this->assertEquals('x_1234567890', $comment['metadata_json']['parent_external_id']);
    }

    public function test_tiktok_adapter_ingests_video_and_comments(): void
    {
        Config::set('services.rapidapi.key', 'test-rapid-key');

        $mockLocal = $this->createMock(\App\Services\LocalScraperService::class);
        $mockLocal->method('scrape')->willReturn([]);
        $this->app->instance(\App\Services\LocalScraperService::class, $mockLocal);

        Http::fake([
            'https://tiktok-scraper7.p.rapidapi.com/*' => Http::response([
                'data' => [
                    'videos' => [
                        [
                            'video_id' => '71882991029',
                            'title' => 'Menu makan bergizi gratis hari ini ayam dan sayur enak banget! #MBG',
                            'author' => ['unique_id' => 'siswa_smp'],
                            'create_time' => 1731124800,
                            'digg_count' => 500,
                            'comments' => [
                                [
                                    'cid' => '888123',
                                    'text' => 'Semoga menunya konsisten bergizi terus ya!',
                                    'user' => ['nickname' => 'ibu_budi'],
                                    'create_time' => 1731125000,
                                    'digg_count' => 45,
                                ],
                            ],
                        ],
                    ],
                ],
            ], 200),
        ]);

        $adapter = new TikTokProviderAdapter();
        $result = $adapter->fetch($this->topic);

        $this->assertTrue($result->isSuccess());
        $this->assertCount(2, $result->records);

        $video = $result->records[0];
        $this->assertEquals('tiktok', $video['provider']);
        $this->assertEquals('tiktok_71882991029', $video['external_id']);

        $comment = $result->records[1];
        $this->assertEquals('tiktok', $comment['provider']);
        $this->assertEquals('tiktok_comment_888123', $comment['external_id']);
        $this->assertTrue($comment['metadata_json']['is_comment']);
        $this->assertEquals('tiktok_71882991029', $comment['metadata_json']['parent_external_id']);
    }

    public function test_connector_controller_unified_rapidapi_connect_and_test(): void
    {
        // 1. Post unified rapidapi credential
        $response = $this->postJson('/api/v1/connectors/rapidapi/connect', [
            'workspace_id' => $this->workspace->id,
            'api_key' => 'rapidapi-secret-key-123',
        ]);

        $response->assertStatus(200);
        $response->assertJson(['status' => 'success']);

        // 2. Check that X connector is now connected
        $xConnector = Connector::where('workspace_id', $this->workspace->id)
            ->where('provider', 'x')
            ->first();
        $this->assertNotNull($xConnector);
        $this->assertEquals('connected', $xConnector->status);

        // 3. Test X connector endpoint
        $testRes = $this->postJson('/api/v1/connectors/x/test', [
            'workspace_id' => $this->workspace->id,
        ]);

        $testRes->assertStatus(200);
        $testRes->assertJson([
            'status' => 'success',
            'provider' => 'x',
        ]);
    }

    public function test_x_adapter_uses_local_verified_fallback_when_rapidapi_fails(): void
    {
        Config::set('services.rapidapi.key', 'test-rapid-key');

        $mockLocal = $this->createMock(\App\Services\LocalScraperService::class);
        $mockLocal->method('scrape')->willReturn([
            [
                'id' => 'x_2114676540395135082',
                'provider' => 'x',
                'author_name' => 'Indonesia Level Up (@Indolevelup)',
                'source_url' => 'https://x.com/Indolevelup/status/2114676540395135082',
                'link_status' => 'verified_post',
                'text' => 'Evaluasi distribusi program MBG terus diperkuat.',
                'published_at' => '2026-10-26T11:12:30.000Z',
                'metrics' => ['likes' => 15, 'comments' => 2],
                'metrics_available' => true,
                'is_demo' => false,
                'source' => 'local_enriched',
            ],
        ]);
        $this->app->instance(\App\Services\LocalScraperService::class, $mockLocal);

        Http::fake([
            'https://twitter154.p.rapidapi.com/*' => Http::response(['message' => 'Not subscribed'], 403),
        ]);

        $adapter = new XProviderAdapter();
        $result = $adapter->fetch($this->topic);

        $this->assertTrue($result->isSuccess());
        $this->assertCount(1, $result->records);
        $this->assertEquals('verified_post', $result->records[0]['metadata_json']['link_status']);
        $this->assertNotEmpty($result->records[0]['matched_keywords']);
    }

    public function test_youtube_adapter_falls_back_to_local_without_api_key(): void
    {
        Config::set('services.youtube.api_key', null);
        putenv('YOUTUBE_API_KEY=');

        $mockLocal = $this->createMock(\App\Services\LocalScraperService::class);
        $mockLocal->method('scrape')->with('youtube', $this->anything(), 12)->willReturn([
            [
                'id' => 'yt_aIUWJ9t-Etk',
                'provider' => 'youtube',
                'author_name' => 'Kanal Berita ID',
                'source_url' => 'https://www.youtube.com/watch?v=aIUWJ9t-Etk',
                'link_status' => 'verified_post',
                'text' => 'Diskusi MBG di sekolah daerah',
                'published_at' => '2026-11-10T08:00:00Z',
                'metrics' => ['views' => 45200],
                'metrics_available' => true,
                'is_demo' => false,
                'source' => 'local_enriched',
            ],
        ]);
        $this->app->instance(\App\Services\LocalScraperService::class, $mockLocal);

        $ytAdapter = new \App\Adapters\YouTubeProviderAdapter();
        $result = $ytAdapter->fetch($this->topic);

        $this->assertTrue($result->isSuccess());
        $this->assertCount(1, $result->records);
        $this->assertEquals('https://www.youtube.com/watch?v=aIUWJ9t-Etk', $result->records[0]['source_url']);
        $this->assertEquals('verified_post', $result->records[0]['metadata_json']['link_status']);
    }

    public function test_topic_store_defaults_to_all_news_and_social_providers(): void
    {
        $resp = $this->postJson("/api/v1/workspaces/{$this->workspace->id}/topics", [
            'name' => 'Ketahanan Pangan Nasional',
            'include_keywords' => ['ketahanan pangan'],
        ]);

        $resp->assertStatus(201);
        $providers = $resp->json('data.providers');
        $this->assertContains('rss', $providers);
        $this->assertContains('youtube', $providers);
        $this->assertContains('x', $providers);
        $this->assertContains('tiktok', $providers);
        $this->assertContains('instagram', $providers);
        $this->assertContains('facebook', $providers);
    }

    public function test_repair_social_links_command_purges_synthetic_and_fixes_encoding(): void
    {
        $badMention = \App\Models\Mention::create([
            'workspace_id' => $this->workspace->id,
            'provider' => 'tiktok',
            'external_id' => 'tt_bad_1',
            'source_url' => 'https://www.tiktok.com/post/abcdef123456',
            'author_name' => '@demo',
            'published_at' => now(),
            'collected_at' => now(),
            'text' => 'Link rusak lama',
            'is_demo' => false,
        ]);

        $unencodedSearch = \App\Models\Mention::create([
            'workspace_id' => $this->workspace->id,
            'provider' => 'facebook',
            'external_id' => 'fb_search_legacy',
            'source_url' => 'https://www.facebook.com/search/top?q=Makan Bergizi',
            'author_name' => 'Facebook Search',
            'published_at' => now(),
            'collected_at' => now(),
            'text' => 'Hasil pencarian lama dengan spasi mentah',
            'is_demo' => false,
        ]);

        $this->artisan('social:repair-links', [
            '--purge-synthetic' => true,
            '--fix-encoding' => true,
        ])->assertExitCode(0);

        $this->assertDatabaseMissing('mentions', ['id' => $badMention->id]);
        $unencodedSearch->refresh();
        $this->assertEquals('search_fallback', $unencodedSearch->metadata_json['link_status']);
        $this->assertStringNotContainsString(' ', (string) $unencodedSearch->source_url);
    }

    public function test_mentions_index_supports_social_group_filter_and_link_status(): void
    {
        \App\Models\Mention::create([
            'workspace_id' => $this->workspace->id,
            'provider' => 'rss',
            'external_id' => 'rss_1',
            'source_url' => 'https://news.google.com/rss/articles/abc',
            'author_name' => 'Kompas',
            'published_at' => now(),
            'collected_at' => now(),
            'text' => 'Berita media massa nasional.',
        ]);

        \App\Models\Mention::create([
            'workspace_id' => $this->workspace->id,
            'provider' => 'x',
            'external_id' => 'x_2114676540395135082',
            'source_url' => 'https://x.com/Indolevelup/status/2114676540395135082',
            'author_name' => '@Indolevelup',
            'published_at' => now(),
            'collected_at' => now(),
            'text' => 'Opini publik di media sosial X.',
            'metadata_json' => ['link_status' => 'verified_post'],
        ]);

        $resp = $this->getJson("/api/v1/mentions?workspace_id={$this->workspace->id}&provider=social");
        $resp->assertStatus(200);
        $data = $resp->json('data');
        $this->assertCount(1, $data);
        $this->assertEquals('x', $data[0]['provider']);
        $this->assertEquals('verified_post', $data[0]['link_status']);
    }

    public function test_mentions_index_supports_singular_and_plural_interaction_type_and_verified_link_status(): void
    {
        \App\Models\Mention::create([
            'workspace_id' => $this->workspace->id,
            'provider' => 'youtube',
            'external_id' => 'yt_post_1',
            'source_url' => 'https://www.youtube.com/watch?v=-SkyV8UrRzQ',
            'author_name' => 'Kanal Publik',
            'published_at' => now(),
            'collected_at' => now(),
            'text' => 'Video pembahasan layanan publik.',
            'metadata_json' => ['is_comment' => false, 'link_status' => 'verified_post'],
        ]);

        \App\Models\Mention::create([
            'workspace_id' => $this->workspace->id,
            'provider' => 'youtube',
            'external_id' => 'yt_comment_1',
            'source_url' => 'https://www.youtube.com/watch?v=-SkyV8UrRzQ&lc=Ugz123',
            'author_name' => 'Warga',
            'published_at' => now(),
            'collected_at' => now(),
            'text' => 'Komentar mengenai pelayanan.',
            'metadata_json' => ['is_comment' => true, 'link_status' => 'verified_post'],
        ]);

        \App\Models\Mention::create([
            'workspace_id' => $this->workspace->id,
            'provider' => 'x',
            'external_id' => 'x_search_1',
            'source_url' => 'https://x.com/search?q=pelayanan',
            'author_name' => 'Search',
            'published_at' => now(),
            'collected_at' => now(),
            'text' => 'Hasil pencarian fallback.',
            'metadata_json' => ['link_status' => 'search_fallback'],
        ]);

        $this->assertCount(2, $this->getJson("/api/v1/mentions?workspace_id={$this->workspace->id}&interaction_type=post")->assertStatus(200)->json('data'));
        $this->assertCount(2, $this->getJson("/api/v1/mentions?workspace_id={$this->workspace->id}&interaction_type=posts")->assertStatus(200)->json('data'));
        $this->assertCount(1, $this->getJson("/api/v1/mentions?workspace_id={$this->workspace->id}&interaction_type=comment")->assertStatus(200)->json('data'));
        $this->assertCount(1, $this->getJson("/api/v1/mentions?workspace_id={$this->workspace->id}&interaction_type=comments")->assertStatus(200)->json('data'));
        $this->assertCount(2, $this->getJson("/api/v1/mentions?workspace_id={$this->workspace->id}&link_status=verified")->assertStatus(200)->json('data'));
    }
}

