<?php

namespace Database\Factories;

use App\Models\Opportunity;
use App\Models\Lead;
use Illuminate\Database\Eloquent\Factories\Factory;

class OpportunityFactory extends Factory
{
    protected $model = Opportunity::class;

    public function definition(): array
    {
        return [
            'lead_cedula' => function () {
                return Lead::factory()->create()->cedula;
            },
            'opportunity_type' => 'Personal',
            'vertical' => 'Lending',
            'amount' => $this->faker->randomFloat(2, 1000, 10000),
            'status' => 'Pendiente',
        ];
    }
}