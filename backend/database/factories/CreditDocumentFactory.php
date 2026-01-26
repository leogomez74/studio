<?php

namespace Database\Factories;

use App\Models\CreditDocument;
use App\Models\Credit;
use Illuminate\Database\Eloquent\Factories\Factory;

class CreditDocumentFactory extends Factory
{
    protected $model = CreditDocument::class;

    public function definition(): array
    {
        return [
            'credit_id' => Credit::factory(),
            'name' => 'Documento Test',
            'path' => 'credits/doc.pdf',
        ];
    }
}