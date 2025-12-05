<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;

class Lead extends Model
{
    use HasFactory;

    // Apunta a la tabla maestra
    protected $table = 'persons';

    protected $fillable = [
        'name',
        'cedula',
        'email',
        'phone',
        'status',
        'lead_status_id',
        'assigned_agent_id',
        'person_type_id', // Importante para el STI
        // Agrega aquí otros campos si los necesitas (ej: direccion1, etc)
    ];

    /**
     * El "Global Scope" para filtrar automáticamente
     */
    protected static function booted()
    {
        // Al consultar: Solo trae Leads (tipo 1)
        static::addGlobalScope('is_lead', function (Builder $builder) {
            $builder->where('person_type_id', 1);
        });

        // Al crear: Asigna tipo 1 automáticamente
        static::creating(function ($model) {
            $model->person_type_id = 1;
        });
    }

    // Relaciones
    public function assignedAgent()
    {
        return $this->belongsTo(User::class, 'assigned_agent_id');
    }

    public function leadStatus()
    {
        return $this->belongsTo(LeadStatus::class, 'lead_status_id');
    }

    // Relación especial con Oportunidades (por Cédula)
    public function opportunities()
    {
        return $this->hasMany(Opportunity::class, 'lead_cedula', 'cedula');
    }
}
