<?php

namespace App\Adapters;

class IngestionResult
{
    /**
     * @param array<int, array<string, mixed>> $records
     * @param array<string, int> $counts
     */
    public function __construct(
        public array $records = [],
        public ?string $nextCursor = null,
        public ?string $errorCode = null,
        public ?string $errorMessage = null,
        public array $counts = ['collected' => 0, 'new' => 0, 'duplicates' => 0]
    ) {}

    public function isSuccess(): bool
    {
        return $this->errorCode === null;
    }
}
