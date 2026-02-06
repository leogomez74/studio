"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Pencil,
  PlusCircle,
  Sparkles,
  Loader2,
  Trash,
  X,
  Search,
  Check,
  ChevronsUpDown,
  Eye,
  Handshake
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast, toastSuccess, toastError, toastWarning } from "@/hooks/use-toast";
import { useBulkSelection } from "@/hooks/use-bulk-selection";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { BulkActionsToolbar } from "@/components/bulk-actions-toolbar";

// Importamos la conexión real y los tipos
import api from '@/lib/axios';
import { type Client, type Lead, type Opportunity } from '@/lib/data';
import { CreateOpportunityDialog } from "@/components/opportunities/create-opportunity-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PermissionButton } from "@/components/PermissionButton";
import { ProtectedPage } from "@/components/ProtectedPage";

// --- Helpers ---

const normalizeCedulaInput = (value: string): string => value.replace(/[^0-9]/g, "");

const normalizePhoneInput = (value: string): string => value.replace(/[^0-9]/g, "");

const formatCedula = (value: string): string => {
  const numericValue = value.replace(/[^0-9]/g, "");
  return numericValue;
};

const formatMonto = (value: string): string => {
  const numericValue = value.replace(/[^0-9]/g, "");
  if (!numericValue) return "";
  // Manually format with commas as thousand separators
  return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const normalizeMonto = (value: string): string => {
  return value.replace(/[^0-9]/g, "");
};

const leadSchema = z.object({
  // Campos auto-rellenados por TSE (opcionales)
  name: z.string().optional(),
  apellido1: z.string().optional(),
  apellido2: z.string().optional(),
  fechaNacimiento: z.string().optional().refine((date) => {
    if (!date) return true; // Opcional
    // input[type="date"] siempre devuelve YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateObj = new Date(date + 'T00:00:00');
    return dateObj <= today;
  }, "La fecha de nacimiento no puede ser en el futuro"),
  // Campos visibles en formulario (requeridos)
  cedula: z.string().min(1, "La cédula es requerida"),
  email: z.string().min(1, "El correo es requerido").email("Correo inválido"),
  phone: z.string().min(1, "El teléfono es requerido"),
  phonePrefix: z.string().optional(),
  isExtranjero: z.boolean().optional(),
  sector: z.string().min(1, "El sector laboral es requerido"),
  product_id: z.string().optional(),
  monto: z.string().optional(),
});

type LeadFormValues = z.infer<typeof leadSchema>;

const formatRegistered = (dateString: string | null | undefined) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-CR", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
};

const STATUS_BADGE_STYLES: Record<string, string> = {
  nuevo: "border-transparent bg-emerald-600 text-white",
  inactivo: "border-transparent bg-zinc-500 text-white",
  contactado: "border-transparent bg-primary text-primary-foreground",
  bloqueado: "border-red-600 bg-red-600 text-white",
  presentado: "border-sky-200 bg-sky-100 text-sky-900",
  "con curso": "border-blue-200 bg-blue-100 text-blue-900",
  "auto de curso": "border-blue-200 bg-blue-100 text-blue-900",
  "para redactar": "border-amber-200 bg-amber-100 text-amber-900",
  "rechazo de plano": "border-rose-200 bg-rose-100 text-rose-900",
  "con lugar con costas": "border-emerald-200 bg-emerald-100 text-emerald-900",
  "con lugar sin costas": "border-teal-200 bg-teal-100 text-teal-900",
  sentencia: "border-purple-200 bg-purple-100 text-purple-900",
  "con sentencia": "border-purple-200 bg-purple-100 text-purple-900",
  "sin estado": "border-transparent bg-muted text-muted-foreground",
};

const normalizeStatusValue = (value?: string | null): string => (value?.trim().toLowerCase() ?? "");

const getStatusBadgeClassName = (label: string): string => {
  const normalized = normalizeStatusValue(label);
  return STATUS_BADGE_STYLES[normalized] ?? "border-transparent bg-secondary text-secondary-foreground";
};

const getLeadDisplayName = (lead?: Lead | Client | null): string => {
  if (!lead) return "";
  const fullName = [lead.name, (lead as any).apellido1, (lead as any).apellido2]
    .filter(Boolean)
    .join(" ");
  return fullName || lead.name || "";
};

const getLeadInitials = (lead?: Lead | Client | null): string => {
  const displayName = getLeadDisplayName(lead).trim();
  if (displayName.length === 0) return "LE";
  return displayName.slice(0, 2).toUpperCase();
};

type LeadStatus = {
    id: number;
    name: string;
};

const checkMissingFields = (item: Lead | Client): string[] => {
  // Mapeo de campos requeridos con sus nombres legibles
  const requiredFieldsMap: Record<string, string> = {
    cedula: 'Cédula',
    name: 'Nombre',
    apellido1: 'Primer apellido',
    email: 'Correo electrónico',
    phone: 'Teléfono',
    whatsapp: 'WhatsApp',
    fecha_nacimiento: 'Fecha de nacimiento',
    estado_civil: 'Estado civil',
    // Información laboral
    profesion: 'Profesión',
    nivel_academico: 'Nivel académico',
    puesto: 'Puesto',
    institucion_labora: 'Institución donde labora',
    deductora_id: 'Deductora',
    sector: 'Sector laboral',
    // Dirección personal
    province: 'Provincia',
    canton: 'Cantón',
    distrito: 'Distrito',
    direccion1: 'Dirección exacta',
    // Dirección de trabajo
    trabajo_provincia: 'Provincia (trabajo)',
    trabajo_canton: 'Cantón (trabajo)',
    trabajo_distrito: 'Distrito (trabajo)',
    trabajo_direccion: 'Dirección de trabajo',
  };

  const missingFields: string[] = [];

  // Iterar sobre los campos requeridos y verificar si están vacíos
  Object.entries(requiredFieldsMap).forEach(([field, label]) => {
    const value = (item as any)[field];

    // Verificar si el campo está vacío (null, undefined, string vacío, o 0 para deductora_id)
    if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '') || (field === 'deductora_id' && value === 0)) {
      missingFields.push(label);
    }
  });

  // Validar documentos requeridos (Cédula y Recibo)
  const documents = (item as any).documents || [];
  const hasCedula = documents.some((doc: any) => doc.category === 'cedula');
  const hasRecibo = documents.some((doc: any) => doc.category === 'recibo_servicio');

  if (!hasCedula) {
    missingFields.push('Archivo de Cédula');
  }
  if (!hasRecibo) {
    missingFields.push('Archivo de Recibo');
  }

  return missingFields;
};

// --- Main Component ---

