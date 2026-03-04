'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { MoreHorizontal, PlusCircle, FileText, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ProtectedPage } from "@/components/ProtectedPage";
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import api from '@/lib/axios';
import type { Investor, Investment, InvestmentPayment } from '@/lib/data';
import { InvestmentFormDialog } from '@/components/investment-form-dialog';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

const fmt = (amount: number, currency: 'CRC' | 'USD') =>
  new Intl.NumberFormat('es-CR', { style: 'currency', currency }).format(amount);

// --- Inversionistas Table ---
const InvestorTableRow = React.memo(function InvestorTableRow({ investor, onDelete }: { investor: Investor; onDelete: (id: number) => void }) {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
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
      <TableCell className="hidden md:table-cell">{investor.tipo_persona}</TableCell>
      <TableCell>
        <Button variant="link" asChild>
          <Link href={`/dashboard/inversiones?tab=inversiones&investorId=${investor.id}`}>
            <Badge variant="default">{investor.active_investments_count ?? 0}</Badge>
          </Link>
        </Button>
      </TableCell>
      <TableCell>
        <Badge variant={investor.status === 'Activo' ? 'default' : 'secondary'}>{investor.status}</Badge>
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            <DropdownMenuItem asChild><Link href={`/dashboard/inversiones?tab=inversiones&investorId=${investor.id}`}>Ver Inversiones</Link></DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.open(`${API_BASE}/api/investors/${investor.id}/export/pdf`, '_blank')}>Exportar PDF</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => onDelete(investor.id)}>Eliminar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
});

// --- Inversiones Table ---
const InvestmentTableRow = React.memo(function InvestmentTableRow({ investment, onDelete }: { investment: Investment; onDelete: (id: number) => void }) {
  const interesCupon = investment.interes_del_cupon ?? 0;
  const retencionCupon = interesCupon * 0.15;
  const netoCupon = interesCupon - retencionCupon;

  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell>
        <Link href={`/dashboard/inversiones/${investment.id}`} className="font-medium hover:underline">
          {investment.investor?.name ?? '—'}
        </Link>
        <div className="text-sm text-muted-foreground">{investment.numero_desembolso}</div>
      </TableCell>
      <TableCell className="text-right font-mono">{fmt(investment.monto_capital, investment.moneda)}</TableCell>
      <TableCell className="text-center font-mono">{(Number(investment.tasa_anual) * 100).toFixed(2)}%</TableCell>
      <TableCell>{investment.forma_pago}</TableCell>
      <TableCell className="text-right font-mono">{fmt(interesCupon, investment.moneda)}</TableCell>
      <TableCell className="text-right font-mono text-destructive">- {fmt(retencionCupon, investment.moneda)}</TableCell>
      <TableCell className="text-right font-mono font-semibold text-primary">{fmt(netoCupon, investment.moneda)}</TableCell>
      <TableCell><Badge variant={investment.estado === 'Activa' ? 'default' : investment.estado === 'Finalizada' ? 'secondary' : 'outline'}>{investment.estado}</Badge></TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            <DropdownMenuItem asChild><Link href={`/dashboard/inversiones/${investment.id}`}>Ver Detalles</Link></DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.open(`${API_BASE}/api/investments/${investment.id}/export/pdf`, '_blank')}>Exportar PDF</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => onDelete(investment.id)}>Eliminar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
});

