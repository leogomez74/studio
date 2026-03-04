<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Investor extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'cedula',
        'email',
        'phone',
        'status',
        'tipo_persona',
        'notas',
        'cuenta_bancaria',
        'banco',
        'joined_at',
    ];

    protected $casts = [
        'joined_at' => 'date',
    ];

    protected $appends = [];

    public function investments()
    {
        return $this->hasMany(Investment::class);
    }

    public function payments()
    {
        return $this->hasMany(InvestmentPayment::class);
    }

    public function capitalReserves()
    {
        return $this->hasMany(CapitalReserve::class);
    }

    public function getActiveInvestmentsCountAttribute(): int
    {
        return $this->investments()->where('estado', 'Activa')->count();
    }
}
