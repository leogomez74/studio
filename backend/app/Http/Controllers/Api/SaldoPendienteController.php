<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SaldoPendiente;
use App\Models\Credit;
use App\Models\PlanDePago;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class SaldoPendienteController extends Controller
{
    /**
     * Listar saldos pendientes (sobrantes de planilla sin asignar)
     */
    public function index(Request $request)
    {
        $query = SaldoPendiente::with(['credit.lead', 'credit.deductora'])
            ->orderBy('created_at', 'desc');

        if ($request->has('estado')) {
            $query->where('estado', $request->estado);
        } else {
            $query->where('estado', 'pendiente');
        }

        $saldos = $query->get()->map(function ($saldo) {
            return [
                'id' => $saldo->id,
                'credit_id' => $saldo->credit_id,
                'lead_id' => $saldo->credit->lead_id ?? null,
                'credit_reference' => $saldo->credit->reference ?? '',
                'lead_name' => $saldo->credit->lead
                    ? ($saldo->credit->lead->name . ' ' . ($saldo->credit->lead->apellido1 ?? ''))
                    : 'N/A',
                'cedula' => $saldo->cedula ?? ($saldo->credit->lead->cedula ?? ''),
                'deductora' => $saldo->credit->deductora->nombre ?? 'N/A',
                'monto' => (float) $saldo->monto,
                'origen' => $saldo->origen,
                'fecha_origen' => $saldo->fecha_origen?->format('Y-m-d'),
                'estado' => $saldo->estado,
                'notas' => $saldo->notas,
                'saldo_credito' => (float) $saldo->credit->saldo,
            ];
        });

        return response()->json($saldos);
    }

    /**
     * Asignar un saldo pendiente: aplicar a cuota o aplicar a capital
     */
    public function asignar(Request $request, int $id)
    {
        $validated = $request->validate([
            'accion' => 'required|in:cuota,capital',
            'notas' => 'nullable|string|max:500',
        ]);

        $saldo = SaldoPendiente::where('estado', 'pendiente')->findOrFail($id);
        $accion = $validated['accion'];

        return DB::transaction(function () use ($saldo, $accion, $validated) {
            $credit = Credit::lockForUpdate()->findOrFail($saldo->credit_id);

            if ($accion === 'cuota') {
                // Aplicar como pago a la siguiente cuota pendiente
                $controller = new CreditPaymentController();
                $payment = $controller->processPaymentTransactionPublic(
                    $credit,
                    (float) $saldo->monto,
                    now(),
                    'Saldo Pendiente',
                    $saldo->cedula
                );

                $saldo->estado = 'asignado_cuota';
                $saldo->asignado_at = now();
                $saldo->notas = $validated['notas'] ?? 'Aplicado a cuota #' . $payment->numero_cuota;
                $saldo->save();

                return response()->json([
                    'message' => 'Saldo aplicado a cuota exitosamente',
                    'saldo' => $saldo,
                    'payment' => $payment,
                    'nuevo_saldo_credito' => (float) $credit->fresh()->saldo,
                ]);

            } else {
                // Aplicar a capital: reduce saldo directamente
                $saldoAnterior = (float) $credit->saldo;
                $montoAplicar = min((float) $saldo->monto, $saldoAnterior);
                $credit->saldo = max(0, $saldoAnterior - $montoAplicar);
                $credit->save();

                // Registrar como un CreditPayment de tipo "Abono a Capital"
                $payment = \App\Models\CreditPayment::create([
                    'credit_id' => $credit->id,
                    'numero_cuota' => 0,
                    'fecha_pago' => now(),
                    'monto' => $montoAplicar,
                    'cuota' => 0,
                    'saldo_anterior' => $saldoAnterior,
                    'nuevo_saldo' => $credit->saldo,
                    'estado' => 'Aplicado',
                    'amortizacion' => $montoAplicar,
                    'source' => 'Abono a Capital',
                    'cedula' => $saldo->cedula,
                    'movimiento_total' => 0,
                    'movimiento_amortizacion' => $montoAplicar,
                ]);

                $saldo->estado = 'asignado_capital';
                $saldo->asignado_at = now();
                $saldo->notas = $validated['notas'] ?? sprintf(
                    'Abono a capital: ₡%s → Saldo anterior: ₡%s → Nuevo saldo: ₡%s',
                    number_format($montoAplicar, 2),
                    number_format($saldoAnterior, 2),
                    number_format($credit->saldo, 2)
                );
                $saldo->save();

                return response()->json([
                    'message' => 'Saldo aplicado a capital exitosamente. Los intereses corrientes se reducirán en la siguiente cuota.',
                    'saldo' => $saldo,
                    'payment' => $payment,
                    'saldo_anterior' => $saldoAnterior,
                    'nuevo_saldo_credito' => (float) $credit->saldo,
                    'capital_reducido' => $montoAplicar,
                ]);
            }
        });
    }
}
