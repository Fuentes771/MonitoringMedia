<?php

namespace App\Console\Commands;

use App\Models\Mention;
use App\Models\MentionKeyword;
use App\Models\MentionTopicMatch;
use App\Models\SentimentResult;
use App\Models\Topic;
use App\Services\IngestionService;
use App\Services\SocialLinkValidator;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RepairSocialLinksCommand extends Command
{
    protected $signature = 'social:repair-links
                            {--dry-run : Preview affected records without changing database rows}
                            {--purge-synthetic : Delete legacy synthetic /post/<hash> and broken demo mentions}
                            {--fix-encoding : Normalize search URLs and stamp metadata_json.link_status}
                            {--resync : Re-sync active topics after cleanup to pull verified links}';

    protected $description = 'Audit, repair, or purge broken social media source_url rows and resync verified posts';

    public function handle(SocialLinkValidator $validator, IngestionService $ingestionService): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $purgeSynthetic = (bool) $this->option('purge-synthetic');
        $fixEncoding = (bool) $this->option('fix-encoding');
        $resync = (bool) $this->option('resync');

        // Default to safe cleanup + encoding fix if no mutation flag was passed explicitly
        if (!$dryRun && !$purgeSynthetic && !$fixEncoding) {
            $purgeSynthetic = true;
            $fixEncoding = true;
        }

        $stats = [
            'scanned' => 0,
            'verified' => 0,
            'search_fallback' => 0,
            'broken_or_synthetic' => 0,
            'repaired' => 0,
            'purged' => 0,
        ];

        $idsToDelete = [];

        Mention::with('topics:id,name')->chunkById(200, function ($mentions) use (
            $validator,
            $dryRun,
            $purgeSynthetic,
            $fixEncoding,
            &$stats,
            &$idsToDelete
        ) {
            foreach ($mentions as $mention) {
                $stats['scanned']++;
                $meta = is_array($mention->metadata_json) ? $mention->metadata_json : [];
                $rawUrl = $mention->source_url;
                $topicHint = $mention->topics->first()?->name;

                if ($rawUrl && $validator->isSyntheticOrBrokenPattern($rawUrl)) {
                    $stats['broken_or_synthetic']++;
                    if ($purgeSynthetic) {
                        $idsToDelete[] = $mention->id;
                    }
                    continue;
                }

                $checked = $validator->validateAndNormalize(
                    provider: $mention->provider,
                    rawUrl: $rawUrl,
                    queryHint: $topicHint,
                    isDemo: (bool) $mention->is_demo,
                    declaredStatus: $meta['link_status'] ?? null
                );

                if (in_array($checked['link_status'], [SocialLinkValidator::STATUS_VERIFIED_POST, SocialLinkValidator::STATUS_VERIFIED_ARTICLE], true)) {
                    $stats['verified']++;
                } elseif ($checked['link_status'] === SocialLinkValidator::STATUS_SEARCH_FALLBACK) {
                    $stats['search_fallback']++;
                } elseif (in_array($checked['link_status'], [SocialLinkValidator::STATUS_BROKEN_LEGACY, SocialLinkValidator::STATUS_DEMO_PLACEHOLDER], true)) {
                    $stats['broken_or_synthetic']++;
                    if ($purgeSynthetic && $checked['link_status'] === SocialLinkValidator::STATUS_BROKEN_LEGACY) {
                        $idsToDelete[] = $mention->id;
                        continue;
                    }
                }

                $needsUrlUpdate = ($checked['url'] !== $rawUrl);
                $needsMetaUpdate = (($meta['link_status'] ?? null) !== $checked['link_status']);

                if ($fixEncoding && ($needsUrlUpdate || $needsMetaUpdate)) {
                    $stats['repaired']++;
                    if (!$dryRun) {
                        $meta['link_status'] = $checked['link_status'];
                        if (!empty($checked['reason'])) {
                            $meta['link_reason'] = $checked['reason'];
                        }
                        $mention->update([
                            'source_url' => $checked['url'],
                            'metadata_json' => $meta,
                        ]);
                    }
                }
            }
        });

        if ($purgeSynthetic && !empty($idsToDelete)) {
            $stats['purged'] = count($idsToDelete);
            if (!$dryRun) {
                DB::transaction(function () use ($idsToDelete) {
                    foreach (array_chunk($idsToDelete, 200) as $chunk) {
                        MentionTopicMatch::whereIn('mention_id', $chunk)->delete();
                        SentimentResult::whereIn('mention_id', $chunk)->delete();
                        MentionKeyword::whereIn('mention_id', $chunk)->delete();
                        Mention::whereIn('id', $chunk)->delete();
                    }
                });
            }
        }

        $modeLabel = $dryRun ? '[DRY RUN] ' : '';
        $this->info("{$modeLabel}Audit Social Links Selesai:");
        $this->table(
            ['Metrik', 'Jumlah'],
            [
                ['Total Diperiksa', $stats['scanned']],
                ['Tautan Terverifikasi', $stats['verified']],
                ['Tautan Pencarian Fallback', $stats['search_fallback']],
                ['Tautan Rusak / Sintetis / Demo', $stats['broken_or_synthetic']],
                ['Diperbaiki Encoding & Metadata', $stats['repaired']],
                ['Dihapus (Purge)', $stats['purged']],
            ]
        );

        if ($resync && !$dryRun) {
            $this->info('Menjalankan sinkronisasi ulang topik aktif...');
            $topics = Topic::where('status', 'active')->get();
            foreach ($topics as $topic) {
                $this->line(" -> Syncing topic: {$topic->name}");
                $ingestionService->ingestTopic($topic);
            }
            $this->info('Sinkronisasi ulang selesai.');
        }

        return self::SUCCESS;
    }
}

