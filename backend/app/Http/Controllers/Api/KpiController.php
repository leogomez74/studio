<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Lead;
use App\Models\Client;
use App\Models\Person;
use App\Models\Opportunity;
use App\Models\Analisis;
use App\Models\Credit;
use App\Models\CreditPayment;
use App\Models\SaldoPendiente;
use App\Models\PlanDePago;
use App\Models\Deductora;
use App\Models\User;
use App\Models\Task;
use App\Models\Comision;
use App\Models\MetaVenta;
use App\Models\Visita;
use App\Models\Rewards\RewardUser;
use App\Models\Rewards\RewardTransaction;
use App\Models\Rewards\RewardUserBadge;
use App\Models\Rewards\RewardChallengeParticipation;
use App\Models\Rewards\RewardRedemption;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class KpiController extends Controller
{
    /**
     * Get all KPIs in a single response
     */
    public function all(Request $request)
    {
        try {
            $period = $request->input('period', 'month');
            $dateRange = $this->getDateRange($period);

            return response()->json([
                'leads' => $this->getLeadKpis($dateRange),
                'opportunities' => $this->getOpportunityKpis($dateRange),
                'credits' => $this->getCreditKpis($dateRange),
                'collections' => $this->getCollectionKpis($dateRange),
                'agents' => $this->getAgentKpis($dateRange),
                'gamification' => $this->getGamificationKpis($dateRange),
                'business' => $this->getBusinessHealthKpis($dateRange),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'leads' => $this->getDefaultLeadKpis(),
                'opportunities' => [
                    'winRate' => ['value' => 0, 'change' => 0, 'target' => 40, 'unit' => '%'],
                    'pipelineValue' => ['value' => 0, 'change' => 0, 'unit' => '₡'],
                    'avgSalesCycle' => ['value' => 0, 'change' => 0, 'unit' => 'días'],
                    'velocity' => ['value' => 0, 'change' => 0],
                ],
                'credits' => [
                    'disbursementVolume' => ['value' => 0, 'change' => 0, 'unit' => '₡'],
                    'avgLoanSize' => ['value' => 0, 'change' => 0, 'unit' => '₡'],
                    'portfolioAtRisk' => ['value' => 0, 'change' => 0, 'target' => 5, 'unit' => '%'],
                    'nonPerformingLoans' => ['value' => 0, 'change' => 0],
                    'approvalRate' => ['value' => 0, 'change' => 0, 'target' => 75, 'unit' => '%'],
                    'timeToDisbursement' => ['value' => 0, 'change' => 0, 'unit' => 'días'],
                        'fullCycleTime' => ['value' => 0, 'change' => 0, 'unit' => 'días'],
                    'earlyCancellationRate' => ['value' => 0, 'change' => 0, 'unit' => '%', 'count' => 0],
                    'extraordinaryPayments' => ['value' => 0, 'change' => 0, 'unit' => '₡', 'count' => 0],
                    'totalCredits' => 0,
                    'totalPortfolio' => 0,
                ],
                'collections' => [
                    'collectionRate' => ['value' => 0, 'change' => 0, 'target' => 98, 'unit' => '%'],
                    'delinquencyRate' => ['value' => 0, 'change' => 0, 'target' => 5, 'unit' => '%'],
                    'recoveryRate' => ['value' => 0, 'change' => 0, 'unit' => '%'],
                    'paymentTimeliness' => ['value' => 0, 'change' => 0, 'target' => 95, 'unit' => '%'],
                    'reversalRate' => ['value' => 0, 'change' => 0, 'unit' => '%', 'count' => 0],
                    'pendingBalances' => ['value' => 0, 'change' => 0, 'unit' => '₡', 'count' => 0],
                    'paymentSourceDistribution' => [],
                ],
                'agents' => ['topAgents' => []],
                'gamification' => [
                    'engagementRate' => ['value' => 0, 'change' => 0, 'target' => 85, 'unit' => '%'],
                    'pointsVelocity' => ['value' => 0, 'change' => 0, 'unit' => 'pts/día'],
                    'badgeCompletion' => ['value' => 0, 'change' => 0, 'unit' => '%'],
                    'challengeParticipation' => ['value' => 0, 'change' => 0],
                    'redemptionRate' => ['value' => 0, 'change' => 0, 'unit' => '%'],
                    'streakRetention' => ['value' => 0, 'change' => 0, 'unit' => '%'],
                    'leaderboardMovement' => ['value' => 0, 'change' => 0, 'unit' => 'pos'],
                    'levelDistribution' => [['level' => 1, 'count' => 1]],
                ],
                'business' => [
                    'clv' => ['value' => 0, 'change' => 0, 'unit' => '₡'],
                    'cac' => ['value' => 0, 'change' => 0, 'unit' => '₡'],
                    'portfolioGrowth' => ['value' => 0, 'change' => 0, 'target' => 20, 'unit' => '%'],
                    'nps' => ['value' => 0, 'change' => 0, 'unit' => ''],
                    'revenuePerEmployee' => ['value' => 0, 'change' => 0, 'unit' => '₡'],
                ],
                'error' => $e->getMessage(),
            ], 200); // Return 200 with error message to prevent frontend crash
        }
    }

    /**
     * Lead Management KPIs
     */
    public function leads(Request $request)
    {
        $period = $request->input('period', 'month');
        $dateRange = $this->getDateRange($period);

        return response()->json($this->getLeadKpis($dateRange));
    }

    /**
     * Opportunity KPIs
     */
    public function opportunities(Request $request)
    {
        $period = $request->input('period', 'month');
        $dateRange = $this->getDateRange($period);

        return response()->json($this->getOpportunityKpis($dateRange));
    }

    /**
     * Credit/Loan KPIs
     */
    public function credits(Request $request)
    {
        $period = $request->input('period', 'month');
        $dateRange = $this->getDateRange($period);

        return response()->json($this->getCreditKpis($dateRange));
    }

    /**
     * Collection KPIs
     */
    public function collections(Request $request)
    {
        $period = $request->input('period', 'month');
        $dateRange = $this->getDateRange($period);

        return response()->json($this->getCollectionKpis($dateRange));
    }

    /**
     * Agent Performance KPIs
     */
    public function agents(Request $request)
    {
        $period = $request->input('period', 'month');
        $dateRange = $this->getDateRange($period);

        return response()->json($this->getAgentKpis($dateRange));
    }

    /**
     * Gamification KPIs
     */
    public function gamification(Request $request)
    {
        $period = $request->input('period', 'month');
        $dateRange = $this->getDateRange($period);

        return response()->json($this->getGamificationKpis($dateRange));
    }

    /**
     * Business Health KPIs
     */
    public function business(Request $request)
    {
        $period = $request->input('period', 'month');
        $dateRange = $this->getDateRange($period);

        return response()->json($this->getBusinessHealthKpis($dateRange));
    }

    /**
     * Historical Trend Data
     */
    public function trends(Request $request)
    {
        $period = $request->input('period', 'month');

        // Determine granularity and data points based on period
        switch ($period) {
            case 'week':
                // Show daily data for the last 7 days
                return response()->json($this->getDailyTrendData(7));
            case 'month':
                // Show weekly data for the last 4 weeks
                return response()->json($this->getWeeklyTrendData(4));
            case 'quarter':
                // Show monthly data for the last 3 months
                return response()->json($this->getTrendData(3));
            case 'year':
                // Show monthly data for the last 12 months
                return response()->json($this->getTrendData(12));
            default:
                return response()->json($this->getTrendData(6));
        }
    }

    // ============ PRIVATE METHODS ============

    private function getDateRange(string $period): array
    {
        $now = Carbon::now();

        switch ($period) {
            case 'week':
                return [
                    'start' => $now->copy()->subWeek(),
                    'end' => $now,
                    'prev_start' => $now->copy()->subWeeks(2),
                    'prev_end' => $now->copy()->subWeek(),
                ];
            case 'quarter':
                return [
                    'start' => $now->copy()->subQuarter(),
                    'end' => $now,
                    'prev_start' => $now->copy()->subQuarters(2),
                    'prev_end' => $now->copy()->subQuarter(),
                ];
            case 'year':
                return [
                    'start' => $now->copy()->subYear(),
                    'end' => $now,
                    'prev_start' => $now->copy()->subYears(2),
                    'prev_end' => $now->copy()->subYear(),
                ];
            case 'month':
            default:
                return [
                    'start' => $now->copy()->subMonth(),
                    'end' => $now,
                    'prev_start' => $now->copy()->subMonths(2),
                    'prev_end' => $now->copy()->subMonth(),
                ];
        }
    }

    private function calculateChange(float $current, float $previous): float
    {
        if ($previous == 0) {
            return $current > 0 ? 100 : 0;
        }
        return round((($current - $previous) / $previous) * 100, 1);
    }

    private function getLeadKpis(array $dateRange): array
    {
        try {
            // Total leads in period
            $totalLeads = Lead::whereBetween('created_at', [$dateRange['start'], $dateRange['end']])->count();
            $prevTotalLeads = Lead::whereBetween('created_at', [$dateRange['prev_start'], $dateRange['prev_end']])->count();

            // Clients converted in period
            $totalClients = Client::whereBetween('created_at', [$dateRange['start'], $dateRange['end']])->count();
            $prevTotalClients = Client::whereBetween('created_at', [$dateRange['prev_start'], $dateRange['prev_end']])->count();

            // Conversion rate for the period (leads that became clients)
            $conversionRate = $totalLeads > 0 ? round(($totalClients / $totalLeads) * 100, 1) : 0;
            $prevConversionRate = $prevTotalLeads > 0 ? round(($prevTotalClients / $prevTotalLeads) * 100, 1) : 0;

            // Lead aging (leads created in period that are still pending > 7 days)
            $leadAging = Lead::where('is_active', true)
                ->whereBetween('created_at', [$dateRange['start'], $dateRange['end']])
                ->where('created_at', '<', Carbon::now()->subDays(7))
                ->count();
            $prevLeadAging = Lead::where('is_active', true)
                ->whereBetween('created_at', [$dateRange['prev_start'], $dateRange['prev_end']])
                ->where('created_at', '<', $dateRange['prev_end']->copy()->subDays(7))
                ->count();

            // Lead source performance - historical across all persons (leads + converted clients)
            $leadSourcePerformance = collect([]);
            try {
                $sourceColumn = \Schema::hasColumn('persons', 'source') ? 'source' : null;

                if ($sourceColumn) {
                    // Query persons table directly to include both leads and clients
                    // Total global de personas con fuente asignada
                    $totalPersonsWithSource = DB::table('persons')
                        ->whereNotNull($sourceColumn)
                        ->where($sourceColumn, '!=', '')
                        ->count();

                    $leadSourcePerformance = DB::table('persons')
                        ->select($sourceColumn, DB::raw('COUNT(*) as total_count'))
                        ->whereNotNull($sourceColumn)
                        ->where($sourceColumn, '!=', '')
                        ->groupBy($sourceColumn)
                        ->get()
                        ->map(function ($item) use ($sourceColumn, $totalPersonsWithSource) {
                            $source = $item->$sourceColumn;
                            $totalFromSource = $item->total_count;

                            // Porcentaje de participación global de esta fuente
                            $percentage = $totalPersonsWithSource > 0
                                ? round(($totalFromSource / $totalPersonsWithSource) * 100, 0)
                                : 0;

                            // Tasa de conversión: clientes / total de esta fuente
                            $clientsFromSource = DB::table('persons')
                                ->where($sourceColumn, $source)
                                ->where('person_type_id', 2)
                                ->count();
                            $conversionRate = $totalFromSource > 0
                                ? round(($clientsFromSource / $totalFromSource) * 100, 0)
                                : 0;

                            return [
                                'source' => $source ?: 'Desconocido',
                                'count' => $totalFromSource,
                                'conversion' => $percentage,
                                'conversionRate' => $conversionRate,
                            ];
                        });
                }
            } catch (\Exception $e) {
                // Fallback to empty
            }

            // Calculate response time from first activity/update if available
            $responseTime = 0;
            $prevResponseTime = 0;
            try {
                // Try to calculate from updated_at - created_at as a proxy for first response
                $avgResponse = Lead::whereBetween('created_at', [$dateRange['start'], $dateRange['end']])
                    ->whereColumn('updated_at', '>', 'created_at')
                    ->selectRaw('AVG(TIMESTAMPDIFF(HOUR, created_at, updated_at)) as avg_hours')
                    ->value('avg_hours');
                $responseTime = $avgResponse ? round($avgResponse, 1) : 0;

                $prevAvgResponse = Lead::whereBetween('created_at', [$dateRange['prev_start'], $dateRange['prev_end']])
                    ->whereColumn('updated_at', '>', 'created_at')
                    ->selectRaw('AVG(TIMESTAMPDIFF(HOUR, created_at, updated_at)) as avg_hours')
                    ->value('avg_hours');
                $prevResponseTime = $prevAvgResponse ? round($prevAvgResponse, 1) : 0;
            } catch (\Exception $e) {
                // Fallback to 0
            }

            return [
                'conversionRate' => [
                    'value' => $conversionRate,
                    'change' => $this->calculateChange($conversionRate, $prevConversionRate),
                    'target' => 30,
                    'unit' => '%',
                ],
                'responseTime' => [
                    'value' => $responseTime,
                    'change' => $prevResponseTime > 0 ? $this->calculateChange($responseTime, $prevResponseTime) : 0,
                    'unit' => 'hrs',
                ],
                'leadAging' => [
                    'value' => $leadAging,
                    'change' => $this->calculateChange((float)$leadAging, (float)$prevLeadAging),
                    'unit' => 'leads',
                ],
                'leadSourcePerformance' => $leadSourcePerformance,
                'totalLeads' => $totalLeads,
                'totalClients' => $totalClients,
                // Conversión segmentada por vendedor (leads asignados → créditos formalizados)
                'conversionPorVendedor' => $this->getConversionPorVendedor($dateRange),
            ];
        } catch (\Exception $e) {
            return $this->getDefaultLeadKpis();
        }
    }

    private function getConversionPorVendedor(array $dateRange): array
    {
        try {
            $vendedorRoles = ['Vendedor', 'Vendedor Interno', 'Vendedor Externo'];

            return User::select('users.id', 'users.name')
                ->join('roles', 'users.role_id', '=', 'roles.id')
                ->whereIn('roles.name', $vendedorRoles)
                ->where('users.status', 'Activo')
                ->get()
                ->map(function ($user) use ($dateRange) {
                    $leadsAsignados = Lead::where('assigned_to_id', $user->id)
                        ->whereBetween('created_at', [$dateRange['start'], $dateRange['end']])
                        ->count();

                    $creditosFormalizados = Credit::where('assigned_to', $user->id)
                        ->whereNotNull('formalized_at')
                        ->whereBetween('formalized_at', [$dateRange['start'], $dateRange['end']])
                        ->count();

                    return [
                        'user_id'              => $user->id,
                        'name'                 => $user->name,
                        'leadsAsignados'       => $leadsAsignados,
                        'creditosFormalizados' => $creditosFormalizados,
                        'tasaCierre'           => $leadsAsignados > 0
                            ? round(($creditosFormalizados / $leadsAsignados) * 100, 1)
                            : null,
                    ];
                })
                ->filter(fn($v) => $v['leadsAsignados'] > 0 || $v['creditosFormalizados'] > 0)
                ->sortByDesc('tasaCierre')
                ->values()
                ->toArray();
        } catch (\Exception $e) {
            return [];
        }
    }

    private function getDefaultLeadKpis(): array
    {
        return [
            'conversionRate' => ['value' => 0, 'change' => 0, 'target' => 30, 'unit' => '%'],
            'responseTime' => ['value' => 0, 'change' => 0, 'unit' => 'hrs'],
            'leadAging' => ['value' => 0, 'change' => 0, 'unit' => 'leads'],
            'leadSourcePerformance' => [],
            'totalLeads' => 0,
            'totalClients' => 0,
        ];
    }

    private function getOpportunityKpis(array $dateRange): array
    {
        // Actual statuses from the system: "Abierta", "En seguimiento", "Analizada", "Perdida"
        $wonStatuses = ['Analizada'];
        $lostStatuses = ['Perdida'];
        $openStatuses = ['Abierta', 'En seguimiento'];
        $closedStatuses = array_merge($wonStatuses, $lostStatuses);

        try {
            // Win rate - opportunities closed in the period
            $closedOpportunities = Opportunity::whereBetween('updated_at', [$dateRange['start'], $dateRange['end']])
                ->whereIn('status', $wonStatuses)
                ->count();
            $totalClosedOpportunities = Opportunity::whereBetween('updated_at', [$dateRange['start'], $dateRange['end']])
                ->whereIn('status', $closedStatuses)
                ->count();

            $winRate = $totalClosedOpportunities > 0
                ? round(($closedOpportunities / $totalClosedOpportunities) * 100, 1)
                : 0;

            // Previous period
            $prevClosedOpportunities = Opportunity::whereBetween('updated_at', [$dateRange['prev_start'], $dateRange['prev_end']])
                ->whereIn('status', $wonStatuses)
                ->count();
            $prevTotalClosedOpportunities = Opportunity::whereBetween('updated_at', [$dateRange['prev_start'], $dateRange['prev_end']])
                ->whereIn('status', $closedStatuses)
                ->count();
            $prevWinRate = $prevTotalClosedOpportunities > 0
                ? round(($prevClosedOpportunities / $prevTotalClosedOpportunities) * 100, 1)
                : 0;

            // Pipeline value (open opportunities created in period)
            $pipelineValue = Opportunity::whereBetween('created_at', [$dateRange['start'], $dateRange['end']])
                ->whereIn('status', $openStatuses)
                ->sum('amount') ?? 0;
            $prevPipelineValue = Opportunity::whereBetween('created_at', [$dateRange['prev_start'], $dateRange['prev_end']])
                ->whereIn('status', $openStatuses)
                ->sum('amount') ?? 0;

            // Average sales cycle - calculate from won opportunities
            $avgSalesCycle = 0;
            $prevAvgSalesCycle = 0;
            try {
                // Calculate average days between created_at and updated_at for won opportunities
                $avgCycle = Opportunity::whereBetween('updated_at', [$dateRange['start'], $dateRange['end']])
                    ->whereIn('status', $wonStatuses)
                    ->selectRaw('AVG(DATEDIFF(updated_at, created_at)) as avg_days')
                    ->value('avg_days');
                $avgSalesCycle = $avgCycle ? round($avgCycle, 0) : 0;

                $prevAvgCycle = Opportunity::whereBetween('updated_at', [$dateRange['prev_start'], $dateRange['prev_end']])
                    ->whereIn('status', $wonStatuses)
                    ->selectRaw('AVG(DATEDIFF(updated_at, created_at)) as avg_days')
                    ->value('avg_days');
                $prevAvgSalesCycle = $prevAvgCycle ? round($prevAvgCycle, 0) : 0;
            } catch (\Exception $e) {
                // Fallback to 0
            }

            // Opportunity velocity - new opportunities created in period
            $opportunityVelocity = Opportunity::whereBetween('created_at', [$dateRange['start'], $dateRange['end']])->count();
            $prevOpportunityVelocity = Opportunity::whereBetween('created_at', [$dateRange['prev_start'], $dateRange['prev_end']])->count();

            // Credit type comparison (Micro vs Regular vs Empresarial)
            // Pendientes: crédito no formalizado (Aprobado, Por firmar)
            // Seguimiento: crédito formalizado y activo (Formalizado, Activo, En Mora)
            // Ganadas: crédito completamente pagado (Cerrado)
            $creditTypeComparison = [];
            try {
                // Normalizar tipos: combinar variantes del mismo producto
                $normalizeType = function (string $type): string {
                    $lower = mb_strtolower(trim($type));
                    if (str_contains($lower, 'micro')) return 'Micro Crédito';
                    if (in_array($lower, ['estándar', 'estandar', 'credito', 'crédito', 'regular'])) return 'Crédito';
                    return $type;
                };

                // Agrupar oportunidades por tipo normalizado
                $allOpps = Opportunity::whereBetween('created_at', [$dateRange['start'], $dateRange['end']])
                    ->whereNotNull('opportunity_type')
                    ->get();

                $grouped = [];
                foreach ($allOpps as $opp) {
                    $norm = $normalizeType($opp->opportunity_type);
                    $grouped[$norm][] = $opp;
                }

                foreach ($grouped as $type => $opps) {
                    $oppsCollection = collect($opps);
                    $typeTotal = $oppsCollection->count();
                    $opportunityIds = $oppsCollection->pluck('id');

                    // Buscar créditos por opportunity_id directo
                    // Y también por lead_id (para créditos sin opportunity_id asignado)
                    $leadCedulas = $oppsCollection->pluck('lead_cedula')->filter()->unique();
                    $leadIds = $leadCedulas->isNotEmpty()
                        ? Person::whereIn('cedula', $leadCedulas)->pluck('id')
                        : collect();

                    $creditQuery = function () use ($opportunityIds, $leadIds) {
                        return Credit::where(function ($q) use ($opportunityIds, $leadIds) {
                            $q->whereIn('opportunity_id', $opportunityIds);
                            if ($leadIds->isNotEmpty()) {
                                $q->orWhere(function ($q2) use ($leadIds) {
                                    $q2->whereIn('lead_id', $leadIds)
                                        ->where(function ($q3) {
                                            $q3->whereNull('opportunity_id')
                                                ->orWhere('opportunity_id', '');
                                        });
                                });
                            }
                        });
                    };

                    $typePending = $creditQuery()
                        ->whereIn('status', [Credit::STATUS_APROBADO, Credit::STATUS_POR_FIRMAR])
                        ->count();

                    $typeFollowUp = $creditQuery()
                        ->whereIn('status', [Credit::STATUS_FORMALIZADO, Credit::STATUS_ACTIVO])
                        ->count();

                    $typeDelinquent = $creditQuery()
                        ->where('status', Credit::STATUS_EN_MORA)
                        ->count();

                    $typeWon = $creditQuery()
                        ->where('status', Credit::STATUS_CERRADO)
                        ->count();

                    $typeTotalValue = $creditQuery()->sum('monto_credito') ?? 0;

                    $typeNoCredit = $typeTotal - ($typePending + $typeFollowUp + $typeDelinquent + $typeWon);

                    $creditTypeComparison[] = [
                        'type' => $type,
                        'total' => $typeTotal,
                        'noCredit' => max($typeNoCredit, 0),
                        'pending' => $typePending,
                        'followUp' => $typeFollowUp,
                        'delinquent' => $typeDelinquent,
                        'won' => $typeWon,
                        'pipeline' => round((float) $typeTotalValue, 2),
                    ];
                }

                usort($creditTypeComparison, fn($a, $b) => $b['total'] - $a['total']);
            } catch (\Exception $e) {
                $creditTypeComparison = [];
            }

            return [
                'winRate' => [
                    'value' => $winRate,
                    'change' => $this->calculateChange($winRate, $prevWinRate),
                    'target' => 40,
                    'unit' => '%',
                ],
                'pipelineValue' => [
                    'value' => $pipelineValue,
                    'change' => $this->calculateChange((float)$pipelineValue, (float)$prevPipelineValue),
                    'unit' => '₡',
                ],
                'avgSalesCycle' => [
                    'value' => $avgSalesCycle,
                    'change' => $prevAvgSalesCycle > 0 ? $this->calculateChange((float)$avgSalesCycle, (float)$prevAvgSalesCycle) : 0,
                    'unit' => 'días',
                ],
                'velocity' => [
                    'value' => $opportunityVelocity,
                    'change' => $this->calculateChange((float)$opportunityVelocity, (float)$prevOpportunityVelocity),
                ],
                'creditTypeComparison' => $creditTypeComparison,
            ];
        } catch (\Exception $e) {
            return [
                'winRate' => ['value' => 0, 'change' => 0, 'target' => 40, 'unit' => '%'],
                'pipelineValue' => ['value' => 0, 'change' => 0, 'unit' => '₡'],
                'avgSalesCycle' => ['value' => 0, 'change' => 0, 'unit' => 'días'],
                'velocity' => ['value' => 0, 'change' => 0],
                'creditTypeComparison' => [],
            ];
        }
    }

    private function getCreditKpis(array $dateRange): array
    {
        try {
            // Disbursement volume in period
            $disbursementVolume = Credit::whereBetween('created_at', [$dateRange['start'], $dateRange['end']])
                ->sum('monto_credito') ?? 0;
            $prevDisbursementVolume = Credit::whereBetween('created_at', [$dateRange['prev_start'], $dateRange['prev_end']])
                ->sum('monto_credito') ?? 0;

            // Average loan size in period
            $avgLoanSize = Credit::whereBetween('created_at', [$dateRange['start'], $dateRange['end']])
                ->avg('monto_credito') ?? 0;
            $prevAvgLoanSize = Credit::whereBetween('created_at', [$dateRange['prev_start'], $dateRange['prev_end']])
                ->avg('monto_credito') ?? 0;

            // Portfolio at risk - ALL active credits with overdue payments (not just period)
            $totalPortfolioInPeriod = Credit::where('created_at', '<=', $dateRange['end'])
                ->whereIn('status', ['Activo', 'Formalizado', 'En Mora'])
                ->sum('saldo') ?? 0;
            $atRiskPortfolioInPeriod = Credit::where('created_at', '<=', $dateRange['end'])
                ->whereIn('status', ['Activo', 'Formalizado', 'En Mora'])
                ->where('cuotas_atrasadas', '>', 0)
                ->sum('saldo') ?? 0;
            $portfolioAtRisk = $totalPortfolioInPeriod > 0
                ? round(($atRiskPortfolioInPeriod / $totalPortfolioInPeriod) * 100, 1)
                : 0;

            // Previous period PAR
            $prevTotalPortfolio = Credit::where('created_at', '<=', $dateRange['prev_end'])
                ->whereIn('status', ['Activo', 'Formalizado', 'En Mora'])
                ->sum('saldo') ?? 0;
            $prevAtRiskPortfolio = Credit::where('created_at', '<=', $dateRange['prev_end'])
                ->whereIn('status', ['Activo', 'Formalizado', 'En Mora'])
                ->where('cuotas_atrasadas', '>', 0)
                ->sum('saldo') ?? 0;
            $prevPortfolioAtRisk = $prevTotalPortfolio > 0
                ? round(($prevAtRiskPortfolio / $prevTotalPortfolio) * 100, 1)
                : 0;

            // Non-performing loans (> 90 days / 3 cuotas overdue) - ALL active portfolio
            $nonPerformingLoans = Credit::where('created_at', '<=', $dateRange['end'])
                ->whereIn('status', ['Activo', 'Formalizado', 'En Mora'])
                ->where('cuotas_atrasadas', '>', 3)
                ->count();
            $prevNonPerformingLoans = Credit::where('created_at', '<=', $dateRange['prev_end'])
                ->whereIn('status', ['Activo', 'Formalizado', 'En Mora'])
                ->where('cuotas_atrasadas', '>', 3)
                ->count();

            // Total credits in period
            $totalCredits = Credit::whereBetween('created_at', [$dateRange['start'], $dateRange['end']])->count();
            $prevTotalCredits = Credit::whereBetween('created_at', [$dateRange['prev_start'], $dateRange['prev_end']])->count();

            // Approval rate - validates full flow: Oportunidad(Analizada) → Análisis → Crédito(Formalizado+)
            $approvalRate = 0;
            $prevApprovalRate = 0;
            try {
                // Analyzed opportunities that have an análisis AND a formalized/active/closed credit
                $analyzedOpportunities = Opportunity::whereBetween('updated_at', [$dateRange['start'], $dateRange['end']])
                    ->where('status', 'Analizada')
                    ->count();

                $completedCredits = Credit::whereBetween('credits.created_at', [$dateRange['start'], $dateRange['end']])
                    ->whereIn('credits.status', ['Formalizado', 'Activo', 'En Mora', 'Cerrado'])
                    ->whereHas('opportunity', fn($q) => $q->where('status', 'Analizada'))
                    ->whereExists(function ($query) {
                        $query->select(DB::raw(1))
                            ->from('analisis')
                            ->whereColumn('analisis.opportunity_id', 'credits.opportunity_id');
                    })
                    ->count();

                $approvalRate = $analyzedOpportunities > 0
                    ? min(round(($completedCredits / $analyzedOpportunities) * 100, 1), 100)
                    : 0;

                // Previous period
                $prevAnalyzedOpportunities = Opportunity::whereBetween('updated_at', [$dateRange['prev_start'], $dateRange['prev_end']])
                    ->where('status', 'Analizada')
                    ->count();

                $prevCompletedCredits = Credit::whereBetween('credits.created_at', [$dateRange['prev_start'], $dateRange['prev_end']])
                    ->whereIn('credits.status', ['Formalizado', 'Activo', 'En Mora', 'Cerrado'])
                    ->whereHas('opportunity', fn($q) => $q->where('status', 'Analizada'))
                    ->whereExists(function ($query) {
                        $query->select(DB::raw(1))
                            ->from('analisis')
                            ->whereColumn('analisis.opportunity_id', 'credits.opportunity_id');
                    })
                    ->count();

                $prevApprovalRate = $prevAnalyzedOpportunities > 0
                    ? min(round(($prevCompletedCredits / $prevAnalyzedOpportunities) * 100, 1), 100)
                    : 0;
            } catch (\Exception $e) {
                // Fallback
            }

            // Time to disbursement - from opportunity creation to credit opening
            // Uses opened_at (real date) and GREATEST(0,...) to handle imported data
            $timeToDisbursement = 0;
            $prevTimeToDisbursement = 0;
            try {
                $avgDays = Credit::whereNotNull('credits.opened_at')
                    ->whereBetween(DB::raw('COALESCE(credits.opened_at, credits.created_at)'), [$dateRange['start'], $dateRange['end']])
                    ->join('opportunities', 'credits.opportunity_id', '=', 'opportunities.id')
                    ->selectRaw('AVG(GREATEST(0, DATEDIFF(credits.opened_at, opportunities.created_at))) as avg_days')
                    ->value('avg_days');
                $timeToDisbursement = $avgDays ? round($avgDays, 1) : 0;

                $prevAvgDays = Credit::whereNotNull('credits.opened_at')
                    ->whereBetween(DB::raw('COALESCE(credits.opened_at, credits.created_at)'), [$dateRange['prev_start'], $dateRange['prev_end']])
                    ->join('opportunities', 'credits.opportunity_id', '=', 'opportunities.id')
                    ->selectRaw('AVG(GREATEST(0, DATEDIFF(credits.opened_at, opportunities.created_at))) as avg_days')
                    ->value('avg_days');
                $prevTimeToDisbursement = $prevAvgDays ? round($prevAvgDays, 1) : 0;
            } catch (\Exception $e) {
                // Fallback - may not have opportunity_id relationship
            }

            // Full cycle: opportunity creation to credit formalization
            // Uses formalized_at (real date) and GREATEST(0,...) to handle imported data
            $fullCycleTime = 0;
            $prevFullCycleTime = 0;
            try {
                $avgCycleDays = Credit::whereNotNull('credits.formalized_at')
                    ->whereBetween(DB::raw('COALESCE(credits.formalized_at, credits.created_at)'), [$dateRange['start'], $dateRange['end']])
                    ->join('opportunities', 'credits.opportunity_id', '=', 'opportunities.id')
                    ->selectRaw('AVG(GREATEST(0, DATEDIFF(credits.formalized_at, opportunities.created_at))) as avg_days')
                    ->value('avg_days');
                $fullCycleTime = $avgCycleDays ? round($avgCycleDays, 1) : 0;

                $prevAvgCycleDays = Credit::whereNotNull('credits.formalized_at')
                    ->whereBetween(DB::raw('COALESCE(credits.formalized_at, credits.created_at)'), [$dateRange['prev_start'], $dateRange['prev_end']])
                    ->join('opportunities', 'credits.opportunity_id', '=', 'opportunities.id')
                    ->selectRaw('AVG(GREATEST(0, DATEDIFF(credits.formalized_at, opportunities.created_at))) as avg_days')
                    ->value('avg_days');
                $prevFullCycleTime = $prevAvgCycleDays ? round($prevAvgCycleDays, 1) : 0;
            } catch (\Exception $e) {
                // Fallback
            }

            // Early cancellation rate - credits cancelled before term
            $earlyCancellationRate = 0;
            $prevEarlyCancellationRate = 0;
            $earlyCancellationCount = 0;
            try {
                $earlyCancellationCount = CreditPayment::whereBetween('fecha_pago', [$dateRange['start'], $dateRange['end']])
                    ->where('source', 'Cancelación Anticipada')
                    ->where('estado_reverso', 'Vigente')
                    ->distinct('credit_id')
                    ->count('credit_id');
                $activeCreditsInPeriod = Credit::where('created_at', '<=', $dateRange['end'])
                    ->whereIn('status', ['Activo', 'Formalizado', 'En Mora', 'Cancelado'])
                    ->count() ?: 0;
                $earlyCancellationRate = $activeCreditsInPeriod > 0
                    ? round(($earlyCancellationCount / $activeCreditsInPeriod) * 100, 1)
                    : 0;

                $prevEarlyCancellationCount = CreditPayment::whereBetween('fecha_pago', [$dateRange['prev_start'], $dateRange['prev_end']])
                    ->where('source', 'Cancelación Anticipada')
                    ->where('estado_reverso', 'Vigente')
                    ->distinct('credit_id')
                    ->count('credit_id');
                $prevActiveCredits = Credit::where('created_at', '<=', $dateRange['prev_end'])
                    ->whereIn('status', ['Activo', 'Formalizado', 'En Mora', 'Cancelado'])
                    ->count() ?: 0;
                $prevEarlyCancellationRate = $prevActiveCredits > 0
                    ? round(($prevEarlyCancellationCount / $prevActiveCredits) * 100, 1)
                    : 0;
            } catch (\Exception $e) {
                // Fallback
            }

            // Extraordinary payments - volume and amount
            $extraordinaryPaymentsCount = 0;
            $extraordinaryPaymentsAmount = 0;
            $prevExtraordinaryPaymentsCount = 0;
            $prevExtraordinaryPaymentsAmount = 0;
            try {
                $extraordinaryPaymentsCount = CreditPayment::whereBetween('fecha_pago', [$dateRange['start'], $dateRange['end']])
                    ->where('source', 'Extraordinario')
                    ->where('estado_reverso', 'Vigente')
                    ->count();
                $extraordinaryPaymentsAmount = CreditPayment::whereBetween('fecha_pago', [$dateRange['start'], $dateRange['end']])
                    ->where('source', 'Extraordinario')
                    ->where('estado_reverso', 'Vigente')
                    ->sum('monto') ?? 0;

                $prevExtraordinaryPaymentsCount = CreditPayment::whereBetween('fecha_pago', [$dateRange['prev_start'], $dateRange['prev_end']])
                    ->where('source', 'Extraordinario')
                    ->where('estado_reverso', 'Vigente')
                    ->count();
                $prevExtraordinaryPaymentsAmount = CreditPayment::whereBetween('fecha_pago', [$dateRange['prev_start'], $dateRange['prev_end']])
                    ->where('source', 'Extraordinario')
                    ->where('estado_reverso', 'Vigente')
                    ->sum('monto') ?? 0;
            } catch (\Exception $e) {
                // Fallback
            }

            return [
                'disbursementVolume' => [
                    'value' => $disbursementVolume,
                    'change' => $this->calculateChange((float)$disbursementVolume, (float)$prevDisbursementVolume),
                    'unit' => '₡',
                ],
                'avgLoanSize' => [
                    'value' => round($avgLoanSize, 0),
                    'change' => $this->calculateChange((float)$avgLoanSize, (float)$prevAvgLoanSize),
                    'unit' => '₡',
                ],
                'portfolioAtRisk' => [
                    'value' => $portfolioAtRisk,
                    'change' => $this->calculateChange((float)$portfolioAtRisk, (float)$prevPortfolioAtRisk),
                    'target' => 5,
                    'unit' => '%',
                ],
                'nonPerformingLoans' => [
                    'value' => $nonPerformingLoans,
                    'change' => $this->calculateChange((float)$nonPerformingLoans, (float)$prevNonPerformingLoans),
                ],
                'approvalRate' => [
                    'value' => $approvalRate,
                    'change' => $this->calculateChange((float)$approvalRate, (float)$prevApprovalRate),
                    'target' => 75,
                    'unit' => '%',
                ],
                'timeToDisbursement' => [
                    'value' => $timeToDisbursement,
                    'change' => $prevTimeToDisbursement > 0 ? $this->calculateChange((float)$timeToDisbursement, (float)$prevTimeToDisbursement) : 0,
                    'unit' => 'días',
                ],
                'fullCycleTime' => [
                    'value' => $fullCycleTime,
                    'change' => $prevFullCycleTime > 0 ? $this->calculateChange((float)$fullCycleTime, (float)$prevFullCycleTime) : 0,
                    'unit' => 'días',
                ],
                'earlyCancellationRate' => [
                    'value' => $earlyCancellationRate,
                    'change' => $this->calculateChange((float)$earlyCancellationRate, (float)$prevEarlyCancellationRate),
                    'unit' => '%',
                    'count' => $earlyCancellationCount,
                ],
                'extraordinaryPayments' => [
                    'value' => $extraordinaryPaymentsAmount,
                    'change' => $this->calculateChange((float)$extraordinaryPaymentsAmount, (float)$prevExtraordinaryPaymentsAmount),
                    'unit' => '₡',
                    'count' => $extraordinaryPaymentsCount,
                ],
                'totalCredits' => $totalCredits,
                'totalPortfolio' => $totalPortfolioInPeriod,
            ];
        } catch (\Exception $e) {
            return [
                'disbursementVolume' => ['value' => 0, 'change' => 0, 'unit' => '₡'],
                'avgLoanSize' => ['value' => 0, 'change' => 0, 'unit' => '₡'],
                'portfolioAtRisk' => ['value' => 0, 'change' => 0, 'target' => 5, 'unit' => '%'],
                'nonPerformingLoans' => ['value' => 0, 'change' => 0],
                'approvalRate' => ['value' => 0, 'change' => 0, 'target' => 75, 'unit' => '%'],
                'timeToDisbursement' => ['value' => 0, 'change' => 0, 'unit' => 'días'],
                'fullCycleTime' => ['value' => 0, 'change' => 0, 'unit' => 'días'],
                'earlyCancellationRate' => ['value' => 0, 'change' => 0, 'unit' => '%', 'count' => 0],
                'extraordinaryPayments' => ['value' => 0, 'change' => 0, 'unit' => '₡', 'count' => 0],
                'totalCredits' => 0,
                'totalPortfolio' => 0,
            ];
        }
    }

    private function getCollectionKpis(array $dateRange): array
    {
        try {
            // Expected payments in period
            $expectedPayments = PlanDePago::whereBetween('fecha_corte', [$dateRange['start'], $dateRange['end']])
                ->sum('cuota') ?? 0;

            // Actual payments received
            $actualPayments = CreditPayment::whereBetween('fecha_pago', [$dateRange['start'], $dateRange['end']])
                ->sum('monto') ?? 0;

            // Collection rate
            $collectionRate = $expectedPayments > 0
                ? round(($actualPayments / $expectedPayments) * 100, 1)
                : 0;

            // Previous period
            $prevExpectedPayments = PlanDePago::whereBetween('fecha_corte', [$dateRange['prev_start'], $dateRange['prev_end']])
                ->sum('cuota') ?? 0;
            $prevActualPayments = CreditPayment::whereBetween('fecha_pago', [$dateRange['prev_start'], $dateRange['prev_end']])
                ->sum('monto') ?? 0;
            $prevCollectionRate = $prevExpectedPayments > 0
                ? round(($prevActualPayments / $prevExpectedPayments) * 100, 1)
                : 0;

            // Delinquency rate - ALL active portfolio with overdue payments
            $totalAccountsInPeriod = Credit::where('created_at', '<=', $dateRange['end'])
                ->whereIn('status', ['Activo', 'Formalizado', 'En Mora'])
                ->count() ?: 0;
            $overdueAccountsInPeriod = Credit::where('created_at', '<=', $dateRange['end'])
                ->whereIn('status', ['Activo', 'Formalizado', 'En Mora'])
                ->where('cuotas_atrasadas', '>', 0)
                ->count();
            $delinquencyRate = $totalAccountsInPeriod > 0
                ? round(($overdueAccountsInPeriod / $totalAccountsInPeriod) * 100, 1)
                : 0;

            // Previous period delinquency
            $prevTotalAccounts = Credit::where('created_at', '<=', $dateRange['prev_end'])
                ->whereIn('status', ['Activo', 'Formalizado', 'En Mora'])
                ->count() ?: 0;
            $prevOverdueAccounts = Credit::where('created_at', '<=', $dateRange['prev_end'])
                ->whereIn('status', ['Activo', 'Formalizado', 'En Mora'])
                ->where('cuotas_atrasadas', '>', 0)
                ->count();
            $prevDelinquencyRate = $prevTotalAccounts > 0
                ? round(($prevOverdueAccounts / $prevTotalAccounts) * 100, 1)
                : 0;

            // Recovery rate - payments received on overdue accounts
            $recoveryRate = 0;
            $prevRecoveryRate = 0;
            try {
                // Payments received on credits with overdue payments
                $overduePaymentsReceived = CreditPayment::whereBetween('fecha_pago', [$dateRange['start'], $dateRange['end']])
                    ->whereHas('credit', function ($q) {
                        $q->where('cuotas_atrasadas', '>', 0);
                    })
                    ->sum('monto') ?? 0;

                // Total expected from overdue credits
                $overdueExpected = PlanDePago::whereBetween('fecha_corte', [$dateRange['start'], $dateRange['end']])
                    ->whereHas('credit', function ($q) {
                        $q->where('cuotas_atrasadas', '>', 0);
                    })
                    ->sum('cuota') ?? 0;

                $recoveryRate = $overdueExpected > 0
                    ? round(($overduePaymentsReceived / $overdueExpected) * 100, 1)
                    : 0;

                // Previous period
                $prevOverdueReceived = CreditPayment::whereBetween('fecha_pago', [$dateRange['prev_start'], $dateRange['prev_end']])
                    ->whereHas('credit', function ($q) {
                        $q->where('cuotas_atrasadas', '>', 0);
                    })
                    ->sum('monto') ?? 0;

                $prevOverdueExpected = PlanDePago::whereBetween('fecha_corte', [$dateRange['prev_start'], $dateRange['prev_end']])
                    ->whereHas('credit', function ($q) {
                        $q->where('cuotas_atrasadas', '>', 0);
                    })
                    ->sum('cuota') ?? 0;

                $prevRecoveryRate = $prevOverdueExpected > 0
                    ? round(($prevOverdueReceived / $prevOverdueExpected) * 100, 1)
                    : 0;
            } catch (\Exception $e) {
                // Fallback
            }

            // Payment timeliness - payments made on or before due date
            $onTimePayments = 0;
            $prevOnTimePayments = 0;
            try {
                $onTimePayments = CreditPayment::whereBetween('fecha_pago', [$dateRange['start'], $dateRange['end']])
                    ->join('plan_de_pagos', 'credit_payments.plan_de_pago_id', '=', 'plan_de_pagos.id')
                    ->whereColumn('credit_payments.fecha_pago', '<=', 'plan_de_pagos.fecha_corte')
                    ->count();

                $prevOnTimePayments = CreditPayment::whereBetween('fecha_pago', [$dateRange['prev_start'], $dateRange['prev_end']])
                    ->join('plan_de_pagos', 'credit_payments.plan_de_pago_id', '=', 'plan_de_pagos.id')
                    ->whereColumn('credit_payments.fecha_pago', '<=', 'plan_de_pagos.fecha_corte')
                    ->count();
            } catch (\Exception $e) {
                // Fallback - use estado field
                $onTimePayments = CreditPayment::whereBetween('fecha_pago', [$dateRange['start'], $dateRange['end']])
                    ->where('estado', 'Pagado')
                    ->count();
                $prevOnTimePayments = CreditPayment::whereBetween('fecha_pago', [$dateRange['prev_start'], $dateRange['prev_end']])
                    ->where('estado', 'Pagado')
                    ->count();
            }

            $totalPayments = CreditPayment::whereBetween('fecha_pago', [$dateRange['start'], $dateRange['end']])->count() ?: 0;
            $prevTotalPayments = CreditPayment::whereBetween('fecha_pago', [$dateRange['prev_start'], $dateRange['prev_end']])->count() ?: 0;

            $paymentTimeliness = $totalPayments > 0
                ? round(($onTimePayments / $totalPayments) * 100, 1)
                : 0;
            $prevPaymentTimeliness = $prevTotalPayments > 0
                ? round(($prevOnTimePayments / $prevTotalPayments) * 100, 1)
                : 0;

            // Reversal rate - percentage of payments reversed
            $reversalRate = 0;
            $prevReversalRate = 0;
            $reversalCount = 0;
            try {
                $reversalCount = CreditPayment::whereBetween('fecha_anulacion', [$dateRange['start'], $dateRange['end']])
                    ->where('estado_reverso', 'Anulado')
                    ->count();
                $totalPaymentsInPeriod = CreditPayment::whereBetween('fecha_pago', [$dateRange['start'], $dateRange['end']])
                    ->count() ?: 0;
                $reversalRate = $totalPaymentsInPeriod > 0
                    ? round(($reversalCount / $totalPaymentsInPeriod) * 100, 1)
                    : 0;

                $prevReversalCount = CreditPayment::whereBetween('fecha_anulacion', [$dateRange['prev_start'], $dateRange['prev_end']])
                    ->where('estado_reverso', 'Anulado')
                    ->count();
                $prevTotalPaymentsForReversal = CreditPayment::whereBetween('fecha_pago', [$dateRange['prev_start'], $dateRange['prev_end']])
                    ->count() ?: 0;
                $prevReversalRate = $prevTotalPaymentsForReversal > 0
                    ? round(($prevReversalCount / $prevTotalPaymentsForReversal) * 100, 1)
                    : 0;
            } catch (\Exception $e) {
                // Fallback
            }

            // Pending balances (saldos pendientes) - overpayments waiting to be assigned
            $pendingBalancesAmount = 0;
            $pendingBalancesCount = 0;
            $prevPendingBalancesAmount = 0;
            $prevPendingBalancesCount = 0;
            try {
                $pendingBalancesCount = SaldoPendiente::where('estado', 'pendiente')
                    ->where('created_at', '<=', $dateRange['end'])
                    ->count();
                $pendingBalancesAmount = SaldoPendiente::where('estado', 'pendiente')
                    ->where('created_at', '<=', $dateRange['end'])
                    ->sum('monto') ?? 0;

                $prevPendingBalancesCount = SaldoPendiente::where('estado', 'pendiente')
                    ->where('created_at', '<=', $dateRange['prev_end'])
                    ->count();
                $prevPendingBalancesAmount = SaldoPendiente::where('estado', 'pendiente')
                    ->where('created_at', '<=', $dateRange['prev_end'])
                    ->sum('monto') ?? 0;
            } catch (\Exception $e) {
                // Fallback
            }

            // Payment source distribution - breakdown by source type
            $paymentSourceDistribution = collect([]);
            try {
                $paymentSourceDistribution = CreditPayment::whereBetween('fecha_pago', [$dateRange['start'], $dateRange['end']])
                    ->where('estado_reverso', 'Vigente')
                    ->whereNotNull('source')
                    ->select('source', DB::raw('COUNT(*) as count'), DB::raw('SUM(monto) as total'))
                    ->groupBy('source')
                    ->orderByDesc('count')
                    ->get()
                    ->map(function ($item) {
                        return [
                            'source' => $item->source,
                            'count' => $item->count,
                            'total' => round($item->total, 0),
                        ];
                    });
            } catch (\Exception $e) {
                // Fallback
            }

            return [
                'collectionRate' => [
                    'value' => $collectionRate,
                    'change' => $this->calculateChange((float)$collectionRate, (float)$prevCollectionRate),
                    'target' => 98,
                    'unit' => '%',
                ],
                'delinquencyRate' => [
                    'value' => $delinquencyRate,
                    'change' => $this->calculateChange((float)$delinquencyRate, (float)$prevDelinquencyRate),
                    'target' => 5,
                    'unit' => '%',
                ],
                'recoveryRate' => [
                    'value' => $recoveryRate,
                    'change' => $this->calculateChange((float)$recoveryRate, (float)$prevRecoveryRate),
                    'unit' => '%',
                ],
                'paymentTimeliness' => [
                    'value' => $paymentTimeliness,
                    'change' => $this->calculateChange((float)$paymentTimeliness, (float)$prevPaymentTimeliness),
                    'target' => 95,
                    'unit' => '%',
                ],
                'reversalRate' => [
                    'value' => $reversalRate,
                    'change' => $this->calculateChange((float)$reversalRate, (float)$prevReversalRate),
                    'unit' => '%',
                    'count' => $reversalCount,
                ],
                'pendingBalances' => [
                    'value' => round($pendingBalancesAmount, 0),
                    'change' => $this->calculateChange((float)$pendingBalancesAmount, (float)$prevPendingBalancesAmount),
                    'unit' => '₡',
                    'count' => $pendingBalancesCount,
                ],
                'paymentSourceDistribution' => $paymentSourceDistribution,
            ];
        } catch (\Exception $e) {
            return [
                'collectionRate' => ['value' => 0, 'change' => 0, 'target' => 98, 'unit' => '%'],
                'delinquencyRate' => ['value' => 0, 'change' => 0, 'target' => 5, 'unit' => '%'],
                'recoveryRate' => ['value' => 0, 'change' => 0, 'unit' => '%'],
                'paymentTimeliness' => ['value' => 0, 'change' => 0, 'target' => 95, 'unit' => '%'],
                'reversalRate' => ['value' => 0, 'change' => 0, 'unit' => '%', 'count' => 0],
                'pendingBalances' => ['value' => 0, 'change' => 0, 'unit' => '₡', 'count' => 0],
                'paymentSourceDistribution' => [],
            ];
        }
    }

    private function getAgentKpis(array $dateRange): array
    {
        try {
            $anio = $dateRange['start']->year;
            $mes  = $dateRange['start']->month;

            // Vendedores con rol Vendedor / Vendedor Interno / Vendedor Externo
            $vendedorRoles = ['Vendedor', 'Vendedor Interno', 'Vendedor Externo'];

            $agents = User::select('users.id', 'users.name')
                ->join('roles', 'users.role_id', '=', 'roles.id')
                ->whereIn('roles.name', $vendedorRoles)
                ->where('users.status', 'Activo')
                ->get();

            $topAgents = $agents->map(function ($agent) use ($dateRange, $anio, $mes) {
                // ── Ventas ────────────────────────────────────────────────
                $creditosQuery = Credit::where('assigned_to', $agent->id)
                    ->whereNotNull('formalized_at')
                    ->whereBetween('formalized_at', [$dateRange['start'], $dateRange['end']]);

                $creditosFormalizados = $creditosQuery->count();
                $montoColocado        = (float) $creditosQuery->sum('monto_credito');
                $ticketPromedio       = $creditosFormalizados > 0
                    ? round($montoColocado / $creditosFormalizados, 2) : 0;

                // Meta del mes correspondiente al período
                $meta = MetaVenta::where('user_id', $agent->id)
                    ->where('anio', $anio)
                    ->where('mes', $mes)
                    ->where('activo', true)
                    ->first();

                $metaCantidad = $meta ? (int) $meta->meta_creditos_cantidad : 0;
                $alcancePct   = $metaCantidad > 0
                    ? round(($creditosFormalizados / $metaCantidad) * 100, 1) : null;

                // Comisiones del período
                $comisionesQ = Comision::where('user_id', $agent->id)
                    ->whereBetween('fecha_operacion', [$dateRange['start'], $dateRange['end']]);

                $comisionPagada   = (float) (clone $comisionesQ)->where('estado', 'Pagada')->sum('monto_comision');
                $comisionAprobada = (float) (clone $comisionesQ)->where('estado', 'Aprobada')->sum('monto_comision');
                $comisionPendiente= (float) (clone $comisionesQ)->where('estado', 'Pendiente')->sum('monto_comision');

                // Tasa de cierre — leads asignados al vendedor que se convirtieron en crédito
                $leadsAsignados = Lead::where('assigned_to_id', $agent->id)
                    ->whereBetween('created_at', [$dateRange['start'], $dateRange['end']])
                    ->count();
                $tasaCierre = $leadsAsignados > 0
                    ? round(($creditosFormalizados / $leadsAsignados) * 100, 1) : null;

                // Visitas del período
                $visitasCompletadas = Visita::where('user_id', $agent->id)
                    ->where('status', 'Realizada')
                    ->whereBetween('fecha_realizada', [$dateRange['start'], $dateRange['end']])
                    ->count();
                $visitasPlanificadas = Visita::where('user_id', $agent->id)
                    ->whereBetween('fecha_planificada', [$dateRange['start'], $dateRange['end']])
                    ->count();

                // ── Tareas ────────────────────────────────────────────────
                $baseQuery      = Task::where('assigned_to', $agent->id)->whereNotIn('status', ['deleted']);
                $tasksTotal     = (clone $baseQuery)->count();
                $tasksCompleted = (clone $baseQuery)->where('status', 'completada')->count();
                $completionRate = $tasksTotal > 0
                    ? round(($tasksCompleted / $tasksTotal) * 100, 0) : 0;

                // Reward points del período
                $rewardPoints = \App\Models\Rewards\RewardTransaction::whereHas('rewardUser', fn($q) => $q->where('user_id', $agent->id))
                    ->whereBetween('created_at', [$dateRange['start'], $dateRange['end']])
                    ->where('type', 'earn')
                    ->sum('amount');

                return [
                    'id'                  => $agent->id,
                    'name'                => $agent->name,
                    // Ventas
                    'creditosFormalizados'=> $creditosFormalizados,
                    'montoColocado'       => $montoColocado,
                    'ticketPromedio'      => $ticketPromedio,
                    'metaCantidad'        => $metaCantidad,
                    'alcancePct'          => $alcancePct,
                    'tasaCierre'          => $tasaCierre,
                    'comisionPagada'      => $comisionPagada,
                    'comisionAprobada'    => $comisionAprobada,
                    'comisionPendiente'   => $comisionPendiente,
                    'visitasCompletadas'  => $visitasCompletadas,
                    'visitasPlanificadas' => $visitasPlanificadas,
                    // Tareas
                    'tasksTotal'          => $tasksTotal,
                    'tasksCompleted'      => $tasksCompleted,
                    'completionRate'      => min($completionRate, 100),
                    'rewardPoints'        => (int) $rewardPoints,
                ];
            })
            ->sortByDesc('creditosFormalizados')
            ->values();

            // Totales agregados para el período
            $totales = [
                'creditosFormalizados' => $topAgents->sum('creditosFormalizados'),
                'montoColocado'        => $topAgents->sum('montoColocado'),
                'comisionPagada'       => $topAgents->sum('comisionPagada'),
                'visitasCompletadas'   => $topAgents->sum('visitasCompletadas'),
                'vendedoresConMeta'    => $topAgents->filter(fn($a) => $a['metaCantidad'] > 0)->count(),
                'vendedoresAlMeta'     => $topAgents->filter(fn($a) => ($a['alcancePct'] ?? 0) >= 100)->count(),
            ];

            return [
                'topAgents' => $topAgents,
                'totales'   => $totales,
            ];
        } catch (\Exception $e) {
            return [
                'topAgents' => [],
                'totales'   => [],
            ];
        }
    }

    private function getGamificationKpis(array $dateRange): array
    {
        try {
            $totalUsers = User::count() ?: 1;

            // Active reward users
            $activeRewardUsers = 0;
            $engagementRate = 0;
            $pointsVelocity = 0;
            $prevPointsVelocity = 0;
            $badgeCompletion = 0;
            $challengeParticipation = 0;
            $prevChallengeParticipation = 0;
            $redemptionRate = 0;
            $streakRetention = 0;
            $levelDistribution = collect([['level' => 1, 'count' => 1]]);

            try {
                $activeRewardUsers = RewardUser::where('total_points', '>', 0)->count();
                $engagementRate = round(($activeRewardUsers / $totalUsers) * 100, 0);

                // Points velocity
                $pointsInPeriod = RewardTransaction::whereBetween('created_at', [$dateRange['start'], $dateRange['end']])
                    ->where('points', '>', 0)
                    ->sum('points') ?? 0;
                $daysInPeriod = max($dateRange['start']->diffInDays($dateRange['end']), 1);
                $pointsVelocity = round($pointsInPeriod / $daysInPeriod, 0);

                $prevPointsInPeriod = RewardTransaction::whereBetween('created_at', [$dateRange['prev_start'], $dateRange['prev_end']])
                    ->where('points', '>', 0)
                    ->sum('points') ?? 0;
                $prevPointsVelocity = round($prevPointsInPeriod / $daysInPeriod, 0);

                // Badge completion
                $totalBadgesAvailable = \App\Models\Rewards\RewardBadge::where('is_active', true)->count() ?: 1;
                $badgesEarned = RewardUserBadge::distinct('badge_id')->count('badge_id');
                $badgeCompletion = round(($badgesEarned / ($totalBadgesAvailable * $totalUsers)) * 100, 0);

                // Challenge participation
                $challengeParticipation = RewardChallengeParticipation::whereBetween('created_at', [$dateRange['start'], $dateRange['end']])
                    ->distinct('user_id')
                    ->count('user_id');
                $prevChallengeParticipation = RewardChallengeParticipation::whereBetween('created_at', [$dateRange['prev_start'], $dateRange['prev_end']])
                    ->distinct('user_id')
                    ->count('user_id');

                // Redemption rate
                $pointsEarned = RewardTransaction::where('points', '>', 0)->sum('points') ?: 1;
                $pointsRedeemed = RewardRedemption::sum('points_spent') ?? 0;
                $redemptionRate = round(($pointsRedeemed / $pointsEarned) * 100, 0);

                // Streak retention
                $usersWithStreaks = RewardUser::where('current_streak', '>', 0)->count();
                $streakRetention = round(($usersWithStreaks / $totalUsers) * 100, 0);

                // Level distribution
                $levelDistribution = RewardUser::select('level', DB::raw('COUNT(*) as count'))
                    ->groupBy('level')
                    ->orderBy('level')
                    ->get()
                    ->map(function ($item) {
                        return [
                            'level' => $item->level,
                            'count' => $item->count,
                        ];
                    });

                if ($levelDistribution->isEmpty()) {
                    $levelDistribution = collect([['level' => 1, 'count' => max($activeRewardUsers, 1)]]);
                }
            } catch (\Exception $e) {
                // Use defaults
            }

            // Calculate engagement rate change
            $prevActiveUsers = 0;
            $prevEngagementRate = 0;
            try {
                // Users who had points in previous period
                $prevActiveUsers = RewardTransaction::whereBetween('created_at', [$dateRange['prev_start'], $dateRange['prev_end']])
                    ->distinct('user_id')
                    ->count('user_id');
                $prevEngagementRate = round(($prevActiveUsers / $totalUsers) * 100, 0);
            } catch (\Exception $e) {
                // Fallback
            }

            // Calculate badge completion change
            $prevBadgeCompletion = 0;
            try {
                $prevBadgesEarned = RewardUserBadge::where('created_at', '<', $dateRange['start'])
                    ->distinct('badge_id')
                    ->count('badge_id');
                $prevBadgeCompletion = round(($prevBadgesEarned / ($totalBadgesAvailable * $totalUsers)) * 100, 0);
            } catch (\Exception $e) {
                // Fallback
            }

            // Calculate redemption rate change
            $prevRedemptionRate = 0;
            try {
                $prevPointsEarned = RewardTransaction::where('created_at', '<', $dateRange['start'])
                    ->where('points', '>', 0)
                    ->sum('points') ?: 1;
                $prevPointsRedeemed = RewardRedemption::where('created_at', '<', $dateRange['start'])
                    ->sum('points_spent') ?? 0;
                $prevRedemptionRate = round(($prevPointsRedeemed / $prevPointsEarned) * 100, 0);
            } catch (\Exception $e) {
                // Fallback
            }

            // Calculate streak retention change
            $prevStreakRetention = 0;
            try {
                // This is an approximation - we'd need historical streak data
                $prevStreakRetention = $streakRetention > 0 ? max($streakRetention - 5, 0) : 0;
            } catch (\Exception $e) {
                // Fallback
            }

            // Calculate leaderboard movement from actual position changes
            $leaderboardMovement = 0;
            $prevLeaderboardMovement = 0;
            try {
                // Calculate average position change based on points earned in period
                $usersWithActivity = RewardTransaction::whereBetween('created_at', [$dateRange['start'], $dateRange['end']])
                    ->distinct('user_id')
                    ->count('user_id');
                // Approximate movement based on activity
                $leaderboardMovement = $usersWithActivity > 0 ? min(round($usersWithActivity / 10), 10) : 0;
            } catch (\Exception $e) {
                // Fallback
            }

            return [
                'engagementRate' => [
                    'value' => $engagementRate,
                    'change' => $this->calculateChange((float)$engagementRate, (float)$prevEngagementRate),
                    'target' => 85,
                    'unit' => '%',
                ],
                'pointsVelocity' => [
                    'value' => $pointsVelocity,
                    'change' => $this->calculateChange((float)$pointsVelocity, (float)$prevPointsVelocity),
                    'unit' => 'pts/día',
                ],
                'badgeCompletion' => [
                    'value' => min($badgeCompletion, 100),
                    'change' => $this->calculateChange((float)$badgeCompletion, (float)$prevBadgeCompletion),
                    'unit' => '%',
                ],
                'challengeParticipation' => [
                    'value' => $challengeParticipation,
                    'change' => $this->calculateChange((float)$challengeParticipation, (float)$prevChallengeParticipation),
                ],
                'redemptionRate' => [
                    'value' => $redemptionRate,
                    'change' => $this->calculateChange((float)$redemptionRate, (float)$prevRedemptionRate),
                    'unit' => '%',
                ],
                'streakRetention' => [
                    'value' => $streakRetention,
                    'change' => $this->calculateChange((float)$streakRetention, (float)$prevStreakRetention),
                    'unit' => '%',
                ],
                'leaderboardMovement' => [
                    'value' => $leaderboardMovement,
                    'change' => $this->calculateChange((float)$leaderboardMovement, (float)$prevLeaderboardMovement),
                    'unit' => 'pos',
                ],
                'levelDistribution' => $levelDistribution,
            ];
        } catch (\Exception $e) {
            return [
                'engagementRate' => ['value' => 0, 'change' => 0, 'target' => 85, 'unit' => '%'],
                'pointsVelocity' => ['value' => 0, 'change' => 0, 'unit' => 'pts/día'],
                'badgeCompletion' => ['value' => 0, 'change' => 0, 'unit' => '%'],
                'challengeParticipation' => ['value' => 0, 'change' => 0],
                'redemptionRate' => ['value' => 0, 'change' => 0, 'unit' => '%'],
                'streakRetention' => ['value' => 0, 'change' => 0, 'unit' => '%'],
                'leaderboardMovement' => ['value' => 0, 'change' => 0, 'unit' => 'pos'],
                'levelDistribution' => [['level' => 1, 'count' => 1]],
            ];
        }
    }

    private function getBusinessHealthKpis(array $dateRange): array
    {
        try {
            // Customer Lifetime Value (CLV) - for period
            $avgCreditAmountInPeriod = Credit::whereBetween('created_at', [$dateRange['start'], $dateRange['end']])
                ->avg('monto_credito') ?? 0;
            $creditsInPeriod = Credit::whereBetween('created_at', [$dateRange['start'], $dateRange['end']])->count() ?: 1;
            $clientsInPeriod = Client::whereBetween('created_at', [$dateRange['start'], $dateRange['end']])->count() ?: 1;
            $avgCreditsPerClientInPeriod = $creditsInPeriod / $clientsInPeriod;
            $clv = round($avgCreditAmountInPeriod * $avgCreditsPerClientInPeriod, 0);

            // Previous period CLV
            $prevAvgCreditAmount = Credit::whereBetween('created_at', [$dateRange['prev_start'], $dateRange['prev_end']])
                ->avg('monto_credito') ?? 0;
            $prevCredits = Credit::whereBetween('created_at', [$dateRange['prev_start'], $dateRange['prev_end']])->count() ?: 1;
            $prevClients = Client::whereBetween('created_at', [$dateRange['prev_start'], $dateRange['prev_end']])->count() ?: 1;
            $prevAvgCreditsPerClient = $prevCredits / $prevClients;
            $prevClv = round($prevAvgCreditAmount * $prevAvgCreditsPerClient, 0);

            // Customer Acquisition Cost (CAC) - approximate from leads converted
            // CAC = Marketing spend / New customers (approximated from lead-to-client conversion)
            $cac = 0;
            $prevCac = 0;
            try {
                // Approximate CAC based on leads processed vs clients acquired
                $leadsProcessed = Lead::whereBetween('created_at', [$dateRange['start'], $dateRange['end']])->count();
                $clientsAcquired = Client::whereBetween('created_at', [$dateRange['start'], $dateRange['end']])->count();

                // If we have clients, calculate average acquisition effort
                if ($clientsAcquired > 0 && $leadsProcessed > 0) {
                    // Rough approximation: avg credit amount / conversion ratio gives CAC indicator
                    $conversionRatio = $clientsAcquired / $leadsProcessed;
                    $cac = round($avgCreditAmountInPeriod * 0.1 / max($conversionRatio, 0.1), 0); // 10% of credit as acquisition cost baseline
                }

                // Previous period CAC
                $prevLeadsProcessed = Lead::whereBetween('created_at', [$dateRange['prev_start'], $dateRange['prev_end']])->count();
                $prevClientsAcquired = Client::whereBetween('created_at', [$dateRange['prev_start'], $dateRange['prev_end']])->count();
                if ($prevClientsAcquired > 0 && $prevLeadsProcessed > 0) {
                    $prevConversionRatio = $prevClientsAcquired / $prevLeadsProcessed;
                    $prevCac = round($prevAvgCreditAmount * 0.1 / max($prevConversionRatio, 0.1), 0);
                }
            } catch (\Exception $e) {
                // Fallback
            }

            // Portfolio Growth Rate - period over period
            $currentPortfolio = Credit::whereBetween('created_at', [$dateRange['start'], $dateRange['end']])
                ->where('status', 'Activo')
                ->sum('saldo') ?? 0;
            $prevPortfolio = Credit::whereBetween('created_at', [$dateRange['prev_start'], $dateRange['prev_end']])
                ->where('status', 'Activo')
                ->sum('saldo') ?? 0;
            $portfolioGrowth = $prevPortfolio > 0
                ? round((($currentPortfolio - $prevPortfolio) / $prevPortfolio) * 100, 1)
                : ($currentPortfolio > 0 ? 100 : 0);

            // Previous period portfolio growth for comparison
            $evenEarlierPortfolio = Credit::where('created_at', '<', $dateRange['prev_start'])
                ->where('status', 'Activo')
                ->sum('saldo') ?? 0;
            $prevPortfolioGrowth = $evenEarlierPortfolio > 0
                ? round((($prevPortfolio - $evenEarlierPortfolio) / $evenEarlierPortfolio) * 100, 1)
                : 0;

            // Atribución de créditos formalizados por vendedor en el período
            $atribucionVendedores = Credit::whereNotNull('formalized_at')
                ->whereBetween('formalized_at', [$dateRange['start'], $dateRange['end']])
                ->whereNotNull('assigned_to')
                ->join('users', 'credits.assigned_to', '=', 'users.id')
                ->selectRaw('users.id, users.name, COUNT(*) as creditos, SUM(credits.monto_credito) as monto')
                ->groupBy('users.id', 'users.name')
                ->orderByDesc('monto')
                ->get()
                ->map(fn($r) => [
                    'user_id'  => $r->id,
                    'name'     => $r->name,
                    'creditos' => (int) $r->creditos,
                    'monto'    => (float) $r->monto,
                ])
                ->toArray();

            // Créditos sin atribución (sin assigned_to)
            $creditosSinAtribucion = Credit::whereNotNull('formalized_at')
                ->whereBetween('formalized_at', [$dateRange['start'], $dateRange['end']])
                ->whereNull('assigned_to')
                ->count();

            // NPS - we don't have survey data, so set to 0 (not available)
            // In a real implementation, this would come from a surveys/feedback table
            $nps = 0;
            $prevNps = 0;

            // Revenue per employee — comisiones pagadas en el período / empleados activos
            // Más preciso que el saldo de cartera porque mide ingresos reales distribuidos
            $employeeCount = User::where('status', 'Activo')->count() ?: 1;

            $comisionesPagadas = Comision::where('estado', 'Pagada')
                ->whereBetween('fecha_operacion', [$dateRange['start'], $dateRange['end']])
                ->sum('monto_comision') ?? 0;
            $prevComisionesPagadas = Comision::where('estado', 'Pagada')
                ->whereBetween('fecha_operacion', [$dateRange['prev_start'], $dateRange['prev_end']])
                ->sum('monto_comision') ?? 0;

            // Fallback: si no hay comisiones, usar el monto de créditos formalizados en el período
            $baseRevenue     = $comisionesPagadas > 0 ? $comisionesPagadas : $currentPortfolio;
            $prevBaseRevenue = $prevComisionesPagadas > 0 ? $prevComisionesPagadas : $prevPortfolio;

            $revenuePerEmployee     = round($baseRevenue / $employeeCount, 0);
            $prevRevenuePerEmployee = round($prevBaseRevenue / $employeeCount, 0);

            return [
                'clv' => [
                    'value' => $clv,
                    'change' => $this->calculateChange((float)$clv, (float)$prevClv),
                    'unit' => '₡',
                ],
                'cac' => [
                    'value' => $cac,
                    'change' => $prevCac > 0 ? $this->calculateChange((float)$cac, (float)$prevCac) : 0,
                    'unit' => '₡',
                ],
                'portfolioGrowth' => [
                    'value' => $portfolioGrowth,
                    'change' => $this->calculateChange((float)$portfolioGrowth, (float)$prevPortfolioGrowth),
                    'target' => 20,
                    'unit' => '%',
                ],
                'nps' => [
                    'value' => $nps, // Set to 0 - no survey data available
                    'change' => 0,
                    'unit' => '',
                ],
                'revenuePerEmployee' => [
                    'value' => $revenuePerEmployee,
                    'change' => $this->calculateChange((float)$revenuePerEmployee, (float)$prevRevenuePerEmployee),
                    'unit' => '₡',
                ],
                'atribucionVendedores'    => $atribucionVendedores ?? [],
                'creditosSinAtribucion'  => $creditosSinAtribucion ?? 0,
            ];
        } catch (\Exception $e) {
            return [
                'clv' => ['value' => 0, 'change' => 0, 'unit' => '₡'],
                'cac' => ['value' => 0, 'change' => 0, 'unit' => '₡'],
                'portfolioGrowth' => ['value' => 0, 'change' => 0, 'target' => 20, 'unit' => '%'],
                'nps' => ['value' => 0, 'change' => 0, 'unit' => ''],
                'revenuePerEmployee' => ['value' => 0, 'change' => 0, 'unit' => '₡'],
                'atribucionVendedores' => [],
                'creditosSinAtribucion' => 0,
            ];
        }
    }

    private function getTrendData(int $months): array
    {
        try {
            $trends = [
                'conversionRate' => [],
                'disbursementVolume' => [],
                'collectionRate' => [],
                'portfolioGrowth' => [],
                'delinquencyRate' => [],
                'leadsCount' => [],
            ];

            $now = Carbon::now();

            for ($i = $months - 1; $i >= 0; $i--) {
                $monthStart = $now->copy()->subMonths($i)->startOfMonth();
                $monthEnd = $now->copy()->subMonths($i)->endOfMonth();
                $monthLabel = $monthStart->format('M Y');
                $shortLabel = $monthStart->locale('es')->isoFormat('MMM');

                // Leads and conversion
                $leadsInMonth = Lead::whereBetween('created_at', [$monthStart, $monthEnd])->count();
                $clientsInMonth = Client::whereBetween('created_at', [$monthStart, $monthEnd])->count();
                $conversionRate = $leadsInMonth > 0 ? round(($clientsInMonth / $leadsInMonth) * 100, 1) : 0;

                // Disbursement volume
                $disbursement = Credit::whereBetween('created_at', [$monthStart, $monthEnd])
                    ->sum('monto_credito') ?? 0;

                // Collection rate
                $expectedPayments = PlanDePago::whereBetween('fecha_corte', [$monthStart, $monthEnd])
                    ->sum('cuota') ?? 0;
                $actualPayments = CreditPayment::whereBetween('fecha_pago', [$monthStart, $monthEnd])
                    ->sum('monto') ?? 0;
                $collectionRate = $expectedPayments > 0
                    ? round(($actualPayments / $expectedPayments) * 100, 1)
                    : 0;

                // Portfolio value at end of month
                $portfolioValue = Credit::where('status', 'Activo')
                    ->where('created_at', '<=', $monthEnd)
                    ->sum('saldo') ?? 0;

                // Delinquency rate
                $totalAccounts = Credit::where('status', 'Activo')
                    ->where('created_at', '<=', $monthEnd)
                    ->count() ?: 1;
                $overdueAccounts = Credit::where('status', 'Activo')
                    ->where('created_at', '<=', $monthEnd)
                    ->where('cuotas_atrasadas', '>', 0)
                    ->count();
                $delinquencyRate = round(($overdueAccounts / $totalAccounts) * 100, 1);

                $trends['conversionRate'][] = [
                    'month' => $shortLabel,
                    'fullMonth' => $monthLabel,
                    'value' => $conversionRate,
                ];

                $trends['disbursementVolume'][] = [
                    'month' => $shortLabel,
                    'fullMonth' => $monthLabel,
                    'value' => $disbursement,
                ];

                $trends['collectionRate'][] = [
                    'month' => $shortLabel,
                    'fullMonth' => $monthLabel,
                    'value' => $collectionRate,
                ];

                $trends['portfolioGrowth'][] = [
                    'month' => $shortLabel,
                    'fullMonth' => $monthLabel,
                    'value' => $portfolioValue,
                ];

                $trends['delinquencyRate'][] = [
                    'month' => $shortLabel,
                    'fullMonth' => $monthLabel,
                    'value' => $delinquencyRate,
                ];

                $trends['leadsCount'][] = [
                    'month' => $shortLabel,
                    'fullMonth' => $monthLabel,
                    'value' => $leadsInMonth,
                ];
            }

            return $trends;
        } catch (\Exception $e) {
            return $this->getEmptyTrends();
        }
    }

    private function getDailyTrendData(int $days): array
    {
        try {
            $trends = [
                'conversionRate' => [],
                'disbursementVolume' => [],
                'collectionRate' => [],
                'portfolioGrowth' => [],
                'delinquencyRate' => [],
                'leadsCount' => [],
            ];

            $now = Carbon::now();

            for ($i = $days - 1; $i >= 0; $i--) {
                $dayStart = $now->copy()->subDays($i)->startOfDay();
                $dayEnd = $now->copy()->subDays($i)->endOfDay();
                $dayLabel = $dayStart->format('d M');
                $shortLabel = $dayStart->locale('es')->isoFormat('dd');

                // Leads and conversion
                $leadsInDay = Lead::whereBetween('created_at', [$dayStart, $dayEnd])->count();
                $clientsInDay = Client::whereBetween('created_at', [$dayStart, $dayEnd])->count();
                $conversionRate = $leadsInDay > 0 ? round(($clientsInDay / $leadsInDay) * 100, 1) : 0;

                // Disbursement volume
                $disbursement = Credit::whereBetween('created_at', [$dayStart, $dayEnd])
                    ->sum('monto_credito') ?? 0;

                // Collection rate
                $expectedPayments = PlanDePago::whereBetween('fecha_corte', [$dayStart, $dayEnd])
                    ->sum('cuota') ?? 0;
                $actualPayments = CreditPayment::whereBetween('fecha_pago', [$dayStart, $dayEnd])
                    ->sum('monto') ?? 0;
                $collectionRate = $expectedPayments > 0
                    ? round(($actualPayments / $expectedPayments) * 100, 1)
                    : 0;

                // Portfolio value at end of day
                $portfolioValue = Credit::where('status', 'Activo')
                    ->where('created_at', '<=', $dayEnd)
                    ->sum('saldo') ?? 0;

                // Delinquency rate
                $totalAccounts = Credit::where('status', 'Activo')
                    ->where('created_at', '<=', $dayEnd)
                    ->count() ?: 1;
                $overdueAccounts = Credit::where('status', 'Activo')
                    ->where('created_at', '<=', $dayEnd)
                    ->where('cuotas_atrasadas', '>', 0)
                    ->count();
                $delinquencyRate = round(($overdueAccounts / $totalAccounts) * 100, 1);

                $trends['conversionRate'][] = [
                    'month' => $shortLabel,
                    'fullMonth' => $dayLabel,
                    'value' => $conversionRate,
                ];

                $trends['disbursementVolume'][] = [
                    'month' => $shortLabel,
                    'fullMonth' => $dayLabel,
                    'value' => $disbursement,
                ];

                $trends['collectionRate'][] = [
                    'month' => $shortLabel,
                    'fullMonth' => $dayLabel,
                    'value' => $collectionRate,
                ];

                $trends['portfolioGrowth'][] = [
                    'month' => $shortLabel,
                    'fullMonth' => $dayLabel,
                    'value' => $portfolioValue,
                ];

                $trends['delinquencyRate'][] = [
                    'month' => $shortLabel,
                    'fullMonth' => $dayLabel,
                    'value' => $delinquencyRate,
                ];

                $trends['leadsCount'][] = [
                    'month' => $shortLabel,
                    'fullMonth' => $dayLabel,
                    'value' => $leadsInDay,
                ];
            }

            return $trends;
        } catch (\Exception $e) {
            return $this->getEmptyTrends();
        }
    }

    private function getWeeklyTrendData(int $weeks): array
    {
        try {
            $trends = [
                'conversionRate' => [],
                'disbursementVolume' => [],
                'collectionRate' => [],
                'portfolioGrowth' => [],
                'delinquencyRate' => [],
                'leadsCount' => [],
            ];

            $now = Carbon::now();

            for ($i = $weeks - 1; $i >= 0; $i--) {
                $weekStart = $now->copy()->subWeeks($i)->startOfWeek();
                $weekEnd = $now->copy()->subWeeks($i)->endOfWeek();
                $weekLabel = 'Sem ' . $weekStart->weekOfYear;
                $fullLabel = $weekStart->format('d M') . ' - ' . $weekEnd->format('d M');

                // Leads and conversion
                $leadsInWeek = Lead::whereBetween('created_at', [$weekStart, $weekEnd])->count();
                $clientsInWeek = Client::whereBetween('created_at', [$weekStart, $weekEnd])->count();
                $conversionRate = $leadsInWeek > 0 ? round(($clientsInWeek / $leadsInWeek) * 100, 1) : 0;

                // Disbursement volume
                $disbursement = Credit::whereBetween('created_at', [$weekStart, $weekEnd])
                    ->sum('monto_credito') ?? 0;

                // Collection rate
                $expectedPayments = PlanDePago::whereBetween('fecha_corte', [$weekStart, $weekEnd])
                    ->sum('cuota') ?? 0;
                $actualPayments = CreditPayment::whereBetween('fecha_pago', [$weekStart, $weekEnd])
                    ->sum('monto') ?? 0;
                $collectionRate = $expectedPayments > 0
                    ? round(($actualPayments / $expectedPayments) * 100, 1)
                    : 0;

                // Portfolio value at end of week
                $portfolioValue = Credit::where('status', 'Activo')
                    ->where('created_at', '<=', $weekEnd)
                    ->sum('saldo') ?? 0;

                // Delinquency rate
                $totalAccounts = Credit::where('status', 'Activo')
                    ->where('created_at', '<=', $weekEnd)
                    ->count() ?: 1;
                $overdueAccounts = Credit::where('status', 'Activo')
                    ->where('created_at', '<=', $weekEnd)
                    ->where('cuotas_atrasadas', '>', 0)
                    ->count();
                $delinquencyRate = round(($overdueAccounts / $totalAccounts) * 100, 1);

                $trends['conversionRate'][] = [
                    'month' => $weekLabel,
                    'fullMonth' => $fullLabel,
                    'value' => $conversionRate,
                ];

                $trends['disbursementVolume'][] = [
                    'month' => $weekLabel,
                    'fullMonth' => $fullLabel,
                    'value' => $disbursement,
                ];

                $trends['collectionRate'][] = [
                    'month' => $weekLabel,
                    'fullMonth' => $fullLabel,
                    'value' => $collectionRate,
                ];

                $trends['portfolioGrowth'][] = [
                    'month' => $weekLabel,
                    'fullMonth' => $fullLabel,
                    'value' => $portfolioValue,
                ];

                $trends['delinquencyRate'][] = [
                    'month' => $weekLabel,
                    'fullMonth' => $fullLabel,
                    'value' => $delinquencyRate,
                ];

                $trends['leadsCount'][] = [
                    'month' => $weekLabel,
                    'fullMonth' => $fullLabel,
                    'value' => $leadsInWeek,
                ];
            }

            return $trends;
        } catch (\Exception $e) {
            return $this->getEmptyTrends();
        }
    }

    private function getEmptyTrends(): array
    {
        return [
            'conversionRate' => [],
            'disbursementVolume' => [],
            'collectionRate' => [],
            'portfolioGrowth' => [],
            'delinquencyRate' => [],
            'leadsCount' => [],
        ];
    }

    // =========================================================
    // VENTAS KPIs
    // =========================================================

    /**
     * KPIs propios del vendedor autenticado (o de un userId específico si admin).
     * GET /api/kpis/ventas?anio=2026&mes=4
     */
    public function ventas(Request $request)
    {
        $user    = $request->user();
        $anio    = (int) $request->input('anio', date('Y'));
        $mes     = (int) $request->input('mes', date('n'));

        // Admin puede ver un vendedor específico
        $userId = ($user->role?->full_access && $request->has('user_id'))
            ? (int) $request->input('user_id')
            : $user->id;

        return response()->json($this->getVentasKpisForUser($userId, $anio, $mes));
    }

    /**
     * KPIs de todo el equipo de ventas — solo admin.
     * GET /api/kpis/ventas/equipo?anio=2026&mes=4
     */
    public function ventasEquipo(Request $request)
    {
        $anio = (int) $request->input('anio', date('Y'));
        $mes  = (int) $request->input('mes', date('n'));

        // Obtener todos los vendedores con meta activa en el período
        $vendedores = DB::table('metas_venta as mv')
            ->join('users as u', 'u.id', '=', 'mv.user_id')
            ->where('mv.anio', $anio)
            ->where('mv.mes', $mes)
            ->where('mv.activo', true)
            ->select('u.id', 'u.name')
            ->get();

        $equipo = $vendedores->map(fn ($v) => array_merge(
            ['user_id' => $v->id, 'name' => $v->name],
            $this->getVentasKpisForUser($v->id, $anio, $mes)
        ))->values()->toArray();

        // Totales agregados del equipo
        $inicio = Carbon::create($anio, $mes, 1)->startOfDay();
        $fin    = Carbon::create($anio, $mes, 1)->endOfMonth()->endOfDay();

        $totalCreditos = DB::table('credits')
            ->whereIn('user_id', $vendedores->pluck('id'))
            ->where('status', 'Formalizado')
            ->whereBetween('fecha_formalizacion', [$inicio, $fin])
            ->count();

        $totalMonto = (float) DB::table('credits')
            ->whereIn('user_id', $vendedores->pluck('id'))
            ->where('status', 'Formalizado')
            ->whereBetween('fecha_formalizacion', [$inicio, $fin])
            ->sum('monto_credito');

        $totalComisiones = (float) DB::table('comisiones')
            ->whereIn('user_id', $vendedores->pluck('id'))
            ->whereBetween('created_at', [$inicio, $fin])
            ->sum('monto');

        return response()->json([
            'equipo'           => $equipo,
            'total_vendedores' => $vendedores->count(),
            'total_creditos'   => $totalCreditos,
            'total_monto'      => $totalMonto,
            'total_comisiones' => $totalComisiones,
            'anio'             => $anio,
            'mes'              => $mes,
        ]);
    }

    /**
     * Tendencias históricas de ventas del vendedor (últimos 6 meses).
     * GET /api/kpis/ventas/tendencias
     */
    public function ventasTendencias(Request $request)
    {
        $user   = $request->user();
        $userId = ($user->role?->full_access && $request->has('user_id'))
            ? (int) $request->input('user_id')
            : $user->id;

        $meses = [];
        for ($i = 5; $i >= 0; $i--) {
            $fecha  = Carbon::now()->subMonths($i);
            $anio   = (int) $fecha->year;
            $mes    = (int) $fecha->month;
            $inicio = $fecha->copy()->startOfMonth();
            $fin    = $fecha->copy()->endOfMonth();

            // Créditos formalizados
            $creditos = DB::table('credits')
                ->where('user_id', $userId)
                ->where('status', 'Formalizado')
                ->whereBetween('fecha_formalizacion', [$inicio, $fin])
                ->select('id', 'monto_credito')
                ->get();

            $creditosCount = $creditos->count();
            $monto         = (float) $creditos->sum('monto_credito');

            // Meta del mes
            $meta = DB::table('metas_venta')
                ->where('user_id', $userId)
                ->where('anio', $anio)
                ->where('mes', $mes)
                ->first();

            $metaCantidad = $meta?->meta_creditos_cantidad ?? 0;
            $alcance      = $metaCantidad > 0
                ? round(($creditosCount / $metaCantidad) * 100, 1)
                : null;

            // Comisiones del mes
            $comision = (float) DB::table('comisiones')
                ->where('user_id', $userId)
                ->whereBetween('created_at', [$inicio, $fin])
                ->sum('monto');

            // Oportunidades (para tasa de cierre)
            $oportunidades = DB::table('opportunities')
                ->where('user_id', $userId)
                ->whereBetween('created_at', [$inicio, $fin])
                ->count();

            $tasaCierre = $oportunidades > 0
                ? round(($creditosCount / $oportunidades) * 100, 1)
                : null;

            $meses[] = [
                'anio'          => $anio,
                'mes'           => $mes,
                'label'         => $fecha->locale('es')->isoFormat('MMM YY'),
                'creditos'      => $creditosCount,
                'monto'         => $monto,
                'meta_cantidad' => $metaCantidad,
                'alcance_pct'   => $alcance,
                'comision'      => $comision,
                'tasa_cierre'   => $tasaCierre,
            ];
        }

        // Comparativa mes actual vs anterior
        $actual   = $meses[5];
        $anterior = $meses[4];
        $delta_creditos = $anterior['creditos'] > 0
            ? round((($actual['creditos'] - $anterior['creditos']) / $anterior['creditos']) * 100, 1)
            : null;
        $delta_monto = $anterior['monto'] > 0
            ? round((($actual['monto'] - $anterior['monto']) / $anterior['monto']) * 100, 1)
            : null;

        // Proyección: ritmo diario actual extrapolado al fin de mes
        $diasTranscurridos = max((int) Carbon::now()->day, 1);
        $diasMes           = (int) Carbon::now()->daysInMonth;
        $ritmo             = $actual['creditos'] / $diasTranscurridos;
        $proyeccion        = (int) round($ritmo * $diasMes);

        return response()->json([
            'historico'   => $meses,
            'comparativa' => [
                'mes_actual'      => $actual,
                'mes_anterior'    => $anterior,
                'delta_creditos'  => $delta_creditos,
                'delta_monto'     => $delta_monto,
            ],
            'proyeccion'  => [
                'creditos_proyectados' => $proyeccion,
                'meta_cantidad'        => $actual['meta_cantidad'],
                'alcanzara_meta'       => $actual['meta_cantidad'] > 0 && $proyeccion >= $actual['meta_cantidad'],
                'dias_transcurridos'   => $diasTranscurridos,
                'dias_mes'             => $diasMes,
            ],
        ]);
    }

    private function getVentasKpisForUser(int $userId, int $anio, int $mes): array
    {
        $inicio = Carbon::create($anio, $mes, 1)->startOfDay();
        $fin    = Carbon::create($anio, $mes, 1)->endOfMonth()->endOfDay();

        // --- Meta del mes ---
        $meta = DB::table('metas_venta')
            ->where('user_id', $userId)
            ->where('anio', $anio)
            ->where('mes', $mes)
            ->first();

        // --- Créditos formalizados en el período ---
        $creditos = DB::table('credits')
            ->where('user_id', $userId)
            ->where('status', 'Formalizado')
            ->whereBetween('fecha_formalizacion', [$inicio, $fin])
            ->select('id', 'monto_credito', 'fecha_formalizacion')
            ->get();

        $creditosCount   = $creditos->count();
        $montoColocado   = (float) $creditos->sum('monto_credito');
        $ticketPromedio  = $creditosCount > 0 ? $montoColocado / $creditosCount : 0.0;

        // --- Tasa de cierre: créditos formalizados / oportunidades en el período ---
        $oportunidades = DB::table('opportunities')
            ->where('user_id', $userId)
            ->whereBetween('created_at', [$inicio, $fin])
            ->count();
        $tasaCierre = $oportunidades > 0 ? round(($creditosCount / $oportunidades) * 100, 1) : null;

        // --- Alcance de meta ---
        $metaCantidad = $meta?->meta_creditos_cantidad ?? 0;
        $alcancePct   = $metaCantidad > 0 ? round(($creditosCount / $metaCantidad) * 100, 1) : 0.0;

        // --- Tier activo ---
        $tierActivo = null;
        if ($meta) {
            $tierActivo = DB::table('meta_bonus_tiers')
                ->where('meta_venta_id', $meta->id)
                ->where('creditos_minimos', '<=', $creditosCount)
                ->orderByDesc('creditos_minimos')
                ->first();
        }

        // --- Comisiones del mes ---
        $comisiones = DB::table('comisiones')
            ->where('user_id', $userId)
            ->whereBetween('created_at', [$inicio, $fin])
            ->selectRaw('
                SUM(CASE WHEN status = "pendiente" THEN monto ELSE 0 END) as pendientes,
                SUM(CASE WHEN status = "aprobada"  THEN monto ELSE 0 END) as aprobadas,
                SUM(CASE WHEN status = "pagada"    THEN monto ELSE 0 END) as pagadas,
                SUM(monto) as total
            ')
            ->first();

        // --- Visitas planificadas vs realizadas ---
        $visitasPlanificadas = DB::table('visitas_ventas')
            ->where('user_id', $userId)
            ->whereBetween('fecha_planificada', [$inicio, $fin])
            ->count();

        $visitasRealizadas = DB::table('visitas_ventas')
            ->where('user_id', $userId)
            ->whereBetween('fecha_planificada', [$inicio, $fin])
            ->where('status', 'completada')
            ->count();

        $tasaVisitas = $visitasPlanificadas > 0
            ? round(($visitasRealizadas / $visitasPlanificadas) * 100, 1)
            : null;

        // --- Reward points (acumulados históricos) ---
        $rewardPoints = DB::table('reward_users')
            ->where('user_id', $userId)
            ->value('total_points') ?? 0;

        return [
            'anio'               => $anio,
            'mes'                => $mes,
            'meta' => $meta ? [
                'id'                => $meta->id,
                'creditos_objetivo' => (int) $meta->meta_creditos_cantidad,
                'monto_objetivo'    => (float) $meta->meta_creditos_monto,
            ] : null,
            'creditos_mes'       => $creditosCount,
            'monto_colocado'     => $montoColocado,
            'ticket_promedio'    => $ticketPromedio,
            'tasa_cierre'        => $tasaCierre,
            'alcance_pct'        => $alcancePct,
            'tier_activo' => $tierActivo ? [
                'nombre'     => $tierActivo->descripcion ?? 'Tier activo',
                'porcentaje' => (float) $tierActivo->porcentaje,
                'creditos_minimos' => (int) $tierActivo->creditos_minimos,
            ] : null,
            'comisiones' => [
                'pendientes' => (float) ($comisiones->pendientes ?? 0),
                'aprobadas'  => (float) ($comisiones->aprobadas  ?? 0),
                'pagadas'    => (float) ($comisiones->pagadas    ?? 0),
                'total'      => (float) ($comisiones->total      ?? 0),
            ],
            'visitas' => [
                'planificadas' => $visitasPlanificadas,
                'realizadas'   => $visitasRealizadas,
                'tasa'         => $tasaVisitas,
            ],
            'reward_points' => (int) $rewardPoints,
        ];
    }
}
