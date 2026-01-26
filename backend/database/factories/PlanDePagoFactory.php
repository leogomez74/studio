<?php

namespace Database\Factories;

use App\Models\PlanDePago;
use App\Models\Credit;
use Illuminate\Database\Eloquent\Factories\Factory;

class PlanDePagoFactory extends Factory
{
    protected $model = PlanDePago::class;

    public function definition(): array
    {
        return [
            'credit_id' => Credit::factory(),
            'numero_cuota' => 1,
            'fecha_pago' => $this->faker->date(),
            'cuota' => 100.00,
            'estado' => 'Pendiente',
        ];
    }
}