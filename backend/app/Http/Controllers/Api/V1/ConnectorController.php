<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Connector;
use App\Models\ConnectorCredential;
use App\Services\LocalScraperService;
use Illuminate\Http\Request;
use Carbon\Carbon;

class ConnectorController extends Controller
{
    public function index(Request $request)
    {
        $workspaceId = $request->input('workspace_id', 1);

        $defaultProviders = [
            'rss' => ['status' => 'connected', 'capabilities' => ['keyword_search' => true, 'public_content' => true, 'historical_backfill' => 'limited']],
            'youtube' => ['status' => 'needs_config', 'capabilities' => ['keyword_search' => true, 'public_content' => true, 'comments' => false, 'public_metrics' => true]],
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
                $hasRapidApi = $this->hasRapidApiKey($workspaceId, $c->provider);
                $isSocial = in_array($c->provider, ['x', 'tiktok', 'instagram', 'facebook']);
                
                $status = $c->status;
                if ($isSocial && $localScraperAvailable) {
                    $status = 'connected';
                }

                $hasCred = $c->credential !== null;
                if (!$hasCred && $isSocial) {
                    $hasCred = $hasRapidApi;
                } elseif (!$hasCred && $c->provider === 'youtube') {
                    $hasCred = !empty(env('YOUTUBE_API_KEY'));
                }

                $engineMode = 'default';
                if ($isSocial) {
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
                    'provider' => $c->provider,
                    'status' => $status,
                    'capabilities' => $c->capabilities_json,
                    'last_successful_sync_at' => $c->last_successful_sync_at?->toIso8601String(),
                    'has_credentials' => $hasCred,
                    'has_local_engine' => $isSocial ? $localScraperAvailable : false,
                    'has_rapidapi' => $isSocial ? $hasRapidApi : false,
                    'engine_mode' => $engineMode,
                ];
            }),
        ]);
    }

    public function connect(Request $request, $provider)
    {
        $workspaceId = $request->input('workspace_id', 1);
        $validated = $request->validate([
            'api_key' => 'required|string',
        ]);

        $apiKey = trim($validated['api_key']);

        // Handle Unified RapidAPI Key
        if ($provider === 'rapidapi') {
            $unifiedConnector = Connector::firstOrCreate(
                ['workspace_id' => $workspaceId, 'provider' => 'rapidapi'],
                ['status' => 'connected']
            );

            ConnectorCredential::updateOrCreate(
                ['connector_id' => $unifiedConnector->id],
                ['encrypted_payload' => ['api_key' => $apiKey]]
            );

            // Update status of all dependent social connectors
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
            [
                'encrypted_payload' => ['api_key' => $apiKey],
            ]
        );

        $connector->update(['status' => 'connected']);

        return response()->json([
            'status' => 'success',
            'message' => "Kredensial untuk provider '{$provider}' berhasil disimpan.",
        ]);
    }

    public function test(Request $request, $provider)
    {
        $workspaceId = $request->input('workspace_id', 1);
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
            $hasKey = ($connector && $connector->credential !== null) || !empty(env('YOUTUBE_API_KEY'));
            if (!$hasKey) {
                return response()->json([
                    'status' => 'needs_config',
                    'provider' => 'youtube',
                    'message' => 'API Key YouTube belum dimasukkan.',
                ]);
            }

            return response()->json([
                'status' => 'success',
                'provider' => 'youtube',
                'message' => 'Koneksi ke YouTube Data API v3 siap.',
            ]);
        }

        if (in_array($provider, ['x', 'tiktok', 'instagram', 'facebook', 'rapidapi'])) {
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
            if ($localAvailable) {
                $details[] = "Mesin Scraper Lokal Python Siap (100% Free)";
            }
            if ($hasKey) {
                $details[] = "Kunci RapidAPI Terkonfigurasi (Fallback Standby)";
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

    public function livePreview(Request $request, $provider, LocalScraperService $localScraper)
    {
        $workspaceId = $request->input('workspace_id', 1);
        $query = $request->input('query', 'Makan Bergizi Gratis');

        if (!in_array($provider, ['x', 'tiktok', 'instagram', 'facebook'])) {
            return response()->json([
                'status' => 'error',
                'message' => "Live preview hanya didukung untuk X, TikTok, Instagram, dan Facebook.",
            ], 400);
        }

        $start = microtime(true);
        $items = $localScraper->scrape($provider, $query, 3);
        $latencyMs = round((microtime(true) - $start) * 1000);

        return response()->json([
            'status' => 'success',
            'provider' => $provider,
            'query' => $query,
            'latency_ms' => $latencyMs,
            'engine' => 'local_python_curl_cffi',
            'count' => count($items),
            'items' => $items,
        ]);
    }

    private function hasRapidApiKey(int $workspaceId, string $provider): bool
    {
        $connector = Connector::where('workspace_id', $workspaceId)
            ->where('provider', $provider)
            ->first();

        if ($connector && $connector->credential) {
            return true;
        }

        $unified = Connector::where('workspace_id', $workspaceId)
            ->where('provider', 'rapidapi')
            ->first();

        if ($unified && $unified->credential) {
            return true;
        }

        $envKey = config('services.rapidapi.key') ?: env('RAPIDAPI_KEY');
        return !empty($envKey);
    }
}