export default function ClientesPage() {
  const { toast } = useToast();
  const router = useRouter();

  // Data State
  const [clientsData, setClientsData] = useState<Client[]>([]);
  const [leadsData, setLeadsData] = useState<Lead[]>([]);
  const [inactiveData, setInactiveData] = useState<(Lead | Client)[]>([]);
  const [unifiedSearchResults, setUnifiedSearchResults] = useState<Array<(Lead | Client) & { _type: 'lead' | 'cliente' | 'inactivo' }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [perPage, setPerPage] = useState(10);

  // Lists for Dropdowns
  const [leadStatuses, setLeadStatuses] = useState<LeadStatus[]>([]);
  const [products, setProducts] = useState<{ id: number; name: string }[]>([]);
  const [instituciones, setInstituciones] = useState<Array<{ id: number; nombre: string; activa: boolean }>>([]);
  const [openInstitucion, setOpenInstitucion] = useState(false);
  const [searchInstitucion, setSearchInstitucion] = useState("");

  // UI State
  const [isLeadFiltersOpen, setIsLeadFiltersOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("leads");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Bulk Selection Hooks (one for each tab)
  const leadsSelection = useBulkSelection<Lead>();
  const clientsSelection = useBulkSelection<Client>();
  const inactivesSelection = useBulkSelection<Lead | Client>();

  // Bulk Actions State
  const [isConfirmBulkActionOpen, setIsConfirmBulkActionOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'archive' | 'restore' | 'convert' | 'delete' | null>(null);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [contactFilter, setContactFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Dialog State
  const [isLeadDialogOpen, setIsLeadDialogOpen] = useState(false);
  const [isSavingLead, setIsSavingLead] = useState(false);
  const [editingId, setEditingId] = useState<string | Number | null>(null);
  const [editingType, setEditingType] = useState<'lead' | 'client' | null>(null);
  const [isViewOnly, setIsViewOnly] = useState(false);

  // Form Definition
  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      name: "",
      apellido1: "",
      apellido2: "",
      email: "",
      phone: "",
      cedula: "",
      fechaNacimiento: "",
      sector: "",
      phonePrefix: "+506",
      isExtranjero: false,
      product_id: "",
      monto: "",
    },
  });

  // TSE Lookup State (copiado del registro público)
  const [isFetchingTse, setIsFetchingTse] = useState(false);
  const [lastTseCedula, setLastTseCedula] = useState<string | null>(null);
  const [tseData, setTseData] = useState<any>(null);
  const [tseNotFound, setTseNotFound] = useState(false);
  const [showTseConfirmation, setShowTseConfirmation] = useState(false);
  const [userConfirmedTse, setUserConfirmedTse] = useState(false);
  const [isExtranjero, setIsExtranjero] = useState(false);
  const [showExtranjeroFields, setShowExtranjeroFields] = useState(false);

  // WhatsApp Verification State
  const [whatsappVerified, setWhatsappVerified] = useState(false);
  const [whatsappVerifying, setWhatsappVerifying] = useState(false);
  const [whatsappError, setWhatsappError] = useState<string | null>(null);

  // Country codes para extranjeros

  // Opportunity Dialog State
  const [isOpportunityDialogOpen, setIsOpportunityDialogOpen] = useState(false);
  const [leadForOpportunity, setLeadForOpportunity] = useState<Lead | null>(null);

  // Delete Client State
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // WhatsApp Verification Function
  const checkWhatsApp = async (fullNumber: string): Promise<boolean> => {
    if (!fullNumber || fullNumber.length < 7) return false;

    setWhatsappVerifying(true);
    setWhatsappError(null);

    try {
      const EVOLUTION_API_URL = 'https://evolution.ssc.cr';
      const EVOLUTION_API_KEY = '7E269F8C445B-4D63-B75B-BB59D7481AC7';
      const EVOLUTION_INSTANCE = 'Informacion Pep';

      const response = await fetch(`${EVOLUTION_API_URL}/chat/whatsappNumbers/${encodeURIComponent(EVOLUTION_INSTANCE)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY
        },
        body: JSON.stringify({ numbers: [fullNumber] })
      });
      const data = await response.json();

      if (Array.isArray(data) && data.length > 0 && data[0].exists) {
        setWhatsappVerified(true);
        setWhatsappError(null);
        return true;
      } else {
        setWhatsappVerified(false);
        setWhatsappError('Este número no tiene WhatsApp');
        return false;
      }
    } catch (error) {
      console.error('Error verificando WhatsApp:', error);
      setWhatsappVerified(false);
      setWhatsappError('Error al verificar WhatsApp');
      return false;
    } finally {
      setWhatsappVerifying(false);
    }
  };

  // --- Effects ---

    useEffect(() => {
    const fetchLists = async () => {
      try {
        // Fetch lead statuses
        const resStatuses = await api.get('/api/lead-statuses');
        setLeadStatuses(Array.isArray(resStatuses.data) ? resStatuses.data : []);

        // Fetch products
        const resProducts = await api.get('/api/products');
        console.log('=== DEBUG PRODUCTOS ===');
        console.log('Respuesta completa:', resProducts);
        console.log('resProducts.data:', resProducts.data);
        console.log('Tipo de resProducts.data:', typeof resProducts.data);
        console.log('Es array resProducts.data?', Array.isArray(resProducts.data));

        // Axios wraps the response in a data property
        const productsArray = Array.isArray(resProducts.data) ? resProducts.data : [];

        console.log('Productos a establecer:', productsArray);
        console.log('Cantidad de productos:', productsArray.length);

        setProducts(productsArray);

        // Fetch instituciones
        try {
          const resInst = await api.get('/api/instituciones?activas_only=true');
          setInstituciones(Array.isArray(resInst.data) ? resInst.data : []);
        } catch { setInstituciones([]); }
      } catch (err) {
        console.error("Error cargando listas:", err);
        setLeadStatuses([]);
        setProducts([]);
      }
    };
    fetchLists();
    }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const commonParams: any = {};
      if (searchQuery) commonParams.q = searchQuery;
      if (contactFilter !== "all") commonParams.has_contact = contactFilter;
      if (dateFrom) commonParams.date_from = dateFrom;
      if (dateTo) commonParams.date_to = dateTo;
      commonParams.page = currentPage;
      commonParams.per_page = perPage;

      // BÚSQUEDA UNIFICADA: Si hay searchQuery, buscar en todas las categorías
      if (searchQuery && searchQuery.trim()) {
        const [activeLeadsRes, activeClientsRes, inactiveLeadsRes, inactiveClientsRes] = await Promise.all([
          api.get('/api/leads', { params: { ...commonParams, is_active: 1 } }),
          api.get('/api/clients', { params: { ...commonParams, is_active: 1 } }),
          api.get('/api/leads', { params: { ...commonParams, is_active: 0 } }),
          api.get('/api/clients', { params: { ...commonParams, is_active: 0 } })
        ]);

        const activeLeads = (activeLeadsRes.data.data || activeLeadsRes.data || []).map((item: any) => ({ ...item, _type: 'lead' as const }));
        const activeClients = (activeClientsRes.data.data || activeClientsRes.data || []).map((item: any) => ({ ...item, _type: 'cliente' as const }));
        const inactiveLeads = (inactiveLeadsRes.data.data || inactiveLeadsRes.data || []).map((item: any) => ({ ...item, _type: 'inactivo' as const }));
        const inactiveClients = (inactiveClientsRes.data.data || inactiveClientsRes.data || []).map((item: any) => ({ ...item, _type: 'inactivo' as const }));

        // Combinar y ordenar: Leads primero, luego Clientes, luego Inactivos
        const unified = [...activeLeads, ...activeClients, ...inactiveLeads, ...inactiveClients];
        setUnifiedSearchResults(unified);
        setTotalItems(unified.length);
        setTotalPages(1);
        setLoading(false);
        return;
      }

      // COMPORTAMIENTO NORMAL: Sin búsqueda, usar tabs normalmente
      const leadParams = { ...commonParams };
      const clientParams = { ...commonParams };

      if (activeTab === 'inactivos') {
          leadParams.is_active = 0;
          clientParams.is_active = 0;
      } else {
          leadParams.is_active = 1;
          clientParams.is_active = 1;
      }

      if (statusFilter !== "all") {
          if (activeTab === "leads") {
              leadParams.lead_status_id = statusFilter;
          } else if (activeTab === "clientes") {
              clientParams.status = statusFilter;
          }
      }

      // Limpiar resultados unificados cuando no hay búsqueda
      setUnifiedSearchResults([]);

      if (activeTab === "leads") {
        const resLeads = await api.get('/api/leads', { params: leadParams });
        const isPaginated = resLeads.data.data && resLeads.data.current_page;

        if (isPaginated) {
          setLeadsData(Array.isArray(resLeads.data.data) ? resLeads.data.data : []);
          setCurrentPage(resLeads.data.current_page);
          setTotalPages(resLeads.data.last_page);
          setTotalItems(resLeads.data.total);
        } else {
          setLeadsData(Array.isArray(resLeads.data) ? resLeads.data : []);
        }
      } else if (activeTab === "clientes") {
        const resClients = await api.get('/api/clients', { params: clientParams });
        const isPaginated = resClients.data.data && resClients.data.current_page;

        if (isPaginated) {
          setClientsData(Array.isArray(resClients.data.data) ? resClients.data.data : []);
          setCurrentPage(resClients.data.current_page);
          setTotalPages(resClients.data.last_page);
          setTotalItems(resClients.data.total);
        } else {
          setClientsData(Array.isArray(resClients.data) ? resClients.data : []);
        }
      } else if (activeTab === 'inactivos') {
        const [resClients, resLeads] = await Promise.all([
          api.get('/api/clients', { params: clientParams }),
          api.get('/api/leads', { params: leadParams })
        ]);

        const clientsArray = resClients.data.data || resClients.data;
        const leadsArray = resLeads.data.data || resLeads.data;

        const combined = [...(Array.isArray(clientsArray) ? clientsArray : []), ...(Array.isArray(leadsArray) ? leadsArray : [])];
        combined.sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime());
        setInactiveData(combined);

        // For inactivos tab, we don't have server-side pagination
        setTotalItems(combined.length);
        setTotalPages(1);
      }

    } catch (err) {
      console.error("Error cargando datos:", err);
      setError("Error de conexión. Verifica que el backend esté corriendo.");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, contactFilter, dateFrom, dateTo, activeTab, statusFilter, currentPage, perPage]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
        fetchData();
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [fetchData]);

  // --- Handlers ---

  const handleTabChange = (value: string) => {
      setActiveTab(value);
      setStatusFilter("all");
  };

  const handleClearFilters = () => {
      setSearchQuery("");
      setContactFilter("all");
      setStatusFilter("all");
      setDateFrom("");
      setDateTo("");
      setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleExportPDF = () => {
    let dataToExport: any[] = [];
    let title = "";

    if (activeTab === "leads") {
        dataToExport = leadsData;
        title = "Reporte de Leads";
    } else if (activeTab === "clientes") {
        dataToExport = clientsData;
        title = "Reporte de Clientes";
    } else {
        dataToExport = inactiveData;
        title = "Reporte de Inactivos";
    }

    if (dataToExport.length === 0) {
        toastWarning("Sin datos", "No hay datos para exportar");
        return;
    }

    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(12);
    doc.text(title, 14, 16);

    const tableColumn = ["Cédula", "Nombre", "Email", "Teléfono", "Estado", "Registrado"];
    const tableRows = dataToExport.map((item: any) => [
        item.cedula || "-",
        getLeadDisplayName(item),
        item.email,
        item.phone || "-",
        activeTab === "leads"
            ? (item.lead_status?.name || item.lead_status_id)
            : (item.status || (item.is_active ? 'Activo' : 'Inactivo')),
        formatRegistered(item.created_at)
    ]);

    autoTable(doc, {
        startY: 22,
        head: [tableColumn],
        body: tableRows,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [15, 23, 42] },
    });

    doc.save(`${activeTab}_${Date.now()}.pdf`);
  };

  const handleExportCSV = () => {
    let dataToExport: any[] = [];
    let filename = "";

    if (activeTab === "leads") {
        dataToExport = leadsData;
        filename = "leads";
    } else if (activeTab === "clientes") {
        dataToExport = clientsData;
        filename = "clientes";
    } else {
        dataToExport = inactiveData;
        filename = "inactivos";
    }

    if (dataToExport.length === 0) {
        toastWarning("Sin datos", "No hay datos para exportar");
        return;
    }

    const headers = ["Cédula", "Nombre", "Email", "Teléfono", "Estado", "Registrado"];
    const rows = dataToExport.map((item: any) => [
        item.cedula || "-",
        getLeadDisplayName(item),
        item.email,
        item.phone || "-",
        activeTab === "leads"
            ? (item.lead_status?.name || item.lead_status_id)
            : (item.status || (item.is_active ? 'Activo' : 'Inactivo')),
        formatRegistered(item.created_at)
    ]);

    const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Dialog Handlers ---

  const openLeadDialog = () => {
    form.reset({
      name: "",
      apellido1: "",
      apellido2: "",
      email: "",
      phone: "",
      cedula: "",
      fechaNacimiento: "",
      sector: "",
    });
    setEditingId(null);
    setEditingType(null);
    setLastTseCedula(null);
    setIsViewOnly(false);
    setIsLeadDialogOpen(true);
  };

  const closeLeadDialog = () => {
    setIsLeadDialogOpen(false);
    form.reset();
    setEditingId(null);
    setEditingType(null);
    setLastTseCedula(null);
    setIsViewOnly(false);
    setTseData(null);
    setTseNotFound(false);
    setShowTseConfirmation(false);
    setUserConfirmedTse(false);
    setIsExtranjero(false);
    setShowExtranjeroFields(false);
    setWhatsappVerified(false);
    setWhatsappVerifying(false);
    setWhatsappError(null);
  };

  // TSE Lookup Logic (copiado del registro público)
  const handleTseLookup = useCallback(
    async (cedulaInput: string): Promise<void> => {
      const trimmed = cedulaInput.trim();
      const normalizedCedulaValue = normalizeCedulaInput(trimmed);
      if (!normalizedCedulaValue || normalizedCedulaValue.length < 6 || normalizedCedulaValue === lastTseCedula) {
        return;
      }

      // Reset form state
      setTseData(null);
      setTseNotFound(false);
      setShowTseConfirmation(false);
      setShowExtranjeroFields(false);
      setUserConfirmedTse(false);

      setIsFetchingTse(true);
      try {
        const response = await fetch(`https://www.dsf.cr/tse/${encodeURIComponent(normalizedCedulaValue)}`);
        const payload = await response.json();

        if (payload.success && payload.nombre) {
          // TSE encontró datos
          const tseInfo = {
            nombre: payload.nombre,
            apellido1: payload.apellido1,
            apellido2: payload.apellido2,
            fechaNacimiento: payload["fecha-nacimiento"] || payload.fecha_nacimiento,
            genero: payload.sexo
          };
          setTseData(tseInfo);
          setShowTseConfirmation(true);
          setLastTseCedula(normalizedCedulaValue);
        } else {
          // No encontrado
          setTseNotFound(true);
          setLastTseCedula(normalizedCedulaValue);
        }
      } catch (error) {
        console.error("Error consultando TSE", error);
        setTseNotFound(true);
        setLastTseCedula(normalizedCedulaValue);
      } finally {
        setIsFetchingTse(false);
      }
    },
    [lastTseCedula]
  );

  // Handlers para confirmación TSE
  const handleTseYes = () => {
    if (!tseData) return;
    setUserConfirmedTse(true);
    setShowTseConfirmation(false);
    setIsExtranjero(false);
    form.setValue("name", tseData.nombre);
    form.setValue("apellido1", tseData.apellido1);
    form.setValue("apellido2", tseData.apellido2);
    form.setValue("fechaNacimiento", formatDateForInput(tseData.fechaNacimiento));
    form.setValue("isExtranjero", false);
    form.setValue("phonePrefix", "+506");
  };

  const handleTseNo = () => {
    setTseData(null);
    setUserConfirmedTse(false);
    setShowTseConfirmation(false);
    setShowExtranjeroFields(true);
    setIsExtranjero(false);
    form.setValue("isExtranjero", false);
    form.setValue("phonePrefix", "+506");
  };

  const handleExtranjeroYes = () => {
    setTseNotFound(false);
    setIsExtranjero(true);
    setShowExtranjeroFields(true);
    form.setValue("isExtranjero", true);
    if (!form.getValues("phonePrefix")) {
      form.setValue("phonePrefix", "+506");
    }
  };

  const handleExtranjeroNo = () => {
    setTseNotFound(false);
    setIsExtranjero(false);
    setShowExtranjeroFields(true);
    form.setValue("isExtranjero", false);
    form.setValue("phonePrefix", "+506");
  };


  const onSubmit = async (values: LeadFormValues) => {
    setIsSavingLead(true);

    // Verificar WhatsApp al momento de enviar (solo para nuevos leads)
    if (!editingId) {
      const prefix = (values.phonePrefix || '+506').replace('+', '');
      const fullPhone = prefix + values.phone;

      const isVerified = await checkWhatsApp(fullPhone);

      if (!isVerified) {
        setIsSavingLead(false);
        toastError("Error", "El número no está registrado en WhatsApp");
        return;
      }
    }

    try {
      // El input[type="date"] ya devuelve YYYY-MM-DD, listo para el backend
      const formattedDate = values.fechaNacimiento || null;

      // Construir número completo de WhatsApp
      const prefix = (values.phonePrefix || '+506').replace('+', '');
      const fullPhone = prefix + values.phone;

      const body: Record<string, any> = {
        name: values.name?.trim() || null,
        email: values.email?.trim() || null,
        cedula: values.cedula ? values.cedula.replace(/[^0-9]/g, '') : null,
        phone: values.phone || null,
        whatsapp: fullPhone,
        apellido1: values.apellido1?.trim() || null,
        apellido2: values.apellido2?.trim() || null,
        sector: values.sector || null,
        ...(editingId ? {} : { status: "Nuevo" }),
        fecha_nacimiento: formattedDate,
        product_id: values.product_id || null,
        monto: values.monto || null,
      };

      if (editingId) {
          const endpoint = editingType === 'client' ? `/api/clients/${editingId}` : `/api/leads/${editingId}`;
          await api.put(endpoint, body);
          toastSuccess("Actualizado", "Datos actualizados correctamente.");
      } else {
          const response = await api.post('/api/leads', body);
          const hasOpportunity = response.data?.opportunity !== null;
          toastSuccess(
            "Creado",
            hasOpportunity
              ? "Lead y oportunidad registrados exitosamente."
              : "Lead registrado exitosamente."
          );
      }

      closeLeadDialog();
      fetchData();
    } catch (error: any) {
      console.error("Error guardando:", error);
      // Improved error handling
      if (error.response?.data?.errors) {
        const errors = error.response.data.errors;
        // Map backend errors to form fields
        Object.keys(errors).forEach((key) => {
          // Assuming the backend returns standard Laravel error structure
          // e.g. { errors: { email: ["The email has already been taken."] } }
          const message = errors[key][0];
          // Map backend field names to frontend field names if they differ
          // Here they mostly match (email, name, cedula, etc.)
          form.setError(key as keyof LeadFormValues, { type: "server", message });
        });
        
        toastError("Error de validación", "Por favor revisa los campos marcados en rojo.");
      } else {
        toastError("Error", error.response?.data?.message || "No se pudo guardar.");
      }
    } finally {
      setIsSavingLead(false);
    }
  };

  // --- Action Handlers ---

  const handleLeadAction = (action: string, lead: Lead) => {
      switch (action) {
          case 'create_opportunity':
              setLeadForOpportunity(lead);
              setIsOpportunityDialogOpen(true);
              break;
          case 'edit':
              // Normally router push, but here using the dialog for now to test validation?
              // The original code used router.push. I'll respect that but if we want to edit IN dialog:
              // router.push(`/dashboard/leads/${lead.id}?mode=edit`);
              // Let's implement edit IN dialog to show off the form
              setEditingId(lead.id);
              setEditingType('lead');
              form.reset({
                name: lead.name,
                apellido1: (lead as any).apellido1 || "",
                apellido2: (lead as any).apellido2 || "",
                email: lead.email,
                phone: lead.phone || "",
                cedula: lead.cedula || "",
                fechaNacimiento: (lead as any).fecha_nacimiento ? formatDateForInput((lead as any).fecha_nacimiento) : "",
                sector: (lead as any).sector || "",
              });
              setIsLeadDialogOpen(true);
              break;
          case 'view':
              router.push(`/dashboard/leads/${lead.id}?mode=view`);
              break;
          case 'convert':
              handleConvertLead(lead);
              break;
          case 'archive':
              handleArchiveLead(lead);
              break;
      }
  };

  // Helper: devuelve YYYY-MM-DD para input[type="date"]
  const formatDateForInput = (dateStr: string) => {
    if (!dateStr) return "";
    // Si ya viene en formato ISO o YYYY-MM-DD, extraer solo la parte de fecha
    const isoMatch = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) return isoMatch[1];
    // Si viene en DD-MM-YYYY, convertir a YYYY-MM-DD
    const ddmmyyyyMatch = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (ddmmyyyyMatch) {
      const [, d, m, y] = ddmmyyyyMatch;
      return `${y}-${m}-${d}`;
    }
    // Fallback: intentar parsear con Date
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    return date.toISOString().split('T')[0];
  };

  const handleConvertLead = async (lead: Lead) => {
      try {
          await api.post(`/api/leads/${lead.id}/convert`);
          toastSuccess("Convertido", `${lead.name} ahora es cliente.`);
          fetchData();
      } catch (error) {
          toastError("Error", "No se pudo convertir.");
      }
  };

  const handleArchiveLead = async (lead: Lead) => {
      // Validar que no tenga oportunidades asociadas
      if (lead.opportunities && lead.opportunities.length > 0) {
          toastWarning(
              "No se puede archivar",
              `Este lead tiene ${lead.opportunities.length} oportunidad(es) asociada(s). Debe eliminar o reasignar las oportunidades primero.`
          );
          return;
      }

      if (!confirm(`¿Archivar a ${lead.name}?`)) return;
      try {
          await api.patch(`/api/leads/${lead.id}/toggle-active`);
          toastSuccess("Archivado", "Lead archivado correctamente.");
          fetchData();
      } catch (error) {
          toastError("Error", "No se pudo archivar.");
      }
  };

  const handleRestore = async (item: Lead | Client) => {
      const isLead = (item as any).lead_status_id !== undefined || (item as any).lead_status !== undefined;
      const endpoint = isLead ? `/api/leads/${item.id}/toggle-active` : `/api/clients/${item.id}/toggle-active`;
      try {
          await api.patch(endpoint);
          toastSuccess("Restaurado", "Registro restaurado.");
          fetchData();
      } catch (error) {
          toastError("Error", "No se pudo restaurar.");
      }
  };

  const handleEditClient = (client: Client) => {
      // Same logic, use dialog for now to test validation
      setEditingId(client.id);
      setEditingType('client');
      form.reset({
        name: client.name,
        apellido1: (client as any).apellido1 || "",
        apellido2: (client as any).apellido2 || "",
        email: client.email,
        phone: client.phone || "",
        cedula: client.cedula || "",
        fechaNacimiento: (client as any).fecha_nacimiento ? formatDateForInput((client as any).fecha_nacimiento) : "",
        sector: (client as any).sector || "",
      });
      setIsLeadDialogOpen(true);
  };

  const confirmDeleteClient = (client: Client) => {
      setClientToDelete(client);
      setIsDeleteDialogOpen(true);
  };

  const handleDeleteClient = async () => {
      if (!clientToDelete) return;
      try {
          await api.delete(`/api/clients/${clientToDelete.id}`);
          toastSuccess("Eliminado", "Cliente eliminado.");
          fetchData();
      } catch (error) {
          toastError("Error", "No se pudo eliminar.");
      } finally {
          setIsDeleteDialogOpen(false);
          setClientToDelete(null);
      }
  };

  // --- Bulk Actions Handlers ---

  const openBulkActionConfirmation = (action: 'archive' | 'restore' | 'convert' | 'delete') => {
    setBulkActionType(action);
    setIsConfirmBulkActionOpen(true);
  };

  const handleBulkAction = async () => {
    if (!bulkActionType) return;

    const currentSelection = activeTab === 'leads' ? leadsSelection : activeTab === 'clientes' ? clientsSelection : inactivesSelection;
    const ids = Array.from(currentSelection.selectedIds);

    if (ids.length === 0) return;

    if (ids.length > 50) {
      toastWarning("Límite excedido", "Máximo 50 elementos por operación");
      return;
    }

    setIsBulkProcessing(true);

    try {
      let response;
      let successMessage = "";

      switch (bulkActionType) {
        case 'archive':
          // Validar que ninguno tenga oportunidades asociadas
          const selectedItems = activeTab === 'leads' ? leadsData.filter(l => currentSelection.selectedIds.has(l.id)) : clientsData.filter(c => currentSelection.selectedIds.has(c.id));
          const itemsWithOpportunities = selectedItems.filter(item => item.opportunities && item.opportunities.length > 0);

          if (itemsWithOpportunities.length > 0) {
            const totalOpportunities = itemsWithOpportunities.reduce((sum, item) => sum + (item.opportunities?.length || 0), 0);
            toastWarning(
              "No se puede archivar",
              `${itemsWithOpportunities.length} registro(s) tienen ${totalOpportunities} oportunidad(es) asociada(s). Debe eliminar o reasignar las oportunidades primero.`
            );
            setIsBulkProcessing(false);
            setIsConfirmBulkActionOpen(false);
            return;
          }

          response = await api.patch('/api/leads/bulk-archive', { ids, action: 'archive' });
          successMessage = `${response.data.data.successful} registros archivados`;
          break;

        case 'restore':
          response = await api.patch('/api/leads/bulk-archive', { ids, action: 'restore' });
          successMessage = `${response.data.data.successful} registros restaurados`;
          break;

        case 'convert':
          // Validate all selected leads first
          const selectedLeads = leadsData.filter(l => currentSelection.selectedIds.has(l.id));
          const incompleteLeads = selectedLeads.filter(lead => {
            const missingFields = checkMissingFields(lead);
            return missingFields.length > 0;
          });

          if (incompleteLeads.length > 0) {
            toastWarning("Leads incompletos", `${incompleteLeads.length} leads no tienen datos completos. Completa los datos antes de convertir.`);
            setIsBulkProcessing(false);
            setIsConfirmBulkActionOpen(false);
            return;
          }

          response = await api.post('/api/leads/bulk-convert', { ids });
          successMessage = `${response.data.data.successful} leads convertidos a clientes`;
          break;

        case 'delete':
          // Use Promise.all with individual deletes
          const deletePromises = ids.map(id => api.delete(`/api/clients/${id}`));
          await Promise.all(deletePromises);
          successMessage = `${ids.length} clientes eliminados`;
          response = { data: { data: { successful: ids.length, failed: 0, errors: [] } } };
          break;

        default:
          break;
      }

      const { successful, failed } = response?.data?.data || { successful: ids.length, failed: 0 };

      if (failed > 0) {
        toastWarning("Operación parcial", `${successful} exitosos, ${failed} fallidos`);
      } else {
        toastSuccess("Éxito", successMessage);
      }

      fetchData();
      currentSelection.clearSelection();
      setIsConfirmBulkActionOpen(false);

    } catch (error: any) {
      toastError("Error", error.response?.data?.message || "Error en operación masiva");
    } finally {
      setIsBulkProcessing(false);
      setBulkActionType(null);
    }
  };

  const handleBulkExport = () => {
    const currentSelection = activeTab === 'leads' ? leadsSelection : activeTab === 'clientes' ? clientsSelection : inactivesSelection;
    const currentData = activeTab === 'leads' ? leadsData : activeTab === 'clientes' ? clientsData : inactiveData;

    const selectedItems = currentData.filter(item => currentSelection.selectedIds.has(item.id));

    if (selectedItems.length === 0) return;

    // Export to CSV
    const headers = ["Cédula", "Nombre", "Email", "Teléfono", "Estado", "Registrado"];
    const rows = selectedItems.map(item => [
      item.cedula || "-",
      item.name || "-",
      item.email || "-",
      item.phone || "-",
      (item as any).lead_status?.name || (item as any).status || "-",
      new Date(item.created_at || "").toLocaleDateString()
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${activeTab}_seleccionados_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    toastSuccess("Exportado", `${selectedItems.length} registros exportados`);
  };

  const filteredInstituciones = useMemo(() => {
    if (!searchInstitucion) return instituciones;
    return instituciones.filter((inst) => inst.nombre.toLowerCase().includes(searchInstitucion.toLowerCase()));
  }, [searchInstitucion, instituciones]);

  if (error) return <ProtectedPage module="crm"><div className="p-8 text-center text-destructive">{error}</div></ProtectedPage>;

  return (
    <ProtectedPage module="crm">
      <TooltipProvider>
      <div className="space-y-6">
        <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>CRM</CardTitle>
                  <CardDescription>Gestiona leads y clientes.</CardDescription>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Desde</Label>
                      <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-10 w-36" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hasta</Label>
                      <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-10 w-36" />
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
                  <PermissionButton module="crm" action="create" size="sm" className="gap-2" onClick={openLeadDialog}>
                    <PlusCircle className="h-4 w-4" />
                    Nuevo
                  </PermissionButton>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Buscar</Label>
                  <div className="relative">
                    <Input
                      placeholder="Cédula, nombre o correo"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-56 pr-8"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Limpiar búsqueda"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado</Label>
                  {activeTab === "leads" ? (
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-auto min-w-[130px]"><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {Array.isArray(leadStatuses) && leadStatuses.length > 0
                          ? leadStatuses.map(status => (
                              <SelectItem key={status.id} value={String(status.id)}>{status.name}</SelectItem>
                            )) : null}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-auto min-w-[130px]"><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="Cliente Premium">Premium</SelectItem>
                        <SelectItem value="Prospecto">Prospecto</SelectItem>
                        <SelectItem value="Descartado">Descartado</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contacto</Label>
                  <Select value={contactFilter} onValueChange={setContactFilter}>
                    <SelectTrigger className="w-auto min-w-[140px]"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="con-contacto">Con contacto</SelectItem>
                      <SelectItem value="sin-contacto">Sin contacto</SelectItem>
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

              <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
                  <TabsList className="grid grid-cols-3">
                    <TabsTrigger value="leads">Leads</TabsTrigger>
                    <TabsTrigger value="clientes">Clientes</TabsTrigger>
                    <TabsTrigger value="inactivos">Inactivos</TabsTrigger>
                  </TabsList>

                  <TabsContent value="leads" className="space-y-4">
                    <div>
                      <p className="text-sm font-medium">{searchQuery ? 'Resultados de búsqueda' : 'Leads recientes'}</p>
                      <p className="text-sm text-muted-foreground">{searchQuery ? 'Filtrando por: Leads' : 'Últimos registros del embudo.'}</p>
                    </div>
                    {loading ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                    ) : searchQuery && unifiedSearchResults.length > 0 ? (
                        <>
                          <UnifiedSearchTable data={unifiedSearchResults} activeTab={activeTab} onAction={handleLeadAction} />
                        </>
                    ) : (
                        <>
                          <LeadsTable
                            data={leadsData}
                            onAction={handleLeadAction}
                            selection={leadsSelection}
                            onBulkAction={openBulkActionConfirmation}
                            onBulkExport={handleBulkExport}
                          />
                          {totalItems > 0 && (
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-6 border-t">
                              <div className="text-sm text-muted-foreground">
                                Mostrando {((currentPage - 1) * perPage) + 1} - {Math.min(currentPage * perPage, totalItems)} de {totalItems} leads
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
                        </>
                    )}
                  </TabsContent>

                  <TabsContent value="clientes" className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                            <div>
                                <p className="text-sm font-medium">{searchQuery ? 'Resultados de búsqueda' : 'Clientes activos'}</p>
                                <p className="text-sm text-muted-foreground">{searchQuery ? 'Filtrando por: Clientes' : 'Casos que ya están en seguimiento.'}</p>
                            </div>
                            {!searchQuery && (
                              <Button asChild size="sm" variant="outline" className="w-fit">
                                  <Link href="/dashboard/clients" className="gap-1">
                                      Ver clientes
                                      <ArrowUpRight className="h-4 w-4" />
                                  </Link>
                              </Button>
                            )}
                        </div>
                    </div>
                    {loading ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                    ) : searchQuery && unifiedSearchResults.length > 0 ? (
                        <>
                          <UnifiedSearchTable data={unifiedSearchResults} activeTab={activeTab} onAction={handleLeadAction} />
                        </>
                    ) : (
                        <>
                          <ClientsTable
                            data={clientsData}
                            onEdit={handleEditClient}
                            onDelete={confirmDeleteClient}
                            selection={clientsSelection}
                            onBulkAction={openBulkActionConfirmation}
                            onBulkExport={handleBulkExport}
                          />
                          {totalItems > 0 && (
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-6 border-t">
                              <div className="text-sm text-muted-foreground">
                                Mostrando {((currentPage - 1) * perPage) + 1} - {Math.min(currentPage * perPage, totalItems)} de {totalItems} clientes
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
                        </>
                    )}
                  </TabsContent>

                  <TabsContent value="inactivos" className="space-y-4">
                    <div>
                      <p className="text-sm font-medium">{searchQuery ? 'Resultados de búsqueda' : 'Inactivos'}</p>
                      <p className="text-sm text-muted-foreground">{searchQuery ? 'Filtrando por: Inactivos' : 'Leads suspendidos, exclientes o archivados.'}</p>
                    </div>
                    {loading ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                    ) : searchQuery && unifiedSearchResults.length > 0 ? (
                        <>
                          <UnifiedSearchTable data={unifiedSearchResults} activeTab={activeTab} onAction={handleRestore} />
                        </>
                    ) : (
                        <InactiveTable
                          data={inactiveData}
                          onRestore={handleRestore}
                          selection={inactivesSelection}
                          onBulkAction={openBulkActionConfirmation}
                          onBulkExport={handleBulkExport}
                        />
                    )}
                  </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
      </div>

      {/* Dialogs */}

      <Dialog open={isLeadDialogOpen} onOpenChange={(open) => !open && closeLeadDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isViewOnly
                ? 'Detalles del contacto'
                : (editingId ? (editingType === 'client' ? 'Editar Cliente' : 'Editar Lead') : 'Registrar nuevo lead')}
            </DialogTitle>
            <DialogDescription>
              {isViewOnly
                ? 'Información registrada del contacto.'
                : (editingId ? 'Modifica los datos del contacto.' : 'Captura los datos del contacto para comenzar el seguimiento.')}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="cedula"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cédula</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="0-0000-0000"
                          required
                          disabled={isViewOnly}
                          {...field}
                          onChange={(e) => {
                            const formattedValue = formatCedula(e.target.value);
                            field.onChange(formattedValue);
                            // Reset si cambia la cédula
                            if (formattedValue === '') {
                              setTseData(null);
                              setTseNotFound(false);
                              setShowTseConfirmation(false);
                              setShowExtranjeroFields(false);
                              setUserConfirmedTse(false);
                            }
                          }}
                          onBlur={() => {
                            const cedula = field.value;
                            if (cedula && cedula.length >= 6 && cedula !== lastTseCedula) {
                              handleTseLookup(cedula);
                            }
                          }}
                        />
                      </FormControl>
                      {isFetchingTse && <p className="text-xs text-blue-600">Buscando en TSE...</p>}
                      {!isViewOnly && !isFetchingTse && <p className="text-xs text-muted-foreground">Al ingresar la cédula completaremos los datos desde el TSE.</p>}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Información TSE encontrada */}
              {tseData && showTseConfirmation && !isViewOnly && (
                <div className="space-y-3 p-4 border rounded-lg bg-blue-50">
                  <div>
                    <p className="text-sm font-medium">Datos del TSE:</p>
                    <p className="text-base font-semibold">{tseData.nombre} {tseData.apellido1} {tseData.apellido2}</p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <span className="text-sm font-medium">¿Eres {tseData.nombre} {tseData.apellido1}?</span>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" onClick={handleTseNo}>No</Button>
                      <Button type="button" onClick={handleTseYes}>Sí</Button>
                    </div>
                  </div>
                </div>
              )}

              {/* No encontrado en TSE - Pregunta si es extranjero */}
              {tseNotFound && !isViewOnly && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border rounded-lg bg-muted">
                  <span className="text-sm font-medium text-center sm:text-left">No se encontró en TSE. ¿Es extranjero?</span>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" onClick={handleExtranjeroNo}>No</Button>
                    <Button type="button" onClick={handleExtranjeroYes}>Sí</Button>
                  </div>
                </div>
              )}

              {/* Campos de nombre/apellidos */}
              {(userConfirmedTse || showExtranjeroFields) && (
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre</FormLabel>
                        <FormControl>
                          <Input placeholder="Nombre completo" disabled={isViewOnly || userConfirmedTse} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="apellido1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primer Apellido</FormLabel>
                        <FormControl>
                          <Input placeholder="Primer apellido" disabled={isViewOnly || userConfirmedTse} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="apellido2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Segundo Apellido</FormLabel>
                        <FormControl>
                          <Input placeholder="Segundo apellido" disabled={isViewOnly || userConfirmedTse} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Campos de correo, teléfono y sector - solo después de confirmar */}
              {(userConfirmedTse || showExtranjeroFields || isViewOnly || editingId) && (
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Correo</FormLabel>
                        <FormControl>
                          <Input type="email" disabled={isViewOnly} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teléfono (Whatsapp)</FormLabel>
                        <FormControl>
                          <div className="flex gap-0">
                            {isExtranjero && (
                              <FormField
                                control={form.control}
                                name="phonePrefix"
                                render={({ field: prefixField }) => (
                                  <Select
                                    disabled={isViewOnly}
                                    onValueChange={prefixField.onChange}
                                    value={prefixField.value}
                                  >
                                    <SelectTrigger className="w-[110px] rounded-r-none border-r-0">
                                      <SelectValue placeholder="+506" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="+506">+506</SelectItem>
                                      <SelectItem value="+1">+1</SelectItem>
                                      <SelectItem value="+52">+52</SelectItem>
                                      <SelectItem value="+34">+34</SelectItem>
                                      <SelectItem value="+57">+57</SelectItem>
                                      <SelectItem value="+58">+58</SelectItem>
                                      <SelectItem value="+507">+507</SelectItem>
                                      <SelectItem value="+505">+505</SelectItem>
                                      <SelectItem value="+503">+503</SelectItem>
                                      <SelectItem value="+504">+504</SelectItem>
                                      <SelectItem value="+502">+502</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              />
                            )}
                            <Input
                              required
                              disabled={isViewOnly}
                              placeholder="88887777"
                              maxLength={isExtranjero ? undefined : 8}
                              className={isExtranjero ? "rounded-l-none" : ""}
                              {...field}
                              onChange={(e) => {
                                const formattedValue = normalizePhoneInput(e.target.value);
                                field.onChange(formattedValue);
                                setWhatsappVerified(false);
                                setWhatsappError(null);
                              }}
                            />
                          </div>
                        </FormControl>
                        {whatsappVerifying && <p className="text-xs text-blue-600">Verificando WhatsApp...</p>}
                        {whatsappVerified && <p className="text-xs text-green-600">✓ Número verificado en WhatsApp</p>}
                        {whatsappError && <p className="text-xs text-red-500">{whatsappError}</p>}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sector"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sector Laboral</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={isViewOnly}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona un sector" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="publico">Público</SelectItem>
                            <SelectItem value="privado">Privado</SelectItem>
                            <SelectItem value="propio">Propio</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="product_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Producto</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={isViewOnly}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona un producto" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {products.length === 0 && <div className="p-2 text-sm text-muted-foreground">Cargando productos...</div>}
                            {products.map((product) => {
                              console.log('Renderizando producto:', product);
                              return (
                                <SelectItem key={product.id} value={String(product.id)}>
                                  {product.name}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="monto"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monto del Crédito</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="₡0"
                            disabled={isViewOnly}
                            value={field.value ? formatMonto(field.value) : ""}
                            onChange={(e) => {
                              const normalized = normalizeMonto(e.target.value);
                              field.onChange(normalized);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeLeadDialog} disabled={isSavingLead}>
                  {isViewOnly ? "Cerrar" : "Cancelar"}
                </Button>
                {!isViewOnly && (
                  <Button type="submit" disabled={isSavingLead}>
                    {isSavingLead ? "Guardando..." : "Crear lead"}
                  </Button>
                )}
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <CreateOpportunityDialog
        open={isOpportunityDialogOpen}
        onOpenChange={setIsOpportunityDialogOpen}
        leads={leadForOpportunity ? [leadForOpportunity] : []}
        defaultLeadId={leadForOpportunity ? String(leadForOpportunity.id) : undefined}
        onSuccess={fetchData}
      />

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>¿Eliminar cliente?</DialogTitle>
                <DialogDescription>
                    Esta acción eliminará permanentemente a {clientToDelete?.name}.
                </DialogDescription>
            </DialogHeader>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancelar</Button>
                <Button variant="destructive" onClick={handleDeleteClient}>Eliminar</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Action Confirmation Dialog */}
      <AlertDialog open={isConfirmBulkActionOpen} onOpenChange={setIsConfirmBulkActionOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkActionType === 'delete' && `¿Eliminar ${activeTab === 'leads' ? leadsSelection.selectedCount : activeTab === 'clientes' ? clientsSelection.selectedCount : inactivesSelection.selectedCount} registros?`}
              {bulkActionType === 'archive' && `¿Archivar ${activeTab === 'leads' ? leadsSelection.selectedCount : clientsSelection.selectedCount} registros?`}
              {bulkActionType === 'restore' && `¿Restaurar ${inactivesSelection.selectedCount} registros?`}
              {bulkActionType === 'convert' && `¿Convertir ${leadsSelection.selectedCount} leads a clientes?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkActionType === 'delete' && 'Esta acción no se puede deshacer. Los registros se eliminarán permanentemente.'}
              {bulkActionType === 'archive' && 'Los registros seleccionados serán archivados.'}
              {bulkActionType === 'restore' && 'Los registros seleccionados serán restaurados y volverán a estar activos.'}
              {bulkActionType === 'convert' && 'Los leads seleccionados se convertirán en clientes. Asegúrate de que todos tengan datos completos.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkAction}
              className={bulkActionType === 'delete' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
              disabled={isBulkProcessing}
            >
              {isBulkProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Procesando...
                </>
              ) : (
                <>
                  {bulkActionType === 'delete' && 'Eliminar'}
                  {bulkActionType === 'archive' && 'Archivar'}
                  {bulkActionType === 'restore' && 'Restaurar'}
                  {bulkActionType === 'convert' && 'Convertir'}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </TooltipProvider>
    </ProtectedPage>
  );
}


type LeadsTableProps = {
  data: Lead[];
  onAction: (action: string, lead: Lead) => void;
  selection: ReturnType<typeof useBulkSelection<Lead>>;
  onBulkAction: (action: 'archive' | 'convert') => void;
  onBulkExport: () => void;
};

function LeadsTable({ data, onAction, selection, onBulkAction, onBulkExport }: LeadsTableProps) {
  const { toast } = useToast();
  const [opportunitiesModalOpen, setOpportunitiesModalOpen] = useState(false);
  const [selectedPersonOpportunities, setSelectedPersonOpportunities] = useState<Opportunity[]>([]);
  const [selectedPersonName, setSelectedPersonName] = useState("");

  const handleOpenOpportunitiesModal = (person: Lead | Client) => {
    const displayName = `${person.name || ''} ${person.apellido1 || ''}`.trim();
    setSelectedPersonName(displayName);
    setSelectedPersonOpportunities(person.opportunities || []);
    setOpportunitiesModalOpen(true);
  };

  if (data.length === 0) return <div className="text-center p-8 text-muted-foreground">No encontramos leads con los filtros seleccionados.</div>;

  return (
    <>
      {/* Bulk Actions Toolbar */}
      {selection.selectedCount > 0 && (
        <BulkActionsToolbar
          selectedCount={selection.selectedCount}
          onClear={selection.clearSelection}
          actions={[
            {
              label: 'Archivar',
              icon: Archive,
              onClick: () => onBulkAction('archive'),
              variant: 'secondary'
            },
            {
              label: 'Convertir a Clientes',
              icon: ArrowUpRight,
              onClick: () => onBulkAction('convert'),
              variant: 'default'
            },
            {
              label: 'Exportar',
              icon: Download,
              onClick: onBulkExport,
              variant: 'secondary'
            }
          ]}
        />
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={selection.isAllSelected}
                onCheckedChange={() => selection.toggleAll(data)}
                aria-label="Seleccionar todo"
              />
            </TableHead>
            <TableHead className="w-[11rem]">Cédula</TableHead>
            <TableHead>Lead</TableHead>
            <TableHead className="w-[7.5rem]">Estado</TableHead>
            <TableHead className="w-[10.5rem]">Contacto</TableHead>
            <TableHead className="text-right">Registrado</TableHead>
            <TableHead className="w-[9rem]">Registro de datos</TableHead>
            <TableHead className="w-[8rem] text-center">Oportunidades</TableHead>
            <TableHead className="w-[20rem] text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((lead) => {
            const displayName = getLeadDisplayName(lead);
            const statusLabel = (typeof lead.lead_status === 'object' ? lead.lead_status?.name : lead.lead_status) || 'Nuevo';
            const badgeClassName = getStatusBadgeClassName(statusLabel);
            return (
              <TableRow key={lead.id}>
                <TableCell>
                  <Checkbox
                    checked={selection.isSelected(lead.id)}
                    onCheckedChange={() => selection.toggleItem(lead.id)}
                    aria-label={`Seleccionar lead ${lead.cedula}`}
                  />
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {lead.cedula ? (
                    <Link href={`/dashboard/leads/${lead.id}?mode=view`} className="text-primary hover:underline">
                      {lead.cedula}
                    </Link>
                  ) : <span className="text-muted-foreground">-</span>}
                </TableCell>
                <TableCell>
                  <Link href={`/dashboard/leads/${lead.id}?mode=view`} className="font-medium leading-none text-primary hover:underline">
                    {displayName}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge className={badgeClassName}>{statusLabel}</Badge>
                </TableCell>
                <TableCell>
                  <div className="text-sm text-muted-foreground">{lead.email || "Sin correo"}</div>
                  <div className="text-sm text-muted-foreground">{lead.phone || "Sin teléfono"}</div>
                </TableCell>
                <TableCell className="text-right">{formatRegistered(lead.created_at)}</TableCell>
                <TableCell>
                  {(() => {
                    const missingFields = checkMissingFields(lead);
                    if (missingFields.length === 0) {
                      return (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-700 bg-green-100 border border-green-300 rounded-md">
                          Completo
                        </span>
                      );
                    }

                    // Check if missing items are only documents
                    const hasFieldsMissing = missingFields.some(field => field !== 'Archivo de Cédula' && field !== 'Archivo de Recibo');
                    const hasOnlyDocsMissing = missingFields.length > 0 && !hasFieldsMissing;

                    const targetUrl = hasOnlyDocsMissing
                      ? `/dashboard/leads/${lead.id}#archivos`
                      : `/dashboard/leads/${lead.id}?mode=edit`;

                    return (
                      <Link href={targetUrl} className="inline-flex items-center px-2 py-1 text-xs font-medium text-red-700 bg-red-100 border border-red-300 rounded-md hover:bg-red-200 cursor-pointer">
                        Faltan datos
                      </Link>
                    );
                  })()}
                </TableCell>
                <TableCell className="text-center">
                  {(() => {
                    const missingFields = checkMissingFields(lead);
                    const hasOpportunities = lead.opportunities && lead.opportunities.length > 0;
                    const isDisabled = !hasOpportunities || missingFields.length > 0;

                    return (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => hasOpportunities && missingFields.length === 0 && handleOpenOpportunitiesModal(lead)}
                            disabled={isDisabled}
                            className="h-8 px-3 gap-2"
                          >
                            <Handshake className="h-4 w-4" />
                            {lead.opportunities?.length || 0}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {missingFields.length > 0
                            ? "Complete los datos del lead para ver oportunidades"
                            : hasOpportunities
                            ? "Ver oportunidades asociadas"
                            : "Sin oportunidades"
                          }
                        </TooltipContent>
                      </Tooltip>
                    );
                  })()}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <PermissionButton
                          module="oportunidades"
                          action="create"
                          size="icon"
                          onClick={() => onAction('create_opportunity', lead)}
                          disabled={checkMissingFields(lead).length > 0}
                        >
                          <Sparkles className="h-4 w-4" />
                        </PermissionButton>
                      </TooltipTrigger>
                      <TooltipContent>
                        {checkMissingFields(lead).length > 0
                          ? "Complete el registro antes de crear oportunidad"
                          : "Crear oportunidad"
                        }
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <PermissionButton
                          module="crm"
                          action="archive"
                          size="icon"
                          variant="destructive"
                          onClick={() => onAction('archive', lead)}
                          disabled={lead.opportunities && lead.opportunities.length > 0}
                        >
                          <Archive className="h-4 w-4" />
                        </PermissionButton>
                      </TooltipTrigger>
                      <TooltipContent>
                        {lead.opportunities && lead.opportunities.length > 0
                          ? `No se puede archivar: tiene ${lead.opportunities.length} oportunidad(es) asociada(s)`
                          : "Archivar"
                        }
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Modal de Oportunidades */}
      <Dialog open={opportunitiesModalOpen} onOpenChange={setOpportunitiesModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Oportunidades de {selectedPersonName}</DialogTitle>
            <DialogDescription>
              {selectedPersonOpportunities.length === 0 ? 'No hay oportunidades registradas' : `${selectedPersonOpportunities.length} oportunidad(es) encontrada(s)`}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            {selectedPersonOpportunities.length > 0 ? (
              <div className="space-y-3">
                {selectedPersonOpportunities.map((opportunity) => (
                  <Card key={opportunity.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-medium">{opportunity.id}</span>
                            <Badge variant="outline" className="text-xs">
                              {opportunity.status || 'Pendiente'}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Tipo: {opportunity.opportunity_type || 'N/A'}
                          </div>
                          {opportunity.amount && (
                            <div className="text-sm font-medium">
                              {new Intl.NumberFormat('es-CR', {
                                style: 'currency',
                                currency: 'CRC',
                                minimumFractionDigits: 0
                              }).format(opportunity.amount)}
                            </div>
                          )}
                        </div>
                        <Link href={`/dashboard/oportunidades/${opportunity.id}`}>
                          <Button size="sm" className="gap-2">
                            <Eye className="h-4 w-4" />
                            Ver
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No hay oportunidades registradas para esta persona
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
function ClientsTable({ data, onEdit, onDelete, selection, onBulkAction, onBulkExport }: {
  data: Client[],
  onEdit: (client: Client) => void,
  onDelete: (client: Client) => void,
  selection: ReturnType<typeof useBulkSelection<Client>>,
  onBulkAction: (action: 'archive' | 'delete') => void,
  onBulkExport: () => void
}) {
    const [opportunitiesModalOpen, setOpportunitiesModalOpen] = useState(false);
    const [selectedPersonOpportunities, setSelectedPersonOpportunities] = useState<Opportunity[]>([]);
    const [selectedPersonName, setSelectedPersonName] = useState("");

    const handleOpenOpportunitiesModal = (person: Lead | Client) => {
      const displayName = `${person.name || ''} ${person.apellido1 || ''}`.trim();
      setSelectedPersonName(displayName);
      setSelectedPersonOpportunities(person.opportunities || []);
      setOpportunitiesModalOpen(true);
    };

    if (data.length === 0) return <div className="text-center p-8 text-muted-foreground">No encontramos clientes con los filtros seleccionados.</div>;

    return (
        <>
          {/* Bulk Actions Toolbar */}
          {selection.selectedCount > 0 && (
            <BulkActionsToolbar
              selectedCount={selection.selectedCount}
              onClear={selection.clearSelection}
              actions={[
                {
                  label: 'Archivar',
                  icon: Archive,
                  onClick: () => onBulkAction('archive'),
                  variant: 'secondary'
                },
                {
                  label: 'Eliminar',
                  icon: Trash,
                  onClick: () => onBulkAction('delete'),
                  variant: 'destructive'
                },
                {
                  label: 'Exportar',
                  icon: Download,
                  onClick: onBulkExport,
                  variant: 'secondary'
                }
              ]}
            />
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selection.isAllSelected}
                        onCheckedChange={() => selection.toggleAll(data)}
                    aria-label="Seleccionar todo"
                  />
                </TableHead>
                <TableHead>Cliente</TableHead>
              <TableHead className="w-[11rem]">Cédula</TableHead>
              <TableHead className="w-[11rem]">Registrado</TableHead>
              <TableHead className="w-[16rem]">Estado</TableHead>
              <TableHead className="w-[8rem] text-center">Oportunidades</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((client) => {
                const displayName = getLeadDisplayName(client);
                const statusLabel = client.status || (client.is_active ? 'Activo' : 'Inactivo');
                const badgeClassName = getStatusBadgeClassName(statusLabel);

                return (
                  <TableRow key={client.id}>
                    <TableCell>
                      <Checkbox
                        checked={selection.isSelected(client.id)}
                        onCheckedChange={() => selection.toggleItem(client.id)}
                        aria-label={`Seleccionar cliente ${client.cedula}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback>{getLeadInitials(client)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <Link href={`/dashboard/clientes/${client.id}`} className="font-medium leading-none text-primary hover:underline">
                            {displayName}
                          </Link>
                          <p className="text-xs text-muted-foreground">{client.email || "Sin correo"}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{client.cedula || "-"}</TableCell>
                    <TableCell>{formatRegistered(client.created_at)}</TableCell>
                    <TableCell>
                        <Badge className={badgeClassName}>{statusLabel}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {(() => {
                        const missingFields = checkMissingFields(client);
                        const hasOpportunities = client.opportunities && client.opportunities.length > 0;
                        const isDisabled = !hasOpportunities || missingFields.length > 0;

                        return (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => hasOpportunities && missingFields.length === 0 && handleOpenOpportunitiesModal(client)}
                                disabled={isDisabled}
                                className="h-8 px-3 gap-2"
                              >
                                <Handshake className="h-4 w-4" />
                                {client.opportunities?.length || 0}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {missingFields.length > 0
                                ? "Complete los datos del cliente para ver oportunidades"
                                : hasOpportunities
                                ? "Ver oportunidades asociadas"
                                : "Sin oportunidades"
                              }
                            </TooltipContent>
                          </Tooltip>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <PermissionButton module="crm" action="edit" size="icon" className="bg-sky-100 text-sky-700 hover:bg-sky-200" onClick={() => onEdit(client)}>
                              <Pencil className="h-4 w-4" />
                            </PermissionButton>
                          </TooltipTrigger>
                          <TooltipContent>Editar</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <PermissionButton module="crm" action="delete" size="icon" variant="destructive" onClick={() => onDelete(client)}>
                              <Trash className="h-4 w-4" />
                            </PermissionButton>
                          </TooltipTrigger>
                          <TooltipContent>Eliminar</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                );
            })}
          </TableBody>
        </Table>

        {/* Modal de Oportunidades */}
        <Dialog open={opportunitiesModalOpen} onOpenChange={setOpportunitiesModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Oportunidades de {selectedPersonName}</DialogTitle>
              <DialogDescription>
                {selectedPersonOpportunities.length === 0 ? 'No hay oportunidades registradas' : `${selectedPersonOpportunities.length} oportunidad(es) encontrada(s)`}
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[400px] overflow-y-auto">
              {selectedPersonOpportunities.length > 0 ? (
                <div className="space-y-3">
                  {selectedPersonOpportunities.map((opportunity) => (
                    <Card key={opportunity.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-medium">{opportunity.id}</span>
                              <Badge variant="outline" className="text-xs">
                                {opportunity.status || 'Pendiente'}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Tipo: {opportunity.opportunity_type || 'N/A'}
                            </div>
                            {opportunity.amount && (
                              <div className="text-sm font-medium">
                                {new Intl.NumberFormat('es-CR', {
                                  style: 'currency',
                                  currency: 'CRC',
                                  minimumFractionDigits: 0
                                }).format(opportunity.amount)}
                              </div>
                            )}
                          </div>
                          <Link href={`/dashboard/oportunidades/${opportunity.id}`}>
                            <Button size="sm" className="gap-2">
                              <Eye className="h-4 w-4" />
                              Ver
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No hay oportunidades registradas para esta persona
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </>
    )
}

function UnifiedSearchTable({
  data,
  activeTab,
  onAction
}: {
  data: Array<(Lead | Client) & { _type: 'lead' | 'cliente' | 'inactivo' }>,
  activeTab: string,
  onAction: (action: string, item: any) => void
}) {
  // Mostrar todos los resultados sin filtrar por tab
  const filteredData = data;

  if (filteredData.length === 0) {
    return <div className="text-center p-8 text-muted-foreground">
      No encontramos resultados con los filtros seleccionados.
    </div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[11rem]">Cédula</TableHead>
          <TableHead>Nombre</TableHead>
          <TableHead className="w-[8rem]">Tipo</TableHead>
          <TableHead className="w-[10rem]">Contacto</TableHead>
          <TableHead className="text-right">Registrado</TableHead>
          <TableHead className="w-[15rem] text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredData.map((item) => {
          const displayName = getLeadDisplayName(item);
          const typeBadgeClass =
            item._type === 'lead' ? 'bg-blue-100 text-blue-700' :
            item._type === 'cliente' ? 'bg-green-100 text-green-700' :
            'bg-gray-100 text-gray-700';
          const typeLabel =
            item._type === 'lead' ? 'Lead' :
            item._type === 'cliente' ? 'Cliente' :
            'Inactivo';

          return (
            <TableRow key={`${item._type}-${item.id}`}>
              <TableCell className="font-mono text-sm">
                {item.cedula ? (
                  <Link
                    href={item._type === 'cliente' ? `/dashboard/clientes/${item.id}` : `/dashboard/leads/${item.id}?mode=view`}
                    className="text-primary hover:underline"
                  >
                    {item.cedula}
                  </Link>
                ) : <span className="text-muted-foreground">-</span>}
              </TableCell>
              <TableCell>
                <Link
                  href={item._type === 'cliente' ? `/dashboard/clientes/${item.id}` : `/dashboard/leads/${item.id}?mode=view`}
                  className="font-medium leading-none text-primary hover:underline"
                >
                  {displayName}
                </Link>
              </TableCell>
              <TableCell>
                <Badge className={typeBadgeClass}>{typeLabel}</Badge>
              </TableCell>
              <TableCell>
                <div className="text-sm text-muted-foreground">{item.email || "Sin correo"}</div>
                <div className="text-sm text-muted-foreground">{item.phone || "Sin teléfono"}</div>
              </TableCell>
              <TableCell className="text-right">{formatRegistered(item.created_at)}</TableCell>
              <TableCell className="text-right">
                <div className="flex flex-wrap justify-end gap-2">
                  {item._type === 'lead' && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <PermissionButton module="oportunidades" action="create" size="icon" onClick={() => onAction('create_opportunity', item)}>
                          <Sparkles className="h-4 w-4" />
                        </PermissionButton>
                      </TooltipTrigger>
                      <TooltipContent>Crear oportunidad</TooltipContent>
                    </Tooltip>
                  )}
                  {item._type === 'inactivo' && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <PermissionButton module="crm" action="edit" size="icon" onClick={() => onAction('restore', item)}>
                          <ArrowUpRight className="h-4 w-4" />
                        </PermissionButton>
                      </TooltipTrigger>
                      <TooltipContent>Restaurar</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function InactiveTable({ data, onRestore, selection, onBulkAction, onBulkExport }: {
  data: (Lead | Client)[],
  onRestore: (item: Lead | Client) => void,
  selection: ReturnType<typeof useBulkSelection<Lead | Client>>,
  onBulkAction: (action: 'restore' | 'delete') => void,
  onBulkExport: () => void
}) {
    if (data.length === 0) return <div className="text-center p-8 text-muted-foreground">No encontramos registros inactivos.</div>;

    return (
        <>
          {/* Bulk Actions Toolbar */}
          {selection.selectedCount > 0 && (
            <BulkActionsToolbar
              selectedCount={selection.selectedCount}
              onClear={selection.clearSelection}
              actions={[
                {
                  label: 'Restaurar',
                  icon: Sparkles,
                  onClick: () => onBulkAction('restore'),
                  variant: 'default'
                },
                {
                  label: 'Eliminar',
                  icon: Trash,
                  onClick: () => onBulkAction('delete'),
                  variant: 'destructive'
                },
                {
                  label: 'Exportar',
                  icon: Download,
                  onClick: onBulkExport,
                  variant: 'secondary'
                }
              ]}
            />
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selection.isAllSelected}
                        onCheckedChange={() => selection.toggleAll(data)}
                    aria-label="Seleccionar todo"
                  />
                </TableHead>
                <TableHead>Contacto</TableHead>
              <TableHead className="w-[10rem]">Estado</TableHead>
              <TableHead className="w-[12rem]">Última actualización</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => {
                const displayName = getLeadDisplayName(item);
                const statusLabel = (item as any).lead_status?.name || (item as any).status || 'Inactivo';
                const badgeClassName = getStatusBadgeClassName(statusLabel);

                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Checkbox
                        checked={selection.isSelected(item.id)}
                        onCheckedChange={() => selection.toggleItem(item.id)}
                        aria-label={`Seleccionar registro ${item.cedula}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                            <AvatarFallback>{getLeadInitials(item)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <div className="font-medium">{displayName}</div>
                            <div className="text-xs text-muted-foreground">{item.email || item.phone || "Sin contacto"}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                        <Badge className={badgeClassName}>{statusLabel}</Badge>
                    </TableCell>
                    <TableCell>
                        {formatRegistered((item as any).updated_at || (item as any).created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                        <Button size="sm" variant="outline" className="h-8 gap-2" onClick={() => onRestore(item)}>
                            <Sparkles className="h-3.5 w-3.5" />
                            Restaurar
                        </Button>
                    </TableCell>
                  </TableRow>
                );
            })}
          </TableBody>
        </Table>
      </>
    );
}