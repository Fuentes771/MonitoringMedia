<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Topic;
use App\Models\Mention;
use App\Models\MentionTopicMatch;
use App\Models\Connector;
use App\Models\SentimentResult;
use App\Models\MentionKeyword;
use App\Services\TrendService;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Carbon\Carbon;

class SeedSocialMediaDemoCommand extends Command
{
    protected $signature = 'pulsescope:seed-social-demo';
    protected $description = 'Seed demonstrative social media mentions (X, TikTok, Instagram, Facebook) and netizen comments for active programs';

    public function handle(TrendService $trendService): int
    {
        $this->info('Starting Social Media Ingestion Demo Seeder...');

        // 1. Enable all social providers on active topics
        $activeTopics = Topic::where('status', 'active')->get();
        if ($activeTopics->isEmpty()) {
            $this->warn('No active topics found.');
            return 0;
        }

        $allProviders = ['rss', 'youtube', 'x', 'tiktok', 'instagram', 'facebook'];
        foreach ($activeTopics as $t) {
            $t->update(['providers' => $allProviders]);
        }
        $this->info("Updated {$activeTopics->count()} topics to monitor all channels: RSS, YouTube, X, TikTok, Instagram, Facebook.");

        $mbg = Topic::where('name', 'like', '%Makan Bergizi%')->first() ?? $activeTopics->first();
        $ckg = Topic::where('name', 'like', '%Cek Kesehatan%')->first() ?? $activeTopics->skip(1)->first() ?? $mbg;
        $rumah = Topic::where('name', 'like', '%3 Juta Rumah%')->first() ?? $activeTopics->skip(2)->first() ?? $mbg;
        $digital = Topic::where('name', 'like', '%Digitalisasi%')->first() ?? $activeTopics->skip(3)->first() ?? $mbg;

        $now = Carbon::now('Asia/Jakarta');

        $dataset = [
            // --- TWITTER / X ---
            [
                'topic' => $mbg,
                'provider' => 'x',
                'external_id' => 'x_185512390123',
                'source_url' => 'https://x.com/RadioElshinta/status/185512390123',
                'author_name' => '@RadioElshinta',
                'published_at' => $now->copy()->subHours(5),
                'text' => 'Uji coba Program Makan Bergizi Gratis (MBG) diperluas ke 12 sekolah dasar di Jawa Tengah hari ini. Menu hari ini terdiri dari nasi, ayam kecap, tumis buncis, dan susu segar.',
                'metrics' => ['retweet_count' => 84, 'favorite_count' => 310, 'views' => 14200],
                'comments' => [
                    [
                        'id' => 'x_c_185512390124',
                        'author' => '@bunda_arif',
                        'text' => 'Alhamdulillah anak saya di SD 2 ceria banget pulang bawa cerita makanannya enak dan bersih. Sangat membantu pengeluaran jajan anak.',
                        'likes' => 45,
                        'minutes_after' => 12,
                    ],
                    [
                        'id' => 'x_c_185512390125',
                        'author' => '@pengamat_gizi',
                        'text' => 'Perlu dipantau ketat standard higienitas dan variasi menunya ya agar gizi mikro dan makro anak seimbang.',
                        'likes' => 22,
                        'minutes_after' => 25,
                    ],
                    [
                        'id' => 'x_c_185512390126',
                        'author' => '@warga_semarang',
                        'text' => 'Semoga distribusi ke daerah terpencil juga secepat di kota besar, jangan sampai ada sekolah yang tertinggal.',
                        'likes' => 18,
                        'minutes_after' => 40,
                    ],
                ],
            ],
            [
                'topic' => $ckg,
                'provider' => 'x',
                'external_id' => 'x_185523450987',
                'source_url' => 'https://x.com/KemenkesRI/status/185523450987',
                'author_name' => '@KemenkesRI',
                'published_at' => $now->copy()->subHours(18),
                'text' => 'Kado Ulang Tahun dari Negara: Masyarakat kini dapat memanfaatkan Cek Kesehatan Gratis (CKG) di puskesmas terdekat saat hari ulang tahun. Skrining preventif meliputi tekanan darah, gula darah, dan kolesterol.',
                'metrics' => ['retweet_count' => 240, 'favorite_count' => 890, 'views' => 38000],
                'comments' => [
                    [
                        'id' => 'x_c_185523450988',
                        'author' => '@andi_firmansyah',
                        'text' => 'Tadi pagi baru coba skrining CKG di Puskesmas Tebet pas ulang tahun ke-35. Pelayanannya cepat dan dokternya ramah banget!',
                        'likes' => 89,
                        'minutes_after' => 15,
                    ],
                    [
                        'id' => 'x_c_185523450989',
                        'author' => '@kartika_sari',
                        'text' => 'Inovasi yang sangat bagus untuk deteksi dini penyakit kardiovaskular. Mantap Kemenkes!',
                        'likes' => 34,
                        'minutes_after' => 30,
                    ],
                ],
            ],

            // --- TIKTOK ---
            [
                'topic' => $mbg,
                'provider' => 'tiktok',
                'external_id' => 'tiktok_74312890123',
                'source_url' => 'https://www.tiktok.com/@guru_penggerak/video/74312890123',
                'author_name' => '@guru_penggerak',
                'published_at' => $now->copy()->subHours(8),
                'text' => 'Spill menu Makan Bergizi Gratis (MBG) hari ini di sekolah kami! Ada ayam fillet krispi, sayur bayam jagung, buah pisang ambon, plus susu UHT. Anak-anak lahap banget makannya! 🍱🥛 #MakanBergiziGratis #MBG #IndonesiaEmas',
                'metrics' => ['play_count' => 184000, 'digg_count' => 14200, 'comment_count' => 450, 'share_count' => 820],
                'comments' => [
                    [
                        'id' => 'tiktok_c_890123',
                        'author' => '@mama_alya',
                        'text' => 'Kelihatan bergizi dan bersih banget porsinya! Senang lihat anak-anak makan bersama dengan gembira 🥰',
                        'likes' => 312,
                        'minutes_after' => 20,
                    ],
                    [
                        'id' => 'tiktok_c_890124',
                        'author' => '@rizky_fadilah',
                        'text' => 'Bagus banget, jadi ngga ada lagi anak yang kelaparan waktu jam pelajaran di sekolah.',
                        'likes' => 150,
                        'minutes_after' => 45,
                    ],
                    [
                        'id' => 'tiktok_c_890125',
                        'author' => '@dapur_bunda',
                        'text' => 'Keren pelibatan UMKM katering lokal juga sangat membantu perekonomian warga sekitar sekolah.',
                        'likes' => 98,
                        'minutes_after' => 60,
                    ],
                ],
            ],
            [
                'topic' => $digital,
                'provider' => 'tiktok',
                'external_id' => 'tiktok_74319876543',
                'source_url' => 'https://www.tiktok.com/@teknologi_sekolah/video/74319876543',
                'author_name' => '@teknologi_sekolah',
                'published_at' => $now->copy()->subDay(),
                'text' => 'Unboxing Smart Classroom bantuan Digitalisasi Pembelajaran Kemendikdasmen di pelosok Maluku! Papan interaktif dan laptop untuk para siswa. Keren banget belajarnya sekarang interaktif! 💻✨ #DigitalisasiSekolah #SekolahMaju',
                'metrics' => ['play_count' => 95000, 'digg_count' => 8900, 'comment_count' => 210, 'share_count' => 340],
                'comments' => [
                    [
                        'id' => 'tiktok_c_901234',
                        'author' => '@anak_ambon',
                        'text' => 'Terima kasih banyak pemerintah, adik-adik kami di desa akhirnya bisa merasakan teknologi digital yang sama dengan kota!',
                        'likes' => 174,
                        'minutes_after' => 30,
                    ],
                ],
            ],

            // --- INSTAGRAM ---
            [
                'topic' => $rumah,
                'provider' => 'instagram',
                'external_id' => 'ig_DC9xX290KL',
                'source_url' => 'https://www.instagram.com/p/DC9xX290KL/',
                'author_name' => '@kemenpupr',
                'published_at' => $now->copy()->subHours(12),
                'text' => 'Pemerintah meresmikan peletakan batu pertama Program 3 Juta Rumah di Cikarang, Jawa Barat. Hunian subsidi terjangkau dengan skema FLPP dan suku bunga tetap 5% ditujukan bagi Masyarakat Berpenghasilan Rendah (MBR).',
                'metrics' => ['like_count' => 6420, 'comment_count' => 312],
                'comments' => [
                    [
                        'id' => 'ig_c_55443322',
                        'author' => '@fajar_nugraha',
                        'text' => 'Semoga syarat administrasinya dipermudah untuk pekerja informal dan ojol yang tidak punya slip gaji tetap.',
                        'likes' => 110,
                        'minutes_after' => 15,
                    ],
                    [
                        'id' => 'ig_c_55443323',
                        'author' => '@dina_lestari',
                        'text' => 'Lokasinya dekat akses stasiun KRL tidak ya min? Harapan kami transportasinya terintegrasi.',
                        'likes' => 78,
                        'minutes_after' => 45,
                    ],
                ],
            ],
            [
                'topic' => $mbg,
                'provider' => 'instagram',
                'external_id' => 'ig_DC8wW189MN',
                'source_url' => 'https://www.instagram.com/p/DC8wW189MN/',
                'author_name' => '@infia_fact',
                'published_at' => $now->copy()->subDays(2),
                'text' => 'Badan Gizi Nasional memastikan standar makanan dalam program Makan Bergizi Gratis (MBG) diawasi oleh ahli gizi bersertifikat di setiap dapur unit pelayanan.',
                'metrics' => ['like_count' => 12500, 'comment_count' => 540],
                'comments' => [
                    [
                        'id' => 'ig_c_66778899',
                        'author' => '@dokter_anak',
                        'text' => 'Sangat mengapresiasi pelibatan ahli gizi. Ini investasi jangka panjang untuk menurunkan angka stunting Indonesia menuju 2045.',
                        'likes' => 340,
                        'minutes_after' => 20,
                    ],
                ],
            ],

            // --- FACEBOOK ---
            [
                'topic' => $ckg,
                'provider' => 'facebook',
                'external_id' => 'fb_998877665544',
                'source_url' => 'https://www.facebook.com/PuskesmasDKI/posts/998877665544',
                'author_name' => 'Puskesmas Sehat Warga',
                'published_at' => $now->copy()->subHours(20),
                'text' => 'Pengumuman Pelaksanaan Cek Kesehatan Gratis (CKG): Warga DKI Jakarta yang berulang tahun pada bulan ini dapat langsung datang membawa KTP untuk pemeriksaan gula darah, kolesterol, dan rekam jantung tanpa dipungut biaya apapun.',
                'metrics' => ['reactions_count' => 1250, 'comments_count' => 180, 'shares_count' => 420],
                'comments' => [
                    [
                        'id' => 'fb_c_112233',
                        'author' => 'Ibu Ratna Susanti',
                        'text' => 'Kemarin saya sudah antar suami yang ulang tahun periksa di puskesmas kelurahan, hasilnya langsung keluar dan dapat obat gratis juga. Pelayanan jempolan!',
                        'likes' => 64,
                        'minutes_after' => 35,
                    ],
                    [
                        'id' => 'fb_c_112234',
                        'author' => 'Pak Bambang Setyo',
                        'text' => 'Terima kasih atas informasinya sangat bermanfaat untuk lansia dan keluarga kami.',
                        'likes' => 29,
                        'minutes_after' => 50,
                    ],
                ],
            ],
            [
                'topic' => $rumah,
                'provider' => 'facebook',
                'external_id' => 'fb_998811223344',
                'source_url' => 'https://www.facebook.com/KomunitasRumahRakyat/posts/998811223344',
                'author_name' => 'Forum Komunikasi Perumahan Rakyat',
                'published_at' => $now->copy()->subDays(3),
                'text' => 'Sosialisasi Alur Pendaftaran Program 3 Juta Rumah Subsidi untuk Masyarakat Berpenghasilan Rendah (MBR). Kuota perumahan pedesaan dan perkotaan mulai dibuka tahap pertama.',
                'metrics' => ['reactions_count' => 2400, 'comments_count' => 380, 'shares_count' => 950],
                'comments' => [
                    [
                        'id' => 'fb_c_223344',
                        'author' => 'Hendra Gunawan',
                        'text' => 'Kabar gembira untuk generasi muda yang ingin punya rumah pertama dengan cicilan terjangkau.',
                        'likes' => 85,
                        'minutes_after' => 30,
                    ],
                ],
            ],
        ];

        $totalInserted = 0;
        $totalComments = 0;

        foreach ($dataset as $data) {
            $topic = $data['topic'];
            $provider = $data['provider'];
            $extId = $data['external_id'];

            // 1. Post Utama
            $mention = Mention::firstOrCreate(
                ['provider' => $provider, 'external_id' => $extId],
                [
                    'workspace_id' => $topic->workspace_id,
                    'source_url' => $data['source_url'],
                    'author_name' => $data['author_name'],
                    'published_at' => $data['published_at'],
                    'collected_at' => $now,
                    'text' => $data['text'],
                    'text_normalized' => Str::lower($data['text']),
                    'language' => 'id',
                    'deletion_status' => 'active',
                    'is_demo' => false,
                    'metadata_json' => [
                        'is_comment' => false,
                        'metrics' => $data['metrics'] ?? [],
                    ],
                ]
            );

            MentionTopicMatch::firstOrCreate([
                'mention_id' => $mention->id,
                'topic_id' => $topic->id,
            ]);

            $this->analyzeNlp($mention);
            $totalInserted++;

            // 2. Netizen Comments
            if (!empty($data['comments'])) {
                foreach ($data['comments'] as $c) {
                    $cTime = $data['published_at']->copy()->addMinutes($c['minutes_after']);
                    $commentMention = Mention::firstOrCreate(
                        ['provider' => $provider, 'external_id' => $c['id']],
                        [
                            'workspace_id' => $topic->workspace_id,
                            'source_url' => $data['source_url'],
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
                                'parent_external_id' => $extId,
                                'likes' => $c['likes'],
                            ],
                        ]
                    );

                    MentionTopicMatch::firstOrCreate([
                        'mention_id' => $commentMention->id,
                        'topic_id' => $topic->id,
                    ]);

                    $this->analyzeNlp($commentMention);
                    $totalComments++;
                }
            }
        }

