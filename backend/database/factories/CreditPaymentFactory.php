<?php

namespace Database\Factories;

use App\Models\CreditPayment;
use App\Models\Credit;
use Illuminate\Database\Eloquent\Factories\Factory;

class CreditPaymentFactory extends Factory
{
    protected $model = CreditPayment::class;

    public function definition(): array
    {
        return [
            'credit_id' => Credit::factory(),
            'numero_cuota' => 1,
            'fecha_pago' => now(),
            'monto' => 100.00,
            'estado' => 'Pagado',
        ];
    }
}