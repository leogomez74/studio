<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ErpAccountingAccount;
use App\Models\Investor;
use App\Services\ErpAccountingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Traits\LogsActivity;

class InvestorController extends Controller
{
    use LogsActivity;
    public function index(Request $request)
    {
        $query = Investor::withCount(['investments as active_investments_count' => fn ($q) => $q->where('estado', 'Activa')]);

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('cedula', 'like', "%{$search}%");
            });
        }

        if ($request->get('all') === 'true') {
            return response()->json($query->latest()->get());
        }

        $perPage = min($request->get('per_page', 50), 100);
        return response()->json($query->latest()->paginate($perPage));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'cedula' => 'nullable|string|max:20|unique:investors,cedula',
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:20',
            'status' => 'in:Activo,Inactivo',
            'tipo_persona' => 'string|max:255',
            'notas' => 'nullable|string',
            'cuenta_bancaria' => 'nullable|string|max:50',
            'banco' => 'nullable|string|max:100',
            'joined_at' => 'nullable|date',
        ]);

        $investor = Investor::create($validated);
        $this->logActivity('create', 'Inversionistas', $investor, $investor->name . ' (' . ($investor->cedula ?? 'Sin cédula') . ')', [], $request);

        // Crear cuentas ERP automáticamente (no bloquea la creación si falla)
        try {
            $erp = app(ErpAccountingService::class);
            if ($erp->isConfigured()) {
                $this->createInvestorErpAccounts($investor, $erp);
            }
        } catch (\Exception $e) {
            Log::warning('ERP: No se pudieron crear cuentas para inversionista', [
                'investor_id' => $investor->id,
                'investor_name' => $investor->name,
                'error' => $e->getMessage(),
            ]);
        }

        return response()->json($investor->fresh(), 201);
    }

    public function show(int $id)
    {
        $investor = Investor::withCount(['investments as active_investments_count' => fn ($q) => $q->where('estado', 'Activa')])
            ->with(['investments.coupons', 'payments', 'capitalReserves', 'documents'])
            ->findOrFail($id);
        return response()->json($investor);
    }

    public function update(Request $request, int $id)
    {
        $investor = Investor::findOrFail($id);
        $oldData = $investor->toArray();

        $validated = $request->validate([
            'name' => 'string|max:255',
            'cedula' => "nullable|string|max:20|unique:investors,cedula,{$id}",
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:20',
            'status' => 'in:Activo,Inactivo',
            'tipo_persona' => 'string|max:255',
            'notas' => 'nullable|string',
            'cuenta_bancaria' => 'nullable|string|max:50',
            'banco' => 'nullable|string|max:100',
            'joined_at' => 'nullable|date',
            'erp_account_key' => 'nullable|string|max:100',
            'erp_account_key_prestamos' => 'nullable|string|max:100',
            'erp_account_key_intereses' => 'nullable|string|max:100',
        ]);

        $investor->update($validated);
        $changes = $this->getChanges($oldData, $investor->fresh()->toArray());
        $this->logActivity('update', 'Inversionistas', $investor, $investor->name . ' (' . ($investor->cedula ?? 'Sin cédula') . ')', $changes, $request);
        return response()->json($investor);
    }

    public function destroy(int $id)
    {
        $investor = Investor::findOrFail($id);
        $this->logActivity('delete', 'Inversionistas', $investor, $investor->name . ' (' . ($investor->cedula ?? 'Sin cédula') . ')');

        DB::transaction(function () use ($investor) {
            // Cascade delete related records
            $investor->capitalReserves()->delete();
            $investor->payments()->delete();
            $investor->investments()->each(function ($investment) {
                $investment->coupons()->delete();
                $investment->delete();
            });

            $investor->delete();
        });

        return response()->json(['message' => 'Inversionista eliminado']);
    }

    // ================================================================
    // CUENTAS ERP AUTOMÁTICAS
    // ================================================================

    private function createInvestorErpAccounts(Investor $investor, ErpAccountingService $erp): void
    {
        $name = $investor->name;

        // 1. Préstamos por Pagar
        $prestamosData = $erp->createAccount(
            "Préstamos por Pagar {$name}",
            2,
            763,
            '2201-01-'
        );
        $prestamosKey = $erp->generateAccountKey("prestamos_por_pagar_{$name}");
        ErpAccountingAccount::create([
            'key'          => $prestamosKey,
            'account_code' => $prestamosData['code'],
            'account_name' => $prestamosData['name'],
            'description'  => "Cuenta automática — Préstamos por Pagar inversionista {$name}",
            'active'       => true,
        ]);

        // 2. Intereses por Pagar
        $interesesData = $erp->createAccount(
            "Intereses por Pagar {$name}",
            2,
            762,
            '2101-01-'
        );
        $interesesKey = $erp->generateAccountKey("intereses_por_pagar_{$name}");
        ErpAccountingAccount::create([
            'key'          => $interesesKey,
            'account_code' => $interesesData['code'],
            'account_name' => $interesesData['name'],
            'description'  => "Cuenta automática — Intereses por Pagar inversionista {$name}",
            'active'       => true,
        ]);

        // 3. Asignar al inversionista
        $investor->update([
            'erp_account_key_prestamos' => $prestamosKey,
            'erp_account_key_intereses' => $interesesKey,
        ]);

        Log::info('ERP: Cuentas creadas para inversionista', [
            'investor_id'      => $investor->id,
            'investor_name'    => $name,
            'prestamos_code'   => $prestamosData['code'],
            'intereses_code'   => $interesesData['code'],
        ]);
    }
}
