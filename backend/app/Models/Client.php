<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Client extends Person
{
    use HasFactory;

    // protected $table = 'persons'; // Inherited from Person

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
        'tel_amigo_2',
        'relacionado_a_2',
        'tipo_relacion_2',
        'is_active',
        'notes',
        'source',
        'genero',
        'nacionalidad',
        'telefono2',
        'telefono3',
        'institucion_labora',
        'departamento_cargo',
        'deductora_id',
        'cedula_vencimiento',
        'nivel_academico',
        'puesto',
        'profesion',
        'sector',
        'trabajo_provincia',
        'trabajo_canton',
        'trabajo_distrito',
        'trabajo_direccion',
        'institucion_direccion',
        'actividad_economica',
        'tipo_sociedad',
        'nombramientos',
        'estado_puesto',
        // Campos Credid
        'credid_data',
        'credid_consultado_at',
        'indice_desarrollo_social',
        'nivel_desarrollo_social',
        'total_vehiculos',
        'total_propiedades',
        'patrimonio_vehiculos',
        'patrimonio_propiedades',
        'total_hipotecas',
        'total_prendas',
        'es_pep',
        'en_listas_internacionales',
        'total_hijos',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'fecha_nacimiento' => 'date',
        'credid_data' => 'array',
        'credid_consultado_at' => 'datetime',
        'es_pep' => 'boolean',
        'en_listas_internacionales' => 'boolean',
    ];

    protected $hidden = ['credid_data'];

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
