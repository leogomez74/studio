// 'use client' indica que este es un Componente de Cliente, lo que permite interactividad.
"use client";
import React, { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import { MoreHorizontal, Phone, MessageSquareWarning, Upload, PlusCircle, Receipt, AlertTriangle, Check, Calculator, FileDown, ChevronLeft, ChevronRight, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PermissionButton } from '@/components/PermissionButton';
import { ProtectedPage } from "@/components/ProtectedPage";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useAuth } from '@/components/auth-guard';
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
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

// Helper function to calculate days in arrears from plan de pagos
const calculateDaysInArrears = (credit: Credit): number => {
  // Obtener el máximo de dias_mora de las cuotas en el plan de pagos
  if (!credit.plan_de_pagos || !Array.isArray(credit.plan_de_pagos) || credit.plan_de_pagos.length === 0) {
    return 0;
  }

  // Buscar la cuota con más días de mora
  const maxDiasMora = credit.plan_de_pagos.reduce((max, cuota) => {
    const diasMora = cuota.dias_mora || 0;
    return diasMora > max ? diasMora : max;
  }, 0);

  return maxDiasMora;
};

const CobrosTable = React.memo(function CobrosTable({ credits, isLoading, currentPage, perPage, onPageChange, onPerPageChange }: { credits: Credit[], isLoading?: boolean, currentPage: number, perPage: number, onPageChange: (p: number) => void, onPerPageChange: (p: number) => void }) {
  const totalPages = Math.ceil(credits.length / perPage);
  const paginatedCredits = credits.slice((currentPage - 1) * perPage, currentPage * perPage);

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
    <div>
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
            {paginatedCredits.map((credit) => {
              const diasAtraso = calculateDaysInArrears(credit);
              return (
                <TableRow key={credit.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">
                    <Link href={`/dashboard/creditos/${credit.id}`} className="hover:underline text-primary">
                      {credit.reference || credit.numero_operacion || credit.id}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {credit.lead
                      ? `${credit.lead.name || ''} ${(credit.lead as any).apellido1 || ''} ${(credit.lead as any).apellido2 || ''}`.trim() || '-'
                      : '-'}
                  </TableCell>
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
      {/* Paginación */}
      <div className="flex items-center justify-between border-t px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Mostrar:</span>
          <Select value={String(perPage)} onValueChange={(v) => { onPerPageChange(Number(v)); onPageChange(1); }}>
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="30">30</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <span>de {credits.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">{currentPage} / {totalPages || 1}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
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

  const leadName = lead
    ? `${lead.name || ''} ${(lead as any).apellido1 || ''} ${(lead as any).apellido2 || ''}`.trim() || 'Sin nombre'
    : (payment.cedula ? String(payment.cedula) : 'Desconocido');
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

  // --- Estado para Cancelación Anticipada ---
  const [cancelacionData, setCancelacionData] = useState<any>(null);
  const [loadingCancelacion, setLoadingCancelacion] = useState(false);
  
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [selectedCreditId, setSelectedCreditId] = useState<string>('');

  // Estado para búsqueda de clientes
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [clientSearchResults, setClientSearchResults] = useState<any[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [planRefreshKey, setPlanRefreshKey] = useState(0);
  const [paymentsState, setPaymentsState] = useState<PaymentWithRelations[]>([]);
  const [creditsList, setCreditsList] = useState<Credit[]>([]);
  const [isLoadingCredits, setIsLoadingCredits] = useState(true);

  // Paginación - Historial de Abonos
  const [abonosPage, setAbonosPage] = useState(1);
  const [abonosPerPage, setAbonosPerPage] = useState(10);

  // Paginación - Gestión de Cobros
  const [cobrosPage, setCobrosPage] = useState(1);
  const [cobrosPerPage, setCobrosPerPage] = useState(10);

  // Estados para el modal de Subir Planilla
  const [planillaModalOpen, setPlanillaModalOpen] = useState(false);
  const [deductoras, setDeductoras] = useState<{ id: number; nombre: string; codigo: string }[]>([]);
  const [selectedDeductora, setSelectedDeductora] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fechaTestPlanilla, setFechaTestPlanilla] = useState<string>('');
  const [previewData, setPreviewData] = useState<any>(null);
  const [showingPreview, setShowingPreview] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  // Estados para Saldos Pendientes
  const [saldosPendientes, setSaldosPendientes] = useState<any[]>([]);
  const [loadingSaldos, setLoadingSaldos] = useState(false);
  const [procesandoSaldo, setProcesandoSaldo] = useState<number | null>(null);

  // Resultado de planilla con sobrantes
  const [planillaResult, setPlanillaResult] = useState<any>(null);

  // Modal de confirmación para aplicar saldos
  const [previewSaldoData, setPreviewSaldoData] = useState<any>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingSaldoId, setPendingSaldoId] = useState<number | null>(null);
  const [pendingAccion, setPendingAccion] = useState<'cuota' | 'capital' | null>(null);

  // Historial de Planillas
  const [planillas, setPlanillas] = useState<any[]>([]);
  const [anularDialogOpen, setAnularDialogOpen] = useState(false);
  const [planillaToAnular, setPlanillaToAnular] = useState<any>(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');

  // Usuario actual (para verificar permisos)
  const { user } = useAuth();

  // Búsqueda de clientes con debounce
  useEffect(() => {
    if (!clientSearchQuery || clientSearchQuery.length < 2) {
      setClientSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        const response = await api.get('/api/persons/search', {
          params: { q: clientSearchQuery }
        });
        setClientSearchResults(response.data || []);
      } catch (error) {
        console.error('Error buscando clientes:', error);
        setClientSearchResults([]);
      }
    }, 300); // Debounce de 300ms

    return () => clearTimeout(timeoutId);
  }, [clientSearchQuery]);

  const fetchSaldosPendientes = useCallback(async () => {
    setLoadingSaldos(true);
    try {
      const res = await api.get('/api/saldos-pendientes');
      setSaldosPendientes(res.data || []);
    } catch (err) {
      console.error('Error fetching saldos pendientes:', err);
    } finally {
      setLoadingSaldos(false);
    }
  }, []);

  const fetchPlanillas = useCallback(async () => {
    try {
      const res = await api.get('/api/planilla-uploads');
      setPlanillas(res.data);
    } catch (err) {
      console.error('Error fetching planillas:', err);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingCredits(true);
      try {
        const paymentsRes = await api.get('/api/credit-payments');
        setPaymentsState(paymentsRes.data);
        const creditsRes = await api.get('/api/credits?all=true');
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
    fetchSaldosPendientes();
    fetchPlanillas();
  }, [planRefreshKey, toast, fetchSaldosPendientes, fetchPlanillas]);

  // Dynamic filtering of credits by arrears - using live API data
  const filterCreditsByArrearsRange = useCallback((credits: Credit[], daysStart: number, daysEnd: number | null = null) => {
    return credits.filter(credit => {
      if (credit.status !== 'En Mora') return false;
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

  // Calcular cancelación anticipada cuando se selecciona un crédito con ese tipo
  useEffect(() => {
    if (tipoCobro === 'cancelacion_anticipada' && selectedCreditId) {
      setLoadingCancelacion(true);
      setCancelacionData(null);
      api.post('/api/credit-payments/cancelacion-anticipada/calcular', {
        credit_id: selectedCreditId
      })
        .then(res => {
          setCancelacionData(res.data);
          setMonto(String(res.data.monto_total_cancelar));
        })
        .catch(err => {
          const msg = err.response?.data?.message || 'Error al calcular cancelación anticipada.';
          toast({ title: 'Error', description: msg, variant: 'destructive' });
        })
        .finally(() => setLoadingCancelacion(false));
    } else {
      setCancelacionData(null);
    }
  }, [tipoCobro, selectedCreditId, toast]);

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
    setFechaTestPlanilla('');
    setPreviewData(null);
    setShowingPreview(false);
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
    setCancelacionData(null); // Reset cancelación anticipada
  }, []);

  const handleRegistrarAbono = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!selectedCreditId || !fecha) {
        toast({ title: 'Faltan datos', description: 'Seleccione Lead, Crédito y fecha.', variant: 'destructive' });
        return;
      }

      // Cancelación Anticipada: usar endpoint específico
      if (tipoCobro === 'cancelacion_anticipada') {
        if (!cancelacionData) {
          toast({ title: 'Error', description: 'Espere a que se calcule el monto de cancelación.', variant: 'destructive' });
          return;
        }
        await api.post('/api/credit-payments/cancelacion-anticipada', {
          credit_id: selectedCreditId,
          fecha: fecha,
        });
        toast({ title: 'Éxito', description: 'Cancelación anticipada procesada. El crédito ha sido cerrado.' });
        setPlanRefreshKey(k => k + 1);
        closeAbonoModal();
        return;
      }

      if (!monto) {
        toast({ title: 'Faltan datos', description: 'Ingrese el monto.', variant: 'destructive' });
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

  // Nueva función para obtener preview
  const handleGetPreview = useCallback(async () => {
    if (!selectedFile || !selectedDeductora) {
      toast({ title: 'Datos incompletos', description: 'Seleccione deductora y archivo.', variant: 'destructive' });
      return;
    }

    const form = new FormData();
    form.append('file', selectedFile);
    form.append('deductora_id', selectedDeductora);
    if (fechaTestPlanilla) {
      form.append('fecha_proceso', fechaTestPlanilla);
    }

    try {
      setLoadingPreview(true);
      const response = await api.post('/api/credit-payments/preview-planilla', form);
      setPreviewData(response.data);
      setShowingPreview(true);
      toast({ title: 'Preview generado', description: 'Revise el resumen antes de procesar.' });
    } catch (err: any) {
      const data = err.response?.data;
      let msg = data?.message || 'Error al generar preview.';
      if (data?.errores) {
        msg += '\n\n' + data.errores.join('\n');
      }
      if (data?.columnas_encontradas) {
        msg += '\n\nColumnas encontradas en el archivo: ' + data.columnas_encontradas.join(', ');
      }
      if (data?.ayuda) {
        msg += '\n\n' + data.ayuda;
      }
      toast({ title: 'Error en el archivo', description: msg, variant: 'destructive', duration: 15000 });
    } finally {
      setLoadingPreview(false);
    }
  }, [selectedFile, selectedDeductora, fechaTestPlanilla, toast]);

  // Función modificada para procesar después del preview
  const handleProcesarPlanilla = useCallback(async () => {
    if (!selectedFile || !selectedDeductora) {
      toast({ title: 'Datos incompletos', description: 'Seleccione deductora y archivo.', variant: 'destructive' });
      return;
    }

    if (!showingPreview) {
      // Si no hay preview, generarlo primero
      await handleGetPreview();
      return;
    }

    // Si ya hay preview, procesar la planilla
    const form = new FormData();
    form.append('file', selectedFile);
    form.append('deductora_id', selectedDeductora);
    if (fechaTestPlanilla) {
      form.append('fecha_test', fechaTestPlanilla);
    }

    try {
      setUploading(true);
      const uploadRes = await api.post('/api/credit-payments/upload', form);
      const saldosSobrantes = uploadRes.data?.saldos_pendientes || [];
      if (saldosSobrantes.length > 0) {
        toast({
          title: 'Planilla procesada con sobrantes',
          description: `Se detectaron ${saldosSobrantes.length} sobrante(s). Revise la pestaña "Saldos por Asignar".`,
          duration: 8000,
        });
      } else {
        toast({ title: 'Cargado', description: 'Planilla procesada correctamente.' });
      }
      setPlanRefreshKey(k => k + 1);
      closePlanillaModal();
    } catch (err: any) {
      const data = err.response?.data;
      let msg = data?.message || 'Error al procesar planilla.';
      if (data?.errores) {
        msg += '\n\n' + data.errores.join('\n');
      }
      if (data?.columnas_encontradas) {
        msg += '\n\nColumnas encontradas en el archivo: ' + data.columnas_encontradas.join(', ');
      }
      if (data?.ayuda) {
        msg += '\n\n' + data.ayuda;
      }
      toast({ title: 'Error en el archivo', description: msg, variant: 'destructive', duration: 15000 });
    } finally {
      setUploading(false);
    }
  }, [selectedFile, selectedDeductora, fechaTestPlanilla, showingPreview, handleGetPreview, toast, closePlanillaModal]);

  const triggerFile = useCallback(() => fileRef.current?.click(), []);

  const handleExportPDF = () => {
    if (paymentsState.length === 0) {
      toast({ title: "Sin datos", description: "No hay pagos para exportar", variant: "destructive" });
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(12);
    doc.text('Historial de Abonos Consolidado', 14, 16);

    const formatAmountForPDF = (amount: number | null | undefined): string => {
      if (amount == null) return "-";
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    };

    autoTable(doc, {
      startY: 22,
      head: [["Operación", "Deudor", "Cédula", "Monto Pagado", "Diferencia", "Fecha Pago", "Fuente"]],
      body: paymentsState.map((payment) => {
        const credit = payment.credit;
        const lead = credit?.lead;
        const leadName = lead?.name || (payment.cedula ? String(payment.cedula) : 'Desconocido');
        const operationNumber = credit?.numero_operacion || credit?.reference || '-';
        const amount = parseFloat(String(payment.monto || 0));
        const cuotaSnapshot = parseFloat(String(payment.cuota || amount));
        const difference = cuotaSnapshot - amount;
        const dateDisplay = payment.fecha_pago
          ? new Date(payment.fecha_pago).toLocaleDateString()
          : (payment.created_at ? new Date(payment.created_at).toLocaleDateString() : '-');

        return [
          operationNumber,
          leadName,
          lead?.cedula || payment.cedula || '-',
          formatAmountForPDF(amount),
          formatAmountForPDF(difference),
          dateDisplay,
          payment.source || '-',
        ];
      }),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [220, 53, 69] },
    });

    doc.save(`historial_abonos_${Date.now()}.pdf`);
  };

  const handleAsignarSaldo = async (saldoId: number, accion: 'cuota' | 'capital') => {
    // Verificar permiso de administrador
    if (user?.role?.name !== 'Administrador' && !user?.role?.full_access) {
      toast({
        title: 'Acceso denegado',
        description: 'Solo administradores pueden aplicar saldos',
        variant: 'destructive',
      });
      return;
    }

    // Obtener preview
    try {
      const res = await api.post(`/api/saldos-pendientes/${saldoId}/preview`, { accion });
      setPreviewSaldoData(res.data);
      setPendingSaldoId(saldoId);
      setPendingAccion(accion);
      setConfirmDialogOpen(true);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Error al obtener preview',
        variant: 'destructive',
      });
    }
  };

  const confirmarAsignacion = async () => {
    if (!pendingSaldoId || !pendingAccion) return;

    setProcesandoSaldo(pendingSaldoId);
    try {
      const res = await api.post(`/api/saldos-pendientes/${pendingSaldoId}/asignar`, {
        accion: pendingAccion
      });
      toast({
        title: 'Éxito',
        description: res.data.message,
      });
      setConfirmDialogOpen(false);
      setPreviewSaldoData(null);
      setPlanRefreshKey(k => k + 1);
      await fetchSaldosPendientes();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Error al asignar saldo',
        variant: 'destructive',
      });
    } finally {
      setProcesandoSaldo(null);
      setPendingSaldoId(null);
      setPendingAccion(null);
    }
  };

  const handleAnularPlanilla = async () => {
    if (!planillaToAnular || !motivoAnulacion.trim()) {
      toast({
        title: 'Error',
        description: 'Debe proporcionar un motivo',
        variant: 'destructive',
      });
      return;
    }

    try {
      const res = await api.post(`/api/planilla-uploads/${planillaToAnular.id}/anular`, {
        motivo: motivoAnulacion,
      });
      toast({
        title: 'Éxito',
        description: 'Planilla anulada correctamente',
      });
      setAnularDialogOpen(false);
      setPlanillaToAnular(null);
      setMotivoAnulacion('');
      await fetchPlanillas();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Error al anular planilla',
        variant: 'destructive',
      });
    }
  };

  return (
    <ProtectedPage module="cobros">
      <div className="space-y-6">
        <CardHeader className="px-0">
        <CardTitle>Módulo de Cobros</CardTitle>
        <CardDescription>Administra los créditos en mora y visualiza el historial de abonos.</CardDescription>
      </CardHeader>
      
      <Tabs defaultValue="abonos" className="w-full">
        <TabsList>
          <TabsTrigger value="abonos">Historial de Abonos</TabsTrigger>
          <TabsTrigger value="gestion">Gestión de Cobros</TabsTrigger>
          <TabsTrigger value="saldos" className="relative">
            <Wallet className="mr-1.5 h-4 w-4" />
            Saldos por Asignar
            {saldosPendientes.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full bg-orange-500 text-white text-xs font-bold">
                {saldosPendientes.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="planillas">Historial de Planillas</TabsTrigger>
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
                    <TabsContent value="al-dia"><CardContent className="pt-0"><CobrosTable credits={alDiaCredits} isLoading={isLoadingCredits} currentPage={cobrosPage} perPage={cobrosPerPage} onPageChange={setCobrosPage} onPerPageChange={setCobrosPerPage} /></CardContent></TabsContent>
                    <TabsContent value="30-dias"><CardContent className="pt-0"><CobrosTable credits={mora30} isLoading={isLoadingCredits} currentPage={cobrosPage} perPage={cobrosPerPage} onPageChange={setCobrosPage} onPerPageChange={setCobrosPerPage} /></CardContent></TabsContent>
                    <TabsContent value="60-dias"><CardContent className="pt-0"><CobrosTable credits={mora60} isLoading={isLoadingCredits} currentPage={cobrosPage} perPage={cobrosPerPage} onPageChange={setCobrosPage} onPerPageChange={setCobrosPerPage} /></CardContent></TabsContent>
                    <TabsContent value="90-dias"><CardContent className="pt-0"><CobrosTable credits={mora90} isLoading={isLoadingCredits} currentPage={cobrosPage} perPage={cobrosPerPage} onPageChange={setCobrosPage} onPerPageChange={setCobrosPerPage} /></CardContent></TabsContent>
                    <TabsContent value="180-dias"><CardContent className="pt-0"><CobrosTable credits={mora180} isLoading={isLoadingCredits} currentPage={cobrosPage} perPage={cobrosPerPage} onPageChange={setCobrosPage} onPerPageChange={setCobrosPerPage} /></CardContent></TabsContent>
                    <TabsContent value="mas-180-dias"><CardContent className="pt-0"><CobrosTable credits={mas180} isLoading={isLoadingCredits} currentPage={cobrosPage} perPage={cobrosPerPage} onPageChange={setCobrosPage} onPerPageChange={setCobrosPerPage} /></CardContent></TabsContent>
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
                  <PermissionButton module="cobros" action="edit" variant="outline" onClick={openPlanillaModal} disabled={uploading}>
                    <Upload className="mr-2 h-4 w-4" />{uploading ? 'Subiendo...' : 'Cargar Planilla'}
                  </PermissionButton>

                  <PermissionButton module="cobros" action="delete" variant="outline" onClick={handleExportPDF}>
                    <FileDown className="mr-2 h-4 w-4" />Exportar PDF
                  </PermissionButton>

                  <PermissionButton module="cobros" action="create" onClick={openAbonoModal}>
                    <PlusCircle className="mr-2 h-4 w-4" />Registrar Abono
                  </PermissionButton>

                  {/* Modal para Subir Planilla */}
                  <Dialog open={planillaModalOpen} onOpenChange={setPlanillaModalOpen}>
                    <DialogContent className={showingPreview ? "sm:max-w-6xl max-h-[90vh] overflow-y-auto" : "sm:max-w-md"}>
                      <DialogHeader>
                        <DialogTitle>{showingPreview ? 'Resumen de Carga - Verificar antes de Procesar' : 'Cargar Planilla de Pagos'}</DialogTitle>
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

                        {/* Campo de fecha de proceso */}
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <label className="block text-sm font-medium mb-2 text-blue-800">
                            📅 Fecha de Proceso
                          </label>
                          <input
                            type="date"
                            value={fechaTestPlanilla}
                            onChange={(e) => setFechaTestPlanilla(e.target.value)}
                            className="w-full px-3 py-2 border border-blue-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <p className="text-xs text-blue-600 mt-1">
                            Si se deja vacío, usa la fecha actual del servidor
                          </p>
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

                        {/* Vista Previa */}
                        {showingPreview && previewData && (
                          <div className="mt-6 space-y-4">
                            <div className="flex items-center justify-between">
                              <h3 className="text-lg font-semibold">Resumen de Carga</h3>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      const response = await api.get(`/api/credit-payments/export-preview-excel/${previewData.hash}`, {
                                        responseType: 'blob'
                                      });
                                      const url = window.URL.createObjectURL(new Blob([response.data]));
                                      const link = document.createElement('a');
                                      link.href = url;
                                      link.setAttribute('download', `resumen_planilla_${previewData.fecha_proceso}.xlsx`);
                                      document.body.appendChild(link);
                                      link.click();
                                      link.remove();
                                    } catch (err) {
                                      toast({ title: 'Error', description: 'No se pudo descargar el Excel', variant: 'destructive' });
                                    }
                                  }}
                                >
                                  <FileDown className="mr-1 h-4 w-4" />
                                  Excel
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      const response = await api.get(`/api/credit-payments/export-preview-pdf/${previewData.hash}`, {
                                        responseType: 'blob'
                                      });
                                      const url = window.URL.createObjectURL(new Blob([response.data]));
                                      const link = document.createElement('a');
                                      link.href = url;
                                      link.setAttribute('download', `resumen_planilla_${previewData.fecha_proceso}.pdf`);
                                      document.body.appendChild(link);
                                      link.click();
                                      link.remove();
                                    } catch (err) {
                                      toast({ title: 'Error', description: 'No se pudo descargar el PDF', variant: 'destructive' });
                                    }
                                  }}
                                >
                                  <FileDown className="mr-1 h-4 w-4" />
                                  PDF
                                </Button>
                              </div>
                            </div>

                            {/* Totales */}
                            <div className="grid grid-cols-4 gap-3 p-4 bg-gray-50 rounded-lg">
                              <div className="text-center">
                                <div className="text-2xl font-bold">{previewData.totales.total_registros}</div>
                                <div className="text-xs text-muted-foreground">Total Registros</div>
                              </div>
                              <div className="text-center">
                                <div className="text-2xl font-bold text-green-600">{previewData.totales.completos}</div>
                                <div className="text-xs text-muted-foreground">Completos</div>
                              </div>
                              <div className="text-center">
                                <div className="text-2xl font-bold text-yellow-600">{previewData.totales.parciales}</div>
                                <div className="text-xs text-muted-foreground">Parciales</div>
                              </div>
                              <div className="text-center">
                                <div className="text-2xl font-bold text-red-600">{previewData.totales.no_encontrados}</div>
                                <div className="text-xs text-muted-foreground">No Encontrados</div>
                              </div>
                            </div>

                            {/* Tabla de Preview */}
                            <div className="border rounded-lg overflow-hidden">
                              <div className="max-h-96 overflow-y-auto">
                                <table className="w-full text-xs">
                                  <thead className="bg-gray-100 sticky top-0">
                                    <tr>
                                      <th className="px-2 py-2 text-left">Cédula</th>
                                      <th className="px-2 py-2 text-left">Nombre</th>
                                      <th className="px-2 py-2 text-left">Crédito</th>
                                      <th className="px-2 py-2 text-center">Cuota #</th>
                                      <th className="px-2 py-2 text-right">Monto Planilla</th>
                                      <th className="px-2 py-2 text-right">Cuota Esperada</th>
                                      <th className="px-2 py-2 text-right">Diferencia</th>
                                      <th className="px-2 py-2 text-center">Estado</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {previewData.preview.map((item: any, idx: number) => (
                                      <tr key={idx} className="border-t hover:bg-gray-50">
                                        <td className="px-2 py-2">{item.cedula}</td>
                                        <td className="px-2 py-2">{item.nombre}</td>
                                        <td className="px-2 py-2">{item.credito_referencia || '-'}</td>
                                        <td className="px-2 py-2 text-center">{item.numero_cuota || '-'}</td>
                                        <td className="px-2 py-2 text-right">₡{item.monto_planilla.toLocaleString('es-CR', {minimumFractionDigits: 2})}</td>
                                        <td className="px-2 py-2 text-right">₡{item.cuota_esperada.toLocaleString('es-CR', {minimumFractionDigits: 2})}</td>
                                        <td className={`px-2 py-2 text-right font-semibold ${item.diferencia < 0 ? 'text-red-600' : item.diferencia > 1 ? 'text-blue-600' : 'text-gray-600'}`}>
                                          ₡{item.diferencia.toLocaleString('es-CR', {minimumFractionDigits: 2})}
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                          <span className={`inline-block px-2 py-1 rounded text-xs ${
                                            item.estado === 'Completo' ? 'bg-green-100 text-green-800' :
                                            item.estado === 'Parcial' ? 'bg-yellow-100 text-yellow-800' :
                                            item.estado === 'No encontrado' ? 'bg-red-100 text-red-800' :
                                            'bg-gray-100 text-gray-800'
                                          }`}>
                                            {item.estado}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* Totales Monetarios */}
                            <div className="grid grid-cols-3 gap-3 p-4 bg-blue-50 rounded-lg">
                              <div>
                                <div className="text-xs text-muted-foreground">Monto Total Planilla</div>
                                <div className="text-lg font-bold">₡{previewData.totales.monto_total_planilla.toLocaleString('es-CR', {minimumFractionDigits: 2})}</div>
                              </div>
                              <div>
                                <div className="text-xs text-muted-foreground">Monto Total Esperado</div>
                                <div className="text-lg font-bold">₡{previewData.totales.monto_total_esperado.toLocaleString('es-CR', {minimumFractionDigits: 2})}</div>
                              </div>
                              <div>
                                <div className="text-xs text-muted-foreground">Diferencia Total</div>
                                <div className={`text-lg font-bold ${previewData.totales.diferencia_total < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                  ₡{previewData.totales.diferencia_total.toLocaleString('es-CR', {minimumFractionDigits: 2})}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={closePlanillaModal}>Cancelar</Button>
                        {showingPreview && (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setShowingPreview(false);
                              setPreviewData(null);
                            }}
                          >
                            ← Volver
                          </Button>
                        )}
                        <Button
                          onClick={handleProcesarPlanilla}
                          disabled={!selectedDeductora || !selectedFile || uploading || loadingPreview}
                        >
                          {loadingPreview ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Analizando...
                            </>
                          ) : uploading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Procesando...
                            </>
                          ) : showingPreview ? (
                            '✓ Confirmar y Procesar'
                          ) : (
                            'Ver Resumen'
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={abonoModalOpen} onOpenChange={setAbonoModalOpen}>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Registrar Abono Manual</DialogTitle></DialogHeader>
                      <form onSubmit={handleRegistrarAbono} className="space-y-4">
                        
                        <div className="relative">
                          <label className="block text-sm font-medium mb-1">Cliente</label>
                          <Input
                            placeholder="Buscar por nombre o cédula..."
                            value={clientSearchQuery}
                            onChange={(e) => {
                              setClientSearchQuery(e.target.value);
                              if (!e.target.value) {
                                setSelectedLeadId('');
                                setSelectedCreditId('');
                              }
                            }}
                            onFocus={() => setIsDropdownOpen(true)}
                            onBlur={() => {
                              // Delay to allow click on dropdown items
                              setTimeout(() => setIsDropdownOpen(false), 200);
                            }}
                            autoComplete="off"
                          />
                          {/* Dropdown personalizado */}
                          {isDropdownOpen && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                              {(() => {
                                // Normalizar texto para búsqueda insensitive
                                const normalizeText = (text: string) => {
                                  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                                };

                                // Combinar uniqueLeads con resultados de búsqueda del backend
                                const allClients = [...uniqueLeads, ...clientSearchResults];

                                // Eliminar duplicados por ID
                                const uniqueClients = Array.from(
                                  new Map(allClients.map((c: any) => [c.id, c])).values()
                                );

                                // Filtrar por búsqueda si hay query, sino mostrar todos
                                const filtered = clientSearchQuery.length >= 1
                                  ? uniqueClients.filter((client: any) => {
                                      const searchNorm = normalizeText(clientSearchQuery);
                                      const nameNorm = normalizeText(client.name || client.label || '');
                                      const cedulaNorm = normalizeText(client.cedula || '');
                                      return nameNorm.includes(searchNorm) || cedulaNorm.includes(searchNorm);
                                    })
                                  : uniqueClients;

                                if (filtered.length === 0) {
                                  return (
                                    <div className="px-3 py-2 text-sm text-muted-foreground">
                                      No se encontraron clientes
                                    </div>
                                  );
                                }

                                return filtered.map((client: any) => {
                                  const label = client.label || `${client.name} ${client.cedula ? `(${client.cedula})` : ''}`;
                                  return (
                                    <div
                                      key={client.id}
                                      className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 transition-colors"
                                      onClick={() => {
                                        setSelectedLeadId(String(client.id));
                                        setClientSearchQuery(label);
                                        setSelectedCreditId('');
                                        setIsDropdownOpen(false);
                                      }}
                                    >
                                      {label}
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          )}
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
                                availableCredits.map((c: any) => {
                                  const interesesMora = (c.plan_de_pagos || [])
                                    .filter((p: any) => p.estado === 'Mora')
                                    .reduce((sum: number, p: any) => sum + (Number(p.int_corriente_vencido) || 0), 0);
                                  const saldoTotal = (Number(c.saldo) || 0) + interesesMora;
                                  return (
                                    <SelectItem key={c.id} value={String(c.id)}>
                                      {c.reference || c.numero_operacion || `ID: ${c.id}`} - Saldo: ₡{saldoTotal.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                                    </SelectItem>
                                  );
                                })
                              ) : (
                                <div className="p-2 text-sm text-muted-foreground">Este cliente no tiene créditos activos.</div>
                              )}
                            </SelectContent>
                          </Select>
                          
                          {selectedCredit && selectedCredit.status !== 'Formalizado' && !(tipoCobro === 'cancelacion_anticipada' && selectedCredit.status === 'En Mora') && (
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
                                    <SelectItem value="extraordinario">Abono Extraordinario</SelectItem>
                                    <SelectItem value="cancelacion_anticipada">Cancelación Anticipada</SelectItem>
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

                        {/* --- PANEL CANCELACIÓN ANTICIPADA --- */}
                        {tipoCobro === 'cancelacion_anticipada' && (
                          <div className="bg-muted/50 p-4 rounded-md border border-dashed border-primary/50 space-y-3">
                            <div className="flex items-center gap-2 text-primary">
                              <AlertTriangle className="h-4 w-4" />
                              <span className="text-sm font-medium">Cancelación Anticipada del Crédito</span>
                            </div>
                            {loadingCancelacion ? (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Calculando monto...
                              </div>
                            ) : cancelacionData ? (
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Cuota actual:</span>
                                    <span className="ml-2 font-medium">#{cancelacionData.cuota_actual}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Saldo capital:</span>
                                    <span className="ml-2 font-medium">₡{Number(cancelacionData.saldo_capital).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                                  </div>
                                  {cancelacionData.intereses_vencidos > 0 && (
                                    <div>
                                      <span className="text-muted-foreground">Intereses vencidos:</span>
                                      <span className="ml-2 font-medium text-destructive">₡{Number(cancelacionData.intereses_vencidos).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                  )}
                                  <div>
                                    <span className="text-muted-foreground">Saldo total:</span>
                                    <span className="ml-2 font-bold">₡{Number(cancelacionData.saldo_pendiente).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                                  </div>
                                </div>

                                {cancelacionData.aplica_penalizacion && (
                                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-sm">
                                    <div className="flex items-start gap-2 text-amber-800">
                                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                                      <div>
                                        <strong>Penalización aplicada:</strong> El cliente está en la cuota #{cancelacionData.cuota_actual} (antes de la cuota 12).
                                        Se aplican <strong>{cancelacionData.cuotas_penalizacion} cuotas adicionales</strong> de penalización.
                                        <div className="mt-1">
                                          Penalización: <strong>₡{Number(cancelacionData.monto_penalizacion).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</strong>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {!cancelacionData.aplica_penalizacion && (
                                  <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm">
                                    <div className="flex items-center gap-2 text-green-800">
                                      <Check className="h-4 w-4 shrink-0" />
                                      <span>Sin penalización. El cliente ha superado la cuota 12.</span>
                                    </div>
                                  </div>
                                )}

                                <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg text-center">
                                  <div className="text-sm text-muted-foreground">Monto Total a Cancelar</div>
                                  <div className="text-2xl font-bold text-primary">
                                    ₡{Number(cancelacionData.monto_total_cancelar).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                                  </div>
                                </div>
                              </div>
                            ) : selectedCreditId ? (
                              <div className="text-sm text-muted-foreground">Seleccione un crédito para calcular el monto.</div>
                            ) : null}
                          </div>
                        )}
                        {/* ----------------------------------------------- */}

                        {/* Monto solo visible cuando NO es cancelación anticipada */}
                        {tipoCobro !== 'cancelacion_anticipada' && (
                        <div>
                          <label className="block text-sm font-medium mb-1">Monto (CRC)</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₡</span>
                            <Input
                              type="text"
                              inputMode="decimal"
                              className="pl-7"
                              placeholder="0.00"
                              value={(() => {
                                if (!monto) return '';
                                const [intPart, decPart] = monto.split('.');
                                const formatted = Number(intPart || '0').toLocaleString('en-US');
                                return decPart !== undefined ? `${formatted}.${decPart}` : formatted;
                              })()}
                              onChange={e => {
                                const raw = e.target.value.replace(/,/g, '');
                                if (raw === '' || /^\d*\.?\d{0,2}$/.test(raw)) {
                                  setMonto(raw);
                                }
                              }}
                              required
                            />
                          </div>
                        </div>
                        )}

                        <DialogFooter>
                          <Button
                            type="submit"
                            disabled={
                              !selectedCreditId ||
                              (tipoCobro === 'cancelacion_anticipada'
                                ? (!cancelacionData || loadingCancelacion || !['Formalizado', 'En Mora'].includes(selectedCredit?.status || ''))
                                : selectedCredit?.status !== 'Formalizado'
                              )
                            }
                          >
                            {tipoCobro === 'cancelacion_anticipada' ? 'Confirmar Cancelación' : 'Aplicar Pago'}
                          </Button>
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
                  {paymentsState.slice((abonosPage - 1) * abonosPerPage, abonosPage * abonosPerPage).map((payment) => (
                    <PaymentTableRow key={payment.id} payment={payment} />
                  ))}
                </TableBody>
              </Table>
              {/* Paginación */}
              <div className="flex items-center justify-between border-t px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Mostrar:</span>
                  <Select value={String(abonosPerPage)} onValueChange={(v) => { setAbonosPerPage(Number(v)); setAbonosPage(1); }}>
                    <SelectTrigger className="h-8 w-[70px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="30">30</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                  <span>de {paymentsState.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-8 w-8" disabled={abonosPage <= 1} onClick={() => setAbonosPage(abonosPage - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">{abonosPage} / {Math.ceil(paymentsState.length / abonosPerPage) || 1}</span>
                  <Button variant="outline" size="icon" className="h-8 w-8" disabled={abonosPage >= Math.ceil(paymentsState.length / abonosPerPage)} onClick={() => setAbonosPage(abonosPage + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="saldos">
          <Card>
            <CardHeader className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Saldos por Asignar</CardTitle>
                  <CardDescription>Sobrantes de planilla pendientes de asignación. Puede aplicarlos a la siguiente cuota o como abono a capital.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchSaldosPendientes} disabled={loadingSaldos}>
                  {loadingSaldos ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Actualizar'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingSaldos ? (
                <div className="p-8 flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : saldosPendientes.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Wallet className="mx-auto h-12 w-12 mb-3 opacity-30" />
                  <p className="text-sm">No hay saldos pendientes por asignar.</p>
                  <p className="text-xs mt-1">Los sobrantes aparecerán aquí cuando se cargue una planilla donde un cliente pague más que su cuota.</p>
                </div>
              ) : (
                <div className="relative w-full overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Cédula</TableHead>
                        <TableHead>Crédito</TableHead>
                        <TableHead className="text-right">Monto Sobrante</TableHead>
                        <TableHead className="text-right">Saldo Crédito</TableHead>
                        <TableHead>Deductora</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead className="text-center">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {saldosPendientes.map((saldo: any) => (
                        <TableRow key={saldo.id}>
                          <TableCell className="font-medium">
                            {saldo.lead_id ? (
                              <Link href={`/dashboard/leads/${saldo.lead_id}?mode=view`} className="text-primary hover:underline">
                                {saldo.lead_name}
                              </Link>
                            ) : (
                              saldo.lead_name
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{saldo.cedula}</TableCell>
                          <TableCell>
                            <Link href={`/dashboard/creditos/${saldo.credit_id}`} className="text-primary hover:underline text-sm">
                              {saldo.credit_reference}
                            </Link>
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-orange-600">
                            ₡{Number(saldo.monto).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            ₡{Number(saldo.saldo_credito).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-sm">{saldo.deductora}</TableCell>
                          <TableCell className="text-sm">
                            {saldo.fecha_origen ? new Date(saldo.fecha_origen).toLocaleDateString() : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs"
                                disabled={procesandoSaldo === saldo.id}
                                onClick={() => handleAsignarSaldo(saldo.id, 'cuota')}
                              >
                                {procesandoSaldo === saldo.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <>Aplicar a Cuota</>
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs"
                                disabled={procesandoSaldo === saldo.id}
                                onClick={() => handleAsignarSaldo(saldo.id, 'capital')}
                              >
                                {procesandoSaldo === saldo.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <>Aplicar a Capital</>
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Historial de Planillas */}
        <TabsContent value="planillas">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Planillas Cargadas</CardTitle>
              <CardDescription>
                Registro de todas las planillas procesadas. Solo administradores pueden anular.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Fecha Planilla</TableHead>
                    <TableHead>Deductora</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Pagos</TableHead>
                    <TableHead>Monto Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {planillas.map((planilla) => (
                    <TableRow key={planilla.id}>
                      <TableCell>{planilla.id}</TableCell>
                      <TableCell>
                        {new Date(planilla.fecha_planilla).toLocaleDateString('es-CR')}
                      </TableCell>
                      <TableCell>{planilla.deductora?.nombre || '-'}</TableCell>
                      <TableCell>{planilla.user?.name || '-'}</TableCell>
                      <TableCell>{planilla.cantidad_pagos}</TableCell>
                      <TableCell>
                        {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' })
                          .format(planilla.monto_total)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={planilla.estado === 'activa' ? 'default' : 'destructive'}>
                          {planilla.estado}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {planilla.estado === 'activa' && user?.role?.name === 'Administrador' && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setPlanillaToAnular(planilla);
                              setAnularDialogOpen(true);
                            }}
                          >
                            Anular
                          </Button>
                        )}
                        {planilla.estado === 'anulada' && (
                          <div className="text-xs text-muted-foreground">
                            Anulada: {new Date(planilla.anulada_at).toLocaleDateString('es-CR')}
                            <br />
                            Por: {planilla.anulada_por?.name || planilla.anulada_por}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal: Confirmación de Aplicación de Saldo */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Aplicación de Saldo</DialogTitle>
          </DialogHeader>

          {previewSaldoData && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Monto disponible</p>
                <p className="text-lg font-bold">
                  {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' })
                    .format(previewSaldoData.monto_disponible)}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Destino</p>
                <p className="font-semibold">{previewSaldoData.destino}</p>
              </div>

              {previewSaldoData.distribucion && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Distribución:</p>
                  <div className="space-y-1 text-sm">
                    {previewSaldoData.distribucion.interes_moratorio > 0 && (
                      <div className="flex justify-between">
                        <span>Interés Moratorio:</span>
                        <span className="font-mono">
                          {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' })
                            .format(previewSaldoData.distribucion.interes_moratorio)}
                        </span>
                      </div>
                    )}
                    {previewSaldoData.distribucion.interes_corriente > 0 && (
                      <div className="flex justify-between">
                        <span>Interés Corriente:</span>
                        <span className="font-mono">
                          {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' })
                            .format(previewSaldoData.distribucion.interes_corriente)}
                        </span>
                      </div>
                    )}
                    {previewSaldoData.distribucion.amortizacion > 0 && (
                      <div className="flex justify-between">
                        <span>Capital:</span>
                        <span className="font-mono">
                          {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' })
                            .format(previewSaldoData.distribucion.amortizacion)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground">Saldo del crédito</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm line-through">
                    {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' })
                      .format(previewSaldoData.credit.saldo_actual)}
                  </span>
                  <span>→</span>
                  <span className="text-lg font-bold text-green-600">
                    {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' })
                      .format(previewSaldoData.saldo_nuevo_credit)}
                  </span>
                </div>
              </div>

              {previewSaldoData.excedente > 0.50 && (
                <Alert>
                  <AlertDescription>
                    Excedente de ₡{previewSaldoData.excedente.toFixed(2)} quedará pendiente
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmarAsignacion}>
              Confirmar Aplicación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Anular Planilla */}
      <Dialog open={anularDialogOpen} onOpenChange={setAnularDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular Planilla</DialogTitle>
            <DialogDescription>
              Esta acción revertirá TODOS los movimientos de esta planilla. Es irreversible.
            </DialogDescription>
          </DialogHeader>

          {planillaToAnular && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertDescription>
                  <strong>Planilla #{planillaToAnular.id}</strong>
                  <br />
                  Fecha: {new Date(planillaToAnular.fecha_planilla).toLocaleDateString('es-CR')}
                  <br />
                  Deductora: {planillaToAnular.deductora?.nombre}
                  <br />
                  Pagos procesados: {planillaToAnular.cantidad_pagos}
                </AlertDescription>
              </Alert>

              <div>
                <Label htmlFor="motivo">Motivo de anulación *</Label>
                <Textarea
                  id="motivo"
                  placeholder="Ej: Error en el archivo, se cargó mes incorrecto, etc."
                  value={motivoAnulacion}
                  onChange={(e) => setMotivoAnulacion(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAnularDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleAnularPlanilla}
              disabled={!motivoAnulacion.trim()}
            >
              Confirmar Anulación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
    </ProtectedPage>
  );
}