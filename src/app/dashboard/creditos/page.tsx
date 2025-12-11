"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MoreHorizontal, PlusCircle, Eye, RefreshCw, Pencil, FileText, FileSpreadsheet, Download, Check, ChevronsUpDown, Filter } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/axios";
import { credits as mockCredits } from "@/lib/data";

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
  deductora_id?: string | number;
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
  payments?: CreditPayment[];
  // New fields
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
  documento_id?: string | null;
}

interface CreditFormValues {
  reference: string;
  title: string;
  status: string;
  category: string;
  monto_credito: string;
  leadId: string;
  opportunityId: string;
  assignedTo: string;
  openedAt: string;
  description: string;
  divisa: string;
  plazo: string;
}

const CREDIT_STATUS_OPTIONS = [
  "Activo",
  "Mora",
  "Cerrado",
  "Legal"
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
  { value: "mora", label: "En Mora" },
  { value: "cerrado", label: "Cerrado" },
  { value: "legal", label: "Cobro Judicial" },
] as const;

const TAB_STATUS_FILTERS: Record<string, string[]> = {
  "activo": ["activo", "al día"],
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

  const [credits, setCredits] = useState<CreditItem[]>([]);
  const [leads, setLeads] = useState<ClientOption[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingLeads, setIsLoadingLeads] = useState(true);
  const [isLoadingOpportunities, setIsLoadingOpportunities] = useState(true);
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
  const [formValues, setFormValues] = useState<CreditFormValues>({
    reference: "",
    title: "",
    status: CREDIT_STATUS_OPTIONS[0],
    category: CREDIT_CATEGORY_OPTIONS[0],
    monto_credito: "",
    leadId: "",
    opportunityId: "",
    assignedTo: "",
    openedAt: "",
    description: "",
    divisa: "CRC",
    plazo: "36",
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
  

  const currentLead = useMemo(() => {
    return formValues.leadId ? leads.find((lead) => lead.id === formValues.leadId) : null;
  }, [formValues.leadId, leads]);

  const filteredLeads = useMemo(() => {
    if (!searchQuery) return leads;
    const lowerQuery = searchQuery.toLowerCase();
    return leads.filter(lead =>
      lead.name.toLowerCase().includes(lowerQuery) ||
      (lead.cedula && lead.cedula.includes(lowerQuery))
    );
  }, [leads, searchQuery]);

  const availableOpportunities = useMemo(() => {
    return opportunities.filter((opportunity) => {
      const belongsToLead = formValues.leadId ? opportunity.lead_id === parseInt(formValues.leadId, 10) : true;
      const canSelectExistingCredit = dialogCredit?.opportunity_id === opportunity.id;
      const isFree = !opportunity.credit;
      return belongsToLead && (canSelectExistingCredit || isFree);
    });
  }, [opportunities, formValues.leadId, dialogCredit]);

  // Mock permission for now
  const canDownloadDocuments = true;

  const fetchCredits = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/api/credits');

      // Combine API data with mock data for testing
      const apiData = response.data;
      const apiIds = new Set(apiData.map((c: any) => c.id));

      const formattedMockCredits = mockCredits
        .filter(c => !c.id || !apiIds.has(c.id))
        .map(c => ({
          ...c,
          id: c.id || Math.floor(Math.random() * 10000) + 10000, // Ensure no collision if id is missing
          assigned_to: c.assigned_to ? String(c.assigned_to) : null,
          lead: c.lead ? { ...c.lead, email: c.lead.email || null } : null,
          opportunity: c.opportunity ? { ...c.opportunity, title: c.opportunity.title || null } : null
        })) as unknown as CreditItem[];

      setCredits([...apiData, ...formattedMockCredits]);
    } catch (error) {
      console.error("Error fetching credits:", error);

      // Fallback to mock data
      const formattedMockCredits = mockCredits.map(c => ({
        ...c,
        id: c.id || Math.floor(Math.random() * 10000),
        assigned_to: c.assigned_to ? String(c.assigned_to) : null,
        lead: c.lead ? { ...c.lead, email: c.lead.email || null } : null,
        opportunity: c.opportunity ? { ...c.opportunity, title: c.opportunity.title || null } : null
      })) as unknown as CreditItem[];

      setCredits(formattedMockCredits);
      toast({ title: "Info", description: "Mostrando datos de prueba.", variant: "default" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const fetchLeads = useCallback(async () => {
    try {
      setIsLoadingLeads(true);
      const response = await api.get('/api/leads');
      const data = response.data.data || response.data;
      setLeads(data.map((l: any) => ({ id: l.id, name: l.name, email: l.email, cedula: l.cedula })));
    } catch (error) {
      console.error("Error fetching leads:", error);
    } finally {
      setIsLoadingLeads(false);
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

  useEffect(() => {
    fetchCredits();
    fetchLeads();
    fetchOpportunities();
  }, [fetchCredits, fetchLeads, fetchOpportunities]);

  // Cleanup drag event listeners on unmount

  // Populate lead objects on credits based on lead_id
  useEffect(() => {
    setCredits(prevCredits => prevCredits.map(credit => ({
      ...credit,
      lead: leads.find(l => String(l.id) === String(credit.lead_id)) || credit.lead
    })));
  }, [leads]);

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
    setFormValues({
      reference: "",
      title: "",
      status: CREDIT_STATUS_OPTIONS[0],
      category: CREDIT_CATEGORY_OPTIONS[0],
      monto_credito: "",
      leadId: "",
      opportunityId: "",
      assignedTo: "",
      openedAt: new Date().toISOString().split('T')[0],
      description: "",
      divisa: "CRC",
      plazo: "36",
    });
    setDialogCredit(null);
    setDialogState("create");
  };

  const handleEdit = (credit: CreditItem) => {
    setFormValues({
      reference: credit.reference,
      title: credit.title,
      status: credit.status || CREDIT_STATUS_OPTIONS[0],
      category: credit.category || CREDIT_CATEGORY_OPTIONS[0],
      monto_credito: String(credit.monto_credito || ""),
      leadId: String(credit.lead_id),
      opportunityId: credit.opportunity_id ? String(credit.opportunity_id) : "",
      assignedTo: credit.assigned_to || "",
      openedAt: credit.opened_at ? credit.opened_at.split('T')[0] : "",
      description: credit.description || "",
      divisa: credit.divisa || "CRC",
      plazo: credit.plazo ? String(credit.plazo) : "36",
    });
    setDialogCredit(credit);
    setDialogState("edit");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const body = {
        reference: formValues.reference,
        title: formValues.title,
        status: formValues.status,
        category: formValues.category,
        monto_credito: parseFloat(formValues.monto_credito) || 0,
        lead_id: parseInt(formValues.leadId),
        opportunity_id: formValues.opportunityId || null,
        assigned_to: formValues.assignedTo,
        opened_at: formValues.openedAt,
        description: formValues.description,
        divisa: formValues.divisa,
        plazo: parseInt(formValues.plazo) || 36,
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
      (credit.tasa_anual || 33.55) + "%",
      new Intl.NumberFormat('es-CR', { style: 'decimal', minimumFractionDigits: 2 }).format(credit.cuota || 0),
      new Intl.NumberFormat('es-CR', { style: 'decimal', minimumFractionDigits: 2 }).format(credit.saldo || 0),
      "0.00", // Morosidad
      credit.primera_deduccion || "01/2022",
      new Date().toISOString().split('T')[0], // Ult Mov
      credit.fecha_culminacion_credito || "2032-01-01",
      credit.status || "NORMAL"
    ];

    autoTable(doc, {
      startY: finalY + 5,
      head: [['OPERACIÓN', 'LINEA', 'MONTO', 'PLAZO', 'TASA', 'CUOTA', 'SALDO', 'MOROSIDAD', 'PRI.DED', 'ULT.MOV', 'TERMINA', 'PROCESO']],
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
    if (credit.payments && credit.payments.length > 0) {
      finalY = finalY + 20;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 128);
      doc.text("Plan de Pagos", 14, finalY);
      doc.setTextColor(0, 0, 0);

      const paymentRows = credit.payments.map(p => [
        p.numero_cuota,
        formatDate(p.fecha_cuota),
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
                    <Label htmlFor="filter-lead">Lead</Label>
                    <Input
                      id="filter-lead"
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
                        <TableHead>ID Documento</TableHead>
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
                      {getCreditsForTab(tab.value).map((credit) => (
                        <TableRow key={credit.id}>
                          <TableCell><Badge variant="secondary">{credit.status}</Badge></TableCell>
                          <TableCell>{credit.documento_id || "-"}</TableCell>
                          <TableCell>{credit.client?.name || credit.lead?.name || "-"}</TableCell>
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
                          <TableCell>{credit.linea || "-"}</TableCell>
                          <TableCell>{formatDate(credit.primera_deduccion)}</TableCell>
                          <TableCell>{credit.garantia || "-"}</TableCell>
                          <TableCell>{formatDate(credit.fecha_culminacion_credito)}</TableCell>
                          <TableCell>{credit.proceso || "-"}</TableCell>
                          <TableCell>{credit.tasa_anual ? `${credit.tasa_anual}%` : "-"}</TableCell>
                          <TableCell>{credit.cuotas_atrasadas || 0}</TableCell>
                          <TableCell>{credit.deductora?.nombre || "-"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
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
                                onClick={() => { setStatusCredit(credit); setStatusForm({ status: credit.status || "Abierto" }); setIsStatusOpen(true); }}
                                title="Actualizar estado"
                                className="border-blue-500 text-blue-500 hover:bg-blue-50 hover:text-blue-600"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>

                              {/* Export visible button with dropdown (CSV / PDF) */}
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

                              {/* Remaining More menu (only Gestionar documentos) */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                  <DropdownMenuItem onClick={() => { setDocumentsCredit(credit); setIsDocumentsOpen(true); }}>
                                    Gestionar documentos
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
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
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="reference">Referencia</Label>
                <Input
                  id="reference"
                  placeholder="Ej: CRED-ABC12345"
                  value={formValues.reference}
                  onChange={e => setFormValues({ ...formValues, reference: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  placeholder="Crédito Hipotecario..."
                  value={formValues.title}
                  onChange={e => setFormValues({ ...formValues, title: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Estado</Label>
                <Select value={formValues.status} onValueChange={v => setFormValues({ ...formValues, status: v })}>
                  <SelectTrigger id="status"><SelectValue placeholder="Selecciona el estado" /></SelectTrigger>
                  <SelectContent>
                    {CREDIT_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoría</Label>
                <Select value={formValues.category} onValueChange={v => setFormValues({ ...formValues, category: v })}>
                  <SelectTrigger id="category"><SelectValue placeholder="Selecciona la categoría" /></SelectTrigger>
                  <SelectContent>
                    {CREDIT_CATEGORY_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="divisa">Divisa</Label>
                <Select value={formValues.divisa} onValueChange={v => setFormValues({ ...formValues, divisa: v })}>
                  <SelectTrigger id="divisa"><SelectValue placeholder="Selecciona la divisa" /></SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="monto">Monto</Label>
                <Input
                  id="monto"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formValues.monto_credito}
                  onChange={e => setFormValues({ ...formValues, monto_credito: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plazo">Plazo (Meses)</Label>
                <Select value={formValues.plazo} onValueChange={v => setFormValues({ ...formValues, plazo: v })}>
                  <SelectTrigger id="plazo"><SelectValue placeholder="Selecciona el plazo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="36">36 meses</SelectItem>
                    <SelectItem value="60">60 meses</SelectItem>
                    <SelectItem value="120">120 meses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 flex flex-col">
                <Label htmlFor="lead">Lead</Label>
                <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openCombobox}
                      className="justify-between font-normal w-full"
                    >
                      {formValues.leadId
                        ? leads.find((lead) => String(lead.id) === formValues.leadId)?.name
                        : "Selecciona un lead..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
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
                      {filteredLeads.length === 0 ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">No se encontraron leads.</div>
                      ) : (
                        filteredLeads.map((lead) => (
                          <div
                            key={lead.id}
                            className={`relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground ${String(lead.id) === formValues.leadId ? "bg-accent text-accent-foreground" : ""}`}
                            onClick={() => {
                              setFormValues({ ...formValues, leadId: String(lead.id) });
                              setOpenCombobox(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${String(lead.id) === formValues.leadId ? "opacity-100" : "opacity-0"
                                }`}
                            />
                            <div className="flex flex-col">
                              <span>{lead.name}</span>
                              {lead.cedula && <span className="text-xs text-muted-foreground">{lead.cedula}</span>}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="opportunity">Oportunidad (Opcional)</Label>
                <Select value={formValues.opportunityId} onValueChange={v => setFormValues({ ...formValues, opportunityId: v })}>
                  <SelectTrigger id="opportunity"><SelectValue placeholder="Selecciona una oportunidad" /></SelectTrigger>
                  <SelectContent>
                    {availableOpportunities.map(o => (
                      <SelectItem key={o.id} value={String(o.id)}>{o.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="assignedTo">Responsable</Label>
                <Input
                  id="assignedTo"
                  placeholder="Nombre del responsable"
                  value={formValues.assignedTo}
                  onChange={e => setFormValues({ ...formValues, assignedTo: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="openedAt">Fecha Apertura</Label>
                <Input
                  id="openedAt"
                  type="date"
                  value={formValues.openedAt}
                  onChange={e => setFormValues({ ...formValues, openedAt: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  className="min-h-[120px]"
                  placeholder="Describe el contexto del crédito..."
                  value={formValues.description}
                  onChange={e => setFormValues({ ...formValues, description: e.target.value })}
                />
              </div>
            </div>

            {currentLead ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Información del lead</CardTitle>
                  <CardDescription>Resumen del lead relacionado con este crédito.</CardDescription>
                </CardHeader>
                <CardContent className="text-sm">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <span className="font-medium">Nombre:</span> {currentLead.name}
                    </div>
                    <div>
                      <span className="font-medium">Correo:</span> {currentLead.email ?? "-"}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogState(null)}>Cancelar</Button>
              <Button type="submit" disabled={isSaving}>{isSaving ? "Guardando..." : "Guardar"}</Button>
            </DialogFooter>
          </form>
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
              <div><Label className="text-muted-foreground">Lead</Label><p>{detailCredit.client?.name}</p></div>
              <div><Label className="text-muted-foreground">Responsable</Label><p>{detailCredit.assigned_to}</p></div>
              <div className="col-span-2"><Label className="text-muted-foreground">Descripción</Label><p>{detailCredit.description}</p></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreditDocumentsDialog({ isOpen, credit, onClose, canDownloadDocuments }: any) {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<CreditDocument[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const fetchDocuments = useCallback(async () => {
    if (!credit) return;
    try {
      const res = await api.get(`/api/credits/${credit.id}/documents`);
      setDocuments(res.data);
    } catch (e) { console.error(e); }
  }, [credit]);

  useEffect(() => {
    if (isOpen) fetchDocuments();
  }, [isOpen, fetchDocuments]);

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!credit || !file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", name);
      formData.append("notes", notes);

      await api.post(`/api/credits/${credit.id}/documents`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      toast({ title: "Documento subido" });
      setName(""); setNotes(""); setFile(null);
      fetchDocuments();
    } catch (e) {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (docId: number) => {
    if (!credit) return;
    try {
      await api.delete(`/api/credits/${credit.id}/documents/${docId}`);
      fetchDocuments();
    } catch (e) { console.error(e); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Documentos</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <form onSubmit={handleUpload} className="space-y-4 border p-4 rounded">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Archivo</Label>
                <Input type="file" onChange={e => setFile(e.target.files?.[0] || null)} required />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Notas</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>
            <Button type="submit" disabled={isUploading}>{isUploading ? "Subiendo..." : "Subir Documento"}</Button>
          </form>

          <Table>
            <TableHeader>
              <TableRow><TableHead>Nombre</TableHead><TableHead>Notas</TableHead><TableHead>Acciones</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {documents.map(doc => (
                <TableRow key={doc.id}>
                  <TableCell>
                    {doc.url ? <a href={doc.url} target="_blank" className="text-primary hover:underline">{doc.name}</a> : doc.name}
                  </TableCell>
                  <TableCell>{doc.notes}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(doc.id)} className="text-destructive">Eliminar</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
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

    // Add listeners to window for mouseup/leave to handle dragging outside the container
    slider.addEventListener("mousedown", onMouseDown);
    slider.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    
    // We still keep mouseleave on slider or window? 
    // If we drag outside, we want to keep dragging usually, but let's stick to the requested logic first.
    // The requested logic had mouseleave on slider.
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
