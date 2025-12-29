<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Lead;
use App\Models\Client;
use App\Models\Opportunity;
use App\Models\Credit;
use App\Models\PlanDePago;
use App\Models\CreditPayment;
use App\Models\Deductora;
use App\Models\LeadStatus;
use App\Models\Rewards\RewardUser;
use App\Models\Rewards\RewardTransaction;
use App\Models\Rewards\RewardBadge;
use App\Models\Rewards\RewardUserBadge;
use App\Models\Rewards\RewardChallenge;
use App\Models\Rewards\RewardChallengeParticipation;
use App\Models\Rewards\RewardRedemption;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Carbon\Carbon;

class KpiSeeder extends Seeder
{
    private array $users = [];
    private array $deductoras = [];
    private array $leadStatuses = [];
    private array $sources = ['Web', 'Facebook', 'Instagram', 'Referido', 'WhatsApp', 'Llamada'];
    private array $provinces = ['San José', 'Alajuela', 'Cartago', 'Heredia', 'Guanacaste', 'Puntarenas', 'Limón'];

    public function run(): void
    {
        $this->command->info('🚀 Starting KPI Seeder...');

        // Seed base data first
        $this->seedUsers();
        $this->seedDeductoras();
        $this->seedLeadStatuses();

        // Seed main data distributed over the past 12 months
        $this->seedLeadsAndClients();
        $this->seedOpportunities();
        $this->seedCreditsWithPayments();
        $this->seedGamificationData();

        $this->command->info('✅ KPI Seeder completed successfully!');
    }

    private function seedUsers(): void
    {
        $this->command->info('👥 Seeding users...');

        $usersData = [
            ['name' => 'Administrador', 'email' => 'admin@pep.cr'],
            ['name' => 'Carlos Mendez', 'email' => 'carlosm@pep.cr'],
            ['name' => 'María García', 'email' => 'maria@pep.cr'],
            ['name' => 'Juan Pérez', 'email' => 'juan@pep.cr'],
            ['name' => 'Ana Rodríguez', 'email' => 'ana@pep.cr'],
            ['name' => 'Luis Hernández', 'email' => 'luis@pep.cr'],
            ['name' => 'Carmen Solano', 'email' => 'carmen@pep.cr'],
            ['name' => 'Roberto Vargas', 'email' => 'roberto@pep.cr'],
        ];

        foreach ($usersData as $userData) {
            $user = User::firstOrCreate(
                ['email' => $userData['email']],
                [
                    'name' => $userData['name'],
                    'password' => Hash::make('password123'),
                ]
            );
            $this->users[] = $user;
        }
    }

    private function seedDeductoras(): void
    {
        $this->command->info('🏦 Seeding deductoras...');

        $deductorasData = [
            ['nombre' => 'Banco Nacional', 'comision' => 1.50],
            ['nombre' => 'Banco de Costa Rica', 'comision' => 1.75],
            ['nombre' => 'BAC Credomatic', 'comision' => 2.00],
            ['nombre' => 'Banco Popular', 'comision' => 1.25],
            ['nombre' => 'Scotiabank', 'comision' => 1.80],
            ['nombre' => 'CoopeAnde', 'comision' => 1.00],
            ['nombre' => 'CoopeAlianza', 'comision' => 0.90],
        ];

        foreach ($deductorasData as $data) {
            $deductora = Deductora::firstOrCreate(
                ['nombre' => $data['nombre']],
                [
                    'fecha_reporte_pago' => now()->addDays(rand(1, 28))->toDateString(),
                    'comision' => $data['comision'],
                ]
            );
            $this->deductoras[] = $deductora;
        }
    }

    private function seedLeadStatuses(): void
    {
        $statuses = ['Nuevo', 'Contactado', 'Interesado', 'En Proceso', 'Convertido', 'Rechazado'];
        foreach ($statuses as $index => $status) {
            $leadStatus = LeadStatus::firstOrCreate(
                ['name' => $status],
                ['slug' => Str::slug($status), 'order_column' => $index + 1]
            );
            $this->leadStatuses[$status] = $leadStatus;
        }
    }

