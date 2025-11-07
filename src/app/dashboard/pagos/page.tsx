// Importamos los componentes e íconos necesarios.
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
import { Button } from '@/components/ui/button';
import { Upload, PlusCircle, Receipt, AlertTriangle } from 'lucide-react';
// $$$ CONECTOR MYSQL: Se importan los datos de ejemplo de pagos. En el futuro, estos datos provendrán de la tabla de pagos en la base de datos.
import { payments, Payment } from '@/lib/data'; 
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

/**
 * Función para obtener la variante de color de la insignia según la fuente del pago.
 * @param {Payment['source']} source - La fuente del pago ('Planilla', 'Ventanilla', 'Transferencia').
 * @returns {'secondary' | 'outline' | 'default'} La variante de color para el Badge.
 */
const getSourceVariant = (source: Payment['source']) => {
    switch (source) {
        case 'Planilla': return 'secondary';
        case 'Ventanilla': return 'outline';
        case 'Transferencia': return 'default';
        default: return 'outline';
    }
};

/**
 * Componente principal de la página de Gestión de Pagos.
 * Muestra una tabla con el historial de pagos recibidos.
 */
export default function PagosPage() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
            <div>
                <CardTitle>Gestión de Pagos</CardTitle>
                <CardDescription>
                Aplica pagos individuales o masivos desde planillas y visualiza el historial.
                </CardDescription>
            </div>
            <div className="flex items-center gap-2">
                {/* $$$ CONECTOR ERP: La carga de planillas interactuará con el ERP para procesar pagos masivos y conciliar movimientos contables. */}
                <Button variant="outline">
                    <Upload className="mr-2 h-4 w-4" />
                    Cargar Planilla
                </Button>
                {/* $$$ CONECTOR MYSQL: Este botón registrará un nuevo pago en la tabla de pagos de la base de datos. */}
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Registrar Pago
                </Button>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Operación</TableHead>
                    <TableHead>Deudor</TableHead>
                    <TableHead className="text-right">Monto Pagado</TableHead>
                    <TableHead className="text-right">Diferencia</TableHead>
                    <TableHead>Fecha de Pago</TableHead>
                    <TableHead>Fuente</TableHead>
                    <TableHead>
                        <span className="sr-only">Acciones</span>
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {/* $$$ CONECTOR MYSQL: Se itera sobre la lista de pagos. Esto será una consulta a la tabla de pagos (SELECT * FROM pagos). */}
                {payments.map((payment) => (
                    <PaymentTableRow key={payment.id} payment={payment} />
                ))}
            </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}


/**
 * Componente que renderiza una única fila de la tabla de pagos.
 * Usamos React.memo para optimizar el rendimiento, evitando que se vuelva a renderizar si sus props no cambian.
 * @param {{ payment: Payment }} props - Las propiedades del componente, que incluyen un objeto de pago.
 */
const PaymentTableRow = React.memo(function PaymentTableRow({ payment }: { payment: Payment }) {
  return (
    <TableRow>
        <TableCell className="font-medium">
            <Link href={`/dashboard/creditos/${payment.operationNumber}`} className="hover:underline">
                {payment.operationNumber}
            </Link>
        </TableCell>
        <TableCell>{payment.debtorName}</TableCell>
        <TableCell className="text-right font-mono">
            ₡{payment.amount.toLocaleString('de-DE')}
        </TableCell>
        <TableCell className="text-right font-mono">
            {/* Si hay una diferencia en el pago, la mostramos con un ícono de alerta. */}
            {payment.difference ? (
                <div className="flex items-center justify-end gap-2 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                   (₡{payment.difference.toLocaleString('de-DE')})
                </div>
            ) : '-'}
        </TableCell>
        <TableCell>{payment.paymentDate}</TableCell>
        <TableCell>
            <Badge variant={getSourceVariant(payment.source)}>{payment.source}</Badge>
        </TableCell>
         <TableCell className="text-right">
            {/* $$$ CONECTOR ERP: La visualización del recibo podría solicitar el documento al ERP. */}
            <Button variant="ghost" size="icon">
                <Receipt className="h-4 w-4" />
                <span className="sr-only">Ver Recibo</span>
            </Button>
        </TableCell>
    </TableRow>
  );
});
