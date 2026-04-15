<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EvolutionInstance extends Model
{
    use HasFactory;

    protected $fillable = [
        'api_key',
        'alias',
        'instance_name',
        'phone_number',
        'profile_name',
        'status',
        'is_active',
        'chatwoot_inbox_id',
    ];

    protected $casts = [
        'api_key'   => 'encrypted',
        'is_active' => 'boolean',
    ];

    protected $hidden = ['api_key'];
}
