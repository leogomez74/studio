<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    // use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            LoanConfigurationSeeder::class,  // Creates Tasas first (required by Credit model)
            CrmSeeder::class,
            EnterpriseSeeder::class,
            DeductoraSeeder::class,
            ProductSeeder::class,
            KpiSeeder::class,
        ]);
    }
}
