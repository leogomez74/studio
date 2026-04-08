<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EvolutionServerConfig extends Model
{
    protected $table = 'evolution_server_config';

    protected $fillable = ['base_url'];

    /**
     * Devuelve la única fila de configuración, creándola si no existe.
     */
    public static function instance(): self
    {
        return self::firstOrCreate([], ['base_url' => '']);
    }
}
