// 'use client' indica que este es un Componente de Cliente, lo que permite interactividad.
"use client";
import React, { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import { MoreHorizontal, Phone, MessageSquareWarning, Upload, PlusCircle, Receipt, AlertTriangle, Check, Calculator } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/axios';
import { Credit, Payment } from '@/lib/data';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

// Interfaz extendida para el objeto de pago que viene del backend
interface PaymentWithRelations extends Payment {
    credit?: Credit & {
        lead?: {
            name: string;
            cedula?: string;
        };
        numero_operacion?: string;
        reference?: string;
    };
    created_at?: string;
    fecha_pago?: string;
    cuota?: number | string;
}

const getStatusVariantCobros = (status: Credit['status']) => {
  switch (status) {
    case 'Al día': return 'secondary';
    case 'En mora': return 'destructive';
    default: return 'outline';
  }
};

// Helper function to calculate days in arrears from last payment date
const calculateDaysInArrears = (credit: Credit): number => {
  if (!credit.fecha_ultimo_pago) return 0;
  const lastPayment = new Date(credit.fecha_ultimo_pago);
  const today = new Date();
  const diffTime = today.getTime() - lastPayment.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays - 30); // Assuming 30-day payment cycle
};

const CobrosTable = React.memo(function CobrosTable({ credits, isLoading }: { credits: Credit[], isLoading?: boolean }) {
  if (isLoading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (credits.length === 0) {
    return <div className="p-4 text-center text-sm text-muted-foreground">No hay créditos en esta categoría.</div>
  }
  return (
    <div className="relative w-full overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
              <TableHead>Operación</TableHead>
              <TableHead>Lead</TableHead>
            <TableHead className="hidden md:table-cell">Monto Cuota</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="hidden md:table-cell">Días de Atraso</TableHead>
            <TableHead><span className="sr-only">Acciones</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {credits.map((credit) => {
            const diasAtraso = calculateDaysInArrears(credit);
            return (
              <TableRow key={credit.id} className="hover:bg-muted/50">
                <TableCell className="font-medium">
                  <Link href={`/dashboard/creditos/${credit.id}`} className="hover:underline text-primary">
                    {credit.reference || credit.numero_operacion || credit.id}
                  </Link>
                </TableCell>
                <TableCell>{credit.lead?.name || "-"}</TableCell>
                <TableCell className="hidden md:table-cell">
                  ₡{credit.cuota ? Number(credit.cuota).toLocaleString('de-DE') : '0'}
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusVariantCobros(credit.status)}>{credit.status}</Badge>
                </TableCell>
                <TableCell className="hidden font-medium md:table-cell">
                  {diasAtraso > 0 ? (
                    <span className="text-destructive">{diasAtraso} días</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                      <DropdownMenuItem><MessageSquareWarning className="mr-2 h-4 w-4" />Enviar Recordatorio</DropdownMenuItem>
                      <DropdownMenuItem><Phone className="mr-2 h-4 w-4" />Registrar Llamada</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">Enviar a Cobro</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
});

const getSourceVariant = (source: Payment['source']) => {
  switch (source) {
    case 'Planilla': return 'secondary';
    case 'Ventanilla': return 'outline';
    case 'Transferencia': return 'default';
    default: return 'outline';
  }
};

const PaymentTableRow = React.memo(function PaymentTableRow({ payment }: { payment: PaymentWithRelations }) {
  const credit = payment.credit;
  const lead = credit?.lead;
  
  const leadName = lead?.name || (payment.cedula ? String(payment.cedula) : 'Desconocido');
  const operationNumber = credit?.numero_operacion || credit?.reference || '-';
  
  const amount = parseFloat(String(payment.monto || 0));
  const cuotaSnapshot = parseFloat(String(payment.cuota || amount));
  const difference = cuotaSnapshot - amount;
  const hasDifference = Math.abs(difference) > 1.0;

  const dateDisplay = payment.fecha_pago 
    ? new Date(payment.fecha_pago).toLocaleDateString() 
    : (payment.created_at ? new Date(payment.created_at).toLocaleDateString() : '-');

  return (
    <TableRow>
      <TableCell className="font-medium">
        {credit ? (
            <Link href={`/dashboard/creditos/${credit.id}`} className="hover:underline text-primary">
                {operationNumber}
            </Link>
        ) : <span className="text-muted-foreground">-</span>}
      </TableCell>
      
      <TableCell>
        <div className="flex flex-col">
            <span className="font-medium">{leadName}</span>
            <span className="text-xs text-muted-foreground">{payment.cedula}</span>
        </div>
      </TableCell>
      
      <TableCell className="text-right font-mono">
        ₡{amount.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
      </TableCell>
      
      <TableCell className="text-right font-mono text-xs">
        {hasDifference ? (
          <div className={difference > 0 ? "text-destructive flex justify-end items-center gap-1" : "text-green-600 flex justify-end items-center gap-1"}>
            {difference > 0 ? <AlertTriangle className="h-3 w-3" /> : <Check className="h-3 w-3" />}
            {difference > 0 ? '(Faltan)' : '(A favor)'} ₡{Math.abs(difference).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
          </div>
        ) : <span className="text-muted-foreground">-</span>}
      </TableCell>
      
      <TableCell>{dateDisplay}</TableCell>
      <TableCell><Badge variant={getSourceVariant(payment.source)}>{payment.source}</Badge></TableCell>
      
      <TableCell className="text-right">
        <Button variant="ghost" size="icon">
          <Receipt className="h-4 w-4" />
          <span className="sr-only">Ver Recibo</span>
        </Button>
      </TableCell>
    </TableRow>
  );
});

export default function CobrosPage() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [abonoModalOpen, setAbonoModalOpen] = useState(false);

  // Estados para el Formulario Manual
  const [tipoCobro, setTipoCobro] = useState('normal');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState('');
  // Para adelanto de cobro: cuotas seleccionadas
  const [cuotasDisponibles, setCuotasDisponibles] = useState<any[]>([]);
  const [cuotasSeleccionadas, setCuotasSeleccionadas] = useState<number[]>([]);
  
  // --- NUEVO: Estado para estrategia de Abono Extraordinario ---
  // 'reduce_amount' = Bajar Cuota | 'reduce_term' = Bajar Plazo
  const [extraordinaryStrategy, setExtraordinaryStrategy] = useState<'reduce_amount' | 'reduce_term'>('reduce_amount');
  
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [selectedCreditId, setSelectedCreditId] = useState<string>('');
  
  const [planRefreshKey, setPlanRefreshKey] = useState(0);
  const [paymentsState, setPaymentsState] = useState<PaymentWithRelations[]>([]);
  const [creditsList, setCreditsList] = useState<Credit[]>([]);
  const [isLoadingCredits, setIsLoadingCredits] = useState(true);

  // Estados para el modal de Subir Planilla
  const [planillaModalOpen, setPlanillaModalOpen] = useState(false);
  const [deductoras, setDeductoras] = useState<{ id: number; nombre: string; codigo: string }[]>([]);
  const [selectedDeductora, setSelectedDeductora] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingCredits(true);
      try {
        const paymentsRes = await api.get('/api/credit-payments');
        setPaymentsState(paymentsRes.data);
        const creditsRes = await api.get('/api/credits');
        const creditsData = Array.isArray(creditsRes.data) ? creditsRes.data : creditsRes.data?.data || [];
        setCreditsList(creditsData);
      } catch (err) {
        console.error('Error fetching cobros data:', err);
        toast({ title: 'Error', description: 'No se pudieron cargar los datos de cobros.', variant: 'destructive' });
      } finally {
        setIsLoadingCredits(false);
      }
    };
    fetchData();
  }, [planRefreshKey, toast]);

  // Dynamic filtering of credits by arrears - using live API data
  const filterCreditsByArrearsRange = useCallback((credits: Credit[], daysStart: number, daysEnd: number | null = null) => {
    return credits.filter(credit => {
      if (credit.status !== 'En mora') return false;
      const diasAtraso = calculateDaysInArrears(credit);
      if (daysEnd === null) {
        return diasAtraso >= daysStart;
      }
      return diasAtraso >= daysStart && diasAtraso <= daysEnd;
    });
  }, []);

  // Filtered credit lists using live data
  const alDiaCredits = useMemo(() =>
    creditsList.filter(c => c.status === 'Al día' || c.status === 'Formalizado'),
    [creditsList]
  );
  const mora30 = useMemo(() => filterCreditsByArrearsRange(creditsList, 1, 30), [creditsList, filterCreditsByArrearsRange]);
  const mora60 = useMemo(() => filterCreditsByArrearsRange(creditsList, 31, 60), [creditsList, filterCreditsByArrearsRange]);
  const mora90 = useMemo(() => filterCreditsByArrearsRange(creditsList, 61, 90), [creditsList, filterCreditsByArrearsRange]);
  const mora180 = useMemo(() => filterCreditsByArrearsRange(creditsList, 91, 180), [creditsList, filterCreditsByArrearsRange]);
  const mas180 = useMemo(() => filterCreditsByArrearsRange(creditsList, 181, null), [creditsList, filterCreditsByArrearsRange]);

  const uniqueLeads = useMemo(() => {
    const leadsMap = new Map();
    creditsList.forEach(credit => {
        if (credit.lead) {
            leadsMap.set(credit.lead.id, credit.lead);
        }
    });
    return Array.from(leadsMap.values());
  }, [creditsList]);

  const availableCredits = useMemo(() => {
    if (!selectedLeadId) return [];
    return creditsList.filter(c => c.lead && String(c.lead.id) === selectedLeadId);
  }, [creditsList, selectedLeadId]);

  const selectedCredit = useMemo(() => {
    return creditsList.find(c => String(c.id) === selectedCreditId);
  }, [creditsList, selectedCreditId]);

  // Cargar deductoras cuando se abre el modal de planilla
  useEffect(() => {
    if (planillaModalOpen && deductoras.length === 0) {
      api.get('/api/deductoras')
        .then(res => setDeductoras(res.data))
        .catch(err => console.error('Error cargando deductoras:', err));
    }
  }, [planillaModalOpen, deductoras.length]);

  const openPlanillaModal = useCallback(() => setPlanillaModalOpen(true), []);
  const closePlanillaModal = useCallback(() => {
    setPlanillaModalOpen(false);
    setSelectedDeductora('');
    setSelectedFile(null);
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  const openAbonoModal = useCallback(() => setAbonoModalOpen(true), []);
  const closeAbonoModal = useCallback(() => {
    setAbonoModalOpen(false);
    setTipoCobro('normal');
    setMonto('');
    setFecha('');
    setSelectedLeadId('');   
    setSelectedCreditId('');
    setExtraordinaryStrategy('reduce_amount'); // Reset strategy
  }, []);

  const handleRegistrarAbono = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!selectedCreditId || !monto || !fecha) {
        toast({ title: 'Faltan datos', description: 'Seleccione Lead, Crédito, monto y fecha.', variant: 'destructive' });
        return;
      }

      // Para adelanto de cobro, validar cuotas seleccionadas
      if (tipoCobro === 'adelanto' && cuotasSeleccionadas.length === 0) {
        toast({ title: 'Seleccione cuotas', description: 'Debe seleccionar al menos una cuota para adelanto.', variant: 'destructive' });
        return;
      }

      await api.post('/api/credit-payments/adelanto', {
        credit_id: selectedCreditId,
        tipo: tipoCobro,
        monto: parseFloat(monto),
        fecha: fecha,
        extraordinary_strategy: tipoCobro === 'extraordinario' ? extraordinaryStrategy : null,
        cuotas: tipoCobro === 'adelanto' ? cuotasSeleccionadas : undefined
      });

      toast({ title: 'Éxito', description: `Abono registrado.` });
      setPlanRefreshKey(k => k + 1);
      closeAbonoModal();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Error al registrar el abono.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  };

  const handleFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith('.xls') && !name.endsWith('.xlsx') && !name.endsWith('.csv') && !name.endsWith('.txt')) {
      toast({ title: 'Archivo inválido', description: 'Formato incorrecto. Usa .xls, .xlsx, .csv o .txt', variant: 'destructive' });
      return;
    }
    setSelectedFile(file);
  }, [toast]);

  const handleProcesarPlanilla = useCallback(async () => {
    if (!selectedFile || !selectedDeductora) {
      toast({ title: 'Datos incompletos', description: 'Seleccione deductora y archivo.', variant: 'destructive' });
      return;
    }
    const form = new FormData();
    form.append('file', selectedFile);
    form.append('deductora_id', selectedDeductora);
    try {
      setUploading(true);
      await api.post('/api/credit-payments/upload', form);
      toast({ title: 'Cargado', description: 'Planilla procesada correctamente.' });
      setPlanRefreshKey(k => k + 1);
      closePlanillaModal();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Error al procesar planilla.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  }, [selectedFile, selectedDeductora, toast, closePlanillaModal]);

  const triggerFile = useCallback(() => fileRef.current?.click(), []);

  return (
    <div className="space-y-6">
      <CardHeader className="px-0">
        <CardTitle>Módulo de Cobros</CardTitle>
        <CardDescription>Administra los créditos en mora y visualiza el historial de abonos.</CardDescription>
      </CardHeader>
      
      <Tabs defaultValue="gestion" className="w-full">
        <TabsList>
          <TabsTrigger value="gestion">Gestión de Cobros</TabsTrigger>
          <TabsTrigger value="abonos">Historial de Abonos</TabsTrigger>
        </TabsList>

        <TabsContent value="gestion">
             <Tabs defaultValue="al-dia" className="w-full">
                <Card>
                    <CardHeader className="pt-4">
                        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
                            <TabsTrigger value="al-dia">Al día ({alDiaCredits.length})</TabsTrigger>
                            <TabsTrigger value="30-dias">30 días ({mora30.length})</TabsTrigger>
                            <TabsTrigger value="60-dias">60 días ({mora60.length})</TabsTrigger>
                            <TabsTrigger value="90-dias">90 días ({mora90.length})</TabsTrigger>
                            <TabsTrigger value="180-dias">180 días ({mora180.length})</TabsTrigger>
                            <TabsTrigger value="mas-180-dias">+180 días ({mas180.length})</TabsTrigger>
                        </TabsList>
                    </CardHeader>
                    <TabsContent value="al-dia"><CardContent className="pt-0"><CobrosTable credits={alDiaCredits} isLoading={isLoadingCredits} /></CardContent></TabsContent>
                    <TabsContent value="30-dias"><CardContent className="pt-0"><CobrosTable credits={mora30} isLoading={isLoadingCredits} /></CardContent></TabsContent>
                    <TabsContent value="60-dias"><CardContent className="pt-0"><CobrosTable credits={mora60} isLoading={isLoadingCredits} /></CardContent></TabsContent>
                    <TabsContent value="90-dias"><CardContent className="pt-0"><CobrosTable credits={mora90} isLoading={isLoadingCredits} /></CardContent></TabsContent>
                    <TabsContent value="180-dias"><CardContent className="pt-0"><CobrosTable credits={mora180} isLoading={isLoadingCredits} /></CardContent></TabsContent>
                    <TabsContent value="mas-180-dias"><CardContent className="pt-0"><CobrosTable credits={mas180} isLoading={isLoadingCredits} /></CardContent></TabsContent>
                </Card>
            </Tabs>
        </TabsContent>

        <TabsContent value="abonos">
          <Card>
            <CardHeader className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Historial de Abonos Recibidos</CardTitle>
                  <CardDescription>Aplica abonos individuales o masivos.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <input ref={fileRef} type="file" accept=".xls,.xlsx,.csv,.txt" className="hidden" onChange={handleFileSelected} />
                  <Button variant="outline" onClick={openPlanillaModal} disabled={uploading}>
                    <Upload className="mr-2 h-4 w-4" />{uploading ? 'Subiendo...' : 'Cargar Planilla'}
                  </Button>
                  
                  <Button onClick={openAbonoModal}>
                    <PlusCircle className="mr-2 h-4 w-4" />Registrar Abono
                  </Button>

                  {/* Modal para Subir Planilla */}
                  <Dialog open={planillaModalOpen} onOpenChange={setPlanillaModalOpen}>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Cargar Planilla de Pagos</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        {/* Opción 1: Seleccionar Deductora */}
                        <div>
                          <label className="block text-sm font-medium mb-2">Seleccionar Deductora</label>
                          <Select value={selectedDeductora} onValueChange={setSelectedDeductora}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Seleccione una deductora..." />
                            </SelectTrigger>
                            <SelectContent>
                              {deductoras.map((d) => (
                                <SelectItem key={d.id} value={String(d.id)}>
                                  {d.nombre} ({d.codigo})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="relative">
                          <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                          </div>
                          <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">y luego</span>
                          </div>
                        </div>

                        {/* Opción 2: Subir Archivo */}
                        <div>
                          <label className="block text-sm font-medium mb-2">Subir Archivo</label>
                          <div
                            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                              selectedDeductora ? 'border-primary/50 hover:border-primary hover:bg-primary/5' : 'border-muted-foreground/25 opacity-50 cursor-not-allowed'
                            }`}
                            onClick={() => selectedDeductora && triggerFile()}
                          >
                            <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground">
                              {selectedDeductora
                                ? 'Click para seleccionar archivo (.xls, .xlsx, .csv, .txt)'
                                : 'Primero seleccione una deductora'}
                            </p>
                          </div>
                          {/* Mostrar archivo seleccionado */}
                          {selectedFile && (
                            <div className="mt-2 p-2 bg-muted rounded-md flex items-center justify-between">
                              <span className="text-sm truncate">{selectedFile.name}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedFile(null);
                                  if (fileRef.current) fileRef.current.value = '';
                                }}
                              >
                                ✕
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                      <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={closePlanillaModal}>Cancelar</Button>
                        <Button
                          onClick={handleProcesarPlanilla}
                          disabled={!selectedDeductora || !selectedFile || uploading}
                        >
                          {uploading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Procesando...
                            </>
                          ) : (
                            'Procesar Planilla'
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={abonoModalOpen} onOpenChange={setAbonoModalOpen}>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Registrar Abono Manual</DialogTitle></DialogHeader>
                      <form onSubmit={handleRegistrarAbono} className="space-y-4">
                        
                        <div>
                          <label className="block text-sm font-medium mb-1">Cliente (Lead)</label>
                          <Select value={selectedLeadId} onValueChange={(val) => {
                              setSelectedLeadId(val);
                              setSelectedCreditId(''); 
                          }}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Seleccione un cliente..." />
                            </SelectTrigger>
                            <SelectContent>
                              {uniqueLeads.map((lead: any) => (
                                <SelectItem key={lead.id} value={String(lead.id)}>
                                  {lead.name} {lead.cedula ? `(${lead.cedula})` : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-1">Crédito Asociado</label>
                          <Select   
                            value={selectedCreditId} 
                            onValueChange={setSelectedCreditId}
                            disabled={!selectedLeadId}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder={!selectedLeadId ? "Primero seleccione un cliente" : "Seleccione una operación..."} />
                            </SelectTrigger>
                            <SelectContent>
                              {availableCredits.length > 0 ? (
                                availableCredits.map((c: any) => (
                                  <SelectItem key={c.id} value={String(c.id)}>
                                    {c.reference || c.numero_operacion || `ID: ${c.id}`} - Saldo: ₡{Number(c.saldo ).toLocaleString()}
                                  </SelectItem>
                                ))
                              ) : (
                                <div className="p-2 text-sm text-muted-foreground">Este cliente no tiene créditos activos.</div>
                              )}
                            </SelectContent>
                          </Select>
                          
                          {selectedCredit && selectedCredit.status !== 'Formalizado' && (
                            <div className="mt-3 p-4 text-[14px] leading-tight bg-amber-50 border border-amber-200 text-red-700 rounded-md flex items-start gap-2">
                              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                              <span>Este crédito no está <strong>Formalizado</strong> (Estado: {selectedCredit.status}). No se pueden registrar abonos manuales hasta que el crédito sea formalizado y tenga un plan de pagos.</span>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Tipo de Cobro</label>
                                <Select value={tipoCobro} onValueChange={val => {
                                  setTipoCobro(val);
                                  // Si cambia a adelanto, cargar cuotas disponibles
                                  if (val === 'adelanto' && selectedCreditId) {
                                    api.get(`/api/credits/${selectedCreditId}`)
                                      .then(res => {
                                        // Filtrar cuotas pendientes
                                        const cuotas = res.data.plan_de_pagos?.filter((c: any) => c.estado !== 'Pagado');
                                        setCuotasDisponibles(cuotas || []);
                                      });
                                  } else {
                                    setCuotasDisponibles([]);
                                    setCuotasSeleccionadas([]);
                                  }
                                  }}>
                                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                    <SelectItem value="normal">Normal</SelectItem>
                                    <SelectItem value="adelanto">Adelanto de Cuotas</SelectItem>
                                    {/* --- OPCIÓN NUEVA --- */}
                                    <SelectItem value="extraordinario">Abono Extraordinario</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Fecha</label>
                                <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} required />
                            </div>
                        </div>

                        {/* Mostrar checkboxes de cuotas si es adelanto */}
                        {tipoCobro === 'adelanto' && cuotasDisponibles.length > 0 && (
                          <div className="bg-muted/50 p-3 rounded-md border border-dashed border-primary/50 space-y-2">
                            <div className="text-sm font-medium mb-2">Seleccione cuotas a adelantar:</div>
                            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto pr-2">
                              {cuotasDisponibles.map((cuota: any) => (
                                <label key={cuota.id} className="flex items-center gap-2 cursor-pointer py-1">
                                  <input
                                    type="checkbox"
                                    value={cuota.id}
                                    checked={cuotasSeleccionadas.includes(cuota.id)}
                                    onChange={e => {
                                      const id = cuota.id;
                                      setCuotasSeleccionadas(sel =>
                                        e.target.checked
                                          ? [...sel, id]
                                          : sel.filter(cid => cid !== id)
                                      );
                                    }}
                                    className="h-4 w-4"
                                  />
                                  <span className="text-xs">Cuota #{cuota.numero_cuota} - Vence: {cuota.fecha_corte ? new Date(cuota.fecha_corte).toLocaleDateString() : ''} - ₡{Number(cuota.cuota || 0).toLocaleString()}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* --- LÓGICA VISUAL PARA ABONO EXTRAORDINARIO --- */}
                        {tipoCobro === 'extraordinario' && (
                            <div className="bg-muted/50 p-3 rounded-md border border-dashed border-primary/50 space-y-3">
                                <div className="flex items-center gap-2 text-primary">
                                    <Calculator className="h-4 w-4" />
                                    <span className="text-sm font-medium">Estrategia de Aplicación</span>
                                </div>
                                <div className="flex flex-col gap-2 pl-1">
                                    <label className="flex items-center gap-2 cursor-pointer p-1 hover:bg-background rounded transition-colors">
                                        <input 
                                            type="radio" 
                                            name="strategy" 
                                            value="reduce_amount" 
                                            checked={extraordinaryStrategy === 'reduce_amount'}
                                            onChange={() => setExtraordinaryStrategy('reduce_amount')}
                                            className="text-primary focus:ring-primary"
                                        />
                                        <span className="text-sm">Disminuir <strong>monto de la cuota</strong> (Recalcular mensualidad)</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer p-1 hover:bg-background rounded transition-colors">
                                        <input 
                                            type="radio" 
                                            name="strategy" 
                                            value="reduce_term" 
                                            checked={extraordinaryStrategy === 'reduce_term'}
                                            onChange={() => setExtraordinaryStrategy('reduce_term')}
                                            className="text-primary focus:ring-primary"
                                        />
                                        <span className="text-sm">Disminuir <strong>plazo</strong> (Terminar de pagar antes)</span>
                                    </label>
                                </div>
                            </div>
                        )}
                        {/* ----------------------------------------------- */}

                        <div>
                          <label className="block text-sm font-medium mb-1">Monto (CRC)</label>
                          <Input type="number" min="0" step="0.01" value={monto} onChange={e => setMonto(e.target.value)} required />
                        </div>

                        <DialogFooter>
                          <Button type="submit" disabled={!selectedCreditId || selectedCredit?.status !== 'Formalizado'}>Aplicar Pago</Button>
                          <Button type="button" variant="outline" onClick={closeAbonoModal}>Cancelar</Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>

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
                    <TableHead><span className="sr-only">Acciones</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentsState.map((payment) => (
                    <PaymentTableRow key={payment.id} payment={payment} />
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div >
  );
}