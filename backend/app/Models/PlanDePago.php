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
        'int_corriente_vencido',
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
        'movimiento_int_corriente_vencido',
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
        'int_corriente_vencido' => 'decimal:2',
        'interes_moratorio' => 'decimal:2',
        'amortizacion' => 'decimal:2',
        'saldo_anterior' => 'decimal:2',
        'saldo_nuevo' => 'decimal:2',
        'movimiento_total' => 'decimal:2',
        'movimiento_poliza' => 'decimal:2',
        'movimiento_interes_corriente' => 'decimal:2',
        'movimiento_int_corriente_vencido' => 'decimal:2',
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

    protected static function booted()
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
            $capital = (float) ($plan->saldo_nuevo ?? $plan->movimiento_principal ?? $credit->monto_credito ?? 0);
            if ($capital <= 0) return;

            // Obtener tasa anual del crédito
            $tasaAnual = (float) ($plan->tasa_actual ?? $credit->tasa->tasa ?? 0);
            $tasaMensual = $tasaAnual / 12 / 100; // Convertir a decimal mensual

            // Calcular cuota fija usando sistema francés
            // Cuota = Capital × [i × (1 + i)^n] / [(1 + i)^n - 1]
            if ($tasaMensual > 0) {
                $factor = pow(1 + $tasaMensual, $plazo);
                $cuotaFija = round($capital * ($tasaMensual * $factor) / ($factor - 1), 2);
            } else {
                // Si no hay tasa, usar división simple
                $cuotaFija = round($capital / $plazo, 2);
            }

            $saldoRestante = $capital;

            DB::transaction(function () use ($plan, $credit, $plazo, $cuotaFija, $tasaMensual, &$saldoRestante) {
                for ($i = 1; $i <= $plazo; $i++) {
                    $saldo_anterior = round($saldoRestante, 2);

                    // Calcular interés corriente sobre el saldo anterior
                    $interes_corriente = round($saldo_anterior * $tasaMensual, 2);

                    // Amortización = Cuota - Interés corriente
                    $amortizacion = $cuotaFija - $interes_corriente;

                    // Para la última cuota, ajustar para saldar el crédito
                    if ($i === $plazo) {
                        $amortizacion = $saldo_anterior;
                        $cuota = round($amortizacion + $interes_corriente, 2);
                    } else {
                        $cuota = $cuotaFija;
                        $amortizacion = round($amortizacion, 2);
                    }

                    // Nuevo saldo = Saldo anterior - Amortización
                    $saldo_nuevo = round($saldo_anterior - $amortizacion, 2);
                    $saldo_nuevo = max(0, $saldo_nuevo); // Evitar negativos

                    // Calcular fecha de corte: último día del mes correspondiente
                    $fechaCorte = $plan->fecha_inicio ? $plan->fecha_inicio->copy()->addMonths($i)->endOfMonth() : null;

                    self::create([
                        'credit_id' => $credit->id,
                        'linea' => $plan->linea,
                        'numero_cuota' => $i,
                        'proceso' => $plan->proceso,
                        'fecha_inicio' => $plan->fecha_inicio,
                        'fecha_corte' => $fechaCorte,
                        'fecha_pago' => null,
                        'tasa_actual' => $plan->tasa_actual,
                        'plazo_actual' => $plazo,
                        'cuota' => $cuota,
                        'cargos' => 0,
                        'poliza' => 0,
                        'interes_corriente' => $interes_corriente,  // ✓ Interés calculado sobre saldo
                        'int_corriente_vencido' => 0,
                        'interes_moratorio' => 0,
                        'amortizacion' => $amortizacion,  // ✓ Cuota - Interés corriente
                        'saldo_anterior' => $saldo_anterior,
                        'saldo_nuevo' => $saldo_nuevo,
                        'dias' => 0,
                        'estado' => 'Pendiente',
                        'dias_mora' => 0,
                        'fecha_movimiento' => null,
                        'movimiento_total' => 0,
                        'movimiento_cargos' => 0,
                        'movimiento_poliza' => 0,
                        'movimiento_interes_corriente' => 0,
                        'movimiento_interes_moratorio' => 0,
                        'movimiento_principal' => 0,
                        'movimiento_amortizacion' => 0,
                        'movimiento_caja_usuario' => null,
                        'tipo_documento' => null,
                        'numero_documento' => null,
                        'concepto' => null,
                    ]);

                    $saldoRestante = $saldo_nuevo;
                }
            });
        });
    }
}
