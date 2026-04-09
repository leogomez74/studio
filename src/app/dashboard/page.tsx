'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Landmark,
  Handshake,
  UserCheck,
  Activity,
  CircleDollarSign,
  TrendingDown,
  TrendingUp,
  Receipt,
  FilePlus,
  BarChart3,
  Target,
  Percent,
  AlertTriangle,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/contexts/PermissionsContext';

// ── Tipos ────────────────────────────────────────────────────────────────────
interface DashboardSummary {
  portfolioTotal: number;
  portfolioChange: number;
  moraAmount: number;
  moraCount: number;
  ventasMes: number;
  ventasChange: number;
  abonosMes: number;
  abonosChange: number;
  newCredits: number;
  newCreditsChange: number;
  newOpps: number;
  newOppsChange: number;
  totalClients: number;
  activeCredits: number;
  statusBreakdown: Record<string, number>;
  recentActivity: ActivityItem[];
}

interface ActivityItem {
  id: number;
  user_id: number | null;
  user_name: string;
  action: string;
  module: string;
  model_label: string | null;
  created_at: string;
}

interface KpiSummary {
  leads?: { conversionRate?: { value: number; change?: number; target?: number } };
  opportunities?: { winRate?: { value: number; change?: number; target?: number } };
  credits?: { portfolioAtRisk?: { value: number; change?: number; target?: number } };
  collections?: {
    collectionRate?: { value: number; change?: number; target?: number };
    delinquencyRate?: { value: number; change?: number; target?: number };
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatCurrency(value: number): string {
  return '₡' + Math.round(value).toLocaleString('de-DE');
}

function formatChange(change: number) {
  if (change === 0) return null;
  const isPositive = change > 0;
  return (
    <div className={cn('mt-1 flex items-center gap-1 text-xs font-medium', isPositive ? 'text-green-600' : 'text-red-600')}>
      {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      <span>{Math.abs(change)}% vs mes anterior</span>
    </div>
  );
}

const ACTION_LABELS: Record<string, string> = {
  create: 'creó',
  update: 'actualizó',
  delete: 'eliminó',
  login: 'inició sesión',
  logout: 'cerró sesión',
  upload: 'subió archivo en',
  export: 'exportó',
};

const creditChartConfig = {
  count: { label: 'Créditos', color: 'hsl(var(--chart-1))' },
} satisfies ChartConfig;

// ── KPI Widget ────────────────────────────────────────────────────────────────
interface KPIWidgetProps {
  title: string;
  value: number | string;
  unit?: string;
  change?: number;
  target?: number;
  icon: React.ElementType;
  colorClass: string;
  isLoading?: boolean;
  isInverse?: boolean;
}

function KPIWidget({ title, value, unit, change, target, icon: Icon, colorClass, isLoading, isInverse }: KPIWidgetProps) {
  if (isLoading) {
    return (
      <Card className="relative overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
          <Skeleton className="h-8 w-20 mt-2" />
          <Skeleton className="h-2 w-full mt-3" />
        </CardContent>
      </Card>
    );
  }

  const isPositive = isInverse ? (change ?? 0) < 0 : (change ?? 0) > 0;
  const progressValue = target ? Math.min((Number(value) / target) * 100, 100) : 0;

  return (
    <Card className="relative overflow-hidden group hover:shadow-md transition-shadow">
      <div className={cn('absolute inset-0 opacity-5', colorClass.replace('text-', 'bg-'))} />
      <CardContent className="p-4 relative">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</span>
          <div className={cn('p-2 rounded-full bg-background shadow-sm', colorClass)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold">{value}</span>
          {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
        </div>
        {target && (
          <div className="mt-2">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Meta: {target}{unit}</span>
              <span>{progressValue.toFixed(0)}%</span>
            </div>
            <Progress value={progressValue} className="h-1.5" />
          </div>
        )}
        {change !== undefined && (
          <div className={cn('mt-2 flex items-center gap-1 text-xs font-medium', isPositive ? 'text-green-600' : 'text-red-600')}>
            {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            <span>{Math.abs(change)}% vs período anterior</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function DashboardPage() {
  const { canViewModule } = usePermissions();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [kpiData, setKpiData] = useState<KpiSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [kpiLoading, setKpiLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [summaryRes, kpiRes] = await Promise.all([
        api.get('/api/dashboard/summary'),
        api.get('/api/kpis?period=month'),
      ]);
      setSummary(summaryRes.data);
      setKpiData(kpiRes.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setKpiLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Datos del gráfico de créditos
  const creditChartData = summary
    ? [
        { status: 'Activo',      count: summary.statusBreakdown['Activo'] ?? 0 },
        { status: 'Formalizado', count: summary.statusBreakdown['Formalizado'] ?? 0 },
        { status: 'En Mora',     count: summary.statusBreakdown['En Mora'] ?? 0 },
        { status: 'Legal',       count: summary.statusBreakdown['Legal'] ?? 0 },
        { status: 'Cerrado',     count: summary.statusBreakdown['Cerrado'] ?? 0 },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Tarjetas principales */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {canViewModule('creditos') && (
          <Link href="/dashboard/creditos" className="lg:col-span-2">
            <Card className="transition-all hover:ring-2 hover:ring-primary/50 h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Saldo de Cartera</CardTitle>
                <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-40" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">{formatCurrency(summary?.portfolioTotal ?? 0)}</div>
                    {formatChange(summary?.portfolioChange ?? 0)}
                  </>
                )}
              </CardContent>
            </Card>
          </Link>
        )}

        {canViewModule('cobros') && (
          <Link href="/dashboard/cobros">
            <Card className="transition-all hover:ring-2 hover:ring-destructive/50 h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cartera en Mora</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-32" />
                ) : (
                  <>
                    <div className="text-2xl font-bold text-destructive">{formatCurrency(summary?.moraAmount ?? 0)}</div>
                    <p className="text-xs text-muted-foreground mt-1">{summary?.moraCount ?? 0} créditos en mora</p>
                  </>
                )}
              </CardContent>
            </Card>
          </Link>
        )}

        {canViewModule('ventas') && (
          <Link href="/dashboard/ventas">
            <Card className="transition-all hover:ring-2 hover:ring-primary/50 h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ventas del Mes</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-32" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">{formatCurrency(summary?.ventasMes ?? 0)}</div>
                    {formatChange(summary?.ventasChange ?? 0)}
                  </>
                )}
              </CardContent>
            </Card>
          </Link>
        )}

        {canViewModule('cobros') && (
          <Link href="/dashboard/cobros">
            <Card className="transition-all hover:ring-2 hover:ring-primary/50 h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Abonos del Mes</CardTitle>
                <Receipt className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-32" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">{formatCurrency(summary?.abonosMes ?? 0)}</div>
                    {formatChange(summary?.abonosChange ?? 0)}
                  </>
                )}
              </CardContent>
            </Card>
          </Link>
        )}
      </div>

      {/* KPI Summary Widgets */}
      {canViewModule('kpis') && (
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">KPIs Clave</CardTitle>
              </div>
              <Link href="/dashboard/kpis">
                <Button variant="ghost" size="sm" className="text-xs">Ver todos los KPIs →</Button>
              </Link>
            </div>
            <CardDescription>Métricas de rendimiento del último mes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <KPIWidget title="Conversión Leads" value={kpiData?.leads?.conversionRate?.value ?? 0} unit="%" change={kpiData?.leads?.conversionRate?.change} target={kpiData?.leads?.conversionRate?.target ?? 30} icon={Target} colorClass="text-blue-500" isLoading={kpiLoading} />
              <KPIWidget title="Win Rate" value={kpiData?.opportunities?.winRate?.value ?? 0} unit="%" change={kpiData?.opportunities?.winRate?.change} target={kpiData?.opportunities?.winRate?.target ?? 40} icon={CheckCircle} colorClass="text-green-500" isLoading={kpiLoading} />
              <KPIWidget title="Tasa de Cobro" value={kpiData?.collections?.collectionRate?.value ?? 0} unit="%" change={kpiData?.collections?.collectionRate?.change} target={kpiData?.collections?.collectionRate?.target ?? 98} icon={Percent} colorClass="text-emerald-500" isLoading={kpiLoading} />
              <KPIWidget title="Cartera en Riesgo" value={kpiData?.credits?.portfolioAtRisk?.value ?? 0} unit="%" change={kpiData?.credits?.portfolioAtRisk?.change} target={kpiData?.credits?.portfolioAtRisk?.target ?? 5} icon={AlertTriangle} colorClass="text-amber-500" isLoading={kpiLoading} isInverse />
              <KPIWidget title="Morosidad" value={kpiData?.collections?.delinquencyRate?.value ?? 0} unit="%" change={kpiData?.collections?.delinquencyRate?.change} target={kpiData?.collections?.delinquencyRate?.target ?? 5} icon={TrendingDown} colorClass="text-red-500" isLoading={kpiLoading} isInverse />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tarjetas secundarias */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {canViewModule('creditos') && (
          <Link href="/dashboard/creditos">
            <Card className="transition-all hover:ring-2 hover:ring-primary/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Nuevos Créditos</CardTitle>
                <FilePlus className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-8 w-16" /> : (
                  <>
                    <div className="text-2xl font-bold">+{summary?.newCredits ?? 0}</div>
                    <p className="text-xs text-muted-foreground">Últimos 30 días</p>
                    {formatChange(summary?.newCreditsChange ?? 0)}
                  </>
                )}
              </CardContent>
            </Card>
          </Link>
        )}

        {canViewModule('oportunidades') && (
          <Link href="/dashboard/oportunidades">
            <Card className="transition-all hover:ring-2 hover:ring-primary/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Nuevas Oportunidades</CardTitle>
                <Handshake className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-8 w-16" /> : (
                  <>
                    <div className="text-2xl font-bold">+{summary?.newOpps ?? 0}</div>
                    <p className="text-xs text-muted-foreground">Este mes</p>
                    {formatChange(summary?.newOppsChange ?? 0)}
                  </>
                )}
              </CardContent>
            </Card>
          </Link>
        )}

        {canViewModule('crm') && (
          <Link href="/dashboard/clientes">
            <Card className="transition-all hover:ring-2 hover:ring-primary/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Clientes Totales</CardTitle>
                <UserCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-8 w-16" /> : (
                  <>
                    <div className="text-2xl font-bold">{summary?.totalClients ?? 0}</div>
                    <p className="text-xs text-muted-foreground">Histórico</p>
                  </>
                )}
              </CardContent>
            </Card>
          </Link>
        )}

        {canViewModule('creditos') && (
          <Link href="/dashboard/creditos">
            <Card className="transition-all hover:ring-2 hover:ring-primary/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Créditos Activos</CardTitle>
                <Landmark className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-8 w-16" /> : (
                  <>
                    <div className="text-2xl font-bold">{summary?.activeCredits ?? 0}</div>
                    <p className="text-xs text-muted-foreground">En cartera</p>
                  </>
                )}
              </CardContent>
            </Card>
          </Link>
        )}
      </div>

      {/* Gráfico + Actividad reciente */}
      <div className="grid gap-6 lg:grid-cols-2">
        {canViewModule('creditos') && (
          <Card>
            <CardHeader>
              <CardTitle>Estado de Créditos</CardTitle>
              <CardDescription>Distribución actual por estado</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <ChartContainer config={creditChartConfig} className="min-h-[200px] w-full">
                  <BarChart accessibilityLayer data={creditChartData}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="status" tickLine={false} tickMargin={10} axisLine={false} />
                    <YAxis />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" /> Actividad Reciente
            </CardTitle>
            <CardDescription>Últimas acciones registradas en el sistema</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <div className="space-y-4">
                {(summary?.recentActivity ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Sin actividad reciente</p>
                ) : (
                  (summary?.recentActivity ?? []).map((item) => (
                    <div key={item.id} className="flex items-start gap-3">
                      <Avatar className="h-8 w-8 border">
                        <AvatarFallback className="text-xs">
                          {item.user_name?.slice(0, 2).toUpperCase() ?? 'SY'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <span className="font-medium">{item.user_name}</span>
                          {' '}{ACTION_LABELS[item.action] ?? item.action}{' '}
                          <span className="text-muted-foreground">{item.model_label ?? item.module}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(item.created_at).toLocaleString('es-CR', { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                {canViewModule('auditoria') && (
                  <Link href="/dashboard/auditoria">
                    <Button variant="ghost" size="sm" className="w-full text-xs mt-2">Ver toda la actividad →</Button>
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
