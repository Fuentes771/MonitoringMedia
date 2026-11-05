<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SentimentResult extends Model
{
    use HasFactory;

    protected $fillable = [
        'mention_id',
        'label',
        'confidence',
        'probabilities_json',
        'model_version',
        'analyzed_at',
    ];

    protected $casts = [
        'confidence' => 'float',
        'probabilities_json' => 'array',
        'analyzed_at' => 'datetime',
    ];

    public function mention(): BelongsTo
    {
        return $this->belongsTo(Mention::class);
    }
}
