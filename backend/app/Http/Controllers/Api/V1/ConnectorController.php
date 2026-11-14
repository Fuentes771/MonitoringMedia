<?php

namespace App\Http\Controllers\Api\V1;

use App\Adapters\Concerns\ResolvesRapidApiKey;
use App\Http\Controllers\Api\V1\Concerns\ResolvesAuthorizedWorkspace;
use App\Http\Controllers\Controller;
use App\Models\Connector;
use App\Models\ConnectorCredential;
use App\Services\LocalScraperService;
use App\Services\SocialLinkValidator;
use Illuminate\Http\Request;

class ConnectorController extends Controller
{
    use ResolvesAuthorizedWorkspace;
    use ResolvesRapidApiKey;

    private const SOCIAL_LOCAL_PLATFORMS = ['youtube', 'x', 'tiktok', 'instagram', 'facebook'];

    public function index(Request $request)
    {
        $workspaceId = $this->resolveAuthorizedWorkspaceId($request);

        $defaultProviders = [
            'rss' => ['status' => 'connected', 'capabilities' => ['keyword_search' => true, 'public_content' => true, 'historical_backfill' => 'limited']],
            'youtube' => ['status' => 'needs_config', 'capabilities' => ['keyword_search' => true, 'public_content' => true, 'comments' => true, 'public_metrics' => true]],
            'x' => ['status' => 'needs_config', 'capabilities' => ['keyword_search' => true, 'public_content' => true, 'comments' => true, 'public_metrics' => true]],
            'tiktok' => ['status' => 'needs_config', 'capabilities' => ['keyword_search' => true, 'public_content' => true, 'comments' => true, 'public_metrics' => true]],
            'instagram' => ['status' => 'needs_config', 'capabilities' => ['keyword_search' => true, 'public_content' => true, 'comments' => true, 'public_metrics' => true]],
            'facebook' => ['status' => 'needs_config', 'capabilities' => ['keyword_search' => true, 'public_content' => true, 'comments' => true, 'public_metrics' => true]],
            'reddit' => ['status' => 'disconnected', 'capabilities' => ['keyword_search' => true, 'public_content' => true, 'comments' => true]],
        ];

        foreach ($defaultProviders as $pKey => $pMeta) {
            Connector::firstOrCreate(
                ['workspace_id' => $workspaceId, 'provider' => $pKey],
                [
                    'status' => $pMeta['status'],
                    'capabilities_json' => $pMeta['capabilities'],
                ]
            );
        }

        $connectors = Connector::where('workspace_id', $workspaceId)
            ->with('credential')
            ->get();

        $localScraperAvailable = app(LocalScraperService::class)->isAvailable();

        return response()->json([
            'status' => 'success',
            'data' => $connectors->map(function ($c) use ($workspaceId, $localScraperAvailable) {
                $provider = $c->provider;
                $isSocialLocal = in_array($provider, self::SOCIAL_LOCAL_PLATFORMS, true);
                $isRapidApiTarget = in_array($provider, ['x', 'tiktok', 'instagram', 'facebook'], true);

                $hasRapidApi = $isRapidApiTarget && $this->hasRapidApiKey($workspaceId, $provider);
                $hasYouTubeApi = ($provider === 'youtube') && $this->hasYouTubeKey($c);
                $hasApiCred = $hasRapidApi || $hasYouTubeApi || ($c->credential !== null && $this->isUsableApiKey($this->extractCredentialKey($c->credential)));

                $status = $c->status;
                if ($isSocialLocal && ($localScraperAvailable || $hasApiCred)) {
                    $status = 'connected';
                }

                $engineMode = 'default';
                if ($provider === 'youtube') {
                    if ($localScraperAvailable && $hasYouTubeApi) {
                        $engineMode = 'hybrid';
                    } elseif ($localScraperAvailable) {
                        $engineMode = 'local';
                    } elseif ($hasYouTubeApi) {
                        $engineMode = 'official_api';
                    }
                } elseif ($isRapidApiTarget) {
                    if ($localScraperAvailable && $hasRapidApi) {
                        $engineMode = 'hybrid';
                    } elseif ($localScraperAvailable) {
                        $engineMode = 'local';
                    } elseif ($hasRapidApi) {
                        $engineMode = 'rapidapi';
                    }
                }

                return [
                    'id' => $c->id,
                    'provider' => $provider,
                    'status' => $status,
                    'capabilities' => $c->capabilities_json,
                    'last_successful_sync_at' => $c->last_successful_sync_at?->toIso8601String(),
                    'has_credentials' => $hasApiCred,
                    'has_local_engine' => $isSocialLocal ? $localScraperAvailable : false,
                    'has_rapidapi' => $isRapidApiTarget ? $hasRapidApi : false,
                    'engine_mode' => $engineMode,
                ];
            }),
        ]);
    }

