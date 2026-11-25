<?php

namespace App\Http\Middleware;

use App\Models\Workspace;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateMuseApiKey
{
    public function handle(Request $request, Closure $next): Response
    {
        $providedKey = trim((string) $request->header('X-TRINETRA-API-KEY', ''));

        if ($providedKey === '') {
            return response()->json([
                'status' => 'error',
                'error' => 'missing_api_key',
                'message' => 'Header X-TRINETRA-API-KEY wajib disertakan.',
            ], 401);
        }

        $configuredKeys = $this->resolveConfiguredKeys();
        $matched = false;

        foreach ($configuredKeys as $candidate) {
            if (hash_equals($candidate, $providedKey)) {
                $matched = true;
            }
        }

        if (!$matched) {
            return response()->json([
                'status' => 'error',
                'error' => 'invalid_api_key',
                'message' => 'API Key tidak valid atau konektor Muse belum dikonfigurasi.',
            ], 403);
        }

        $workspaceId = $this->resolveTargetWorkspaceId();
        if ($workspaceId === null) {
            return response()->json([
                'status' => 'error',
                'error' => 'workspace_unavailable',
                'message' => 'Workspace TRINETRA belum tersedia.',
            ], 503);
        }

        $request->attributes->set('muse_workspace_id', $workspaceId);
        $request->attributes->set('muse_api_key_hash', hash('sha256', $providedKey));

        return $next($request);
    }

    /**
     * @return array<int, string>
     */
    private function resolveConfiguredKeys(): array
    {
        $raw = config('services.muse.api_keys', []);

        if (is_string($raw)) {
            $raw = explode(',', $raw);
        }

        if (!is_array($raw)) {
            return [];
        }

        return array_values(array_filter(
            array_map(fn ($k) => is_string($k) ? trim($k) : '', $raw),
            fn (string $k) => $k !== ''
        ));
    }

    private function resolveTargetWorkspaceId(): ?int
    {
        $configuredId = config('services.muse.workspace_id');
        if (is_numeric($configuredId) && (int) $configuredId > 0) {
            $exists = Workspace::where('id', (int) $configuredId)->value('id');
            if ($exists) {
                return (int) $exists;
            }
        }

        $primaryId = Workspace::where('slug', 'pulsescope-hub')->value('id')
            ?? Workspace::query()->orderBy('id')->value('id');

        return $primaryId ? (int) $primaryId : null;
    }
}
