<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TrendSnapshot extends Model
{
    use HasFactory;

    protected $fillable = [
        'workspace_id',
        'topic_id',
        'window_start',
        'window_end',
        'score',
        'sample_count',
        'components_json',
        'explanation',
    ];

    protected $casts = [
        'window_start' => 'datetime',
        'window_end' => 'datetime',
        'score' => 'float',
        'sample_count' => 'integer',
        'components_json' => 'array',
    ];

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function topic(): BelongsTo
    {
        return $this->belongsTo(Topic::class);
    }
}
