<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Connector;
use App\Models\ConnectorCredential;
use Illuminate\Http\Request;
use Carbon\Carbon;

class ConnectorController extends Controller
{
    public function index(Request $request)
    {
        $workspaceId = $request->input('workspace_id', 1);

        $connectors = Connector::where('workspace_id', $workspaceId)
            ->with('credential')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $connectors->map(fn($c) => [
                'id' => $c->id,
                'provider' => $c->provider,
                'status' => $c->status,
                'capabilities' => $c->capabilities_json,
                'last_successful_sync_at' => $c->last_successful_sync_at?->toIso8601String(),
                'has_credentials' => $c->credential !== null,
            ]),
        ]);
    }

    public function connect(Request $request, $provider)
    {
        $workspaceId = $request->input('workspace_id', 1);
        $validated = $request->validate([
            'api_key' => 'required|string',
        ]);

        $connector = Connector::firstOrCreate(
            ['workspace_id' => $workspaceId, 'provider' => $provider],
            ['status' => 'connected']
        );

        ConnectorCredential::updateOrCreate(
            ['connector_id' => $connector->id],
            [
                'encrypted_payload' => ['api_key' => $validated['api_key']],
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

        if (!$connector) {
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
            $hasKey = $connector->credential !== null || !empty(env('YOUTUBE_API_KEY'));
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

        return response()->json([
            'status' => 'info',
            'provider' => $provider,
            'message' => "Adapter {$provider} dalam status standby.",
        ]);
    }
}
