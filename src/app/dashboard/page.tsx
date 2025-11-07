// Este es un Componente de Servidor, se renderiza en el servidor para mayor rendimiento.
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
} from 'lucide-react';
import { credits, notifications, clients, opportunities } from '@/lib/data'; // Importamos los datos de ejemplo.
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';

// Preparación de los datos para el gráfico de barras.
// Contamos la cantidad de créditos por cada estado.
const chartData = [
  { status: 'Al día', count: credits.filter((c) => c.status === 'Al día').length },
  { status: 'En mora', count: credits.filter((c) => c.status === 'En mora').length },
  { status: 'Cancelado', count: credits.filter((c) => c.status === 'Cancelado').length },
  {
    status: 'Cobro Judicial',
    count: credits.filter((c) => c.status === 'En cobro judicial').length,
  },
];

// Configuración del gráfico, define la etiqueta y el color para la serie de datos.
const chartConfig = {
  count: {
    label: 'Créditos',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig;

/**
 * Componente principal de la página del Dashboard (Panel Principal).
 * Muestra tarjetas con métricas clave y gráficos de resumen.
 */
export default function DashboardPage() {
  // Calculamos el saldo total de la cartera sumando los saldos de todos los créditos.
  const totalBalance = credits.reduce((sum, credit) => sum + credit.balance, 0);

  return (
    <div className="space-y-6">
      {/* Sección de tarjetas de métricas clave. */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Tarjeta 1: Saldo de Cartera */}
        <Link href="/dashboard/creditos">
            <Card className="transition-all hover:ring-2 hover:ring-primary/50">
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
        {/* Tarjeta 2: Créditos Activos */}
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
        {/* Tarjeta 3: Nuevas Oportunidades */}
        <Link href="/dashboard/oportunidades">
            <Card className="transition-all hover:ring-2 hover:ring-primary/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Nuevas Oportunidades</CardTitle>
                    <Handshake className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{opportunities.length}</div>
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
      </div>

      {/* Sección con el gráfico y la lista de actividad reciente. */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tarjeta del Gráfico */}
        <Card>
          <CardHeader>
            <CardTitle>Resumen de Estado de Créditos</CardTitle>
            <CardDescription>
              Un resumen de todos los créditos por su estado actual.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Contenedor del gráfico que lo hace responsivo. */}
            <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
              <BarChart accessibilityLayer data={chartData}>
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
          </CardContent>
        </Card>
        {/* Tarjeta de Actividad Reciente */}
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
    </div>
  );
}
