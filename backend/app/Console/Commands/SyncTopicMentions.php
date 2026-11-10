<?php

namespace App\Console\Commands;

use App\Models\Topic;
use App\Services\IngestionService;
use Illuminate\Console\Command;

class SyncTopicMentions extends Command
{
    protected $signature = 'pulsescope:sync {topic_id? : ID of the topic to sync}';
    protected $description = 'Sync mentions from active connectors for topics';

    public function handle(IngestionService $service): int
    {
        $topicId = $this->argument('topic_id');

        $topics = $topicId 
            ? Topic::where('id', $topicId)->get()
            : Topic::where('status', 'active')->get();

        if ($topics->isEmpty()) {
            $this->warn('No active topics found to sync.');
            return 0;
        }

        $this->info("Starting ingestion sync for {$topics->count()} topic(s)...");

        foreach ($topics as $topic) {
            $this->line("-> Syncing Topic: {$topic->name} (Workspace: {$topic->workspace_id})");
            $results = $service->ingestTopic($topic);
            
            foreach ($results as $provider => $res) {
                $status = $res['status'] ?? 'unknown';
                $counts = $res['counts'] ?? ['collected' => 0, 'new' => 0, 'duplicates' => 0];
                $this->line("   [{$provider}] Status: {$status} | Collected: {$counts['collected']} | New: {$counts['new']} | Duplicates: {$counts['duplicates']}");
            }
        }

        $this->info('Ingestion sync completed successfully.');
        return 0;
    }
}

