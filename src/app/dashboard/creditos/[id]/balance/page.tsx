'use client';

import React, { useState, useEffect, use } from 'react';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  PieChart,
  Activity
} from 'lucide-react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import api from '@/lib/axios';
import { Loader2 } from 'lucide-react';

interface BalanceData {
  credit_id: number;
  numero_operacion: string;
  client_name: string;
  monto_original: number;
  saldo_actual: number;
  total_capital_pagado: number;
  total_intereses_pagados: number;
  total_pagado: number;
  fecha_ultimo_pago: string | null;
  proximo_pago: {
    fecha: string;
    monto: number;
  } | null;
  progreso_pagos: number;
}

function formatCurrency(amount?: number | null): string {
  if (amount === null || amount === undefined) return "0.00";
  return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(amount);
}

function formatDate(dateString?: string | null): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-CR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function CreditBalanceClient({ id }: { id: string }) {
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ type: 'not_found' | 'server' | 'network'; message: string } | null>(null);

  useEffect(() => {
    const fetchBalance = async () => {
      setError(null);
      try {
        const response = await api.get(`/api/credits/${id}/balance`);
        setBalance(response.data);
      } catch (err: any) {
        console.error("Error fetching balance:", err);
        const status = err.response?.status;

        if (status === 404) {
          setError({ type: 'not_found', message: 'Este crédito no tiene información de balance disponible.' });
        } else if (status === 401 || status === 403) {
          setError({ type: 'server', message: 'No tiene permisos para ver esta información.' });
        } else if (!navigator.onLine) {
          setError({ type: 'network', message: 'Sin conexión a internet. Verifique su conexión e intente nuevamente.' });
        } else {
          setError({ type: 'server', message: 'Error al cargar el balance. Intente nuevamente más tarde.' });
        }
      } finally {
        setLoading(false);
      }
    };
    fetchBalance();
  }, [id]);

  if (loading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (error || !balance) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-lg text-muted-foreground">
          {error?.message || 'Información de balance no disponible'}
        </p>
        <Button asChild>
          <Link href={`/dashboard/creditos/${id}`}>Volver al Crédito</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href={`/dashboard/creditos/${id}`}>
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Volver</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Balance General</h1>
            <p className="text-muted-foreground">
              Operación: {balance.numero_operacion} | Cliente: {balance.client_name}
            </p>
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Actual</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(balance.saldo_actual)}</div>
            <p className="text-xs text-muted-foreground">
              De un original de {formatCurrency(balance.monto_original)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Capital Pagado</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(balance.total_capital_pagado)}</div>
            <p className="text-xs text-muted-foreground">
              Amortización principal
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Intereses Pagados</CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(balance.total_intereses_pagados)}</div>
            <p className="text-xs text-muted-foreground">
              Costo financiero acumulado
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Progreso</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{balance.progreso_pagos}%</div>
            <Progress value={balance.progreso_pagos} className="mt-2 h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Detailed Sections */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Payment Status */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Estado de Pagos</CardTitle>
            <CardDescription>Resumen de la actividad reciente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Último Pago Realizado</p>
                <p className="text-sm text-muted-foreground">
                  Fecha de aplicación
                </p>
              </div>
              <div className="font-medium">{formatDate(balance.fecha_ultimo_pago)}</div>
            </div>
            <div className="flex items-center justify-between pt-2">
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Próximo Pago</p>
                <p className="text-sm text-muted-foreground">
                  Vencimiento estimado
                </p>
              </div>
              <div className="text-right">
                <div className="font-medium">{formatDate(balance.proximo_pago?.fecha)}</div>
                <div className="text-sm text-muted-foreground">
                  {formatCurrency(balance.proximo_pago?.monto)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financial Summary */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Resumen Financiero</CardTitle>
            <CardDescription>Distribución total de pagos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total Pagado (Bruto)</span>
                <span className="font-bold">{formatCurrency(balance.total_pagado)}</span>
              </div>
              <div className="h-[1px] bg-border" />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Capital:</span>
                  <div className="font-medium">{formatCurrency(balance.total_capital_pagado)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Intereses:</span>
                  <div className="font-medium">{formatCurrency(balance.total_intereses_pagados)}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function CreditBalancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <CreditBalanceClient id={id} />;
}
