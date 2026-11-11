<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Penarikan data otomatis 17 Program Prioritas Nasional setiap hari jam 09:00 WIB
Schedule::command('pulsescope:sync-programs')
    ->dailyAt('09:00')
    ->timezone('Asia/Jakarta')
    ->withoutOverlapping()
    ->runInBackground();

// Deteksi otomatis isu hangat / breaking news dari Google News RSS setiap 1 jam
Schedule::command('pulsescope:discover-hot-issues')
    ->hourly()
    ->timezone('Asia/Jakarta')
    ->withoutOverlapping()
    ->runInBackground();

