<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class Comment extends Model
{
    protected $fillable = [
        'parent_id',
        'commentable_type',
        'commentable_id',
        'user_id',
        'body',
        'comment_type',
        'metadata',
        'mentions',
        'archived_at',
    ];

    protected $casts = [
        'mentions'    => 'array',
        'metadata'    => 'array',
        'archived_at' => 'datetime',
    ];

    public function commentable(): MorphTo
    {
        return $this->morphTo();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(Comment::class, 'parent_id');
    }

    public function replies(): HasMany
    {
        return $this->hasMany(Comment::class, 'parent_id')
            ->orderBy('created_at', 'asc');
    }

    public function scopeRoots($query)
    {
        return $query->whereNull('parent_id');
    }

    public function scopeVisible($query)
    {
        return $query->whereNull('archived_at');
    }

    /** Compute a human-readable reference for the related entity */
    public function getEntityReferenceAttribute(): string
    {
        $entity = $this->commentable;
        if (! $entity) {
            return "#{$this->commentable_id}";
        }

        return match (true) {
            $entity instanceof Credit      => $entity->reference ?? "#{$entity->id}",
            $entity instanceof Opportunity => (string) $entity->id,
            $entity instanceof Lead,
            $entity instanceof Client      => $entity->cedula ?? $entity->name ?? "#{$entity->id}",
            $entity instanceof Analisis    => $entity->reference ?? "#{$entity->id}",
            $entity instanceof User        => $entity->name ?? "Usuario #{$entity->id}",
            default                        => "#{$this->commentable_id}",
        };
    }
}
