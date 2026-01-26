<?php

namespace Database\Factories;

use App\Models\Lead;
use Illuminate\Database\Eloquent\Factories\Factory;

class LeadFactory extends Factory
{
    protected $model = Lead::class;

    public function definition(): array
    {
        return [
            'name' => $this->faker->firstName,
            'apellido1' => $this->faker->lastName,
            'cedula' => $this->faker->unique()->numerify('#########'),
            'email' => $this->faker->unique()->safeEmail,
            'person_type_id' => 1,
            'status' => 'New',
        ];
    }
}