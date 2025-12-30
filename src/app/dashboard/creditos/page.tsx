"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MoreHorizontal, PlusCircle, Eye, RefreshCw, Pencil, FileText, FileSpreadsheet, Download, Check, ChevronsUpDown, Filter } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

import api from "@/lib/axios";

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
  tasa_anual?: number | null; // Agregado
}

const CREDIT_STATUS_OPTIONS = [
  "Activo",
  "Mora",
  "Cerrado",
  "Legal",
  "Aprobado",
  "Formalizado"
] as const;
const CREDIT_CATEGORY_OPTIONS = ["Regular", "Micro-crédito", "Hipotecario", "Personal"] as const;
const CURRENCY_OPTIONS = [
  { value: "CRC", label: "Colón Costarricense (CRC)" },
  { value: "USD", label: "Dólar Estadounidense (USD)" },
  { value: "EUR", label: "Euro (EUR)" },
  { value: "GBP", label: "Libra Esterlina (GBP)" },
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

function formatDateTime(dateString?: string | null): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-CR", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function CreditsPage() {
  const { toast } = useToast();
  const [deductoras, setDeductoras] = useState<DeductoraOption[]>([]);

  const [credits, setCredits] = useState<CreditItem[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityOption[]>([]);
  const [users, setUsers] = useState<{ id: number, name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [isLoadingOpportunities, setIsLoadingOpportunities] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [tabValue, setTabValue] = useState("all");
  const [filters, setFilters] = useState({
    monto: "",
    numeroOperacion: "",
    leadName: "",
    documentoId: ""
  });

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
      category: CREDIT_CATEGORY_OPTIONS[0],
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

  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [statusCredit, setStatusCredit] = useState<CreditItem | null>(null);
  const [statusForm, setStatusForm] = useState({ status: CREDIT_STATUS_OPTIONS[0] as string });

  const [isDocumentsOpen, setIsDocumentsOpen] = useState(false);
  const [documentsCredit, setDocumentsCredit] = useState<CreditItem | null>(null);

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailCredit, setDetailCredit] = useState<CreditItem | null>(null);

  // Drag scroll state 

  const currentClientId = form.watch("clientId");
  const currentClient = useMemo(() => {
    return currentClientId ? clients.find((client) => String(client.id) === currentClientId) : null;
  }, [currentClientId, clients]);

  const filteredClients = useMemo(() => {
    if (!searchQuery) return clients;
    const lowerQuery = searchQuery.toLowerCase();
    return clients.filter(client =>
      client.name.toLowerCase().includes(lowerQuery) ||
      (client.cedula && client.cedula.includes(lowerQuery))
    );
  }, [clients, searchQuery]);

  const availableOpportunities = useMemo(() => {
    return opportunities.filter((opportunity) => {
      const belongsToClient = currentClientId ? opportunity.lead_id === parseInt(currentClientId, 10) : true;
      const canSelectExistingCredit = dialogCredit?.opportunity_id === opportunity.id;
      const isFree = !opportunity.credit;
      return belongsToClient && (canSelectExistingCredit || isFree);
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
      console.log('Deductoras loaded:', data);
    } catch (error) {
      setDeductoras([]);
      console.error("Error fetching deductoras:", error);
    }
  }, []);

  const fetchCredits = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/api/credits');

      // Handle both paginated response { data: [...] } and direct array response
      const apiData = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      setCredits(apiData);
    } catch (error) {
      console.error("Error fetching credits:", error);
      toast({ title: "Error", description: "No se pudieron cargar los créditos. Intente nuevamente.", variant: "destructive" });
      setCredits([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const fetchClients = useCallback(async () => {
    try {
      setIsLoadingClients(true);
      const response = await api.get('/api/clients');
      const data = response.data.data || response.data;
      setClients(data.map((c: any) => ({ id: c.id, name: c.name, email: c.email, cedula: c.cedula, deductora_id: c.deductora_id })));
    } catch (error) {
      console.error("Error fetching clients:", error);
    } finally {
      setIsLoadingClients(false);
    }
  }, []);

  const fetchOpportunities = useCallback(async () => {
    try {
      setIsLoadingOpportunities(true);
      const response = await api.get('/api/opportunities');
      const data = response.data.data || response.data;
      setOpportunities(data.map((o: any) => ({
        id: o.id,
        title: `${o.id} - ${o.opportunity_type} - ${new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(o.amount)}`,
        lead_id: o.lead?.id
      })));
    } catch (error) {
      console.error("Error fetching opportunities:", error);
    } finally {
      setIsLoadingOpportunities(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoadingUsers(true);
      const response = await api.get('/api/agents');
      setUsers(response.data);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    fetchCredits();
    fetchClients();
    fetchOpportunities();
    fetchUsers();
    fetchDeductoras();
  }, [fetchCredits, fetchClients, fetchOpportunities, fetchUsers, fetchDeductoras]);

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

  const handleCreate = () => {
    form.reset({
      reference: "",
      title: "",
      status: CREDIT_STATUS_OPTIONS[0],
      category: CREDIT_CATEGORY_OPTIONS[0],
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

  const handleEdit = (credit: CreditItem) => {
    form.reset({
      reference: credit.reference,
      title: credit.title,
      status: credit.status || CREDIT_STATUS_OPTIONS[0],
      category: credit.category || CREDIT_CATEGORY_OPTIONS[0],
      monto_credito: credit.monto_credito || 0,
      clientId: String(credit.lead_id),
      opportunityId: credit.opportunity_id ? String(credit.opportunity_id) : "",
      assignedTo: credit.assigned_to || "",
      openedAt: credit.opened_at ? credit.opened_at.split('T')[0] : "",
      description: credit.description || "",
      divisa: credit.divisa || "CRC",
      plazo: credit.plazo || 36,
      poliza: credit.poliza ?? false,
    });
    setDialogCredit(credit);
    setDialogState("edit");
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

  const handleStatusUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!statusCredit) return;
    setIsSaving(true);
    try {
      await api.put(`/api/credits/${statusCredit.id}`, {
        status: statusForm.status
      });
      toast({ title: "Éxito", description: "Estado actualizado." });
      setIsStatusOpen(false);
      fetchCredits();
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.message || error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportCSV = (credit: CreditItem) => {
    const headers = [
      "Referencia", "Título", "Estado", "Categoría", "Lead", "Monto", "Saldo", "Cuota", "Divisa"
    ];
    const row = [
      credit.reference,
      credit.title,
      credit.status,
      credit.category,
      credit.client?.name || "",
      credit.monto_credito,
      credit.saldo,
      credit.cuota,
      credit.divisa
    ];

    const csvContent = "data:text/csv;charset=utf-8,"
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
    const creditRow = [
      credit.numero_operacion || credit.reference,
      credit.linea || "PEPITO ABIERTO",
      new Intl.NumberFormat('es-CR', { style: 'decimal', minimumFractionDigits: 2 }).format(credit.monto_credito || 0),
      credit.plazo || 120,
      new Intl.NumberFormat('es-CR', { style: 'decimal', minimumFractionDigits: 2 }).format(credit.cuota || 0),
      new Intl.NumberFormat('es-CR', { style: 'decimal', minimumFractionDigits: 2 }).format(credit.saldo || 0),
      "0.00", // Morosidad
      new Date().toISOString().split('T')[0], // Ult Mov
      credit.fecha_culminacion_credito || "2032-01-01",
      credit.status || "NORMAL"
    ];

    autoTable(doc, {
      startY: finalY + 5,
      head: [['OPERACIÓN', 'LINEA', 'MONTO', 'PLAZO', 'CUOTA', 'SALDO', 'MOROSIDAD', 'PRI.DED', 'ULT.MOV', 'TERMINA', 'PROCESO']],
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
    doc.text("*** NO TIENE FIANZAS ACTIVAS ***", 20, finalY + 10);

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
    }

    doc.save(`estado_cuenta_${credit.lead_id}.pdf`);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Créditos</h2>
          <p className="text-muted-foreground">Gestiona los créditos y sus documentos.</p>
        </div>
        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                Filtros
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="grid gap-4">
                <div className="space-y-2">

                  <h4 className="font-medium leading-none">Filtros</h4>
                  <p className="text-sm text-muted-foreground">
                    Filtra los créditos por los siguientes criterios.
                  </p>
                </div>
                <div className="grid gap-2">
                  <div className="grid grid-cols-3 items-center gap-4">
                    <Label htmlFor="filter-monto">Monto</Label>
                    <Input
                      id="filter-monto"
                      className="col-span-2 h-8"
                      value={filters.monto}
                      onChange={(e) => setFilters({ ...filters, monto: e.target.value })}
                      placeholder="Ej: 100000"
                    />
                  </div>
                  <div className="grid grid-cols-3 items-center gap-4">
                    <Label htmlFor="filter-op">No. Op.</Label>
                    <Input
                      id="filter-op"
                      className="col-span-2 h-8"
                      value={filters.numeroOperacion}
                      onChange={(e) => setFilters({ ...filters, numeroOperacion: e.target.value })}
                      placeholder="Ej: CRED-123"
                    />
                  </div>
                  <div className="grid grid-cols-3 items-center gap-4">
                    <Label htmlFor="filter-client">Cliente</Label>
                    <Input
                      id="filter-client"
                      className="col-span-2 h-8"
                      value={filters.leadName}
                      onChange={(e) => setFilters({ ...filters, leadName: e.target.value })}
                      placeholder="Nombre del cliente"
                    />
                  </div>
                  <div className="grid grid-cols-3 items-center gap-4">
                    <Label htmlFor="filter-doc">No. Doc.</Label>
                    <Input
                      id="filter-doc"
                      className="col-span-2 h-8"
                      value={filters.documentoId}
                      onChange={(e) => setFilters({ ...filters, documentoId: e.target.value })}
                      placeholder="ID Documento"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFilters({ monto: "", numeroOperacion: "", leadName: "", documentoId: "" })}
                    className="mt-2"
                  >
                    Limpiar Filtros
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button onClick={handleCreate}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Nuevo Crédito
          </Button>
        </div>
      </div>

      <Tabs value={tabValue} onValueChange={setTabValue}>
        <TabsList className="flex flex-wrap gap-2">
          {CREDIT_STATUS_TAB_CONFIG.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="capitalize">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {CREDIT_STATUS_TAB_CONFIG.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            <Card>
              <CardContent>
                <DraggableScrollContainer className="overflow-x-auto select-none">
                  <Table className="min-w-max">
                    <TableHeader>
                      <TableRow>
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
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getCreditsForTab(tab.value).map((credit) => {
                        // --- LÓGICA CALCULADA EN FRONTEND ---
                        const pagosOrdenados = credit.plan_de_pagos?.length
                          ? [...credit.plan_de_pagos].filter((e) => e.cuota > 0).sort((a, b) => a.numero_cuota - b.numero_cuota)
                          : [];


                        // 1. Primera Deducción: Tomar siempre la primera cuota del plan_de_pagos
                        const fechaInicio = pagosOrdenados.length > 0 ? pagosOrdenados[0].fecha_corte : null;

                        // 2. Vencimiento: De cabecera o la última cuota
                        const fechaFin = credit.fecha_culminacion_credito;

                        // 3. Tasa: De cabecera o del primer pago
                        const tasa = credit.tasa_anual || (pagosOrdenados.length > 0 ? pagosOrdenados[0].tasa_actual : null);

                        // 4. Fallbacks para Línea y Proceso
                        const linea = credit.linea || credit.category || "-";
                        const proceso = credit.proceso || credit.status || "-";

                        return (
                          <TableRow key={credit.id}>
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
                            <TableCell className="text-right">
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
                                    {credit.status !== 'Formalizado' && (
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
                                    <DropdownMenuItem onClick={() => { setDocumentsCredit(credit); setIsDocumentsOpen(true); }}>
                                      Gestionar documentos
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </DraggableScrollContainer>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
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
                              <Input placeholder="Ej: CRED-ABC12345" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="clientId"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Cliente</FormLabel>
                            <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={openCombobox}
                                    className="justify-between font-normal w-full"
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
                              <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} />
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
                              <Input type="number" min="1" max="120" placeholder="Plazo en meses" {...field} />
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
                                {CREDIT_CATEGORY_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
                            <div className="flex items-center space-x-2 pt-2">
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <FormLabel className="font-normal cursor-pointer">
                                {field.value ? "Sí" : "No"}
                              </FormLabel>
                            </div>
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

      {/* Status Dialog */}
      <Dialog open={isStatusOpen} onOpenChange={setIsStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Actualizar Estado</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleStatusUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={statusForm.status} onValueChange={v => setStatusForm({ ...statusForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CREDIT_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsStatusOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSaving}>Actualizar</Button>
            </DialogFooter>
          </form>
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

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalle del Crédito</DialogTitle>
          </DialogHeader>
          {detailCredit && (
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-muted-foreground">Referencia</Label><p>{detailCredit.reference}</p></div>
              <div><Label className="text-muted-foreground">Título</Label><p>{detailCredit.title}</p></div>
              <div><Label className="text-muted-foreground">Estado</Label><p>{detailCredit.status}</p></div>
              <div><Label className="text-muted-foreground">Categoría</Label><p>{detailCredit.category}</p></div>
              <div><Label className="text-muted-foreground">Cliente</Label><p>{detailCredit.client?.name}</p></div>
              <div><Label className="text-muted-foreground">Responsable</Label><p>{detailCredit.assigned_to}</p></div>
              <div className="col-span-2"><Label className="text-muted-foreground">Descripción</Label><p>{detailCredit.description}</p></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
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
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const slider = ref.current;
    if (!slider) return;

    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDown = true;
      slider.classList.add("active");
      slider.style.cursor = "grabbing";
      startX = e.pageX - slider.offsetLeft;
      scrollLeft = slider.scrollLeft;
    };

    const onMouseLeave = () => {
      isDown = false;
      slider.classList.remove("active");
      slider.style.cursor = "grab";
    };

    const onMouseUp = () => {
      isDown = false;
      slider.classList.remove("active");
      slider.style.cursor = "grab";
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - slider.offsetLeft;
      const walk = (x - startX) * 2; // Scroll-fast
      slider.scrollLeft = scrollLeft - walk;
    };

    slider.addEventListener("mousedown", onMouseDown);
    slider.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    slider.addEventListener("mouseleave", onMouseLeave);
    slider.addEventListener("mouseup", onMouseUp);

    return () => {
      slider.removeEventListener("mousedown", onMouseDown);
      slider.removeEventListener("mousemove", onMouseMove);
      slider.removeEventListener("mouseleave", onMouseLeave);
      slider.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{ scrollbarWidth: 'thin', cursor: 'grab' }}
    >
      {children}
    </div>
  );
}