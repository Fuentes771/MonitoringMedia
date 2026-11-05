<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConnectorCredential extends Model
{
    use HasFactory;

    protected $fillable = [
        'connector_id',
        'encrypted_payload',
        'expires_at',
    ];

    protected $casts = [
        'encrypted_payload' => 'encrypted',
        'expires_at' => 'datetime',
    ];

    public function connector(): BelongsTo
    {
        return $this->belongsTo(Connector::class);
    }
}
