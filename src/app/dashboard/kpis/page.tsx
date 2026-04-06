"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  LineChart as LineChartIcon,
  Download,
  FileSpreadsheet,
  FileText,
  RotateCcw,
  Banknote,
  ShieldAlert,
  FileCheck,
  Route,
  Hourglass,
  ShoppingBag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/axios";
import { ProtectedPage } from "@/components/ProtectedPage";
import { getAuthUser } from "@/lib/auth";
import { usePermissions } from "@/contexts/PermissionsContext";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { exportToExcel, exportToPDF } from "@/lib/kpi-export";

// ============ TYPES ============
interface KPIData {
  value: number | string;
  change?: number;
  target?: number;
  unit?: string;
  count?: number;
}

interface LeadKPIs {
  conversionRate: KPIData;
  responseTime: KPIData;
  leadAging: KPIData;
  leadSourcePerformance: { source: string; conversion: number; conversionRate: number; count: number }[];
  totalLeads?: number;
  totalClients?: number;
}

interface OpportunityKPIs {
  winRate: KPIData;
  pipelineValue: KPIData;
  avgSalesCycle: KPIData;
  velocity: KPIData;
  creditTypeComparison: { type: string; total: number; noCredit: number; pending: number; followUp: number; delinquent: number; won: number; pipeline: number }[];
}

interface CreditKPIs {
  disbursementVolume: KPIData;
  avgLoanSize: KPIData;
  portfolioAtRisk: KPIData;
  nonPerformingLoans: KPIData;
  approvalRate: KPIData;
  timeToDisbursement: KPIData;
  fullCycleTime: KPIData;
  earlyCancellationRate: KPIData;
  extraordinaryPayments: KPIData;
  totalCredits?: number;
  totalPortfolio?: number;
}

interface CollectionKPIs {
  collectionRate: KPIData;
  delinquencyRate: KPIData;
  recoveryRate: KPIData;
  paymentTimeliness: KPIData;
  reversalRate: KPIData;
  pendingBalances: KPIData;
  paymentSourceDistribution: { source: string; count: number; total: number }[];
}

interface AgentKPIs {
  topAgents: {
    name: string;
    tasksTotal: number;
    tasksCompleted: number;
    tasksPending: number;
    tasksArchived: number;
    tasksOverdue: number;
    completionRate: number;
    avgCompletionTime: number;
    onTimeRate: number;
    tasksInPeriod: number;
  }[];
}

interface GamificationKPIs {
  engagementRate: KPIData;
  pointsVelocity: KPIData;
  badgeCompletion: KPIData;
  challengeParticipation: KPIData;
  redemptionRate: KPIData;
  streakRetention: KPIData;
  leaderboardMovement: KPIData;
  levelDistribution: { level: number; count: number }[];
}

interface BusinessHealthKPIs {
  clv: KPIData;
  cac: KPIData;
  portfolioGrowth: KPIData;
  nps: KPIData;
  revenuePerEmployee: KPIData;
}

interface TrendDataPoint {
  month: string;
  fullMonth?: string;
  value: number;
}

