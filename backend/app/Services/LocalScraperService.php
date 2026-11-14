<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class LocalScraperService
{
    protected string $baseUrl;

    /** @var array<string, mixed> */
    protected array $lastMeta = [
        'verified_count' => 0,
        'fallback_count' => 0,
        'engine_status' => 'idle',
        'status_message' => '',
    ];

    public function __construct()
    {
        $this->baseUrl = rtrim(config('services.nlp.url', env('NLP_SERVICE_URL', 'http://127.0.0.1:8001')), '/');
    }

    /**
     * Check if the Python Local Scraper engine is available and ready.
     */
    public function isAvailable(): bool
    {
        try {
            $response = Http::timeout(2)->get("{$this->baseUrl}/api/v1/scraper/status");
            return $response->successful() && ($response->json('status') === 'ready');
        } catch (Throwable) {
            return false;
        }
    }

    /**
     * Scrape supported social media platform via local Python hybrid engine.
     *
     * @param string $platform 'x', 'tiktok', 'instagram', 'facebook', or 'youtube'
     * @return array<int, array<string, mixed>>
     */
    public function scrape(string $platform, string $query, int $limit = 10): array
    {
        $this->lastMeta = [
            'verified_count' => 0,
            'fallback_count' => 0,
            'engine_status' => 'empty',
            'status_message' => '',
        ];

        try {
            $response = Http::asJson()
                ->acceptJson()
                ->timeout(25)
                ->post("{$this->baseUrl}/api/v1/scraper/scrape", [
                    'platform' => strtolower($platform),
                    'query' => $query,
                    'limit' => $limit,
                ]);

            if ($response->successful()) {
                $data = $response->json() ?? [];
                $items = $data['items'] ?? [];
                $this->lastMeta = [
                    'verified_count' => (int) ($data['verified_count'] ?? 0),
                    'fallback_count' => (int) ($data['fallback_count'] ?? 0),
                    'engine_status' => (string) ($data['engine_status'] ?? (count($items) > 0 ? 'ok' : 'empty')),
                    'status_message' => (string) ($data['status_message'] ?? ''),
                ];

                return is_array($items) ? $items : [];
            }

            $this->lastMeta['engine_status'] = 'error';
            $this->lastMeta['status_message'] = "Scraper lokal HTTP {$response->status()} pada {$platform}.";
            Log::warning("LocalScraperService returned non-200 for {$platform}: " . $response->body());
            return [];
        } catch (Throwable $e) {
            $this->lastMeta['engine_status'] = 'offline';
            $this->lastMeta['status_message'] = 'Layanan scraper Python tidak merespons.';
            Log::error("LocalScraperService exception for {$platform}: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Telemetry metadata captured from the most recent scrape() call.
     *
     * @return array<string, mixed>
     */
    public function getLastMeta(): array
    {
        return $this->lastMeta;
    }
}
