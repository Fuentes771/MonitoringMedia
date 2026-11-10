<?php

namespace App\Adapters;

use App\Models\Topic;

interface ProviderAdapterInterface
{
    /**
     * Get provider key identifier (rss, youtube, reddit, etc.)
     */
    public function getProviderKey(): string;

    /**
     * Capability declaration conforming to PRD §4.2
     * @return array<string, mixed>
     */
    public function getCapabilities(): array;

    /**
     * Fetch mentions for the given topic.
     */
    public function fetch(Topic $topic, ?string $cursor = null): IngestionResult;
}

