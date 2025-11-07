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
import { payments, Payment } from '@/lib/data';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

const getSourceVariant = (source: Payment['source']) => {
    switch (source) {
        case 'Planilla': return 'secondary';
        case 'Ventanilla': return 'outline';
        case 'Transferencia': return 'default';
        default: return 'outline';
    }
};


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
                <Button variant="outline">
                    <Upload className="mr-2 h-4 w-4" />
                    Cargar Planilla
                </Button>
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
                {payments.map((payment) => (
                    <TableRow key={payment.id}>
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
                            <Button variant="ghost" size="icon">
                                <Receipt className="h-4 w-4" />
                                <span className="sr-only">Ver Recibo</span>
                            </Button>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
