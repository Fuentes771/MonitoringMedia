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

class SocialMediaAdaptersTest extends TestCase
{
    use RefreshDatabase;

    protected Workspace $workspace;
    protected Topic $topic;

    protected function setUp(): void
    {
        parent::setUp();

        $user = User::create([
            'name' => 'Test User',
            'email' => 'test@pulsescope.local',
            'password' => bcrypt('password'),
        ]);

        $this->workspace = Workspace::create([
            'name' => 'Pulse Intelligence Lab',
            'slug' => 'pulse-lab',
            'owner_id' => $user->id,
        ]);

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
}

