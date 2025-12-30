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
use App\Models\Rewards\RewardBadgeCategory;
use App\Models\Rewards\RewardUserBadge;
use App\Models\Rewards\RewardChallenge;
use App\Models\Rewards\RewardChallengeParticipation;
use App\Models\Rewards\RewardRedemption;
use App\Models\Rewards\RewardLeaderboard;
use App\Models\Rewards\RewardLeaderboardEntry;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Symfony\Component\Console\Helper\ProgressBar;
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
        $startTime = microtime(true);

        $this->command->info('');
        $this->command->info('<fg=cyan;options=bold>╔════════════════════════════════════════════════════════════╗</>');
        $this->command->info('<fg=cyan;options=bold>║                    KPI SEEDER                              ║</>');
        $this->command->info('<fg=cyan;options=bold>╚════════════════════════════════════════════════════════════╝</>');
        $this->command->info('');

        // Seed base data first (quick operations, no progress bar needed)
        $this->command->info('<fg=yellow>▸ Preparing base data...</>');
        $this->seedUsers();
        $this->seedDeductoras();
        $this->seedLeadStatuses();
        $this->command->info('<fg=green>  ✓ Base data ready</>');

        // Seed main data distributed over the past 12 months
        $this->seedLeadsAndClients();
        $this->seedOpportunities();
        $this->seedCreditsWithPayments();
        $this->seedGamificationData();

        $elapsedTime = round(microtime(true) - $startTime, 2);

        $this->command->info('');
        $this->command->info('<fg=green;options=bold>╔════════════════════════════════════════════════════════════╗</>');
        $this->command->info('<fg=green;options=bold>║         ✅ KPI SEEDER COMPLETED SUCCESSFULLY               ║</>');
        $this->command->info('<fg=green;options=bold>╚════════════════════════════════════════════════════════════╝</>');
        $this->command->info("<fg=white>   Total execution time: </><fg=cyan>{$elapsedTime}s</>");
        $this->command->info('');
    }

    private function seedUsers(): void
    {
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
        $this->command->info('');
        $this->command->info('👤 <fg=cyan>Seeding leads and clients (12 months of data)...</>');

        $now = Carbon::now();

        // Pre-calculate total records to create for progress bar
        $totalRecords = 0;
        for ($monthsAgo = 11; $monthsAgo >= 0; $monthsAgo--) {
            $totalRecords += rand(15, 25) + (11 - $monthsAgo) * 2;
        }

        $progressBar = $this->createProgressBar($totalRecords, 'Leads/Clients');
        $leadsData = [];
        $clientsData = [];
        $currentRecord = 0;

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
                    $clientsData[] = [
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
                    ];
                } else {
                    $statuses = ['Nuevo', 'Contactado', 'Interesado', 'En Proceso', 'Rechazado'];
                    $statusName = $statuses[array_rand($statuses)];

                    $leadsData[] = [
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
                    ];
                }

                $currentRecord++;
                $progressBar->setProgress($currentRecord);
            }
        }

        $progressBar->finish();
        $this->command->info('');
        $this->command->info('   <fg=yellow>Committing transaction...</>');

        // Batch insert within transaction for performance
        DB::transaction(function () use ($leadsData, $clientsData) {
            // Insert in chunks of 100 for optimal performance
            foreach (array_chunk($leadsData, 100) as $chunk) {
                Lead::insert($chunk);
            }
            foreach (array_chunk($clientsData, 100) as $chunk) {
                Client::insert($chunk);
            }
        });

        $this->command->info('   <fg=green>✓ Created ' . count($leadsData) . ' leads and ' . count($clientsData) . ' clients</>');
    }

    private function seedOpportunities(): void
    {
        $this->command->info('');
        $this->command->info('💼 <fg=cyan>Seeding opportunities...</>');

        $now = Carbon::now();
        $types = ['Crédito Regular', 'Micro-crédito', 'Crédito Empresarial'];

        // Get all leads and clients
        $leads = Lead::all();
        $clients = Client::all();
        $persons = $leads->merge($clients);

        $progressBar = $this->createProgressBar($persons->count(), 'Opportunities');
        $opportunitiesData = [];
        $processed = 0;

        // Get the last opportunity sequence number for this year
        $year = date('y');
        $prefix = $year . '-';
        $suffix = '-OP';
        $lastOpportunity = Opportunity::where('id', 'like', $prefix . '%' . $suffix)
            ->orderBy('id', 'desc')
            ->first();

        $sequence = 1;
        if ($lastOpportunity) {
            $parts = explode('-', $lastOpportunity->id);
            if (count($parts) === 3) {
                $sequence = intval($parts[1]) + 1;
            }
        }

        foreach ($persons as $person) {
            $processed++;
            $progressBar->setProgress($processed);

            // 60% chance of having an opportunity
            if (rand(1, 100) > 60) continue;

            $createdAt = $person->created_at->copy()->addDays(rand(1, 30));
            if ($createdAt > $now) continue;

            // Determine status based on time passed
            $daysSinceCreation = $createdAt->diffInDays($now);
            $status = 'Abierta';

            if ($daysSinceCreation > 60) {
                $status = rand(1, 100) <= 55 ? 'Ganada' : 'Perdida';
            } elseif ($daysSinceCreation > 30) {
                $statusRand = rand(1, 100);
                if ($statusRand <= 40) $status = 'Ganada';
                elseif ($statusRand <= 60) $status = 'Perdida';
                else $status = 'En seguimiento';
            } elseif ($daysSinceCreation > 14) {
                $status = rand(1, 100) <= 50 ? 'En seguimiento' : 'Abierta';
            }

            $amount = rand(5, 100) * 100000;

            // Generate opportunity ID manually (format: YY-XXXXX-OP)
            $opportunityId = $prefix . str_pad($sequence, 5, '0', STR_PAD_LEFT) . $suffix;
            $sequence++;

            $opportunitiesData[] = [
                'id' => $opportunityId,
                'lead_cedula' => $person->cedula,
                'opportunity_type' => $types[array_rand($types)],
                'amount' => $amount,
                'status' => $status,
                'assigned_to_id' => $this->users[array_rand($this->users)]->id,
                'expected_close_date' => $createdAt->copy()->addDays(rand(30, 90)),
                'created_at' => $createdAt,
                'updated_at' => $status !== 'Abierta' ? $createdAt->copy()->addDays(rand(7, 45)) : $createdAt,
            ];
        }

        $progressBar->finish();
        $this->command->info('');
        $this->command->info('   <fg=yellow>Committing transaction...</>');

        // Batch insert within transaction
        DB::transaction(function () use ($opportunitiesData) {
            foreach (array_chunk($opportunitiesData, 100) as $chunk) {
                Opportunity::insert($chunk);
            }
        });

        $this->command->info('   <fg=green>✓ Created ' . count($opportunitiesData) . ' opportunities</>');
    }

    private function seedCreditsWithPayments(): void
    {
        $this->command->info('');
        $this->command->info('💰 <fg=cyan>Seeding credits and payments...</>');

        // Get won opportunities that don't have credits yet
        $existingOpportunityIds = Credit::whereNotNull('opportunity_id')->pluck('opportunity_id')->toArray();

        $wonOpportunities = Opportunity::where('status', 'Ganada')
            ->whereNotIn('id', $existingOpportunityIds)
            ->whereNotNull('lead_cedula')
            ->get();

        if ($wonOpportunities->isEmpty()) {
            $this->command->info('   <fg=yellow>No opportunities to process</>');
            return;
        }

        $progressBar = $this->createProgressBar($wonOpportunities->count(), 'Credits');
        $creditCount = 0;
        $paymentCount = 0;
        $planCount = 0;
        $processed = 0;

        // Collect all data first, then batch insert
        $plansToInsert = [];
        $paymentsToInsert = [];
        $plansToUpdate = [];

        DB::transaction(function () use (
            $wonOpportunities,
            $progressBar,
            &$creditCount,
            &$paymentCount,
            &$planCount,
            &$processed,
            &$plansToInsert,
            &$paymentsToInsert,
            &$plansToUpdate
        ) {
            foreach ($wonOpportunities as $opportunity) {
                $processed++;
                $progressBar->setProgress($processed);

                // Find the client by cedula
                $client = Client::where('cedula', $opportunity->lead_cedula)->first();

                // If no client exists, convert the lead to client
                if (!$client) {
                    $lead = Lead::where('cedula', $opportunity->lead_cedula)->first();
                    if (!$lead) continue;

                    $lead->update(['person_type_id' => 2]);
                    $client = Client::where('cedula', $opportunity->lead_cedula)->first();
                }

                if (!$client) continue;

                $deductora = $this->deductoras[array_rand($this->deductoras)];
                $monto = $opportunity->amount ?? rand(5, 50) * 100000;
                $plazo = [12, 24, 36, 48, 60][array_rand([12, 24, 36, 48, 60])];
                $tasaAnual = rand(28, 36) + (rand(0, 99) / 100);
                $cuota = round($monto / $plazo * 1.15, 2);

                $createdAt = $opportunity->updated_at ?? $opportunity->created_at;
                $daysSinceCreation = $createdAt->diffInDays(Carbon::now());
                $cuotasAtrasadas = 0;

                if (rand(1, 100) <= 15 && $daysSinceCreation > 60) {
                    $cuotasAtrasadas = rand(1, 4);
                }

                $poliza = rand(0, 1);

                // Create credit (needs ID for related records)
                $credit = Credit::create([
                    'reference' => 'CRED-' . strtoupper(Str::random(8)),
                    'title' => 'Crédito ' . $opportunity->opportunity_type,
                    'status' => 'Activo',
                    'category' => 'Regular',
                    'progress' => min(100, intval($daysSinceCreation / 3)),
                    'lead_id' => $client->id,
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
                    'poliza' => $poliza,
                    'created_at' => $createdAt,
                    'updated_at' => $createdAt,
                ]);

                $creditCount++;

                // Generate plans and payments data
                $result = $this->generatePlanDePagosAndPaymentsData(
                    $credit->id,
                    $monto,
                    $cuota,
                    $plazo,
                    $tasaAnual,
                    $poliza,
                    $createdAt
                );

                $plansToInsert = array_merge($plansToInsert, $result['plans']);
                $paymentsToInsert = array_merge($paymentsToInsert, $result['payments']);
                $plansToUpdate = array_merge($plansToUpdate, $result['plansToUpdate']);
                $planCount += count($result['plans']);
                $paymentCount += count($result['payments']);

                // Batch insert every 50 credits to prevent memory issues
                if ($creditCount % 50 === 0) {
                    $this->flushBatchInserts($plansToInsert, $paymentsToInsert, $plansToUpdate);
                    $plansToInsert = [];
                    $paymentsToInsert = [];
                    $plansToUpdate = [];
                }
            }

            // Final flush for remaining records
            $this->flushBatchInserts($plansToInsert, $paymentsToInsert, $plansToUpdate);
        });

        $progressBar->finish();
        $this->command->info('');
        $this->command->info('   <fg=yellow>Transaction committed</>');
        $this->command->info("   <fg=green>✓ Created {$creditCount} credits, {$planCount} payment plans and {$paymentCount} payments</>");
    }

    private function generatePlanDePagosAndPaymentsData(
        int $creditId,
        float $monto,
        float $cuota,
        int $plazo,
        float $tasaAnual,
        int $poliza,
        Carbon $startDate
    ): array {
        $plans = [];
        $payments = [];
        $plansToUpdate = [];
        $saldoAnterior = $monto;
        $now = Carbon::now();

        for ($i = 1; $i <= $plazo; $i++) {
            $fechaCorte = $startDate->copy()->addMonths($i);

            if ($fechaCorte > $now) break;

            $amortizacion = round($monto / $plazo, 2);
            $saldoNuevo = max(0, $saldoAnterior - $amortizacion);
            $polizaAmount = $poliza ? rand(1000, 5000) : 0;
            $interesCorriente = round($cuota - $amortizacion, 2);

            $planData = [
                'credit_id' => $creditId,
                'linea' => 1,
                'numero_cuota' => $i,
                'proceso' => 'Normal',
                'fecha_inicio' => $fechaCorte->copy()->subMonth(),
                'fecha_corte' => $fechaCorte,
                'fecha_pago' => null,
                'tasa_actual' => $tasaAnual,
                'plazo_actual' => $plazo,
                'cuota' => $cuota,
                'cargos' => 0,
                'poliza' => $polizaAmount,
                'interes_corriente' => $interesCorriente,
                'interes_moratorio' => 0,
                'amortizacion' => $amortizacion,
                'saldo_anterior' => $saldoAnterior,
                'saldo_nuevo' => $saldoNuevo,
                'dias' => 30,
                'estado' => 'Vigente',
                'dias_mora' => 0,
                'created_at' => $fechaCorte,
                'updated_at' => $fechaCorte,
            ];

            $paymentChance = rand(1, 100);
            $fechaPago = null;

            if ($paymentChance <= 85) {
                $fechaPago = $fechaCorte->copy()->subDays(rand(0, 5));
            } elseif ($paymentChance <= 95) {
                $fechaPago = $fechaCorte->copy()->addDays(rand(1, 15));
                if ($fechaPago > $now) {
                    $fechaPago = null;
                }
            }

            if ($fechaPago) {
                $planData['fecha_pago'] = $fechaPago;
                $planData['estado'] = 'Pagado';

                $payments[] = [
                    'credit_id' => $creditId,
                    'numero_cuota' => $i,
                    'proceso' => 'Normal',
                    'fecha_cuota' => $fechaCorte,
                    'fecha_pago' => $fechaPago,
                    'cuota' => $cuota,
                    'monto' => $cuota,
                    'cargos' => 0,
                    'poliza' => $polizaAmount,
                    'interes_corriente' => $interesCorriente,
                    'interes_moratorio' => 0,
                    'amortizacion' => $amortizacion,
                    'saldo_anterior' => $saldoAnterior,
                    'nuevo_saldo' => $saldoNuevo,
                    'estado' => 'Pagado',
                    'fecha_movimiento' => $fechaPago,
                    'movimiento_total' => $cuota,
                    'source' => ['Ventanilla', 'Planilla', 'Transferencia'][array_rand(['Ventanilla', 'Planilla', 'Transferencia'])],
                    'created_at' => $fechaPago,
                    'updated_at' => $fechaPago,
                ];
            }

            $plans[] = $planData;
            $saldoAnterior = $saldoNuevo;
        }

        return [
            'plans' => $plans,
            'payments' => $payments,
            'plansToUpdate' => $plansToUpdate,
        ];
    }

    private function flushBatchInserts(array $plans, array $payments, array $plansToUpdate): void
    {
        if (!empty($plans)) {
            foreach (array_chunk($plans, 100) as $chunk) {
                PlanDePago::insert($chunk);
            }
        }

        if (!empty($payments)) {
            foreach (array_chunk($payments, 100) as $chunk) {
                CreditPayment::insert($chunk);
            }
        }
    }

    private function seedGamificationData(): void
    {
        $this->command->info('');
        $this->command->info('🎮 <fg=cyan>Seeding gamification data...</>');

        // Calculate total steps for progress bar (users + sub-tasks)
        $totalSteps = count($this->users) + 5; // 5 additional sub-tasks
        $progressBar = $this->createProgressBar($totalSteps, 'Gamification');
        $currentStep = 0;

        DB::transaction(function () use ($progressBar, &$currentStep) {
            // Create reward users for all users with batch transactions
            $transactionsData = [];

            foreach ($this->users as $user) {
                $rewardUser = RewardUser::firstOrCreate(
                    ['user_id' => $user->id],
                    [
                        'total_points' => rand(100, 5000),
                        'level' => rand(1, 5),
                        'current_streak' => rand(0, 30),
                        'longest_streak' => rand(10, 60),
                        'created_at' => now()->subMonths(rand(1, 12)),
                    ]
                );

                // Collect transactions for batch insert
                $transactionsData = array_merge(
                    $transactionsData,
                    $this->generateRewardTransactionsData($rewardUser->id)
                );

                $currentStep++;
                $progressBar->setProgress($currentStep);
            }

            // Batch insert all transactions
            if (!empty($transactionsData)) {
                foreach (array_chunk($transactionsData, 100) as $chunk) {
                    RewardTransaction::insert($chunk);
                }
            }

            // Create badge categories first
            $this->createBadgeCategories();
            $currentStep++;
            $progressBar->setProgress($currentStep);

            // Create badges
            $this->createBadgesAndUserBadges();
            $currentStep++;
            $progressBar->setProgress($currentStep);

            // Create challenges
            $this->createChallengesAndParticipation();
            $currentStep++;
            $progressBar->setProgress($currentStep);

            // Create redemptions
            $this->createRedemptions();
            $currentStep++;
            $progressBar->setProgress($currentStep);

            // Create leaderboards and entries
            $this->createLeaderboards();
            $currentStep++;
            $progressBar->setProgress($currentStep);
        });

        $progressBar->finish();
        $this->command->info('');
        $this->command->info('   <fg=yellow>Transaction committed</>');
        $this->command->info('   <fg=green>✓ Gamification data created</>');
    }

    private function generateRewardTransactionsData(int $rewardUserId): array
    {
        $transactions = [];
        $now = Carbon::now();

        for ($monthsAgo = 11; $monthsAgo >= 0; $monthsAgo--) {
            $monthStart = $now->copy()->subMonths($monthsAgo)->startOfMonth();
            $monthEnd = $now->copy()->subMonths($monthsAgo)->endOfMonth();

            // 3-10 transactions per month
            $transactionCount = rand(3, 10);

            for ($i = 0; $i < $transactionCount; $i++) {
                $createdAt = $this->randomDateBetween($monthStart, $monthEnd);

                $transactions[] = [
                    'reward_user_id' => $rewardUserId,
                    'amount' => rand(10, 200),
                    'type' => 'earn',
                    'description' => 'Puntos ganados por actividad',
                    'created_at' => $createdAt,
                    'updated_at' => $createdAt,
                ];
            }
        }

        return $transactions;
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
                    'difficulty' => ['easy', 'medium', 'hard'][array_rand(['easy', 'medium', 'hard'])],
                    'objectives' => json_encode(['count' => 5]),
                    'points_reward' => rand(100, 500),
                    'xp_reward' => rand(50, 200),
                    'starts_at' => now()->subDays(rand(30, 90)),
                    'ends_at' => now()->addDays(rand(7, 30)),
                    'is_active' => true,
                ]
            );

            // Create participations
            foreach ($rewardUsers as $rewardUser) {
                if (rand(1, 100) <= 60) { // 60% participation
                    $completed = rand(1, 100) <= 40;
                    $status = $completed ? 'completed' : (['active', 'abandoned'][array_rand(['active', 'abandoned'])]);
                    RewardChallengeParticipation::firstOrCreate([
                        'reward_user_id' => $rewardUser->id,
                        'challenge_id' => $challenge->id,
                    ], [
                        'progress' => json_encode(['value' => rand(0, 100)]),
                        'status' => $status,
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
                    'status' => ['pending', 'approved', 'delivered'][array_rand(['pending', 'approved', 'delivered'])],
                    'created_at' => now()->subDays(rand(1, 90)),
                ]);
            }
        }
    }

    private function createBadgeCategories(): void
    {
        $categories = [
            ['name' => 'Rendimiento', 'slug' => 'rendimiento', 'description' => 'Badges por logros de rendimiento', 'icon' => 'trophy'],
            ['name' => 'Consistencia', 'slug' => 'consistencia', 'description' => 'Badges por mantener rachas', 'icon' => 'flame'],
            ['name' => 'Colaboración', 'slug' => 'colaboracion', 'description' => 'Badges por trabajo en equipo', 'icon' => 'users'],
            ['name' => 'Especiales', 'slug' => 'especiales', 'description' => 'Badges por eventos especiales', 'icon' => 'star'],
        ];

        foreach ($categories as $index => $categoryData) {
            // Use DB::table to avoid model's default $attributes (is_active doesn't exist in table)
            $exists = DB::table('reward_badge_categories')->where('slug', $categoryData['slug'])->exists();
            if (!$exists) {
                DB::table('reward_badge_categories')->insert([
                    'slug' => $categoryData['slug'],
                    'name' => $categoryData['name'],
                    'description' => $categoryData['description'],
                    'icon' => $categoryData['icon'],
                    'sort_order' => $index + 1,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    private function createLeaderboards(): void
    {
        $rewardUsers = RewardUser::all();

        // Create leaderboard configurations
        $leaderboards = [
            [
                'name' => 'Top Puntos Semanal',
                'slug' => 'puntos-semanal',
                'metric' => 'points',
                'period' => 'weekly',
            ],
            [
                'name' => 'Top Puntos Mensual',
                'slug' => 'puntos-mensual',
                'metric' => 'points',
                'period' => 'monthly',
            ],
            [
                'name' => 'Top Nivel',
                'slug' => 'nivel-general',
                'metric' => 'level',
                'period' => 'all_time',
            ],
            [
                'name' => 'Top Rachas',
                'slug' => 'rachas-activas',
                'metric' => 'streak',
                'period' => 'all_time',
            ],
        ];

        foreach ($leaderboards as $leaderboardData) {
            // Determine period dates based on leaderboard period type
            $periodStart = match ($leaderboardData['period']) {
                'weekly' => now()->startOfWeek()->toDateString(),
                'monthly' => now()->startOfMonth()->toDateString(),
                default => now()->startOfYear()->toDateString(),
            };
            $periodEnd = match ($leaderboardData['period']) {
                'weekly' => now()->endOfWeek()->toDateString(),
                'monthly' => now()->endOfMonth()->toDateString(),
                default => now()->endOfYear()->toDateString(),
            };

            $leaderboard = RewardLeaderboard::firstOrCreate(
                ['slug' => $leaderboardData['slug']],
                [
                    'name' => $leaderboardData['name'],
                    'metric' => $leaderboardData['metric'],
                    'period' => $leaderboardData['period'],
                    'is_active' => true,
                ]
            );

            // Create entries for each user based on metric
            $sortedUsers = $rewardUsers->sortByDesc(function ($user) use ($leaderboardData) {
                return match ($leaderboardData['metric']) {
                    'points' => $user->total_points,
                    'level' => $user->level,
                    'streak' => $user->current_streak,
                    default => $user->total_points,
                };
            })->values();

            foreach ($sortedUsers as $rank => $rewardUser) {
                $value = match ($leaderboardData['metric']) {
                    'points' => $rewardUser->total_points,
                    'level' => $rewardUser->level,
                    'streak' => $rewardUser->current_streak,
                    default => $rewardUser->total_points,
                };

                RewardLeaderboardEntry::firstOrCreate(
                    [
                        'leaderboard_id' => $leaderboard->id,
                        'reward_user_id' => $rewardUser->id,
                        'period_start' => $periodStart,
                    ],
                    [
                        'rank' => $rank + 1,
                        'value' => $value,
                        'previous_rank' => rand(1, 100) <= 70 ? max(1, $rank + rand(-2, 3)) : null,
                        'period_end' => $periodEnd,
                    ]
                );
            }
        }
    }

    // Helper methods

    /**
     * Create a progress bar with consistent formatting
     */
    private function createProgressBar(int $max, string $label): ProgressBar
    {
        $progressBar = $this->command->getOutput()->createProgressBar($max);

        // Set custom format with label, progress, percentage, and ETA
        $progressBar->setFormat(
            "   <fg=white>{$label}:</> [%bar%] <fg=green>%current%/%max%</> (<fg=yellow>%percent:3s%%</>) <fg=cyan>~%remaining:6s%</>"
        );

        $progressBar->setBarCharacter('<fg=green>█</>');
        $progressBar->setEmptyBarCharacter('<fg=gray>░</>');
        $progressBar->setProgressCharacter('<fg=green>█</>');
        $progressBar->setBarWidth(30);

        $progressBar->start();

        return $progressBar;
    }

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