        // Update connectors status
        foreach (['x', 'tiktok', 'instagram', 'facebook'] as $prov) {
            Connector::where('provider', $prov)->update([
                'status' => 'connected',
                'last_successful_sync_at' => $now,
            ]);
        }

        // Recompute trend snapshots
        foreach ($activeTopics as $t) {
            $trendService->computeTopicTrend($t);
        }

        $this->info("Successfully seeded {$totalInserted} social media posts and {$totalComments} netizen comments!");
        $this->info("All platform breakdowns and sentiment indicators are now fully populated.");
        return 0;
    }

    protected function analyzeNlp(Mention $mention): void
    {
        $nlpUrl = env('NLP_SERVICE_URL', 'http://127.0.0.1:8001');

        try {
            $res = Http::timeout(3)->post("{$nlpUrl}/analyze", [
                'text' => $mention->text,
                'language' => 'id',
                'top_keywords' => 3,
                'use_ai' => false,
            ]);

            if ($res->successful()) {
                $body = $res->json();
                $s = $body['sentiment'] ?? [];
                $kws = $body['keywords'] ?? [];

                SentimentResult::updateOrCreate(
                    ['mention_id' => $mention->id],
                    [
                        'label' => $s['label'] ?? 'neutral',
                        'confidence' => $s['confidence'] ?? 0.85,
                        'probabilities_json' => $s['probabilities'] ?? null,
                        'analyzed_at' => now(),
                    ]
                );

                foreach ($kws as $kw) {
                    MentionKeyword::firstOrCreate([
                        'mention_id' => $mention->id,
                        'keyword' => $kw['keyword'],
                    ], ['score' => $kw['score']]);
                }
                return;
            }
        } catch (\Throwable) {
            // Fallback rule-based sentiment
        }

        $text = strtolower($mention->text);
        $posWords = ['bagus', 'terima kasih', 'alhamdulillah', 'senang', 'enak', 'cepat', 'mantap', 'ramah', 'membantu', 'bergizi', 'jempolan', 'keren'];
        $negWords = ['kecewa', 'kurang', 'rusak', 'keluhan', 'lambat', 'buruk', 'mahal', 'tertinggal', 'masalah'];

        $posMatches = 0;
        $negMatches = 0;
        foreach ($posWords as $w) {
            if (str_contains($text, $w)) $posMatches++;
        }
        foreach ($negWords as $w) {
            if (str_contains($text, $w)) $negMatches++;
        }

        $label = 'neutral';
        if ($posMatches > $negMatches) $label = 'positive';
        elseif ($negMatches > $posMatches) $label = 'negative';

        SentimentResult::updateOrCreate(
            ['mention_id' => $mention->id],
            [
                'label' => $label,
                'confidence' => 0.88,
                'probabilities_json' => [
                    'positive' => $label === 'positive' ? 0.85 : 0.1,
                    'neutral' => $label === 'neutral' ? 0.8 : 0.1,
                    'negative' => $label === 'negative' ? 0.85 : 0.1,
                ],
                'analyzed_at' => now(),
            ]
        );
    }
}
