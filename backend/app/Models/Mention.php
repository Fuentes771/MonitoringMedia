<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Mention extends Model
{
    use HasFactory;

    protected $fillable = [
        'workspace_id',
        'provider',
        'external_id',
        'source_url',
        'author_name',
        'published_at',
        'collected_at',
        'text',
        'text_normalized',
        'language',
        'deletion_status',
        'is_demo',
        'is_inauthentic',
        'inauthentic_score',
        'is_sarcasm',
        'bot_cluster_id',
        'metadata_json',
    ];

    protected $casts = [
        'published_at' => 'datetime',
        'collected_at' => 'datetime',
        'is_demo' => 'boolean',
        'is_inauthentic' => 'boolean',
        'inauthentic_score' => 'float',
        'is_sarcasm' => 'boolean',
        'metadata_json' => 'array',
    ];

    public function scopeOrganic($query)
    {
        return $query->where(function ($q) {
            $q->where('is_inauthentic', false)
              ->orWhereNull('is_inauthentic');
        });
    }

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function topics(): BelongsToMany
    {
        return $this->belongsToMany(Topic::class, 'mention_topic_matches')
            ->withPivot('matched_keywords_json')
            ->withTimestamps();
    }

    public function sentiment(): HasOne
    {
        return $this->hasOne(SentimentResult::class);
    }

    public function keywords(): HasMany
    {
        return $this->hasMany(MentionKeyword::class);
    }
}

