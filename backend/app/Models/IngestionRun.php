<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IngestionRun extends Model
{
    use HasFactory;

    protected $fillable = [
        'connector_id',
        'topic_id',
        'status',
        'counts_json',
        'error_code',
        'error_message',
        'started_at',
        'finished_at',
    ];

    protected $casts = [
        'counts_json' => 'array',
        'started_at' => 'datetime',
        'finished_at' => 'datetime',
    ];

    public function connector(): BelongsTo
    {
        return $this->belongsTo(Connector::class);
    }

    public function topic(): BelongsTo
    {
        return $this->belongsTo(Topic::class);
    }
}
