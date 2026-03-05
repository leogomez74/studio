<?php

namespace App\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InvestmentRateHistory extends Model
{
    use HasFactory;

    protected $table = 'investment_rate_history';

    protected $fillable = [
        'investment_id',
        'tasa_anterior',
        'tasa_nueva',
        'cambiado_por',
        'motivo',
    ];

    protected $casts = [
        'tasa_anterior' => 'decimal:4',
        'tasa_nueva' => 'decimal:4',
    ];

    public function investment()
    {
        return $this->belongsTo(Investment::class);
    }

    public function changedBy()
    {
        return $this->belongsTo(User::class, 'cambiado_por');
    }
}
