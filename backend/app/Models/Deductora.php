<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Deductora extends Model
{
    use HasFactory;

    protected $fillable = [
        'nombre',
        'fecha_reporte_pago',
        'comision'
    ];

    protected $casts = [
        'fecha_reporte_pago' => 'date',
        'comision' => 'decimal:2'
    ];

    public function clients()
    {
        return $this->hasMany(Client::class);
    }

    public function credits()
    {
        return $this->hasMany(Credit::class);
    }
}
