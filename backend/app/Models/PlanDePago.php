<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class PlanDePago extends Model
{
    /** @use HasFactory<\Database\Factories\PlanDePagoFactory> */
    use HasFactory;

    protected $fillable = [
        'credit_id',
        'linea',
        'numero_cuota',
        'proceso',
        'fecha_inicio',
        'fecha_corte',
        'fecha_pago',
        'tasa_actual',
        'plazo_actual',
        'cuota',
        'poliza',
        'interes_corriente',
        'interes_moratorio',
        'amortizacion',
        'saldo_anterior',
        'saldo_nuevo',
        'dias',
        'estado',
        'dias_mora',
        'fecha_movimiento',
        'movimiento_total',
        'movimiento_poliza',
        'movimiento_interes_corriente',
        'movimiento_interes_moratorio',
        'movimiento_principal',
        'movimiento_amortizacion',
        'movimiento_caja_usuario',
        'tipo_documento',
        'numero_documento',
        'concepto',
    ];

    protected $casts = [
        'fecha_inicio' => 'date',
        'fecha_corte' => 'date',
        'fecha_pago' => 'date',
        'fecha_movimiento' => 'date',
        'tasa_actual' => 'decimal:2',
        'cuota' => 'decimal:2',
        'poliza' => 'decimal:2',
        'interes_corriente' => 'decimal:2',
        'interes_moratorio' => 'decimal:2',
        'amortizacion' => 'decimal:2',
        'saldo_anterior' => 'decimal:2',
        'saldo_nuevo' => 'decimal:2',
        'movimiento_total' => 'decimal:2',
        'movimiento_poliza' => 'decimal:2',
        'movimiento_interes_corriente' => 'decimal:2',
        'movimiento_interes_moratorio' => 'decimal:2',
        'movimiento_principal' => 'decimal:2',
        'movimiento_amortizacion' => 'decimal:2',
    ];

    public function credit()
    {
        return $this->belongsTo(Credit::class);
    }

        /**
     * Scope to exclude initialization cuota (numero_cuota == 0)
     */
    public function scopeCuotasActivas($query)
    {
        return $query->where('numero_cuota', '>', 0);
    }
    /* protected static function booted()
    {

        static::created(function (PlanDePago $plan) {
            // Only generate schedule when the created row is the initialization row (numero_cuota == 0)
            if ((int) $plan->numero_cuota !== 0) {
                return;
            }

            $credit = $plan->credit()->first();
            if (! $credit) return;

            // If there are already generated cuotas, skip generation
            $exists = $credit->planDePagos()->where('numero_cuota', '>', 0)->exists();
            if ($exists) return;

            $plazo = (int) ($plan->plazo_actual ?? $credit->plazo ?? 0);
            if ($plazo <= 0) return;

            // Starting balance: prefer saldo_nuevo, fall back to movimiento_principal or credit amount
            $starting = (float) ($plan->saldo_nuevo ?? $plan->movimiento_principal ?? $credit->monto_credito ?? 0);
            if ($starting <= 0) return;

            // Calculate fixed cuota (rounded to 2 decimals). Last cuota will absorb rounding remainder.
            $baseCuota = round($starting / $plazo, 2);
            $remaining = $starting;

            DB::transaction(function () use ($plan, $credit, $plazo, $baseCuota, &$remaining) {
                for ($i = 1; $i <= $plazo; $i++) {
                    // For the last cuota, assign the remaining balance to avoid rounding mismatch
                    if ($i === $plazo) {
                        $cuota = round($remaining, 2);
                    } else {
                        $cuota = $baseCuota;
                    }

                    $saldo_anterior = round($remaining, 2);
                    $saldo_nuevo = round($saldo_anterior - $cuota, 2);

                    self::create([
                        'credit_id' => $credit->id,
                        'linea' => $plan->linea,
                        'numero_cuota' => $i,
                        'proceso' => $plan->proceso,
                        'fecha_inicio' => $plan->fecha_inicio,
                        'fecha_corte' => $plan->fecha_corte,
                        'fecha_pago' => null,
                        'tasa_actual' => $plan->tasa_actual,
                        'plazo_actual' => $plazo,
                        'cuota' => $cuota,
                        'cargos' => 0,
                        'poliza' => 0,
                        'interes_corriente' => 0,
                        'interes_moratorio' => 0,
                        'amortizacion' => $cuota,
                        'saldo_anterior' => $saldo_anterior,
                        'saldo_nuevo' => $saldo_nuevo,
                        'dias' => 0,
                        'estado' => 'Vigente',
                        'dias_mora' => 0,
                        'fecha_movimiento' => null,
                        'movimiento_total' => $cuota,
                        'movimiento_cargos' => 0,
                        'movimiento_poliza' => 0,
                        'movimiento_interes_corriente' => 0,
                        'movimiento_interes_moratorio' => 0,
                        'movimiento_principal' => 0,
                        'movimiento_caja_usuario' => 'Sistema',
                        'tipo_documento' => null,
                        'numero_documento' => null,
                        'concepto' => null,
                    ]);

                    $remaining = $saldo_nuevo;
                }
            });
        });
    } */
}
