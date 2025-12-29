<?php

namespace Database\Factories;

use App\Models\Person;
use Illuminate\Database\Eloquent\Factories\Factory;

class PersonFactory extends Factory
{
    protected $model = Person::class;

    public function definition(): array
    {
        return [
            'name' => $this->faker->firstName,
            'apellido1' => $this->faker->lastName,
            'apellido2' => $this->faker->lastName,
            'cedula' => $this->faker->unique()->numerify('#-####-####'),
            'email' => $this->faker->unique()->safeEmail,
            'phone' => $this->faker->numerify('####-####'),
            'status' => 'Activo',
            'person_type_id' => 1, // Default: Lead
            'is_active' => true,
        ];
    }

    /**
     * Persona sin cédula (para testing de validaciones)
     */
    public function withoutCedula(): static
    {
        return $this->state(fn (array $attributes) => [
            'cedula' => null,
        ]);
    }

    /**
     * Persona tipo Lead
     */
    public function lead(): static
    {
        return $this->state(fn (array $attributes) => [
            'person_type_id' => 1,
        ]);
    }

    /**
     * Persona tipo Client
     */
    public function client(): static
    {
        return $this->state(fn (array $attributes) => [
            'person_type_id' => 2,
        ]);
    }
}
