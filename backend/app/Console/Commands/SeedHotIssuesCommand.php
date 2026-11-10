<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Topic;
use App\Models\TopicKeyword;
use App\Models\Mention;
use App\Models\MentionTopicMatch;
use App\Models\SentimentResult;
use App\Models\MentionKeyword;
use Carbon\Carbon;
use Illuminate\Support\Str;

class SeedHotIssuesCommand extends Command
{
    protected $signature = 'pulsescope:seed-hot-issues';
    protected $description = 'Seed breaking viral hot issues (e.g. Isu Penyadapan Presiden Prabowo, PPN 12%) into the 33-hour intelligence window';

    public function handle(): int
    {
        $this->info('Seeding Breaking Hot Issues Dataset...');
        $now = Carbon::now('Asia/Jakarta');

        // 1. Isu Utama: Dugaan Penyadapan Presiden Prabowo oleh LSP
        $topicPenyadapan = Topic::firstOrCreate(
            [
                'workspace_id' => 1,
                'name' => 'Dugaan Penyadapan Presiden Prabowo oleh LSP & Lembaga Asing',
            ],
            [
                'description' => 'Lonjakan perbincangan wacana keamanan siber dan polemik dugaan penyadapan komunikasi Presiden Prabowo yang ramai diperdebatkan netizen.',
                'category' => 'trending_issue',
                'urgency_level' => 'critical',
                'surge_detected_at' => $now->copy()->subHours(8),
                'status' => 'active',
                'match_mode' => 'any',
                'providers' => ['rss', 'youtube', 'x', 'tiktok', 'instagram', 'facebook'],
                'is_demo' => false,
            ]
        );

        $topicPenyadapan->update([
            'category' => 'trending_issue',
            'urgency_level' => 'critical',
            'surge_detected_at' => $now->copy()->subHours(8),
            'status' => 'active',
        ]);

        foreach (['penyadapan prabowo', 'penyadapan presiden', 'LSP sadap', 'kebocoran istana'] as $kw) {
            TopicKeyword::firstOrCreate([
                'topic_id' => $topicPenyadapan->id,
                'keyword' => $kw,
            ], ['type' => 'include', 'match_mode' => 'broad']);
        }

        // 2. Isu Sekunder: Polemik Kenaikan PPN 12%
        $topicPpn = Topic::firstOrCreate(
            [
                'workspace_id' => 1,
                'name' => 'Polemik Rencana Kenaikan Tarif PPN 12%',
            ],
            [
                'description' => 'Akselerasi diskursus publik dan kekhawatiran dampak kenaikan PPN 12% terhadap daya beli masyarakat kelas menengah.',
                'category' => 'trending_issue',
                'urgency_level' => 'elevated',
                'surge_detected_at' => $now->copy()->subHours(14),
                'status' => 'active',
                'match_mode' => 'any',
                'providers' => ['rss', 'youtube', 'x', 'tiktok', 'instagram', 'facebook'],
                'is_demo' => false,
            ]
        );

        $topicPpn->update([
            'category' => 'trending_issue',
            'urgency_level' => 'elevated',
            'surge_detected_at' => $now->copy()->subHours(14),
            'status' => 'active',
        ]);

        foreach (['PPN 12 persen', 'kenaikan PPN 12%', 'daya beli kelas menengah'] as $kw) {
            TopicKeyword::firstOrCreate([
                'topic_id' => $topicPpn->id,
                'keyword' => $kw,
            ], ['type' => 'include', 'match_mode' => 'broad']);
        }

        // Dataset Sebutan Isu Penyadapan (Di dalam jendela 33 jam)
        $datasetPenyadapan = [
            // Media Berita
            [
                'provider' => 'rss',
                'ext_id' => 'rss_sadap_01',
                'author' => 'Tempo.co',
                'url' => 'https://nasional.tempo.co/read/penyadapan-istana-prabowo',
                'text' => 'Istana dan BIN Buka Suara Tanggapi Isu Penyadapan Percakapan Presiden Prabowo Subianto: Menko Polkam menegaskan seluruh jalur komunikasi VVIP dienkripsi berlapis.',
                'pub_hours_ago' => 4,
                'sentiment' => 'neutral',
                'conf' => 0.89,
                'metrics' => ['reads' => 42000],
            ],
            [
                'provider' => 'rss',
                'ext_id' => 'rss_sadap_02',
                'author' => 'Kompas.com',
                'url' => 'https://nasional.kompas.com/read/polemik-penyadapan-lembaga-survei',
                'text' => 'DPR Minta Investigasi Menyeluruh Terkait Isu Penyadapan Presiden Prabowo oleh Pihak Luar: Komisi I jadwalkan rapat dengar pendapat dengan BSSN pekan ini.',
                'pub_hours_ago' => 6,
                'sentiment' => 'negative',
                'conf' => 0.92,
                'metrics' => ['reads' => 68000],
            ],
            // Twitter / X Main Post & Replies
            [
                'provider' => 'x',
                'ext_id' => 'x_sadap_post_101',
                'author' => '@MataPolitik_ID',
                'url' => 'https://x.com/MataPolitik_ID/status/185590192831',
                'text' => 'BREAKING: Isu dugaan penyadapan komunikasi Presiden Prabowo yang dikaitkan dengan rilis lembaga survei menjadi perbincangan terhangat nomor 1 di Twitter/X Indonesia siang ini. Publik menuntut kejelasan fakta.',
                'pub_hours_ago' => 3,
                'sentiment' => 'neutral',
                'conf' => 0.85,
                'metrics' => ['retweet_count' => 1240, 'favorite_count' => 5400, 'views' => 189000],
                'comments' => [
                    [
                        'id' => 'x_sadap_c_201',
                        'author' => '@warga_nkri',
                        'text' => 'Ini isu kedaulatan negara yang sangat genting! Siapapun di balik penyadapan harus diusut tuntas tanpa kompromi! 🚨',
                        'sentiment' => 'negative',
                        'likes' => 840,
                        'mins_after' => 10,
                    ],
                    [
                        'id' => 'x_sadap_c_202',
                        'author' => '@pemerhati_siber',
                        'text' => 'BSSN dan BIN harus transparan melakukan audit sistem enkripsi telekomunikasi istana agar spekulasi liar di medsos tidak memicu kegaduhan.',
                        'sentiment' => 'negative',
                        'likes' => 430,
                        'mins_after' => 25,
                    ],
                    [
                        'id' => 'x_sadap_c_203',
                        'author' => '@budi_santoso',
                        'text' => 'Jangan langsung percaya provokasi sebelum ada rilis resmi forensik digital dari BSSN.',
                        'sentiment' => 'neutral',
                        'likes' => 290,
                        'mins_after' => 35,
                    ],
                ],
            ],
            // TikTok Video & Comments
            [
                'provider' => 'tiktok',
                'ext_id' => 'tiktok_sadap_301',
                'author' => '@info_headline',
                'url' => 'https://www.tiktok.com/@info_headline/video/74319988221',
                'text' => 'Viral isu penyadapan Presiden Prabowo oleh oknum lembaga survei & pihak luar, Menko Polkam sebut keamanan siber VVIP tetap aman dan terkendali! #Prabowo #IsuPenyadapan #BeritaViral #Indonesia',
                'pub_hours_ago' => 5,
                'sentiment' => 'neutral',
                'conf' => 0.88,
                'metrics' => ['play_count' => 540000, 'digg_count' => 42000, 'comment_count' => 1850],
                'comments' => [
                    [
                        'id' => 'tiktok_sadap_c_302',
                        'author' => '@rizki_nasionalis',
                        'text' => 'Kawal terus Presiden Prabowo! Keamanan negara nomor satu!',
                        'sentiment' => 'positive',
                        'likes' => 950,
                        'mins_after' => 15,
                    ],
                    [
                        'id' => 'tiktok_sadap_c_303',
                        'author' => '@dewi_safitri',
                        'text' => 'Seram ya kalau sampai komunikasi level presiden saja bisa bocor ke publik, harus segera dibenahi sistem keamanannya.',
                        'sentiment' => 'negative',
                        'likes' => 520,
                        'mins_after' => 30,
                    ],
                ],
            ],
            // Instagram & Facebook
            [
                'provider' => 'instagram',
                'ext_id' => 'ig_sadap_401',
                'author' => '@narasinewsroom',
                'url' => 'https://www.instagram.com/p/DC99SadapPrabowo/',
                'text' => 'Polemik Penyadapan Komunikasi Presiden Prabowo: Pakar intelijen militer menilai klaim ini harus diuji melalui audit forensik sinyal intelijen untuk memisahkan antara perang psikologis dan ancaman siber riil.',
                'pub_hours_ago' => 7,
                'sentiment' => 'neutral',
                'conf' => 0.87,
                'metrics' => ['like_count' => 18400, 'comment_count' => 890],
                'comments' => [
                    [
                        'id' => 'ig_sadap_c_402',
                        'author' => '@andi_kusuma',
                        'text' => 'Analisis yang berbobot. Jangan sampai publik terbawa narasi framing tanpa dasar bukti yang sahih.',
                        'sentiment' => 'positive',
                        'likes' => 310,
                        'mins_after' => 20,
                    ],
                ],
            ],
        ];

        // Seed data penyadapan
        $this->seedDataset($topicPenyadapan, $datasetPenyadapan, $now);

        // Dataset Sebutan Isu PPN 12%
        $datasetPpn = [
            [
                'provider' => 'rss',
                'ext_id' => 'rss_ppn_01',
                'author' => 'Detik.com',
                'url' => 'https://finance.detik.com/moneter/ppn-12-persen-berlaku',
                'text' => 'Kemenkeu Kaji Mitigasi Dampak Kenaikan Tarif PPN 12%: Sejumlah komoditas bahan pokok dan jasa kesehatan tetap diusulkan bebas PPN.',
                'pub_hours_ago' => 10,
                'sentiment' => 'neutral',
                'conf' => 0.88,
                'metrics' => ['reads' => 55000],
            ],
            [
                'provider' => 'x',
                'ext_id' => 'x_ppn_post_201',
                'author' => '@FinansialRakyat',
                'url' => 'https://x.com/FinansialRakyat/status/185591028372',
                'text' => 'Netizen ramai suarakan keresahan terkait rencana kenaikan PPN 12% per Januari. Tagar #TolakPPN12Persen dan #DayaBeliLesu puncaki tren nasional.',
                'pub_hours_ago' => 12,
                'sentiment' => 'negative',
                'conf' => 0.94,
                'metrics' => ['retweet_count' => 2800, 'favorite_count' => 9200, 'views' => 260000],
                'comments' => [
                    [
                        'id' => 'x_ppn_c_202',
                        'author' => '@pejuang_gaji',
                        'text' => 'Gaji belum naik tapi pajak dan kebutuhan pokok terus naik. Mohon pemerintah tinjau ulang waktu kenaikan PPN 12% ini.',
                        'sentiment' => 'negative',
                        'likes' => 1400,
                        'mins_after' => 15,
                    ],
                ],
            ],
        ];

        $this->seedDataset($topicPpn, $datasetPpn, $now);

        $this->info("Successfully seeded breaking hot issues: '{$topicPenyadapan->name}' and '{$topicPpn->name}'.");
        return 0;
    }

