<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Topic;
use App\Services\IngestionService;
use App\Services\TrendService;
use App\Services\AlertService;

class SyncNationalProgramsCommand extends Command
{
    protected $signature = 'pulsescope:sync-programs {--topic= : Specific program name or ID to sync}';
    protected $description = 'Ingest latest news and compute trends for the 17 National Priority Programs';

    public function handle(
        IngestionService $ingestionService,
        TrendService $trendService,
        AlertService $alertService
    ): int {
        $topicFilter = $this->option('topic');

        $query = Topic::where('status', 'active');
        if ($topicFilter) {
            if (is_numeric($topicFilter)) {
                $query->where('id', $topicFilter);
            } else {
                $query->where('name', 'ilike', '%' . $topicFilter . '%');
            }
        }

        $topics = $query->get();

        if ($topics->isEmpty()) {
            $this->warn('No matching active topics found. Run "php artisan pulsescope:seed-programs" first.');
            return 0;
        }

        $this->info("Starting live news ingestion & AI sentiment analysis for {$topics->count()} program(s)...");

        $totalNew = 0;
        $totalCollected = 0;

        foreach ($topics as $index => $topic) {
            $this->line(sprintf("-> [%02d/%02d] Syncing '%s'...", $index + 1, $topics->count(), $topic->name));
            $results = $ingestionService->ingestTopic($topic);

            $trend = $trendService->computeTopicTrend($topic);
            $alerts = $alertService->evaluateTopicAlerts($topic);

            foreach ($results as $provider => $res) {
                $status = $res['status'] ?? 'unknown';
                $counts = $res['counts'] ?? ['collected' => 0, 'new' => 0, 'duplicates' => 0];
                $totalCollected += $counts['collected'];
                $totalNew += $counts['new'];

                $this->line("   [{$provider}] Status: {$status} | Collected: {$counts['collected']} | New Mentions: {$counts['new']}");
            }

            if (!empty($alerts)) {
                $this->warn("   (!) " . count($alerts) . " alert(s) triggered for this program.");
            }
        }

        $this->info("Sync completed! Total collected: {$totalCollected}, New mentions added: {$totalNew}");
        return 0;
    }
}

