<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MentionTopicMatch extends Model
{
    use HasFactory;

    protected $fillable = [
        'mention_id',
        'topic_id',
        'matched_keywords_json',
    ];

    protected $casts = [
        'matched_keywords_json' => 'array',
    ];

    public function mention(): BelongsTo
    {
        return $this->belongsTo(Mention::class);
    }

    public function topic(): BelongsTo
    {
        return $this->belongsTo(Topic::class);
    }
}
