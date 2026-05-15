<?php

namespace App\Services;

use App\Models\Lead;
use App\Models\Opportunity;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * v1.0 F4 — Outbound sync PEP → ERP CRM central.
 *
 * Auth: Sanctum personal access token con ability `crm:ingest`, emitido en el
 * ERP via `php artisan crm:issue-ingestion-token --company=<slug> --source=pep`.
 * El token es estático en `ERP_INGESTION_TOKEN` (.env). Sin login flow — las
 * rutas /api/external/crm/{source}/* requieren el middleware
 * `abilities:crm:ingest` que SOLO valida tokens con esa ability específica.
 *
 * Endpoints:
 *   POST {ERP_API_URL}/api/external/crm/pep/contacts  → upsert lead/cliente
 *   POST {ERP_API_URL}/api/external/crm/pep/deals     → upsert opportunity
 *
 * Headers requeridos:
 *   Authorization:      Bearer {ERP_INGESTION_TOKEN}
 *   X-Company-ID:       {ERP_COMPANY_ID}
 *   X-Erp-Api-Version:  2026-05
 *   X-Idempotency-Key:  pep-{resource}-{entityId}-{updatedAtUnix}
 *
 * Si el ERP devuelve 401, el token fue revocado/expirado — no hay re-auth posible.
 * El job hace fail() y el sysadmin re-emite token via crm:issue-ingestion-token.
 *
 * El ERP usa PepFieldMapper para mapear el payload a CrmContact/CrmDeal.
 */
class ErpCrmService
{
    private const REQUEST_TIMEOUT = 30;

    private string $baseUrl;
    private string $ingestionToken;
    private int $companyId;
    private string $apiVersion;
    private string $sourceSlug;

    public function __construct()
    {
        $this->baseUrl        = rtrim((string) config('services.erp.url', ''), '/');
        $this->ingestionToken = (string) config('services.erp.crm.ingestion_token', '');
        $this->companyId      = (int) config('services.erp.crm.company_id', 0);
        $this->apiVersion     = (string) config('services.erp.crm.api_version', '2026-05');
        $this->sourceSlug     = (string) config('services.erp.crm.source_slug', 'pep');
    }

    public function isConfigured(): bool
    {
        return (bool) config('services.erp.crm.enabled', false)
            && $this->baseUrl !== ''
            && $this->ingestionToken !== ''
            && $this->companyId > 0;
    }

    // ════════════════════════════════════════════════════════════════════
    // SYNC LEAD
    // ════════════════════════════════════════════════════════════════════

    public function syncLead(Lead $lead): array
    {
        if (! $this->isConfigured()) {
            return ['success' => false, 'skipped' => true, 'reason' => 'crm_disabled'];
        }

        $payload = $this->mapLeadPayload($lead);
        $idempotencyKey = "pep-contacts-{$lead->id}-" . optional($lead->updated_at)->timestamp;

        return $this->send(
            endpoint: '/api/external/crm/' . $this->sourceSlug . '/contacts',
            payload: $payload,
            idempotencyKey: $idempotencyKey,
        );
    }

    private function mapLeadPayload(Lead $lead): array
    {
        return [
            'id'                  => (string) $lead->id,
            'lead_cedula'         => $lead->cedula,
            'nombre'              => $lead->name,
            'apellido1'           => $lead->apellido1,
            'apellido2'           => $lead->apellido2,
            'nombre_completo'     => trim(implode(' ', array_filter([
                $lead->name, $lead->apellido1, $lead->apellido2,
            ]))),
            'lead_email'          => $lead->email,
            'lead_telefono'       => $lead->phone,
            'whatsapp'            => $lead->whatsapp,
            'tipo_identificacion' => $this->inferIdType($lead->cedula),
            'estado'              => $lead->status,
            'lead_status_id'      => $lead->lead_status_id,
            'genero'              => $lead->genero,
            'nacionalidad'        => $lead->nacionalidad,
            'fecha_nacimiento'    => optional($lead->fecha_nacimiento)->toDateString(),
            'province'            => $lead->province,
            'canton'              => $lead->canton,
            'distrito'            => $lead->distrito,
            'ocupacion'           => $lead->ocupacion,
            'profesion'           => $lead->profesion,
            'es_pep'              => (bool) $lead->es_pep,
            'en_listas_internacionales' => (bool) $lead->en_listas_internacionales,
            'source'              => $lead->source,
            'assigned_agent_id'   => $lead->assigned_to_id,
            'updated_at'          => optional($lead->updated_at)->toIso8601String(),
        ];
    }

