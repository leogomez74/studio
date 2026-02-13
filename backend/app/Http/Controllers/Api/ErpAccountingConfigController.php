<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ErpAccountingAccount;
use App\Services\ErpAccountingService;
use Illuminate\Http\Request;

class ErpAccountingConfigController extends Controller
{
    /**
     * Listar todas las cuentas contables configuradas
     */
    public function index()
    {
        $accounts = ErpAccountingAccount::orderBy('id')->get();

        $service = new ErpAccountingService();

        return response()->json([
            'accounts' => $accounts,
            'erp_configured' => $service->isConfigured(),
            'accounts_configured' => $service->areAccountsConfigured(),
        ]);
    }

    /**
     * Actualizar código de cuenta contable
     */
    public function update(Request $request, int $id)
    {
        $validated = $request->validate([
            'account_code' => 'required|string|max:20',
            'account_name' => 'sometimes|string|max:100',
            'description' => 'nullable|string|max:255',
            'active' => 'sometimes|boolean',
        ]);

        $account = ErpAccountingAccount::findOrFail($id);
        $account->update($validated);

        return response()->json([
            'message' => 'Cuenta actualizada exitosamente',
            'account' => $account,
        ]);
    }

    /**
     * Agregar nueva cuenta contable
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'key' => 'required|string|max:50|unique:erp_accounting_accounts,key',
            'account_code' => 'required|string|max:20',
            'account_name' => 'required|string|max:100',
            'description' => 'nullable|string|max:255',
        ]);

        $account = ErpAccountingAccount::create($validated);

        return response()->json([
            'message' => 'Cuenta creada exitosamente',
            'account' => $account,
        ], 201);
    }

    /**
     * Eliminar cuenta contable (solo cuentas agregadas por el usuario)
     */
    public function destroy(int $id)
    {
        $account = ErpAccountingAccount::findOrFail($id);

        // No permitir eliminar las cuentas base del sistema
        $protectedKeys = ['banco_credipepe', 'cuentas_por_cobrar'];
        if (in_array($account->key, $protectedKeys)) {
            return response()->json([
                'message' => 'No se puede eliminar una cuenta base del sistema. Solo puedes modificar su código.',
            ], 422);
        }

        $account->delete();

        return response()->json(['message' => 'Cuenta eliminada exitosamente']);
    }

    /**
     * Probar conexión con el ERP externo
     */
    public function testConnection()
    {
        $service = new ErpAccountingService();
        $result = $service->testConnection();

        return response()->json($result, $result['success'] ? 200 : 400);
    }
}