    private function seedLeadsAndClients(): void
    {
        $this->command->info('👤 Seeding leads and clients (12 months of data)...');

        $now = Carbon::now();

        // Create leads and clients distributed over 12 months
        for ($monthsAgo = 11; $monthsAgo >= 0; $monthsAgo--) {
            $monthStart = $now->copy()->subMonths($monthsAgo)->startOfMonth();
            $monthEnd = $now->copy()->subMonths($monthsAgo)->endOfMonth();

            // Generate between 15-40 leads per month (increasing trend)
            $leadsCount = rand(15, 25) + (11 - $monthsAgo) * 2;

            for ($i = 0; $i < $leadsCount; $i++) {
                $createdAt = $this->randomDateBetween($monthStart, $monthEnd);
                $cedula = $this->generateCedula();

                // 25-35% conversion rate
                $willConvert = rand(1, 100) <= rand(25, 35);

                if ($willConvert) {
                    // Create as client
                    Client::create([
                        'name' => $this->generateName(),
                        'cedula' => $cedula,
                        'email' => 'client' . $cedula . '@example.com',
                        'phone' => $this->generatePhone(),
                        'person_type_id' => 2,
                        'status' => 'Activo',
                        'is_active' => true,
                        'source' => $this->sources[array_rand($this->sources)],
                        'province' => $this->provinces[array_rand($this->provinces)],
                        'assigned_to_id' => $this->users[array_rand($this->users)]->id,
                        'created_at' => $createdAt,
                        'updated_at' => $createdAt->copy()->addDays(rand(1, 14)),
                    ]);
                } else {
                    // Create as lead
                    $statuses = ['Nuevo', 'Contactado', 'Interesado', 'En Proceso', 'Rechazado'];
                    $statusName = $statuses[array_rand($statuses)];

                    Lead::create([
                        'name' => $this->generateName(),
                        'cedula' => $cedula,
                        'email' => 'lead' . $cedula . '@example.com',
                        'phone' => $this->generatePhone(),
                        'person_type_id' => 1,
                        'lead_status_id' => $this->leadStatuses[$statusName]->id ?? null,
                        'is_active' => $statusName !== 'Rechazado',
                        'source' => $this->sources[array_rand($this->sources)],
                        'province' => $this->provinces[array_rand($this->provinces)],
                        'assigned_to_id' => $this->users[array_rand($this->users)]->id,
                        'created_at' => $createdAt,
                        'updated_at' => $createdAt->copy()->addHours(rand(1, 72)),
                    ]);
                }
            }
        }

        $this->command->info('   Created ' . Lead::count() . ' leads and ' . Client::count() . ' clients');
    }

    private function seedOpportunities(): void
    {
        $this->command->info('💼 Seeding opportunities...');

        $now = Carbon::now();
        $types = ['Crédito Regular', 'Micro-crédito', 'Crédito Empresarial'];

        // Get all leads and clients
        $leads = Lead::all();
        $clients = Client::all();
        $persons = $leads->merge($clients);

        foreach ($persons as $person) {
            // 60% chance of having an opportunity
            if (rand(1, 100) > 60) continue;

            $createdAt = $person->created_at->copy()->addDays(rand(1, 30));
            if ($createdAt > $now) continue;

            // Determine status based on time passed
            $daysSinceCreation = $createdAt->diffInDays($now);
            $status = 'Abierta';

            if ($daysSinceCreation > 60) {
                // Older opportunities should be closed
                $status = rand(1, 100) <= 55 ? 'Ganada' : 'Perdida';
            } elseif ($daysSinceCreation > 30) {
                $statusRand = rand(1, 100);
                if ($statusRand <= 40) $status = 'Ganada';
                elseif ($statusRand <= 60) $status = 'Perdida';
                else $status = 'En seguimiento';
            } elseif ($daysSinceCreation > 14) {
                $status = rand(1, 100) <= 50 ? 'En seguimiento' : 'Abierta';
            }

            $amount = rand(5, 100) * 100000; // 500,000 to 10,000,000

            Opportunity::create([
                'lead_cedula' => $person->cedula,
                'opportunity_type' => $types[array_rand($types)],
                'amount' => $amount,
                'status' => $status,
                'assigned_to_id' => $this->users[array_rand($this->users)]->id,
                'expected_close_date' => $createdAt->copy()->addDays(rand(30, 90)),
                'created_at' => $createdAt,
                'updated_at' => $status !== 'Abierta' ? $createdAt->copy()->addDays(rand(7, 45)) : $createdAt,
            ]);
        }

        $this->command->info('   Created ' . Opportunity::count() . ' opportunities');
    }

