<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('topics', function (Blueprint $table) {
            if (!Schema::hasColumn('topics', 'external_key')) {
                $table->string('external_key', 64)->nullable()->unique();
            }
            if (!Schema::hasColumn('topics', 'collect_interval_minutes')) {
                $table->unsignedSmallInteger('collect_interval_minutes')->default(60);
            }
            if (!Schema::hasColumn('topics', 'last_collected_at')) {
                $table->timestamp('last_collected_at')->nullable();
            }
        });

        // Backfill Meta Muse platforms onto existing active topics so GET /api/v1/topics/active works immediately
        $metaPlatforms = ['threads', 'facebook', 'instagram'];
        $kopdesAssigned = DB::table('topics')->where('external_key', 'top_kopdes_001')->exists();

        $activeTopics = DB::table('topics')
            ->where('status', 'active')
            ->orderBy('id')
            ->get(['id', 'name', 'category', 'providers', 'external_key', 'collect_interval_minutes']);

        foreach ($activeTopics as $topic) {
            $rawProviders = $topic->providers;
            $providers = is_array($rawProviders)
                ? $rawProviders
                : (is_string($rawProviders) ? json_decode($rawProviders, true) : []);
            if (!is_array($providers)) {
                $providers = [];
            }

            $mergedProviders = array_values(array_unique(array_merge($providers, $metaPlatforms)));
            $updates = [
                'providers' => json_encode($mergedProviders),
            ];

            if (($topic->category ?? null) === 'trending_issue') {
                $updates['collect_interval_minutes'] = 30;
            }

            if (
                !$kopdesAssigned
                && empty($topic->external_key)
                && str_contains(strtolower((string) $topic->name), 'koperasi desa')
            ) {
                $updates['external_key'] = 'top_kopdes_001';
                $kopdesAssigned = true;
            }

            DB::table('topics')->where('id', $topic->id)->update($updates);
        }

        // Provision 'threads' connector row for existing workspaces
        $now = now();
        $workspaceIds = DB::table('workspaces')->pluck('id');
        foreach ($workspaceIds as $workspaceId) {
            $exists = DB::table('connectors')
                ->where('workspace_id', $workspaceId)
                ->where('provider', 'threads')
                ->exists();

            if (!$exists) {
                DB::table('connectors')->insert([
                    'workspace_id' => $workspaceId,
                    'provider' => 'threads',
                    'status' => 'needs_config',
                    'capabilities_json' => json_encode([
                        'keyword_search' => true,
                        'public_content' => true,
                        'comments' => true,
                        'public_metrics' => true,
                        'ingestion_mode' => 'muse_push',
                    ]),
                    'last_successful_sync_at' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('topics', function (Blueprint $table) {
            if (Schema::hasColumn('topics', 'external_key')) {
                $table->dropUnique(['external_key']);
                $table->dropColumn('external_key');
            }
            if (Schema::hasColumn('topics', 'collect_interval_minutes')) {
                $table->dropColumn('collect_interval_minutes');
            }
            if (Schema::hasColumn('topics', 'last_collected_at')) {
                $table->dropColumn('last_collected_at');
            }
        });
    }
};
