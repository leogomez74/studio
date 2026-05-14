<?php

namespace App\Console\Commands;

use App\Jobs\SyncLeadToErpJob;
use App\Jobs\SyncOpportunityToErpJob;
use App\Models\Lead;
use App\Models\Opportunity;
use Illuminate\Console\Command;

/**
 * v1.0 F4 — Reconciliación periódica: re-sincroniza filas modificadas
 * en los últimos N días. Atrapa drift cuando jobs fallan silenciosamente
 * (e.g. queue caída, 5xx persistente del lado ERP).
 *
 *   php artisan erp:crm-reconcile --days=7 [--dry-run]
 */
class ErpCrmReconcileCommand extends Command
{
    protected $signature = 'erp:crm-reconcile
        {--days=7 : Ventana de updated_at a re-sincronizar}
        {--dry-run : No dispatch jobs, solo cuenta}';

    protected $description = 'Re-sincroniza Leads/Opportunities modificados recientemente al CRM ERP.';

    public function handle(): int
    {
        $days = (int) $this->option('days');
        $dryRun = (bool) $this->option('dry-run');
        $since = now()->subDays($days);

        if (! config('services.erp.crm.enabled') && ! $dryRun) {
            $this->warn('services.erp.crm.enabled está OFF.');
            return self::FAILURE;
        }

        $this->info("Reconcile updated_at >= {$since->toDateTimeString()} (dry-run=" . ($dryRun ? 'yes' : 'no') . ')');

        $leads = Lead::where('updated_at', '>=', $since)->count();
        $opps = Opportunity::where('updated_at', '>=', $since)->count();

        $this->line("  leads candidatos: {$leads}");
        $this->line("  opportunities candidatos: {$opps}");

        if ($dryRun) {
            return self::SUCCESS;
        }

        Lead::where('updated_at', '>=', $since)
            ->orderBy('id')
            ->chunkById(200, function ($rows) {
                foreach ($rows as $lead) {
                    SyncLeadToErpJob::dispatch($lead->id);
                }
            });

        Opportunity::where('updated_at', '>=', $since)
            ->orderBy('id')
            ->chunkById(200, function ($rows) {
                foreach ($rows as $opp) {
                    SyncOpportunityToErpJob::dispatch($opp->id);
                }
            }, 'id', 'id');

        $this->info('Reconcile dispatch completo.');
        return self::SUCCESS;
    }
}
