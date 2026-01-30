'use client';

export const dynamic = 'force-dynamic';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { MoreHorizontal, PlusCircle, Receipt, AlertTriangle } from 'lucide-react';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { investments, Investment, investors, Investor } from '@/lib/data';
import { ProtectedPage } from "@/components/ProtectedPage"; 
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


// --- Funciones de Inversionistas ---
const InvestorStatusVariant = (status: Investor['status']) => {
  switch (status) {
    case 'Activo': return 'default';
    case 'Inactivo': return 'secondary';
    default: return 'outline';
  }
};

const InvestorTableRow = React.memo(function InvestorTableRow({ investor }: { investor: Investor }) {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={investor.avatarUrl} alt={investor.name} />
            <AvatarFallback>{investor.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="font-medium">{investor.name}</div>
        </div>
      </TableCell>
      <TableCell>{investor.cedula}</TableCell>
      <TableCell className="hidden md:table-cell">
        <div className="text-sm text-muted-foreground">{investor.email}</div>
        <div className="text-sm text-muted-foreground">{investor.phone}</div>
      </TableCell>
      <TableCell>
        <Button variant="link" asChild>
          <Link href={`/dashboard/inversiones?tab=inversiones&investorId=${encodeURIComponent(investor.cedula)}`}>
            <Badge variant="default">{investor.activeInvestments}</Badge>
          </Link>
        </Button>
      </TableCell>
      <TableCell>
        {investor.status && <Badge variant={InvestorStatusVariant(investor.status)}>{investor.status}</Badge>}
      </TableCell>
      <TableCell className="hidden md:table-cell">{investor.registeredOn}</TableCell>
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
            <DropdownMenuItem>Ver Perfil</DropdownMenuItem>
            <DropdownMenuItem>Crear Inversión</DropdownMenuItem>
            <DropdownMenuItem>Editar</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">Eliminar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
});

function InversionistasTable({ initialData }: { initialData: Investor[] }) {
    return (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Inversionista</TableHead>
              <TableHead>Cédula</TableHead>
              <TableHead className="hidden md:table-cell">Contacto</TableHead>
              <TableHead>Inversiones Activas</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden md:table-cell">Registrado El</TableHead>
              <TableHead><span className="sr-only">Acciones</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialData.map((investor) => (
              <InvestorTableRow key={investor.id} investor={investor} />
            ))}
          </TableBody>
        </Table>
    );
}

// --- Funciones de Inversiones ---
const InvestmentStatusVariant = (status: Investment['status']) => {
  switch (status) {
    case 'Activa': return 'default';
    case 'Finalizada': return 'secondary';
    case 'Liquidada': return 'outline';
    default: return 'default';
  }
};

const InvestmentTableRow = React.memo(function InvestmentTableRow({ investment }: { investment: Investment }) {
  const annualInterest = investment.amount * (investment.rate / 100);
  let periodsPerYear = 1;
  switch (investment.interestFrequency) {
    case 'Mensual': periodsPerYear = 12; break;
    case 'Trimestral': periodsPerYear = 4; break;
    case 'Semestral': periodsPerYear = 2; break;
    case 'Anual': periodsPerYear = 1; break;
  }
  const couponInterestBruto = annualInterest / periodsPerYear;
  const couponRetention = couponInterestBruto * 0.15;
  const couponPaymentNeto = couponInterestBruto - couponRetention;

  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell>
        <Link href={`/dashboard/inversiones/${investment.investmentNumber}`} className="font-medium hover:underline">
          {investment.investorName}
        </Link>
        <div className="text-sm text-muted-foreground">{investment.investmentNumber}</div>
      </TableCell>
      <TableCell className="text-right font-mono">{new Intl.NumberFormat('es-CR', { style: 'currency', currency: investment.currency }).format(investment.amount)}</TableCell>
      <TableCell className="text-center font-mono">{investment.rate.toFixed(2)}%</TableCell>
      <TableCell>{investment.interestFrequency}</TableCell>
      <TableCell className="text-right font-mono">{new Intl.NumberFormat('es-CR', { style: 'currency', currency: investment.currency }).format(couponInterestBruto)}</TableCell>
      <TableCell className="text-right font-mono text-destructive">- {new Intl.NumberFormat('es-CR', { style: 'currency', currency: investment.currency }).format(couponRetention)}</TableCell>
      <TableCell className="text-right font-mono font-semibold text-primary">{new Intl.NumberFormat('es-CR', { style: 'currency', currency: investment.currency }).format(couponPaymentNeto)}</TableCell>
      <TableCell><Badge variant={InvestmentStatusVariant(investment.status)}>{investment.status}</Badge></TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Alternar menú</span></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            <DropdownMenuItem asChild><Link href={`/dashboard/inversiones/${investment.investmentNumber}`}>Ver Detalles</Link></DropdownMenuItem>
            <DropdownMenuItem>Ver Cupones</DropdownMenuItem>
            <DropdownMenuItem>Liquidar Anticipadamente</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
});

