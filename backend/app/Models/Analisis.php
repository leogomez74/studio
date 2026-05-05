<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Comment;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Analisis extends Model
{
    use HasFactory;

    protected $table = 'analisis';
    protected $fillable = [
        'reference',
        'title',
        'estado_pep',
        'estado_cliente',
        'category',
        'monto_solicitado',
        'monto_sugerido',
        'cuota',
        'lead_id',
        'opportunity_id',
        'assigned_to',
        'opened_at',
        'description',
        'divisa',
        'plazo',
        'ingreso_bruto',
        'ingreso_neto',
        'ingreso_bruto_2',
        'ingreso_neto_2',
        'ingreso_bruto_3',
        'ingreso_neto_3',
        'ingreso_bruto_4',
        'ingreso_neto_4',
        'ingreso_bruto_5',
        'ingreso_neto_5',
        'ingreso_bruto_6',
        'ingreso_neto_6',
        'ingreso_bruto_7',
        'ingreso_neto_7',
        'ingreso_bruto_8',
        'ingreso_neto_8',
        'ingreso_bruto_9',
        'ingreso_neto_9',
        'ingreso_bruto_10',
        'ingreso_neto_10',
        'ingreso_bruto_11',
        'ingreso_neto_11',
        'ingreso_bruto_12',
        'ingreso_neto_12',
        'numero_manchas',
        'numero_juicios',
        'numero_embargos',
        'propuesta',
        'cargo',
        'nombramiento',
        'salarios_anteriores',
        'deducciones',
        // manchas_detalle, juicios_detalle, embargos_detalle ahora en tablas separadas
        'deducciones_mensuales',
        'hoja_trabajo_datos',
        'constancia_certificada',
        'constancia_metodo',
        'constancia_archivo',
        'constancia_certificada_por',
        'constancia_certificada_at',
        'constancia_notas',
        'constancia_resultado',
    ];

    protected $casts = [
        'opened_at' => 'date',
        'monto_solicitado' => 'decimal:2',
        'monto_sugerido' => 'decimal:2',
        'cuota' => 'decimal:2',
        'ingreso_bruto' => 'decimal:2',
        'ingreso_neto' => 'decimal:2',
        'ingreso_bruto_2' => 'decimal:2',
        'ingreso_neto_2' => 'decimal:2',
        'ingreso_bruto_3' => 'decimal:2',
        'ingreso_neto_3' => 'decimal:2',
        'ingreso_bruto_4' => 'decimal:2',
        'ingreso_neto_4' => 'decimal:2',
        'ingreso_bruto_5' => 'decimal:2',
        'ingreso_neto_5' => 'decimal:2',
        'ingreso_bruto_6' => 'decimal:2',
        'ingreso_neto_6' => 'decimal:2',
        'ingreso_bruto_7' => 'decimal:2',
        'ingreso_neto_7' => 'decimal:2',
        'ingreso_bruto_8' => 'decimal:2',
        'ingreso_neto_8' => 'decimal:2',
        'ingreso_bruto_9' => 'decimal:2',
        'ingreso_neto_9' => 'decimal:2',
        'ingreso_bruto_10' => 'decimal:2',
        'ingreso_neto_10' => 'decimal:2',
        'ingreso_bruto_11' => 'decimal:2',
        'ingreso_neto_11' => 'decimal:2',
        'ingreso_bruto_12' => 'decimal:2',
        'ingreso_neto_12' => 'decimal:2',
        'plazo' => 'integer',
        'numero_manchas' => 'integer',
        'numero_juicios' => 'integer',
        'numero_embargos' => 'integer',
        'salarios_anteriores' => 'array',
        'deducciones' => 'array',
        // manchas_detalle, juicios_detalle, embargos_detalle ahora en tablas separadas
        'deducciones_mensuales' => 'array',
        'hoja_trabajo_datos' => 'array',
        'constancia_certificada' => 'boolean',
        'constancia_certificada_at' => 'datetime',
        'constancia_resultado' => 'array',
    ];

    protected $hidden = [
        'manchas_detalle',
        'juicios_detalle',
        'embargos_detalle',
    ];

    protected $appends = [
        'has_credit',
        'credit_id',
        'credit_status',
        'monto_credito',
        'score_riesgo',
        'score_riesgo_color',
        'score_riesgo_label',
    ];

    protected static function booted()
    {
        static::creating(function ($model) {
            // La referencia es el ID de la oportunidad asociada
            if (empty($model->reference) && !empty($model->opportunity_id)) {
                $model->reference = $model->opportunity_id;
            }
        });
    }

    // Relationships
    public function lead()
    {
        // Usa Person en lugar de Lead para incluir tanto Leads (type=1) como Clientes (type=2)
        return $this->belongsTo(Person::class, 'lead_id');
    }

    public function opportunity()
    {
        return $this->belongsTo(Opportunity::class);
    }

    public function propuestas()
    {
        return $this->hasMany(Propuesta::class, 'analisis_reference', 'reference');
    }

    public function manchaDetalles()
    {
        return $this->hasMany(ManchaDetalle::class);
    }

    public function juicioDetalles()
    {
        return $this->hasMany(JuicioDetalle::class);
    }

    public function embargoDetalles()
    {
        return $this->hasMany(EmbargoDetalle::class);
    }

    /**
     * Relación con el crédito asociado a este análisis
     * Un crédito está vinculado por opportunity_id
     */
    public function credit()
    {
        return $this->hasOne(Credit::class, 'opportunity_id', 'opportunity_id');
    }

    /**
     * Accessor: monto_credito es alias de monto_sugerido para compatibilidad con el frontend.
     */
    public function getMontoCreditoAttribute(): ?string
    {
        return $this->monto_sugerido;
    }

    /**
     * Accessor para saber si tiene crédito asociado
     * Solo busca por opportunity_id para permitir múltiples créditos por cliente
     */
    public function getHasCreditAttribute(): bool
    {
        if (!$this->lead_id) return false;
        return Credit::where('lead_id', $this->lead_id)->exists();
    }

    /**
     * Accessor para obtener el ID del crédito asociado
     */
    public function getCreditIdAttribute(): ?int
    {
        if (!$this->lead_id) return null;
        return Credit::where('lead_id', $this->lead_id)
            ->orderByDesc('id')
            ->value('id');
    }

    /**
     * Accessor para obtener el status del crédito asociado
     * Solo busca por opportunity_id para permitir múltiples créditos por cliente
     */
    public function getCreditStatusAttribute(): ?string
    {
        return Credit::where('opportunity_id', $this->opportunity_id)->value('status');
    }

    public function comments()
    {
        return $this->morphMany(Comment::class, 'commentable');
    }

    // ── Score Interno de Riesgo (computado) ──────────────────────────

    /**
     * Score de riesgo interno (0-100). Mayor = menor riesgo.
     * Calculado a partir de manchas, juicios y embargos.
     */
    public function getScoreRiesgoAttribute(): int
    {
        $score = 100;

        // Manchas: -12 pts c/u (máx -48)
        $score -= min(($this->numero_manchas ?? 0) * 12, 48);

        // Juicios: -15 pts c/u (máx -45)
        $score -= min(($this->numero_juicios ?? 0) * 15, 45);

        // Embargos: -20 pts c/u (máx -40)
        $score -= min(($this->numero_embargos ?? 0) * 20, 40);

        return max($score, 0);
    }

    /**
     * Color del semáforo de riesgo.
     */
    public function getScoreRiesgoColorAttribute(): string
    {
        $score = $this->score_riesgo;

        if ($score >= 80) return 'green';
        if ($score >= 60) return 'yellow';
        if ($score >= 40) return 'orange';

        return 'red';
    }

    /**
     * Etiqueta legible del nivel de riesgo.
     */
    public function getScoreRiesgoLabelAttribute(): string
    {
        $score = $this->score_riesgo;

        if ($score >= 80) return 'Bajo';
        if ($score >= 60) return 'Moderado';
        if ($score >= 40) return 'Alto';

        return 'Muy Alto';
    }
}
