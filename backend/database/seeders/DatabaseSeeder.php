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
            CrmSeeder::class,
            EnterpriseSeeder::class,
            DeductoraSeeder::class,
            ProductSeeder::class,
            CreditSeeder::class,
            KpiSeeder::class,
            LoanConfigurationSeeder::class,
        ]);
    }
}
