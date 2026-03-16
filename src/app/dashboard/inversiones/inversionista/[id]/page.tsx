'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MoreHorizontal, FileText, FileSpreadsheet, Loader2, PlusCircle, DollarSign, Paperclip, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ProtectedPage } from '@/components/ProtectedPage';
import api from '@/lib/axios';
import { toastError } from '@/hooks/use-toast';
import type { Investor, Investment, InvestmentPayment } from '@/lib/data';
import { InvestmentFormDialog } from '@/components/investment-form-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { downloadExport } from '@/lib/download-export';
import InvestorDocumentManager from '@/components/investor-document-manager';
import { useToast } from '@/hooks/use-toast';

const fmt = (amount: number, currency: 'CRC' | 'USD') =>
  new Intl.NumberFormat('es-CR', { style: 'currency', currency }).format(amount);

export default function InvestorDetailPage() {
  const params = useParams();
  const investorId = params.id as string;

  const [investor, setInvestor] = useState<Investor | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [allInvestors, setAllInvestors] = useState<Investor[]>([]);
  const { toast } = useToast();

  const fetchInvestor = useCallback(async () => {
    setLoading(true);
    try {
      const [res, invRes] = await Promise.all([
        api.get(`/api/investors/${investorId}`),
        api.get('/api/investors?all=true'),
      ]);
      setInvestor(res.data);
      setAllInvestors(invRes.data);
    } catch {
      toastError('Error al cargar los datos del inversionista.');
    } finally {
      setLoading(false);
    }
  }, [investorId]);

  useEffect(() => { fetchInvestor(); }, [fetchInvestor]);

  const handleDeleteInvestment = async (id: number) => {
    if (!confirm('¿Eliminar esta inversión?')) return;
    try {
      await api.delete(`/api/investments/${id}`);
      fetchInvestor();
    } catch (err: any) { toastError(err?.response?.data?.message || 'Error al eliminar la inversión.'); }
  };

  if (loading) {
    return (
      <ProtectedPage module="inversiones">
        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
      </ProtectedPage>
    );
  }

  if (!investor) {
    return (
      <ProtectedPage module="inversiones">
        <div className="text-center py-16 text-muted-foreground">Inversionista no encontrado.</div>
      </ProtectedPage>
    );
  }

  const activeInvestments = (investor.investments ?? []).filter(i => i.estado === 'Activa');
  const otherInvestments = (investor.investments ?? []).filter(i => i.estado !== 'Activa');

  const documents: any[] = (investor as any).documents ?? [];
  const hasCedulaPasaporte = documents.some(d => d.category === 'cedula_pasaporte');
  const hasContrato = documents.some(d => d.category === 'contrato_inversion');
  const cedulaLabel = investor.tipo_persona === 'Persona Jurídica' ? 'Cédula Jurídica' : 'Cédula / Pasaporte';
  const missingDocs = [
    !hasCedulaPasaporte && cedulaLabel,
    !hasContrato && 'Contrato de Inversionista',
  ].filter(Boolean) as string[];

  const handleNuevaInversion = () => {
    if (missingDocs.length > 0) {
      toast({
        title: 'Documentos requeridos faltantes',
        description: `Para crear una inversión se necesita: ${missingDocs.join(', ')}. Por favor súbalos en el tab "Archivos".`,
        variant: 'destructive',
      });
      return;
    }
    setShowForm(true);
  };

  const totalCRC = activeInvestments.filter(i => i.moneda === 'CRC').reduce((s, i) => s + i.monto_capital, 0);
  const totalUSD = activeInvestments.filter(i => i.moneda === 'USD').reduce((s, i) => s + i.monto_capital, 0);

  return (
    <ProtectedPage module="inversiones">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard/inversiones"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex items-center gap-3 flex-1">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="text-lg">{investor.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">{investor.name}</h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              {investor.cedula && <span>{investor.cedula}</span>}
              {investor.tipo_persona && <span>{investor.tipo_persona}</span>}
              <Badge variant={investor.status === 'Activo' ? 'default' : 'secondary'}>{investor.status}</Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadExport(`/api/investors/${investor.id}/export/pdf`, `inversionista-${investor.name}.pdf`)}>
            <FileText className="h-4 w-4 mr-1" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadExport(`/api/investors/${investor.id}/export/excel`, `inversionista-${investor.name}.xlsx`)}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
          </Button>
          <Button size="sm" className="gap-1" onClick={handleNuevaInversion}>
            <PlusCircle className="h-4 w-4" /> Nueva Inversión
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Inversiones Activas</CardDescription>
            <CardTitle className="text-3xl">{activeInvestments.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Inversiones</CardDescription>
            <CardTitle className="text-3xl">{(investor.investments ?? []).length}</CardTitle>
          </CardHeader>
        </Card>
        {totalCRC > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Capital Activo CRC</CardDescription>
              <CardTitle className="text-2xl">{fmt(totalCRC, 'CRC')}</CardTitle>
            </CardHeader>
          </Card>
        )}
        {totalUSD > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Capital Activo USD</CardDescription>
              <CardTitle className="text-2xl">{fmt(totalUSD, 'USD')}</CardTitle>
            </CardHeader>
          </Card>
        )}
      </div>

      <Tabs defaultValue="activas">
        <TabsList className="mb-4">
          <TabsTrigger value="activas">Inversiones Activas ({activeInvestments.length})</TabsTrigger>
          {otherInvestments.length > 0 && (
            <TabsTrigger value="otras">Otras Inversiones ({otherInvestments.length})</TabsTrigger>
          )}
          <TabsTrigger value="pagos">
            <DollarSign className="h-4 w-4 mr-1" />
            Historial de Pagos ({(investor.payments ?? []).length})
          </TabsTrigger>
          <TabsTrigger value="archivos" className="relative">
            <Paperclip className="h-4 w-4 mr-1" />
            Archivos
            {missingDocs.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold w-4 h-4">
                {missingDocs.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activas">
          <Card>
            <CardHeader>
              <CardTitle>Inversiones Activas</CardTitle>
              <CardDescription>{activeInvestments.length} inversión(es) activa(s)</CardDescription>
            </CardHeader>
            <CardContent>
              <InvestmentsTable investments={activeInvestments} onDelete={handleDeleteInvestment} />
            </CardContent>
          </Card>
        </TabsContent>

        {otherInvestments.length > 0 && (
          <TabsContent value="otras">
            <Card>
              <CardHeader>
                <CardTitle>Otras Inversiones</CardTitle>
                <CardDescription>Inversiones finalizadas, liquidadas o canceladas</CardDescription>
              </CardHeader>
              <CardContent>
                <InvestmentsTable investments={otherInvestments} onDelete={handleDeleteInvestment} />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="pagos">
          <PaymentsTable payments={(investor.payments ?? []) as InvestmentPayment[]} />
        </TabsContent>

        <TabsContent value="archivos">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Paperclip className="h-5 w-5" />
                Archivos del Inversionista
              </CardTitle>
              {missingDocs.length > 0 && (
                <CardDescription className="flex items-center gap-1 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  Documentos requeridos pendientes: {missingDocs.join(', ')}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <InvestorDocumentManager
                investorId={investor.id}
                tipoPersona={investor.tipo_persona}
                initialDocuments={documents}
                onDocumentChange={fetchInvestor}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <InvestmentFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        investment={null}
        investors={allInvestors}
        defaultInvestorId={investor.id}
        onSuccess={fetchInvestor}
      />
    </ProtectedPage>
  );
}

function PaymentsTable({ payments }: { payments: InvestmentPayment[] }) {
  if (payments.length === 0) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground">Sin pagos registrados.</CardContent></Card>;
  }

  const totalCRC = payments.filter(p => p.moneda === 'CRC').reduce((s, p) => s + Number(p.monto), 0);
  const totalUSD = payments.filter(p => p.moneda === 'USD').reduce((s, p) => s + Number(p.monto), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de Pagos</CardTitle>
        <CardDescription>
          {payments.length} pago(s) registrado(s)
          {totalCRC > 0 && <span className="ml-2 font-mono">{fmt(totalCRC, 'CRC')}</span>}
          {totalUSD > 0 && <span className="ml-2 font-mono">{fmt(totalUSD, 'USD')}</span>}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Inversión</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Moneda</TableHead>
                <TableHead>Registrado por</TableHead>
                <TableHead>Comentarios</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.sort((a, b) => new Date(b.fecha_pago).getTime() - new Date(a.fecha_pago).getTime()).map(p => (
                <TableRow key={p.id}>
                  <TableCell>{new Date(p.fecha_pago).toLocaleDateString('es-CR')}</TableCell>
                  <TableCell>
                    {p.investment_id ? (
                      <Link href={`/dashboard/inversiones/${p.investment_id}`} className="font-medium hover:underline">
                        {p.investment?.numero_desembolso ?? `#${p.investment_id}`}
                      </Link>
                    ) : '—'}
                  </TableCell>
                  <TableCell><Badge variant="outline">{p.tipo}</Badge></TableCell>
                  <TableCell className="text-right font-mono font-semibold">{fmt(Number(p.monto), p.moneda)}</TableCell>
                  <TableCell>{p.moneda}</TableCell>
                  <TableCell>{p.registered_by_user?.name ?? '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{p.comentarios ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function InvestmentsTable({ investments, onDelete }: { investments: Investment[]; onDelete: (id: number) => void }) {
  if (investments.length === 0) {
    return <div className="text-center text-muted-foreground py-8">Sin inversiones</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Desembolso</TableHead>
          <TableHead className="text-right">Monto Invertido</TableHead>
          <TableHead className="text-center">Tasa Anual</TableHead>
          <TableHead>Periodicidad</TableHead>
          <TableHead className="text-center">Plazo</TableHead>
          <TableHead>Inicio</TableHead>
          <TableHead>Vencimiento</TableHead>
          <TableHead className="text-right">Interés del Cupón</TableHead>
          <TableHead className="text-right">Retención</TableHead>
          <TableHead className="text-right">Monto Neto</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead><span className="sr-only">Acciones</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {investments.map(inv => (
          <TableRow key={inv.id}>
            <TableCell>
              <Link href={`/dashboard/inversiones/${inv.id}`} className="font-medium hover:underline">
                {inv.numero_desembolso}
              </Link>
            </TableCell>
            <TableCell className="text-right font-mono">{fmt(inv.monto_capital, inv.moneda)}</TableCell>
            <TableCell className="text-center font-mono">{(Number(inv.tasa_anual) * 100).toFixed(2)}%</TableCell>
            <TableCell>{inv.forma_pago}</TableCell>
            <TableCell className="text-center">{inv.plazo_meses}m</TableCell>
            <TableCell>{new Date(inv.fecha_inicio).toLocaleDateString('es-CR')}</TableCell>
            <TableCell>{new Date(inv.fecha_vencimiento).toLocaleDateString('es-CR')}</TableCell>
            <TableCell className="text-right font-mono">{fmt(inv.interes_del_cupon ?? 0, inv.moneda)}</TableCell>
            <TableCell className="text-right font-mono text-destructive">- {fmt(inv.retencion_del_cupon ?? 0, inv.moneda)}</TableCell>
            <TableCell className="text-right font-mono font-semibold text-primary">{fmt(inv.interes_neto_del_cupon ?? 0, inv.moneda)}</TableCell>
            <TableCell>
              <Badge variant={inv.estado === 'Activa' ? 'default' : inv.estado === 'Finalizada' ? 'secondary' : inv.estado === 'Capital Devuelto' ? 'destructive' : 'outline'}>{inv.estado}</Badge>
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                  <DropdownMenuItem asChild><Link href={`/dashboard/inversiones/${inv.id}`}>Ver Detalles</Link></DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadExport(`/api/investments/${inv.id}/export/pdf`, `inversion-${inv.numero_desembolso ?? inv.id}.pdf`)}>Exportar PDF</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => onDelete(inv.id)}>Eliminar</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
        {investments.length > 1 && (() => {
          const currencies = [...new Set(investments.map(i => i.moneda))];
          const hasMultipleCurrencies = currencies.length > 1;
          const rows = currencies.map(currency => {
            const filtered = investments.filter(i => i.moneda === currency);
            const totalCapital = filtered.reduce((s, i) => s + Number(i.monto_capital), 0);
            const totalInteres = filtered.reduce((s, i) => s + Number(i.interes_del_cupon ?? 0), 0);
            const totalRetencion = filtered.reduce((s, i) => s + Number(i.retencion_del_cupon ?? 0), 0);
            const totalNeto = filtered.reduce((s, i) => s + Number(i.interes_neto_del_cupon ?? 0), 0);
            return (
              <TableRow key={`total-${currency}`} className="bg-muted/50 font-bold border-t-2">
                <TableCell>{hasMultipleCurrencies ? `Total ${currency}` : 'Total'}</TableCell>
                <TableCell className="text-right font-mono">{fmt(totalCapital, currency)}</TableCell>
                <TableCell colSpan={5}></TableCell>
                <TableCell className="text-right font-mono">{fmt(totalInteres, currency)}</TableCell>
                <TableCell className="text-right font-mono text-destructive">- {fmt(totalRetencion, currency)}</TableCell>
                <TableCell className="text-right font-mono font-semibold text-primary">{fmt(totalNeto, currency)}</TableCell>
                <TableCell colSpan={2}></TableCell>
              </TableRow>
            );
          });

          const grandCapital = investments.reduce((s, i) => s + Number(i.monto_capital), 0);
          const grandInteres = investments.reduce((s, i) => s + Number(i.interes_del_cupon ?? 0), 0);
          const grandRetencion = investments.reduce((s, i) => s + Number(i.retencion_del_cupon ?? 0), 0);
          const grandNeto = investments.reduce((s, i) => s + Number(i.interes_neto_del_cupon ?? 0), 0);
          const grandTotal = grandCapital + grandInteres - grandRetencion + grandNeto;
          const mainCurrency = currencies[0] ?? 'CRC';

          return (
            <>
              {rows}
              <TableRow className="bg-primary/10 font-bold border-t-2 border-primary text-base">
                <TableCell colSpan={10}></TableCell>
                <TableCell className="text-right font-mono font-semibold text-primary whitespace-nowrap" colSpan={2}>
                  Total Final: {fmt(grandCapital + grandInteres + grandRetencion + grandNeto, mainCurrency)}
                </TableCell>
              </TableRow>
            </>
          );
        })()}
      </TableBody>
    </Table>
  );
}
