'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MoreHorizontal, FileText, FileSpreadsheet, Loader2, PlusCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ProtectedPage } from '@/components/ProtectedPage';
import api from '@/lib/axios';
import type { Investor, Investment } from '@/lib/data';
import { InvestmentFormDialog } from '@/components/investment-form-dialog';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

const fmt = (amount: number, currency: 'CRC' | 'USD') =>
  new Intl.NumberFormat('es-CR', { style: 'currency', currency }).format(amount);

export default function InvestorDetailPage() {
  const params = useParams();
  const investorId = params.id as string;

  const [investor, setInvestor] = useState<Investor | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [allInvestors, setAllInvestors] = useState<Investor[]>([]);

  const fetchInvestor = useCallback(async () => {
    setLoading(true);
    try {
      const [res, invRes] = await Promise.all([
        api.get(`/api/investors/${investorId}`),
        api.get('/api/investors?all=true'),
      ]);
      setInvestor(res.data);
      setAllInvestors(invRes.data);
    } catch (err) {
      console.error('Error fetching investor:', err);
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
    } catch (err) { console.error(err); }
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
          <Button variant="outline" size="sm" onClick={() => window.open(`${API_BASE}/api/investors/${investor.id}/export/pdf`, '_blank')}>
            <FileText className="h-4 w-4 mr-1" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open(`${API_BASE}/api/investors/${investor.id}/export/excel`, '_blank')}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
          </Button>
          <Button size="sm" className="gap-1" onClick={() => setShowForm(true)}>
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

      {/* Active investments table */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Inversiones Activas</CardTitle>
          <CardDescription>{activeInvestments.length} inversión(es) activa(s)</CardDescription>
        </CardHeader>
        <CardContent>
          <InvestmentsTable investments={activeInvestments} onDelete={handleDeleteInvestment} />
        </CardContent>
      </Card>

      {/* Other investments */}
      {otherInvestments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Otras Inversiones</CardTitle>
            <CardDescription>Inversiones finalizadas o liquidadas</CardDescription>
          </CardHeader>
          <CardContent>
            <InvestmentsTable investments={otherInvestments} onDelete={handleDeleteInvestment} />
          </CardContent>
        </Card>
      )}

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
          <TableHead className="text-right">Retención 15%</TableHead>
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
              <Badge variant={inv.estado === 'Activa' ? 'default' : inv.estado === 'Finalizada' ? 'secondary' : 'outline'}>{inv.estado}</Badge>
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                  <DropdownMenuItem asChild><Link href={`/dashboard/inversiones/${inv.id}`}>Ver Detalles</Link></DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.open(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'}/api/investments/${inv.id}/export/pdf`, '_blank')}>Exportar PDF</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => onDelete(inv.id)}>Eliminar</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
