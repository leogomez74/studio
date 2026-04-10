<?php

namespace App\Models;

use App\Models\Comment;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Lead extends Person
{
    use HasFactory;

    // Apunta a la tabla maestra
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
        'responsable',
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
        'redes_sociales',
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
        'assigned_to_id',
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
        // Campos del cuestionario
        'source',
        'interes',
        'tipo_credito',
        'monto',
        'uso_credito',
        'tiene_deudas',
        'ingreso',
        'salario_exacto',
        'experiencia_crediticia',
        'historial_mora',
        'tipo_vivienda',
        'dependientes',
        'tramites',
        'urgencia',
        'detalle_legal',
        'questionnaire_completed_at',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'fecha_nacimiento' => 'date',
        'questionnaire_completed_at' => 'datetime',
        'tramites' => 'array',
        'credid_data' => 'array',
        'credid_consultado_at' => 'datetime',
        'es_pep' => 'boolean',
        'en_listas_internacionales' => 'boolean',
    ];

    protected $hidden = ['credid_data'];

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
        return $this->belongsTo(User::class, 'assigned_to_id');
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

    public function comments()
    {
        return $this->morphMany(Comment::class, 'commentable');
    }
}
