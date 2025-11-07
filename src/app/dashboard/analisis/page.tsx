// Importamos los componentes e íconos necesarios.
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
import { leads, Lead } from '@/lib/data';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

// Función para obtener la variante de la insignia según el puesto.
const getPuestoVariant = (puesto: Lead['puesto']) => {
  return puesto === 'En Propiedad' ? 'default' : 'secondary';
};

export default function AnalisisPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Análisis de Crédito</CardTitle>
        <CardDescription>
          Analiza el riesgo crediticio de los leads para la toma de decisiones.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Cédula</TableHead>
              <TableHead className="text-center">Juicios</TableHead>
              <TableHead className="text-center">Manchas</TableHead>
              <TableHead>Puesto</TableHead>
              <TableHead>Antigüedad</TableHead>
              <TableHead className="text-right">Salario Base</TableHead>
              <TableHead className="text-right">Salario Neto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => (
              <TableRow key={lead.id}>
                <TableCell className="font-medium">{lead.name}</TableCell>
                <TableCell>{lead.cedula}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={lead.juicios > 0 ? "destructive" : "secondary"}>
                    {lead.juicios > 0 && <AlertTriangle className="mr-1 h-3 w-3"/>}
                    {lead.juicios}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                   <Badge variant={lead.manchas > 0 ? "destructive" : "secondary"}>
                    {lead.manchas > 0 && <AlertTriangle className="mr-1 h-3 w-3"/>}
                    {lead.manchas}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={getPuestoVariant(lead.puesto)}>
                    {lead.puesto === 'En Propiedad' && <ShieldCheck className="mr-1 h-3 w-3"/>}
                    {lead.puesto}
                  </Badge>
                </TableCell>
                <TableCell>{lead.antiguedad}</TableCell>
                <TableCell className="text-right font-mono">
                  ₡{lead.salarioBase.toLocaleString('de-DE')}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  ₡{lead.salarioNeto.toLocaleString('de-DE')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
