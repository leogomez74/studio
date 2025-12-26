"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Users,
  Target,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  PieChart,
  Activity,
  Briefcase,
  CreditCard,
  Wallet,
  UserCheck,
  Award,
  Gamepad2,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  Timer,
  Percent,
  Star,
  Zap,
  Trophy,
  Medal,
  Flame,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/axios";

// ============ TYPES ============
interface KPIData {
  value: number | string;
  change?: number;
  target?: number;
  unit?: string;
}

interface LeadKPIs {
  conversionRate: KPIData;
  responseTime: KPIData;
  leadAging: KPIData;
  leadsPerAgent: { agentName: string; count: number }[];
  leadSourcePerformance: { source: string; conversion: number; count: number }[];
  totalLeads?: number;
  totalClients?: number;
}

interface OpportunityKPIs {
  winRate: KPIData;
  pipelineValue: KPIData;
  avgSalesCycle: KPIData;
  velocity: KPIData;
  stageConversion: { stage: string; conversion: number }[];
}

interface CreditKPIs {
  disbursementVolume: KPIData;
  avgLoanSize: KPIData;
  portfolioAtRisk: KPIData;
  nonPerformingLoans: KPIData;
  approvalRate: KPIData;
  timeToDisbursement: KPIData;
  totalCredits?: number;
  totalPortfolio?: number;
}

interface CollectionKPIs {
  collectionRate: KPIData;
  dso: KPIData;
  delinquencyRate: KPIData;
  recoveryRate: KPIData;
  paymentTimeliness: KPIData;
  deductoraEfficiency: { name: string; rate: number }[];
}

interface AgentKPIs {
  topAgents: {
    name: string;
    leadsHandled: number;
    conversionRate: number;
    creditsOriginated: number;
    avgDealSize: number;
  }[];
}

interface GamificationKPIs {
  engagementRate: KPIData;
  pointsVelocity: KPIData;
  badgeCompletion: KPIData;
  challengeParticipation: KPIData;
  redemptionRate: KPIData;
  streakRetention: KPIData;
  levelDistribution: { level: number; count: number }[];
}

interface BusinessHealthKPIs {
  clv: KPIData;
  cac: KPIData;
  portfolioGrowth: KPIData;
}

interface AllKPIs {
  leads: LeadKPIs;
  opportunities: OpportunityKPIs;
  credits: CreditKPIs;
  collections: CollectionKPIs;
  agents: AgentKPIs;
  gamification: GamificationKPIs;
  business: BusinessHealthKPIs;
}

