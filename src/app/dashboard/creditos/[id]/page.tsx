'use client';

import React, { useState, useEffect, use } from 'react';
// --- Agent Option ---
interface AgentOption {
  id: number;
  name: string;
}
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Paperclip,
  FileText,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  ClipboardCheck,
  Loader2,
  Pencil,
  Save,
  X,
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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import api from '@/lib/axios';
import { useToast } from "@/hooks/use-toast";
import { CaseChat } from '@/components/case-chat';
import { DocumentManager } from '@/components/document-manager';
import { CreditDocumentManager } from '@/components/credit-document-manager';

// --- Interfaces ---

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
  movimiento_amortizacion?: number;
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
  fecha_inicio: Date | null;
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
  movimiento_amortizacion?: number;
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
  progress: number;
  opened_at: string | null;
  description: string | null;
  lead_id: number;
  lead?: {
    id: number;
    name: string;
    institucion_labora?: string | null;
    documents?: CreditDocument[];
    deductora_id?: number,
    assigned_to_id: number,
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
  // saldo_a_favor removed
  proceso?: string | null;
  poliza?: boolean | null;
}

// --- Helpers ---

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

// --- Main Component ---

interface DeductoraOption {
  id: string | number;
  nombre: string;
}

function CreditDetailClient({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const [credit, setCredit] = useState<CreditItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPanelVisible, setIsPanelVisible] = useState(true);

  // Edit State
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState<Partial<CreditItem>>({});
  const [saving, setSaving] = useState(false);
  
  // Combobox/Select Data
  const [users, setUsers] = useState<{id: number, name: string}[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  // Agents (for Responsable display)
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);
  // Deductoras
  const [deductoras, setDeductoras] = useState<DeductoraOption[]>([]);
  const [isLoadingDeductoras, setIsLoadingDeductoras] = useState(true);
  // Fetch Deductoras
  const fetchDeductoras = async () => {
    try {
      setIsLoadingDeductoras(true);
      const response = await api.get('/api/deductoras');
      let data = response.data;
      if (!Array.isArray(data)) {
        data = data.data || [];
      }
      if (!Array.isArray(data)) {
        data = [];
      }
      setDeductoras(data);
    } catch (error) {
      setDeductoras([]);
      console.error("Error fetching deductoras:", error);
    } finally {
      setIsLoadingDeductoras(false);
    }
  };


  // --- Fetch Data ---

  const fetchCredit = async () => {
    try {
      const response = await api.get(`/api/credits/${id}`);
      let data = response.data;
      // Buscar el último pago de tipo normal (asumimos que payments o plan_de_pagos existe)
      let lastPaymentDate = null;
      if (Array.isArray(data.payments) && data.payments.length > 0) {
        // Filtrar pagos de tipo normal si hay un campo tipo, si no, tomar todos
        const normalPayments = data.payments.filter((p: any) => !p.tipo || p.tipo === 'normal');
        if (normalPayments.length > 0) {
          // Ordenar por fecha_pago descendente
          normalPayments.sort((a: any, b: any) => new Date(b.fecha_pago || b.fecha_corte || 0).getTime() - new Date(a.fecha_pago || a.fecha_corte || 0).getTime());
          lastPaymentDate = normalPayments[0].fecha_pago || normalPayments[0].fecha_corte;
        }
      } else if (Array.isArray(data.plan_de_pagos) && data.plan_de_pagos.length > 0) {
        // Fallback a plan_de_pagos si no hay payments
        const normalPayments = data.plan_de_pagos.filter((p: any) => !p.tipo || p.tipo === 'normal');
        if (normalPayments.length > 0) {
          normalPayments.sort((a: any, b: any) => new Date(b.fecha_pago || b.fecha_corte || 0).getTime() - new Date(a.fecha_pago || a.fecha_corte || 0).getTime());
          lastPaymentDate = normalPayments[0].fecha_pago || normalPayments[0].fecha_corte;
        }
      }
      if (lastPaymentDate) {
        data.fecha_ultimo_pago = lastPaymentDate;
      }
      setCredit(data);
      setFormData(data);
    } catch (error) {
      console.error("Error fetching credit:", error);
      toast({ title: "Error", description: "No se pudo cargar el crédito", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCredit();
  }, [id]);

  useEffect(() => {
    const editParam = searchParams.get('edit');
    if (editParam === 'true') {
      setIsEditMode(true);
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setIsLoadingUsers(true);
        const response = await api.get('/api/agents');
        setUsers(response.data);
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setIsLoadingUsers(false);
      }
    };
    fetchUsers();
    fetchDeductoras();

    // Fetch agents for Responsable display
    const fetchAgents = async () => {
      try {
        setIsLoadingAgents(true);
        const response = await api.get('/api/agents');
        let data = response.data;
        if (!Array.isArray(data)) {
          data = data.data || [];
        }
        if (!Array.isArray(data)) {
          data = [];
        }
        setAgents(data);
      } catch (error) {
        setAgents([]);
        console.error("Error fetching agents:", error);
      } finally {
        setIsLoadingAgents(false);
      }
    };
    fetchAgents();
  }, []);

  // --- Handlers: Edit ---

  const handleInputChange = (field: keyof CreditItem, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!credit) return;

    const previousStatus = credit.status;
    const isFormalizingCredit = formData.status === 'Formalizado' && previousStatus !== 'Formalizado';

    setSaving(true);
    try {
      const response = await api.put(`/api/credits/${credit.id}`, formData);
      setCredit(response.data);
      setFormData(response.data);
      setIsEditMode(false);

      if (isFormalizingCredit) {
        toast({
          title: "Crédito formalizado",
          description: "El plan de pagos se ha generado correctamente."
        });
      } else {
        toast({
          title: "Éxito",
          description: "Crédito actualizado correctamente"
        });
      }

      // Recargar el crédito para obtener el plan de pagos actualizado
      await fetchCredit();
    } catch (error) {
      console.error("Error saving credit:", error);
      toast({ title: "Error", description: "No se pudo guardar los cambios", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData(credit || {});
    setIsEditMode(false);
  };

  // --- Render ---

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
          {!isEditMode ? (
            <>
              <Button variant="outline" onClick={() => setIsEditMode(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </Button>
              <Button asChild variant="outline">
                <Link href={`/dashboard/creditos/${id}/balance`} target="_blank">
                  <FileText className="mr-2 h-4 w-4" />
                  Balance General
                </Link>
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleCancel} disabled={saving}>
                <X className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </>
          )}
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
                            <Link href={`/dashboard/leads/${credit.lead_id}`} className="hover:underline">
                              {credit.lead?.name || "Cliente Desconocido"}
                            </Link>
                          </CardTitle>
                          <CardDescription>
                            Institución: {credit.lead?.institucion_labora || "-"}
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
                    <CardContent className="space-y-8">
                      {/* Basic Information */}
                      <div>
                        <h3 className="text-lg font-medium mb-4">Información Básica</h3>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Número de Operación</Label>
                            {isEditMode ? (
                              <Input
                                value={formData.numero_operacion || ""}
                                onChange={(e) => handleInputChange("numero_operacion", e.target.value)}
                                placeholder="Número de operación"
                              />
                            ) : (
                              <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
                                {credit.numero_operacion || credit.reference || "-"}
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Tipo de credito</Label>
                            {isEditMode ? (
                              <Select value={formData.category || ""} onValueChange={(value) => handleInputChange("category", value)}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccionar categoría" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Regular">Regular</SelectItem>
                                  <SelectItem value="Micro-crédito">Micro-crédito</SelectItem>
                                  <SelectItem value="Hipotecario">Hipotecario</SelectItem>
                                  <SelectItem value="Personal">Personal</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
                                {credit.category || "-"}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Financial Details */}
                      <div>
                        <h3 className="text-lg font-medium mb-4">Detalles Financieros</h3>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Monto Otorgado</Label>
                            {isEditMode ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={formData.monto_credito || ""}
                                onChange={(e) => handleInputChange("monto_credito", parseFloat(e.target.value) || 0)}
                                placeholder="Monto otorgado"
                              />
                            ) : (
                              <p className="text-sm font-semibold text-primary bg-muted px-3 py-2 rounded-md">
                                ₡{formatCurrency(credit.monto_credito)}
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Saldo Actual</Label>
                            {isEditMode ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={formData.saldo || ""}
                                onChange={(e) => handleInputChange("saldo", parseFloat(e.target.value) || 0)}
                                placeholder="Saldo actual"
                              />
                            ) : (
                              <p className="text-sm font-semibold text-primary bg-muted px-3 py-2 rounded-md">
                                ₡{formatCurrency(credit.saldo)}
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Cuota Mensual</Label>
                            {isEditMode ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={formData.cuota || ""}
                                onChange={(e) => handleInputChange("cuota", parseFloat(e.target.value) || 0)}
                                placeholder="Cuota mensual"
                              />
                            ) : (
                              <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
                                ₡{formatCurrency(credit.cuota)}
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Tasa Anual</Label>
                            {isEditMode ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={formData.tasa_anual || ""}
                                onChange={(e) => handleInputChange("tasa_anual", parseFloat(e.target.value) || 0)}
                                placeholder="Tasa anual (%)"
                              />
                            ) : (
                              <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
                                {credit.tasa_anual ? `${credit.tasa_anual}%` : "-"}
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Divisa</Label>
                            {isEditMode ? (
                              <Select value={formData.divisa || "CRC"} onValueChange={(value) => handleInputChange("divisa", value)}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccionar divisa" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="CRC">CRC - Colón Costarricense</SelectItem>
                                  <SelectItem value="USD">USD - Dólar Estadounidense</SelectItem>
                                  <SelectItem value="EUR">EUR - Euro</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
                                {credit.divisa || "CRC"}
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Entidad Deductora</Label>
                            <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
                              {(() => {
                                // Always use lead's deductora_id for lookup
                                const idDeductora = credit.lead?.deductora_id;
                                if (!idDeductora) return "-";
                                const encontrada = deductoras.find(d => String(d.id) === String(idDeductora));
                                return encontrada ? encontrada.nombre : idDeductora;
                              })()}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Dates and Terms */}
                      <div>
                        <h3 className="text-lg font-medium mb-4">Fechas y Plazos</h3>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Fecha de Apertura</Label>
                            {isEditMode ? (
                              <Input
                                type="date"
                                value={(() => {
                                  const f = formData.plan_de_pagos?.find(p => p.numero_cuota === 0)?.fecha_inicio;
                                  if (f) {
                                    return f instanceof Date ? f.toISOString().split('T')[0] : String(f).split('T')[0];
                                  }
                                  return new Date(credit.opened_at || "").toISOString().split('T')[0];
                                })()}
                                onChange={(e) => handleInputChange("opened_at", e.target.value)}
                              />
                            ) : (
                              <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
                                {(() => {
                                  const f = formData.plan_de_pagos?.find(p => p.numero_cuota === 0)?.fecha_inicio;
                                  if (f) {
                                    return f instanceof Date ? f.toISOString().split('T')[0] : String(f).split('T')[0];
                                  }
                                  return new Date(credit.opened_at || "").toISOString().split('T')[0];
                                })()}
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Fecha de Culminación</Label>
                            {isEditMode ? (
                              <Input
                                type="date"
                                value={formData.fecha_culminacion_credito ? new Date(formData.fecha_culminacion_credito).toISOString().split('T')[0] : ""}
                                onChange={(e) => handleInputChange("fecha_culminacion_credito", e.target.value)}
                              />
                            ) : (
                              <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
                                {formatDate(credit.fecha_culminacion_credito)}
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Último Pago</Label>
                            {isEditMode ? (
                              <Input
                                type="date"
                                value={formData.fecha_ultimo_pago ? new Date(formData.fecha_ultimo_pago).toISOString().split('T')[0] : ""}
                                onChange={(e) => handleInputChange("fecha_ultimo_pago", e.target.value)}
                              />
                            ) : (
                              <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
                                {formatDate(credit.fecha_ultimo_pago)}
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Primera Deducción</Label>
                            {isEditMode ? (
                              <Input
                                type="date"
                                value={formData.primera_deduccion ? new Date(formData.primera_deduccion).toISOString().split('T')[0] : ""}
                                onChange={(e) => handleInputChange("primera_deduccion", e.target.value)}
                              />
                            ) : (
                              <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
                                {formatDate(credit.primera_deduccion)}
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Plazo</Label>
                            {isEditMode ? (
                              <Input
                                type="number"
                                value={formData.plazo || ""}
                                onChange={(e) => handleInputChange("plazo", parseInt(e.target.value) || 0)}
                                placeholder="Plazo en meses"
                              />
                            ) : (
                              <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
                                {credit.plazo ? `${credit.plazo} meses` : "-"}
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Cuotas Atrasadas</Label>
                            {isEditMode ? (
                              <Input
                                type="number"
                                value={formData.cuotas_atrasadas || ""}
                                onChange={(e) => handleInputChange("cuotas_atrasadas", parseInt(e.target.value) || 0)}
                                placeholder="Cuotas atrasadas"
                              />
                            ) : (
                              <p className="text-sm font-semibold text-destructive bg-muted px-3 py-2 rounded-md">
                                {credit.cuotas_atrasadas || 0}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Additional Information */}
                      <div>
                        <h3 className="text-lg font-medium mb-4">Información Adicional</h3>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Estado</Label>
                            {isEditMode ? (
                              <Select value={formData.status || ""} onValueChange={(value) => handleInputChange("status", value)}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccionar estado" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Aprobado">Aprobado</SelectItem>
                                  <SelectItem value="Formalizado">Formalizado</SelectItem>
                                  <SelectItem value="Activo">Activo</SelectItem>
                                  <SelectItem value="Mora">Mora</SelectItem>
                                  <SelectItem value="Cerrado">Cerrado</SelectItem>
                                  <SelectItem value="Legal">Legal</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
                                {credit.status || "-"}
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>¿Tiene póliza?</Label>
                            {isEditMode ? (
                              <div className="flex items-center space-x-2 pt-2">
                                <Switch
                                  id="poliza-switch"
                                  checked={!!formData.poliza}
                                  onCheckedChange={(checked) => handleInputChange("poliza", checked)}
                                />
                                <Label htmlFor="poliza-switch" className="font-normal cursor-pointer">
                                  {formData.poliza ? "Sí" : "No"}
                                </Label>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
                                {credit.poliza ? "Sí" : "No"}
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Responsable</Label>
                            {isEditMode ? (
                              <Select
                                value={String(formData.lead?.assigned_to_id ?? "")}
                                onValueChange={value => handleInputChange('lead', { ...formData.lead, assigned_to_id: parseInt(value) }) }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccionar responsable" />
                                </SelectTrigger>
                                <SelectContent>
                                  {users.map(user => (
                                    <SelectItem key={user.id} value={String(user.id)}>{user.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
                                {agents.find(a => a.id === (formData as any).assigned_to_id)?.name || "-"}
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Garantía</Label>
                            {isEditMode ? (
                              <Input
                                value={formData.garantia || ""}
                                onChange={(e) => handleInputChange("garantia", e.target.value)}
                                placeholder="Garantía"
                              />
                            ) : (
                              <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
                                {credit.garantia || "-"}
                              </p>
                            )}
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label>Descripción</Label>
                            {isEditMode ? (
                              <Textarea
                                value={formData.description || ""}
                                onChange={(e) => handleInputChange("description", e.target.value)}
                                placeholder="Descripción del crédito"
                                rows={3}
                              />
                            ) : (
                              <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md min-h-[60px]">
                                {credit.description || "-"}
                              </p>
                            )}
                          </div>
                        </div>
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
                      <CreditDocumentManager
                        creditId={credit.id}
                        initialDocuments={credit.documents?.map(doc => ({
                          id: doc.id,
                          name: doc.name,
                          notes: doc.notes || undefined,
                          path: doc.path || '',
                          url: doc.url || '',
                          mime_type: doc.mime_type || '',
                          size: doc.size || 0,
                          created_at: doc.created_at
                        })) || []}
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
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle>Plan de Pagos</CardTitle>
                    <CardDescription>Detalle de cuotas y movimientos históricos</CardDescription>
                  </div>
                  {credit.status === 'Formalizado' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        if (!confirm('¿Estás seguro de que deseas regenerar el plan de pagos? Esto eliminará las cuotas pendientes y creará un nuevo plan.')) return;
                        try {
                          setLoading(true);
                          await api.post(`/api/credits/${id}/generate-plan-de-pagos`);
                          toast({
                            title: 'Plan de pagos regenerado',
                            description: 'El plan de pagos se ha regenerado correctamente.',
                          });
                          await fetchCredit();
                        } catch (error) {
                          console.error('Error regenerando plan de pagos:', error);
                          toast({
                            title: 'Error',
                            description: 'No se pudo regenerar el plan de pagos.',
                            variant: 'destructive',
                          });
                        } finally {
                          setLoading(false);
                        }
                      }}
                    >
                      Regenerar Plan
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
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
                        <TableHead className="whitespace-nowrap text-xs text-right">Mov. Amortización</TableHead>
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
                            <TableCell className="text-xs text-center">{payment.numero_cuota}</TableCell>
                            <TableCell className="text-xs">{payment.proceso || "-"}</TableCell>
                            <TableCell className="text-xs">{formatDate(payment.fecha_inicio ? new Date(payment.fecha_inicio).toISOString() : null)}</TableCell>
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
                              <Badge variant="outline" className={`text-[10px] h-5 ${payment.estado === 'Pagado' ? 'bg-green-50 text-green-700 border-green-200' : (payment.estado === 'Parcial' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : '')}`}>
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
                            <TableCell className="text-xs text-right font-mono">{formatCurrency(payment.movimiento_amortizacion)}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{formatCurrency(payment.movimiento_principal)}</TableCell>
                            
                            <TableCell className="text-xs">{payment.movimiento_caja_usuario || "-"}</TableCell>
                            <TableCell className="text-xs">{payment.tipo_documento || "-"}</TableCell>
                            <TableCell className="text-xs">{payment.numero_documento || "-"}</TableCell>
                            <TableCell className="text-xs">{payment.concepto || "-"}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={30} className="text-center py-12">
                            <div className="flex flex-col items-center gap-4">
                              <div className="text-muted-foreground">
                                {credit.status !== 'Formalizado' ? (
                                  <>
                                    <p className="font-medium mb-2">El plan de pagos se generará al formalizar el crédito</p>
                                    <p className="text-sm">Cambia el estado a "Formalizado" para generar el plan automáticamente.</p>
                                  </>
                                ) : (
                                  <>
                                    <p className="font-medium mb-2">No hay plan de pagos generado</p>
                                    <p className="text-sm mb-4">Haz clic en el botón para generar el plan de pagos.</p>
                                    <Button
                                      size="sm"
                                      onClick={async () => {
                                        try {
                                          setLoading(true);
                                          await api.post(`/api/credits/${id}/generate-plan-de-pagos`);
                                          toast({
                                            title: 'Plan de pagos generado',
                                            description: 'El plan de pagos se ha generado correctamente.',
                                          });
                                          await fetchCredit();
                                        } catch (error: any) {
                                          console.error('Error generando plan de pagos:', error);
                                          toast({
                                            title: 'Error',
                                            description: error?.response?.data?.message || 'No se pudo generar el plan de pagos.',
                                            variant: 'destructive',
                                          });
                                        } finally {
                                          setLoading(false);
                                        }
                                      }}
                                    >
                                      Generar Plan de Pagos
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
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