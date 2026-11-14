<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Topic;
use App\Models\TopicKeyword;
use App\Models\User;
use App\Models\Workspace;

class NationalPriorityProgramsSeeder extends Seeder
{
    /**
     * Seed the 17 National Priority Programs for Indonesia.
     */
    public function run(): void
    {
        $workspace = Workspace::first() ?? Workspace::create([
            'name' => 'PulseScope Intelligence Hub',
            'slug' => 'pulsescope-hub',
            'owner_id' => User::query()->value('id') ?? 1,
        ]);

        $programs = [
            [
                'name' => 'Makan Bergizi Gratis (MBG)',
                'description' => 'Program pemenuhan gizi nasional untuk anak sekolah, santri, dan balita di seluruh Indonesia yang dikoordinasikan oleh Badan Gizi Nasional.',
                'includes' => ['Makan Bergizi Gratis', 'MBG', 'makan siang gratis', 'Badan Gizi Nasional', 'uji coba MBG', 'satuan pelayanan gizi', 'dapur gizi'],
                'excludes' => ['loker catering', 'lowongan kerja', 'catering prasmanan pernikahan'],
            ],
            [
                'name' => 'Cek Kesehatan Gratis (CKG)',
                'description' => 'Program pemeriksaan dan skrining kesehatan preventif gratis dari Kemenkes di puskesmas, termasuk skrining saat ulang tahun warga.',
                'includes' => ['Cek Kesehatan Gratis', 'CKG', 'skrining kesehatan gratis', 'skrining kesehatan ulang tahun', 'pemeriksaan kesehatan puskesmas gratis', 'kemenkes cek kesehatan'],
                'excludes' => ['loker perawat swasta', 'klinik kecantikan', 'promo spa'],
            ],
            [
                'name' => 'Sekolah Rakyat',
                'description' => 'Inisiatif pemerataan dan akses pendidikan terjangkau/gratis bagi masyarakat prasejahtera dan daerah terluar.',
                'includes' => ['Sekolah Rakyat', 'pendidikan sekolah rakyat', 'sekolah gratis rakyat prasejahtera', 'akses pendidikan sekolah rakyat'],
                'excludes' => ['sejarah sekolah rakyat kolonial', 'buku pelajaran kuno'],
            ],
            [
                'name' => 'Sekolah Unggul Garuda',
                'description' => 'Pembangunan sekolah unggulan berkualitas tinggi dan berstandar internasional di berbagai pelosok daerah.',
                'includes' => ['Sekolah Unggul Garuda', 'SMA Unggul Garuda', 'Sekolah Garuda Nusantara', 'Sekolah Garuda'],
                'excludes' => ['maskapai garuda', 'garuda indonesia flight', 'tiket pesawat'],
            ],
            [
                'name' => 'Revitalisasi Sekolah',
                'description' => 'Percepatan renovasi dan perbaikan menyeluruh fasilitas gedung serta ruang kelas sekolah yang rusak berat di Indonesia.',
                'includes' => ['Revitalisasi Sekolah', 'renovasi gedung sekolah', 'perbaikan ruang kelas rusak', 'revitalisasi ruang kelas', 'sekolah rusak berat'],
                'excludes' => ['tender konstruksi swasta', 'perumahan cluster'],
            ],
            [
                'name' => 'Digitalisasi Pembelajaran',
                'description' => 'Penyediaan perangkat pembelajaran digital, smart classroom, dan materi e-learning di sekolah-sekolah.',
                'includes' => ['Digitalisasi Pembelajaran', 'digitalisasi pendidikan kemendikdasmen', 'laptop sekolah gratis', 'smart classroom sekolah', 'bantuan laptop sekolah'],
                'excludes' => ['promo laptop gaming', 'jual beli pc bekas'],
            ],
            [
                'name' => 'Magang Nasional',
                'description' => 'Program perluasan akses magang bersertifikat berskala nasional untuk mahasiswa dan fresh graduate dengan industri dan BUMN.',
                'includes' => ['Magang Nasional', 'program magang nasional kemnaker', 'magang bersertifikat bumn', 'magang fresh graduate bersertifikat'],
                'excludes' => ['magang jepang swasta', 'lpk jepang berbayar'],
            ],
            [
                'name' => 'Koperasi Desa/Kelurahan Merah Putih',
                'description' => 'Penguatan dan revitalisasi koperasi di tingkat desa dan kelurahan sebagai pusat rantai pasok dan ekonomi kerakyatan.',
                'includes' => ['Koperasi Desa Merah Putih', 'Koperasi Kelurahan Merah Putih', 'Koperasi Merah Putih', 'koperasi desa merah putih'],
                'excludes' => ['beras merah putih', 'bendera merah putih pesta'],
            ],
            [
                'name' => 'Program 3 Juta Rumah',
                'description' => 'Pembangunan 3 juta unit rumah layak huni per tahun (2 juta di pedesaan/pesisir, 1 juta di perkotaan) untuk Masyarakat Berpenghasilan Rendah (MBR).',
                'includes' => ['Program 3 Juta Rumah', '3 juta rumah', 'rumah subsidi kementerian perumahan', 'kpr subsidi 3 juta rumah', 'rumah murah rakyat'],
                'excludes' => ['sewa rumah harian', 'homestay villa', 'kontrakan bulanan'],
            ],
            [
                'name' => 'Kampung Nelayan Merah Putih',
                'description' => 'Modernisasi pemukiman dan dermaga nelayan tradisional dengan fasilitas cold storage, sanitasi, dan akses pemasaran.',
                'includes' => ['Kampung Nelayan Merah Putih', 'kampung nelayan modern', 'revitalisasi kampung nelayan', 'bantuan nelayan cold storage'],
                'excludes' => ['trip memancing laut', 'sewa kapal mancing'],
            ],
            [
                'name' => 'PNM Mekaar',
                'description' => 'Penyaluran pembiayaan dan pendampingan kelompok ultra mikro untuk perempuan prasejahtera melalui PT Permodalan Nasional Madani.',
                'includes' => ['PNM Mekaar', 'nasabah mekaar', 'permodalan nasional madani mekaar', 'pembiayaan ultra mikro ibu mekaar', 'kelompok mekaar'],
                'excludes' => ['loker account officer pnm', 'lowongan kerja bumn'],
            ],
            [
                'name' => 'Penghapusan Piutang Macet UMKM',
                'description' => 'Kebijakan hapus tagih dan hapus buku kredit macet bagi pelaku UMKM di sektor pertanian, perkebunan, peternakan, dan kelautan (PP 47/2024).',
                'includes' => ['Penghapusan Piutang Macet UMKM', 'hapus tagih umkm', 'PP 47 2024 utang umkm', 'hapus buku kredit macet umkm', 'utang macet petani nelayan'],
                'excludes' => ['pinjol ilegal', 'jasa hapus data pinjol'],
            ],
            [
                'name' => 'Swasembada Pangan',
                'description' => 'Pencapaian kemandirian pangan nasional melalui cetak sawah baru, modernisasi pertanian, lumbung pangan, dan stabilitas cadangan beras.',
                'includes' => ['Swasembada Pangan', 'cetak sawah nasional', 'lumbung pangan nasional', 'panen raya beras', 'cadangan beras pemerintah', 'food estate pangan'],
                'excludes' => ['resep masakan sehari-hari', 'review resto kuliner'],
            ],
            [
                'name' => 'Hilirisasi Nasional',
                'description' => 'Industrialisasi pengolahan komoditas tambang, mineral, dan perkebunan di dalam negeri untuk meningkatkan nilai tambah ekonomi dan ekspor.',
                'includes' => ['Hilirisasi Nasional', 'hilirisasi nikel', 'smelter tembaga nasional', 'hilirisasi bauksit', 'hilirisasi kelapa sawit', 'nilai tambah mineral'],
                'excludes' => ['trading crypto', 'saham gorengan'],
            ],
            [
                'name' => 'Ketahanan Energi',
                'description' => 'Kemandirian pasokan energi melalui implementasi biodiesel B40/B50, transisi energi baru terbarukan (EBT), dan peningkatan lifting minyak.',
                'includes' => ['Ketahanan Energi', 'swasembada energi', 'biodiesel B40', 'biodiesel B50', 'transisi energi terbarukan', 'plts nasional', 'lifting minyak'],
                'excludes' => ['minuman penambah energi', 'suplemen kesehatan'],
            ],
            [
                'name' => 'Gerakan Indonesia ASRI',
                'description' => 'Gerakan nasional kebersihan, kelestarian lingkungan hidup, penataan ruang hijau, dan pengelolaan sampah terpadu di perkotaan dan desa.',
                'includes' => ['Gerakan Indonesia ASRI', 'Indonesia ASRI', 'Indonesia Aman Sehat Rapi Indah', 'penghijauan kelestarian lingkungan', 'gerakan kebersihan lingkungan asri'],
                'excludes' => ['perumahan graha asri', 'villa puncak asri'],
            ],
            [
                'name' => 'Bank Emas (Bullion Bank)',
                'description' => 'Pembentukan dan pengelolaan layanan bank emas nasional untuk mengintegrasikan potensi komoditas emas dalam sistem perbankan Indonesia.',
                'includes' => ['Bank Emas', 'Bullion Bank', 'bullion services pegadaian', 'ekosistem emas batangan nasional', 'layanan bullion bank indonesia', 'cadangan emas perbankan'],
                'excludes' => ['toko perhiasan kalung emas', 'gadai perhiasan cincin'],
            ],
        ];

        foreach ($programs as $prog) {
            $topic = Topic::firstOrCreate(
                [
                    'workspace_id' => $workspace->id,
                    'name' => $prog['name'],
                ],
                [
                    'description' => $prog['description'],
                    'status' => 'active',
                    'match_mode' => 'any',
                    'language_filters' => ['id'],
                    'providers' => ['rss', 'youtube'],
                    'is_demo' => false,
                ]
            );

            // Seed includes
            foreach ($prog['includes'] as $inc) {
                TopicKeyword::firstOrCreate([
                    'topic_id' => $topic->id,
                    'keyword' => trim($inc),
                    'type' => 'include',
                ]);
            }

            // Seed excludes
            foreach ($prog['excludes'] as $exc) {
                TopicKeyword::firstOrCreate([
                    'topic_id' => $topic->id,
                    'keyword' => trim($exc),
                    'type' => 'exclude',
                ]);
            }
        }
    }
}

