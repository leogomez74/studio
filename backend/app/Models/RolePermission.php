<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RolePermission extends Model
{
    protected $fillable = [
        'role_id',
        'module_key',
        'can_view',
        'can_create',
        'can_edit',
        'can_delete',
    ];

    protected $casts = [
        'can_view' => 'boolean',
        'can_create' => 'boolean',
        'can_edit' => 'boolean',
        'can_delete' => 'boolean',
    ];

    /**
     * Relación con el rol
     */
    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }
}
