<?php

namespace App\Console\Commands;

use App\Models\AccountingEntryLog;
use App\Models\ErpAccountingAccount;
use App\Services\ErpAccountingService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class RetryFailedAccountingEntries extends Command
{
    protected $signature = 'accounting:retry-failed
                            {--limit=10 : Máximo de registros a reintentar por ejecución}
                            {--dry-run : Solo mostrar qué se reintentaría, sin ejecutar}';

    protected $description = 'Reintenta asientos contables fallidos que tienen payload guardado';

    public function handle(): int
    {
        $limit = (int) $this->option('limit');
        $dryRun = $this->option('dry-run');

        $logs = AccountingEntryLog::retryable()
            ->orderBy('next_retry_at', 'asc')
            ->limit($limit)
            ->get();

        if ($logs->isEmpty()) {
            $this->info('No hay asientos pendientes de reintento.');
            return self::SUCCESS;
        }

        $this->info("Encontrados {$logs->count()} asientos para reintentar.");

        if ($dryRun) {
            $this->table(
                ['ID', 'Tipo', 'Referencia', 'Reintentos', 'Error'],
                $logs->map(fn ($l) => [
                    $l->id,
                    $l->entry_type,
                    $l->reference,
                    "{$l->retry_count}/{$l->max_retries}",
                    \Illuminate\Support\Str::limit($l->error_message, 60),
                ])->toArray()
            );
            return self::SUCCESS;
        }

        $service = app(ErpAccountingService::class);

        if (!$service->isConfigured()) {
            $this->error('El servicio ERP no está configurado.');
            return self::FAILURE;
        }

        $success = 0;
        $failed = 0;

        foreach ($logs as $log) {
            $this->line("Reintentando #{$log->id} ({$log->entry_type} - {$log->reference})...");

            // Incrementar contador y marcar como pending
            $log->incrementRetry();

            $payload = $log->payload_sent;

            if (empty($payload) || empty($payload['items'])) {
                $this->warn("  -> Sin payload válido, omitido.");
                $log->markError(['error' => 'Payload guardado inválido o sin items']);
                $failed++;
                continue;
            }

            // Verificar duplicado antes de reintentar
            $isDuplicate = AccountingEntryLog::isDuplicate($log->entry_type, $log->reference)
                ->where('id', '!=', $log->id)
                ->exists();

            if ($isDuplicate) {
                $this->warn("  -> Asiento duplicado ya exitoso, marcando como skipped.");
                $log->markSkipped('Asiento duplicado detectado en reintento');
                continue;
            }

            // Reenviar al ERP
            $result = $service->createJournalEntry(
                date: $payload['date'] ?? now()->format('Y-m-d'),
                description: $payload['description'] ?? "Reintento asiento {$log->entry_type}",
                items: $payload['items'],
                reference: $payload['reference'] ?? null
            );

            $sentPayload = $result['_payload'] ?? $payload;
            unset($result['_payload']);

            if ($result['success'] ?? false) {
                $log->markSuccess($result, $sentPayload);
                $this->info("  -> Exitoso! ERP ID: " . ($result['data']['journal_entry_id'] ?? 'N/A'));
                $success++;

                // Marcar cuentas como validadas
                $accountCodes = collect($sentPayload['items'] ?? [])
                    ->pluck('account_code')
                    ->filter()
                    ->unique()
                    ->toArray();
                if (!empty($accountCodes)) {
                    ErpAccountingAccount::markCodesValidated($accountCodes);
                }
            } else {
                $log->markError($result, $sentPayload);
                $this->error("  -> Falló: " . ($result['error'] ?? 'Error desconocido'));
                $failed++;
            }
        }

        $this->newLine();
        $this->info("Resultado: {$success} exitosos, {$failed} fallidos de {$logs->count()} intentados.");

        Log::info('accounting:retry-failed completado', [
            'total' => $logs->count(),
            'success' => $success,
            'failed' => $failed,
        ]);

        return $success > 0 || $failed === 0 ? self::SUCCESS : self::FAILURE;
    }
}