    private function seedCreditsWithPayments(): void
    {
        $this->command->info('💰 Seeding credits and payments...');

        // Get won opportunities that don't have credits yet
        $existingOpportunityIds = Credit::whereNotNull('opportunity_id')->pluck('opportunity_id')->toArray();

        $wonOpportunities = Opportunity::where('status', 'Ganada')
            ->whereNotIn('id', $existingOpportunityIds)
            ->with('lead')
            ->get();

        $creditCount = 0;
        $paymentCount = 0;

        foreach ($wonOpportunities as $opportunity) {
            if (!$opportunity->lead) continue;

            $deductora = $this->deductoras[array_rand($this->deductoras)];
            $monto = $opportunity->amount ?? rand(5, 50) * 100000;
            $plazo = [12, 24, 36, 48, 60][array_rand([12, 24, 36, 48, 60])];
            $tasaAnual = rand(28, 36) + (rand(0, 99) / 100);
            $cuota = round($monto / $plazo * 1.15, 2); // Simple calculation with interest

            $createdAt = $opportunity->updated_at ?? $opportunity->created_at;

            // Determine credit status
            $daysSinceCreation = $createdAt->diffInDays(Carbon::now());
            $cuotasAtrasadas = 0;

            // 15% chance of having overdue payments
            if (rand(1, 100) <= 15 && $daysSinceCreation > 60) {
                $cuotasAtrasadas = rand(1, 4);
            }

            $credit = Credit::create([
                'reference' => 'CRED-' . strtoupper(Str::random(8)),
                'title' => 'Crédito ' . $opportunity->opportunity_type,
                'status' => 'Activo',
                'category' => 'Regular',
                'progress' => min(100, intval($daysSinceCreation / 3)),
                'lead_id' => $opportunity->lead->id,
                'opportunity_id' => $opportunity->id,
                'assigned_to' => $this->users[array_rand($this->users)]->name,
                'opened_at' => $createdAt->toDateString(),
                'description' => 'Crédito generado desde oportunidad',
                'monto_credito' => $monto,
                'cuota' => $cuota,
                'plazo' => $plazo,
                'tasa_anual' => $tasaAnual,
                'cuotas_atrasadas' => $cuotasAtrasadas,
                'deductora_id' => $deductora->id,
                'poliza' => rand(0, 1),
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ]);

            $creditCount++;

            // Create plan de pagos and payments
            $this->createPlanDePagosAndPayments($credit, $cuota, $plazo, $createdAt);
            $paymentCount += $credit->payments()->count();
        }

        $this->command->info("   Created {$creditCount} credits and {$paymentCount} payments");
    }

    private function createPlanDePagosAndPayments(Credit $credit, float $cuota, int $plazo, Carbon $startDate): void
    {
        $saldoAnterior = $credit->monto_credito;
        $now = Carbon::now();

        for ($i = 1; $i <= $plazo; $i++) {
            $fechaCorte = $startDate->copy()->addMonths($i);

            // Stop if future date
            if ($fechaCorte > $now) break;

            $amortizacion = round($credit->monto_credito / $plazo, 2);
            $saldoNuevo = max(0, $saldoAnterior - $amortizacion);

            // Create plan de pago entry
            $plan = PlanDePago::create([
                'credit_id' => $credit->id,
                'linea' => 1,
                'numero_cuota' => $i,
                'proceso' => 'Normal',
                'fecha_inicio' => $fechaCorte->copy()->subMonth(),
                'fecha_corte' => $fechaCorte,
                'fecha_pago' => null,
                'tasa_actual' => $credit->tasa_anual,
                'plazo_actual' => $plazo,
                'cuota' => $cuota,
                'cargos' => 0,
                'poliza' => $credit->poliza ? rand(1000, 5000) : 0,
                'interes_corriente' => round($cuota - $amortizacion, 2),
                'interes_moratorio' => 0,
                'amortizacion' => $amortizacion,
                'saldo_anterior' => $saldoAnterior,
                'saldo_nuevo' => $saldoNuevo,
                'dias' => 30,
                'estado' => 'Vigente',
                'dias_mora' => 0,
                'created_at' => $fechaCorte,
                'updated_at' => $fechaCorte,
            ]);

            // 85% chance of payment on time, 10% late, 5% no payment
            $paymentChance = rand(1, 100);

            if ($paymentChance <= 85) {
                // On time payment
                $fechaPago = $fechaCorte->copy()->subDays(rand(0, 5));
                $this->createPayment($credit, $plan, $cuota, $fechaPago, 'Pagado');
            } elseif ($paymentChance <= 95) {
                // Late payment
                $fechaPago = $fechaCorte->copy()->addDays(rand(1, 15));
                if ($fechaPago <= $now) {
                    $this->createPayment($credit, $plan, $cuota, $fechaPago, 'Pagado');
                }
            }
            // else: no payment

            $saldoAnterior = $saldoNuevo;
        }
    }