// ============ COMPONENTS ============
function StatCard({
  title,
  value,
  change,
  icon: Icon,
  description,
  unit,
  target,
  isLoading,
  colorClass,
}: {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ElementType;
  description?: string;
  unit?: string;
  target?: number;
  isLoading?: boolean;
  colorClass?: string;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-3 w-32 mt-2" />
        </CardContent>
      </Card>
    );
  }

  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className={cn("h-4 w-4", colorClass || "text-muted-foreground")} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {value}
          {unit && <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>}
        </div>
        {change !== undefined && (
          <div className={cn(
            "flex items-center text-xs mt-1",
            isPositive && "text-green-500",
            isNegative && "text-red-500",
            !isPositive && !isNegative && "text-muted-foreground"
          )}>
            {isPositive ? (
              <ArrowUpRight className="h-3 w-3 mr-1" />
            ) : isNegative ? (
              <ArrowDownRight className="h-3 w-3 mr-1" />
            ) : null}
            {Math.abs(change)}% vs período anterior
          </div>
        )}
        {target !== undefined && (
          <div className="mt-2">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Meta: {target}{unit}</span>
              <span>{typeof value === 'number' ? Math.round((value / target) * 100) : 0}%</span>
            </div>
            <Progress value={typeof value === 'number' ? Math.min((value / target) * 100, 100) : 0} className="h-1.5" />
          </div>
        )}
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function KPITable({
  title,
  description,
  icon: Icon,
  headers,
  rows,
  isLoading,
}: {
  title: string;
  description?: string;
  icon: React.ElementType;
  headers: string[];
  rows: (string | number | React.ReactNode)[][];
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64 mt-1" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-5 w-5" />
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                {headers.map((header, i) => (
                  <th key={i} className="text-left py-2 px-2 font-medium text-muted-foreground">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((row, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/50">
                    {row.map((cell, j) => (
                      <td key={j} className="py-2 px-2">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={headers.length} className="py-4 text-center text-muted-foreground">
                    No hay datos disponibles
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function StageConversionFunnel({
  stages,
  isLoading,
}: {
  stages: { stage: string; conversion: number }[];
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PieChart className="h-5 w-5" />
          Conversión por Etapa
        </CardTitle>
        <CardDescription>Tasa de conversión entre etapas del pipeline</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {stages.map((stage, index) => (
            <div key={stage.stage} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{stage.stage}</span>
                <span className={cn(
                  "font-bold",
                  stage.conversion >= 70 ? "text-green-500" :
                  stage.conversion >= 40 ? "text-amber-500" : "text-red-500"
                )}>
                  {stage.conversion}%
                </span>
              </div>
              <Progress
                value={stage.conversion}
                className={cn(
                  "h-2",
                  stage.conversion >= 70 ? "[&>div]:bg-green-500" :
                  stage.conversion >= 40 ? "[&>div]:bg-amber-500" : "[&>div]:bg-red-500"
                )}
              />
              {index < stages.length - 1 && (
                <div className="flex justify-center">
                  <ArrowDownRight className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function LevelDistributionChart({
  levels,
  isLoading,
}: {
  levels: { level: number; count: number }[];
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  const maxCount = Math.max(...levels.map(l => l.count), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Distribución por Nivel
        </CardTitle>
        <CardDescription>Usuarios por nivel de gamificación</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between gap-2 h-40">
          {levels.map((level) => {
            const heightPercent = (level.count / maxCount) * 100;
            return (
              <div key={level.level} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground">{level.count}</span>
                <div
                  className="w-full bg-gradient-to-t from-purple-600 to-purple-400 rounded-t transition-all"
                  style={{ height: `${Math.max(heightPercent, 5)}%`, minHeight: '4px' }}
                />
                <span className="text-xs font-medium">Nv.{level.level}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ============ MAIN PAGE ============
export default function KPIsPage() {
  const [activeTab, setActiveTab] = useState("leads");
  const [period, setPeriod] = useState("month");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // KPI State
  const [leadKPIs, setLeadKPIs] = useState<LeadKPIs | null>(null);
  const [opportunityKPIs, setOpportunityKPIs] = useState<OpportunityKPIs | null>(null);
  const [creditKPIs, setCreditKPIs] = useState<CreditKPIs | null>(null);
  const [collectionKPIs, setCollectionKPIs] = useState<CollectionKPIs | null>(null);
  const [agentKPIs, setAgentKPIs] = useState<AgentKPIs | null>(null);
  const [gamificationKPIs, setGamificationKPIs] = useState<GamificationKPIs | null>(null);
  const [businessHealthKPIs, setBusinessHealthKPIs] = useState<BusinessHealthKPIs | null>(null);

  const fetchKPIs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get(`/api/kpis?period=${period}`);
      const data = response.data as AllKPIs;

      setLeadKPIs(data.leads);
      setOpportunityKPIs(data.opportunities);
      setCreditKPIs(data.credits);
      setCollectionKPIs(data.collections);
      setAgentKPIs(data.agents);
      setGamificationKPIs(data.gamification);
      setBusinessHealthKPIs(data.business);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching KPIs:', err);
      setError('Error al cargar los KPIs. Por favor, intente de nuevo.');
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchKPIs();
  }, [fetchKPIs]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000000) {
      return `₡${(value / 1000000000).toFixed(1)}B`;
    }
    if (value >= 1000000) {
      return `₡${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `₡${(value / 1000).toFixed(1)}K`;
    }
    return `₡${value}`;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' });
  };

  // Error state
  if (error && !isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard de KPIs</h1>
            <p className="text-muted-foreground">
              Indicadores clave de rendimiento del negocio
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="p-8">
            <div className="text-center text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
              <p className="font-medium text-destructive">{error}</p>
              <Button
                onClick={fetchKPIs}
                variant="outline"
                className="mt-4"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Intentar de nuevo
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard de KPIs</h1>
          <p className="text-muted-foreground">
            Indicadores clave de rendimiento del negocio
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Última semana</SelectItem>
              <SelectItem value="month">Último mes</SelectItem>
              <SelectItem value="quarter">Último trimestre</SelectItem>
              <SelectItem value="year">Último año</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchKPIs} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
          {lastUpdated && (
            <Badge variant="outline" className="text-sm">
              <Activity className="h-3 w-3 mr-1" />
              {formatTime(lastUpdated)}
            </Badge>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-7 lg:w-auto lg:inline-grid">
          <TabsTrigger value="leads" className="gap-1">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Leads</span>
          </TabsTrigger>
          <TabsTrigger value="opportunities" className="gap-1">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Oportunidades</span>
          </TabsTrigger>
          <TabsTrigger value="credits" className="gap-1">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Créditos</span>
          </TabsTrigger>
          <TabsTrigger value="collections" className="gap-1">
            <Wallet className="h-4 w-4" />
            <span className="hidden sm:inline">Cobros</span>
          </TabsTrigger>
          <TabsTrigger value="agents" className="gap-1">
            <UserCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Agentes</span>
          </TabsTrigger>
          <TabsTrigger value="gamification" className="gap-1">
            <Gamepad2 className="h-4 w-4" />
            <span className="hidden sm:inline">Gamificación</span>
          </TabsTrigger>
          <TabsTrigger value="business" className="gap-1">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Negocio</span>
          </TabsTrigger>
        </TabsList>

        {/* Lead Management KPIs */}
        <TabsContent value="leads" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <StatCard
              title="Tasa de Conversión"
              value={leadKPIs?.conversionRate?.value ?? 0}
              unit={leadKPIs?.conversionRate?.unit}
              change={leadKPIs?.conversionRate?.change}
              target={leadKPIs?.conversionRate?.target}
              icon={TrendingUp}
              colorClass="text-green-500"
              isLoading={isLoading}
            />
            <StatCard
              title="Tiempo de Respuesta"
              value={leadKPIs?.responseTime?.value ?? 0}
              unit={leadKPIs?.responseTime?.unit}
              change={leadKPIs?.responseTime?.change}
              icon={Clock}
              description="Tiempo promedio hasta primer contacto"
              colorClass="text-blue-500"
              isLoading={isLoading}
            />
            <StatCard
              title="Leads Envejecidos (+7 días)"
              value={leadKPIs?.leadAging?.value ?? 0}
              unit={leadKPIs?.leadAging?.unit}
              change={leadKPIs?.leadAging?.change}
              icon={AlertTriangle}
              description="Leads pendientes por más de 7 días"
              colorClass="text-amber-500"
              isLoading={isLoading}
            />
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <KPITable
              title="Leads por Agente"
              description="Distribución de leads asignados"
              icon={Users}
              headers={["Agente", "Leads", "% del Total"]}
              rows={(leadKPIs?.leadsPerAgent ?? []).map(agent => {
                const total = (leadKPIs?.leadsPerAgent ?? []).reduce((sum, a) => sum + a.count, 0) || 1;
                return [
                  agent.agentName,
                  agent.count,
                  <Badge key={agent.agentName} variant="secondary">{Math.round((agent.count / total) * 100)}%</Badge>
                ];
              })}
              isLoading={isLoading}
            />
            <KPITable
              title="Rendimiento por Fuente"
              description="Conversión por canal de adquisición"
              icon={BarChart3}
              headers={["Fuente", "Leads", "Conversión"]}
              rows={(leadKPIs?.leadSourcePerformance ?? []).map(source => [
                source.source,
                source.count,
                <Badge
                  key={source.source}
                  variant={source.conversion >= 35 ? "default" : source.conversion >= 25 ? "secondary" : "outline"}
                  className={cn(
                    source.conversion >= 35 && "bg-green-500",
                    source.conversion >= 25 && source.conversion < 35 && "bg-amber-500"
                  )}
                >
                  {source.conversion}%
                </Badge>
              ])}
              isLoading={isLoading}
            />
          </div>
        </TabsContent>

        {/* Opportunities KPIs */}
        <TabsContent value="opportunities" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Win Rate"
              value={opportunityKPIs?.winRate?.value ?? 0}
              unit={opportunityKPIs?.winRate?.unit}
              change={opportunityKPIs?.winRate?.change}
              target={opportunityKPIs?.winRate?.target}
              icon={CheckCircle}
              colorClass="text-green-500"
              isLoading={isLoading}
            />
            <StatCard
              title="Pipeline Value"
              value={formatCurrency(Number(opportunityKPIs?.pipelineValue?.value) || 0)}
              change={opportunityKPIs?.pipelineValue?.change}
              icon={DollarSign}
              description="Valor total de oportunidades abiertas"
              colorClass="text-emerald-500"
              isLoading={isLoading}
            />
            <StatCard
              title="Ciclo de Venta Promedio"
              value={opportunityKPIs?.avgSalesCycle?.value ?? 0}
              unit={opportunityKPIs?.avgSalesCycle?.unit}
              change={opportunityKPIs?.avgSalesCycle?.change}
              icon={Timer}
              colorClass="text-blue-500"
              isLoading={isLoading}
            />
            <StatCard
              title="Velocidad de Pipeline"
              value={opportunityKPIs?.velocity?.value ?? 0}
              change={opportunityKPIs?.velocity?.change}
              icon={Zap}
              description="Oportunidades movidas por período"
              colorClass="text-purple-500"
              isLoading={isLoading}
            />
          </div>
          <StageConversionFunnel stages={opportunityKPIs?.stageConversion ?? []} isLoading={isLoading} />
        </TabsContent>

        {/* Credit/Loan KPIs */}
        <TabsContent value="credits" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <StatCard
              title="Volumen de Desembolso"
              value={formatCurrency(Number(creditKPIs?.disbursementVolume?.value) || 0)}
              change={creditKPIs?.disbursementVolume?.change}
              icon={DollarSign}
              colorClass="text-green-500"
              isLoading={isLoading}
            />
            <StatCard
              title="Tamaño Promedio de Crédito"
              value={formatCurrency(Number(creditKPIs?.avgLoanSize?.value) || 0)}
              change={creditKPIs?.avgLoanSize?.change}
              icon={CreditCard}
              colorClass="text-blue-500"
              isLoading={isLoading}
            />
            <StatCard
              title="Cartera en Riesgo (PAR)"
              value={creditKPIs?.portfolioAtRisk?.value ?? 0}
              unit={creditKPIs?.portfolioAtRisk?.unit}
              change={creditKPIs?.portfolioAtRisk?.change}
              target={creditKPIs?.portfolioAtRisk?.target}
              icon={AlertTriangle}
              colorClass="text-amber-500"
              isLoading={isLoading}
            />
            <StatCard
              title="Créditos Morosos (+90 días)"
              value={creditKPIs?.nonPerformingLoans?.value ?? 0}
              change={creditKPIs?.nonPerformingLoans?.change}
              icon={TrendingDown}
              description="NPL - Non Performing Loans"
              colorClass="text-red-500"
              isLoading={isLoading}
            />
            <StatCard
              title="Tasa de Aprobación"
              value={creditKPIs?.approvalRate?.value ?? 0}
              unit={creditKPIs?.approvalRate?.unit}
              change={creditKPIs?.approvalRate?.change}
              target={creditKPIs?.approvalRate?.target}
              icon={CheckCircle}
              colorClass="text-green-500"
              isLoading={isLoading}
            />
            <StatCard
              title="Tiempo de Desembolso"
              value={creditKPIs?.timeToDisbursement?.value ?? 0}
              unit={creditKPIs?.timeToDisbursement?.unit}
              change={creditKPIs?.timeToDisbursement?.change}
              icon={Clock}
              description="Promedio desde solicitud"
              colorClass="text-blue-500"
              isLoading={isLoading}
            />
          </div>
        </TabsContent>

        {/* Collections KPIs */}
        <TabsContent value="collections" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <StatCard
              title="Tasa de Cobro"
              value={collectionKPIs?.collectionRate?.value ?? 0}
              unit={collectionKPIs?.collectionRate?.unit}
              change={collectionKPIs?.collectionRate?.change}
              target={collectionKPIs?.collectionRate?.target}
              icon={Percent}
              colorClass="text-green-500"
              isLoading={isLoading}
            />
            <StatCard
              title="DSO (Days Sales Outstanding)"
              value={collectionKPIs?.dso?.value ?? 0}
              unit={collectionKPIs?.dso?.unit}
              change={collectionKPIs?.dso?.change}
              icon={Timer}
              description="Días promedio para cobrar"
              colorClass="text-blue-500"
              isLoading={isLoading}
            />
            <StatCard
              title="Tasa de Morosidad"
              value={collectionKPIs?.delinquencyRate?.value ?? 0}
              unit={collectionKPIs?.delinquencyRate?.unit}
              change={collectionKPIs?.delinquencyRate?.change}
              target={collectionKPIs?.delinquencyRate?.target}
              icon={AlertTriangle}
              colorClass="text-red-500"
              isLoading={isLoading}
            />
            <StatCard
              title="Tasa de Recuperación"
              value={collectionKPIs?.recoveryRate?.value ?? 0}
              unit={collectionKPIs?.recoveryRate?.unit}
              change={collectionKPIs?.recoveryRate?.change}
              icon={TrendingUp}
              description="% recuperado de cuentas morosas"
              colorClass="text-emerald-500"
              isLoading={isLoading}
            />
            <StatCard
              title="Puntualidad de Pagos"
              value={collectionKPIs?.paymentTimeliness?.value ?? 0}
              unit={collectionKPIs?.paymentTimeliness?.unit}
              change={collectionKPIs?.paymentTimeliness?.change}
              target={collectionKPIs?.paymentTimeliness?.target}
              icon={CheckCircle}
              description="% de pagos a tiempo"
              colorClass="text-green-500"
              isLoading={isLoading}
            />
          </div>
          <KPITable
            title="Eficiencia por Deductora"
            description="Tasa de cobro por entidad de deducción"
            icon={Building2}
            headers={["Deductora", "Tasa de Cobro", "Estado"]}
            rows={(collectionKPIs?.deductoraEfficiency ?? []).map(d => [
              d.name,
              `${d.rate}%`,
              <Badge
                key={d.name}
                variant={d.rate >= 95 ? "default" : d.rate >= 90 ? "secondary" : "destructive"}
                className={cn(
                  d.rate >= 95 && "bg-green-500"
                )}
              >
                {d.rate >= 95 ? "Excelente" : d.rate >= 90 ? "Bueno" : "Mejorar"}
              </Badge>
            ])}
            isLoading={isLoading}
          />
        </TabsContent>

        {/* Agent Performance KPIs */}
        <TabsContent value="agents" className="space-y-6">
          <KPITable
            title="Rendimiento de Agentes"
            description="Métricas de desempeño individual"
            icon={UserCheck}
            headers={["Agente", "Leads", "Conversión", "Créditos", "Monto Promedio"]}
            rows={(agentKPIs?.topAgents ?? []).map(agent => [
              <div key={agent.name} className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                  {agent.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </div>
                <span className="font-medium">{agent.name}</span>
              </div>,
              agent.leadsHandled,
              <Badge
                key={`${agent.name}-conv`}
                variant={agent.conversionRate >= 30 ? "default" : "secondary"}
                className={cn(agent.conversionRate >= 30 && "bg-green-500")}
              >
                {agent.conversionRate}%
              </Badge>,
              agent.creditsOriginated,
              formatCurrency(agent.avgDealSize)
            ])}
            isLoading={isLoading}
          />
        </TabsContent>

        {/* Gamification KPIs */}
        <TabsContent value="gamification" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <StatCard
              title="Tasa de Engagement"
              value={gamificationKPIs?.engagementRate?.value ?? 0}
              unit={gamificationKPIs?.engagementRate?.unit}
              change={gamificationKPIs?.engagementRate?.change}
              target={gamificationKPIs?.engagementRate?.target}
              icon={Activity}
              colorClass="text-purple-500"
              isLoading={isLoading}
            />
            <StatCard
              title="Velocidad de Puntos"
              value={gamificationKPIs?.pointsVelocity?.value ?? 0}
              unit={gamificationKPIs?.pointsVelocity?.unit}
              change={gamificationKPIs?.pointsVelocity?.change}
              icon={Star}
              description="Puntos generados por día"
              colorClass="text-amber-500"
              isLoading={isLoading}
            />
            <StatCard
              title="Badges Completados"
              value={gamificationKPIs?.badgeCompletion?.value ?? 0}
              unit={gamificationKPIs?.badgeCompletion?.unit}
              change={gamificationKPIs?.badgeCompletion?.change}
              icon={Medal}
              description="% de badges disponibles ganados"
              colorClass="text-blue-500"
              isLoading={isLoading}
            />
            <StatCard
              title="Participación en Challenges"
              value={gamificationKPIs?.challengeParticipation?.value ?? 0}
              change={gamificationKPIs?.challengeParticipation?.change}
              icon={Target}
              description="Usuarios activos en challenges"
              colorClass="text-green-500"
              isLoading={isLoading}
            />
            <StatCard
              title="Tasa de Canje"
              value={gamificationKPIs?.redemptionRate?.value ?? 0}
              unit={gamificationKPIs?.redemptionRate?.unit}
              change={gamificationKPIs?.redemptionRate?.change}
              icon={Award}
              description="Puntos canjeados vs ganados"
              colorClass="text-pink-500"
              isLoading={isLoading}
            />
            <StatCard
              title="Retención de Rachas"
              value={gamificationKPIs?.streakRetention?.value ?? 0}
              unit={gamificationKPIs?.streakRetention?.unit}
              change={gamificationKPIs?.streakRetention?.change}
              icon={Flame}
              description="Usuarios manteniendo rachas"
              colorClass="text-orange-500"
              isLoading={isLoading}
            />
          </div>
          <LevelDistributionChart levels={gamificationKPIs?.levelDistribution ?? []} isLoading={isLoading} />
        </TabsContent>

        {/* Business Health KPIs */}
        <TabsContent value="business" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              title="Customer Lifetime Value (CLV)"
              value={formatCurrency(Number(businessHealthKPIs?.clv?.value) || 0)}
              change={businessHealthKPIs?.clv?.change}
              icon={DollarSign}
              description="Valor total por cliente"
              colorClass="text-green-500"
              isLoading={isLoading}
            />
            <StatCard
              title="Customer Acquisition Cost (CAC)"
              value={formatCurrency(Number(businessHealthKPIs?.cac?.value) || 0)}
              change={businessHealthKPIs?.cac?.change}
              icon={TrendingDown}
              description="Costo por cliente adquirido"
              colorClass="text-blue-500"
              isLoading={isLoading}
            />
            <StatCard
              title="Crecimiento de Cartera"
              value={businessHealthKPIs?.portfolioGrowth?.value ?? 0}
              unit={businessHealthKPIs?.portfolioGrowth?.unit}
              change={businessHealthKPIs?.portfolioGrowth?.change}
              target={businessHealthKPIs?.portfolioGrowth?.target}
              icon={TrendingUp}
              description="Crecimiento mes a mes"
              colorClass="text-emerald-500"
              isLoading={isLoading}
            />
          </div>
          {businessHealthKPIs && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Ratio CLV:CAC
                </CardTitle>
                <CardDescription>
                  Relación entre el valor del cliente y el costo de adquisición
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <div className="text-4xl font-bold text-green-500">
                    {((Number(businessHealthKPIs.clv?.value) || 1) / (Number(businessHealthKPIs.cac?.value) || 1)).toFixed(1)}:1
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      Por cada ₡1 invertido en adquisición, se genera ₡
                      {((Number(businessHealthKPIs.clv?.value) || 1) / (Number(businessHealthKPIs.cac?.value) || 1)).toFixed(0)}
                      {" "}en valor de cliente.
                    </p>
                    <Badge variant="default" className="mt-2 bg-green-500">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Saludable (Meta: &gt;3:1)
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
