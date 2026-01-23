<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Opportunity;
use App\Models\Lead;

class SyncOpportunitiesFromLeads extends Command
{
    protected $signature = 'opportunities:sync-from-leads';
    protected $description = 'Sincronizar oportunidades con datos del cuestionario de los leads';

    public function handle()
    {
        $this->info('Sincronizando oportunidades con datos de leads...');

        // Buscar oportunidades con valores por defecto
        $opportunities = Opportunity::where(function ($query) {
            $query->where('opportunity_type', 'Estándar')
                  ->orWhere('vertical', 'General')
                  ->orWhere('amount', 0)
                  ->orWhereNull('amount');
        })->get();

        $this->info("Encontradas {$opportunities->count()} oportunidades para actualizar");

        $updated = 0;

        foreach ($opportunities as $opportunity) {
            $lead = Lead::where('cedula', $opportunity->lead_cedula)->first();

            if (!$lead) {
                $this->warn("Lead no encontrado para oportunidad {$opportunity->id}");
                continue;
            }

            $changes = [];

            // Actualizar opportunity_type si tiene datos del cuestionario
            if (($opportunity->opportunity_type === 'Estándar' || empty($opportunity->opportunity_type)) && !empty($lead->interes)) {
                $newType = $this->determineOpportunityType($lead);
                if ($newType !== 'Estándar') {
                    $changes['opportunity_type'] = $newType;
                }
            }

            // Actualizar vertical
            if (($opportunity->vertical === 'General' || empty($opportunity->vertical)) && !empty($lead->institucion_labora)) {
                $changes['vertical'] = $lead->institucion_labora;
            }

            // Actualizar amount
            if ((empty($opportunity->amount) || $opportunity->amount == 0) && !empty($lead->monto)) {
                $changes['amount'] = $this->extractAmountFromRange($lead->monto);
            }

            if (!empty($changes)) {
                $opportunity->update($changes);
                $updated++;
                $this->line("✓ Actualizada {$opportunity->id}: " . implode(', ', array_keys($changes)));
            }
        }

        $this->info("\n✅ Sincronización completa. {$updated} oportunidades actualizadas.");
        return 0;
    }

    private function determineOpportunityType(Lead $lead): string
    {
        $interes = $lead->interes;
        $tipoCreditoValue = $lead->tipo_credito;
        $tramites = $lead->tramites;

        if ($interes === 'credito') {
            if ($tipoCreditoValue === 'microcredito') {
                return 'Micro Crédito';
            } elseif ($tipoCreditoValue === 'regular') {
                return 'Crédito';
            }
            return 'Crédito';
        }

        if ($interes === 'servicios_legales') {
            if (is_array($tramites) && count($tramites) > 0) {
                return $this->mapTramiteToOpportunityType($tramites[0]);
            }
            return 'Servicios Legales';
        }

        if ($interes === 'ambos') {
            if (!empty($tipoCreditoValue)) {
                if ($tipoCreditoValue === 'microcredito') {
                    return 'Micro Crédito';
                } elseif ($tipoCreditoValue === 'regular') {
                    return 'Crédito';
                }
                return 'Crédito';
            }
            if (is_array($tramites) && count($tramites) > 0) {
                return $this->mapTramiteToOpportunityType($tramites[0]);
            }
        }

        return 'Estándar';
    }

    private function mapTramiteToOpportunityType(string $tramite): string
    {
        $mapping = [
            'divorcio' => 'Divorcio',
            'notariado' => 'Notariado',
            'testamento' => 'Testamentos',
            'testamentos' => 'Testamentos',
            'descuento_facturas' => 'Descuento de Facturas',
            'poder' => 'Poder',
            'escritura' => 'Escritura',
            'declaratoria_herederos' => 'Declaratoria de Herederos',
        ];

        $tramiteLower = strtolower($tramite);
        return $mapping[$tramiteLower] ?? ucfirst($tramite);
    }

    private function extractAmountFromRange(string $rangoMonto): float
    {
        $rangosMap = [
            '100k-250k' => 175000,
            '250k-450k' => 350000,
            '300k-450k' => 375000,
            '450k-690k' => 570000,
            '690k-1m' => 845000,
            '1m-1.7m' => 1350000,
            '1.7m-2.2m' => 1950000,
        ];

        if (isset($rangosMap[$rangoMonto])) {
            return $rangosMap[$rangoMonto];
        }

        $rangoMonto = strtolower(str_replace([' ', ',', '₡'], '', $rangoMonto));

        if (preg_match('/(\d+(?:\.\d+)?)(k|m)?-(\d+(?:\.\d+)?)(k|m)?/', $rangoMonto, $matches)) {
            $min = (float) $matches[1];
            $max = (float) $matches[3];

            if (isset($matches[2]) && $matches[2] === 'k') $min *= 1000;
            if (isset($matches[2]) && $matches[2] === 'm') $min *= 1000000;
            if (isset($matches[4]) && $matches[4] === 'k') $max *= 1000;
            if (isset($matches[4]) && $matches[4] === 'm') $max *= 1000000;

            return ($min + $max) / 2;
        }

        return 0;
    }
}
