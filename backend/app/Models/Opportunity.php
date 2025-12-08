<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;

class Opportunity extends Model
{
    use HasFactory;

    protected $table = 'opportunities';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'lead_cedula',
        'opportunity_type',
        'vertical',
        'amount',
        'status',
        'expected_close_date',
        'comments',
        'assigned_to_id'
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'expected_close_date' => 'date',
    ];

    protected static function booted()
    {
        static::creating(function ($model) {
            if (empty($model->id)) {
                $year = date('y');
                $prefix = $year . '-';
                $suffix = '-OP';

                // Find the last ID with this prefix
                $lastRecord = static::where('id', 'like', $prefix . '%' . $suffix)
                    ->orderBy('id', 'desc')
                    ->first();

                $sequence = 1;
                if ($lastRecord) {
                    // Extract sequence: 25-00004-OP -> 00004
                    $parts = explode('-', $lastRecord->id);
                    if (count($parts) === 3) {
                        $sequence = intval($parts[1]) + 1;
                    }
                }

                $model->id = $prefix . str_pad($sequence, 5, '0', STR_PAD_LEFT) . $suffix;
            }
        });
    }

    // Relación con Lead (FK: lead_cedula -> persons.cedula)
    public function lead()
    {
        return $this->belongsTo(Lead::class, 'lead_cedula', 'cedula');
    }

    // Relación con User (Agente asignado)
    public function user()
    {
        return $this->belongsTo(User::class, 'assigned_to_id');
    }
}
