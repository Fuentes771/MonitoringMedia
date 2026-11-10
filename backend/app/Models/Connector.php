<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Connector extends Model
{
    use HasFactory;

    protected $fillable = [
        'workspace_id',
        'provider',
        'status',
        'capabilities_json',
        'last_successful_sync_at',
    ];

    protected $casts = [
        'capabilities_json' => 'array',
        'last_successful_sync_at' => 'datetime',
    ];

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function credential(): HasOne
    {
        return $this->hasOne(ConnectorCredential::class);
    }

    public function ingestionRuns(): HasMany
    {
        return $this->hasMany(IngestionRun::class);
    }
}

