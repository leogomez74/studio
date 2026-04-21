<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WhatsappContact extends Model
{
    protected $fillable = [
        'evolution_instance_id',
        'phone_number',
        'alias',
    ];

    public function evolutionInstance()
    {
        return $this->belongsTo(EvolutionInstance::class);
    }
}