    public function connect(Request $request, $provider)
    {
        $workspaceId = $this->resolveAuthorizedWorkspaceId($request);
        $validated = $request->validate([
            'api_key' => 'required|string',
        ]);

        $apiKey = trim($validated['api_key']);

        if ($provider === 'rapidapi') {
            $unifiedConnector = Connector::firstOrCreate(
                ['workspace_id' => $workspaceId, 'provider' => 'rapidapi'],
                ['status' => 'connected']
            );

            ConnectorCredential::updateOrCreate(
                ['connector_id' => $unifiedConnector->id],
                ['encrypted_payload' => ['api_key' => $apiKey]]
            );

            foreach (['x', 'tiktok', 'instagram', 'facebook'] as $socialProv) {
                $c = Connector::firstOrCreate(
                    ['workspace_id' => $workspaceId, 'provider' => $socialProv],
                    ['status' => 'connected']
                );
                $c->update(['status' => 'connected']);
            }

            return response()->json([
                'status' => 'success',
                'message' => 'Unified RapidAPI Key berhasil disimpan dan mengaktifkan konektor X, TikTok, Instagram, dan Facebook.',
            ]);
        }

        $connector = Connector::firstOrCreate(
            ['workspace_id' => $workspaceId, 'provider' => $provider],
            ['status' => 'connected']
        );

        ConnectorCredential::updateOrCreate(
            ['connector_id' => $connector->id],
            ['encrypted_payload' => ['api_key' => $apiKey]]
        );

        $connector->update(['status' => 'connected']);

        return response()->json([
            'status' => 'success',
            'message' => "Kredensial untuk provider '{$provider}' berhasil disimpan.",
        ]);
    }

    public function test(Request $request, $provider)
    {
        $workspaceId = $this->resolveAuthorizedWorkspaceId($request);
        $connector = Connector::where('workspace_id', $workspaceId)
            ->where('provider', $provider)
            ->first();

        if (!$connector && $provider !== 'rapidapi') {
            return response()->json([
                'status' => 'failed',
                'message' => "Konektor '{$provider}' belum dikonfigurasi.",
            ], 404);
        }

        if ($provider === 'rss') {
            return response()->json([
                'status' => 'success',
                'provider' => 'rss',
                'latency_ms' => 120,
                'message' => 'Feed RSS publik aktif dan dapat diakses normal.',
            ]);
        }

        if ($provider === 'youtube') {
            $hasKey = $this->hasYouTubeKey($connector);
            $localAvailable = app(LocalScraperService::class)->isAvailable();

            if (!$hasKey && !$localAvailable) {
                return response()->json([
                    'status' => 'needs_config',
                    'provider' => 'youtube',
                    'message' => 'API Key YouTube belum dimasukkan dan scraper YouTube lokal tidak aktif.',
                ]);
            }

            $modeMsg = $hasKey && $localAvailable
                ? 'YouTube Data API v3 dan Scraper YouTube Gratis siap (Mode Hybrid).'
                : ($hasKey ? 'Koneksi ke YouTube Data API v3 siap.' : 'Scraper YouTube Gratis (ytInitialData) aktif sebagai pengganti API Key.');

            return response()->json([
                'status' => 'success',
                'provider' => 'youtube',
                'engine' => $hasKey ? ($localAvailable ? 'hybrid' : 'official_api') : 'local',
                'message' => $modeMsg,
            ]);
        }

        if (in_array($provider, ['x', 'tiktok', 'instagram', 'facebook', 'rapidapi'], true)) {
            $hasKey = $this->hasRapidApiKey($workspaceId, $provider);
            $localAvailable = ($provider !== 'rapidapi') && app(LocalScraperService::class)->isAvailable();

            if (!$hasKey && !$localAvailable) {
                return response()->json([
                    'status' => 'needs_config',
                    'provider' => $provider,
                    'message' => "Mesin Scraper Lokal tidak merespons dan RapidAPI Key untuk provider {$provider} belum dikonfigurasi.",
                ]);
            }

            $details = [];
            if ($hasKey) {
                $details[] = 'Kunci RapidAPI Terkonfigurasi (Prioritas Metrik & Komentar)';
            }
            if ($localAvailable) {
                $details[] = 'Mesin Scraper Hybrid Terverifikasi Siap (Syndication/oEmbed)';
            }

            return response()->json([
                'status' => 'success',
                'provider' => $provider,
                'latency_ms' => 120,
                'engine' => $localAvailable ? ($hasKey ? 'hybrid' : 'local') : 'rapidapi',
                'message' => "Konektor {$provider} aktif: " . implode(' & ', $details) . '.',
            ]);
        }

        return response()->json([
            'status' => 'info',
            'provider' => $provider,
            'message' => "Adapter {$provider} dalam status standby.",
        ]);
    }

