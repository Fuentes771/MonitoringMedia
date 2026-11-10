<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Topic;
use App\Models\Mention;
use App\Services\IngestionService;
use App\Services\TrendService;
use App\Services\AlertService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class Sync30DaysProgramsCommand extends Command
{
    protected $signature = 'pulsescope:sync-30d {--purge-only : Hanya bersihkan data lebih dari 30 hari tanpa sinkronisasi ulang}';
    protected $description = 'Bersihkan data lebih lama dari 30 hari dan lakukan sinkronisasi data 30 hari terakhir untuk 17 Program Prioritas Nasional';

    public function handle(
        IngestionService $ingestionService,
        TrendService $trendService,
        AlertService $alertService
    ): int {
        $cutoff = Carbon::now('Asia/Jakarta')->subDays(30);
        $this->info("Menghapus data sebutan berita & medsos yang lebih lama dari 30 hari (< {$cutoff->format('Y-m-d H:i:s')} WIB)...");

        // 1. Purge mentions older than 30 days
        $deletedCount = Mention::where('published_at', '<', $cutoff)->delete();
        $this->info("Berhasil membersihkan {$deletedCount} data lama (>30 hari).");

        if ($this->option('purge-only')) {
            return 0;
        }

        // 2. Fetch fresh 30-day data for all active topics
        $topics = Topic::where('status', 'active')->orderBy('id', 'asc')->get();

        if ($topics->isEmpty()) {
            $this->warn('Tidak ada topik program prioritas yang aktif. Jalankan "php artisan pulsescope:seed-programs" terlebih dahulu.');
            return 0;
        }

        $this->info("Memulai sinkronisasi berita 30 hari terakhir untuk {$topics->count()} Program Prioritas Nasional...");

        $totalNew = 0;
        $totalCollected = 0;

        foreach ($topics as $index => $topic) {
            $this->line(sprintf("-> [%02d/%02d] Mengambil data 30 hari: '%s'...", $index + 1, $topics->count(), $topic->name));
            $results = $ingestionService->ingestTopic($topic);

            $trend = $trendService->computeTopicTrend($topic);
            $alerts = $alertService->evaluateTopicAlerts($topic);

            foreach ($results as $provider => $res) {
                $status = $res['status'] ?? 'unknown';
                $counts = $res['counts'] ?? ['collected' => 0, 'new' => 0, 'duplicates' => 0];
                $totalCollected += $counts['collected'];
                $totalNew += $counts['new'];

                $this->line("   [{$provider}] Status: {$status} | Terkumpul: {$counts['collected']} | Baru: {$counts['new']}");
            }

            if (!empty($alerts)) {
                $this->warn("   (!) " . count($alerts) . " alert terpicu untuk topik ini.");
            }
        }

        $this->info("Sinkronisasi 30 hari selesai! Total terambil: {$totalCollected}, Data baru tersimpan: {$totalNew}");
        return 0;
    }
}

