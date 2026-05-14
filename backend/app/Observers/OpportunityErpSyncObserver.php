<?php

namespace App\Observers;

use App\Jobs\SyncOpportunityToErpJob;
use App\Models\Opportunity;

class OpportunityErpSyncObserver
{
    public function saved(Opportunity $opp): void
    {
        if (! config('services.erp.crm.enabled', false)) {
            return;
        }

        SyncOpportunityToErpJob::dispatch($opp->id);
    }
}
