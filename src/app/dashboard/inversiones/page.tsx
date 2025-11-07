'use client';

import React from 'react';
import { MoreHorizontal, PlusCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { investments, Investment } from '@/lib/data'; 
import Link from 'next/link';

const getStatusVariant = (status: Investment['status']) => {
  switch (status) {
    case 'Activa':
      return 'default';
    case 'Finalizada':
      return 'secondary';
    case 'Liquidada':
      return 'outline';
    default:
      return 'default';
  }
};

export default function InversionesPage() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
            <div>
                <CardTitle>Inversiones</CardTitle>
                <CardDescription>Gestiona todas las inversiones de capital.</CardDescription>
            </div>
            <Button size="sm" className="gap-1">
                <PlusCircle className="h-4 w-4" />
                Agregar Inversión
            </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Inversionista</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="text-center">Interés (%)</TableHead>
              <TableHead className="text-right">Monto Anual</TableHead>
              <TableHead>Periodicidad</TableHead>
              <TableHead className="text-right">Monto Mensual</TableHead>
              <TableHead className="text-right">Retención (15%)</TableHead>
              <TableHead className="text-right">Monto a Pagar</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {investments.map((investment) => (
              <InvestmentTableRow key={investment.investmentNumber} investment={investment} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function InvestmentTableRow({ investment }: { investment: Investment }) {
  const annualInterest = investment.amount * (investment.rate / 100);
  const monthlyInterest = annualInterest / 12;
  const retention = annualInterest * 0.15;
  
  let paymentAmount = 0;
  switch (investment.interestFrequency) {
    case 'Mensual':
      paymentAmount = annualInterest / 12 - retention / 12;
      break;
    case 'Trimestral':
      paymentAmount = annualInterest / 4 - retention / 4;
      break;
    case 'Semestral':
      paymentAmount = annualInterest / 2 - retention / 2;
      break;
    case 'Anual':
      paymentAmount = annualInterest - retention;
      break;
    default:
      paymentAmount = 0;
  }
  
  return (
      <TableRow className="hover:bg-muted/50">
        <TableCell>
          <Link
            href={`/dashboard/inversiones/${investment.investmentNumber}`}
            className="font-medium hover:underline"
          >
            {investment.investorName}
          </Link>
          <div className="text-sm text-muted-foreground">{investment.investmentNumber}</div>
        </TableCell>
        <TableCell className="text-right font-mono">
          {new Intl.NumberFormat('es-CR', { style: 'currency', currency: investment.currency }).format(investment.amount)}
        </TableCell>
        <TableCell className="text-center font-mono">{investment.rate.toFixed(2)}%</TableCell>
        <TableCell className="text-right font-mono">
            {new Intl.NumberFormat('es-CR', { style: 'currency', currency: investment.currency }).format(annualInterest)}
        </TableCell>
        <TableCell>{investment.interestFrequency}</TableCell>
        <TableCell className="text-right font-mono">
            {new Intl.NumberFormat('es-CR', { style: 'currency', currency: investment.currency }).format(monthlyInterest)}
        </TableCell>
        <TableCell className="text-right font-mono text-destructive">
            - {new Intl.NumberFormat('es-CR', { style: 'currency', currency: investment.currency }).format(retention)}
        </TableCell>
        <TableCell className="text-right font-mono font-semibold text-primary">
            {new Intl.NumberFormat('es-CR', { style: 'currency', currency: investment.currency }).format(paymentAmount)}
        </TableCell>
        <TableCell>
          <Badge variant={getStatusVariant(investment.status)}>
            {investment.status}
          </Badge>
        </TableCell>
        <TableCell>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-haspopup="true" size="icon" variant="ghost">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Alternar menú</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/inversiones/${investment.investmentNumber}`}>
                  Ver Detalles
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>Ver Cupones</DropdownMenuItem>
              <DropdownMenuItem>Liquidar Anticipadamente</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
  );
}
