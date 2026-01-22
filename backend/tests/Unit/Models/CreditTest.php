<?php

namespace Tests\Unit\Models;

use App\Models\Credit;
use App\Models\CreditDocument;
use App\Models\CreditPayment;
use App\Models\Deductora;
use App\Models\Lead;
use App\Models\Opportunity;
use App\Models\PlanDePago;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CreditTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function it_has_correct_fillable_attributes()
    {
        $credit = new Credit();

        $expectedFillable = [
            'reference',
            'title',
            'status',
            'category',
            'progress',
            'lead_id',
            'opportunity_id',
            'assigned_to',
            'opened_at',
            'description',
            'tipo_credito',
            'numero_operacion',
            'monto_credito',
            'cuota',
            'movimiento_amortizacion',
            'fecha_ultimo_pago',
            'garantia',
            'fecha_culminacion_credito',
            'tasa_anual',
            'plazo',
            'cuotas_atrasadas',
            'deductora_id',
            'poliza',
            'poliza_actual'
        ];

        $this->assertEquals($expectedFillable, $credit->getFillable());
    }

    /** @test */
    public function it_casts_attributes_correctly()
    {
        $credit = new Credit();
        $casts = $credit->getCasts();

        $this->assertEquals('integer', $casts['progress']);
        $this->assertEquals('date', $casts['opened_at']);
        $this->assertEquals('date', $casts['fecha_ultimo_pago']);
        $this->assertEquals('date', $casts['fecha_culminacion_credito']);
        $this->assertEquals('decimal:2', $casts['monto_credito']);
        $this->assertEquals('decimal:2', $casts['saldo']);
        $this->assertEquals('decimal:2', $casts['cuota']);
        $this->assertEquals('decimal:2', $casts['movimiento_amortizacion']);
        $this->assertEquals('decimal:2', $casts['tasa_anual']);
        $this->assertEquals('decimal:2', $casts['poliza_actual']);
        $this->assertEquals('boolean', $casts['poliza']);
    }

    /** @test */
    public function it_belongs_to_a_lead()
    {
        $lead = Lead::factory()->create();
        $credit = Credit::factory()->create(['lead_id' => $lead->id]);

        $this->assertInstanceOf(Lead::class, $credit->lead);
        $this->assertEquals($lead->id, $credit->lead->id);
    }

    /** @test */
    public function it_belongs_to_an_opportunity()
    {
        $opportunity = Opportunity::factory()->create();
        $credit = Credit::factory()->create(['opportunity_id' => $opportunity->id]);

        $this->assertInstanceOf(Opportunity::class, $credit->opportunity);
        $this->assertEquals($opportunity->id, $credit->opportunity->id);
    }

    /** @test */
    public function it_belongs_to_a_deductora()
    {
        $deductora = Deductora::factory()->create();
        $credit = Credit::factory()->create(['deductora_id' => $deductora->id]);

        $this->assertInstanceOf(Deductora::class, $credit->deductora);
        $this->assertEquals($deductora->id, $credit->deductora->id);
    }

    /** @test */
    public function it_has_many_plan_de_pagos()
    {
        $credit = Credit::factory()->create();
        $plan = PlanDePago::factory()->create(['credit_id' => $credit->id]);

        $this->assertTrue($credit->planDePagos->contains($plan));
        $this->assertInstanceOf(PlanDePago::class, $credit->planDePagos->first());
    }

    /** @test */
    public function it_has_many_payments()
    {
        $credit = Credit::factory()->create();
        $payment = CreditPayment::factory()->create(['credit_id' => $credit->id]);

        $this->assertTrue($credit->payments->contains($payment));
        $this->assertInstanceOf(CreditPayment::class, $credit->payments->first());
    }

    /** @test */
    public function it_has_many_documents()
    {
        $credit = Credit::factory()->create();
        $document = CreditDocument::factory()->create(['credit_id' => $credit->id]);

        $this->assertTrue($credit->documents->contains($document));
        $this->assertInstanceOf(CreditDocument::class, $credit->documents->first());
    }

    /** @test */
    public function it_sets_initial_saldo_equal_to_monto_credito_on_creation()
    {
        $amount = 10000.00;
        $credit = Credit::factory()->create([
            'monto_credito' => $amount,
            'saldo' => null // Ensure it's not set explicitly
        ]);

        $this->assertEquals($amount, $credit->fresh()->saldo);
    }

    /** @test */
    public function it_gets_primera_deduccion_attribute()
    {
        $credit = Credit::factory()->create();
        
        // Create a plan de pago with numero_cuota > 0
        $date = Carbon::now()->addMonth();
        PlanDePago::factory()->create([
            'credit_id' => $credit->id,
            'numero_cuota' => 1,
            'fecha_pago' => $date
        ]);

        // Create an earlier plan de pago with numero_cuota = 0 (should be ignored)
        PlanDePago::factory()->create([
            'credit_id' => $credit->id,
            'numero_cuota' => 0,
            'fecha_pago' => Carbon::now()
        ]);

        $this->assertEquals($date->toDateString(), $credit->primera_deduccion);
    }
}
