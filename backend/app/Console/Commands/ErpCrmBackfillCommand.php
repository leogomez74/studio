<?php

namespace App\Console\Commands;

use App\Jobs\SyncLeadToErpJob;
use App\Jobs\SyncOpportunityToErpJob;
use App\Models\Lead;
use App\Models\Opportunity;
use Illuminate\Console\Command;

/**
 * v1.0 F4 — Backfill resumable de Leads/Opportunities al CRM ERP.
 *
 *   php artisan erp:crm-backfill --type=leads        --batch=200 [--resume=N] [--dry-run]
 *   php artisan erp:crm-backfill --type=opportunities --batch=200 [--resume=N] [--dry-run]
 *   php artisan erp:crm-backfill --type=both          --batch=200
 */
class ErpCrmBackfillCommand extends Command
{
    protected $signature = 'erp:crm-backfill
        {--type=both : leads|opportunities|both}
        {--batch=200 : Tamaño del batch}
        {--resume= : ID o consecutivo desde donde resumir}
        {--dry-run : No dispatch jobs, solo cuenta}';

    protected $description = 'Backfill outbound de Lead/Opportunity al CRM ERP (resumable).';

    public function handle(): int
    {
        $type = $this->option('type');
        $batch = (int) $this->option('batch');
        $resume = $this->option('resume');
        $dryRun = (bool) $this->option('dry-run');

        if (! config('services.erp.crm.enabled') && ! $dryRun) {
            $this->warn('services.erp.crm.enabled está OFF. Activa el flag o usa --dry-run.');
            return self::FAILURE;
        }

        if (in_array($type, ['leads', 'both'], true)) {
            $this->backfillLeads($batch, $resume, $dryRun);
        }

        if (in_array($type, ['opportunities', 'both'], true)) {
            $this->backfillOpportunities($batch, $resume, $dryRun);
        }

        return self::SUCCESS;
    }

    private function backfillLeads(int $batch, ?string $resume, bool $dryRun): void
    {
        $this->info("Backfill leads (batch={$batch}, resume=" . ($resume ?? '0') . ", dry-run=" . ($dryRun ? 'yes' : 'no') . ')');

        $query = Lead::query()->orderBy('id');
        if ($resume) {
            $query->where('id', '>', (int) $resume);
        }

        $total = 0;
        $lastId = null;
        $query->chunkById($batch, function ($leads) use (&$total, &$lastId, $dryRun) {
            foreach ($leads as $lead) {
                $lastId = $lead->id;
                $total++;
                if (! $dryRun) {
                    SyncLeadToErpJob::dispatch($lead->id);
                }
            }
            $this->line("  procesados: {$total} (last_id={$lastId})");
        });

        $this->info("Leads backfill done — total={$total}, last_id={$lastId}");
    }

    private function backfillOpportunities(int $batch, ?string $resume, bool $dryRun): void
    {
        $this->info("Backfill opportunities (batch={$batch}, resume=" . ($resume ?? '0') . ", dry-run=" . ($dryRun ? 'yes' : 'no') . ')');

        $query = Opportunity::query()->orderBy('id');
        if ($resume) {
            $query->where('id', '>', $resume);
        }

        $total = 0;
        $lastId = null;
        $query->chunkById($batch, function ($opps) use (&$total, &$lastId, $dryRun) {
            foreach ($opps as $opp) {
                $lastId = $opp->id;
                $total++;
                if (! $dryRun) {
                    SyncOpportunityToErpJob::dispatch($opp->id);
                }
            }
            $this->line("  procesados: {$total} (last_id={$lastId})");
        }, 'id', 'id');

        $this->info("Opportunities backfill done — total={$total}, last_id={$lastId}");
    }
}
