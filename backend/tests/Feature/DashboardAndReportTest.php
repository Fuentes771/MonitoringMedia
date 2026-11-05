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

class DashboardAndReportTest extends TestCase
{
    use RefreshDatabase;

    protected Workspace $workspace;
    protected Topic $topic;

    protected function setUp(): void
    {
        parent::setUp();

        $user = User::create([
            'name' => 'Data Analyst',
            'email' => 'analyst@pulsescope.id',
            'password' => bcrypt('password'),
        ]);

        $this->workspace = Workspace::create([
            'name' => 'Pulse Intelligence Lab',
            'slug' => 'pulse-lab',
            'owner_id' => $user->id,
        ]);

        $this->topic = Topic::create([
            'workspace_id' => $this->workspace->id,
            'name' => 'Kecerdasan Buatan',
            'status' => 'active',
            'match_mode' => 'any',
        ]);

        $now = Carbon::now('Asia/Jakarta');

        // Create sample mentions with sentiments
        $samples = [
            ['prov' => 'rss', 'sent' => 'positive', 'text' => 'Inovasi AI Indonesia sangat membanggakan dan pesat'],
            ['prov' => 'rss', 'sent' => 'negative', 'text' => 'Banyak keluhan terkait implementasi AI yang error'],
            ['prov' => 'youtube', 'sent' => 'neutral', 'text' => 'Diskusi komprehensif mengenai regulasi AI di DPR'],
        ];

        foreach ($samples as $idx => $s) {
            $m = Mention::create([
                'workspace_id' => $this->workspace->id,
                'provider' => $s['prov'],
                'external_id' => "ext_test_{$idx}",
                'source_url' => "https://example.com/{$idx}",
                'author_name' => "Author {$idx}",
                'text' => $s['text'],
                'text_normalized' => strtolower($s['text']),
                'language' => 'id',
                'published_at' => $now->copy()->subHours($idx + 1),
                'collected_at' => $now,
            ]);

            MentionTopicMatch::create([
                'mention_id' => $m->id,
                'topic_id' => $this->topic->id,
                'matched_keywords_json' => ['AI'],
            ]);

            SentimentResult::create([
                'mention_id' => $m->id,
                'model_name' => 'lexicon_id_v1',
                'label' => $s['sent'],
                'confidence' => 0.90,
                'scores_json' => ['positive' => 0.33, 'neutral' => 0.33, 'negative' => 0.34],
                'analyzed_at' => $now,
            ]);
        }
    }

    public function test_dashboard_overview_returns_correct_kpis_and_breakdowns(): void
    {
        $response = $this->getJson("/api/v1/dashboard/overview?workspace_id={$this->workspace->id}");

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('kpis.total_mentions', 3)
            ->assertJsonPath('kpis.negative_share_percent', 33.3)
            ->assertJsonPath('sentiment.positive', 1)
            ->assertJsonPath('sentiment.negative', 1)
            ->assertJsonPath('sentiment.neutral', 1);
    }

    public function test_dashboard_timeseries_returns_trend_buckets(): void
    {
        $response = $this->getJson("/api/v1/dashboard/timeseries?workspace_id={$this->workspace->id}&days=7");

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonStructure([
                'status',
                'days',
                'timeline' => [
                    '*' => ['date', 'label', 'total', 'positive', 'neutral', 'negative', 'unknown']
                ]
            ]);
    }

    public function test_report_export_streams_csv(): void
    {
        $response = $this->postJson("/api/v1/reports/export", [
            'workspace_id' => $this->workspace->id,
            'topic_id' => $this->topic->id,
        ]);

        $response->assertStatus(200);
        $this->assertStringStartsWith('text/csv', $response->headers->get('Content-Type'));
        $this->assertStringContainsString('attachment; filename="pulsescope_export_', $response->headers->get('Content-Disposition'));

        // Capture content from StreamedResponse
        ob_start();
        $response->sendContent();
        $content = ob_get_clean();

        $this->assertStringContainsString('ID,Provider,"External ID",Author,"Published At",Sentiment,Confidence,Topics,"Source URL",Text', $content);
        $this->assertStringContainsString('rss,ext_test_0', $content);
        $this->assertStringContainsString('youtube,ext_test_2', $content);
    }
}