    private function seedDataset(Topic $topic, array $items, Carbon $now): void
    {
        foreach ($items as $item) {
            $pubTime = $now->copy()->subHours($item['pub_hours_ago']);

            $mention = Mention::firstOrCreate(
                ['provider' => $item['provider'], 'external_id' => $item['ext_id']],
                [
                    'workspace_id' => $topic->workspace_id,
                    'source_url' => $item['url'],
                    'author_name' => $item['author'],
                    'published_at' => $pubTime,
                    'collected_at' => $now,
                    'text' => $item['text'],
                    'text_normalized' => Str::lower($item['text']),
                    'language' => 'id',
                    'deletion_status' => 'active',
                    'is_demo' => false,
                    'metadata_json' => [
                        'is_comment' => false,
                        'metrics' => $item['metrics'] ?? [],
                    ],
                ]
            );

            MentionTopicMatch::firstOrCreate([
                'mention_id' => $mention->id,
                'topic_id' => $topic->id,
            ]);

            SentimentResult::updateOrCreate(
                ['mention_id' => $mention->id],
                [
                    'label' => $item['sentiment'],
                    'confidence' => $item['conf'],
                    'probabilities_json' => [
                        'positive' => $item['sentiment'] === 'positive' ? 0.85 : 0.1,
                        'neutral' => $item['sentiment'] === 'neutral' ? 0.8 : 0.1,
                        'negative' => $item['sentiment'] === 'negative' ? 0.85 : 0.1,
                    ],
                    'analyzed_at' => now(),
                ]
            );

            // Comments
            if (!empty($item['comments'])) {
                foreach ($item['comments'] as $c) {
                    $cTime = $pubTime->copy()->addMinutes($c['mins_after']);
                    $commentMention = Mention::firstOrCreate(
                        ['provider' => $item['provider'], 'external_id' => $c['id']],
                        [
                            'workspace_id' => $topic->workspace_id,
                            'source_url' => $item['url'],
                            'author_name' => $c['author'],
                            'published_at' => $cTime,
                            'collected_at' => $now,
                            'text' => $c['text'],
                            'text_normalized' => Str::lower($c['text']),
                            'language' => 'id',
                            'deletion_status' => 'active',
                            'is_demo' => false,
                            'metadata_json' => [
                                'is_comment' => true,
                                'parent_external_id' => $item['ext_id'],
                                'likes' => $c['likes'],
                            ],
                        ]
                    );

                    MentionTopicMatch::firstOrCreate([
                        'mention_id' => $commentMention->id,
                        'topic_id' => $topic->id,
                    ]);

                    SentimentResult::updateOrCreate(
                        ['mention_id' => $commentMention->id],
                        [
                            'label' => $c['sentiment'],
                            'confidence' => 0.90,
                            'probabilities_json' => [
                                'positive' => $c['sentiment'] === 'positive' ? 0.85 : 0.1,
                                'neutral' => $c['sentiment'] === 'neutral' ? 0.8 : 0.1,
                                'negative' => $c['sentiment'] === 'negative' ? 0.85 : 0.1,
                            ],
                            'analyzed_at' => now(),
                        ]
                    );
                }
            }
        }
    }
}

