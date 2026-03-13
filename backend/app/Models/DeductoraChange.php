<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

class DeductoraChange extends Model
{
    protected $fillable = [
        'credit_id',
        'reference',
        'lead_id',
        'cedula',
        'cliente',
        'deductora_anterior_id',
        'deductora_anterior_nombre',
        'deductora_nueva_id',
        'deductora_nueva_nombre',
        'tipo_movimiento',
        'motivo',
        'cuota',
        'saldo',
        'tasa_anual',
        'plazo',
        'fecha_formalizacion',
        'fecha_movimiento',
        'periodo',
        'user_id',
    ];

    protected $casts = [
        'cuota'               => 'decimal:2',
        'saldo'               => 'decimal:2',
        'tasa_anual'          => 'decimal:2',
        'plazo'               => 'integer',
        'fecha_formalizacion' => 'date',
        'fecha_movimiento'    => 'date',
    ];

    // ── Relaciones ──

    public function credit()
    {
        return $this->belongsTo(Credit::class);
    }

    public function lead()
    {
        return $this->belongsTo(Person::class, 'lead_id');
    }

    public function deductoraAnterior()
    {
        return $this->belongsTo(Deductora::class, 'deductora_anterior_id');
    }

    public function deductoraNueva()
    {
        return $this->belongsTo(Deductora::class, 'deductora_nueva_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    // ── Scopes ──

    public function scopeByPeriodo($query, string $periodo)
    {
        return $query->where('periodo', $periodo);
    }

    public function scopeByDeductora($query, int $deductoraId)
    {
        return $query->where(function ($q) use ($deductoraId) {
            $q->where('deductora_anterior_id', $deductoraId)
              ->orWhere('deductora_nueva_id', $deductoraId);
        });
    }

    public function scopeByTipo($query, string $tipo)
    {
        return $query->where('tipo_movimiento', $tipo);
    }

    // ── Helpers estáticos para registrar cambios ──

    public static function registrarInclusion(Credit $credit, ?int $userId = null): self
    {
        return self::create([
            'credit_id'              => $credit->id,
            'reference'              => $credit->reference,
            'lead_id'                => $credit->lead_id,
            'cedula'                 => $credit->lead?->cedula,
            'cliente'                => $credit->lead?->name,
            'deductora_anterior_id'  => null,
            'deductora_anterior_nombre' => null,
            'deductora_nueva_id'     => $credit->deductora_id,
            'deductora_nueva_nombre' => $credit->deductora?->nombre,
            'tipo_movimiento'        => 'inclusion',
            'motivo'                 => 'Crédito nuevo formalizado',
            'cuota'                  => $credit->cuota,
            'saldo'                  => $credit->saldo,
            'tasa_anual'             => $credit->tasa_anual ?? 0,
            'plazo'                  => $credit->plazo ?? 0,
            'fecha_formalizacion'    => $credit->formalized_at,
            'fecha_movimiento'       => Carbon::today(),
            'periodo'                => Carbon::today()->format('Y-m'),
            'user_id'                => $userId,
        ]);
    }

    public static function registrarExclusion(Credit $credit, string $motivo, ?int $userId = null): self
    {
        return self::create([
            'credit_id'              => $credit->id,
            'reference'              => $credit->reference,
            'lead_id'                => $credit->lead_id,
            'cedula'                 => $credit->lead?->cedula,
            'cliente'                => $credit->lead?->name,
            'deductora_anterior_id'  => $credit->deductora_id,
            'deductora_anterior_nombre' => $credit->deductora?->nombre,
            'deductora_nueva_id'     => null,
            'deductora_nueva_nombre' => null,
            'tipo_movimiento'        => 'exclusion',
            'motivo'                 => $motivo,
            'cuota'                  => $credit->cuota,
            'saldo'                  => $credit->saldo,
            'tasa_anual'             => $credit->tasa_anual ?? 0,
            'plazo'                  => $credit->plazo ?? 0,
            'fecha_formalizacion'    => $credit->formalized_at,
            'fecha_movimiento'       => Carbon::today(),
            'periodo'                => Carbon::today()->format('Y-m'),
            'user_id'                => $userId,
        ]);
    }

    public static function registrarTraslado(Credit $credit, int $deductoraAnteriorId, string $deductoraAnteriorNombre, ?int $userId = null): self
    {
        return self::create([
            'credit_id'              => $credit->id,
            'reference'              => $credit->reference,
            'lead_id'                => $credit->lead_id,
            'cedula'                 => $credit->lead?->cedula,
            'cliente'                => $credit->lead?->name,
            'deductora_anterior_id'  => $deductoraAnteriorId,
            'deductora_anterior_nombre' => $deductoraAnteriorNombre,
            'deductora_nueva_id'     => $credit->deductora_id,
            'deductora_nueva_nombre' => $credit->deductora?->nombre,
            'tipo_movimiento'        => 'traslado',
            'motivo'                 => 'Traslado de ' . $deductoraAnteriorNombre . ' a ' . ($credit->deductora?->nombre ?? '—'),
            'cuota'                  => $credit->cuota,
            'saldo'                  => $credit->saldo,
            'tasa_anual'             => $credit->tasa_anual ?? 0,
            'plazo'                  => $credit->plazo ?? 0,
            'fecha_formalizacion'    => $credit->formalized_at,
            'fecha_movimiento'       => Carbon::today(),
            'periodo'                => Carbon::today()->format('Y-m'),
            'user_id'                => $userId,
        ]);
    }

    public static function registrarRefundicion(Credit $creditViejo, Credit $creditNuevo, ?int $userId = null): self
    {
        return self::create([
            'credit_id'              => $creditNuevo->id,
            'reference'              => $creditNuevo->reference,
            'lead_id'                => $creditNuevo->lead_id,
            'cedula'                 => $creditNuevo->lead?->cedula,
            'cliente'                => $creditNuevo->lead?->name,
            'deductora_anterior_id'  => $creditViejo->deductora_id,
            'deductora_anterior_nombre' => $creditViejo->deductora?->nombre,
            'deductora_nueva_id'     => $creditNuevo->deductora_id,
            'deductora_nueva_nombre' => $creditNuevo->deductora?->nombre,
            'tipo_movimiento'        => 'refundicion',
            'motivo'                 => 'Refundición de crédito ' . $creditViejo->reference,
            'cuota'                  => $creditNuevo->cuota,
            'saldo'                  => $creditNuevo->saldo,
            'tasa_anual'             => $creditNuevo->tasa_anual ?? 0,
            'plazo'                  => $creditNuevo->plazo ?? 0,
            'fecha_formalizacion'    => $creditNuevo->formalized_at,
            'fecha_movimiento'       => Carbon::today(),
            'periodo'                => Carbon::today()->format('Y-m'),
            'user_id'                => $userId,
        ]);
    }
}
