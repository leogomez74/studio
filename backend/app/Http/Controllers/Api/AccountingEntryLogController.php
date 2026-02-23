<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountingEntryLog;
use App\Models\ErpAccountingAccount;
use App\Services\ErpAccountingService;
use Illuminate\Http\Request;

class AccountingEntryLogController extends Controller
{
    /**
     * Lista paginada de logs de asientos contables con filtros.
     *
     * Query params:
     *   - entry_type: string (match exacto)
     *   - status: string (success|error|skipped|pending)
     *   - reference: string (match parcial)
     *   - credit_id: string (busca dentro del JSON context)
     *   - fecha_desde: date (Y-m-d)
     *   - fecha_hasta: date (Y-m-d)
     *   - search: string (búsqueda global)
     *   - per_page: int (default 20)
     */
    public function index(Request $request)
    {
        $perPage = min((int) $request->get('per_page', 20), 100);

        $query = AccountingEntryLog::orderBy('created_at', 'desc');

        if ($request->filled('entry_type')) {
            $query->byEntryType($request->entry_type);
        }

        if ($request->filled('status')) {
            $query->byStatus($request->status);
        }

        if ($request->filled('reference')) {
            $query->byReference($request->reference);
        }

        if ($request->filled('credit_id')) {
            $query->byCreditId($request->credit_id);
        }

        if ($request->filled('fecha_desde') || $request->filled('fecha_hasta')) {
            $query->dateRange($request->fecha_desde, $request->fecha_hasta);
        }

        if ($request->filled('search')) {
            $term = $request->search;
            $query->where(function ($q) use ($term) {
                $q->where('reference', 'like', "%{$term}%")
                  ->orWhere('entry_type', 'like', "%{$term}%")
                  ->orWhere('erp_journal_entry_id', 'like', "%{$term}%")
                  ->orWhere('error_message', 'like', "%{$term}%");
            });
        }

        return response()->json($query->paginate($perPage));
    }

    /**
     * Detalle completo de un registro de log.
     */
    public function show($id)
    {
        $log = AccountingEntryLog::findOrFail($id);

        return response()->json(['log' => $log]);
    }

    /**
     * Estadísticas resumidas para dashboard.
     * Conteos por status y por entry_type.
     */
    public function stats(Request $request)
    {
        $baseQuery = AccountingEntryLog::query();

        if ($request->filled('fecha_desde') || $request->filled('fecha_hasta')) {
            $baseQuery->dateRange($request->fecha_desde, $request->fecha_hasta);
        }

        $byStatus = (clone $baseQuery)
            ->selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status');

        $byEntryType = (clone $baseQuery)
            ->selectRaw('entry_type, status, COUNT(*) as count')
            ->groupBy('entry_type', 'status')
            ->get()
            ->groupBy('entry_type');

        return response()->json([
            'totals' => [
                'total' => (clone $baseQuery)->count(),
                'success' => $byStatus['success'] ?? 0,
                'error' => $byStatus['error'] ?? 0,
                'skipped' => $byStatus['skipped'] ?? 0,
                'pending' => $byStatus['pending'] ?? 0,
            ],
            'by_entry_type' => $byEntryType,
        ]);
    }

    /**
     * Exportar logs a CSV.
     * GET /api/accounting-entry-logs/export
     */
    public function export(Request $request)
    {
        $query = AccountingEntryLog::orderBy('created_at', 'desc');

        if ($request->filled('entry_type')) {
            $query->byEntryType($request->entry_type);
        }
        if ($request->filled('status')) {
            $query->byStatus($request->status);
        }
        if ($request->filled('reference')) {
            $query->byReference($request->reference);
        }
        if ($request->filled('fecha_desde') || $request->filled('fecha_hasta')) {
            $query->dateRange($request->fecha_desde, $request->fecha_hasta);
        }

        $logs = $query->limit(5000)->get();

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="asientos_contables_' . now()->format('Y-m-d_His') . '.csv"',
        ];

