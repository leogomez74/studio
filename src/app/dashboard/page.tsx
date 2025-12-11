// Este es un Componente de Servidor, se renderiza en el servidor para mayor rendimiento.
'use client';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
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
  Users,
  Landmark,
  Handshake,
  UserCheck,
  Activity,
  CircleDollarSign,
  FileDown,
  TrendingDown,
  TrendingUp,
  Receipt,
  FilePlus,
  Briefcase,
} from 'lucide-react';
import { credits, notifications, clients, opportunities, payments, projects, type Project } from '@/lib/data'; // Importamos los datos de ejemplo.
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import { Button } from '@/components/ui/button';

// Preparación de los datos para el gráfico de barras de créditos.
const creditChartData = [
  { status: 'Al día', count: credits.filter((c) => c.status === 'Al día').length },
  { status: 'En mora', count: credits.filter((c) => c.status === 'En mora').length },
  { status: 'Cancelado', count: credits.filter((c) => c.status === 'Cancelado').length },
  {
    status: 'Cobro Judicial',
    count: credits.filter((c) => c.status === 'En cobro judicial').length,
  },
];

// Configuración del gráfico de créditos.
const creditChartConfig = {
  count: {
    label: 'Créditos',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig;


function CreditStatusChart() {
    return (
        <ChartContainer config={creditChartConfig} className="min-h-[200px] w-full">
            <BarChart accessibilityLayer data={creditChartData}>
            <CartesianGrid vertical={false} />
            <XAxis
                dataKey="status"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
            />
            <YAxis />
            <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent />}
            />
            <Bar
                dataKey="count"
                fill="var(--color-count)"
                radius={[4, 4, 0, 0]}
            />
            </BarChart>
        </ChartContainer>
    );
}

// --- Gráfico de Progreso de Proyectos ---

// Función para calcular el progreso de un proyecto
const getProjectProgress = (project: Project) => {
    const totalTasks = project.milestones.reduce((acc, m) => acc + m.tasks.length, 0);
    if (totalTasks === 0) return 0;
    const completedTasks = project.milestones.reduce((acc, m) => acc + m.tasks.filter(t => t.completed).length, 0);
    return (completedTasks / totalTasks) * 100;
}

// Preparación de datos para el gráfico de proyectos
const projectChartData = projects.map(p => ({
    name: p.name,
    progress: getProjectProgress(p),
}));

// Configuración del gráfico de proyectos
const projectChartConfig = {
  progress: {
    label: 'Progreso',
    color: 'hsl(var(--chart-2))',
  },
} satisfies ChartConfig;


function ProjectProgressChart() {
    return (
        <ChartContainer config={projectChartConfig} className="min-h-[200px] w-full">
            <BarChart accessibilityLayer data={projectChartData} layout="vertical">
            <CartesianGrid horizontal={false} />
            <YAxis
                dataKey="name"
                type="category"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                className="text-xs"
            />
            <XAxis type="number" dataKey="progress" hide />
            <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent formatter={(value) => `${Number(value).toFixed(0)}%`} />}
            />
            <Bar
                dataKey="progress"
                fill="var(--color-progress)"
                radius={[5, 5, 5, 5]}
                layout="vertical"
            />
            </BarChart>
        </ChartContainer>
    );
}

/**
 * Componente principal de la página del Dashboard (Panel Principal).
 * Muestra tarjetas con métricas clave y gráficos de resumen.
 */
