<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use App\Models\Topic;
use App\Models\TopicKeyword;
use App\Models\Connector;
use App\Models\Mention;
use App\Models\MentionTopicMatch;
use App\Models\SentimentResult;
use App\Models\MentionKeyword;
use App\Models\TrendSnapshot;
use App\Models\Alert;
use App\Models\AlertEvent;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Carbon\Carbon;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $now = Carbon::now('Asia/Jakarta');

        // 1. Create Users
        $owner = User::firstOrCreate(
            ['email' => 'owner@pulsescope.local'],
            ['name' => 'Budi Pratama (Owner)', 'password' => Hash::make('password')]
        );

        $admin = User::firstOrCreate(
            ['email' => 'admin@pulsescope.local'],
            ['name' => 'Siti Rahma (Admin)', 'password' => Hash::make('password')]
        );

        $analyst = User::firstOrCreate(
            ['email' => 'analyst@pulsescope.local'],
            ['name' => 'Dimas Wicaksono (Analyst)', 'password' => Hash::make('password')]
        );

        $viewer = User::firstOrCreate(
            ['email' => 'viewer@pulsescope.local'],
            ['name' => 'Dewi Lestari (Viewer)', 'password' => Hash::make('password')]
        );

        // 2. Create Workspace
        $workspace = Workspace::firstOrCreate(
            ['slug' => 'pulsescope-hub'],
            [
                'name' => 'PulseScope Intelligence Hub',
                'owner_id' => $owner->id,
            ]
        );

        // 3. Attach Members
        WorkspaceMember::firstOrCreate(
            ['workspace_id' => $workspace->id, 'user_id' => $owner->id],
            ['role' => 'owner']
        );
        WorkspaceMember::firstOrCreate(
            ['workspace_id' => $workspace->id, 'user_id' => $admin->id],
            ['role' => 'admin']
        );
        WorkspaceMember::firstOrCreate(
            ['workspace_id' => $workspace->id, 'user_id' => $analyst->id],
            ['role' => 'analyst']
        );
        WorkspaceMember::firstOrCreate(
            ['workspace_id' => $workspace->id, 'user_id' => $viewer->id],
            ['role' => 'viewer']
        );

        // 4. Create Connectors
        $rssConnector = Connector::firstOrCreate(
            ['workspace_id' => $workspace->id, 'provider' => 'rss'],
            [
                'status' => 'connected',
                'capabilities_json' => [
                    'keyword_search' => true,
                    'public_content' => true,
                    'streaming' => false,
                    'historical_backfill' => 'limited',
                ],
                'last_successful_sync_at' => $now->copy()->subMinutes(12),
            ]
        );

        $ytConnector = Connector::firstOrCreate(
            ['workspace_id' => $workspace->id, 'provider' => 'youtube'],
            [
                'status' => 'needs_config',
                'capabilities_json' => [
                    'keyword_search' => true,
                    'public_content' => true,
                    'comments' => false,
                    'public_metrics' => true,
                    'historical_backfill' => 'limited',
                ],
                'last_successful_sync_at' => null,
            ]
        );

        $redditConnector = Connector::firstOrCreate(
            ['workspace_id' => $workspace->id, 'provider' => 'reddit'],
            [
                'status' => 'disconnected',
                'capabilities_json' => [
                    'keyword_search' => true,
                    'public_content' => true,
                    'comments' => true,
                ],
                'last_successful_sync_at' => null,
            ]
        );

        // 5. Create Topic 1: Isu Transportasi Publik Jabodetabek
        $topicTransport = Topic::firstOrCreate(
            ['workspace_id' => $workspace->id, 'name' => 'Isu Transportasi Publik Jabodetabek'],
            [
                'description' => 'Pemantauan opini publik, keterlambatan, dan kenyamanan MRT, LRT, TransJakarta, dan KRL.',
                'status' => 'active',
                'match_mode' => 'any',
                'language_filters' => ['id'],
                'providers' => ['rss', 'youtube'],
                'is_demo' => false,
            ]
        );

        $transportKeywords = [
            ['keyword' => 'MRT Jakarta', 'type' => 'include'],
            ['keyword' => 'LRT Jabodebek', 'type' => 'include'],
            ['keyword' => 'TransJakarta', 'type' => 'include'],
            ['keyword' => 'KRL Commuter', 'type' => 'include'],
            ['keyword' => 'antrean stasiun', 'type' => 'include'],
            ['keyword' => 'lowongan', 'type' => 'exclude'],
            ['keyword' => 'loker', 'type' => 'exclude'],
        ];

        foreach ($transportKeywords as $kw) {
            TopicKeyword::firstOrCreate([
                'topic_id' => $topicTransport->id,
                'keyword' => $kw['keyword'],
                'type' => $kw['type'],
            ]);
        }

        // 6. Create Topic 2: Kualitas Layanan Fintech & Digital Bank
        $topicFintech = Topic::firstOrCreate(
            ['workspace_id' => $workspace->id, 'name' => 'Kualitas Layanan Fintech & Digital Banking'],
            [
                'description' => 'Monitoring gangguan transfer, kendala sistem, keluhan nasabah, dan kepuasan pengguna.',
                'status' => 'active',
                'match_mode' => 'any',
                'language_filters' => ['id'],
                'providers' => ['rss'],
                'is_demo' => false,
            ]
        );

        $fintechKeywords = [
            ['keyword' => 'transfer pending', 'type' => 'include'],
            ['keyword' => 'aplikasi perbankan', 'type' => 'include'],
            ['keyword' => 'layanan error', 'type' => 'include'],
            ['keyword' => 'top up gagal', 'type' => 'include'],
            ['keyword' => 'promo pinjol', 'type' => 'exclude'],
        ];

        foreach ($fintechKeywords as $kw) {
            TopicKeyword::firstOrCreate([
                'topic_id' => $topicFintech->id,
                'keyword' => $kw['keyword'],
                'type' => $kw['type'],
            ]);
        }

        // 7. Seed Sample Mentions with Provenance and Sentiment
        $sampleMentions = [
            [
                'topic' => $topicTransport,
                'provider' => 'rss',
                'external_id' => 'demo-trans-01',
                'source_url' => 'https://news.detik.com/berita/d-transport-mrt-penumpang-meningkat',
                'author_name' => 'Detik News Metro',
                'text' => 'Fasilitas stasiun MRT Jakarta dinilai semakin ramah disabilitas dan waktu tunggu kereta sangat tepat waktu setiap 5 menit.',
                'sentiment' => 'positive',
                'confidence' => 0.94,
                'probs' => ['positive' => 0.94, 'neutral' => 0.04, 'negative' => 0.02],
                'hours_ago' => 2,
                'keywords' => ['mrt jakarta', 'tepat waktu', 'ramah disabilitas', 'fasilitas stasiun'],
            ],
            [
                'topic' => $topicTransport,
                'provider' => 'rss',
                'external_id' => 'demo-trans-02',
                'source_url' => 'https://megapolitan.kompas.com/read/lrt-jabodebek-antrean-jam-sibuk',
                'author_name' => 'Kompas Megapolitan',
                'text' => 'Antrean gate masuk LRT Jabodebek menumpuk parah saat jam sibuk pagi ini, banyak penumpang mengeluhkan tap in kartu lambat.',
                'sentiment' => 'negative',
                'confidence' => 0.89,
                'probs' => ['positive' => 0.02, 'neutral' => 0.09, 'negative' => 0.89],
                'hours_ago' => 4,
                'keywords' => ['lrt jabodebek', 'antrean gate', 'menumpuk parah', 'kartu lambat'],
            ],
            [
                'topic' => $topicTransport,
                'provider' => 'rss',
                'external_id' => 'demo-trans-03',
                'source_url' => 'https://antaranews.com/berita/transjakarta-tambah-armada-koridor',
                'author_name' => 'Antara News Jakarta',
                'text' => 'PT Transportasi Jakarta menambah 30 unit bus listrik untuk koridor utama guna mengurangi waktu tunggu di halte transit.',
                'sentiment' => 'neutral',
                'confidence' => 0.81,
                'probs' => ['positive' => 0.25, 'neutral' => 0.70, 'negative' => 0.05],
                'hours_ago' => 6,
                'keywords' => ['transjakarta', 'bus listrik', 'tambah armada', 'halte transit'],
            ],
            [
                'topic' => $topicTransport,
                'provider' => 'youtube',
                'external_id' => 'demo-trans-04',
                'source_url' => 'https://www.youtube.com/watch?v=demoKrlUjiCoba',
                'author_name' => 'Urban Transport ID',
                'text' => 'Review KRL Commuter jalur baru: AC dingin, gerbong bersih, pelayanannya mantul banget wkwk.',
                'sentiment' => 'positive',
                'confidence' => 0.91,
                'probs' => ['positive' => 0.91, 'neutral' => 0.06, 'negative' => 0.03],
                'hours_ago' => 12,
                'keywords' => ['krl commuter', 'mantul banget', 'gerbong bersih', 'pelayanan'],
            ],
            [
                'topic' => $topicTransport,
                'provider' => 'rss',
                'external_id' => 'demo-trans-05',
                'source_url' => 'https://tempo.co/read/krl-terlambat-gangguan-sinyal',
                'author_name' => 'Tempo Metro',
                'text' => 'KRL Commuter line mengalami gangguan sinyal di jalur Manggarai, ratusan penumpang tertahan lebih dari 45 menit tanpa kepastian.',
                'sentiment' => 'negative',
                'confidence' => 0.96,
                'probs' => ['positive' => 0.01, 'neutral' => 0.03, 'negative' => 0.96],
                'hours_ago' => 18,
                'keywords' => ['krl commuter', 'gangguan sinyal', 'manggarai', 'tertahan'],
            ],
            [
                'topic' => $topicFintech,
                'provider' => 'rss',
                'external_id' => 'demo-fin-01',
                'source_url' => 'https://bisnis.tempo.co/read/aplikasi-perbankan-gangguan-sistem',
                'author_name' => 'Tempo Bisnis',
                'text' => 'Aplikasi perbankan digital mengalami transfer pending massal sejak siang hari, warganet mengeluhkan saldo terpotong tapi uang belum masuk.',
                'sentiment' => 'negative',
                'confidence' => 0.93,
                'probs' => ['positive' => 0.01, 'neutral' => 0.06, 'negative' => 0.93],
                'hours_ago' => 3,
                'keywords' => ['aplikasi perbankan', 'transfer pending', 'saldo terpotong', 'gangguan sistem'],
            ],
            [
                'topic' => $topicFintech,
                'provider' => 'rss',
                'external_id' => 'demo-fin-02',
                'source_url' => 'https://antaranews.com/berita/pemulihan-sistem-fintech',
                'author_name' => 'Antara Finansial',
                'text' => 'Pihak manajemen mengonfirmasi bahwa layanan perbankan telah berangsur pulih dan seluruh transaksi tertunda sedang diproses otomatis.',
                'sentiment' => 'neutral',
                'confidence' => 0.78,
                'probs' => ['positive' => 0.20, 'neutral' => 0.74, 'negative' => 0.06],
                'hours_ago' => 1,
                'keywords' => ['layanan perbankan', 'berangsur pulih', 'transaksi tertunda', 'fintech'],
            ],
        ];

        foreach ($sampleMentions as $m) {
            $publishedAt = $now->copy()->subHours($m['hours_ago']);
            $mention = Mention::firstOrCreate(
                ['provider' => $m['provider'], 'external_id' => $m['external_id']],
                [
                    'workspace_id' => $workspace->id,
                    'source_url' => $m['source_url'],
                    'author_name' => $m['author_name'],
                    'published_at' => $publishedAt,
                    'collected_at' => $publishedAt->copy()->addMinutes(5),
                    'text' => $m['text'],
                    'text_normalized' => Str::lower($m['text']),
                    'language' => 'id',
                    'deletion_status' => 'active',
                    'is_demo' => true,
                    'metadata_json' => ['sample' => true],
                ]
            );

            MentionTopicMatch::firstOrCreate(
                ['mention_id' => $mention->id, 'topic_id' => $m['topic']->id],
                ['matched_keywords_json' => $m['keywords']]
            );

            SentimentResult::firstOrCreate(
                ['mention_id' => $mention->id],
                [
                    'label' => $m['sentiment'],
                    'confidence' => $m['confidence'],
                    'probabilities_json' => $m['probs'],
                    'model_version' => 'v1.0-hybrid',
                    'analyzed_at' => $publishedAt->copy()->addMinutes(6),
                ]
            );

            foreach ($m['keywords'] as $kw) {
                MentionKeyword::firstOrCreate([
                    'mention_id' => $mention->id,
                    'keyword' => $kw,
                ], [
                    'score' => 1.0,
                ]);
            }
        }

        // 8. Create Trend Snapshots
        TrendSnapshot::firstOrCreate(
            [
                'workspace_id' => $workspace->id,
                'topic_id' => $topicTransport->id,
                'window_end' => $now->copy()->startOfHour(),
            ],
            [
                'window_start' => $now->copy()->subHours(24)->startOfHour(),
                'score' => 78.5,
                'sample_count' => 142,
                'components_json' => [
                    'volume' => 0.85,
                    'growth' => 0.80,
                    'acceleration' => 0.72,
                    'source_diversity' => 0.75,
                    'persistence' => 0.70,
                ],
                'explanation' => 'Volume mention naik 2.8x dibandingkan baseline 7 hari lalu, didorong isu penumpukan antrean gate LRT dan gangguan sinyal KRL Manggarai.',
            ]
        );

        // 9. Create Alert Rule & Triggered Event
        $alertNeg = Alert::firstOrCreate(
            ['workspace_id' => $workspace->id, 'topic_id' => $topicTransport->id, 'type' => 'negative_surge'],
            [
                'threshold_json' => [
                    'negative_share_percent' => 35.0,
                    'min_volume' => 10,
                ],
                'cooldown_minutes' => 60,
                'last_triggered_at' => $now->copy()->subHours(3),
                'is_active' => true,
            ]
        );

        AlertEvent::firstOrCreate(
            ['alert_id' => $alertNeg->id, 'triggered_at' => $now->copy()->subHours(3)],
            [
                'status' => 'open',
                'severity' => 'high',
                'evidence_json' => [
                    'negative_share_percent' => 46.2,
                    'threshold_percent' => 35.0,
                    'sample_count' => 39,
                    'driving_keywords' => ['antrean gate', 'menumpuk parah', 'gangguan sinyal'],
                ],
                'acknowledged_at' => null,
            ]
        );
    }
}