function InversionesTable({ initialData }: { initialData: Investment[] }) {
    return (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Inversionista</TableHead>
              <TableHead className="text-right">Monto Invertido</TableHead>
              <TableHead className="text-center">Tasa Anual (%)</TableHead>
              <TableHead>Periodicidad</TableHead>
              <TableHead className="text-right">Interés del Cupón (Bruto)</TableHead>
              <TableHead className="text-right">Retención del Cupón (15%)</TableHead>
              <TableHead className="text-right">Monto del Cupón (Neto)</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead><span className="sr-only">Acciones</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialData.map((investment) => (
              <InvestmentTableRow key={investment.investmentNumber} investment={investment} />
            ))}
          </TableBody>
        </Table>
    );
}

// --- Funciones de Pago a Inversionistas ---
const InvestorPaymentTableRow = React.memo(function InvestorPaymentTableRow({ investment }: { investment: Investment }) {
  const annualInterest = investment.amount * (investment.rate / 100);
  let periodsPerYear = 1;
  switch (investment.interestFrequency) {
    case 'Mensual': periodsPerYear = 12; break;
    case 'Trimestral': periodsPerYear = 4; break;
    case 'Semestral': periodsPerYear = 2; break;
    case 'Anual': periodsPerYear = 1; break;
  }
  const couponInterestBruto = annualInterest / periodsPerYear;
  const couponRetention = couponInterestBruto * 0.15;
  const couponPaymentNeto = couponInterestBruto - couponRetention;

  // Simulación de una fecha de pago para el ejemplo
  const paymentDate = new Date();
  paymentDate.setMonth(paymentDate.getMonth() -1);

  return (
    <TableRow>
        <TableCell className="font-medium">
            <Link href={`/dashboard/inversiones/${investment.investmentNumber}`} className="hover:underline">
                {investment.investmentNumber}
            </Link>
             <div className="text-sm text-muted-foreground">{investment.investorName}</div>
        </TableCell>
        <TableCell>{paymentDate.toLocaleDateString('es-CR')}</TableCell>
        <TableCell className="text-right font-mono">{new Intl.NumberFormat('es-CR', { style: 'currency', currency: investment.currency }).format(couponInterestBruto)}</TableCell>
        <TableCell className="text-right font-mono text-destructive">
          - {new Intl.NumberFormat('es-CR', { style: 'currency', currency: investment.currency }).format(couponRetention)}
        </TableCell>
        <TableCell className="text-right font-mono text-primary font-semibold">
          {new Intl.NumberFormat('es-CR', { style: 'currency', currency: investment.currency }).format(couponPaymentNeto)}
        </TableCell>
         <TableCell className="text-right">
            <Button variant="ghost" size="icon"><Receipt className="h-4 w-4" /><span className="sr-only">Ver Comprobante</span></Button>
        </TableCell>
    </TableRow>
  );
});

function InvestorPaymentsTable({ initialData }: { initialData: Investment[] }) {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Inversión</TableHead>
                    <TableHead>Fecha de Pago</TableHead>
                    <TableHead className="text-right">Interés Bruto</TableHead>
                    <TableHead className="text-right">Retención (15%)</TableHead>
                    <TableHead className="text-right">Monto Pagado (Neto)</TableHead>
                    <TableHead><span className="sr-only">Acciones</span></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {initialData.filter(inv => inv.status === 'Activa').map((investment) => (
                    <InvestorPaymentTableRow key={investment.investmentNumber} investment={investment} />
                ))}
            </TableBody>
        </Table>
    );
}

