'use client';

import React, { useState, useEffect, use } from 'react';
import {
  ArrowLeft,
  Paperclip,
  FileText,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  ClipboardCheck,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import api from '@/lib/axios';
import { CaseChat } from '@/components/case-chat';
import { DocumentManager } from '@/components/document-manager';

// Interfaces
interface CreditDocument {
  id: number;
  credit_id: number;
  name: string;
  notes: string | null;
  url?: string | null;
  path?: string | null;
  mime_type?: string | null;
  size?: number | null;
  created_at: string;
  updated_at: string;
}

interface CreditPayment {
  id: number;
  credit_id: number;
  numero_cuota: number;
  proceso: string | null;
  fecha_cuota: string;
  fecha_pago: string | null;
  cuota: number;
  cargos: number;
  poliza: number;
  interes_corriente: number;
  interes_moratorio: number;
  amortizacion: number;
  saldo_anterior: number;
  nuevo_saldo: number;
  estado: string;
  fecha_movimiento: string | null;
  movimiento_total: number;
  // New fields
  linea?: string | null;
  fecha_inicio?: string | null;
  fecha_corte?: string | null;
  tasa_actual?: number | null;
  plazo_actual?: number | null;
  dias?: number | null;
  dias_mora?: number | null;
}

interface PlanDePago {
  id: number;
  credit_id: number;
  linea: string | null;
  numero_cuota: number;
  proceso: string | null;
  fecha_inicio: string | null;
  fecha_corte: string | null;
  fecha_pago: string | null;
  tasa_actual: number;
  plazo_actual: number;
  cuota: number;
  cargos: number;
  poliza: number;
  interes_corriente: number;
  interes_moratorio: number;
  amortizacion: number;
  saldo_anterior: number;
  saldo_nuevo: number;
  dias: number;
  estado: string | null;
  dias_mora: number;
  fecha_movimiento: string | null;
  movimiento_total: number;
  movimiento_cargos: number;
  movimiento_poliza: number;
  movimiento_interes_corriente: number;
  movimiento_interes_moratorio: number;
  movimiento_principal: number;
  movimiento_caja_usuario: string | null;
  tipo_documento: string | null;
  numero_documento: string | null;
  concepto: string | null;
  created_at: string;
  updated_at: string;
}

interface ClientOption {
  id: number;
  name: string;
  cedula: string;
  email: string;
  phone: string;
  ocupacion?: string;
  departamento_cargo?: string;
}

interface CreditItem {
  id: number;
  reference: string;
  title: string;
  status: string | null;
  category: string | null;
  assigned_to: string | null;
  progress: number;
  opened_at: string | null;
  description: string | null;
  lead_id: number;
  lead?: {
    id: number;
    name: string;
    documents?: CreditDocument[];
  } | null;
  opportunity_id: string | null;
  client?: ClientOption | null;
  opportunity?: { id: string; title: string | null } | null;
  created_at?: string | null;
  updated_at?: string | null;
  documents?: CreditDocument[];
  payments?: CreditPayment[];
  plan_de_pagos?: PlanDePago[];
  tipo_credito?: string | null;
  numero_operacion?: string | null;
  monto_credito?: number | null;
  cuota?: number | null;
  fecha_ultimo_pago?: string | null;
  garantia?: string | null;
  fecha_culminacion_credito?: string | null;
  tasa_anual?: number | null;
  plazo?: number | null;
  cuotas_atrasadas?: number | null;
  deductora?: { id: number; nombre: string } | null;
  divisa?: string | null;
  linea?: string | null;
  primera_deduccion?: string | null;
  saldo?: number | null;
  proceso?: string | null;
}

function formatDate(dateString?: string | null): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-CR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function formatCurrency(amount?: number | null): string {
  if (amount === null || amount === undefined) return "0.00";
  return new Intl.NumberFormat('es-CR', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

function CreditDetailClient({ id }: { id: string }) {
  const [credit, setCredit] = useState<CreditItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPanelVisible, setIsPanelVisible] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState('pagare');

  useEffect(() => {
    const fetchCredit = async () => {
      try {
        const response = await api.get(`/api/credits/${id}`);
        setCredit(response.data);
      } catch (error) {
        console.error("Error fetching credit:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCredit();
  }, [id]);

  if (loading) {
    return <div className="flex h-full items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!credit) {
    return (
      <div className="text-center p-8">
        <p className="text-lg">Crédito no encontrado</p>
        <Button asChild className="mt-4">
          <Link href="/dashboard/creditos">Volver a Créditos</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/dashboard/creditos">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Volver a Créditos</span>
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">
            Detalle del Crédito: {credit.numero_operacion || credit.reference}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href={`/dashboard/creditos/${id}/balance`} target="_blank">
              <FileText className="mr-2 h-4 w-4" />
              Balance General
            </Link>
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="space-y-6">
          <Tabs defaultValue="credito" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="credito">Crédito</TabsTrigger>
              <TabsTrigger value="plan-pagos">Plan de Pagos</TabsTrigger>
            </TabsList>

            <TabsContent value="credito">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                <div className={isPanelVisible ? 'space-y-6 lg:col-span-3' : 'space-y-6 lg:col-span-5'}>
                  {/* Main Info Card */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle>
                            <Link href={`/dashboard/clientes/${credit.lead_id}`} className="hover:underline">
                              {credit.client?.name || "Cliente Desconocido"}
                            </Link>
                          </CardTitle>
                          <CardDescription>
                            Institución: {credit.client?.ocupacion || "-"}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={credit.status === 'Activo' ? 'default' : 'secondary'}>
                            {credit.status}
                          </Badge>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => setIsPanelVisible(!isPanelVisible)}
                                >
                                  {isPanelVisible ? (
                                    <PanelRightClose className="h-4 w-4" />
                                  ) : (
                                    <PanelRightOpen className="h-4 w-4" />
                                  )}
                                  <span className="sr-only">Toggle Panel</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{isPanelVisible ? 'Ocultar Panel' : 'Mostrar Panel'}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                      <div className="grid gap-1">
                        <h3 className="font-medium">Monto Otorgado</h3>
                        <p className="text-muted-foreground">
                          ₡{formatCurrency(credit.monto_credito)}
                        </p>
                      </div>
                      <div className="grid gap-1">
                        <h3 className="font-medium">Saldo Actual</h3>
                        <p className="font-semibold text-primary">
                          ₡{formatCurrency(credit.saldo)}
                        </p>
                      </div>
                      <div className="grid gap-1">
                        <h3 className="font-medium">Cuota Mensual</h3>
                        <p className="text-muted-foreground">
                          ₡{formatCurrency(credit.cuota)}
                        </p>
                      </div>
                      <div className="grid gap-1">
                        <h3 className="font-medium">Tasa / Plazo</h3>
                        <p className="text-muted-foreground">
                          {credit.tasa_anual}% / {credit.plazo} meses
                        </p>
                      </div>
                      <div className="grid gap-1">
                        <h3 className="font-medium">Cuotas Atrasadas</h3>
                        <p className="font-semibold text-destructive">
                          {credit.cuotas_atrasadas || 0}
                        </p>
                      </div>
                      <div className="grid gap-1">
                        <h3 className="font-medium">Entidad Deductora</h3>
                        <p className="text-muted-foreground">{credit.deductora?.nombre || "-"}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Documents Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Paperclip className="h-5 w-5" />
                        Archivos del Crédito
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <DocumentManager 
                        personId={credit.lead_id}
                        initialDocuments={credit.lead?.documents || []}
                      />
                    </CardContent>
                  </Card>
                </div>

                {/* Right Panel inside Credito Tab */}
                {isPanelVisible && (
                  <div className="space-y-6 lg:col-span-2">
                    <Card className="h-[calc(100vh-12rem)]">
                      <Tabs defaultValue="comunicaciones" className="flex h-full flex-col">
                        <TabsList className="m-2">
                          <TabsTrigger value="comunicaciones" className="gap-1">
                            <MessageSquare className="h-4 w-4" />
                            Comunicaciones
                          </TabsTrigger>
                          <TabsTrigger value="tareas" className="gap-1">
                            <ClipboardCheck className="h-4 w-4" />
                            Tareas
                          </TabsTrigger>
                        </TabsList>
                        <TabsContent
                          value="comunicaciones"
                          className="flex-1 overflow-y-auto"
                        >
                          <CaseChat conversationId={credit.reference} />
                        </TabsContent>
                        <TabsContent value="tareas" className="flex-1 overflow-y-auto p-4">
                          <div className="text-center text-sm text-muted-foreground">
                            Funcionalidad de tareas en desarrollo.
                          </div>
                        </TabsContent>
                      </Tabs>
                    </Card>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="plan-pagos">
              {/* Plan de Pagos Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Plan de Pagos</CardTitle>
                  <CardDescription>Detalle de cuotas y movimientos históricos</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="whitespace-nowrap text-xs">Línea</TableHead>
                        <TableHead className="whitespace-nowrap text-xs">No. Cuota</TableHead>
                        <TableHead className="whitespace-nowrap text-xs">Proceso</TableHead>
                        <TableHead className="whitespace-nowrap text-xs">Fecha Inicio</TableHead>
                        <TableHead className="whitespace-nowrap text-xs">Fecha Corte</TableHead>
                        <TableHead className="whitespace-nowrap text-xs">Fecha Pago</TableHead>
                        <TableHead className="whitespace-nowrap text-xs">Tasa Actual</TableHead>
                        <TableHead className="whitespace-nowrap text-xs">Plazo Actual</TableHead>
                        <TableHead className="whitespace-nowrap text-xs text-right">Cuota</TableHead>
                        <TableHead className="whitespace-nowrap text-xs text-right">Cargos</TableHead>
                        <TableHead className="whitespace-nowrap text-xs text-right">Póliza</TableHead>
                        <TableHead className="whitespace-nowrap text-xs text-right">Int. Corriente</TableHead>
                        <TableHead className="whitespace-nowrap text-xs text-right">Int. Moratorio</TableHead>
                        <TableHead className="whitespace-nowrap text-xs text-right">Amortización</TableHead>
                        <TableHead className="whitespace-nowrap text-xs text-right">Saldo Anterior</TableHead>
                        <TableHead className="whitespace-nowrap text-xs text-right">Saldo Nuevo</TableHead>
                        <TableHead className="whitespace-nowrap text-xs">Días</TableHead>
                        <TableHead className="whitespace-nowrap text-xs">Estado</TableHead>
                        <TableHead className="whitespace-nowrap text-xs">Mora (Días)</TableHead>
                        <TableHead className="whitespace-nowrap text-xs">Fecha Mov.</TableHead>
                        <TableHead className="whitespace-nowrap text-xs text-right">Mov. Total</TableHead>
                        <TableHead className="whitespace-nowrap text-xs text-right">Mov. Cargos</TableHead>
                        <TableHead className="whitespace-nowrap text-xs text-right">Mov. Póliza</TableHead>
                        <TableHead className="whitespace-nowrap text-xs text-right">Mov. Int. Corr.</TableHead>
                        <TableHead className="whitespace-nowrap text-xs text-right">Mov. Int. Mora.</TableHead>
                        <TableHead className="whitespace-nowrap text-xs text-right">Mov. Principal</TableHead>
                        <TableHead className="whitespace-nowrap text-xs">Mov. Caja/Usuario</TableHead>
                        <TableHead className="whitespace-nowrap text-xs">Tipo Doc.</TableHead>
                        <TableHead className="whitespace-nowrap text-xs">No. Doc.</TableHead>
                        <TableHead className="whitespace-nowrap text-xs">Concepto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {credit.plan_de_pagos && credit.plan_de_pagos.length > 0 ? (
                        credit.plan_de_pagos.map((payment) => (
                          <TableRow key={payment.id} className="hover:bg-muted/50">
                            <TableCell className="text-xs font-mono">{payment.linea || "-"}</TableCell>
                            <TableCell className="text-xs text-center">{payment.numero_cuota}</TableCell>
                            <TableCell className="text-xs">{payment.proceso || "-"}</TableCell>
                            <TableCell className="text-xs">{formatDate(payment.fecha_inicio)}</TableCell>
                            <TableCell className="text-xs">{formatDate(payment.fecha_corte)}</TableCell>
                            <TableCell className="text-xs">{formatDate(payment.fecha_pago)}</TableCell>
                            <TableCell className="text-xs text-center">{payment.tasa_actual || "-"}</TableCell>
                            <TableCell className="text-xs text-center">{payment.plazo_actual || "-"}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{formatCurrency(payment.cuota)}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{formatCurrency(payment.cargos)}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{formatCurrency(payment.poliza)}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{formatCurrency(payment.interes_corriente)}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{formatCurrency(payment.interes_moratorio)}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{formatCurrency(payment.amortizacion)}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{formatCurrency(payment.saldo_anterior)}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{formatCurrency(payment.saldo_nuevo)}</TableCell>
                            <TableCell className="text-xs text-center">{payment.dias || "-"}</TableCell>
                            <TableCell className="text-xs">
                              <Badge variant="outline" className="text-[10px] h-5">
                                {payment.estado}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-center">{payment.dias_mora || "0"}</TableCell>
                            <TableCell className="text-xs">{formatDate(payment.fecha_movimiento)}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{formatCurrency(payment.movimiento_total)}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{formatCurrency(payment.movimiento_cargos)}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{formatCurrency(payment.movimiento_poliza)}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{formatCurrency(payment.movimiento_interes_corriente)}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{formatCurrency(payment.movimiento_interes_moratorio)}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{formatCurrency(payment.movimiento_principal)}</TableCell>
                            <TableCell className="text-xs">{payment.movimiento_caja_usuario || "-"}</TableCell>
                            <TableCell className="text-xs">{payment.tipo_documento || "-"}</TableCell>
                            <TableCell className="text-xs">{payment.numero_documento || "-"}</TableCell>
                            <TableCell className="text-xs">{payment.concepto || "-"}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={30} className="text-center py-8 text-muted-foreground">
                            No hay movimientos registrados para este crédito.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

export default function CreditDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <CreditDetailClient id={id} />
}
