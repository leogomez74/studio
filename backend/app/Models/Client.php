<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;

class Client extends Model
{
    use HasFactory;

    protected $table = 'persons';

    protected $fillable = [
        'name',
        'apellido1',
        'apellido2',
        'cedula',
        'email',
        'phone',
        'status',
        'lead_status_id',
        'assigned_to_id',
        'person_type_id',
        'whatsapp',
        'tel_casa',
        'tel_amigo',
        'province',
        'canton',
        'distrito',
        'direccion1',
        'direccion2',
        'ocupacion',
        'estado_civil',
        'fecha_nacimiento',
        'relacionado_a',
        'tipo_relacion',
        'is_active',
        'notes',
        'source',
        'genero',
        'nacionalidad',
        'telefono2',
        'telefono3',
        'institucion_labora',
        'departamento_cargo',
        'deductora_id'
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'fecha_nacimiento' => 'date',
    ];

    protected static function booted()
    {
        static::addGlobalScope('client', function (Builder $builder) {
            $builder->where('person_type_id', 2);
        });

        static::creating(function ($model) {
            $model->person_type_id = 2;
        });
    }

    public function deductora()
    {
        return $this->belongsTo(Deductora::class);
    }

    public function assignedAgent()
    {
        return $this->belongsTo(User::class, 'assigned_to_id');
    }

    // Relación con oportunidades (si aplica para clientes también)
    public function opportunities()
    {
        // Ajusta esto si tus clientes también se ligan por cédula
        return $this->hasMany(Opportunity::class, 'lead_cedula', 'cedula');
    }
}