    // ════════════════════════════════════════════════════════════════════
    // SYNC OPPORTUNITY
    // ════════════════════════════════════════════════════════════════════

    public function syncOpportunity(Opportunity $opp): array
    {
        if (! $this->isConfigured()) {
            return ['success' => false, 'skipped' => true, 'reason' => 'crm_disabled'];
        }

        $payload = $this->mapOpportunityPayload($opp);
        $idempotencyKey = "pep-deals-{$opp->id}-" . optional($opp->updated_at)->timestamp;

        return $this->send(
            endpoint: '/api/external/crm/' . $this->sourceSlug . '/deals',
            payload: $payload,
            idempotencyKey: $idempotencyKey,
        );
    }

    private function mapOpportunityPayload(Opportunity $opp): array
    {
        return [
            'id'                  => (string) $opp->id,
            'lead_cedula'         => $opp->lead_cedula,
            'titulo'              => $opp->opportunity_type
                ? "{$opp->opportunity_type} — {$opp->lead_cedula}"
                : "Oportunidad {$opp->id}",
            'opportunity_type'    => $opp->opportunity_type,
            'vertical'            => $opp->vertical,
            'monto'               => $opp->amount,
            'moneda'              => 'CRC',
            'etapa'               => $opp->status,
            'expected_close_date' => optional($opp->expected_close_date)->toDateString(),
            'assigned_agent_id'   => $opp->assigned_to_id,
            'lost_reason'         => $opp->lost_reason,
            'updated_at'          => optional($opp->updated_at)->toIso8601String(),
        ];
    }

    // ════════════════════════════════════════════════════════════════════
    // HTTP layer
    // ════════════════════════════════════════════════════════════════════

    private function send(string $endpoint, array $payload, string $idempotencyKey): array
    {
        try {
            $response = Http::timeout(self::REQUEST_TIMEOUT)
                ->withHeaders([
                    'Authorization'     => 'Bearer ' . $this->ingestionToken,
                    'X-Company-ID'      => (string) $this->companyId,
                    'X-Erp-Api-Version' => $this->apiVersion,
                    'X-Idempotency-Key' => $idempotencyKey,
                    'Accept'            => 'application/json',
                ])
                ->post($this->baseUrl . $endpoint, $payload);

            if ($response->successful()) {
                return [
                    'success' => true,
                    'status'  => $response->status(),
                    'data'    => $response->json(),
                ];
            }

            // 401 = token revocado/expirado. Sin reauth posible (token estático).
            // El job retry via ShouldQueue tries=5. Si persiste, sysadmin re-emite.
            if ($response->status() === 401) {
                Log::error('erp.crm.token_invalid', [
                    'endpoint' => $endpoint,
                    'hint' => 'Re-emit token via: php artisan crm:issue-ingestion-token --company=<slug> --source=pep',
                ]);
            } else {
                Log::warning('ERP CRM: respuesta no exitosa', [
                    'endpoint' => $endpoint,
                    'status'   => $response->status(),
                    'body'     => substr((string) $response->body(), 0, 500),
                ]);
            }

            return [
                'success'     => false,
                'http_status' => $response->status(),
                'error'       => substr((string) $response->body(), 0, 200),
            ];
        } catch (\Throwable $e) {
            Log::warning('ERP CRM: exception', [
                'endpoint' => $endpoint,
                'error'    => $e->getMessage(),
            ]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    private function inferIdType(?string $cedula): string
    {
        if (! $cedula) {
            return 'fisico';
        }
        $digits = preg_replace('/\D/', '', $cedula);
        $len = strlen($digits);

        if ($len === 9 && in_array(substr($digits, 0, 1), ['1', '2', '3', '4', '5', '6', '7', '8', '9'])) {
            return 'fisico';
        }
        if ($len === 10 && substr($digits, 0, 1) === '3') {
            return 'juridico';
        }
        if ($len === 11 || $len === 12) {
            return 'dimex';
        }

        return 'fisico';
    }
}
