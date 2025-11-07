// Importamos los componentes e íconos necesarios para la página.
// 'use client' indica que es un componente de cliente, necesario para usar hooks como useState.
'use client';
import React from 'react';
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
// $$$ CONECTOR MYSQL: Se importan los datos de ejemplo. En el futuro, esta información vendrá de la base de datos.
import { leads, opportunities, Lead, Opportunity } from '@/lib/data'; 
import { AlertTriangle, ShieldCheck } from 'lucide-react';

/**
 * Función para obtener la variante de color de la insignia según el tipo de puesto del lead.
 * @param {Lead['puesto']} puesto - El tipo de puesto ('En Propiedad' o 'Interino').
 * @returns {'default' | 'secondary'} La variante de color para el Badge.
 */
const getPuestoVariant = (puesto: Lead['puesto']) => {
  return puesto === 'En Propiedad' ? 'default' : 'secondary';
};

/**
 * Función para obtener la variante de color de la insignia según el estado de la oportunidad.
 * @param {Opportunity['status'] | 'Sin Iniciar'} status - El estado de la oportunidad.
 * @returns {'default' | 'secondary' | 'destructive' | 'outline'} La variante de color para el Badge.
 */
const getStatusVariant = (status: Opportunity['status'] | 'Sin Iniciar') => {
    switch (status) {
        case 'Convertido': return 'default';
        case 'Aceptada': return 'default';
        case 'En proceso': return 'secondary';
        case 'Rechazada': return 'destructive';
        default: return 'outline';
    }
}

/**
 * Componente de la página de Análisis de Crédito.
 * Muestra una tabla con información detallada de los leads para evaluar su riesgo crediticio.
 */
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
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* $$$ CONECTOR MYSQL: Se itera sobre los datos de leads. En el futuro, esta consulta se hará a la base de datos. */}
            {leads.map((lead) => {
              // $$$ CONECTOR MYSQL: Se busca la oportunidad asociada. Esto será una consulta relacionada en la base de datos.
              const opportunity = opportunities.find(op => op.leadCedula === lead.cedula);
              // Determinamos el estado: si hay oportunidad, usamos su estado; si no, 'Sin Iniciar'.
              const status = opportunity ? opportunity.status : 'Sin Iniciar';

              return (
              <TableRow key={lead.id}>
                <TableCell className="font-medium">{lead.name}</TableCell>
                <TableCell>{lead.cedula}</TableCell>
                <TableCell className="text-center">
                  {/* Insignia para mostrar la cantidad de juicios. Es destructiva si hay más de 0. */}
                  <Badge variant={lead.juicios > 0 ? "destructive" : "secondary"}>
                    {lead.juicios > 0 && <AlertTriangle className="mr-1 h-3 w-3"/>}
                    {lead.juicios}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                   {/* Insignia para mostrar la cantidad de manchas. Es destructiva si hay más de 0. */}
                   <Badge variant={lead.manchas > 0 ? "destructive" : "secondary"}>
                    {lead.manchas > 0 && <AlertTriangle className="mr-1 h-3 w-3"/>}
                    {lead.manchas}
                  </Badge>
                </TableCell>
                <TableCell>
                  {/* Insignia para el tipo de puesto, con un ícono para 'En Propiedad'. */}
                  <Badge variant={getPuestoVariant(lead.puesto)}>
                    {lead.puesto === 'En Propiedad' && <ShieldCheck className="mr-1 h-3 w-3"/>}
                    {lead.puesto}
                  </Badge>
                </TableCell>
                <TableCell>{lead.antiguedad}</TableCell>
                <TableCell className="text-right font-mono">
                  {/* Formateamos el salario a un formato de moneda local. */}
                  ₡{lead.salarioBase.toLocaleString('de-DE')}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  ₡{lead.salarioNeto.toLocaleString('de-DE')}
                </TableCell>
                <TableCell>
                  {/* Insignia que muestra el estado de la oportunidad. */}
                  <Badge variant={getStatusVariant(status)}>{status}</Badge>
                </TableCell>
              </TableRow>
            )})}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
