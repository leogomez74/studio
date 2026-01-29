  "use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, PlusCircle, Eye, RefreshCw, Pencil, FileText, FileSpreadsheet, Download, Check, ChevronsUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

import api from "@/lib/axios";

// Funciones para formateo de moneda (Colones)
const formatCurrency = (value: string | number): string => {
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^\d.-]/g, '')) : value;
  if (isNaN(num) || num === 0) return '';
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

const parseCurrencyToNumber = (value: string): number => {
  const cleaned = value.replace(/[^\d.]/g, '');
  return parseFloat(cleaned) || 0;
};

const creditSchema = z.object({
  reference: z.string().min(1, "La referencia es requerida"),
  title: z.string().min(1, "El título es requerido"),
  status: z.string(),
  category: z.string(),
  monto_credito: z.coerce.number().min(0, "El monto debe ser positivo"),
  clientId: z.string().min(1, "Debes seleccionar un cliente"),
  opportunityId: z.string().optional(),
  assignedTo: z.string().optional(),
  openedAt: z.string(),
  description: z.string().optional(),
  divisa: z.string(),
  plazo: z.coerce.number().min(1, "El plazo mínimo es 1 mes").max(120, "El plazo máximo es 120 meses"),
  poliza: z.boolean().default(false),
});

type CreditFormValues = z.infer<typeof creditSchema>;

interface DeductoraOption {
  id: string | number;
  nombre: string;
}


interface ClientOption {
  id: string;
  name: string;
  cedula: string;
  email: string;
  phone: string;
  clientStatus?: 'Activo' | 'Moroso' | 'En cobro' | 'Fallecido' | 'Inactivo';
  activeCredits?: number;
  registeredOn?: string;
  avatarUrl?: string;
  status?: string;
  is_active?: boolean;
  created_at?: string;
  apellido1?: string;
  apellido2?: string;
  whatsapp?: string;
  tel_casa?: string;
  tel_amigo?: string;
  province?: string;
  canton?: string;
  distrito?: string;
  direccion1?: string;
  direccion2?: string;
  ocupacion?: string;
  estado_civil?: string;
  fecha_nacimiento?: string;
  relacionado_a?: string;
  tipo_relacion?: string;
  notes?: string;
  source?: string;
  genero?: string;
  nacionalidad?: string;
  telefono2?: string;
  telefono3?: string;
  institucion_labora?: string;
  departamento_cargo?: string;
  deductora_id?: number | null;
  lead_status_id?: number;
  assigned_to_id?: number;
  person_type_id?: number;
  opportunities?: OpportunityOption[];
}

interface OpportunityOption {
  id: string;
  title: string;
  lead_id: number;
  status?: string;
  credit?: {
    id: number;
  } | null;
}

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
  fecha_corte: string;
  fecha_pago: string | null;
  cuota: number;
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
  tasa_actual?: number; // Agregado para leer la tasa del plan
}

interface CreditItem {
  id: number;
  reference: string;
  title: string;
  status: string | null;
  category: string | null;
  assigned_to: string | null;

  opened_at: string | null;
  description: string | null;
  lead_id: number;
  opportunity_id: string | null;
  client?: ClientOption | null;
  lead?: ClientOption | null;
  opportunity?: { id: string; title: string | null } | null;
  created_at?: string | null;
  updated_at?: string | null;
  documents?: CreditDocument[];
  plan_de_pagos?: CreditPayment[];
  // New fields
  tipo_credito?: string | null;
  numero_operacion?: string | null;
  monto_credito?: number | null;
  cuota?: number | null;
  fecha_ultimo_pago?: string | null;
  garantia?: string | null;
  fecha_culminacion_credito?: string | null;
  plazo?: number | null;
  cuotas_atrasadas?: number | null;
  deductora_id: number | null;
  divisa?: string | null;
  linea?: string | null;
  saldo?: number | null;
  proceso?: string | null;
  documento_id?: string | null;
  poliza?: boolean | null;
  tasa_anual?: number | null;
  primera_deduccion?: string | null;
}

const CREDIT_STATUS_OPTIONS = [
  "Activo",
  "Mora",
  "Cerrado",
  "Legal",
  "Aprobado",
  "Formalizado"
] as const;
const CURRENCY_OPTIONS = [
  { value: "CRC", label: "Colón Costarricense (CRC)" },
] as const;

const CREDIT_STATUS_TAB_CONFIG = [
  { value: "all", label: "Todos" },
  { value: "activo", label: "Activo" },
  { value: "formalizado", label: "Formalizado" },
  { value: "mora", label: "En Mora" },
  { value: "cerrado", label: "Cerrado" },
  { value: "legal", label: "Cobro Judicial" },
] as const;

const TAB_STATUS_FILTERS: Record<string, string[]> = {
  "activo": ["activo", "al día"],
  "formalizado": ["formalizado"],
  "mora": ["mora", "en mora"],
  "cerrado": ["cerrado", "cancelado"],
  "legal": ["legal", "en cobro judicial"],
};

const TRACKED_STATUS_SET = new Set(
  Object.values(TAB_STATUS_FILTERS)
    .flat()
    .map((status) => status.toLowerCase())
);

const normalizeStatus = (status?: string | null): string => (status ?? "").trim().toLowerCase();

