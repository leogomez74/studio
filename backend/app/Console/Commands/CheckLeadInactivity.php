<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Lead;
use App\Models\LeadAlert;
use App\Models\Opportunity;
use App\Models\Person;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class CheckLeadInactivity extends Command
{
    protected $signature = 'leads:check-inactivity';
    protected $description = 'Detecta leads y oportunidades inactivos y genera alertas agrupadas';

    /** Semana y media en días */
    private const INACTIVITY_DAYS = 11;

    /** Días entre alertas (2 semanas) */
    private const ALERT_INTERVAL_DAYS = 14;

    /** Días desde la primera alerta para la alerta final (1 mes) */
    private const FINAL_ALERT_DAYS = 30;

    /** Máximo de alertas por ciclo */
    private const MAX_ALERTS = 3;

    public function handle(): int
    {
        $this->info('Verificando inactividad de leads y oportunidades...');

        // 1. Obtener leads inactivos (semana y media sin cambios)
        $inactiveLeads = Lead::where('is_active', true)
            ->where('updated_at', '<', Carbon::now()->subDays(self::INACTIVITY_DAYS))
            ->get()
            ->map(fn ($lead) => [
                'id' => $lead->id,
                'name' => trim("{$lead->name} {$lead->apellido1} {$lead->apellido2}"),
            ])
            ->values()
            ->toArray();

        // 2. Obtener oportunidades inactivas
        $inactiveOpportunities = Opportunity::where('status', '!=', 'Perdido')
            ->where('updated_at', '<', Carbon::now()->subDays(self::INACTIVITY_DAYS))
            ->get()
            ->map(function ($opp) {
                // Usar Person directamente para evitar el global scope de Lead
                $person = Person::where('cedula', $opp->lead_cedula)->first();
                $leadName = $person
                    ? trim("{$person->name} {$person->apellido1} {$person->apellido2}")
                    : 'Sin lead asociado';

                return [
                    'id' => $opp->id,
                    'reference' => $opp->id,
                    'lead_name' => $leadName,
                ];
            })
            ->values()
            ->toArray();

        // 3. Si no hay inactivos, salir
        if (empty($inactiveLeads) && empty($inactiveOpportunities)) {
            $this->info('No se encontraron leads ni oportunidades inactivos.');
            return self::SUCCESS;
        }

        $this->info('Inactivos encontrados - Leads: ' . count($inactiveLeads) . ', Oportunidades: ' . count($inactiveOpportunities));

        // 4. Verificar última alerta del ciclo
        $lastAlert = LeadAlert::orderBy('created_at', 'desc')->first();

        if ($lastAlert && $lastAlert->alert_number >= self::MAX_ALERTS) {
            $this->info('Ciclo de alertas completado (3/3). No se generan más alertas.');
            return self::SUCCESS;
        }

        $shouldCreate = false;
        $alertNumber = 1;
        $alertType = LeadAlert::TYPE_INACTIVITY_WARNING;
        $message = '';

        if (!$lastAlert) {
            // Primera alerta del ciclo
            $shouldCreate = true;
            $alertNumber = 1;
            $message = 'Se detectaron leads y/o oportunidades con más de 10 días de inactividad.';
        } elseif ($lastAlert->alert_number === 1) {
            // Verificar si pasaron 14 días desde la alerta 1
            $daysSinceAlert1 = Carbon::parse($lastAlert->created_at)->diffInDays(Carbon::now());
            if ($daysSinceAlert1 >= self::ALERT_INTERVAL_DAYS) {
                $shouldCreate = true;
                $alertNumber = 2;
                $message = 'Segunda alerta: leads y/o oportunidades siguen inactivos después de 2 semanas.';
            }
        } elseif ($lastAlert->alert_number === 2) {
            // Verificar si pasó 1 mes desde la alerta 1
            $firstAlert = LeadAlert::where('alert_number', 1)->orderBy('created_at', 'desc')->first();
            if ($firstAlert) {
                $daysSinceFirst = Carbon::parse($firstAlert->created_at)->diffInDays(Carbon::now());
                if ($daysSinceFirst >= self::FINAL_ALERT_DAYS) {
                    $shouldCreate = true;
                    $alertNumber = 3;
                    $alertType = LeadAlert::TYPE_INACTIVITY_FINAL;
                    $message = 'Alerta final: los siguientes leads y/o oportunidades deben ser marcados como Perdido por el encargado del CRM.';
                }
            }
        }

        if (!$shouldCreate) {
            $this->info('No es momento de generar una nueva alerta aún.');
            return self::SUCCESS;
        }

        // 5. Crear la alerta agrupada
        $alert = LeadAlert::create([
            'alert_type' => $alertType,
            'alert_number' => $alertNumber,
            'inactive_leads' => $inactiveLeads,
            'inactive_opportunities' => $inactiveOpportunities,
            'message' => $message,
            'is_read' => false,
            'assigned_to_id' => null,
        ]);

        Log::info("Alerta de inactividad #{$alertNumber} creada", [
            'alert_id' => $alert->id,
            'leads_count' => count($inactiveLeads),
            'opportunities_count' => count($inactiveOpportunities),
        ]);

        // 6. Enviar webhook con la alerta
        $this->sendWebhook($alert, $inactiveLeads, $inactiveOpportunities);

        $this->info("Alerta #{$alertNumber} creada exitosamente ({$alertType}).");
        $this->info("Leads inactivos: " . count($inactiveLeads) . " | Oportunidades inactivas: " . count($inactiveOpportunities));

        return self::SUCCESS;
    }

    private function sendWebhook(LeadAlert $alert, array $inactiveLeads, array $inactiveOpportunities): void
    {
        $webhookUrl = 'http://localhost:5678/webhook-test/462e36a0-8135-485a-89e6-9c7867d36e36';

        try {
            Http::timeout(10)->post($webhookUrl, [
                'alert_id' => $alert->id,
                'alert_type' => $alert->alert_type,
                'alert_number' => $alert->alert_number,
                'message' => $alert->message,
                'inactive_leads' => $inactiveLeads,
                'inactive_opportunities' => $inactiveOpportunities,
                'created_at' => $alert->created_at->toIso8601String(),
            ]);

            $this->info('Webhook enviado exitosamente.');
        } catch (\Exception $e) {
            Log::warning('Error enviando webhook de inactividad', [
                'alert_id' => $alert->id,
                'error' => $e->getMessage(),
            ]);
            $this->warn('No se pudo enviar el webhook: ' . $e->getMessage());
        }
    }
}
