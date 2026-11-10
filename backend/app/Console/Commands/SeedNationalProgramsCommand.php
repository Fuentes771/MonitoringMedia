<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Database\Seeders\NationalPriorityProgramsSeeder;
use App\Models\Topic;

class SeedNationalProgramsCommand extends Command
{
    protected $signature = 'pulsescope:seed-programs {--archive-old : Archive previous demo topics}';
    protected $description = 'Seed the 17 National Priority Programs and configure keyword monitors';

    public function handle(): int
    {
        $this->info('Seeding 17 National Priority Programs...');
        
        $seeder = new NationalPriorityProgramsSeeder();
        $seeder->run();

        $priorityProgramNames = [
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

        if ($this->option('archive-old')) {
            $archivedCount = Topic::whereNotIn('name', $priorityProgramNames)
                ->where('status', '!=', 'archived')
                ->update(['status' => 'archived']);

            if ($archivedCount > 0) {
                $this->warn("Archived {$archivedCount} non-priority topic(s) to maintain clean monitoring focus.");
            }
        }

        $activeTopics = Topic::whereIn('name', $priorityProgramNames)->get();
        $this->info("Successfully configured {$activeTopics->count()} National Priority Programs:");

        foreach ($activeTopics as $i => $topic) {
            $kwCount = $topic->keywords()->count();
            $this->line(sprintf("  [%02d] %s (Keywords: %d, Status: %s)", $i + 1, $topic->name, $kwCount, $topic->status));
        }

        return 0;
    }
}