const formatAmount = (amount?: number | null): string => {
  if (amount === null || amount === undefined) return "0.00";
  return new Intl.NumberFormat('es-CR', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const getStatusBadgeStyle = (status?: string | null): { variant: "default" | "secondary" | "destructive" | "outline"; className?: string } => {
  const normalized = normalizeStatus(status);
  switch (normalized) {
    case "formalizado":
      return { variant: "default", className: "bg-emerald-600 hover:bg-emerald-700 text-white" };
    case "activo":
    case "al día":
      return { variant: "default", className: "bg-blue-600 hover:bg-blue-700 text-white" };
    case "mora":
    case "en mora":
      return { variant: "destructive" };
    case "cerrado":
    case "cancelado":
      return { variant: "secondary" };
    case "legal":
    case "en cobro judicial":
      return { variant: "destructive", className: "bg-red-800 hover:bg-red-900" };
    case "aprobado":
      return { variant: "default", className: "bg-green-500 hover:bg-green-600 text-white" };
    default:
      return { variant: "secondary" };
  }
};

function formatDate(dateString?: string | null): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-CR", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

export default function CreditsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [deductoras, setDeductoras] = useState<DeductoraOption[]>([]);

  const [credits, setCredits] = useState<CreditItem[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityOption[]>([]);
  const [users, setUsers] = useState<{ id: number, name: string }[]>([]);
  const [products, setProducts] = useState<{ id: number, name: string }[]>([]);
  const [tabValue, setTabValue] = useState("all");
  const [filters, setFilters] = useState({
    monto: "",
    numeroOperacion: "",
    leadName: "",
    documentoId: ""
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Combobox state
  const [openCombobox, setOpenCombobox] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [dialogState, setDialogState] = useState<"create" | "edit" | null>(null);
  const [dialogCredit, setDialogCredit] = useState<CreditItem | null>(null);

  // Form definition
  const form = useForm<CreditFormValues>({
    resolver: zodResolver(creditSchema),
    defaultValues: {
      reference: "",
      title: "",
      status: CREDIT_STATUS_OPTIONS[0],
      category: "",
      monto_credito: 0,
      clientId: "",
      opportunityId: "",
      assignedTo: "",
      openedAt: new Date().toISOString().split('T')[0],
      description: "",
      divisa: "CRC",
      plazo: 36,
      poliza: false,
    },
  });

  const [isSaving, setIsSaving] = useState(false);

  const [isDocumentsOpen, setIsDocumentsOpen] = useState(false);
  const [documentsCredit, setDocumentsCredit] = useState<CreditItem | null>(null);

  const currentClientId = form.watch("clientId");
  const currentClient = useMemo(() => {
    return currentClientId ? clients.find((client) => String(client.id) === currentClientId) : null;
  }, [currentClientId, clients]);

  const filteredClients = useMemo(() => {
    if (!searchQuery) return clients;
    const lowerQuery = searchQuery.toLowerCase();
    // Normalizar query removiendo símbolos para búsqueda por cédula
    const normalizedQuery = searchQuery.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    return clients.filter(client => {
      // Buscar por nombre
      const matchesName = client.name.toLowerCase().includes(lowerQuery);

      // Buscar por cédula (ignorando símbolos)
      const normalizedCedula = client.cedula ? client.cedula.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
      const matchesCedula = normalizedCedula.includes(normalizedQuery);

      return matchesName || matchesCedula;
    });
  }, [clients, searchQuery]);

  const availableOpportunities = useMemo(() => {
    return opportunities.filter((opportunity) => {
      const belongsToClient = currentClientId ? opportunity.lead_id === parseInt(currentClientId, 10) : true;
      const isAnalizada = opportunity.status === 'Analizada';
      const canSelectExistingCredit = dialogCredit?.opportunity_id === opportunity.id;
      const isFree = !opportunity.credit;
      return belongsToClient && isAnalizada && (canSelectExistingCredit || isFree);
    });
  }, [opportunities, currentClientId, dialogCredit]);

  // Mock permission for now
  const canDownloadDocuments = true;
  const fetchDeductoras = useCallback(async () => {
    try {
      const response = await api.get('/api/deductoras');
      let data = response.data;
      if (!Array.isArray(data)) {
        // Try to extract array if wrapped in {data: [...]}
        data = data.data || [];
      }
      if (!Array.isArray(data)) {
        data = [];
      }
      setDeductoras(data);
    } catch (error) {
      setDeductoras([]);
      console.error("Error fetching deductoras:", error);
    }
  }, []);

  const fetchCredits = useCallback(async () => {
    try {
      const response = await api.get('/api/credits');

      // Handle both paginated response { data: [...] } and direct array response
      const apiData = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      setCredits(apiData);
    } catch (error) {
      console.error("Error fetching credits:", error);
      toast({ title: "Error", description: "No se pudieron cargar los créditos. Intente nuevamente.", variant: "destructive" });
      setCredits([]);
    }
  }, [toast]);

  const fetchClients = useCallback(async () => {
    try {
      const response = await api.get('/api/clients');
      const data = response.data.data || response.data;
      setClients(data.map((c: any) => ({ id: c.id, name: c.name, email: c.email, cedula: c.cedula, deductora_id: c.deductora_id })));
    } catch (error) {
      console.error("Error fetching clients:", error);
    }
  }, []);

  const fetchOpportunities = useCallback(async () => {
    try {
      const response = await api.get('/api/opportunities');
      const data = response.data.data || response.data;
      setOpportunities(data.map((o: any) => ({
        id: o.id,
        title: `${o.id} - ${o.opportunity_type} - ${new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(o.amount)}`,
        lead_id: o.lead?.id,
        status: o.status,
        credit: o.credit
      })));
    } catch (error) {
      console.error("Error fetching opportunities:", error);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await api.get('/api/agents');
      setUsers(response.data);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const response = await api.get('/api/products');
      setProducts(response.data);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  }, []);

  useEffect(() => {
    fetchCredits();
    fetchClients();
    fetchOpportunities();
    fetchUsers();
    fetchDeductoras();
    fetchProducts();
  }, [fetchCredits, fetchClients, fetchOpportunities, fetchUsers, fetchDeductoras, fetchProducts]);

  // Populate client objects on credits based on lead_id
  useEffect(() => {
    setCredits(prevCredits => prevCredits.map(credit => {
      const matchedClient = clients.find(c => String(c.id) === String(credit.lead_id));
      return {
        ...credit,
        client: matchedClient || credit.client,
        lead: matchedClient || credit.lead
      };
    }));
  }, [clients]);

  // Reset page when filters or tab change
  useEffect(() => {
    setCurrentPage(1);
  }, [tabValue, filters]);

  const getCreditsForTab = useCallback(
    (value: string): CreditItem[] => {
      let filtered = credits;

      // 1. Tab Filter
      if (value === "otros") {
        filtered = credits.filter((item) => {
          const normalized = normalizeStatus(item.status);
          return normalized.length > 0 && !TRACKED_STATUS_SET.has(normalized);
        });
      } else if (value !== "all") {
        const statuses = TAB_STATUS_FILTERS[value];
        if (statuses) {
          filtered = credits.filter((item) => statuses.includes(normalizeStatus(item.status)));
        }
      }

      // 2. Advanced Filters
      if (filters.monto) {
        filtered = filtered.filter(c => c.monto_credito?.toString().includes(filters.monto));
      }
      if (filters.numeroOperacion) {
        filtered = filtered.filter(c =>
          (c.numero_operacion?.toLowerCase().includes(filters.numeroOperacion.toLowerCase())) ||
          (c.reference?.toLowerCase().includes(filters.numeroOperacion.toLowerCase()))
        );
      }
      if (filters.leadName) {
        filtered = filtered.filter(c =>
          (c.lead?.name?.toLowerCase().includes(filters.leadName.toLowerCase())) ||
          (c.client?.name?.toLowerCase().includes(filters.leadName.toLowerCase()))
        );
      }
      if (filters.documentoId) {
        filtered = filtered.filter(c => c.documento_id?.toLowerCase().includes(filters.documentoId.toLowerCase()));
      }

      return filtered;
    },
    [credits, filters]
  );

  // Get paginated credits for the current tab
  const getPaginatedCredits = useCallback(
    (value: string) => {
      const filtered = getCreditsForTab(value);
      const totalItems = filtered.length;
      const totalPages = Math.ceil(totalItems / itemsPerPage);
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const paginatedItems = filtered.slice(startIndex, endIndex);

      return {
        items: paginatedItems,
        totalItems,
        totalPages,
        currentPage,
        startIndex: startIndex + 1,
        endIndex: Math.min(endIndex, totalItems),
      };
    },
    [getCreditsForTab, currentPage, itemsPerPage]
  );

  const handleCreate = async () => {
    // Obtener la siguiente referencia del backend
    let nextReference = "";
    try {
      const refResponse = await api.get('/api/credits/next-reference');
      nextReference = refResponse.data.reference;
    } catch (err) {
      console.error('Error al obtener referencia:', err);
    }

    form.reset({
      reference: nextReference,
      title: "",
      status: CREDIT_STATUS_OPTIONS[0],
      category: products.length > 0 ? products[0].name : "",
      monto_credito: 0,
      clientId: "",
      opportunityId: "",
      assignedTo: "",
      openedAt: new Date().toISOString().split('T')[0],
      description: "",
      divisa: "CRC",
      plazo: 36,
      poliza: false,
    });
    setDialogCredit(null);
    setDialogState("create");
  };

  const onSubmit = async (values: CreditFormValues) => {
    setIsSaving(true);
    try {
      const body = {
        reference: values.reference,
        title: values.title,
        status: values.status,
        category: values.category,
        monto_credito: values.monto_credito,
        lead_id: parseInt(values.clientId),
        opportunity_id: values.opportunityId || null,
        assigned_to: values.assignedTo,
        opened_at: values.openedAt,
        description: values.description,
        divisa: values.divisa,
        plazo: values.plazo,
        poliza: values.poliza,
      };

      if (dialogState === "create") {
        await api.post('/api/credits', body);
      } else {
        await api.put(`/api/credits/${dialogCredit?.id}`, body);
      }

      toast({ title: "Éxito", description: "Crédito guardado correctamente." });
      setDialogState(null);
      fetchCredits();
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.message || error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportCSV = (credit: CreditItem) => {
    // Helper function to escape CSV values
    const escapeCSV = (value: string | number | null | undefined): string => {
      if (value === null || value === undefined) return "";
      const str = String(value);
      // If value contains comma, quote, or newline, wrap in quotes and escape existing quotes
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headers = [
      "Referencia", "Título", "Estado", "Categoría", "Cliente", "Monto", "Saldo", "Cuota", "Divisa"
    ];
    const row = [
      escapeCSV(credit.reference),
      escapeCSV(credit.title),
      escapeCSV(credit.status),
      escapeCSV(credit.category),
      escapeCSV(credit.client?.name || credit.lead?.name || ""),
      escapeCSV(credit.monto_credito),
      escapeCSV(credit.saldo),
      escapeCSV(credit.cuota),
      escapeCSV(credit.divisa)
    ];

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF"
      + headers.join(",") + "\n"
      + row.join(",");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `credito_${credit.reference}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGenerateDocuments = async (credit: CreditItem) => {
    try {
      let fullCredit = credit;
      try {
        const res = await api.get(`/api/credits/${credit.id}`);
        fullCredit = res.data;
      } catch (error) {
        console.error('Error fetching full credit for pagaré, using list data', error);
      }

      const doc = new jsPDF();
      const today = new Date().toLocaleDateString('es-CR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const img = new Image();
      img.src = '/logopepweb.png';
      img.onload = () => {
        doc.addImage(img, 'PNG', 15, 10, 40, 15);
        generatePagareDocument(doc, fullCredit, today);
      };
      img.onerror = () => {
        generatePagareDocument(doc, fullCredit, today);
      };
    } catch (error) {
      console.error('Error generating pagaré PDF', error);
      toast({
        title: 'Error',
        description: 'No se pudo generar el pagaré.',
        variant: 'destructive',
      });
    }
  };

  const handleExportPDF = async (credit: CreditItem) => {
    const doc = new jsPDF();
    const currentDate = new Date().toLocaleDateString('es-CR');

    let fullCredit = credit;
    try {
      // Fetch full credit details including payments
      const res = await api.get(`/api/credits/${credit.id}`);
      fullCredit = res.data;
    } catch (e) {
      console.error("Error fetching full credit details for PDF", e);
    }

    // Logo (Placeholder or load image)
    const img = new Image();
    img.src = '/logopepweb.png';
    img.onload = () => {
      doc.addImage(img, 'PNG', 14, 10, 40, 15);
      generatePDFContent(doc, fullCredit, currentDate);
    };
    img.onerror = () => {
      doc.setFontSize(16);
      doc.text("CREDIPEP", 14, 20);
      generatePDFContent(doc, fullCredit, currentDate);
    };
  };

  const generatePDFContent = (doc: jsPDF, credit: CreditItem, date: string) => {
    // Header Center
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("ESTADO DE CUENTA", 105, 15, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`REPORTE AL ${date}`, 105, 22, { align: "center" });

    // Header Right (Account Number)
    doc.setFontSize(10);
    doc.text(`*${credit.lead_id}*`, 195, 15, { align: "right" });
    doc.text(`${credit.lead_id}`, 195, 22, { align: "right" });

    // Customer Info
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`${credit.lead_id}`, 14, 35);
    doc.text(`${credit.client?.name || "CLIENTE DESCONOCIDO"}`, 14, 40);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("INST./EMPRESA", 100, 35);
    doc.text(`${credit.client?.ocupacion || "-"}`, 130, 35);
    doc.text(`${credit.client?.departamento_cargo || "-"}`, 100, 40);
    doc.text("SECCIÓN", 100, 45);

    // Planes de Ahorros
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 128); // Dark Blue
    doc.text("Planes de Ahorros", 14, 55);
    doc.setTextColor(0, 0, 0); // Black

    // Mock Savings Data
    autoTable(doc, {
      startY: 60,
      head: [['N.CON', 'PLAN', 'MENSUALIDAD', 'INICIO', 'REND.CORTE', 'APORTES', 'RENDIMIENTO', 'ACUMULADO']],
      body: [
        ['621', 'SOBRANTES POR APLICAR', '0.00', '27/09/2022', '', '0.64', '0.00', '0.64']
      ],
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: 1 },
      headStyles: { fontStyle: 'bold', textColor: [0, 0, 0] },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 50 },
      }
    });

    // Créditos / Otras deducciones
    let finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 128);
    doc.text("Créditos / Otras deducciones", 14, finalY);
    doc.setTextColor(0, 0, 0);

    // Credit Data
    const tasaValue = credit.tasa?.tasa ?? credit.tasa_anual ?? '0.00';
    const creditRow = [
      credit.numero_operacion || credit.reference,
      credit.linea || "PEPITO ABIERTO",
      new Intl.NumberFormat('es-CR', { style: 'decimal', minimumFractionDigits: 2 }).format(credit.monto_credito || 0),
      credit.plazo || 120,
      new Intl.NumberFormat('es-CR', { style: 'decimal', minimumFractionDigits: 2 }).format(credit.cuota || 0),
      new Intl.NumberFormat('es-CR', { style: 'decimal', minimumFractionDigits: 2 }).format(credit.saldo || 0),
      `${tasaValue}%`,
      "0.00", // Morosidad
      credit.primera_deduccion || "-", // PRI.DED (Primera Deducción)
      new Date().toISOString().split('T')[0], // Ult Mov
      credit.fecha_culminacion_credito || "2032-01-01",
      credit.status || "NORMAL"
    ];

    autoTable(doc, {
      startY: finalY + 5,
      head: [['OPERACIÓN', 'LINEA', 'MONTO', 'PLAZO', 'CUOTA', 'SALDO', 'TASA', 'MOROSIDAD', 'PRI.DED', 'ULT.MOV', 'TERMINA', 'PROCESO']],
      body: [creditRow],
      theme: 'plain',
      styles: { fontSize: 7, cellPadding: 1 },
      headStyles: { fontStyle: 'bold', textColor: [0, 0, 0] },
    });

    // Fianzas
    finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 128);
    doc.text("Fianzas", 14, finalY);
    doc.setTextColor(0, 0, 0);

    doc.setLineWidth(0.5);
    doc.setDrawColor(0, 0, 128);
    doc.line(14, finalY + 2, 195, finalY + 2);

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
   

    // Plan de Pagos (Detailed Installments)
    if (credit.plan_de_pagos && credit.plan_de_pagos.length > 0) {
      finalY = finalY + 20;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 128);
      doc.text("Plan de Pagos", 14, finalY);
      doc.setTextColor(0, 0, 0);

      const paymentRows = credit.plan_de_pagos.map(p => [
        p.numero_cuota,
        formatDate(p.fecha_corte),
        formatDate(p.fecha_pago),
        new Intl.NumberFormat('es-CR', { style: 'decimal', minimumFractionDigits: 2 }).format(p.cuota),
        new Intl.NumberFormat('es-CR', { style: 'decimal', minimumFractionDigits: 2 }).format(p.interes_corriente),
        new Intl.NumberFormat('es-CR', { style: 'decimal', minimumFractionDigits: 2 }).format(p.amortizacion),
        new Intl.NumberFormat('es-CR', { style: 'decimal', minimumFractionDigits: 2 }).format(p.nuevo_saldo),
        p.estado
      ]);

      autoTable(doc, {
        startY: finalY + 5,
        head: [['#', 'FECHA CUOTA', 'FECHA PAGO', 'CUOTA', 'INTERÉS', 'AMORTIZACIÓN', 'SALDO', 'ESTADO']],
        body: paymentRows,
        theme: 'striped',
        styles: { fontSize: 7, cellPadding: 1 },
        headStyles: { fontStyle: 'bold', textColor: [0, 0, 0], fillColor: [220, 220, 220] },
      });
    } else {
      doc.text("*** NO TIENE FIANZAS ACTIVAS ***", 20, finalY + 10);
    }

    doc.save(`estado_cuenta_${credit.lead_id}.pdf`);
  };

  const generatePagareDocument = (doc: jsPDF, credit: CreditItem, prettyDate: string) => {
    // Configurar para UTF-8 support
    doc.setLanguage("es");

    const debtor = credit.client || credit.lead || null;
    const nombre = (debtor?.name || '').toUpperCase();
    const cedula = (debtor as any)?.cedula || '';
    const estadoCivil = ((debtor as any)?.estado_civil || '').toUpperCase();
    const profesion = (debtor?.ocupacion || '').toUpperCase();
    const direccion = [
      (debtor as any)?.direccion1,
      (debtor as any)?.direccion2,
    ].filter(Boolean).join(', ').toUpperCase();

    let y = 35;

    // Encabezado operación (esquina superior derecha)
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('OPERACIÓN N°', 160, 15);
    doc.text(credit.numero_operacion || credit.reference || '', 188, 15);

    // Título principal
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('PAGARE', 105, 25, { align: 'center' });

    // Lugar y fecha
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`San José, Costa Rica, el día ${prettyDate.toUpperCase()}`, 20, y);
    y += 8;

    // Sección DEUDOR
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('DEUDOR', 20, y);
    y += 5;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');

    // Nombre
    doc.text('Nombre y apellidos del deudor:', 30, y);
    doc.text(nombre, 90, y);
    y += 4;

    // Cédula
    doc.text('Número de cédula de identidad:', 30, y);
    doc.text(cedula, 90, y);
    y += 4;

    // Estado civil
    doc.text('Estado civil:', 30, y);
    doc.text(estadoCivil, 90, y);
    y += 4;

    // Profesión
    doc.text('Profesión/Oficio:', 30, y);
    doc.text(profesion, 90, y);
    y += 4;

    // Dirección
    doc.text('Dirección de domicilio:', 30, y);
    if (direccion) {
      const direccionLines = doc.splitTextToSize(direccion, 105);
      doc.text(direccionLines, 90, y);
      y += direccionLines.length * 3.5 + 2;
    } else {
      y += 4;
    }
    y += 5;

    // Monto en números
    const monto = Number(credit.monto_credito ?? 0);
    const plazo = Number(credit.plazo ?? 0);
    const tasaNumber = Number(credit.tasa?.tasa ?? credit.tasa_anual ?? 0);
    const tasaMensual = (tasaNumber / 12).toFixed(2);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Monto en números:', 30, y);
    doc.setFont('helvetica', 'normal');
    const divisaCode = credit.divisa || 'CRC';
    doc.text(`${divisaCode}  ${formatAmount(monto)}`, 85, y);
    y += 5;

    // Monto en letras
    doc.setFont('helvetica', 'bold');
    doc.text('Monto en letras:', 30, y);
    doc.setFont('helvetica', 'normal');
    doc.text('____________________________________________ DE COLONES EXACTOS', 85, y);
    y += 5;

    // Tasas de interés
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Tasa de interés corriente:', 30, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`Tasa fija mensual del ${tasaMensual}%`, 85, y);
    y += 4;

    doc.setFont('helvetica', 'bold');
    doc.text('Tasa de interés moratoria:', 30, y);
    doc.setFont('helvetica', 'normal');
    const tasaMoratoria = ((tasaNumber / 12) * 1.3).toFixed(2);
    doc.text(`Tasa mensual del ${tasaMoratoria}%`, 85, y);
    y += 6;

    // Forma de pago
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Forma de pago:', 30, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    const formaPago = `Cuotas mensuales, en número igual al número de meses indicados como "plazo en variables y meses". Yo, la persona indicada como "deudor" en este documento, PROMETO pagar INCONDICIONALMENTE este PAGARE a la orden de CREDIPEP, S.A. cédula jurídica 3-101-515511 entidad domiciliada en San José, San José, Sabana Norte, del ICE, 100 m oeste, 400 m norte y 50 oeste, mano izquierda casa blanca de dos pisos, # 5635. El monto de la deuda es la suma indicada como "Monto en Letras" y "Monto en Números". La tasa de interés corriente es la indicada como "tasa de interés corriente". El pago se llevará a cabo en San José, en el domicilio de la acreedora, en dinero corriente y en colones costarricenses. Los intereses se calcularán sobre la base del saldo de principal en un momento determinado y en porcentajes señalados como "tasa de interés corriente" Los pagos incluyen el capital más intereses y pagaré con la periodicidad de pago indicada. Renuncio a mi domicilio y requerimientos de pago y acepto la concesión de prórrogas sin que se me consulte ni notifique. Asimismo la falta de pago de una sola de las cuotas de capital e intereses indicadas dará derecho al acreedor a tener por vencida y exigible ejecutiva y judicialmente toda la deuda. Este título se rige por las normas del Código de Comercio vigentes acerca del "Pagaré" como título a la orden para representación de un compromiso incondicional de pago de sumas de dinero.`;
    const formaPagoLines = doc.splitTextToSize(formaPago, 175);
    doc.text(formaPagoLines, 30, y);
    y += formaPagoLines.length * 3.5 + 5;

    // Abonos extraordinarios
    doc.setFont('helvetica', 'bold');
    doc.text('SOBRE LOS ABONOS EXTRAORDINARIOS Y CANCELACIÓN ANTICIPADA:', 30, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    const abonosTexto = `Se indica y aclara al deudor de este pagaré, que, por los abonos extraordinarios y cancelación anticipada antes de los primeros doce meses naturales a partir del primer día siguiente a la firma de este crédito se penalizará con tres meses de intereses corrientes, (los cuales tendrá como base de cálculo el mes en el que se realizará la cancelación y los dos meses siguientes a este).`;
    const abonosLines = doc.splitTextToSize(abonosTexto, 175);
    doc.text(abonosLines, 30, y);

    doc.save(`pagare_${credit.numero_operacion || credit.reference}.pdf`);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Créditos</h2>
          <p className="text-muted-foreground">Gestiona los créditos y sus documentos.</p>
        </div>
        <Button onClick={handleCreate}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Nuevo Crédito
        </Button>
      </div>

      {/* Filtros visibles */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-muted/30 rounded-lg border">
        <div className="flex items-center gap-2">
          <Label htmlFor="filter-monto" className="text-sm whitespace-nowrap">Monto:</Label>
          <Input
            id="filter-monto"
            className="w-[140px] h-9"
            value={filters.monto}
            onChange={(e) => setFilters({ ...filters, monto: e.target.value })}
            placeholder="Ej: 100000"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="filter-op" className="text-sm whitespace-nowrap">No. Op.:</Label>
          <Input
            id="filter-op"
            className="w-[140px] h-9"
            value={filters.numeroOperacion}
            onChange={(e) => setFilters({ ...filters, numeroOperacion: e.target.value })}
            placeholder="Ej: CRED-123"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="filter-client" className="text-sm whitespace-nowrap">Cliente:</Label>
          <Input
            id="filter-client"
            className="w-[180px] h-9"
            value={filters.leadName}
            onChange={(e) => setFilters({ ...filters, leadName: e.target.value })}
            placeholder="Nombre del cliente"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="filter-doc" className="text-sm whitespace-nowrap">No. Doc.:</Label>
          <Input
            id="filter-doc"
            className="w-[140px] h-9"
            value={filters.documentoId}
            onChange={(e) => setFilters({ ...filters, documentoId: e.target.value })}
            placeholder="ID Documento"
          />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Label htmlFor="items-per-page" className="text-sm whitespace-nowrap">Mostrar:</Label>
          <Select
            value={String(itemsPerPage)}
            onValueChange={(value) => {
              setItemsPerPage(Number(value));
              setCurrentPage(1);
            }}
          >
            <SelectTrigger id="items-per-page" className="w-[80px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(filters.monto || filters.numeroOperacion || filters.leadName || filters.documentoId) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilters({ monto: "", numeroOperacion: "", leadName: "", documentoId: "" })}
          >
            Limpiar Filtros
          </Button>
        )}
      </div>

      <Tabs value={tabValue} onValueChange={setTabValue}>
        <TabsList className="flex flex-wrap gap-2">
          {CREDIT_STATUS_TAB_CONFIG.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="capitalize">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {CREDIT_STATUS_TAB_CONFIG.map((tab) => {
          const paginationData = getPaginatedCredits(tab.value);
          return (
          <TabsContent key={tab.value} value={tab.value}>
            <Card>
              <CardContent className="p-0">
                <DraggableScrollContainer className="overflow-x-auto select-none p-6">
                  <Table className="min-w-[1800px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right sticky left-0 bg-background z-10">Acciones</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>No. Operación</TableHead>
                        <TableHead>Divisa</TableHead>
                        <TableHead>Monto</TableHead>
                        <TableHead>Plazo</TableHead>
                        <TableHead>Saldo</TableHead>
                        <TableHead>Cuota</TableHead>
                        <TableHead>Línea</TableHead>
                        <TableHead>1ª Deducción</TableHead>
                        <TableHead>Garantía</TableHead>
                        <TableHead>Vencimiento</TableHead>
                        <TableHead>Proceso</TableHead>
                        <TableHead>Tasa</TableHead>
                        <TableHead>Cuotas Atrasadas</TableHead>
                        <TableHead>Deductora</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginationData.items.map((credit) => {
                        // --- LÓGICA CALCULADA EN FRONTEND ---
                        const pagosOrdenados = credit.plan_de_pagos?.length
                          ? [...credit.plan_de_pagos].filter((e) => e.cuota > 0).sort((a, b) => a.numero_cuota - b.numero_cuota)
                          : [];


                        // 1. Primera Deducción: Tomar siempre la primera cuota del plan_de_pagos
                        const fechaInicio = pagosOrdenados.length > 0 ? pagosOrdenados[0].fecha_corte : null;

                        // 2. Vencimiento: De cabecera o la última cuota
                        const fechaFin = credit.fecha_culminacion_credito;

                        // 3. Tasa: De cabecera o del primer pago
                        const tasa = credit.tasa?.tasa ?? credit.tasa_anual ?? (pagosOrdenados.length > 0 ? pagosOrdenados[0].tasa_actual : null);

                        // 4. Fallbacks para Línea y Proceso
                        const linea = credit.linea || credit.category || "-";
                        const proceso = credit.proceso || credit.status || "-";

                        return (
                          <TableRow key={credit.id}>
                            <TableCell className="text-right sticky left-0 bg-background z-10">
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  asChild
                                  title="Ver detalle"
                                  className="border-red-500 text-red-500 hover:bg-red-50 hover:text-red-600"
                                >
                                  <Link href={`/dashboard/creditos/${credit.id}`}>
                                    <Eye className="h-4 w-4" />
                                  </Link>
                                </Button>
                                {['Formalizado', 'En Mora'].includes(credit.status || '') ? (
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    disabled
                                    title={credit.status === 'En Mora' ? "No se puede editar un crédito en mora" : "No se puede editar un crédito formalizado"}
                                    className="border-gray-300 text-gray-400 cursor-not-allowed"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    asChild
                                    title="Editar crédito"
                                    className="border-green-500 text-green-500 hover:bg-green-50 hover:text-green-600"
                                  >
                                    <Link href={`/dashboard/creditos/${credit.id}?edit=true`}>
                                      <Pencil className="h-4 w-4" />
                                    </Link>
                                  </Button>
                                )}

                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button size="icon" className="h-9 w-9 rounded-md bg-blue-900 text-white hover:bg-blue-800 border-0">
                                      <Download className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleExportCSV(credit)}>
                                      <FileSpreadsheet className="mr-2 h-4 w-4" />
                                      Exportar CSV
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleExportPDF(credit)}>
                                      <FileText className="mr-2 h-4 w-4" />
                                      Exportar PDF
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>

                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                    {!['Formalizado', 'En Mora'].includes(credit.status || '') && (
                                      <DropdownMenuItem
                                        onClick={async () => {
                                          try {
                                            await api.put(`/api/credits/${credit.id}`, { status: 'Formalizado' });
                                            toast({
                                              title: 'Crédito formalizado',
                                              description: 'El plan de pagos se ha generado correctamente.',
                                            });
                                            fetchCredits();
                                          } catch (error) {
                                            console.error('Error formalizando crédito:', error);
                                            toast({
                                              title: 'Error',
                                              description: 'No se pudo formalizar el crédito.',
                                              variant: 'destructive',
                                            });
                                          }
                                        }}
                                      >
                                        Formalizar crédito
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem
                                      onClick={() => router.push(`/dashboard/creditos/${credit.id}/pagare`)}
                                    >
                                      Exportar pagaré
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => { setDocumentsCredit(credit); setIsDocumentsOpen(true); }}>
                                      Gestionar documentos
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const badgeStyle = getStatusBadgeStyle(credit.status);
                                return (
                                  <Badge variant={badgeStyle.variant} className={badgeStyle.className}>
                                    {credit.status}
                                  </Badge>
                                );
                              })()}
                            </TableCell>
                            <TableCell>{credit.client?.name || credit.lead?.name}</TableCell>
                            <TableCell className="font-medium">
                              <Link href={`/dashboard/creditos/${credit.id}`} className="hover:underline text-primary">
                                {credit.numero_operacion || credit.reference || "-"}
                              </Link>
                            </TableCell>
                            <TableCell>{credit.divisa || "CRC"}</TableCell>
                            <TableCell>{new Intl.NumberFormat('es-CR', { style: 'currency', currency: credit.divisa || 'CRC' }).format(credit.monto_credito || 0)}</TableCell>
                            <TableCell>{credit.plazo ? `${credit.plazo} meses` : "-"}</TableCell>
                            <TableCell>{new Intl.NumberFormat('es-CR', { style: 'currency', currency: credit.divisa || 'CRC' }).format(credit.saldo || 0)}</TableCell>
                            <TableCell>{new Intl.NumberFormat('es-CR', { style: 'currency', currency: credit.divisa || 'CRC' }).format(credit.cuota || 0)}</TableCell>

                            {/* Columnas Calculadas / Fallbacks */}
                            <TableCell>{linea}</TableCell>
                            <TableCell>{formatDate(fechaInicio)}</TableCell>
                            <TableCell>{credit.garantia || "-"}</TableCell>
                            <TableCell>{formatDate(fechaFin)}</TableCell>
                            <TableCell>{proceso}</TableCell>
                            <TableCell>{tasa ? `${tasa}%` : "-"}</TableCell>

                            <TableCell>{credit.cuotas_atrasadas || 0}</TableCell>
                            <TableCell>
                              {deductoras.find(d => d.id === credit.lead?.deductora_id)?.nombre || "-"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </DraggableScrollContainer>

                {/* Pagination Controls */}
                {paginationData.totalPages > 0 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      Mostrando {paginationData.startIndex} a {paginationData.endIndex} de {paginationData.totalItems} registros
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                      >
                        Primera
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>

                      {/* Page numbers */}
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, paginationData.totalPages) }, (_, i) => {
                          let pageNum: number;
                          if (paginationData.totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= paginationData.totalPages - 2) {
                            pageNum = paginationData.totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          return (
                            <Button
                              key={pageNum}
                              variant={currentPage === pageNum ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(pageNum)}
                              className="w-9"
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>

                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setCurrentPage((prev) => Math.min(prev + 1, paginationData.totalPages))}
                        disabled={currentPage === paginationData.totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(paginationData.totalPages)}
                        disabled={currentPage === paginationData.totalPages}
                      >
                        Última
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        );
        })}
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={!!dialogState} onOpenChange={(open) => !open && setDialogState(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{dialogState === 'create' ? 'Nuevo Crédito' : 'Editar Crédito'}</DialogTitle>
            <DialogDescription>Completa la información del crédito.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <ScrollArea className="h-[60vh] pr-4">
                <div className="space-y-6 p-1">
                  {/* 1. Datos Generales */}
                  <div>
                    <h3 className="text-lg font-medium">Datos Generales</h3>
                    <Separator className="my-2" />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Título</FormLabel>
                            <FormControl>
                              <Input placeholder="Crédito Hipotecario..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="reference"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Referencia</FormLabel>
                            <FormControl>
                              <Input placeholder="Se genera automáticamente" {...field} disabled />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="clientId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cliente</FormLabel>
                            <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={openCombobox}
                                    className="justify-between font-normal w-full h-10"
                                  >
                                    {field.value
                                      ? clients.find((client) => String(client.id) === field.value)?.name
                                      : "Selecciona un cliente..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="p-0 w-[400px]" align="start">
                                <div className="p-2 border-b">
                                  <Input
                                    placeholder="Buscar por nombre o cédula..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="h-8"
                                  />
                                </div>
                                <div className="max-h-[200px] overflow-y-auto p-1">
                                  {filteredClients.length === 0 ? (
                                    <div className="py-6 text-center text-sm text-muted-foreground">No se encontraron clientes.</div>
                                  ) : (
                                    filteredClients.map((client) => (
                                      <div
                                        key={client.id}
                                        className={`relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground ${String(client.id) === field.value ? "bg-accent text-accent-foreground" : ""}`}
                                        onClick={() => {
                                          form.setValue("clientId", String(client.id));
                                          setOpenCombobox(false);
                                        }}
                                      >
                                        <Check
                                          className={`mr-2 h-4 w-4 ${String(client.id) === field.value ? "opacity-100" : "opacity-0"
                                            }`}
                                        />
                                        <div className="flex flex-col">
                                          <span>{client.name}</span>
                                          {client.cedula && <span className="text-xs text-muted-foreground">{client.cedula}</span>}
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="assignedTo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Responsable</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecciona un responsable" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {users.map(user => (
                                  <SelectItem key={user.id} value={user.name}>{user.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="opportunityId"
                        render={({ field }) => (
                          <FormItem className="sm:col-span-2">
                            <FormLabel>Oportunidad (Opcional)</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecciona una oportunidad" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {availableOpportunities.map(o => (
                                  <SelectItem key={o.id} value={String(o.id)}>{o.title}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* 2. Condiciones Financieras */}
                  <div>
                    <h3 className="text-lg font-medium">Condiciones Financieras</h3>
                    <Separator className="my-2" />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="monto_credito"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Monto Solicitado</FormLabel>
                            <FormControl>
                              <Input
                                type="text"
                                placeholder="₡0.00"
                                value={field.value ? formatCurrency(field.value) : ''}
                                onChange={(e) => {
                                  const numericValue = parseCurrencyToNumber(e.target.value);
                                  field.onChange(numericValue);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="plazo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Plazo (Meses)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                max="120"
                                placeholder="1 - 120"
                                value={field.value}
                                onChange={(e) => {
                                  const valor = parseInt(e.target.value);
                                  if (e.target.value === '') {
                                    field.onChange(0);
                                  } else if (!isNaN(valor) && valor >= 1 && valor <= 120) {
                                    field.onChange(valor);
                                  }
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="divisa"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Divisa</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecciona la divisa" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {CURRENCY_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="openedAt"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Fecha Apertura</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* 3. Configuración Adicional */}
                  <div>
                    <h3 className="text-lg font-medium">Configuración Adicional</h3>
                    <Separator className="my-2" />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Categoría</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecciona la categoría" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {products.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="poliza"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>¿Tiene póliza?</FormLabel>
                            <FormControl>
                              <div className="flex items-center space-x-2 h-10 px-3 border rounded-md">
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                                <span className="text-sm text-muted-foreground">
                                  {field.value ? "Sí posee póliza" : "No posee póliza"}
                                </span>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem className="sm:col-span-2">
                            <FormLabel>Estado Inicial</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecciona el estado" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {CREDIT_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem className="sm:col-span-2">
                            <FormLabel>Descripción</FormLabel>
                            <FormControl>
                              <Textarea
                                className="min-h-[120px]"
                                placeholder="Describe el contexto del crédito..."
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {currentClient ? (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Información del cliente</CardTitle>
                        <CardDescription>Resumen del cliente relacionado con este crédito.</CardDescription>
                      </CardHeader>
                      <CardContent className="text-sm">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div>
                            <span className="font-medium">Nombre:</span> {currentClient.name}
                          </div>
                          <div>
                            <span className="font-medium">Correo:</span> {currentClient.email ?? "-"}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : null}
                </div>
              </ScrollArea>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogState(null)}>Cancelar</Button>
                <Button type="submit" disabled={isSaving}>{isSaving ? "Guardando..." : "Guardar"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Documents Dialog */}
      <CreditDocumentsDialog
        isOpen={isDocumentsOpen}
        credit={documentsCredit}
        onClose={() => setIsDocumentsOpen(false)}
        canDownloadDocuments={canDownloadDocuments}
        deductoras={deductoras}
      />
    </div>
  );
}

interface CreditDocumentsDialogProps {
  isOpen: boolean;
  credit: CreditItem | null;
  onClose: () => void;
  canDownloadDocuments: boolean;
  deductoras: DeductoraOption[];
}

function CreditDocumentsDialog({ isOpen, credit, onClose, canDownloadDocuments }: CreditDocumentsDialogProps) {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<CreditDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Create state
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Edit state
  const [editingDoc, setEditingDoc] = useState<CreditDocument | null>(null);
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete state
  const [deletingDocId, setDeletingDocId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchDocuments = useCallback(async () => {
    if (!credit) return;
    setIsLoading(true);
    try {
      const res = await api.get(`/api/credits/${credit.id}/documents`);
      setDocuments(res.data);
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "No se pudieron cargar los documentos.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [credit, toast]);

  useEffect(() => {
    if (isOpen) {
      fetchDocuments();
      // Reset form state
      setFile(null);
      setName("");
      setNotes("");
      setEditingDoc(null);
      setDeletingDocId(null);
    }
  }, [isOpen, fetchDocuments]);

  // CREATE - Upload new document
  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!credit || !file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", name || file.name);
      formData.append("notes", notes);

      await api.post(`/api/credits/${credit.id}/documents`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      toast({ title: "Documento subido", description: "El documento se ha subido correctamente." });
      setName("");
      setNotes("");
      setFile(null);
      // Reset file input
      const fileInput = document.getElementById('doc-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      fetchDocuments();
    } catch (e: any) {
      toast({ title: "Error", description: e.response?.data?.message || "No se pudo subir el documento.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  // READ - Download document
  const handleDownload = async (doc: CreditDocument) => {
    if (!credit || !canDownloadDocuments) return;
    try {
      const response = await api.get(`/api/credits/${credit.id}/documents/${doc.id}/download`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.name || `documento-${doc.id}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      toast({ title: "Error", description: "No se pudo descargar el documento.", variant: "destructive" });
    }
  };

  // UPDATE - Edit document
  const handleStartEdit = (doc: CreditDocument) => {
    setEditingDoc(doc);
    setEditName(doc.name);
    setEditNotes(doc.notes || "");
  };

  const handleCancelEdit = () => {
    setEditingDoc(null);
    setEditName("");
    setEditNotes("");
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!credit || !editingDoc) return;
    setIsUpdating(true);
    try {
      await api.put(`/api/credits/${credit.id}/documents/${editingDoc.id}`, {
        name: editName,
        notes: editNotes
      });

      toast({ title: "Documento actualizado", description: "Los cambios se han guardado correctamente." });
      handleCancelEdit();
      fetchDocuments();
    } catch (e: any) {
      toast({ title: "Error", description: e.response?.data?.message || "No se pudo actualizar el documento.", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  // DELETE - Remove document
  const handleConfirmDelete = async () => {
    if (!credit || !deletingDocId) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/credits/${credit.id}/documents/${deletingDocId}`);
      toast({ title: "Documento eliminado", description: "El documento se ha eliminado correctamente." });
      setDeletingDocId(null);
      fetchDocuments();
    } catch (e: any) {
      toast({ title: "Error", description: e.response?.data?.message || "No se pudo eliminar el documento.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Gestionar Documentos</DialogTitle>
            <DialogDescription>
              {credit ? `Documentos del crédito ${credit.reference || credit.numero_operacion || credit.id}` : "Documentos del crédito"}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-6">
            {/* Upload Form */}
            <form onSubmit={handleUpload} className="space-y-4 border p-4 rounded-lg bg-muted/30">
              <h4 className="font-medium text-sm">Subir nuevo documento</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="doc-name">Nombre del documento</Label>
                  <Input
                    id="doc-name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ej: Contrato firmado"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="doc-file-input">Archivo</Label>
                  <Input
                    id="doc-file-input"
                    type="file"
                    onChange={e => setFile(e.target.files?.[0] || null)}
                    required
                  />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="doc-notes">Notas (opcional)</Label>
                  <Input
                    id="doc-notes"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Observaciones sobre el documento..."
                  />
                </div>
              </div>
              <Button type="submit" disabled={isUploading || !file} size="sm">
                {isUploading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Subir Documento
                  </>
                )}
              </Button>
            </form>

            {/* Documents List */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Documentos ({documents.length})</h4>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay documentos adjuntos a este crédito.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Notas</TableHead>
                      <TableHead>Tamaño</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map(doc => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            {doc.name}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground">
                          {doc.notes || "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatFileSize(doc.size)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(doc.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {canDownloadDocuments && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDownload(doc)}
                                title="Descargar"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleStartEdit(doc)}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeletingDocId(doc.id)}
                              className="text-destructive hover:text-destructive"
                              title="Eliminar"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                              </svg>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingDoc} onOpenChange={open => !open && handleCancelEdit()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Documento</DialogTitle>
            <DialogDescription>Modifica los datos del documento.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nombre</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notas</Label>
              <Textarea
                id="edit-notes"
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                placeholder="Observaciones sobre el documento..."
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCancelEdit}>Cancelar</Button>
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? "Guardando..." : "Guardar cambios"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingDocId} onOpenChange={open => !open && setDeletingDocId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Documento</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar este documento? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingDocId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={isDeleting}>
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DraggableScrollContainer({ children, className }: { children: React.ReactNode, className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isGrabbing, setIsGrabbing] = useState(false);
  const dragState = useRef({ isDown: false, startX: 0, scrollLeft: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button, a, input, select, textarea, [role="button"], [role="menuitem"], svg')) {
        return;
      }

      dragState.current = {
        isDown: true,
        startX: e.clientX,
        scrollLeft: container.scrollLeft,
      };
      setIsGrabbing(true);
      container.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!dragState.current.isDown) return;

      const deltaX = e.clientX - dragState.current.startX;
      container.scrollLeft = dragState.current.scrollLeft - deltaX;
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (dragState.current.isDown) {
        dragState.current.isDown = false;
        setIsGrabbing(false);
        container.releasePointerCapture(e.pointerId);
      }
    };

    container.addEventListener('pointerdown', handlePointerDown);
    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointerup', handlePointerUp);
    container.addEventListener('pointercancel', handlePointerUp);

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerup', handlePointerUp);
      container.removeEventListener('pointercancel', handlePointerUp);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        cursor: isGrabbing ? 'grabbing' : 'grab',
        overflowX: 'auto',
        overflowY: 'hidden',
        touchAction: 'pan-y',
      }}
    >
      {children}
    </div>
  );
}