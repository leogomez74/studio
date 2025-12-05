<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Opportunity extends Model
{
    use HasFactory;

    // Configuración de Primary Key (Textual)
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'lead_cedula',
        'credit_type',
        'amount',
        'status',
        'start_date',
        'assigned_to_id'
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'start_date' => 'date',
    ];

    // Relación con Lead (FK: lead_cedula -> persons.cedula)
    public function lead()
    {
        return $this->belongsTo(Lead::class, 'lead_cedula', 'cedula');
    }

    // Relación con Staff
    public function staff()
    {
        return $this->belongsTo(User::class, 'assigned_to_id');
    }
}
