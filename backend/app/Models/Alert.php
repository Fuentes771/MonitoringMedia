<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Alert extends Model
{
    use HasFactory;

    protected $fillable = [
        'workspace_id',
        'topic_id',
        'type',
        'threshold_json',
        'cooldown_minutes',
        'last_triggered_at',
        'is_active',
    ];

    protected $casts = [
        'threshold_json' => 'array',
        'cooldown_minutes' => 'integer',
        'last_triggered_at' => 'datetime',
        'is_active' => 'boolean',
    ];

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function topic(): BelongsTo
    {
        return $this->belongsTo(Topic::class);
    }

    public function events(): HasMany
    {
        return $this->hasMany(AlertEvent::class);
    }
}

