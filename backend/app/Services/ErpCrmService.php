<?php

namespace App\Services;

use App\Models\Lead;
use App\Models\Opportunity;
use Exception;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * v1.0 F4 — Outbound sync PEP → ERP CRM central.
 *
 * Mismo bridge user que ErpAccountingService (ERP_API_EMAIL/ERP_API_PASSWORD).
 * Endpoints:
 *   POST {ERP_API_URL}/auth/login           → bearer token (cache 1h)
 *   POST {ERP_API_URL}/api/external/crm/pep/contacts  → upsert lead/cliente
 *   POST {ERP_API_URL}/api/external/crm/pep/deals     → upsert opportunity
 *
 * Headers requeridos:
 *   Authorization:      Bearer <token>
 *   X-Company-ID:       <ERP_COMPANY_ID>
 *   X-Erp-Api-Version:  2026-05
 *   X-Idempotency-Key:  pep-{resource}-{entityId}-{updatedAtUnix}
 *
 * El ERP usa PepFieldMapper para mapear:
 *   nombre_completo → name+apellido1+apellido2
 *   lead_cedula     → cedula
 *   lead_email      → email
 *   lead_telefono   → phone
 *   estado          → status
 */
class ErpCrmService
{
    private const TOKEN_CACHE_KEY = 'erp_crm_token';
    private const TOKEN_TTL = 3600;

    private string $baseUrl;
    private string $email;
    private string $password;
    private int $companyId;
    private string $apiVersion;
    private string $sourceSlug;

    public function __construct()
    {
        $this->baseUrl    = rtrim((string) config('services.erp.url', ''), '/');
        $this->email      = (string) config('services.erp.email', '');
        $this->password   = (string) config('services.erp.password', '');
        $this->companyId  = (int) config('services.erp.crm.company_id', 0);
        $this->apiVersion = (string) config('services.erp.crm.api_version', '2026-05');
        $this->sourceSlug = (string) config('services.erp.crm.source_slug', 'pep');
    }

    public function isConfigured(): bool
    {
        return (bool) config('services.erp.crm.enabled', false)
            && $this->baseUrl !== ''
            && $this->email !== ''
            && $this->password !== ''
            && $this->companyId > 0;
    }

    public function getToken(): string
    {
        $cached = Cache::get(self::TOKEN_CACHE_KEY);
        if ($cached) {
            return $cached;
        }

        return $this->authenticate();
    }

    public function authenticate(): string
    {
        $response = Http::timeout(15)->post($this->baseUrl . '/auth/login', [
            'email' => $this->email,
            'password' => $this->password,
        ]);

        if (! $response->successful()) {
            Log::error('ERP CRM Auth: login fallido', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            throw new Exception('ERP CRM: no se pudo autenticar. Status: ' . $response->status());
        }

        $data = $response->json();
        $token = $data['data']['token'] ?? null;

        if (! $token) {
            throw new Exception('ERP CRM: respuesta de auth inesperada — ' . ($data['message'] ?? 'sin mensaje'));
        }

        Cache::put(self::TOKEN_CACHE_KEY, $token, self::TOKEN_TTL);

        return $token;
    }

    public function clearToken(): void
    {
        Cache::forget(self::TOKEN_CACHE_KEY);
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

        return $this->sendWithRetry(
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

        return $this->sendWithRetry(
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
    // HTTP CON RETRY 401
    // ════════════════════════════════════════════════════════════════════

    private function sendWithRetry(string $endpoint, array $payload, string $idempotencyKey): array
    {
        $attempts = 0;
        $maxAttempts = 2;

        while ($attempts < $maxAttempts) {
            $attempts++;
            $token = $this->getToken();

            $response = Http::timeout(30)
                ->withHeaders([
                    'Authorization'     => "Bearer {$token}",
                    'X-Company-ID'      => (string) $this->companyId,
                    'X-Erp-Api-Version' => $this->apiVersion,
                    'X-Idempotency-Key' => $idempotencyKey,
                    'Accept'            => 'application/json',
                ])
                ->post($this->baseUrl . $endpoint, $payload);

            if ($response->status() === 401 && $attempts < $maxAttempts) {
                Log::warning('ERP CRM: 401, reautenticando', ['endpoint' => $endpoint]);
                $this->clearToken();
                continue;
            }

            if (! $response->successful()) {
                Log::error('ERP CRM: respuesta no exitosa', [
                    'endpoint' => $endpoint,
                    'status'   => $response->status(),
                    'body'     => $response->body(),
                ]);

                return [
                    'success' => false,
                    'status'  => $response->status(),
                    'error'   => $response->body(),
                ];
            }

            return [
                'success' => true,
                'status'  => $response->status(),
                'data'    => $response->json(),
            ];
        }

        return ['success' => false, 'error' => 'max_retries_exceeded'];
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
