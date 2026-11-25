<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Topic;
use App\Models\Mention;
use App\Models\MentionTopicMatch;
use App\Models\Workspace;
use App\Models\SentimentResult;
use Database\Seeders\NationalPriorityProgramsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;

class AiIntelligenceTest extends TestCase
{
    use RefreshDatabase;

    protected User $operator;
    protected Workspace $workspace;

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

        Sanctum::actingAs($this->operator);

        // Seed the 17 programs
        $seeder = new NationalPriorityProgramsSeeder();
        $seeder->run();
    }

    public function test_all_17_national_priority_programs_are_seeded(): void
    {
        $expectedPrograms = [
            'Makan Bergizi Gratis (MBG)',
            'Cek Kesehatan Gratis (CKG)',
            'Sekolah Rakyat',
            'Sekolah Unggul Garuda',
            'Revitalisasi Sekolah',
            'Digitalisasi Pembelajaran',
            'Magang Nasional',
            'Koperasi Desa/Kelurahan Merah Putih',
            'Program 3 Juta Rumah',
            'Kampung Nelayan Merah Putih',
            'PNM Mekaar',
            'Penghapusan Piutang Macet UMKM',
            'Swasembada Pangan',
            'Hilirisasi Nasional',
            'Ketahanan Energi',
            'Gerakan Indonesia ASRI',
            'Bank Emas (Bullion Bank)',
        ];

        $topics = Topic::whereIn('name', $expectedPrograms)->get();
        $this->assertCount(17, $topics);

        foreach ($topics as $topic) {
            $this->assertGreaterThan(0, $topic->keywords()->where('type', 'include')->count());
        }
    }

    public function test_ai_gateway_status_endpoint(): void
    {
        $response = $this->getJson('/api/v1/ai/status');
        $response->assertStatus(200);
        $response->assertJsonStructure([
            'status',
            'data' => [
                'service',
                '9router' => [
                    'status',
                ],
            ],
        ]);
    }

    public function test_ai_chat_endpoint_with_strict_grounding(): void
    {
        $topic = Topic::where('name', 'Makan Bergizi Gratis (MBG)')->first();
        $this->assertNotNull($topic);

        $response = $this->postJson('/api/v1/ai/chat', [
            'query' => 'Bagaimana perkembangan program Makan Bergizi Gratis?',
            'topic_id' => $topic->id,
            'workspace_id' => $this->workspace->id,
        ]);

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'status',
            'data' => [
                'answer',
                'citations',
                'mentions_count',
                'grounded',
                'engine',
            ],
        ]);
    }

    public function test_topic_ai_summary_endpoint(): void
    {
        $topic = Topic::where('name', 'Makan Bergizi Gratis (MBG)')->first();
        $this->assertNotNull($topic);

        $response = $this->getJson("/api/v1/topics/{$topic->id}/ai-summary");
        $response->assertStatus(200);
        $response->assertJsonStructure([
            'status',
            'data' => [
                'topic_name',
                'mentions_analyzed',
                'executive_overview',
                'dominant_sentiment',
            ],
        ]);
    }

    public function test_ai_chat_auto_detects_topic_from_acronym_and_prioritizes_organic_mentions(): void
    {
        $mbgTopic = Topic::where('name', 'Makan Bergizi Gratis (MBG)')->firstOrFail();

        $botMention = Mention::create([
            'workspace_id' => $this->workspace->id,
            'provider' => 'x',
            'external_id' => 'x_bot_mbg_1',
            'source_url' => 'https://x.com/search?q=mbg',
            'author_name' => 'user_999111',
            'published_at' => now()->subMinutes(5),
            'collected_at' => now(),
            'text' => 'Program MBG berjalan di sekolah dasar.',
            'is_inauthentic' => true,
            'metadata_json' => ['link_status' => 'search_fallback'],
        ]);
        MentionTopicMatch::create(['mention_id' => $botMention->id, 'topic_id' => $mbgTopic->id]);

        $organicMention = Mention::create([
            'workspace_id' => $this->workspace->id,
            'provider' => 'rss',
            'external_id' => 'rss_org_mbg_1',
            'source_url' => 'https://news.google.com/rss/articles/mbg-organic',
            'author_name' => 'Kompas',
            'published_at' => now()->subHour(),
            'collected_at' => now(),
            'text' => 'Evaluasi penyaluran MBG di sekolah menunjukkan peningkatan partisipasi siswa.',
            'is_inauthentic' => false,
            'metadata_json' => ['link_status' => 'verified_article'],
        ]);
        MentionTopicMatch::create(['mention_id' => $organicMention->id, 'topic_id' => $mbgTopic->id]);

        $capturedPayload = null;
        Http::fake([
            '*/ai/chat' => function ($request) use (&$capturedPayload) {
                $capturedPayload = $request->data();
                return Http::response([
                    'answer' => 'Ringkasan perkembangan MBG.',
                    'citations' => [],
                    'mentions_count' => count($capturedPayload['context_mentions'] ?? []),
                    'grounded' => true,
                    'engine' => '9router-rag',
                ], 200);
            },
        ]);

        $response = $this->postJson('/api/v1/ai/chat', [
            'query' => 'Bagaimana perkembangan MBG di sekolah?',
            'workspace_id' => $this->workspace->id,
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('data.topic_filtered', 'Makan Bergizi Gratis (MBG)');
        $this->assertNotNull($capturedPayload);
        $this->assertEquals('Makan Bergizi Gratis (MBG)', $capturedPayload['topic_name']);
        $this->assertCount(2, $capturedPayload['context_mentions']);
        // Organic verified mention should rank ahead of inauthentic bot mention
        $this->assertEquals($organicMention->id, $capturedPayload['context_mentions'][0]['id']);
    }
}