interface TrendData {
  conversionRate: TrendDataPoint[];
  disbursementVolume: TrendDataPoint[];
  collectionRate: TrendDataPoint[];
  portfolioGrowth: TrendDataPoint[];
  delinquencyRate: TrendDataPoint[];
  leadsCount: TrendDataPoint[];
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

interface VentasKPIs {
  anio: number;
  mes: number;
  meta: { id: number; creditos_objetivo: number; monto_objetivo: number } | null;
  creditos_mes: number;
  monto_colocado: number;
  ticket_promedio: number;
  tasa_cierre: number | null;
  alcance_pct: number;
  tier_activo: { nombre: string; porcentaje: number; creditos_minimos: number } | null;
  comisiones: { pendientes: number; aprobadas: number; pagadas: number; total: number };
  visitas: { planificadas: number; realizadas: number; tasa: number | null };
  reward_points: number;
}

interface VentasEquipoKPIs {
  equipo: (VentasKPIs & { user_id: number; name: string })[];
  total_vendedores: number;
  total_creditos: number;
  total_monto: number;
  total_comisiones: number;
  anio: number;
  mes: number;
}

interface VentasMesHistorico {
  anio: number;
  mes: number;
  label: string;
  creditos: number;
  monto: number;
  meta_cantidad: number;
  alcance_pct: number | null;
  comision: number;
  tasa_cierre: number | null;
}

interface VentasTendencias {
  historico: VentasMesHistorico[];
  comparativa: {
    mes_actual: VentasMesHistorico;
    mes_anterior: VentasMesHistorico;
    delta_creditos: number | null;
    delta_monto: number | null;
  };
  proyeccion: {
    creditos_proyectados: number;
    meta_cantidad: number;
    alcanzara_meta: boolean;
    dias_transcurridos: number;
    dias_mes: number;
  };
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
      <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 sm:p-6 sm:pb-2">
        <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
          {title}
        </CardTitle>
        <Icon className={cn("h-4 w-4 shrink-0", colorClass || "text-muted-foreground")} />
      </CardHeader>
      <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
        <div className="text-base sm:text-2xl font-bold">
          {value}
          {unit && <span className="text-xs sm:text-sm font-normal text-muted-foreground ml-1">{unit}</span>}
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
            <span className="hidden sm:inline">{Math.abs(change)}% vs período anterior</span>
            <span className="sm:hidden">{Math.abs(change)}%</span>
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
          <p className="text-xs text-muted-foreground mt-1 hidden sm:block">{description}</p>
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

function TrendChart({
  title,
  description,
  data,
  dataKey,
  color,
  formatValue,
  isLoading,
  type = "line",
  unit = "",
}: {
  title: string;
  description?: string;
  data: TrendDataPoint[];
  dataKey: string;
  color: string;
  formatValue?: (value: number) => string;
  isLoading?: boolean;
  type?: "line" | "area";
  unit?: string;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64 mt-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  const defaultFormat = (value: number) => `${value}${unit}`;
  const formatter = formatValue || defaultFormat;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LineChartIcon className="h-5 w-5" />
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="h-48 sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            {type === "area" ? (
              <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="month"
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={formatter}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [formatter(value), title]}
                  labelFormatter={(label) => {
                    const point = data.find(d => d.month === label);
                    return point?.fullMonth || label;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={2}
                  fill={`url(#gradient-${dataKey})`}
                />
              </AreaChart>
            ) : (
              <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="month"
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={formatter}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [formatter(value), title]}
                  labelFormatter={(label) => {
                    const point = data.find(d => d.month === label);
                    return point?.fullMonth || label;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={2}
                  dot={{ fill: color, strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: color }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// ============ MAIN PAGE ============
export default function KPIsPage() {
  const { canViewModule } = usePermissions();
  const isMobile = useMediaQuery("(max-width: 480px)");
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
  const [trendData, setTrendData] = useState<TrendData | null>(null);
  const [trendsLoading, setTrendsLoading] = useState(true);
  const [trendsError, setTrendsError] = useState<string | null>(null);

  // Ventas KPI State
  const [ventasKPIs, setVentasKPIs] = useState<VentasKPIs | null>(null);
  const [ventasEquipoKPIs, setVentasEquipoKPIs] = useState<VentasEquipoKPIs | null>(null);
  const [ventasTendencias, setVentasTendencias] = useState<VentasTendencias | null>(null);
  const [ventasLoading, setVentasLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const user = getAuthUser();
    const admin = user?.role?.full_access === true;
    setIsAdmin(admin);
    // Vendedores aterrizan directamente en Ventas
    if (!admin) setActiveTab('ventas');
  }, []);

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

  const fetchTrends = useCallback(async () => {
    setTrendsLoading(true);
    setTrendsError(null);
    try {
      const response = await api.get(`/api/kpis/trends?period=${period}`);
      setTrendData(response.data as TrendData);
    } catch (err) {
      console.error('Error fetching trends:', err);
      setTrendsError('Error al cargar las tendencias. Los gráficos no están disponibles.');
      setTrendData(null);
    } finally {
      setTrendsLoading(false);
    }
  }, [period]);

  const fetchVentasKPIs = useCallback(async () => {
    setVentasLoading(true);
    try {
      const anio = new Date().getFullYear();
      const mes  = new Date().getMonth() + 1;
      const [personalRes, equipoRes, tendenciasRes] = await Promise.allSettled([
        api.get(`/api/kpis/ventas?anio=${anio}&mes=${mes}`),
        api.get(`/api/kpis/ventas/equipo?anio=${anio}&mes=${mes}`),
        api.get(`/api/kpis/ventas/tendencias`),
      ]);
      if (personalRes.status === 'fulfilled')   setVentasKPIs(personalRes.value.data as VentasKPIs);
      if (equipoRes.status === 'fulfilled')     setVentasEquipoKPIs(equipoRes.value.data as VentasEquipoKPIs);
      if (tendenciasRes.status === 'fulfilled') setVentasTendencias(tendenciasRes.value.data as VentasTendencias);
    } catch {
      // silently fail — section shows empty state
    } finally {
      setVentasLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKPIs();
    fetchTrends();
    fetchVentasKPIs();
  }, [fetchKPIs, fetchTrends, fetchVentasKPIs]);

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

  const getPeriodLabel = (p: string) => {
    const labels: Record<string, string> = {
      week: 'Última semana',
      month: 'Último mes',
      quarter: 'Último trimestre',
      year: 'Último año',
    };
    return labels[p] || p;
  };

  const handleExportExcel = async () => {
    await exportToExcel({
      leads: leadKPIs,
      opportunities: opportunityKPIs,
      credits: creditKPIs,
      collections: collectionKPIs,
      agents: agentKPIs,
      gamification: gamificationKPIs,
      business: businessHealthKPIs,
    }, getPeriodLabel(period), trendData);
  };

  const handleExportPDF = async () => {
    await exportToPDF({
      leads: leadKPIs,
      opportunities: opportunityKPIs,
      credits: creditKPIs,
      collections: collectionKPIs,
      agents: agentKPIs,
      gamification: gamificationKPIs,
      business: businessHealthKPIs,
    }, getPeriodLabel(period), trendData);
  };

  // Error state
  if (error && !isLoading) {
    return (
      <ProtectedPage module="kpis">
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
      </ProtectedPage>
    );
  }

  return (
    <ProtectedPage module="kpis">
      <div className="space-y-4 sm:space-y-6 p-3 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Dashboard de KPIs</h1>
          <p className="text-sm text-muted-foreground">
            Indicadores clave de rendimiento
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32 sm:w-40">
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isLoading}>
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportExcel}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Exportar a Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPDF}>
                <FileText className="h-4 w-4 mr-2" />
                Exportar a PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {lastUpdated && (
            <Badge variant="outline" className="text-sm">
              <Activity className="h-3 w-3 mr-1" />
              {formatTime(lastUpdated)}
            </Badge>
          )}
        </div>
      </div>

      {/* Section content (shared between Accordion and Tabs) */}
      {(() => {
        const leadsContent = (
          <>
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
              <StatCard title="Tasa de Conversión" value={leadKPIs?.conversionRate?.value ?? 0} unit={leadKPIs?.conversionRate?.unit} change={leadKPIs?.conversionRate?.change} target={leadKPIs?.conversionRate?.target} icon={TrendingUp} colorClass="text-green-500" isLoading={isLoading} />
              <StatCard title="Tiempo de Respuesta" value={leadKPIs?.responseTime?.value ?? 0} unit={leadKPIs?.responseTime?.unit} change={leadKPIs?.responseTime?.change} icon={Clock} description="Tiempo promedio hasta primer contacto" colorClass="text-blue-500" isLoading={isLoading} />
              <StatCard title="Leads Envejecidos (+7 días)" value={leadKPIs?.leadAging?.value ?? 0} unit={leadKPIs?.leadAging?.unit} change={leadKPIs?.leadAging?.change} icon={AlertTriangle} description="Leads pendientes por más de 7 días" colorClass="text-amber-500" isLoading={isLoading} />
            </div>
            <KPITable title="Rendimiento por Fuente" description="Distribución global de leads por canal de adquisición" icon={BarChart3} headers={["Fuente", "Cantidad", "Participación", "Conversión"]} rows={(leadKPIs?.leadSourcePerformance ?? []).map(source => [source.source, source.count, <Badge key={`${source.source}-p`} variant={source.conversion >= 35 ? "default" : source.conversion >= 25 ? "secondary" : "outline"} className={cn(source.conversion >= 35 && "bg-green-500", source.conversion >= 25 && source.conversion < 35 && "bg-amber-500")}>{source.conversion}%</Badge>, <Badge key={`${source.source}-c`} variant={source.conversionRate >= 50 ? "default" : source.conversionRate >= 25 ? "secondary" : "outline"} className={cn(source.conversionRate >= 50 && "bg-green-500", source.conversionRate >= 25 && source.conversionRate < 50 && "bg-amber-500")}>{source.conversionRate}%</Badge>])} isLoading={isLoading} />
          </>
        );

        const opportunitiesContent = (
          <>
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              <StatCard title="Porcentaje de créditos ganados" value={opportunityKPIs?.winRate?.value ?? 0} unit={opportunityKPIs?.winRate?.unit} change={opportunityKPIs?.winRate?.change} target={opportunityKPIs?.winRate?.target} icon={CheckCircle} colorClass="text-green-500" isLoading={isLoading} />
              <StatCard title="Valor de la cartera" value={formatCurrency(Number(opportunityKPIs?.pipelineValue?.value) || 0)} change={opportunityKPIs?.pipelineValue?.change} icon={DollarSign} description="Valor total de oportunidades abiertas" colorClass="text-emerald-500" isLoading={isLoading} />
              <StatCard title="Ciclo de Venta Promedio" value={opportunityKPIs?.avgSalesCycle?.value ?? 0} unit={opportunityKPIs?.avgSalesCycle?.unit} change={opportunityKPIs?.avgSalesCycle?.change} icon={Timer} colorClass="text-blue-500" isLoading={isLoading} />
              <StatCard title="Velocidad de la cartera" value={opportunityKPIs?.velocity?.value ?? 0} change={opportunityKPIs?.velocity?.change} icon={Zap} description="Oportunidades movidas por período" colorClass="text-purple-500" isLoading={isLoading} />
            </div>
            <KPITable
              title="Oportunidades por Tipo de Crédito"
              description="Estado de oportunidades y sus créditos asociados"
              icon={PieChart}
              headers={["Tipo", "Total", "Sin Crédito", "Pendientes", "Seguimiento", "En Mora", "Ganadas", "Valor Potencial"]}
              rows={(opportunityKPIs?.creditTypeComparison ?? []).map(ct => [
                ct.type,
                ct.total,
                <Badge key={`${ct.type}-nc`} variant="outline" className="bg-gray-50 text-gray-500">{ct.noCredit}</Badge>,
                <Badge key={`${ct.type}-p`} variant="outline" className="bg-amber-50 text-amber-700">{ct.pending}</Badge>,
                <Badge key={`${ct.type}-f`} variant="secondary" className="bg-blue-50 text-blue-700">{ct.followUp}</Badge>,
                <Badge key={`${ct.type}-d`} variant="destructive" className="text-xs">{ct.delinquent}</Badge>,
                <Badge key={`${ct.type}-w`} variant="default" className="bg-green-500">{ct.won}</Badge>,
                formatCurrency(ct.pipeline),
              ])}
              isLoading={isLoading}
            />
          </>
        );

        const creditsContent = (
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
            <StatCard title="Volumen de Desembolso" value={formatCurrency(Number(creditKPIs?.disbursementVolume?.value) || 0)} change={creditKPIs?.disbursementVolume?.change} icon={DollarSign} colorClass="text-green-500" isLoading={isLoading} />
            <StatCard title="Tamaño Promedio de Crédito" value={formatCurrency(Number(creditKPIs?.avgLoanSize?.value) || 0)} change={creditKPIs?.avgLoanSize?.change} icon={CreditCard} colorClass="text-blue-500" isLoading={isLoading} />
            <StatCard title="Cartera en Riesgo (PAR)" value={creditKPIs?.portfolioAtRisk?.value ?? 0} unit={creditKPIs?.portfolioAtRisk?.unit} change={creditKPIs?.portfolioAtRisk?.change} target={creditKPIs?.portfolioAtRisk?.target} icon={AlertTriangle} colorClass="text-amber-500" isLoading={isLoading} />
            <StatCard title="Créditos Morosos (+90 días)" value={creditKPIs?.nonPerformingLoans?.value ?? 0} change={creditKPIs?.nonPerformingLoans?.change} icon={TrendingDown} description="NPL - Non Performing Loans" colorClass="text-red-500" isLoading={isLoading} />
            <StatCard title="Tasa de Aprobación" value={creditKPIs?.approvalRate?.value ?? 0} unit={creditKPIs?.approvalRate?.unit} change={creditKPIs?.approvalRate?.change} target={creditKPIs?.approvalRate?.target} icon={CheckCircle} colorClass="text-green-500" isLoading={isLoading} />
            <StatCard title="Tiempo de Desembolso" value={creditKPIs?.timeToDisbursement?.value ?? 0} unit={creditKPIs?.timeToDisbursement?.unit} change={creditKPIs?.timeToDisbursement?.change} icon={Clock} description="Promedio desde solicitud" colorClass="text-blue-500" isLoading={isLoading} />
            <StatCard title="Ciclo Completo" value={creditKPIs?.fullCycleTime?.value ?? 0} unit={creditKPIs?.fullCycleTime?.unit} change={creditKPIs?.fullCycleTime?.change} icon={Route} description="Oportunidad → formalización" colorClass="text-purple-500" isLoading={isLoading} />
            <StatCard title="Cancelación Anticipada" value={creditKPIs?.earlyCancellationRate?.value ?? 0} unit={creditKPIs?.earlyCancellationRate?.unit} change={creditKPIs?.earlyCancellationRate?.change} icon={AlertTriangle} description={`${creditKPIs?.earlyCancellationRate?.count ?? 0} créditos cancelados`} colorClass="text-orange-500" isLoading={isLoading} />
            <StatCard title="Abonos Extraordinarios" value={formatCurrency(Number(creditKPIs?.extraordinaryPayments?.value) || 0)} change={creditKPIs?.extraordinaryPayments?.change} icon={Banknote} description={`${creditKPIs?.extraordinaryPayments?.count ?? 0} pagos extraordinarios`} colorClass="text-teal-500" isLoading={isLoading} />
          </div>
        );

        const collectionsContent = (
          <>
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
              <StatCard title="Tasa de Cobro" value={collectionKPIs?.collectionRate?.value ?? 0} unit={collectionKPIs?.collectionRate?.unit} change={collectionKPIs?.collectionRate?.change} target={collectionKPIs?.collectionRate?.target} icon={Percent} colorClass="text-green-500" isLoading={isLoading} />
              <StatCard title="Tasa de Morosidad" value={collectionKPIs?.delinquencyRate?.value ?? 0} unit={collectionKPIs?.delinquencyRate?.unit} change={collectionKPIs?.delinquencyRate?.change} target={collectionKPIs?.delinquencyRate?.target} icon={AlertTriangle} colorClass="text-red-500" isLoading={isLoading} />
              <StatCard title="Tasa de Recuperación" value={collectionKPIs?.recoveryRate?.value ?? 0} unit={collectionKPIs?.recoveryRate?.unit} change={collectionKPIs?.recoveryRate?.change} icon={TrendingUp} description="% recuperado de cuentas morosas" colorClass="text-emerald-500" isLoading={isLoading} />
              <StatCard title="Puntualidad de Pagos" value={collectionKPIs?.paymentTimeliness?.value ?? 0} unit={collectionKPIs?.paymentTimeliness?.unit} change={collectionKPIs?.paymentTimeliness?.change} target={collectionKPIs?.paymentTimeliness?.target} icon={CheckCircle} description="% de pagos a tiempo" colorClass="text-green-500" isLoading={isLoading} />
              <StatCard title="Tasa de Reversiones" value={collectionKPIs?.reversalRate?.value ?? 0} unit={collectionKPIs?.reversalRate?.unit} change={collectionKPIs?.reversalRate?.change} icon={RotateCcw} description={`${collectionKPIs?.reversalRate?.count ?? 0} pagos anulados`} colorClass="text-orange-500" isLoading={isLoading} />
              <StatCard title="Saldos Pendientes" value={formatCurrency(Number(collectionKPIs?.pendingBalances?.value) || 0)} change={collectionKPIs?.pendingBalances?.change} icon={Hourglass} description={`${collectionKPIs?.pendingBalances?.count ?? 0} sobrepagos por asignar`} colorClass="text-amber-500" isLoading={isLoading} />
            </div>
            <KPITable title="Distribución por Fuente de Pago" description="Desglose de pagos por canal" icon={BarChart3} headers={["Fuente", "Cantidad", "Monto Total"]} rows={(collectionKPIs?.paymentSourceDistribution ?? []).map(s => [s.source, s.count, formatCurrency(s.total)])} isLoading={isLoading} />
          </>
        );

        const agentsContent = (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Rendimiento de Agentes
              </CardTitle>
              <CardDescription>Métricas de tareas por agente</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
                </div>
              ) : (
                <div className="space-y-3">
                  {(agentKPIs?.topAgents ?? []).map((agent, i) => {
                    const compRate = agent.completionRate ?? 0;
                    const compColor = compRate >= 80 ? "text-green-500" : compRate >= 50 ? "text-yellow-500" : "text-red-500";
                    const compBg = compRate >= 80 ? "bg-green-500" : compRate >= 50 ? "bg-yellow-500" : "bg-red-500";
                    const onTime = agent.onTimeRate ?? 0;
                    const onTimeColor = onTime >= 80 ? "text-green-500" : onTime >= 50 ? "text-yellow-500" : "text-red-500";
                    return (
                      <div key={agent.name} className={cn("rounded-lg border p-3 space-y-3", i === 0 && "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20")}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                              {agent.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                            </div>
                            <div>
                              <p className="font-semibold text-sm">{agent.name}</p>
                              <p className="text-xs text-muted-foreground">{agent.tasksTotal} tareas totales</p>
                            </div>
                          </div>
                          {i < 3 && (
                            <span className="text-lg">{["🥇", "🥈", "🥉"][i]}</span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Completadas</span>
                            <Badge variant="default" className="text-xs bg-green-500">{agent.tasksCompleted}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Pendientes</span>
                            <Badge variant="secondary" className="text-xs">{agent.tasksPending}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Vencidas</span>
                            <Badge variant={agent.tasksOverdue > 0 ? "destructive" : "secondary"} className="text-xs">{agent.tasksOverdue}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Archivadas</span>
                            <span className="font-medium">{agent.tasksArchived}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Tiempo Prom.</span>
                            <span className="font-medium">{agent.avgCompletionTime} días</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Puntualidad</span>
                            <span className={cn("font-semibold", onTimeColor)}>{onTime}%</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Completitud</span>
                            <span className={cn("font-semibold", compColor)}>
                              {agent.tasksCompleted}/{agent.tasksTotal}
                              <span className="ml-1 text-xs">({compRate}%)</span>
                            </span>
                          </div>
                          <Progress value={compRate} className="h-2" indicatorClassName={compBg} />
                        </div>
                        {agent.tasksInPeriod > 0 && (
                          <p className="text-xs text-muted-foreground">{agent.tasksInPeriod} tareas nuevas en el período</p>
                        )}
                      </div>
                    );
                  })}
                  {(agentKPIs?.topAgents ?? []).length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No hay datos de agentes disponibles</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );

        const gamificationContent = (
          <>
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
              <StatCard title="Tasa de Engagement" value={gamificationKPIs?.engagementRate?.value ?? 0} unit={gamificationKPIs?.engagementRate?.unit} change={gamificationKPIs?.engagementRate?.change} target={gamificationKPIs?.engagementRate?.target} icon={Activity} colorClass="text-purple-500" isLoading={isLoading} />
              <StatCard title="Velocidad de Puntos" value={gamificationKPIs?.pointsVelocity?.value ?? 0} unit={gamificationKPIs?.pointsVelocity?.unit} change={gamificationKPIs?.pointsVelocity?.change} icon={Star} description="Puntos generados por día" colorClass="text-amber-500" isLoading={isLoading} />
              <StatCard title="Badges Completados" value={gamificationKPIs?.badgeCompletion?.value ?? 0} unit={gamificationKPIs?.badgeCompletion?.unit} change={gamificationKPIs?.badgeCompletion?.change} icon={Medal} description="% de badges disponibles ganados" colorClass="text-blue-500" isLoading={isLoading} />
              <StatCard title="Participación en Challenges" value={gamificationKPIs?.challengeParticipation?.value ?? 0} change={gamificationKPIs?.challengeParticipation?.change} icon={Target} description="Usuarios activos en challenges" colorClass="text-green-500" isLoading={isLoading} />
              <StatCard title="Tasa de Canje" value={gamificationKPIs?.redemptionRate?.value ?? 0} unit={gamificationKPIs?.redemptionRate?.unit} change={gamificationKPIs?.redemptionRate?.change} icon={Award} description="Puntos canjeados vs ganados" colorClass="text-pink-500" isLoading={isLoading} />
              <StatCard title="Retención de Rachas" value={gamificationKPIs?.streakRetention?.value ?? 0} unit={gamificationKPIs?.streakRetention?.unit} change={gamificationKPIs?.streakRetention?.change} icon={Flame} description="Usuarios manteniendo rachas" colorClass="text-orange-500" isLoading={isLoading} />
              <StatCard title="Movimiento en Leaderboard" value={gamificationKPIs?.leaderboardMovement?.value ?? 0} unit={gamificationKPIs?.leaderboardMovement?.unit} change={gamificationKPIs?.leaderboardMovement?.change} icon={TrendingUp} description="Cambios de posición promedio" colorClass="text-cyan-500" isLoading={isLoading} />
            </div>
            <LevelDistributionChart levels={gamificationKPIs?.levelDistribution ?? []} isLoading={isLoading} />
          </>
        );

        const businessContent = (
          <>
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
              <StatCard title="Valor de Vida del Cliente" value={formatCurrency(Number(businessHealthKPIs?.clv?.value) || 0)} change={businessHealthKPIs?.clv?.change} icon={DollarSign} description="Valor total por cliente" colorClass="text-green-500" isLoading={isLoading} />
              <StatCard title="Costo de Adquisición" value={formatCurrency(Number(businessHealthKPIs?.cac?.value) || 0)} change={businessHealthKPIs?.cac?.change} icon={TrendingDown} description="Costo por cliente adquirido" colorClass="text-blue-500" isLoading={isLoading} />
              <StatCard title="Crecimiento de Cartera" value={businessHealthKPIs?.portfolioGrowth?.value ?? 0} unit={businessHealthKPIs?.portfolioGrowth?.unit} change={businessHealthKPIs?.portfolioGrowth?.change} target={businessHealthKPIs?.portfolioGrowth?.target} icon={TrendingUp} description="Crecimiento mes a mes" colorClass="text-emerald-500" isLoading={isLoading} />
              <StatCard title="NPS" value={businessHealthKPIs?.nps?.value ?? 0} unit={businessHealthKPIs?.nps?.unit} change={businessHealthKPIs?.nps?.change} icon={Star} description="Satisfacción del cliente" colorClass="text-yellow-500" isLoading={isLoading} />
              <StatCard title="Ingreso por Empleado" value={formatCurrency(Number(businessHealthKPIs?.revenuePerEmployee?.value) || 0)} change={businessHealthKPIs?.revenuePerEmployee?.change} icon={Users} description="Eficiencia de personal" colorClass="text-purple-500" isLoading={isLoading} />
            </div>
            {businessHealthKPIs && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    Relación VVC:CAC
                  </CardTitle>
                  <CardDescription>Relación entre el valor del cliente y el costo de adquisición</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 sm:gap-6">
                    <div className="text-2xl sm:text-4xl font-bold text-green-500">
                      {((Number(businessHealthKPIs.clv?.value) || 1) / (Number(businessHealthKPIs.cac?.value) || 1)).toFixed(1)}:1
                    </div>
                    <div className="flex-1">
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        Por cada ₡1 invertido en adquisición, se genera ₡{((Number(businessHealthKPIs.clv?.value) || 1) / (Number(businessHealthKPIs.cac?.value) || 1)).toFixed(0)} en valor de cliente.
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
          </>
        );

        const trendsContent = (
          <>
            {trendsError && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                {trendsError}
              </div>
            )}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              <TrendChart title="Tasa de Conversión" description="Evolución de la tasa de conversión de leads a clientes" data={trendData?.conversionRate ?? []} dataKey="conversionRate" color="#22c55e" unit="%" isLoading={trendsLoading} />
              <TrendChart title="Volumen de Desembolso" description="Monto total desembolsado por mes" data={trendData?.disbursementVolume ?? []} dataKey="disbursementVolume" color="#3b82f6" type="area" formatValue={(v) => `₡${(v / 1000000).toFixed(1)}M`} isLoading={trendsLoading} />
              <TrendChart title="Tasa de Cobro" description="Porcentaje de pagos recibidos vs esperados" data={trendData?.collectionRate ?? []} dataKey="collectionRate" color="#8b5cf6" unit="%" isLoading={trendsLoading} />
              <TrendChart title="Crecimiento de Cartera" description="Valor total del portafolio activo" data={trendData?.portfolioGrowth ?? []} dataKey="portfolioGrowth" color="#10b981" type="area" formatValue={(v) => `₡${(v / 1000000).toFixed(0)}M`} isLoading={trendsLoading} />
              <TrendChart title="Tasa de Morosidad" description="Porcentaje de cuentas en mora" data={trendData?.delinquencyRate ?? []} dataKey="delinquencyRate" color="#ef4444" unit="%" isLoading={trendsLoading} />
              <TrendChart title="Nuevos Leads" description="Cantidad de leads captados por mes" data={trendData?.leadsCount ?? []} dataKey="leadsCount" color="#f59e0b" type="area" isLoading={trendsLoading} />
            </div>
          </>
        );

        const fmtCRC = (n: number) =>
          new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(n);

        // Valores por defecto cuando no hay datos aún
        const mesActualNombre = new Date().toLocaleString('es-CR', { month: 'long' });
        const mesAnteriorNombre = new Date(new Date().getFullYear(), new Date().getMonth() - 1).toLocaleString('es-CR', { month: 'long' });
        const historico = ventasTendencias?.historico ?? [];
        const comparativa = ventasTendencias?.comparativa;
        const proyeccion  = ventasTendencias?.proyeccion;
        const actual      = comparativa?.mes_actual;
        const anterior    = comparativa?.mes_anterior;

        // Sub-tab dentro de Ventas
        const ventasIndividualContent = ventasLoading ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* ── Comparativa mes actual vs anterior ── */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    Créditos este mes
                  </CardTitle>
                  <CardDescription className="capitalize">{mesActualNombre}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{actual?.creditos ?? 0}</p>
                  {(actual?.meta_cantidad ?? 0) > 0 && (
                    <div className="mt-2 space-y-1">
                      <Progress value={Math.min(actual!.alcance_pct ?? 0, 100)} className={cn('h-1.5', (actual!.alcance_pct ?? 0) >= 100 && '[&>div]:bg-green-500')} />
                      <p className="text-xs text-muted-foreground">{actual!.alcance_pct ?? 0}% de {actual!.meta_cantidad} meta</p>
                    </div>
                  )}
                  {comparativa?.delta_creditos != null ? (
                    <p className={cn('text-xs mt-2 flex items-center gap-1', comparativa.delta_creditos >= 0 ? 'text-green-600' : 'text-red-500')}>
                      {comparativa.delta_creditos >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {Math.abs(comparativa.delta_creditos)}% vs {mesAnteriorNombre}
                    </p>
                  ) : (
                    <p className="text-xs mt-2 text-muted-foreground">Sin datos del mes anterior</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-muted-foreground" />
                    Monto colocado
                  </CardTitle>
                  <CardDescription className="capitalize">{mesActualNombre}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{fmtCRC(actual?.monto ?? 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Anterior: {fmtCRC(anterior?.monto ?? 0)}</p>
                  {comparativa?.delta_monto != null ? (
                    <p className={cn('text-xs mt-2 flex items-center gap-1', comparativa.delta_monto >= 0 ? 'text-green-600' : 'text-red-500')}>
                      {comparativa.delta_monto >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {Math.abs(comparativa.delta_monto)}% vs mes anterior
                    </p>
                  ) : (
                    <p className="text-xs mt-2 text-muted-foreground">Sin datos del mes anterior</p>
                  )}
                </CardContent>
              </Card>

              <Card className={cn(proyeccion && proyeccion.meta_cantidad > 0 && (proyeccion.alcanzara_meta ? 'border-green-300' : 'border-yellow-300'))}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    Proyección fin de mes
                  </CardTitle>
                  <CardDescription>
                    {proyeccion ? `Ritmo actual: ${proyeccion.dias_transcurridos} / ${proyeccion.dias_mes} días` : 'Sin actividad registrada'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{proyeccion?.creditos_proyectados ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">créditos proyectados</p>
                  {proyeccion && proyeccion.meta_cantidad > 0 ? (
                    <Badge
                      variant={proyeccion.alcanzara_meta ? 'default' : 'secondary'}
                      className={cn('mt-2 text-xs', proyeccion.alcanzara_meta && 'bg-green-100 text-green-700 border-green-300')}
                    >
                      {proyeccion.alcanzara_meta ? '✓ Alcanzará la meta' : `Faltarán ~${proyeccion.meta_cantidad - proyeccion.creditos_proyectados} créditos`}
                    </Badge>
                  ) : (
                    <p className="text-xs mt-2 text-muted-foreground">Sin meta asignada</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ── Tendencia de créditos últimos 6 meses ── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Créditos formalizados — últimos 6 meses</CardTitle>
                <CardDescription>Área azul = créditos / línea naranja = meta</CardDescription>
              </CardHeader>
              <CardContent>
                {historico.length === 0 ? (
                  <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">Sin actividad en los últimos 6 meses</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={historico} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                        formatter={(value: number, name: string) => [value, name === 'creditos' ? 'Créditos' : 'Meta']}
                      />
                      <Legend formatter={(v) => v === 'creditos' ? 'Créditos' : 'Meta'} />
                      <Area type="monotone" dataKey="creditos" stroke="#3b82f6" fill="#3b82f620" strokeWidth={2} dot={{ r: 4, fill: '#3b82f6' }} />
                      <Line type="monotone" dataKey="meta_cantidad" stroke="#f97316" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* ── Tendencia de comisiones y tasa de cierre ── */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Comisiones generadas</CardTitle>
                  <CardDescription>Últimos 6 meses</CardDescription>
                </CardHeader>
                <CardContent>
                  {historico.length === 0 ? (
                    <div className="flex items-center justify-center h-[180px] text-sm text-muted-foreground">Sin comisiones registradas</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={historico} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₡${(v/1000).toFixed(0)}K`} />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                          formatter={(v: number) => [fmtCRC(v), 'Comisión']}
                        />
                        <Area type="monotone" dataKey="comision" stroke="#8b5cf6" fill="#8b5cf620" strokeWidth={2} dot={{ r: 3, fill: '#8b5cf6' }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Tasa de cierre</CardTitle>
                  <CardDescription>Créditos / Oportunidades por mes</CardDescription>
                </CardHeader>
                <CardContent>
                  {historico.length === 0 ? (
                    <div className="flex items-center justify-center h-[180px] text-sm text-muted-foreground">Sin oportunidades registradas</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={historico} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                          formatter={(v: number) => [`${v}%`, 'Tasa cierre']}
                        />
                        <Area type="monotone" dataKey="tasa_cierre" stroke="#10b981" fill="#10b98120" strokeWidth={2} dot={{ r: 3, fill: '#10b981' }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

          </div>
        );

        // KPIs globales — solo admin
        const ventasGlobalContent = ventasLoading ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <StatCard title="Vendedores activos"   value={ventasEquipoKPIs?.total_vendedores ?? 0}         icon={Users}      isLoading={false} colorClass="text-blue-600" />
              <StatCard title="Créditos del equipo"  value={ventasEquipoKPIs?.total_creditos ?? 0}           icon={CreditCard} isLoading={false} colorClass="text-green-600" />
              <StatCard title="Monto total colocado" value={fmtCRC(ventasEquipoKPIs?.total_monto ?? 0)}      icon={Banknote}   isLoading={false} colorClass="text-purple-600" />
              <StatCard title="Comisiones generadas" value={fmtCRC(ventasEquipoKPIs?.total_comisiones ?? 0)} icon={DollarSign} isLoading={false} colorClass="text-orange-600" />
            </div>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Alcance de meta por vendedor</CardTitle>
                <CardDescription className="capitalize">{mesActualNombre} {new Date().getFullYear()}</CardDescription>
              </CardHeader>
              <CardContent>
                {(ventasEquipoKPIs?.equipo ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Sin vendedores con meta activa este mes</p>
                ) : (
                  <div className="space-y-3">
                    {ventasEquipoKPIs!.equipo
                      .sort((a, b) => b.alcance_pct - a.alcance_pct)
                      .map((v, i) => (
                        <div key={v.user_id} className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                          <span className="text-sm font-medium w-28 shrink-0 truncate">{v.name}</span>
                          <div className="flex-1">
                            <Progress value={Math.min(v.alcance_pct, 100)} className={cn('h-2', v.alcance_pct >= 100 && '[&>div]:bg-green-500')} />
                          </div>
                          <span className={cn('text-xs font-semibold w-12 text-right', v.alcance_pct >= 100 ? 'text-green-600' : 'text-muted-foreground')}>
                            {v.alcance_pct}%
                          </span>
                          <span className="text-xs text-muted-foreground w-20 text-right">{v.creditos_mes} cred.</span>
                          <span className="text-xs text-muted-foreground w-28 text-right hidden md:block">{fmtCRC(v.monto_colocado)}</span>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );

        const ventasContent = (
          <div className="space-y-6">
            {ventasIndividualContent}
            {ventasGlobalContent}
          </div>
        );

        const sections = [
          // module_key: null = siempre visible, string = requiere can_view en ese módulo
          { id: "ventas",        label: "Ventas",        icon: ShoppingBag,    content: ventasContent,        module: "kpis" },
          { id: "leads",        label: "Leads",         icon: Users,          content: leadsContent,         module: "crm" },
          { id: "opportunities",label: "Oportunidades", icon: Target,         content: opportunitiesContent, module: "oportunidades" },
          { id: "credits",      label: "Créditos",      icon: CreditCard,     content: creditsContent,       module: "creditos" },
          { id: "collections",  label: "Cobros",        icon: Wallet,         content: collectionsContent,   module: "cobros" },
          { id: "agents",       label: "Agentes",       icon: UserCheck,      content: agentsContent,        module: "staff" },
          { id: "gamification", label: "Gamificación",  icon: Gamepad2,       content: gamificationContent,  module: "recompensas" },
          { id: "business",     label: "Negocio",       icon: Building2,      content: businessContent,      module: null },
          { id: "trends",       label: "Tendencias",    icon: LineChartIcon,  content: trendsContent,        module: null },
        ].filter(({ module }) =>
          // full_access ve todo; para el resto se requiere can_view en el módulo correspondiente
          // module: null = solo visible para full_access
          isAdmin
            ? true
            : module === "kpis" && canViewModule("kpis")
        );

        return isMobile ? (
          <Accordion type="single" collapsible className="space-y-2">
            {sections.map(({ id, label, icon: SectionIcon, content }) => (
              <AccordionItem key={id} value={id} className="border rounded-lg px-3">
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center gap-2">
                    <SectionIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">{label}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-1">
                    {content}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full lg:w-auto lg:inline-grid" style={{ gridTemplateColumns: `repeat(${sections.length}, minmax(0, 1fr))` }}>
              {sections.map(({ id, label, icon: SectionIcon }) => (
                <TabsTrigger key={id} value={id} className="gap-1">
                  <SectionIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            {sections.map(({ id, content }) => (
              <TabsContent key={id} value={id} className="space-y-6">
                {content}
              </TabsContent>
            ))}
          </Tabs>
        );
      })()}
      </div>
    </ProtectedPage>
  );
}