    private function createPayment(Credit $credit, PlanDePago $plan, float $cuota, Carbon $fechaPago, string $estado): void
    {
        CreditPayment::create([
            'credit_id' => $credit->id,
            'numero_cuota' => $plan->numero_cuota,
            'proceso' => 'Normal',
            'fecha_cuota' => $plan->fecha_corte,
            'fecha_pago' => $fechaPago,
            'cuota' => $cuota,
            'monto' => $cuota,
            'cargos' => 0,
            'poliza' => $plan->poliza,
            'interes_corriente' => $plan->interes_corriente,
            'interes_moratorio' => 0,
            'amortizacion' => $plan->amortizacion,
            'saldo_anterior' => $plan->saldo_anterior,
            'nuevo_saldo' => $plan->saldo_nuevo,
            'estado' => $estado,
            'fecha_movimiento' => $fechaPago,
            'movimiento_total' => $cuota,
            'source' => ['Ventanilla', 'Planilla', 'Transferencia'][array_rand(['Ventanilla', 'Planilla', 'Transferencia'])],
            'created_at' => $fechaPago,
            'updated_at' => $fechaPago,
        ]);

        // Update plan de pago
        $plan->update([
            'fecha_pago' => $fechaPago,
            'estado' => 'Pagado',
        ]);
    }

    private function seedGamificationData(): void
    {
        $this->command->info('🎮 Seeding gamification data...');

        // Create reward users for all users
        foreach ($this->users as $user) {
            RewardUser::firstOrCreate(
                ['user_id' => $user->id],
                [
                    'total_points' => rand(100, 5000),
                    'level' => rand(1, 5),
                    'current_streak' => rand(0, 30),
                    'longest_streak' => rand(10, 60),
                    'created_at' => now()->subMonths(rand(1, 12)),
                ]
            );

            // Create transactions for the past 12 months
            $this->createRewardTransactions($user);
        }

        // Create badges
        $this->createBadgesAndUserBadges();

        // Create challenges
        $this->createChallengesAndParticipation();

        // Create redemptions
        $this->createRedemptions();

        $this->command->info('   Gamification data created');
    }

    private function createRewardTransactions(User $user): void
    {
        $rewardUser = RewardUser::where('user_id', $user->id)->first();
        if (!$rewardUser) {
            return;
        }

        $now = Carbon::now();

        for ($monthsAgo = 11; $monthsAgo >= 0; $monthsAgo--) {
            $monthStart = $now->copy()->subMonths($monthsAgo)->startOfMonth();
            $monthEnd = $now->copy()->subMonths($monthsAgo)->endOfMonth();

            // 3-10 transactions per month
            $transactionCount = rand(3, 10);

            for ($i = 0; $i < $transactionCount; $i++) {
                $createdAt = $this->randomDateBetween($monthStart, $monthEnd);

                RewardTransaction::create([
                    'reward_user_id' => $rewardUser->id,
                    'amount' => rand(10, 200),
                    'type' => 'earn',
                    'description' => 'Puntos ganados por actividad',
                    'source_type' => null,
                    'source_id' => null,
                    'created_at' => $createdAt,
                    'updated_at' => $createdAt,
                ]);
            }
        }
    }

    private function createBadgesAndUserBadges(): void
    {
        $badges = [
            ['name' => 'Primer Crédito', 'description' => 'Creó su primer crédito', 'points_reward' => 100],
            ['name' => 'Top Vendedor', 'description' => '10 créditos en un mes', 'points_reward' => 500],
            ['name' => 'Streak Master', 'description' => '30 días consecutivos', 'points_reward' => 300],
            ['name' => 'Cobrador Estrella', 'description' => '95% de cobro', 'points_reward' => 400],
            ['name' => 'Líder del Mes', 'description' => 'Primer lugar en el leaderboard', 'points_reward' => 1000],
        ];

        $rewardUsers = RewardUser::all();

        foreach ($badges as $badgeData) {
            $badge = RewardBadge::firstOrCreate(
                ['slug' => Str::slug($badgeData['name'])],
                [
                    'name' => $badgeData['name'],
                    'description' => $badgeData['description'],
                    'points_reward' => $badgeData['points_reward'],
                    'icon' => 'trophy',
                    'criteria_type' => 'manual',
                    'is_active' => true,
                ]
            );

            // Assign to random users
            $usersToAssign = $rewardUsers->random(rand(2, $rewardUsers->count()));

            foreach ($usersToAssign as $rewardUser) {
                RewardUserBadge::firstOrCreate([
                    'reward_user_id' => $rewardUser->id,
                    'reward_badge_id' => $badge->id,
                ], [
                    'earned_at' => now()->subDays(rand(1, 180)),
                ]);
            }
        }
    }

