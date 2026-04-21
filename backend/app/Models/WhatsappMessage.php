<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WhatsappMessage extends Model
{
    protected $fillable = [
        'evolution_instance_id',
        'user_id',
        'phone_number',
        'contact_name',
        'body',
        'direction',
        'wa_message_id',
        'wa_timestamp',
    ];

    protected $casts = [
        'wa_timestamp' => 'datetime',
    ];

    public function evolutionInstance()
    {
        return $this->belongsTo(EvolutionInstance::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
