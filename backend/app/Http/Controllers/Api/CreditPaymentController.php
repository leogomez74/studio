<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CreditPayment;
use Illuminate\Http\Request;

class CreditPaymentController extends Controller
{
    public function index(Request $request)
    {
        $query = CreditPayment::query();

        if ($request->has('credit_id')) {
            $query->where('credit_id', $request->credit_id);
        }

        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'credit_id' => 'required|exists:credits,id',
            'numero_cuota' => 'required|integer',
            'proceso' => 'nullable|string',
            'fecha_cuota' => 'nullable|date',
            'fecha_pago' => 'nullable|date',
            'cuota' => 'nullable|numeric',
            'cargos' => 'nullable|numeric',
            'poliza' => 'nullable|numeric',
            'interes_corriente' => 'nullable|numeric',
            'interes_moratorio' => 'nullable|numeric',
            'amortizacion' => 'nullable|numeric',
            'saldo_anterior' => 'nullable|numeric',
            'nuevo_saldo' => 'nullable|numeric',
            'estado' => 'nullable|string',
            'fecha_movimiento' => 'nullable|date',
            'movimiento_total' => 'nullable|numeric',
        ]);

        $payment = CreditPayment::create($validated);
        return response()->json($payment, 201);
    }

    public function show(string $id)
    {
        $payment = CreditPayment::findOrFail($id);
        return response()->json($payment);
    }

    public function update(Request $request, string $id)
    {
        $payment = CreditPayment::findOrFail($id);

        $validated = $request->validate([
            'credit_id' => 'sometimes|required|exists:credits,id',
            'numero_cuota' => 'sometimes|required|integer',
            'proceso' => 'nullable|string',
            'fecha_cuota' => 'nullable|date',
            'fecha_pago' => 'nullable|date',
            'cuota' => 'nullable|numeric',
            'cargos' => 'nullable|numeric',
            'poliza' => 'nullable|numeric',
            'interes_corriente' => 'nullable|numeric',
            'interes_moratorio' => 'nullable|numeric',
            'amortizacion' => 'nullable|numeric',
            'saldo_anterior' => 'nullable|numeric',
            'nuevo_saldo' => 'nullable|numeric',
            'estado' => 'nullable|string',
            'fecha_movimiento' => 'nullable|date',
            'movimiento_total' => 'nullable|numeric',
        ]);

        $payment->update($validated);
        return response()->json($payment);
    }

    public function destroy(string $id)
    {
        $payment = CreditPayment::findOrFail($id);
        $payment->delete();
        return response()->json(null, 204);
    }
}
