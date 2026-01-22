<?php

namespace Database\Factories;

use App\Models\Credit;
use App\Models\Lead;
use App\Models\Opportunity;
use Illuminate\Database\Eloquent\Factories\Factory;

use Illuminate\Support\Str;

class CreditFactory extends Factory
{
    protected $model = Credit::class;

    public function definition(): array
    {
        return [
            'lead_id' => Lead::factory(),
            'opportunity_id' => Opportunity::factory(),
            'status' => 'Active',
            'monto_credito' => $this->faker->randomFloat(2, 5000, 50000),
            'poliza_actual' => $this->faker->randomFloat(2, 0, 5000),
            'reference' => 'CRED-' . Str::upper(Str::random(8)),
            'title' => 'Crédito Test ' . $this->faker->word,
        ];
    }
}