<?php

namespace App\Observers;

use App\Jobs\SyncLeadToErpJob;
use App\Models\Lead;

/**
 * v1.0 F4 — Outbound sync de Lead → CRM ERP.
 *
 * Gated por config('services.erp.crm.enabled'). Default OFF.
 * Dispatcha job en queue para no bloquear el request.
 */
class LeadErpSyncObserver
{
    public function saved(Lead $lead): void
    {
        if (! config('services.erp.crm.enabled', false)) {
            return;
        }

        SyncLeadToErpJob::dispatch($lead->id);
    }
}
