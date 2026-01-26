<?php

namespace Database\Factories;

use App\Models\Deductora;
use Illuminate\Database\Eloquent\Factories\Factory;

class DeductoraFactory extends Factory
{
    protected $model = Deductora::class;

    public function definition(): array
    {
        return [
            'nombre' => $this->faker->company,
            'fecha_reporte_pago' => now(),
            'comision' => 5.00,
        ];
    }
}