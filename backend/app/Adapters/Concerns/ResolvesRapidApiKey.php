<?php

namespace App\Adapters\Concerns;

use App\Models\Connector;

trait ResolvesRapidApiKey
{
    /**
     * Resolves the RapidAPI Key for a given provider and workspace.
     */
    protected function resolveRapidApiKey(int $workspaceId, string $providerKey): ?string
    {
        // 1. Check provider-specific credential
        $connector = Connector::where('workspace_id', $workspaceId)
            ->where('provider', $providerKey)
            ->first();

        if ($connector && $connector->credential) {
            $payload = $connector->credential->encrypted_payload;
            if (is_array($payload) && !empty($payload['api_key'])) {
                return $payload['api_key'];
            }
            if (is_string($payload) && !empty($payload)) {
                return $payload;
            }
        }

        // 2. Check unified 'rapidapi' connector credential
        $unified = Connector::where('workspace_id', $workspaceId)
            ->where('provider', 'rapidapi')
            ->first();

        if ($unified && $unified->credential) {
            $payload = $unified->credential->encrypted_payload;
            if (is_array($payload) && !empty($payload['api_key'])) {
                return $payload['api_key'];
            }
            if (is_string($payload) && !empty($payload)) {
                return $payload;
            }
        }

        // 3. Fallback to services.rapidapi.key
        $envKey = config('services.rapidapi.key');
        if (!empty($envKey)) {
            return $envKey;
        }

        return null;
    }
}

