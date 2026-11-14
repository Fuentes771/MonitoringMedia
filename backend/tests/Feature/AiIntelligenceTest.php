<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Topic;
use App\Models\Mention;
use App\Models\Workspace;
use App\Models\SentimentResult;
use Database\Seeders\NationalPriorityProgramsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
}
