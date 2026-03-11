<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ExternalIntegration extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'type',
        'base_url',
        'auth_type',
        'auth_token',
        'auth_user',
        'auth_password',
        'endpoints',
        'headers',
        'is_active',
        'last_sync_at',
        'last_sync_status',
        'last_sync_message',
    ];

    protected $casts = [
        'endpoints' => 'array',
        'headers' => 'array',
        'is_active' => 'boolean',
        'last_sync_at' => 'datetime',
    ];

    protected $hidden = [
        'auth_token',
        'auth_password',
    ];
}
