<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Topic extends Model
{
    use HasFactory;

    protected $fillable = [
        'workspace_id',
        'name',
        'description',
        'status',
        'match_mode',
        'language_filters',
        'providers',
        'is_demo',
    ];

    protected $casts = [
        'language_filters' => 'array',
        'providers' => 'array',
        'is_demo' => 'boolean',
    ];

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function keywords(): HasMany
    {
        return $this->hasMany(TopicKeyword::class);
    }

    public function mentions(): BelongsToMany
    {
        return $this->belongsToMany(Mention::class, 'mention_topic_matches')
            ->withPivot('matched_keywords_json')
            ->withTimestamps();
    }

    public function alerts(): HasMany
    {
        return $this->hasMany(Alert::class);
    }

    public function trendSnapshots(): HasMany
    {
        return $this->hasMany(TrendSnapshot::class);
    }
}
