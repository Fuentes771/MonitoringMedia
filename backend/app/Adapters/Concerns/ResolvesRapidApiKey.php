<?php

namespace App\Adapters\Concerns;

use App\Models\Connector;

trait ResolvesRapidApiKey
{
    protected function isUsableApiKey(?string $key): bool
    {
        if ($key === null) {
            return false;
        }

        $trimmed = trim($key);
        if ($trimmed === '') {
            return false;
        }

        $lower = strtolower($trimmed);
        $placeholders = ['your_rapidapi_key', 'your_youtube_api_key', 'changeme', 'replace_me', 'placeholder'];
        foreach ($placeholders as $token) {
            if (str_contains($lower, $token)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Resolves the RapidAPI Key for a given provider and workspace.
     */
    protected function resolveRapidApiKey(int $workspaceId, string $providerKey): ?string
    {
        $connector = Connector::where('workspace_id', $workspaceId)
            ->where('provider', $providerKey)
            ->first();

        if ($connector && $connector->credential) {
            $payload = $connector->credential->encrypted_payload;
            if (is_array($payload) && $this->isUsableApiKey($payload['api_key'] ?? null)) {
                return trim($payload['api_key']);
            }
            if (is_string($payload) && $this->isUsableApiKey($payload)) {
                return trim($payload);
            }
        }

        $unified = Connector::where('workspace_id', $workspaceId)
            ->where('provider', 'rapidapi')
            ->first();

        if ($unified && $unified->credential) {
            $payload = $unified->credential->encrypted_payload;
            if (is_array($payload) && $this->isUsableApiKey($payload['api_key'] ?? null)) {
                return trim($payload['api_key']);
            }
            if (is_string($payload) && $this->isUsableApiKey($payload)) {
                return trim($payload);
            }
        }

        $envKey = config('services.rapidapi.key');
        if ($this->isUsableApiKey($envKey)) {
            return trim((string) $envKey);
        }

        return null;
    }
}
