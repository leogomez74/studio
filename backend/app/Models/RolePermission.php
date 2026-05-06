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
        'can_archive',
        'can_assign',
        'can_formalizar',
        'can_formalizar_admin',
        'can_autoaplicar_abono',
    ];

    protected $casts = [
        'can_view' => 'boolean',
        'can_create' => 'boolean',
        'can_edit' => 'boolean',
        'can_delete' => 'boolean',
        'can_archive' => 'boolean',
        'can_assign' => 'boolean',
        'can_formalizar' => 'boolean',
        'can_formalizar_admin' => 'boolean',
        'can_autoaplicar_abono' => 'boolean',
    ];

    /**
     * Relación con el rol
     */
    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }
}
