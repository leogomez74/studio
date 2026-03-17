<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Investment;
use App\Models\InvestmentPayment;
use Illuminate\Http\Request;
use App\Traits\LogsActivity;
use App\Traits\AccountingTrigger;

class InvestmentPaymentController extends Controller
{
    use LogsActivity, AccountingTrigger;
    public function index(Request $request)
    {
        $query = InvestmentPayment::with(['investor:id,name', 'investment:id,numero_desembolso,moneda', 'registeredByUser:id,name']);

        if ($request->has('investor_id')) {
            $query->where('investor_id', $request->investor_id);
        }
        if ($request->has('fecha_desde')) {
            $query->where('fecha_pago', '>=', $request->fecha_desde);
        }
        if ($request->has('fecha_hasta')) {
            $query->where('fecha_pago', '<=', $request->fecha_hasta);
        }

        if ($request->get('all') === 'true') {
            return response()->json($query->latest('fecha_pago')->get());
        }

        $perPage = min($request->get('per_page', 50), 100);
        return response()->json($query->latest('fecha_pago')->paginate($perPage));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'investor_id' => 'required|exists:investors,id',
            'investment_id' => 'nullable|exists:investments,id',
            'fecha_pago' => 'required|date',
            'monto' => 'required|numeric|min:0',
            'tipo' => 'required|in:Interés,Capital,Adelanto,Liquidación',
            'moneda' => 'required|in:CRC,USD',
            'comentarios' => 'nullable|string',
            'registered_by' => 'required|exists:users,id',
        ]);

        if (!empty($validated['investment_id'])) {
            $belongs = Investment::where('id', $validated['investment_id'])
                ->where('investor_id', $validated['investor_id'])
                ->exists();

            if (!$belongs) {
                return response()->json([
                    'message' => 'La inversión no pertenece al inversionista indicado.',
                ], 422);
            }
        }

        $payment = InvestmentPayment::create($validated);
        $this->logActivity('create', 'Pagos Inversión', $payment, $payment->tipo . ' - ' . $payment->monto, [], $request);

        $investment = $payment->investment;
        $this->triggerAccountingEntry('INV_PAGO_MANUAL', (float) $payment->monto, 'INV-PAY-' . $payment->id, [
            'investment_id'   => $payment->investment_id,
            'investor_id'     => $payment->investor_id,
            'investor_nombre' => $payment->investor?->name ?? 'N/A',
            'moneda'          => $payment->moneda,
            'tipo_pago'       => $payment->tipo,
            'numero_desembolso' => $investment?->numero_desembolso ?? 'N/A',
        ]);

        return response()->json($payment->load(['investor:id,name', 'investment:id,numero_desembolso', 'registeredByUser:id,name']), 201);
    }

    public function destroy(int $id)
    {
        $payment = InvestmentPayment::findOrFail($id);
        $this->logActivity('delete', 'Pagos Inversión', $payment, $payment->tipo . ' - ' . $payment->monto);
        $payment->delete();
        return response()->json(['message' => 'Pago eliminado']);
    }
}
