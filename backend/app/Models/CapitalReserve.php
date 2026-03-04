<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CapitalReserve extends Model
{
    use HasFactory;

    protected $fillable = [
        'investor_id',
        'investment_id',
        'monto_reserva',
        'descripcion',
    ];

    protected $casts = [
        'monto_reserva' => 'decimal:2',
    ];

    public function investor()
    {
        return $this->belongsTo(Investor::class);
    }

    public function investment()
    {
        return $this->belongsTo(Investment::class);
    }
}
