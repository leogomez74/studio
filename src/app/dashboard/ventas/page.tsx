// Importamos los componentes e íconos necesarios para la página de ventas.
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PlusCircle, Target, Building } from 'lucide-react';
import { ProtectedPage } from "@/components/ProtectedPage";
// Importamos los datos de ejemplo para las visitas y metas de venta.
import { salesVisits, salesGoals, SalesVisit } from '@/lib/data';

// Función para determinar el color de la insignia (Badge) según el estado de la visita.
const getStatusVariant = (status: SalesVisit['status']) => {
  switch (status) {
    case 'Planificada':
      return 'secondary';
    case 'Completada':
      return 'default';
    case 'Cancelada':
      return 'destructive';
    default:
      return 'outline';
  }
};

// Esta es la función principal que define la página de Ventas.
export default function VentasPage() {
  return (
    <ProtectedPage module="ventas">
      <div className="space-y-6">
      {/* Tarjeta para las metas de venta */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              <CardTitle>Metas de Venta (Noviembre 2023)</CardTitle>
            </div>
          </div>
          <CardDescription>
            Seguimiento del progreso de las metas de venta de cada vendedor.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          {salesGoals.map((goal) => (
            <div key={goal.id} className="rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={goal.salespersonAvatar} alt={goal.salespersonName} />
                  <AvatarFallback>{goal.salespersonName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{goal.salespersonName}</p>
                  <p className="text-sm text-muted-foreground">{goal.month}</p>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-sm text-muted-foreground">
                    <span>
                        Alcanzado: ₡{goal.achievedAmount.toLocaleString('de-DE')}
                    </span>
                    <span>
                        Meta: ₡{goal.goalAmount.toLocaleString('de-DE')}
                    </span>
                </div>
                <Progress
                  value={(goal.achievedAmount / goal.goalAmount) * 100}
                  className="mt-1 h-2"
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Tarjeta para las visitas planificadas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className='flex items-center gap-2'>
                <Building className="h-5 w-5" />
                <CardTitle>Visitas a Instituciones</CardTitle>
            </div>
            <Button size="sm" className="gap-1">
              <PlusCircle className="h-4 w-4" />
              Planificar Visita
            </Button>
          </div>
          <CardDescription>
            Cronograma de visitas a instituciones para la captación de nuevos clientes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Institución</TableHead>
                <TableHead>Vendedor Asignado</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salesVisits.map((visit) => (
                <TableRow key={visit.id}>
                  <TableCell className="font-medium">{visit.institution}</TableCell>
                  <TableCell>{visit.salesperson}</TableCell>
                  <TableCell>{visit.date}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(visit.status)}>{visit.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
    </ProtectedPage>
  );
}
