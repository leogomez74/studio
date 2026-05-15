<?php

namespace Tests\Feature;

use App\Jobs\SyncLeadToErpJob;
use App\Jobs\SyncOpportunityToErpJob;
use App\Models\Lead;
use App\Models\Opportunity;
use App\Services\ErpCrmService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * v1.0 F4 — ERP CRM federation outbound sync (PEP).
 *
 * Cubre:
 *  - ErpCrmService.isConfigured (flag OFF default + token vacío)
 *  - syncLead() construye payload + headers correctos con Bearer ingestion_token
 *  - syncOpportunity() idem
 *  - 401 NO retries (token estático, no hay reauth posible)
 *  - Observers dispatchan job solo si flag ON
 *  - Job retry/uniqueId
 */
class ErpCrmSyncTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Config::set('services.erp.url', 'https://erp.test');
        Config::set('services.erp.crm.enabled', true);
        Config::set('services.erp.crm.ingestion_token', 'sanctum-pat-pep-crm-ingest');
        Config::set('services.erp.crm.company_id', 77);
        Config::set('services.erp.crm.api_version', '2026-05');
        Config::set('services.erp.crm.source_slug', 'pep');
        Cache::flush();
    }

    public function test_service_skips_when_flag_off(): void
    {
        Config::set('services.erp.crm.enabled', false);
        Http::fake();

        $lead = Lead::withoutEvents(fn () => Lead::factory()->create());
        $result = app(ErpCrmService::class)->syncLead($lead);

        $this->assertFalse($result['success']);
        $this->assertTrue($result['skipped']);
        Http::assertNothingSent();
    }

    public function test_service_skips_when_token_missing(): void
    {
        Config::set('services.erp.crm.ingestion_token', '');
        Http::fake();

        $lead = Lead::withoutEvents(fn () => Lead::factory()->create());
        $result = app(ErpCrmService::class)->syncLead($lead);

        $this->assertFalse($result['success']);
        $this->assertTrue($result['skipped']);
        Http::assertNothingSent();
    }

    public function test_sync_lead_posts_with_correct_headers_no_login(): void
    {
        Http::fake([
            'erp.test/api/external/crm/pep/contacts' => Http::response(['data' => ['id' => 99]], 201),
        ]);

        $lead = Lead::withoutEvents(fn () => Lead::factory()->create([
            'name' => 'Luis',
            'apellido1' => 'Mora',
            'cedula' => '208880123',
            'email' => 'luis@x.com',
        ]));

        $result = app(ErpCrmService::class)->syncLead($lead);

        $this->assertTrue($result['success']);

        Http::assertNotSent(function ($req) {
            return str_contains($req->url(), '/auth/login');
        });

        Http::assertSent(function ($req) {
            if (! str_contains($req->url(), '/external/crm/pep/contacts')) {
                return false;
            }
            $headers = $req->headers();
            return ($headers['Authorization'][0] ?? '') === 'Bearer sanctum-pat-pep-crm-ingest'
                && ($headers['X-Company-ID'][0] ?? '') === '77'
                && ($headers['X-Erp-Api-Version'][0] ?? '') === '2026-05'
                && str_starts_with($headers['X-Idempotency-Key'][0] ?? '', 'pep-contacts-');
        });
    }

    public function test_sync_lead_payload_shape_matches_pep_field_mapper_contract(): void
    {
        Http::fake([
            'erp.test/api/external/crm/pep/contacts' => Http::response(['data' => ['id' => 1]], 201),
        ]);

        $lead = Lead::withoutEvents(fn () => Lead::factory()->create([
            'name' => 'Marta',
            'apellido1' => 'Rojas',
            'apellido2' => 'Vega',
            'cedula' => '108880123',
            'email' => 'marta@x.com',
            'status' => 'New',
        ]));

        app(ErpCrmService::class)->syncLead($lead);

        Http::assertSent(function ($req) {
            if (! str_contains($req->url(), '/external/crm/pep/contacts')) {
                return false;
            }
            $body = $req->data();
            return $body['nombre'] === 'Marta'
                && $body['apellido1'] === 'Rojas'
                && $body['nombre_completo'] === 'Marta Rojas Vega'
                && $body['lead_email'] === 'marta@x.com'
                && $body['lead_cedula'] === '108880123'
                && $body['tipo_identificacion'] === 'fisico'
                && $body['estado'] === 'New';
        });
    }

    public function test_sync_opportunity_payload_shape(): void
    {
        Http::fake([
            'erp.test/api/external/crm/pep/deals' => Http::response(['data' => ['id' => 1]], 201),
        ]);

        $lead = Lead::withoutEvents(fn () => Lead::factory()->create(['cedula' => '108880999']));
        $opp = Opportunity::withoutEvents(fn () => Opportunity::factory()->create([
            'lead_cedula' => $lead->cedula,
            'opportunity_type' => 'Personal',
            'amount' => 750000,
            'status' => 'En curso',
        ]));

        app(ErpCrmService::class)->syncOpportunity($opp);

        Http::assertSent(function ($req) {
            if (! str_contains($req->url(), '/external/crm/pep/deals')) {
                return false;
            }
            $body = $req->data();
            return $body['lead_cedula'] === '108880999'
                && $body['opportunity_type'] === 'Personal'
                && (int) $body['monto'] === 750000
                && $body['moneda'] === 'CRC'
                && $body['etapa'] === 'En curso';
        });
    }

    public function test_401_returns_failure_without_retry(): void
    {
        Http::fake([
            'erp.test/api/external/crm/pep/contacts' => Http::response('unauthorized', 401),
        ]);

        $lead = Lead::withoutEvents(fn () => Lead::factory()->create(['cedula' => '108880123', 'email' => 'x@x.com']));
        $result = app(ErpCrmService::class)->syncLead($lead);

        $this->assertFalse($result['success']);
        $this->assertEquals(401, $result['http_status']);
        Http::assertNotSent(function ($req) {
            return str_contains($req->url(), '/auth/login');
        });
    }

    public function test_observer_dispatches_job_when_flag_on(): void
    {
        Bus::fake();
        Lead::factory()->create();

        Bus::assertDispatched(SyncLeadToErpJob::class);
    }

    public function test_observer_does_not_dispatch_when_flag_off(): void
    {
        Config::set('services.erp.crm.enabled', false);
        Bus::fake();

        Lead::factory()->create();

        Bus::assertNotDispatched(SyncLeadToErpJob::class);
    }

    public function test_opportunity_observer_dispatches_when_flag_on(): void
    {
        Bus::fake();
        $lead = Lead::factory()->create();
        Opportunity::factory()->create(['lead_cedula' => $lead->cedula]);

        Bus::assertDispatched(SyncOpportunityToErpJob::class);
    }

    public function test_job_unique_id_dedupes_burst_updates(): void
    {
        $j1 = new SyncLeadToErpJob(42);
        $j2 = new SyncLeadToErpJob(42);
        $this->assertEquals($j1->uniqueId(), $j2->uniqueId());
        $this->assertEquals(5, $j1->tries);
        $this->assertEquals([30, 120, 300, 900, 1800], $j1->backoff());
    }
}
