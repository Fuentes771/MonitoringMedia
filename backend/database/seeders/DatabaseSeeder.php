<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use App\Models\Topic;
use App\Models\Connector;
use App\Models\Alert;
use App\Models\AlertEvent;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Carbon\Carbon;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database with 17 National Priority Programs.
     */
    public function run(): void
    {
        $now = Carbon::now('Asia/Jakarta');

        // 1. Create Users
        $owner = User::firstOrCreate(
            ['email' => 'owner@pulsescope.local'],
            ['name' => 'Budi Pratama (Owner)', 'password' => Hash::make('password')]
        );

        $admin = User::firstOrCreate(
            ['email' => 'admin@pulsescope.local'],
            ['name' => 'Siti Rahma (Admin)', 'password' => Hash::make('password')]
        );

        $analyst = User::firstOrCreate(
            ['email' => 'analyst@pulsescope.local'],
            ['name' => 'Dimas Wicaksono (Analyst)', 'password' => Hash::make('password')]
        );

        $viewer = User::firstOrCreate(
            ['email' => 'viewer@pulsescope.local'],
            ['name' => 'Dewi Lestari (Viewer)', 'password' => Hash::make('password')]
        );

        // 2. Create Workspace
        $workspace = Workspace::firstOrCreate(
            ['slug' => 'pulsescope-hub'],
            [
                'name' => 'PulseScope Intelligence Hub',
                'owner_id' => $owner->id,
            ]
        );

        // 3. Attach Members
        WorkspaceMember::firstOrCreate(
            ['workspace_id' => $workspace->id, 'user_id' => $owner->id],
            ['role' => 'owner']
        );
        WorkspaceMember::firstOrCreate(
            ['workspace_id' => $workspace->id, 'user_id' => $admin->id],
            ['role' => 'admin']
        );
        WorkspaceMember::firstOrCreate(
            ['workspace_id' => $workspace->id, 'user_id' => $analyst->id],
            ['role' => 'analyst']
        );
        WorkspaceMember::firstOrCreate(
            ['workspace_id' => $workspace->id, 'user_id' => $viewer->id],
            ['role' => 'viewer']
        );

        // 4. Create Connectors
        Connector::firstOrCreate(
            ['workspace_id' => $workspace->id, 'provider' => 'rss'],
            [
                'status' => 'connected',
                'capabilities_json' => [
                    'keyword_search' => true,
                    'public_content' => true,
                    'streaming' => false,
                    'historical_backfill' => 'limited',
                ],
                'last_successful_sync_at' => $now->copy()->subMinutes(12),
            ]
        );

        Connector::firstOrCreate(
            ['workspace_id' => $workspace->id, 'provider' => 'youtube'],
            [
                'status' => 'needs_config',
                'capabilities_json' => [
                    'keyword_search' => true,
                    'public_content' => true,
                    'comments' => false,
                    'public_metrics' => true,
                    'historical_backfill' => 'limited',
                ],
                'last_successful_sync_at' => null,
            ]
        );

        Connector::firstOrCreate(
            ['workspace_id' => $workspace->id, 'provider' => 'reddit'],
            [
                'status' => 'disconnected',
                'capabilities_json' => [
                    'keyword_search' => true,
                    'public_content' => true,
                    'comments' => true,
                ],
                'last_successful_sync_at' => null,
            ]
        );

        foreach (['x', 'tiktok', 'instagram', 'facebook'] as $socialKey) {
            Connector::firstOrCreate(
                ['workspace_id' => $workspace->id, 'provider' => $socialKey],
                [
                    'status' => 'needs_config',
                    'capabilities_json' => [
                        'keyword_search' => true,
                        'public_content' => true,
                        'comments' => true,
                        'public_metrics' => true,
                    ],
                    'last_successful_sync_at' => null,
                ]
            );
        }

        // 5. Seed 17 National Priority Programs exclusively
        (new NationalPriorityProgramsSeeder())->run();

        $mbgTopic = Topic::where('name', 'Makan Bergizi Gratis (MBG)')->first();

        // 6. Create Alert Rule & Triggered Event for National Priority Program
        if ($mbgTopic) {
            $alertNeg = Alert::firstOrCreate(
                ['workspace_id' => $workspace->id, 'topic_id' => $mbgTopic->id, 'type' => 'negative_surge'],
                [
                    'threshold_json' => [
                        'negative_share_percent' => 30.0,
                        'min_volume' => 10,
                    ],
                    'cooldown_minutes' => 60,
                    'last_triggered_at' => $now->copy()->subHours(3),
                    'is_active' => true,
                ]
            );

            AlertEvent::firstOrCreate(
                ['alert_id' => $alertNeg->id, 'triggered_at' => $now->copy()->subHours(3)],
                [
                    'status' => 'open',
                    'severity' => 'high',
                    'evidence_json' => [
                        'topic_name' => 'Makan Bergizi Gratis (MBG)',
                        'negative_share_percent' => 32.5,
                        'threshold_percent' => 30.0,
                        'sample_count' => 20,
                        'driving_keywords' => ['jadwal distribusi', 'dapur suspend', 'anggaran porsi'],
                    ],
                    'acknowledged_at' => null,
                ]
            );
        }
    }
}
