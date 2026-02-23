<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountingEntryConfig;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AccountingEntryConfigController extends Controller
{
    /**
     * Listar todas las configuraciones de asientos
     */
    public function index()
    {
        $configs = AccountingEntryConfig::with('lines')->orderBy('entry_type')->get();

        return response()->json([
            'configs' => $configs,
        ]);
    }

    /**
     * Obtener una configuración específica
     */
    public function show($id)
    {
        $config = AccountingEntryConfig::with('lines')->findOrFail($id);

        return response()->json([
            'config' => $config,
        ]);
    }

    /**
     * Crear o actualizar configuración completa (con líneas)
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'entry_type' => 'required|string|max:50|unique:accounting_entry_configs,entry_type',
            'name' => 'required|string|max:100',
            'description' => 'nullable|string',
            'active' => 'sometimes|boolean',
            'lines' => 'required|array|min:2',
            'lines.*.movement_type' => 'required|in:debit,credit',
            'lines.*.account_type' => 'required|in:fixed,deductora',
            'lines.*.account_key' => 'required_if:lines.*.account_type,fixed|nullable|string|max:50',
            'lines.*.description' => 'nullable|string|max:255',
            'lines.*.amount_component' => 'sometimes|string|in:total,interes_corriente,interes_moratorio,poliza,capital,cargo_adicional',
            'lines.*.cargo_adicional_key' => 'nullable|string|max:50',
        ]);

        DB::beginTransaction();
        try {
            $config = AccountingEntryConfig::create([
                'entry_type' => $validated['entry_type'],
                'name' => $validated['name'],
                'description' => $validated['description'] ?? null,
                'active' => $validated['active'] ?? true,
            ]);

            // Crear líneas
            foreach ($validated['lines'] as $index => $lineData) {
                $config->lines()->create([
                    'line_order' => $index,
                    'movement_type' => $lineData['movement_type'],
                    'account_type' => $lineData['account_type'],
                    'account_key' => $lineData['account_key'] ?? null,
                    'description' => $lineData['description'] ?? null,
                    'amount_component' => $lineData['amount_component'] ?? 'total',
                    'cargo_adicional_key' => $lineData['cargo_adicional_key'] ?? null,
                ]);
            }

            DB::commit();

            return response()->json([
                'message' => 'Configuración creada exitosamente',
                'config' => $config->load('lines'),
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Error al crear configuración',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Actualizar configuración existente
     */
    public function update(Request $request, $id)
    {
        $config = AccountingEntryConfig::findOrFail($id);

        $validated = $request->validate([
            'entry_type' => 'sometimes|string|max:50|unique:accounting_entry_configs,entry_type,' . $id,
            'name' => 'sometimes|string|max:100',
            'description' => 'nullable|string',
            'active' => 'sometimes|boolean',
            'lines' => 'sometimes|array|min:2',
            'lines.*.movement_type' => 'required_with:lines|in:debit,credit',
            'lines.*.account_type' => 'required_with:lines|in:fixed,deductora',
            'lines.*.account_key' => 'required_if:lines.*.account_type,fixed|nullable|string|max:50',
            'lines.*.description' => 'nullable|string|max:255',
            'lines.*.amount_component' => 'sometimes|string|in:total,interes_corriente,interes_moratorio,poliza,capital,cargo_adicional',
            'lines.*.cargo_adicional_key' => 'nullable|string|max:50',
        ]);

        DB::beginTransaction();
        try {
            // Actualizar configuración
            $config->update([
                'entry_type' => $validated['entry_type'] ?? $config->entry_type,
                'name' => $validated['name'] ?? $config->name,
                'description' => $validated['description'] ?? $config->description,
                'active' => $validated['active'] ?? $config->active,
            ]);

            // Si se envían líneas, reemplazarlas
            if (isset($validated['lines'])) {
                $config->lines()->delete();

                foreach ($validated['lines'] as $index => $lineData) {
                    $config->lines()->create([
                        'line_order' => $index,
                        'movement_type' => $lineData['movement_type'],
                        'account_type' => $lineData['account_type'],
                        'account_key' => $lineData['account_key'] ?? null,
                        'description' => $lineData['description'] ?? null,
                        'amount_component' => $lineData['amount_component'] ?? 'total',
                        'cargo_adicional_key' => $lineData['cargo_adicional_key'] ?? null,
                    ]);
                }
            }

            DB::commit();

            return response()->json([
                'message' => 'Configuración actualizada exitosamente',
                'config' => $config->fresh(['lines']),
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Error al actualizar configuración',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Eliminar configuración
     */
    public function destroy($id)
    {
        $config = AccountingEntryConfig::findOrFail($id);
        $config->delete();

        return response()->json([
            'message' => 'Configuración eliminada exitosamente',
        ]);
    }

    /**
     * Activar/desactivar configuración
     */
    public function toggle($id)
    {
        $config = AccountingEntryConfig::findOrFail($id);
        $config->update(['active' => !$config->active]);

        return response()->json([
            'message' => 'Configuración actualizada',
            'config' => $config,
        ]);
    }

    /**
     * Preview de cómo se vería un asiento con esta configuración
     */
    public function preview(Request $request, $id)
    {
        $config = AccountingEntryConfig::with('lines')->findOrFail($id);

        $validated = $request->validate([
            'amount' => 'required|numeric|min:0',
            'context' => 'sometimes|array',
            'context.deductora_id' => 'sometimes|integer',
            'context.amount_breakdown' => 'sometimes|array',
        ]);

        $amount = $validated['amount'];
        $context = $validated['context'] ?? [];

        // Obtener desglose de montos
        $breakdown = $context['amount_breakdown'] ?? [
            'total' => $amount,
            'interes_corriente' => 0,
            'interes_moratorio' => 0,
            'poliza' => 0,
            'capital' => $amount,
            'cargos_adicionales_total' => 0,
            'cargos_adicionales' => [],
        ];

        // Variables para descripciones
        $variables = [
            '{reference}' => 'PREVIEW-001',
            '{amount}' => number_format($amount, 2),
            '{clienteNombre}' => 'Juan Pérez (Preview)',
            '{cedula}' => '1-0234-0567',
            '{credit_id}' => '25-00001-OP',
            '{deductora_nombre}' => 'COOPENACIONAL (Preview)',
        ];

        // Construir items del preview
        $items = [];
        $totalDebit = 0;
        $totalCredit = 0;

        foreach ($config->lines as $line) {
            // Resolver monto según componente
            $lineAmount = match($line->amount_component ?? 'total') {
                'total' => $breakdown['total'] ?? $amount,
                'interes_corriente' => $breakdown['interes_corriente'] ?? 0,
                'interes_moratorio' => $breakdown['interes_moratorio'] ?? 0,
                'poliza' => $breakdown['poliza'] ?? 0,
                'capital' => $breakdown['capital'] ?? 0,
                'cargo_adicional' => ($breakdown['cargos_adicionales'][$line->cargo_adicional_key] ?? $breakdown['cargos_adicionales_total'] ?? 0),
                default => $breakdown['total'] ?? $amount,
            };

            // Skip si monto es cero
            if ($lineAmount == 0) {
                continue;
            }

            // Resolver cuenta
            $accountCode = 'PREVIEW';
            $accountName = 'Cuenta Preview';

            if ($line->account_type === 'fixed' && $line->account_key) {
                $account = \App\Models\ErpAccountingAccount::where('key', $line->account_key)->first();
                if ($account) {
                    $accountCode = $account->account_code ?: $line->account_key;
                    $accountName = $account->account_name;
                }
            } elseif ($line->account_type === 'deductora') {
                $accountCode = 'DEDUCTORA-DINAMICA';
                $accountName = 'Cuenta de Deductora (dinámica)';
            }

            // Reemplazar variables en descripción
            $lineDescription = str_replace(
                array_keys($variables),
                array_values($variables),
                $line->description ?? $config->name
            );

            $debit = $line->movement_type === 'debit' ? $lineAmount : 0;
            $credit = $line->movement_type === 'credit' ? $lineAmount : 0;

            $totalDebit += $debit;
            $totalCredit += $credit;

            $items[] = [
                'account_code' => $accountCode,
                'account_name' => $accountName,
                'debit' => $debit,
                'credit' => $credit,
                'description' => $lineDescription,
                'amount_component' => $line->amount_component ?? 'total',
            ];
        }

        // Descripción principal
        $mainDescription = str_replace(
            array_keys($variables),
            array_values($variables),
            $config->description ?? $config->name
        );

        return response()->json([
            'journal_entry' => [
                'date' => now()->format('Y-m-d'),
                'description' => $mainDescription,
                'items' => $items,
                'reference' => "PREVIEW-{$config->entry_type}",
            ],
            'summary' => [
                'total_debit' => round($totalDebit, 2),
                'total_credit' => round($totalCredit, 2),
                'difference' => round(abs($totalDebit - $totalCredit), 2),
                'balanced' => abs($totalDebit - $totalCredit) < 0.01,
                'lines_count' => count($items),
            ],
            'breakdown_used' => $breakdown,
        ]);
    }
}