export default function DashboardPage() {
  // Calculamos el saldo total de la cartera sumando los saldos de todos los créditos.
  const totalBalance = credits.reduce((sum, credit) => sum + credit.balance, 0);
  const totalArrears = credits.filter(c => c.status === 'En mora').reduce((sum, credit) => sum + credit.balance, 0);
  const salesOfTheMonth = credits.filter(c => new Date(c.creationDate).getMonth() === new Date().getMonth()).reduce((sum, c) => sum + c.amount, 0);
  const interestReceived = payments.reduce((sum, p) => sum + p.amount, 0) * 0.2; // Simulación
  const expensesOfTheMonth = 12500000; // Simulación
  const newCredits = credits.filter(c => new Date(c.creationDate) > new Date(new Date().setDate(new Date().getDate() - 30))).length;


  return (
    <div className="space-y-6">
      {/* Sección de tarjetas de métricas clave. */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {/* Tarjeta 1: Saldo de Cartera */}
        <Link href="/dashboard/creditos" className="lg:col-span-2">
            <Card className="transition-all hover:ring-2 hover:ring-primary/50 h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Saldo de Cartera</CardTitle>
                    <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                      {/* Formateamos el número como moneda local. */}
                      ₡{totalBalance.toLocaleString('de-DE')}
                    </div>
                    <p className="text-xs text-muted-foreground">
                    +2.5% desde el mes pasado
                    </p>
                </CardContent>
            </Card>
        </Link>
        {/* Tarjeta 2: Cartera en Mora */}
        <Link href="/dashboard/cobros">
            <Card className="transition-all hover:ring-2 hover:ring-destructive/50 h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Cartera en Mora</CardTitle>
                    <TrendingDown className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-destructive">
                      ₡{totalArrears.toLocaleString('de-DE')}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {credits.filter(c => c.status === 'En mora').length} créditos en mora
                    </p>
                </CardContent>
            </Card>
        </Link>
        {/* Tarjeta 3: Ventas del Mes */}
         <Link href="/dashboard/ventas">
            <Card className="transition-all hover:ring-2 hover:ring-primary/50 h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ventas del Mes</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                      ₡{salesOfTheMonth.toLocaleString('de-DE')}
                    </div>
                     <p className="text-xs text-muted-foreground">
                      Ventas para el mes actual
                    </p>
                </CardContent>
            </Card>
        </Link>
         {/* Tarjeta 4: Intereses Recibidos */}
         <Link href="/dashboard/cobros?tab=abonos">
            <Card className="transition-all hover:ring-2 hover:ring-primary/50 h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Intereses Recibidos</CardTitle>
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                      ₡{interestReceived.toLocaleString('de-DE')}
                    </div>
                     <p className="text-xs text-muted-foreground">
                      Este mes (estimado)
                    </p>
                </CardContent>
            </Card>
        </Link>
        {/* Tarjeta 5: Gastos del Mes */}
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gastos del Mes</CardTitle>
                <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">
                    - ₡{expensesOfTheMonth.toLocaleString('de-DE')}
                </div>
                 <p className="text-xs text-muted-foreground">
                  Gastos operativos
                </p>
            </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Tarjeta Nuevos Créditos */}
        <Link href="/dashboard/creditos">
            <Card className="transition-all hover:ring-2 hover:ring-primary/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Nuevos Créditos</CardTitle>
                    <FilePlus className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">+{newCredits}</div>
                    <p className="text-xs text-muted-foreground">En los últimos 30 días</p>
                </CardContent>
            </Card>
        </Link>
         {/* Tarjeta 3: Nuevas Oportunidades */}
        <Link href="/dashboard/oportunidades">
            <Card className="transition-all hover:ring-2 hover:ring-primary/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Nuevas Oportunidades</CardTitle>
                    <Handshake className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">+{opportunities.length}</div>
                    <p className="text-xs text-muted-foreground">+10 este mes</p>
                </CardContent>
            </Card>
        </Link>
        {/* Tarjeta 4: Clientes Totales */}
        <Link href="/dashboard/clientes">
            <Card className="transition-all hover:ring-2 hover:ring-primary/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Clientes Totales</CardTitle>
                    <UserCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                      {clients.length}
                    </div>
                    <p className="text-xs text-muted-foreground">Total de clientes históricos</p>
                </CardContent>
            </Card>
        </Link>
        {/* Tarjeta Créditos Activos */}
        <Link href="/dashboard/creditos">
            <Card className="transition-all hover:ring-2 hover:ring-primary/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Créditos Activos</CardTitle>
                    <Landmark className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                      {credits.filter((c) => c.status !== 'Cancelado').length}
                    </div>
                    <p className="text-xs text-muted-foreground">+5 nuevos esta semana</p>
                </CardContent>
            </Card>
        </Link>
      </div>


      {/* Sección con el gráfico y la lista de actividad reciente. */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tarjeta del Gráfico de Créditos */}
        <Card>
          <CardHeader>
            <CardTitle>Resumen de Estado de Créditos</CardTitle>
            <CardDescription>
              Un resumen de todos los créditos por su estado actual.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreditStatusChart />
          </CardContent>
        </Card>
        {/* Tarjeta de Progreso de Proyectos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" /> Progreso de Proyectos
            </CardTitle>
            <CardDescription>
              Avance general de los proyectos internos clave.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProjectProgressChart />
          </CardContent>
        </Card>
      </div>

       <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" /> Actividad Reciente
            </CardTitle>
            <CardDescription>
              Un resumen de las últimas notificaciones del sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {notifications.map((item) => (
                <div key={item.id} className="flex items-start gap-4">
                  <Avatar className="h-9 w-9 border">
                    <AvatarImage
                      src={`https://picsum.photos/seed/activity${item.id}/40/40`}
                    />
                    <AvatarFallback>CP</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm">{item.text}</p>
                    <p className="text-xs text-muted-foreground">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
    </div>
  );
}