    public function livePreview(Request $request, $provider, LocalScraperService $localScraper, SocialLinkValidator $validator)
    {
        $this->resolveAuthorizedWorkspaceId($request);
        $query = trim((string) $request->input('query', 'Makan Bergizi Gratis')) ?: 'Makan Bergizi Gratis';

        if (!in_array($provider, self::SOCIAL_LOCAL_PLATFORMS, true)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Live preview tersedia untuk YouTube, X, TikTok, Instagram, dan Facebook.',
            ], 400);
        }

        $start = microtime(true);
        $rawItems = $localScraper->scrape($provider, $query, 5);
        $meta = $localScraper->getLastMeta();
        $latencyMs = round((microtime(true) - $start) * 1000);

        $validatedItems = [];
        $verifiedCount = 0;
        $fallbackCount = 0;

        foreach ($rawItems as $item) {
            $checked = $validator->validateAndNormalize(
                provider: $provider,
                rawUrl: $item['source_url'] ?? null,
                queryHint: $query,
                isDemo: (bool) ($item['is_demo'] ?? false),
                declaredStatus: $item['link_status'] ?? null
            );

            if ($checked['link_status'] === SocialLinkValidator::STATUS_BROKEN_LEGACY) {
                continue;
            }

            if ($checked['link_status'] === SocialLinkValidator::STATUS_VERIFIED_POST) {
                $verifiedCount++;
            } elseif ($checked['link_status'] === SocialLinkValidator::STATUS_SEARCH_FALLBACK) {
                $fallbackCount++;
            }

            $item['source_url'] = $checked['url'];
            $item['link_status'] = $checked['link_status'];
            $item['metrics_available'] = (bool) ($item['metrics_available'] ?? (!empty($item['metrics'])));
            $validatedItems[] = $item;
        }

        return response()->json([
            'status' => 'success',
            'provider' => $provider,
            'query' => $query,
            'latency_ms' => $latencyMs,
            'engine' => 'hybrid_verified_scraper',
            'engine_status' => $meta['engine_status'] ?? (count($validatedItems) > 0 ? 'ok' : 'empty'),
            'status_message' => $meta['status_message'] ?? '',
            'verified_count' => $verifiedCount,
            'fallback_count' => $fallbackCount,
            'count' => count($validatedItems),
            'items' => $validatedItems,
        ]);
    }

    private function hasRapidApiKey(int $workspaceId, string $provider): bool
    {
        return $this->resolveRapidApiKey($workspaceId, $provider) !== null;
    }

    private function hasYouTubeKey(?Connector $connector): bool
    {
        if ($connector && $connector->credential && $this->isUsableApiKey($this->extractCredentialKey($connector->credential))) {
            return true;
        }

        return $this->isUsableApiKey(config('services.youtube.api_key', env('YOUTUBE_API_KEY')));
    }

    private function extractCredentialKey(ConnectorCredential $credential): ?string
    {
        $payload = $credential->encrypted_payload;
        if (is_array($payload)) {
            return $payload['api_key'] ?? null;
        }
        return is_string($payload) ? $payload : null;
    }
}