        $callback = function () use ($logs) {
            $file = fopen('php://output', 'w');
            // BOM para Excel UTF-8
            fprintf($file, chr(0xEF) . chr(0xBB) . chr(0xBF));

            fputcsv($file, [
                'ID', 'Fecha', 'Tipo', 'Referencia', 'Estado', 'Monto',
                'Débito', 'Crédito', 'ID ERP', 'Mensaje ERP', 'Error',
                'HTTP Status', 'Origen', 'Reintentos', 'Máx Reintentos',
            ]);

            foreach ($logs as $log) {
                fputcsv($file, [
                    $log->id,
                    $log->created_at->format('Y-m-d H:i:s'),
                    $log->entry_type,
                    $log->reference,
                    $log->status,
                    $log->amount,
                    $log->total_debit,
                    $log->total_credit,
                    $log->erp_journal_entry_id,
                    $log->erp_message,
                    $log->error_message,
                    $log->http_status,
                    $log->source_method,
                    $log->retry_count,
                    $log->max_retries,
                ]);
            }

            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    /**
     * Alertas: errores recientes que necesitan atención.
     * GET /api/accounting-entry-logs/alerts
     *
     * Retorna errores de las últimas 48h que no han sido reintentados exitosamente,
     * más un conteo para mostrar como badge en la UI.
     */
    public function alerts()
    {
        $since = now()->subHours(48);

        // Errores recientes que aún no se resolvieron
        $recentErrors = AccountingEntryLog::where('status', 'error')
            ->where('created_at', '>=', $since)
            ->orderBy('created_at', 'desc')
            ->limit(20)
            ->get(['id', 'entry_type', 'reference', 'amount', 'error_message', 'retry_count', 'max_retries', 'created_at']);

        // Errores que ya agotaron reintentos
        $exhaustedRetries = AccountingEntryLog::where('status', 'error')
            ->whereColumn('retry_count', '>=', 'max_retries')
            ->whereNotNull('payload_sent')
            ->count();

        // Pendientes de reintento automático
        $pendingRetry = AccountingEntryLog::retryable()->count();

        return response()->json([
            'error_count' => $recentErrors->count(),
            'exhausted_retries' => $exhaustedRetries,
            'pending_retry' => $pendingRetry,
            'recent_errors' => $recentErrors,
        ]);
    }

    /**
     * Reintentar manualmente un asiento fallido.
     * POST /api/accounting-entry-logs/{id}/retry
     */
    public function retry($id)
    {
        $log = AccountingEntryLog::findOrFail($id);

        if ($log->status !== 'error') {
            return response()->json([
                'message' => 'Solo se pueden reintentar asientos con status "error".',
            ], 422);
        }

        if (empty($log->payload_sent) || empty($log->payload_sent['items'])) {
            return response()->json([
                'message' => 'Este registro no tiene payload guardado para reintentar.',
            ], 422);
        }

        // Verificar duplicado
        $isDuplicate = AccountingEntryLog::isDuplicate($log->entry_type, $log->reference)
            ->where('id', '!=', $log->id)
            ->exists();

        if ($isDuplicate) {
            $log->markSkipped('Asiento duplicado detectado en reintento manual');
            return response()->json([
                'message' => 'Ya existe un asiento exitoso con el mismo tipo y referencia.',
                'log' => $log->fresh(),
            ], 409);
        }

        $service = app(ErpAccountingService::class);

        if (!$service->isConfigured()) {
            return response()->json([
                'message' => 'El servicio ERP no está configurado.',
            ], 503);
        }

        // Incrementar retry y marcar como pending
        $log->incrementRetry();

        $payload = $log->payload_sent;

        $result = $service->createJournalEntry(
            date: $payload['date'] ?? now()->format('Y-m-d'),
            description: $payload['description'] ?? "Reintento manual asiento {$log->entry_type}",
            items: $payload['items'],
            reference: $payload['reference'] ?? null
        );

        $sentPayload = $result['_payload'] ?? $payload;
        unset($result['_payload']);

        if ($result['success'] ?? false) {
            $log->markSuccess($result, $sentPayload);

            // Marcar cuentas como validadas
            $accountCodes = collect($sentPayload['items'] ?? [])
                ->pluck('account_code')
                ->filter()
                ->unique()
                ->toArray();
            if (!empty($accountCodes)) {
                ErpAccountingAccount::markCodesValidated($accountCodes);
            }

            return response()->json([
                'message' => 'Asiento reenviado exitosamente.',
                'log' => $log->fresh(),
                'erp_result' => $result,
            ]);
        }

        $log->markError($result, $sentPayload);

        return response()->json([
            'message' => 'El reintento falló: ' . ($result['error'] ?? 'Error desconocido'),
            'log' => $log->fresh(),
            'erp_result' => $result,
        ], 502);
    }
}
