<?php

namespace App\Jobs;

use App\Models\Lead;
use App\Services\ErpCrmService;
use Exception;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * v1.0 F4 — Sincroniza un Lead al CRM del ERP.
 *
 * ShouldBeUnique: dedupea bursts de saves del mismo lead durante 60s.
 * Retry exponencial: 30s → 2m → 5m → 15m → 30m (5 intentos).
 */
class SyncLeadToErpJob implements ShouldQueue, ShouldBeUnique
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 5;
    public int $uniqueFor = 60;

    public function __construct(public int $leadId) {}

    public function uniqueId(): string
    {
        return "sync-lead-erp-{$this->leadId}";
    }

    public function backoff(): array
    {
        return [30, 120, 300, 900, 1800];
    }

    public function handle(ErpCrmService $service): void
    {
        $lead = Lead::find($this->leadId);

        if (! $lead) {
            Log::info('SyncLeadToErpJob: lead no encontrado, skip', ['lead_id' => $this->leadId]);
            return;
        }

        $result = $service->syncLead($lead);

        if (! ($result['success'] ?? false)) {
            if ($result['skipped'] ?? false) {
                return;
            }
            throw new Exception('ERP CRM lead sync failed: ' . ($result['error'] ?? 'unknown'));
        }
    }

    public function failed(\Throwable $e): void
    {
        Log::error('SyncLeadToErpJob: agotó retries', [
            'lead_id' => $this->leadId,
            'error'   => $e->getMessage(),
        ]);
    }
}
