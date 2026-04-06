<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BugImage extends Model
{
    protected $fillable = [
        'bug_id',
        'path',
        'original_name',
        'size',
    ];

    public function bug(): BelongsTo
    {
        return $this->belongsTo(Bug::class);
    }
}
