<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\HotIssueDiscoveryService;

class DiscoverHotIssuesCommand extends Command
{
    protected $signature = 'pulsescope:discover-hot-issues {--workspace=1 : Workspace ID}';
    protected $description = 'Automatically discover breaking news & viral hot issues from Google News using AI clustering';

    public function handle(HotIssueDiscoveryService $discoveryService): int
    {
        $workspaceId = (int)$this->option('workspace');
        $this->info("Scanning Google News Top Headlines & National News for Workspace #{$workspaceId}...");

        $result = $discoveryService->discoverAndIngest($workspaceId);

        if ($result['status'] === 'empty') {
            $this->warn($result['message']);
            return 0;
        }

        $this->info($result['message']);

        if (!empty($result['topics'])) {
            $this->table(
                ['ID', 'Hot Issue Name', 'Urgency', 'Keywords'],
                array_map(function ($t) {
                    $kws = is_array($t->keywords) 
                        ? implode(', ', array_column($t->keywords, 'keyword'))
                        : $t->keywords->pluck('keyword')->join(', ');
                    return [
                        $t->id,
                        $t->name,
                        $t->urgency_level,
                        $kws,
                    ];
                }, $result['topics'])
            );
        }

        return 0;
    }
}

