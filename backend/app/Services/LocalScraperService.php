<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class LocalScraperService
{
    protected string $baseUrl;

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
        } catch (Throwable $e) {
            return false;
        }
    }

    /**
     * Scrape social media platform via local Python engine (100% Free, zero external API key).
     *
     * @param string $platform 'x', 'tiktok', 'instagram', or 'facebook'
     * @param string $query
     * @param int $limit
     * @return array
     */
    public function scrape(string $platform, string $query, int $limit = 10): array
    {
        try {
            $response = Http::asJson()
                ->acceptJson()
                ->timeout(15)
                ->post("{$this->baseUrl}/api/v1/scraper/scrape", [
                    'platform' => strtolower($platform),
                    'query' => $query,
                    'limit' => $limit,
                ]);

            if ($response->successful()) {
                $data = $response->json();
                return $data['items'] ?? [];
            }

            Log::warning("LocalScraperService returned non-200 for {$platform}: " . $response->body());
            return [];
        } catch (Throwable $e) {
            Log::error("LocalScraperService exception for {$platform}: " . $e->getMessage());
            return [];
        }
    }
}
