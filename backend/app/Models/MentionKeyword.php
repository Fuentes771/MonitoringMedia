<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MentionKeyword extends Model
{
    use HasFactory;

    protected $fillable = [
        'mention_id',
        'keyword',
        'score',
    ];

    protected $casts = [
        'score' => 'float',
    ];

    public function mention(): BelongsTo
    {
        return $this->belongsTo(Mention::class);
    }
}