// --- Funciones de Retenciones ---
function RetencionesTable() {
    return (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. Inversión</TableHead>
              <TableHead className="text-right">Monto Invertido</TableHead>
              <TableHead className="text-center">Interés (%)</TableHead>
              <TableHead>Moneda</TableHead>
              <TableHead>Periodicidad</TableHead>
              <TableHead>Fecha Pagado</TableHead>
              <TableHead className="text-right">Monto Retenido (15%)</TableHead>
              <TableHead className="text-right">Monto Pagado (Neto)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {investments.filter(inv => inv.status === 'Activa').map((investment) => {
              const annualInterest = investment.amount * (investment.rate / 100);
              let periodsPerYear = 1;
              switch (investment.interestFrequency) {
                case 'Mensual': periodsPerYear = 12; break;
                case 'Trimestral': periodsPerYear = 4; break;
                case 'Semestral': periodsPerYear = 2; break;
                case 'Anual': periodsPerYear = 1; break;
              }
              const couponInterestBruto = annualInterest / periodsPerYear;
              const couponRetention = couponInterestBruto * 0.15;
              const couponPaymentNeto = couponInterestBruto - couponRetention;
              const paymentDate = new Date();
              paymentDate.setMonth(paymentDate.getMonth() -1);

              return (
                <TableRow key={investment.investmentNumber}>
                  <TableCell><Link href={`/dashboard/inversiones/${investment.investmentNumber}`} className="font-medium hover:underline">{investment.investmentNumber}</Link></TableCell>
                  <TableCell className="text-right font-mono">{new Intl.NumberFormat('es-CR', { style: 'currency', currency: investment.currency }).format(investment.amount)}</TableCell>
                  <TableCell className="text-center font-mono">{investment.rate.toFixed(2)}%</TableCell>
                  <TableCell>{investment.currency}</TableCell>
                  <TableCell>{investment.interestFrequency}</TableCell>
                  <TableCell>{paymentDate.toLocaleDateString('es-CR')}</TableCell>
                  <TableCell className="text-right font-mono text-destructive">-{new Intl.NumberFormat('es-CR', { style: 'currency', currency: investment.currency }).format(couponRetention)}</TableCell>
                  <TableCell className="text-right font-mono font-semibold text-primary">{new Intl.NumberFormat('es-CR', { style: 'currency', currency: investment.currency }).format(couponPaymentNeto)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
    );
}

// --- Componente Principal ---
export default function InversionesPage() {
  const searchParams = useSearchParams();
  const investorId = searchParams.get('investorId');

  const filteredInvestors = investorId ? investors.filter(i => i.cedula === investorId) : investors;
  const filteredInvestments = investorId ? investments.filter(i => i.investorId === investorId) : investments;

  const defaultTab = searchParams.get('tab') || 'inversionistas';

  return (
    <ProtectedPage module="inversiones">
      <Tabs defaultValue={defaultTab}>
      <div className="flex items-center justify-between mb-4">
        <TabsList>
          <TabsTrigger value="inversionistas">Inversionistas</TabsTrigger>
          <TabsTrigger value="inversiones">Inversiones</TabsTrigger>
          <TabsTrigger value="pagos">Pago a Inversionistas</TabsTrigger>
          <TabsTrigger value="retenciones">Retenciones</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">
            <Button size="sm" className="gap-1">
                <PlusCircle className="h-4 w-4" />
                Agregar
            </Button>
        </div>
      </div>
      <TabsContent value="inversionistas">
        <Card>
          <CardHeader>
            <CardTitle>Inversionistas</CardTitle>
            <CardDescription>Gestiona los inversionistas de Credipep.</CardDescription>
          </CardHeader>
          <CardContent>
            <InversionistasTable initialData={filteredInvestors}/>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="inversiones">
        <Card>
          <CardHeader>
            <CardTitle>Inversiones</CardTitle>
            <CardDescription>Gestiona todas las inversiones de capital.</CardDescription>
          </CardHeader>
          <CardContent>
            <InversionesTable initialData={filteredInvestments}/>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="pagos">
        <Card>
          <CardHeader>
            <CardTitle>Pago a Inversionistas</CardTitle>
            <CardDescription>Historial de pagos de intereses (cupones) realizados a los inversionistas.</CardDescription>
          </CardHeader>
          <CardContent>
            <InvestorPaymentsTable initialData={filteredInvestments}/>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="retenciones">
        <Card>
          <CardHeader>
            <CardTitle>Reporte de Retenciones</CardTitle>
            <CardDescription>Detalle de las retenciones aplicadas a los cupones de intereses de los inversionistas.</CardDescription>
          </CardHeader>
          <CardContent>
            <RetencionesTable />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
    </ProtectedPage>
  );
}
