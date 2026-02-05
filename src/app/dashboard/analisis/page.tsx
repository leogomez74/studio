'use client';

import api from '@/lib/axios';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, Loader2, Eye, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { Opportunity, Lead } from '@/lib/data';
import { useToast, toastSuccess, toastError, toastWarning } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { usePermissions } from '@/contexts/PermissionsContext';
import { PermissionButton } from '@/components/PermissionButton';
import { ProtectedPage } from "@/components/ProtectedPage";
import { CreditFormModal } from '@/components/CreditFormModal';

// Funciones para formateo de moneda (Colones)
const formatCurrency = (value: string | number): string => {
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^\d.-]/g, '')) : value;
  if (isNaN(num)) return '';
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

const parseCurrencyToNumber = (value: string): string => {
  // Eliminar símbolo de moneda (₡, $, etc.)
  let cleaned = value.replace(/[₡$]/g, '');
  // Eliminar espacios (separadores de miles)
  cleaned = cleaned.replace(/\s/g, '');
  // Eliminar comas (separadores de miles, no decimales)
  cleaned = cleaned.replace(/,/g, '');
  // Eliminar todo excepto dígitos y punto decimal
  cleaned = cleaned.replace(/[^\d.]/g, '');
  return cleaned;
};

type AnalisisItem = {
  id: number;
  reference: string;
  monto_credito: number;
  estado_pep: string;
  estado_cliente?: string | null;
  created_at: string;
  opportunity_id?: string;
  lead_id?: string;
  has_credit?: boolean; // Indica si ya tiene un crédito asociado
  credit_id?: number; // ID del crédito si existe
  credit_status?: string | null; // Status del crédito asociado
  // Campos del análisis
  category?: string;
  title?: string;
  description?: string;
  divisa?: string;
  plazo?: number;
  ingreso_bruto?: number;
  ingreso_neto?: number;
  propuesta?: string;
  cargo?: string;
  nombramiento?: string;
  // Relaciones
  opportunity?: Opportunity;
  lead?: Lead;
};

type Product = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  is_default: boolean;
  order_column: number;
};

