<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Lead;
use App\Models\Client;
use App\Models\Opportunity;
use App\Models\Analisis;
use App\Models\Credit;
use App\Models\CreditPayment;
use App\Models\SaldoPendiente;
use App\Models\PlanDePago;
use App\Models\Deductora;
use App\Models\User;
use App\Models\Task;
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
                    'stageConversion' => [],
                ],
                'credits' => [
                    'disbursementVolume' => ['value' => 0, 'change' => 0, 'unit' => '₡'],
                    'avgLoanSize' => ['value' => 0, 'change' => 0, 'unit' => '₡'],
                    'portfolioAtRisk' => ['value' => 0, 'change' => 0, 'target' => 5, 'unit' => '%'],
                    'nonPerformingLoans' => ['value' => 0, 'change' => 0],
                    'approvalRate' => ['value' => 0, 'change' => 0, 'target' => 75, 'unit' => '%'],
                    'timeToDisbursement' => ['value' => 0, 'change' => 0, 'unit' => 'días'],
                    'timeToFormalization' => ['value' => 0, 'change' => 0, 'unit' => 'días'],
                    'fullCycleTime' => ['value' => 0, 'change' => 0, 'unit' => 'días'],
                    'earlyCancellationRate' => ['value' => 0, 'change' => 0, 'unit' => '%', 'count' => 0],
                    'extraordinaryPayments' => ['value' => 0, 'change' => 0, 'unit' => '₡', 'count' => 0],
                    'penaltyRevenue' => ['value' => 0, 'change' => 0, 'unit' => '₡'],
                    'totalCredits' => 0,
                    'totalPortfolio' => 0,
                ],
                'collections' => [
                    'collectionRate' => ['value' => 0, 'change' => 0, 'target' => 98, 'unit' => '%'],
                    'dso' => ['value' => 0, 'change' => 0, 'unit' => 'días'],
                    'delinquencyRate' => ['value' => 0, 'change' => 0, 'target' => 5, 'unit' => '%'],
                    'recoveryRate' => ['value' => 0, 'change' => 0, 'unit' => '%'],
                    'paymentTimeliness' => ['value' => 0, 'change' => 0, 'target' => 95, 'unit' => '%'],
                    'reversalRate' => ['value' => 0, 'change' => 0, 'unit' => '%', 'count' => 0],
                    'pendingBalances' => ['value' => 0, 'change' => 0, 'unit' => '₡', 'count' => 0],
                    'paymentSourceDistribution' => [],
                    'deductoraEfficiency' => [],
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

            // Leads per agent in period
            $leadsPerAgent = collect([]);
            try {
                $leadsPerAgent = Lead::select('assigned_to_id', DB::raw('COUNT(*) as count'))
                    ->whereBetween('created_at', [$dateRange['start'], $dateRange['end']])
                    ->whereNotNull('assigned_to_id')
                    ->groupBy('assigned_to_id')
                    ->orderByDesc('count')
                    ->limit(10)
                    ->get()
                    ->map(function ($item) {
                        $agent = User::find($item->assigned_to_id);
                        return [
                            'agentName' => $agent->name ?? 'Sin asignar',
                            'count' => $item->count,
                        ];
                    });
            } catch (\Exception $e) {
                // Fallback to empty
            }

            // Lead source performance - query actual data if source field exists
            $leadSourcePerformance = collect([]);
            try {
                // Check if 'source' or 'lead_source' column exists
                $sourceColumn = \Schema::hasColumn('persons', 'source') ? 'source' :
                               (\Schema::hasColumn('persons', 'lead_source') ? 'lead_source' : null);

                if ($sourceColumn) {
                    $leadSourcePerformance = Lead::select($sourceColumn, DB::raw('COUNT(*) as count'))
                        ->whereBetween('created_at', [$dateRange['start'], $dateRange['end']])
                        ->whereNotNull($sourceColumn)
                        ->groupBy($sourceColumn)
                        ->get()
                        ->map(function ($item) use ($sourceColumn, $dateRange) {
                            $source = $item->$sourceColumn;
                            $leadsFromSource = $item->count;

                            // Calculate conversion for this source
                            $clientsFromSource = Client::whereBetween('created_at', [$dateRange['start'], $dateRange['end']])
                                ->where($sourceColumn, $source)
                                ->count();

                            $conversion = $leadsFromSource > 0
                                ? round(($clientsFromSource / $leadsFromSource) * 100, 0)
                                : 0;

                            return [
                                'source' => $source ?: 'Desconocido',
                                'count' => $leadsFromSource,
                                'conversion' => $conversion,
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
                'leadsPerAgent' => $leadsPerAgent,
                'leadSourcePerformance' => $leadSourcePerformance,
                'totalLeads' => $totalLeads,
                'totalClients' => $totalClients,
            ];
        } catch (\Exception $e) {
            return $this->getDefaultLeadKpis();
        }
    }

    private function getDefaultLeadKpis(): array
    {
        return [
            'conversionRate' => ['value' => 0, 'change' => 0, 'target' => 30, 'unit' => '%'],
            'responseTime' => ['value' => 0, 'change' => 0, 'unit' => 'hrs'],
            'leadAging' => ['value' => 0, 'change' => 0, 'unit' => 'leads'],
            'leadsPerAgent' => [],
            'leadSourcePerformance' => [],
            'totalLeads' => 0,
            'totalClients' => 0,
        ];
    }

    private function getOpportunityKpis(array $dateRange): array
    {
        // Actual statuses from the system: "Abierta", "En seguimiento", "Ganada", "Perdida"
        $wonStatuses = ['Ganada'];
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

            // Stage conversion - calculate from actual data based on real statuses
            $stageConversion = [];
            try {
                // Get count per status in period
                $statusCounts = Opportunity::whereBetween('created_at', [$dateRange['start'], $dateRange['end']])
                    ->select('status', DB::raw('COUNT(*) as count'))
                    ->groupBy('status')
                    ->pluck('count', 'status')
                    ->toArray();

                $totalInPeriod = array_sum($statusCounts);

                if ($totalInPeriod > 0) {
                    // Stage flow: Abierta -> En seguimiento -> Ganada/Perdida
                    $abiertaCount = $statusCounts['Abierta'] ?? 0;
                    $enSeguimientoCount = $statusCounts['En seguimiento'] ?? 0;
                    $ganadaCount = $statusCounts['Ganada'] ?? 0;
                    $perdidaCount = $statusCounts['Perdida'] ?? 0;

                    // Abierta -> En seguimiento (opportunities that moved past initial stage)
                    $movedPastAbierta = $enSeguimientoCount + $ganadaCount + $perdidaCount;
                    $abiertaConversion = ($abiertaCount + $movedPastAbierta) > 0
                        ? round(($movedPastAbierta / ($abiertaCount + $movedPastAbierta)) * 100, 0)
                        : 0;

                    // En seguimiento -> Ganada/Perdida
                    $closedFromSeguimiento = $ganadaCount + $perdidaCount;
                    $seguimientoConversion = ($enSeguimientoCount + $closedFromSeguimiento) > 0
                        ? round(($closedFromSeguimiento / ($enSeguimientoCount + $closedFromSeguimiento)) * 100, 0)
                        : 0;

                    // Ganada rate from closed
                    $ganadaConversion = ($ganadaCount + $perdidaCount) > 0
                        ? round(($ganadaCount / ($ganadaCount + $perdidaCount)) * 100, 0)
                        : 0;

                    $stageConversion = [
                        ['stage' => 'Abierta → En seguimiento', 'conversion' => min($abiertaConversion, 100)],
                        ['stage' => 'En seguimiento → Cierre', 'conversion' => min($seguimientoConversion, 100)],
                        ['stage' => 'Cierre → Ganada', 'conversion' => min($ganadaConversion, 100)],
                    ];
                }
            } catch (\Exception $e) {
                $stageConversion = [];
            }

            // Credit type comparison (Micro vs Regular vs Empresarial)
            $creditTypeComparison = [];
            try {
                $types = Opportunity::whereBetween('created_at', [$dateRange['start'], $dateRange['end']])
                    ->whereNotNull('opportunity_type')
                    ->select('opportunity_type')
                    ->distinct()
                    ->pluck('opportunity_type')
                    ->toArray();

                foreach ($types as $type) {
                    $typeTotal = Opportunity::whereBetween('created_at', [$dateRange['start'], $dateRange['end']])
                        ->where('opportunity_type', $type)
                        ->count();
                    $typeWon = Opportunity::whereBetween('updated_at', [$dateRange['start'], $dateRange['end']])
                        ->where('opportunity_type', $type)
                        ->where('status', 'Ganada')
                        ->count();
                    $typeLost = Opportunity::whereBetween('updated_at', [$dateRange['start'], $dateRange['end']])
                        ->where('opportunity_type', $type)
                        ->where('status', 'Perdida')
                        ->count();
                    $typePipeline = Opportunity::whereBetween('created_at', [$dateRange['start'], $dateRange['end']])
                        ->where('opportunity_type', $type)
                        ->whereIn('status', $openStatuses)
                        ->sum('amount') ?? 0;
                    $typeClosed = $typeWon + $typeLost;
                    $typeWinRate = $typeClosed > 0 ? round(($typeWon / $typeClosed) * 100, 1) : 0;

                    $creditTypeComparison[] = [
                        'type' => $type,
                        'total' => $typeTotal,
                        'won' => $typeWon,
                        'lost' => $typeLost,
                        'winRate' => $typeWinRate,
                        'pipeline' => round((float) $typePipeline, 2),
                    ];
                }

                // Sort by total descending
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
                'stageConversion' => $stageConversion,
                'creditTypeComparison' => $creditTypeComparison,
            ];
        } catch (\Exception $e) {
            return [
                'winRate' => ['value' => 0, 'change' => 0, 'target' => 40, 'unit' => '%'],
                'pipelineValue' => ['value' => 0, 'change' => 0, 'unit' => '₡'],
                'avgSalesCycle' => ['value' => 0, 'change' => 0, 'unit' => 'días'],
                'velocity' => ['value' => 0, 'change' => 0],
                'stageConversion' => [],
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

            // Approval rate - validates full flow: Oportunidad(Ganada) → Análisis → Crédito(Formalizado+)
            $approvalRate = 0;
            $prevApprovalRate = 0;
            try {
                // Won opportunities that have an análisis AND a formalized/active/closed credit
                $wonOpportunities = Opportunity::whereBetween('updated_at', [$dateRange['start'], $dateRange['end']])
                    ->where('status', 'Ganada')
                    ->count();

                $completedCredits = Credit::whereBetween('credits.created_at', [$dateRange['start'], $dateRange['end']])
                    ->whereIn('credits.status', ['Formalizado', 'Activo', 'En Mora', 'Cerrado'])
                    ->whereHas('opportunity', fn($q) => $q->where('status', 'Ganada'))
                    ->whereExists(function ($query) {
                        $query->select(DB::raw(1))
                            ->from('analisis')
                            ->whereColumn('analisis.opportunity_id', 'credits.opportunity_id');
                    })
                    ->count();

                $approvalRate = $wonOpportunities > 0
                    ? min(round(($completedCredits / $wonOpportunities) * 100, 1), 100)
                    : 0;

                // Previous period
                $prevWonOpportunities = Opportunity::whereBetween('updated_at', [$dateRange['prev_start'], $dateRange['prev_end']])
                    ->where('status', 'Ganada')
                    ->count();

                $prevCompletedCredits = Credit::whereBetween('credits.created_at', [$dateRange['prev_start'], $dateRange['prev_end']])
                    ->whereIn('credits.status', ['Formalizado', 'Activo', 'En Mora', 'Cerrado'])
                    ->whereHas('opportunity', fn($q) => $q->where('status', 'Ganada'))
                    ->whereExists(function ($query) {
                        $query->select(DB::raw(1))
                            ->from('analisis')
                            ->whereColumn('analisis.opportunity_id', 'credits.opportunity_id');
                    })
                    ->count();

                $prevApprovalRate = $prevWonOpportunities > 0
                    ? min(round(($prevCompletedCredits / $prevWonOpportunities) * 100, 1), 100)
                    : 0;
            } catch (\Exception $e) {
                // Fallback
            }

            // Time to disbursement - calculate from opportunity to credit creation
            $timeToDisbursement = 0;
            $prevTimeToDisbursement = 0;
            try {
                // Get credits with their linked opportunities and calculate average days
                $avgDays = Credit::whereBetween('credits.created_at', [$dateRange['start'], $dateRange['end']])
                    ->join('opportunities', 'credits.opportunity_id', '=', 'opportunities.id')
                    ->selectRaw('AVG(DATEDIFF(credits.created_at, opportunities.created_at)) as avg_days')
                    ->value('avg_days');
                $timeToDisbursement = $avgDays ? round($avgDays, 1) : 0;

                $prevAvgDays = Credit::whereBetween('credits.created_at', [$dateRange['prev_start'], $dateRange['prev_end']])
                    ->join('opportunities', 'credits.opportunity_id', '=', 'opportunities.id')
                    ->selectRaw('AVG(DATEDIFF(credits.created_at, opportunities.created_at)) as avg_days')
                    ->value('avg_days');
                $prevTimeToDisbursement = $prevAvgDays ? round($prevAvgDays, 1) : 0;
            } catch (\Exception $e) {
                // Fallback - may not have opportunity_id relationship
            }

            // Time from credit creation to formalization
            $timeToFormalization = 0;
            $prevTimeToFormalization = 0;
            try {
                $avgFormDays = Credit::whereBetween('formalized_at', [$dateRange['start'], $dateRange['end']])
                    ->whereNotNull('formalized_at')
                    ->selectRaw('AVG(DATEDIFF(formalized_at, created_at)) as avg_days')
                    ->value('avg_days');
                $timeToFormalization = $avgFormDays ? round($avgFormDays, 1) : 0;

                $prevAvgFormDays = Credit::whereBetween('formalized_at', [$dateRange['prev_start'], $dateRange['prev_end']])
                    ->whereNotNull('formalized_at')
                    ->selectRaw('AVG(DATEDIFF(formalized_at, created_at)) as avg_days')
                    ->value('avg_days');
                $prevTimeToFormalization = $prevAvgFormDays ? round($prevAvgFormDays, 1) : 0;
            } catch (\Exception $e) {
                // Fallback
            }

            // Full cycle: opportunity creation to credit formalization
            $fullCycleTime = 0;
            $prevFullCycleTime = 0;
            try {
                $avgCycleDays = Credit::whereBetween('credits.formalized_at', [$dateRange['start'], $dateRange['end']])
                    ->whereNotNull('credits.formalized_at')
                    ->join('opportunities', 'credits.opportunity_id', '=', 'opportunities.id')
                    ->selectRaw('AVG(DATEDIFF(credits.formalized_at, opportunities.created_at)) as avg_days')
                    ->value('avg_days');
                $fullCycleTime = $avgCycleDays ? round($avgCycleDays, 1) : 0;

                $prevAvgCycleDays = Credit::whereBetween('credits.formalized_at', [$dateRange['prev_start'], $dateRange['prev_end']])
                    ->whereNotNull('credits.formalized_at')
                    ->join('opportunities', 'credits.opportunity_id', '=', 'opportunities.id')
                    ->selectRaw('AVG(DATEDIFF(credits.formalized_at, opportunities.created_at)) as avg_days')
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

            // Penalty revenue - from early cancellation snapshots
            $penaltyRevenue = 0;
            $prevPenaltyRevenue = 0;
            try {
                $penaltyPayments = CreditPayment::whereBetween('fecha_pago', [$dateRange['start'], $dateRange['end']])
                    ->where('source', 'Cancelación Anticipada')
                    ->where('estado_reverso', 'Vigente')
                    ->whereNotNull('reversal_snapshot')
                    ->get(['reversal_snapshot']);
                foreach ($penaltyPayments as $payment) {
                    $snapshot = is_array($payment->reversal_snapshot) ? $payment->reversal_snapshot : json_decode($payment->reversal_snapshot, true);
                    $penaltyRevenue += (float)($snapshot['penalizacion'] ?? 0);
                }

                $prevPenaltyPayments = CreditPayment::whereBetween('fecha_pago', [$dateRange['prev_start'], $dateRange['prev_end']])
                    ->where('source', 'Cancelación Anticipada')
                    ->where('estado_reverso', 'Vigente')
                    ->whereNotNull('reversal_snapshot')
                    ->get(['reversal_snapshot']);
                foreach ($prevPenaltyPayments as $payment) {
                    $snapshot = is_array($payment->reversal_snapshot) ? $payment->reversal_snapshot : json_decode($payment->reversal_snapshot, true);
                    $prevPenaltyRevenue += (float)($snapshot['penalizacion'] ?? 0);
                }
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
                'timeToFormalization' => [
                    'value' => $timeToFormalization,
                    'change' => $prevTimeToFormalization > 0 ? $this->calculateChange((float)$timeToFormalization, (float)$prevTimeToFormalization) : 0,
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
                'penaltyRevenue' => [
                    'value' => round($penaltyRevenue, 0),
                    'change' => $this->calculateChange((float)$penaltyRevenue, (float)$prevPenaltyRevenue),
                    'unit' => '₡',
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
                'timeToFormalization' => ['value' => 0, 'change' => 0, 'unit' => 'días'],
                'fullCycleTime' => ['value' => 0, 'change' => 0, 'unit' => 'días'],
                'earlyCancellationRate' => ['value' => 0, 'change' => 0, 'unit' => '%', 'count' => 0],
                'extraordinaryPayments' => ['value' => 0, 'change' => 0, 'unit' => '₡', 'count' => 0],
                'penaltyRevenue' => ['value' => 0, 'change' => 0, 'unit' => '₡'],
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

            // DSO (Days Sales Outstanding) - calculate from actual payment data
            $dso = 0;
            $prevDso = 0;
            try {
                // Calculate average days between due date and payment date
                $avgDso = CreditPayment::whereBetween('fecha_pago', [$dateRange['start'], $dateRange['end']])
                    ->join('plan_de_pagos', 'credit_payments.plan_de_pago_id', '=', 'plan_de_pagos.id')
                    ->selectRaw('AVG(DATEDIFF(credit_payments.fecha_pago, plan_de_pagos.fecha_corte)) as avg_days')
                    ->value('avg_days');
                $dso = $avgDso ? round($avgDso, 0) : 0;

                $prevAvgDso = CreditPayment::whereBetween('fecha_pago', [$dateRange['prev_start'], $dateRange['prev_end']])
                    ->join('plan_de_pagos', 'credit_payments.plan_de_pago_id', '=', 'plan_de_pagos.id')
                    ->selectRaw('AVG(DATEDIFF(credit_payments.fecha_pago, plan_de_pagos.fecha_corte)) as avg_days')
                    ->value('avg_days');
                $prevDso = $prevAvgDso ? round($prevAvgDso, 0) : 0;
            } catch (\Exception $e) {
                // Fallback - may not have the relationship
            }

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

            // Deductora efficiency - calculate from actual payment data
            $deductoraEfficiency = collect([]);
            try {
                $deductoraEfficiency = Deductora::select('deductoras.id', 'deductoras.nombre')
                    ->join('credits', 'credits.deductora_id', '=', 'deductoras.id')
                    ->whereBetween('credits.created_at', [$dateRange['start'], $dateRange['end']])
                    ->groupBy('deductoras.id', 'deductoras.nombre')
                    ->limit(10)
                    ->get()
                    ->map(function ($deductora) use ($dateRange) {
                        // Get credits for this deductora in period
                        $creditIds = Credit::where('deductora_id', $deductora->id)
                            ->whereBetween('created_at', [$dateRange['start'], $dateRange['end']])
                            ->pluck('id');

                        // Expected payments
                        $expected = PlanDePago::whereIn('credit_id', $creditIds)
                            ->whereBetween('fecha_corte', [$dateRange['start'], $dateRange['end']])
                            ->sum('cuota') ?? 0;

                        // Actual payments
                        $received = CreditPayment::whereIn('credit_id', $creditIds)
                            ->whereBetween('fecha_pago', [$dateRange['start'], $dateRange['end']])
                            ->sum('monto') ?? 0;

                        $rate = $expected > 0 ? round(($received / $expected) * 100, 0) : 0;

                        return [
                            'name' => $deductora->nombre ?? 'Sin nombre',
                            'rate' => min($rate, 100),
                        ];
                    })
                    ->filter(fn($d) => $d['rate'] > 0)
                    ->sortByDesc('rate')
                    ->values();
            } catch (\Exception $e) {
                // Fallback to empty
            }

            return [
                'collectionRate' => [
                    'value' => $collectionRate,
                    'change' => $this->calculateChange((float)$collectionRate, (float)$prevCollectionRate),
                    'target' => 98,
                    'unit' => '%',
                ],
                'dso' => [
                    'value' => $dso,
                    'change' => $prevDso > 0 ? $this->calculateChange((float)$dso, (float)$prevDso) : 0,
                    'unit' => 'días',
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
                'deductoraEfficiency' => $deductoraEfficiency,
            ];
        } catch (\Exception $e) {
            return [
                'collectionRate' => ['value' => 0, 'change' => 0, 'target' => 98, 'unit' => '%'],
                'dso' => ['value' => 0, 'change' => 0, 'unit' => 'días'],
                'delinquencyRate' => ['value' => 0, 'change' => 0, 'target' => 5, 'unit' => '%'],
                'recoveryRate' => ['value' => 0, 'change' => 0, 'unit' => '%'],
                'paymentTimeliness' => ['value' => 0, 'change' => 0, 'target' => 95, 'unit' => '%'],
                'reversalRate' => ['value' => 0, 'change' => 0, 'unit' => '%', 'count' => 0],
                'pendingBalances' => ['value' => 0, 'change' => 0, 'unit' => '₡', 'count' => 0],
                'paymentSourceDistribution' => [],
                'deductoraEfficiency' => [],
            ];
        }
    }

    private function getAgentKpis(array $dateRange): array
    {
        try {
            $topAgents = User::select('users.id', 'users.name')
                ->limit(10)
                ->get()
                ->map(function ($agent) use ($dateRange) {
                    $leadsHandled = Lead::where('assigned_to_id', $agent->id)->count();
                    $creditsOriginated = Credit::where('assigned_to', $agent->id)->count();
                    $avgDealSize = Credit::where('assigned_to', $agent->id)->avg('monto_credito') ?? 0;

                    $conversionRate = $leadsHandled > 0
                        ? round(($creditsOriginated / $leadsHandled) * 100, 0)
                        : 0;

                    // Activity rate: actions per working day
                    $daysInPeriod = max($dateRange['start']->diffInWeekdays($dateRange['end']), 1);
                    $leadsInPeriod = Lead::where('assigned_to_id', $agent->id)
                        ->whereBetween('created_at', [$dateRange['start'], $dateRange['end']])
                        ->count();
                    $creditsInPeriod = Credit::where('assigned_to', $agent->id)
                        ->whereBetween('created_at', [$dateRange['start'], $dateRange['end']])
                        ->count();
                    $activityRate = round(($leadsInPeriod + $creditsInPeriod) / $daysInPeriod, 1);

                    // Task metrics
                    $tasksAssigned = Task::where('assigned_to', $agent->id)
                        ->whereNotIn('status', ['deleted'])
                        ->count();
                    $tasksCompleted = Task::where('assigned_to', $agent->id)
                        ->where('status', 'completada')
                        ->count();
                    $taskCompletionRate = $tasksAssigned > 0
                        ? round(($tasksCompleted / $tasksAssigned) * 100, 0)
                        : 0;

                    return [
                        'name' => $agent->name,
                        'leadsHandled' => $leadsHandled,
                        'conversionRate' => min($conversionRate, 100),
                        'creditsOriginated' => $creditsOriginated,
                        'avgDealSize' => round($avgDealSize, 0),
                        'activityRate' => $activityRate,
                        'tasksAssigned' => $tasksAssigned,
                        'tasksCompleted' => $tasksCompleted,
                        'taskCompletionRate' => $taskCompletionRate,
                    ];
                })
                ->filter(function ($agent) {
                    return $agent['leadsHandled'] > 0;
                })
                ->sortByDesc('leadsHandled')
                ->values();

            return [
                'topAgents' => $topAgents,
            ];
        } catch (\Exception $e) {
            return [
                'topAgents' => [],
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

            // NPS - we don't have survey data, so set to 0 (not available)
            // In a real implementation, this would come from a surveys/feedback table
            $nps = 0;
            $prevNps = 0;

            // Revenue per employee - based on portfolio in period
            $employeeCount = User::count() ?: 1;
            $revenuePerEmployee = round($currentPortfolio / $employeeCount, 0);
            $prevRevenuePerEmployee = round($prevPortfolio / $employeeCount, 0);

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
            ];
        } catch (\Exception $e) {
            return [
                'clv' => ['value' => 0, 'change' => 0, 'unit' => '₡'],
                'cac' => ['value' => 0, 'change' => 0, 'unit' => '₡'],
                'portfolioGrowth' => ['value' => 0, 'change' => 0, 'target' => 20, 'unit' => '%'],
                'nps' => ['value' => 0, 'change' => 0, 'unit' => ''],
                'revenuePerEmployee' => ['value' => 0, 'change' => 0, 'unit' => '₡'],
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
}
