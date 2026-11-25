<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('muse-ingest', function (Request $request) {
            $limit = max(1, (int) config('services.muse.ingest_rate_limit', 10));
            $keyId = (string) ($request->attributes->get('muse_api_key_hash')
                ?: hash('sha256', (string) $request->header('X-TRINETRA-API-KEY', (string) $request->ip())));

            return Limit::perMinute($limit)
                ->by('muse-ingest:' . $keyId)
                ->response(function (Request $request, array $headers) {
                    return response()->json([
                        'status' => 'error',
                        'error' => 'rate_limit_exceeded',
                        'message' => 'Batas ingest terlampaui. Tunggu sebelum mengirim batch berikutnya.',
                        'retry_after' => (int) ($headers['Retry-After'] ?? 60),
                    ], 429, $headers);
                });
        });
    }
}
