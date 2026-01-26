<?php

namespace Database\Seeders;

use App\Models\Credit;
use App\Models\Opportunity;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class CreditSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $opportunities = Opportunity::with('lead')->take(3)->get();

        foreach ($opportunities as $opportunity) {
            if (!$opportunity->lead) {
                continue;
            }

            // Check if credit already exists for this opportunity
            if (Credit::where('opportunity_id', $opportunity->id)->exists()) {
                continue;
            }

            Credit::create([
                'opportunity_id' => $opportunity->id,
                'lead_id' => $opportunity->lead->id, // Use the lead from the opportunity
                'reference' => 'CRED-' . Str::upper(Str::random(8)),
                'title' => 'Crédito para ' . $opportunity->opportunity_type,
                'status' => 'En Progreso',
                'category' => 'Regular',
                'assigned_to' => 'Asesor Financiero',
                'progress' => rand(10, 90),
                'opened_at' => now()->subDays(rand(1, 30))->toDateString(),
                'description' => 'Crédito generado automáticamente para la oportunidad ' . $opportunity->id,
                'monto_credito' => rand(100000, 5000000),
                'plazo' => rand(12, 60),
                'tasa_anual' => 33.50,
            ]);
        }
    }
}
