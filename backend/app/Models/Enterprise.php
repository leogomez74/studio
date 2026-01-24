<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Enterprise extends Model
{
    use HasFactory;

    protected $table = 'enterprises';

    protected $fillable = [
        'business_name',
    ];

    public function requirements()
    {
        return $this->hasMany(EnterprisesRequirement::class);
    }

    /**
     * Relación con Institucion (FK: business_name -> instituciones.nombre)
     */
    public function institucion()
    {
        return $this->belongsTo(Institucion::class, 'business_name', 'nombre');
    }
}