// --- Tabla General ---
function TablaGeneralSection({ data }: { data: any }) {
  if (!data) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const renderSection = (title: string, section: any, currency: 'CRC' | 'USD') => (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-2 bg-primary text-primary-foreground px-3 py-1.5 rounded">{title}</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Inversionista</TableHead>
            <TableHead className="text-right">Monto Capital</TableHead>
            <TableHead className="text-center">Plazo</TableHead>
            <TableHead>Inicio</TableHead>
            <TableHead>Vencimiento</TableHead>
            <TableHead className="text-center">Tasa</TableHead>
            <TableHead className="text-right">Int. Mensual</TableHead>
            <TableHead className="text-right">Retención 15%</TableHead>
            <TableHead className="text-right">Int. Neto</TableHead>
            <TableHead>Forma Pago</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {section.inversiones.map((inv: any) => (
            <TableRow key={inv.id}>
              <TableCell>{inv.numero_desembolso}</TableCell>
              <TableCell>{inv.investor?.name ?? '—'}</TableCell>
              <TableCell className="text-right font-mono">{fmt(inv.monto_capital, currency)}</TableCell>
              <TableCell className="text-center">{inv.plazo_meses}m</TableCell>
              <TableCell>{new Date(inv.fecha_inicio).toLocaleDateString('es-CR')}</TableCell>
              <TableCell>{new Date(inv.fecha_vencimiento).toLocaleDateString('es-CR')}</TableCell>
              <TableCell className="text-center">{(Number(inv.tasa_anual) * 100).toFixed(2)}%</TableCell>
              <TableCell className="text-right font-mono">{fmt(inv.interes_mensual, currency)}</TableCell>
              <TableCell className="text-right font-mono">{fmt(inv.retencion_mensual, currency)}</TableCell>
              <TableCell className="text-right font-mono font-semibold">{fmt(inv.interes_neto_mensual, currency)}</TableCell>
              <TableCell>{inv.forma_pago}</TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-muted font-bold">
            <TableCell colSpan={2}>TOTALES</TableCell>
            <TableCell className="text-right font-mono">{fmt(section.total_capital, currency)}</TableCell>
            <TableCell colSpan={4}></TableCell>
            <TableCell className="text-right font-mono">{fmt(section.total_interes_mensual, currency)}</TableCell>
            <TableCell className="text-right font-mono">{fmt(section.total_retencion, currency)}</TableCell>
            <TableCell className="text-right font-mono">{fmt(section.total_neto, currency)}</TableCell>
            <TableCell></TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );

  return (
    <>
      {renderSection('DÓLARES (USD)', data.dolares, 'USD')}
      {renderSection('COLONES (CRC)', data.colones, 'CRC')}
    </>
  );
}

// --- Main Page ---
export default function InversionesPage() {
  const searchParams = useSearchParams();
  const investorIdFilter = searchParams.get('investorId');
  const defaultTab = searchParams.get('tab') || 'inversionistas';

  const [investors, setInvestors] = useState<Investor[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [payments, setPayments] = useState<InvestmentPayment[]>([]);
  const [tablaGeneral, setTablaGeneral] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, investRes, payRes] = await Promise.all([
        api.get('/api/investors?all=true'),
        api.get(`/api/investments?all=true${investorIdFilter ? `&investor_id=${investorIdFilter}` : ''}`),
        api.get('/api/investment-payments?all=true'),
      ]);
      setInvestors(invRes.data);
      setInvestments(investRes.data);
      setPayments(payRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [investorIdFilter]);

  const fetchTablaGeneral = useCallback(async () => {
    try {
      const res = await api.get('/api/investments/tabla-general');
      setTablaGeneral(res.data);
    } catch (err) {
      console.error('Error fetching tabla general:', err);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDeleteInvestor = async (id: number) => {
    if (!confirm('¿Eliminar este inversionista y todas sus inversiones?')) return;
    try {
      await api.delete(`/api/investors/${id}`);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleDeleteInvestment = async (id: number) => {
    if (!confirm('¿Eliminar esta inversión?')) return;
    try {
      await api.delete(`/api/investments/${id}`);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const filteredInvestors = investorIdFilter ? investors.filter(i => i.id === Number(investorIdFilter)) : investors;

  if (loading) {
    return (
      <ProtectedPage module="inversiones">
        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
      </ProtectedPage>
    );
  }

  return (
    <ProtectedPage module="inversiones">
      <Tabs defaultValue={defaultTab} onValueChange={(v) => { if (v === 'tabla-general') fetchTablaGeneral(); }}>
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="inversionistas">Inversionistas</TabsTrigger>
            <TabsTrigger value="inversiones">Inversiones</TabsTrigger>
            <TabsTrigger value="tabla-general">Tabla General</TabsTrigger>
            <TabsTrigger value="pagos">Pagos</TabsTrigger>
            <TabsTrigger value="retenciones">Retenciones</TabsTrigger>
          </TabsList>
          <Button size="sm" className="gap-1" onClick={() => { setEditingInvestment(null); setShowForm(true); }}>
            <PlusCircle className="h-4 w-4" /> Nueva Inversión
          </Button>
        </div>

        {/* Inversionistas */}
        <TabsContent value="inversionistas">
          <Card>
            <CardHeader>
              <CardTitle>Inversionistas</CardTitle>
              <CardDescription>Gestiona los inversionistas de Credipep.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Inversionista</TableHead>
                    <TableHead>Cédula</TableHead>
                    <TableHead className="hidden md:table-cell">Contacto</TableHead>
                    <TableHead className="hidden md:table-cell">Tipo</TableHead>
                    <TableHead>Inversiones Activas</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead><span className="sr-only">Acciones</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvestors.map(investor => (
                    <InvestorTableRow key={investor.id} investor={investor} onDelete={handleDeleteInvestor} />
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inversiones */}
        <TabsContent value="inversiones">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Inversiones</CardTitle>
                  <CardDescription>Gestiona todas las inversiones de capital.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => window.open(`${API_BASE}/api/investments/export/tabla-general-pdf`, '_blank')}>
                    <FileText className="h-4 w-4 mr-1" /> PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.open(`${API_BASE}/api/investments/export/tabla-general-excel`, '_blank')}>
                    <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Inversionista</TableHead>
                    <TableHead className="text-right">Monto Invertido</TableHead>
                    <TableHead className="text-center">Tasa Anual</TableHead>
                    <TableHead>Periodicidad</TableHead>
                    <TableHead className="text-right">Interés del Cupón</TableHead>
                    <TableHead className="text-right">Retención 15%</TableHead>
                    <TableHead className="text-right">Monto Neto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead><span className="sr-only">Acciones</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {investments.map(investment => (
                    <InvestmentTableRow key={investment.id} investment={investment} onDelete={handleDeleteInvestment} />
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tabla General */}
        <TabsContent value="tabla-general">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Tabla General de Inversiones</CardTitle>
                  <CardDescription>Resumen agrupado por moneda con totales.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => window.open(`${API_BASE}/api/investments/export/tabla-general-pdf`, '_blank')}>
                    <FileText className="h-4 w-4 mr-1" /> PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.open(`${API_BASE}/api/investments/export/tabla-general-excel`, '_blank')}>
                    <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <TablaGeneralSection data={tablaGeneral} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pagos */}
        <TabsContent value="pagos">
          <Card>
            <CardHeader>
              <CardTitle>Pago a Inversionistas</CardTitle>
              <CardDescription>Historial de pagos registrados.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Inversión</TableHead>
                    <TableHead>Inversionista</TableHead>
                    <TableHead>Fecha de Pago</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Moneda</TableHead>
                    <TableHead>Comentarios</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.investment?.numero_desembolso ?? '—'}</TableCell>
                      <TableCell>{p.investor?.name ?? '—'}</TableCell>
                      <TableCell>{new Date(p.fecha_pago).toLocaleDateString('es-CR')}</TableCell>
                      <TableCell><Badge variant="outline">{p.tipo}</Badge></TableCell>
                      <TableCell className="text-right font-mono">{fmt(p.monto, p.moneda)}</TableCell>
                      <TableCell>{p.moneda}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{p.comentarios}</TableCell>
                    </TableRow>
                  ))}
                  {payments.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin pagos registrados</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Retenciones */}
        <TabsContent value="retenciones">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Reporte de Retenciones</CardTitle>
                  <CardDescription>Retenciones aplicadas a los cupones de intereses.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => window.open(`${API_BASE}/api/investments/export/retenciones-pdf`, '_blank')}>
                    <FileText className="h-4 w-4 mr-1" /> PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.open(`${API_BASE}/api/investments/export/retenciones-excel`, '_blank')}>
                    <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. Inversión</TableHead>
                    <TableHead className="text-right">Monto Invertido</TableHead>
                    <TableHead className="text-center">Tasa</TableHead>
                    <TableHead>Moneda</TableHead>
                    <TableHead>Periodicidad</TableHead>
                    <TableHead className="text-right">Retención Mensual (15%)</TableHead>
                    <TableHead className="text-right">Interés Neto Mensual</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {investments.filter(inv => inv.estado === 'Activa').map(inv => (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <Link href={`/dashboard/inversiones/${inv.id}`} className="font-medium hover:underline">{inv.numero_desembolso}</Link>
                      </TableCell>
                      <TableCell className="text-right font-mono">{fmt(inv.monto_capital, inv.moneda)}</TableCell>
                      <TableCell className="text-center font-mono">{(Number(inv.tasa_anual) * 100).toFixed(2)}%</TableCell>
                      <TableCell>{inv.moneda}</TableCell>
                      <TableCell>{inv.forma_pago}</TableCell>
                      <TableCell className="text-right font-mono text-destructive">- {fmt(inv.retencion_mensual ?? 0, inv.moneda)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold text-primary">{fmt(inv.interes_neto_mensual ?? 0, inv.moneda)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <InvestmentFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        investment={editingInvestment}
        investors={investors}
        onSuccess={fetchData}
      />
    </ProtectedPage>
  );
}
