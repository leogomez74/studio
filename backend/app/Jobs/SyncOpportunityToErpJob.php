<?php

namespace App\Jobs;

use App\Models\Opportunity;
use App\Services\ErpCrmService;
use Exception;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SyncOpportunityToErpJob implements ShouldQueue, ShouldBeUnique
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 5;
    public int $uniqueFor = 60;

    /**
     * Opportunity uses string PK (YY-XXXXX-EPP-OP format).
     */
    public function __construct(public string $opportunityId) {}

    public function uniqueId(): string
    {
        return "sync-opportunity-erp-{$this->opportunityId}";
    }

    public function backoff(): array
    {
        return [30, 120, 300, 900, 1800];
    }

    public function handle(ErpCrmService $service): void
    {
        $opp = Opportunity::find($this->opportunityId);

        if (! $opp) {
            Log::info('SyncOpportunityToErpJob: opportunity no encontrada, skip', [
                'opportunity_id' => $this->opportunityId,
            ]);
            return;
        }

        $result = $service->syncOpportunity($opp);

        if (! ($result['success'] ?? false)) {
            if ($result['skipped'] ?? false) {
                return;
            }
            throw new Exception('ERP CRM opportunity sync failed: ' . ($result['error'] ?? 'unknown'));
        }
    }

    public function failed(\Throwable $e): void
    {
        Log::error('SyncOpportunityToErpJob: agotó retries', [
            'opportunity_id' => $this->opportunityId,
            'error'          => $e->getMessage(),
        ]);
    }
}