    private function createChallengesAndParticipation(): void
    {
        $challenges = [
            ['name' => 'Reto Semanal', 'description' => 'Crea 5 créditos esta semana', 'type' => 'individual'],
            ['name' => 'Meta Mensual', 'description' => 'Alcanza el 100% de tu meta', 'type' => 'individual'],
            ['name' => 'Cobro Perfecto', 'description' => '100% de cobro por 7 días', 'type' => 'individual'],
        ];

        $rewardUsers = RewardUser::all();

        foreach ($challenges as $challengeData) {
            $challenge = RewardChallenge::firstOrCreate(
                ['slug' => Str::slug($challengeData['name'])],
                [
                    'name' => $challengeData['name'],
                    'description' => $challengeData['description'],
                    'type' => $challengeData['type'],
                    'objectives' => json_encode(['count' => 5]),
                    'starts_at' => now()->subDays(rand(30, 90)),
                    'ends_at' => now()->addDays(rand(7, 30)),
                    'is_active' => true,
                ]
            );

            // Create participations
            foreach ($rewardUsers as $rewardUser) {
                if (rand(1, 100) <= 60) { // 60% participation
                    $completed = rand(1, 100) <= 40;
                    RewardChallengeParticipation::firstOrCreate([
                        'reward_user_id' => $rewardUser->id,
                        'challenge_id' => $challenge->id,
                    ], [
                        'progress' => json_encode(['value' => rand(0, 100)]),
                        'completed_at' => $completed ? now()->subDays(rand(1, 10)) : null,
                        'joined_at' => now()->subDays(rand(11, 60)),
                    ]);
                }
            }
        }
    }

    private function createRedemptions(): void
    {
        $rewardUsers = RewardUser::all();

        // Create a dummy catalog item since the seeder doesn't create any
        $catalogItem = \App\Models\Rewards\RewardCatalogItem::firstOrCreate(
            ['slug' => 'tarjeta-de-regalo-5000'],
            [
                'name' => 'Tarjeta de Regalo ₡5,000',
                'description' => 'Una tarjeta de regalo para usar en cualquier comercio.',
                'category' => 'digital',
                'points_cost' => 5000,
                'stock' => -1, // Unlimited
                'is_active' => true,
            ]
        );

        foreach ($rewardUsers as $rewardUser) {
            // 30% chance of redemption
            if (rand(1, 100) <= 30) {
                RewardRedemption::create([
                    'reward_user_id' => $rewardUser->id,
                    'catalog_item_id' => $catalogItem->id,
                    'points_spent' => $catalogItem->points_cost,
                    'status' => ['pending', 'approved', 'fulfilled'][array_rand(['pending', 'approved', 'fulfilled'])],
                    'created_at' => now()->subDays(rand(1, 90)),
                ]);
            }
        }
    }

    // Helper methods
    private function generateCedula(): string
    {
        return rand(1, 9) . '-' . str_pad(rand(0, 9999), 4, '0', STR_PAD_LEFT) . '-' . str_pad(rand(0, 9999), 4, '0', STR_PAD_LEFT);
    }

    private function generateName(): string
    {
        $firstNames = ['María', 'José', 'Carlos', 'Ana', 'Luis', 'Carmen', 'Juan', 'Rosa', 'Pedro', 'Lucía', 'Miguel', 'Elena', 'Antonio', 'Patricia', 'Francisco'];
        $lastNames = ['García', 'Rodríguez', 'Martínez', 'López', 'González', 'Hernández', 'Pérez', 'Sánchez', 'Ramírez', 'Torres', 'Flores', 'Rivera', 'Gómez', 'Díaz', 'Vargas'];

        return $firstNames[array_rand($firstNames)] . ' ' . $lastNames[array_rand($lastNames)] . ' ' . $lastNames[array_rand($lastNames)];
    }

    private function generatePhone(): string
    {
        return rand(6, 8) . str_pad(rand(0, 9999999), 7, '0', STR_PAD_LEFT);
    }

    private function randomDateBetween(Carbon $start, Carbon $end): Carbon
    {
        $diffInDays = $start->diffInDays($end);
        return $start->copy()->addDays(rand(0, $diffInDays));
    }
}