export default function AnalisisPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const [analisisList, setAnalisisList] = useState<AnalisisItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [perPage, setPerPage] = useState(10);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [estadoPepFilter, setEstadoPepFilter] = useState('all');
  const [estadoClienteFilter, setEstadoClienteFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [isCreditDialogOpen, setIsCreditDialogOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const [creditForm, setCreditForm] = useState({
    reference: '',
    title: '',
    status: 'Activo',
    category: 'Crédito',
    monto_credito: '',
    leadId: '',
    clientName: '',
    description: '',
    divisa: 'CRC',
    plazo: '36',
    poliza: false,
    conCargosAdicionales: false,
  });

  // Estado para cargos adicionales editables
  const [cargosAdicionales, setCargosAdicionales] = useState({
    comision: 0,
    transporte: 10000,
    respaldo_deudor: 4950,
    descuento_factura: 0,
  });

  // Configuración de cargos adicionales por defecto
  const CARGOS_CONFIG = {
    comision: { porcentaje: 0.03, fijo: null }, // 3% del monto
    transporte: { porcentaje: null, fijo: 10000 },
    respaldo_deudor: { porcentaje: null, fijo: 4950, soloRegular: true },
    descuento_factura: { porcentaje: null, fijo: 0 },
  };

  // Calcular cargos por defecto basados en monto y categoría
  const calcularCargosDefault = (monto: number, category: string) => {
    const esRegular = category === 'Regular' || category === 'Personal (Diferentes usos)' || category === 'Refundición (Pagar deudas actuales)';
    return {
      comision: Math.round(monto * (CARGOS_CONFIG.comision.porcentaje || 0) * 100) / 100,
      transporte: CARGOS_CONFIG.transporte.fijo || 0,
      respaldo_deudor: esRegular ? (CARGOS_CONFIG.respaldo_deudor.fijo || 0) : 0,
      descuento_factura: 0,
    };
  };

  // Actualizar cargos automáticamente cuando se activa el switch o cambia el monto/categoría
  useEffect(() => {
    if (creditForm.conCargosAdicionales && creditForm.monto_credito) {
      const montoNumerico = parseFloat(parseCurrencyToNumber(creditForm.monto_credito));
      if (!isNaN(montoNumerico) && montoNumerico > 0) {
        const cargosCalculados = calcularCargosDefault(montoNumerico, creditForm.category);
        setCargosAdicionales(cargosCalculados);
      }
    }
  }, [creditForm.conCargosAdicionales, creditForm.monto_credito, creditForm.category]);

  const [isSaving, setIsSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);

      // Construir params con filtros server-side
      const analisisParams: Record<string, string | number> = {
        page: currentPage,
        per_page: perPage,
      };

      if (searchQuery.trim()) {
        analisisParams.search = searchQuery.trim();
      }
      if (estadoPepFilter !== 'all') {
        analisisParams.estado_pep = estadoPepFilter;
      }
      if (estadoClienteFilter !== 'all') {
        analisisParams.estado_cliente = estadoClienteFilter;
      }
      if (dateFrom) {
        analisisParams.date_from = dateFrom;
      }
      if (dateTo) {
        analisisParams.date_to = dateTo;
      }

      const [analisisRes, oppsRes, leadsRes, productsRes] = await Promise.all([
        api.get('/api/analisis', { params: analisisParams }),
        api.get('/api/opportunities?all=true'),
        api.get('/api/leads?all=true'),
        api.get('/api/products?all=true'),
      ]);

      const isPaginated = analisisRes.data.data && analisisRes.data.current_page;
      const analisisData = isPaginated ? analisisRes.data.data as AnalisisItem[] : analisisRes.data as AnalisisItem[];

      if (isPaginated) {
        setCurrentPage(analisisRes.data.current_page);
        setTotalPages(analisisRes.data.last_page);
        setTotalItems(analisisRes.data.total);
      }

      const oppsData = Array.isArray(oppsRes.data.data) ? oppsRes.data.data : oppsRes.data;
      const leadsData = Array.isArray(leadsRes.data.data) ? leadsRes.data.data : leadsRes.data;
      const productsData = productsRes.data as Product[];
      setOpportunities(oppsData);
      setLeads(leadsData);
      setProducts(productsData);

      const mapped = analisisData.map((item) => {
        const opportunity = oppsData.find((o: Opportunity) => String(o.id) === String(item.opportunity_id));
        let lead: Lead | undefined = item.lead;
        if (!lead && item.lead_id) {
          lead = leadsData.find((l: Lead) => String(l.id) === String(item.lead_id));
        } else if (!lead && opportunity?.lead) {
          lead = opportunity.lead;
        }
        return {
          ...item,
          opportunity,
          lead,
        };
      });
      setAnalisisList(mapped);
    } catch (err) {
      console.error(err);
      setError('No se pudieron cargar los datos.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, perPage, searchQuery, estadoPepFilter, estadoClienteFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleOpenDetail = (item: AnalisisItem) => {
    router.push(`/dashboard/analisis/${item.id}`);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setEstadoPepFilter('all');
    setEstadoClienteFilter('all');
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
  };

  const handleExportCSV = () => {
    if (analisisList.length === 0) {
      toastWarning("Sin datos", "No hay datos para exportar");
      return;
    }

    const formatAmountForCSV = (amount: number | null | undefined): string => {
      if (amount == null) return "-";
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    };

    const headers = ["Referencia", "Cédula", "Cliente", "Profesión", "Puesto", "Nombramiento", "Salario Bruto", "Monto", "Estado PEP", "Estado Cliente"];
    const rows = analisisList.map(item => [
      item.reference || "-",
      item.lead?.cedula || "-",
      item.lead?.name || "Sin asignar",
      item.lead?.profesion || "-",
      item.cargo || item.lead?.puesto || "-",
      item.nombramiento || item.lead?.estado_puesto || "-",
      formatAmountForCSV(item.ingreso_bruto),
      formatAmountForCSV(item.monto_credito),
      item.estado_pep || "Pendiente",
      item.estado_cliente || "-",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `analizados_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    if (analisisList.length === 0) {
      toastWarning("Sin datos", "No hay datos para exportar");
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(12);
    doc.text('Reporte de Analizados', 14, 16);

    const formatAmountForPDF = (amount: number | null | undefined): string => {
      if (amount == null) return "-";
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    };

    autoTable(doc, {
      startY: 22,
      head: [["Referencia", "Cédula", "Cliente", "Profesión", "Puesto", "Nombramiento", "Salario Bruto", "Monto", "Estado PEP", "Estado Cliente"]],
      body: analisisList.map((item) => [
        item.reference || "-",
        item.lead?.cedula || "-",
        item.lead?.name || "Sin asignar",
        item.lead?.profesion || "-",
        item.cargo || item.lead?.puesto || "-",
        item.nombramiento || item.lead?.estado_puesto || "-",
        formatAmountForPDF(item.ingreso_bruto),
        formatAmountForPDF(item.monto_credito),
        item.estado_pep || "Pendiente",
        item.estado_cliente || "-",
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [220, 53, 69] },
    });

    doc.save(`analizados_${Date.now()}.pdf`);
  };

  // 3. RENDERIZADO CONDICIONAL (Error)
  if (error) {
    return (
      <div className="flex justify-center items-center h-screen text-red-500">
        {error}
      </div>
    );
  }

  // 4. TABLA PRINCIPAL
  return (
    <ProtectedPage module="analizados">
      <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Analizados</CardTitle>
              <CardDescription>Gestiona y revisa los análisis de crédito.</CardDescription>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Desde</Label>
                  <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }} className="h-10 w-36" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hasta</Label>
                  <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }} className="h-10 w-36" />
                </div>
              </div>
              <Button variant="outline" onClick={handleClearFilters}>Limpiar filtros</Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" className="gap-2">
                    <Download className="h-4 w-4" />
                    Exportar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportCSV}>Descargar CSV</DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportPDF}>Descargar PDF</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Buscar</Label>
              <Input placeholder="Referencia, cliente o cédula" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-56" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado PEP</Label>
              <Select value={estadoPepFilter} onValueChange={(v) => { setEstadoPepFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-auto min-w-[140px]"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Pendiente">Pendiente</SelectItem>
                  <SelectItem value="Aceptado">Aceptado</SelectItem>
                  <SelectItem value="Pendiente de cambios">Pend. cambios</SelectItem>
                  <SelectItem value="Rechazado">Rechazado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado Cliente</Label>
              <Select value={estadoClienteFilter} onValueChange={(v) => { setEstadoClienteFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-auto min-w-[120px]"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Aprobado">Aprobado</SelectItem>
                  <SelectItem value="Rechazado">Rechazado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Por página</Label>
              <Select value={String(perPage)} onValueChange={(value) => {
                setPerPage(Number(value));
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-auto min-w-[70px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="30">30</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
          ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground uppercase text-xs">
                <tr>
                  <th className="px-6 py-3">Referencia</th>
                  <th className="px-6 py-3">Cliente (Lead)</th>
                  <th className="px-6 py-3 bg-blue-50 text-blue-800">Profesión</th>
                  <th className="px-6 py-3 bg-blue-50 text-blue-800">Puesto</th>
                  <th className="px-6 py-3 bg-blue-50 text-blue-800">Nombramiento</th>
                  <th className="px-6 py-3">Monto</th>
                  <th className="px-6 py-3">Estado PEP</th>
                  <th className="px-6 py-3">Estado Cliente</th>
                  <th className="px-6 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {analisisList.length > 0 ? (
                  analisisList.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    <button
                      className="text-blue-600 hover:underline"
                      onClick={() => handleOpenDetail(item)}
                    >
                      {item.reference}
                    </button>
                  </td>

                  {/* Nombre del Cliente */}
                  <td className="px-6 py-4 text-gray-700">
                    {item.lead?.id ? (
                      <Link
                        href={`/dashboard/clientes/${item.lead.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {item.lead.name}
                      </Link>
                    ) : (
                      'Sin Asignar'
                    )}
                  </td>

                  {/* COLUMNA: Profesión (Acceso anidado) */}
                  <td className="px-6 py-4 text-gray-600">
                    {item.lead?.profesion || '-'}
                  </td>

                  {/* COLUMNA: Puesto - Prioriza cargo del análisis */}
                  <td className="px-6 py-4 text-gray-600">
                    {item.cargo || item.lead?.puesto || '-'}
                  </td>

                  {/* COLUMNA: Nombramiento - Prioriza nombramiento del análisis */}
                  <td className="px-6 py-4 text-gray-600">
                    {(() => {
                      const nombramiento = item.nombramiento || item.lead?.estado_puesto || 'N/A';
                      return (
                        <span className={`px-2 py-1 rounded text-xs font-semibold
                          ${nombramiento.toLowerCase().includes('propiedad') || nombramiento.toLowerCase().includes('fijo')
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'}
                        `}>
                          {nombramiento}
                        </span>
                      );
                    })()}
                  </td>

                  {/* Monto (Formateado) */}
                  <td className="px-6 py-4 text-gray-700">
                    <Link
                      href={`/dashboard/analisis/${item.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      ₡{new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(item.monto_credito || 0)}
                    </Link>
                  </td>

                  {/* Estado PEP - Clickeable para cambiar */}
                  <td className="px-6 py-4">
                    {hasPermission('analizados', 'delete') && item.credit_status !== 'Formalizado' ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className={`px-2 py-1 rounded text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity
                            ${item.estado_pep === 'Aceptado' ? 'bg-green-100 text-green-700' :
                              item.estado_pep === 'Rechazado' ? 'bg-red-100 text-red-700' :
                              item.estado_pep === 'Pendiente de cambios' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-800'}`}>
                            {item.estado_pep || 'Pendiente'}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-2">
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-gray-500 mb-2">Cambiar Estado PEP:</p>
                            {(() => {
                              const transiciones: Record<string, string[]> = {
                                'Pendiente': ['Pendiente de cambios', 'Aceptado', 'Rechazado'],
                                'Pendiente de cambios': ['Aceptado', 'Rechazado'],
                                'Aceptado': ['Pendiente de cambios', 'Rechazado'],
                                'Rechazado': ['Pendiente de cambios'],
                              };
                              const estadoActual = item.estado_pep || 'Pendiente';
                              const permitidos = transiciones[estadoActual] || [];
                              return permitidos.length === 0 ? (
                                <p className="text-xs text-muted-foreground px-2 py-1">Estado final, no se puede cambiar.</p>
                              ) : permitidos.map((estado) => (
                              <button
                                key={estado}
                                className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-100`}
                                onClick={async () => {
                                  try {
                                    const payload: Record<string, string | null> = { estado_pep: estado };
                                    if (estado === 'Aceptado') {
                                      payload.estado_cliente = 'Pendiente';
                                    } else {
                                      payload.estado_cliente = null;
                                    }
                                    await api.put(`/api/analisis/${item.id}`, payload);
                                    setAnalisisList(prev => prev.map(a =>
                                      a.id === item.id ? { ...a, estado_pep: estado, estado_cliente: estado === 'Aceptado' ? 'Pendiente' : null } : a
                                    ));
                                    toastSuccess("Estado actualizado", `Estado PEP cambiado a "${estado}"`);
                                  } catch (err: any) {
                                    const errorMessage = err?.response?.data?.message || "No se pudo actualizar el estado";
                                    toastError("Error", errorMessage);
                                  }
                                }}
                              >
                                {estado}
                              </button>
                            ));
                            })()}
                          </div>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <span className={`px-2 py-1 rounded text-xs font-semibold
                        ${item.estado_pep === 'Aceptado' ? 'bg-green-100 text-green-700' :
                          item.estado_pep === 'Rechazado' ? 'bg-red-100 text-red-700' :
                          item.estado_pep === 'Pendiente de cambios' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-800'}`}>
                        {item.estado_pep || 'Pendiente'}
                      </span>
                    )}
                  </td>

                  {/* Estado Cliente - Solo visible si estado_pep es Aceptado */}
                  <td className="px-6 py-4">
                    {item.estado_pep === 'Aceptado' ? (
                      hasPermission('analizados', 'archive') && item.credit_status !== 'Formalizado' ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className={`px-2 py-1 rounded text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity
                              ${item.estado_cliente === 'Aprobado' ? 'bg-green-100 text-green-700' :
                                item.estado_cliente === 'Rechazado' ? 'bg-red-100 text-red-700' :
                                item.estado_cliente === 'Pendiente' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                              {item.estado_cliente || 'Sin definir'}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-40 p-2">
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-gray-500 mb-2">Estado Cliente:</p>
                              {['Pendiente', 'Aprobado', 'Rechazado'].map((estado) => (
                                <button
                                  key={estado}
                                  className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-100 ${item.estado_cliente === estado ? 'bg-gray-100 font-medium' : ''}`}
                                  onClick={async () => {
                                    try {
                                      await api.put(`/api/analisis/${item.id}`, { estado_cliente: estado });
                                      setAnalisisList(prev => prev.map(a =>
                                        a.id === item.id ? { ...a, estado_cliente: estado } : a
                                      ));
                                      toastSuccess("Estado actualizado", `Estado Cliente cambiado a "${estado}"`);
                                    } catch (err: any) {
                                      const errorMessage = err?.response?.data?.message || "No se pudo actualizar el estado";
                                      toastError("Error", errorMessage);
                                    }
                                  }}
                                >
                                  {estado}
                                </button>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <span className={`px-2 py-1 rounded text-xs font-semibold
                          ${item.estado_cliente === 'Aprobado' ? 'bg-green-100 text-green-700' :
                            item.estado_cliente === 'Rechazado' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                          {item.estado_cliente || 'Sin definir'}
                        </span>
                      )
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>

                  {/* Acciones */}
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      {item.estado_cliente === 'Aprobado' && !item.has_credit && (
                        <PermissionButton
                          module="creditos"
                          action="create"
                          variant="outline"
                          className="border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700"
                          title="Generar crédito"
                          onClick={async () => {
                            try {
                              // Obtener la próxima referencia del servidor
                              const refResponse = await api.get('/api/credits/next-reference');
                              const nextReference = refResponse.data.reference;

                              setCreditForm({
                                reference: nextReference,
                                title: item.lead?.name || '',
                                status: 'Por firmar',
                                category: item.category || 'Regular',
                                monto_credito: item.monto_credito ? String(item.monto_credito) : '',
                                leadId: item.lead_id ? String(item.lead_id) : (item.lead?.id ? String(item.lead.id) : ''),
                                clientName: item.lead?.name || '',
                                description: item.description || '',
                                divisa: item.divisa || 'CRC',
                                plazo: item.plazo ? String(item.plazo) : '36',
                                poliza: false,
                                conCargosAdicionales: true,
                              });
                              setCurrentStep(1); // Resetear al abrir
                              setIsCreditDialogOpen(true);
                            } catch (err) {
                              toastError("Error", "No se pudo obtener la referencia del crédito");
                            }
                          }}
                        >
                          Generar crédito
                        </PermissionButton>
                      )}
                      {item.has_credit && item.credit_id && (
                        <Button
                          variant="outline"
                          className="border-blue-500 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                          title="Ver Crédito"
                          onClick={() => router.push(`/dashboard/creditos/${item.credit_id}`)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Ver Crédito
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="px-6 py-8 text-center text-muted-foreground">
                  No hay análisis registrados aún.
                </td>
              </tr>
            )}
          </tbody>
        </table>

              {totalItems > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-6 border-t">
                  <div className="text-sm text-muted-foreground">
                    Mostrando {((currentPage - 1) * perPage) + 1} - {Math.min(currentPage * perPage, totalItems)} de {totalItems} analizados
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={handlePreviousPage} disabled={currentPage === 1}>
                        Anterior
                      </Button>
                      <div className="flex items-center gap-1">
                        {currentPage > 3 && (
                          <>
                            <Button variant={currentPage === 1 ? "default" : "outline"} size="sm" onClick={() => handlePageChange(1)} className="w-9 h-9 p-0">
                              1
                            </Button>
                            {currentPage > 4 && <span className="px-2 text-muted-foreground">...</span>}
                          </>
                        )}
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter(page => Math.abs(page - currentPage) <= 2)
                          .map(page => (
                            <Button key={page} variant={currentPage === page ? "default" : "outline"} size="sm" onClick={() => handlePageChange(page)} className="w-9 h-9 p-0">
                              {page}
                            </Button>
                          ))}
                        {currentPage < totalPages - 2 && (
                          <>
                            {currentPage < totalPages - 3 && <span className="px-2 text-muted-foreground">...</span>}
                            <Button variant={currentPage === totalPages ? "default" : "outline"} size="sm" onClick={() => handlePageChange(totalPages)} className="w-9 h-9 p-0">
                              {totalPages}
                            </Button>
                          </>
                        )}
                      </div>
                      <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage === totalPages}>
                        Siguiente
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog for creating credit */}
      <CreditFormModal
        open={isCreditDialogOpen}
        onOpenChange={setIsCreditDialogOpen}
        initialData={{
          reference: creditForm.reference,
          title: creditForm.title,
          monto_credito: creditForm.monto_credito,
          leadId: creditForm.leadId,
          clientName: creditForm.clientName,
          category: creditForm.category,
          divisa: creditForm.divisa,
          plazo: creditForm.plazo,
          description: creditForm.description,
        }}
        products={products}
        leads={leads.map(l => ({ ...l, id: Number(l.id) }))}
        onSuccess={() => {
          // Refrescar la lista de análisis
          fetchAll();
        }}
      />
    </div>
    </ProtectedPage>
  );
}