'use client';
import React from 'react';
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { investments, Investment } from '@/lib/data';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

function InvestmentDetailClient({ id }: { id: string }) {
  const investment = investments.find((i) => i.investmentNumber === id);

  if (!investment) {
    return (
      <div className="text-center">
        <p className="text-lg">Inversión no encontrada</p>
        <Button asChild className="mt-4">
          <Link href="/dashboard/inversiones">Volver a Inversiones</Link>
        </Button>
      </div>
    );
  }
  
  const retentionAmount = investment.amount * 0.15;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/dashboard/inversiones">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Volver a Inversiones</span>
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">
            Detalle de Inversión: {investment.investmentNumber}
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>
                  <Link
                    href={`/dashboard/inversionistas?cedula=${investment.investorId}`}
                    className="hover:underline"
                  >
                    {investment.investorName}
                  </Link>
                </CardTitle>
                <CardDescription>
                  Inversionista ID: {investment.investorId}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                 <Select defaultValue={investment.status}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Cambiar estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Activa">Activa</SelectItem>
                      <SelectItem value="Finalizada">Finalizada</SelectItem>
                      <SelectItem value="Liquidada">Liquidada</SelectItem>
                    </SelectContent>
                  </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="grid gap-1">
              <h3 className="font-medium">Monto Invertido</h3>
              <p className="font-mono text-xl font-semibold text-primary">
                {new Intl.NumberFormat('es-CR', { style: 'currency', currency: investment.currency }).format(investment.amount)}
              </p>
            </div>
             <div className="grid gap-1">
              <h3 className="font-medium">Fechas</h3>
              <p className="text-muted-foreground">
                Inicio: {investment.startDate} <br/>
                Final: {investment.endDate}
              </p>
            </div>
             <div className="grid gap-1">
              <h3 className="font-medium">Intereses</h3>
               <p className="text-muted-foreground">
                Tasa Anual: {investment.rate}% <br/>
                Periodicidad: {investment.interestFrequency}
              </p>
            </div>
             <div className="grid gap-1">
                <h3 className="font-medium">Capitalizable</h3>
                <div className="flex items-center gap-2">
                    {investment.isCapitalizable ? <CheckCircle className="h-6 w-6 text-green-600" /> : <XCircle className="h-6 w-6 text-muted-foreground" />}
                    <span className="text-muted-foreground">{investment.isCapitalizable ? 'Sí' : 'No'}</span>
                </div>
            </div>
            <div className="grid gap-1">
                <h3 className="font-medium">Retención (15%)</h3>
                 <p className="font-mono text-destructive">
                    - {new Intl.NumberFormat('es-CR', { style: 'currency', currency: investment.currency }).format(retentionAmount)}
                </p>
            </div>
          </CardContent>
        </Card>

         <Card>
            <CardHeader>
                <CardTitle>Cupones de Intereses</CardTitle>
                <CardDescription>
                Aquí se mostrará la lista de cupones de intereses generados, pagados y sus retenciones.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">Próximamente: Tabla de cupones de intereses.</p>
            </CardContent>
         </Card>

      </div>
    </div>
  );
}

export default function InvestmentDetailPage({ params }: { params: { id: string } }) {
  return <InvestmentDetailClient id={params.id} />
}
