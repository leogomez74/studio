"use client";

import React, { useState, useEffect, useMemo, useCallback, FormEvent, ChangeEvent } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Eye,
  PlusCircle,
  Loader2,
  Search,
  Filter,
  Calendar,
  Check,
  ChevronsUpDown
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import api from "@/lib/axios";
import { type Opportunity, type Lead, OPPORTUNITY_STATUSES, VERTICAL_OPTIONS, OPPORTUNITY_TYPES } from "@/lib/data";

// --- Constants & Helpers ---

const CASE_STATUS_OPTIONS = ["Abierto", "En Progreso", "En Espera", "Cerrado"] as const;
const CASE_CATEGORY_OPTIONS = ["Contenciosa", "No Contenciosa"] as const;

type SortableColumn =
  | "reference"
  | "lead"
  | "status"
  | "type"
  | "amount"
  | "expected_close_date"
  | "created_at";

interface OpportunityTableFilters {
  search: string;
  status: string;
  vertical: string;
  createdFrom: string;
  createdTo: string;
}

interface OpportunityFormValues {
  leadId: string;
  vertical: string;
  opportunityType: string;
  status: string;
  amount: string;
  expectedCloseDate: string;
  comments: string;
}

interface ConvertCaseFormValues {
  reference: string;
  status: string;
  category: string;
  progress: string;
  assignedTo: string;
  openedAt: string;
  description: string;
}

const normalizeOpportunityVertical = (vertical?: string | null) => {
  if (!vertical) return VERTICAL_OPTIONS[0];
  const found = VERTICAL_OPTIONS.find(v => v.toLowerCase() === vertical.toLowerCase());
  return found || VERTICAL_OPTIONS[0];
};

const formatOpportunityReference = (ref: string | number | null | undefined) => {
  if (!ref) return "-";
  return String(ref).padStart(6, '0');
};

const resolveEstimatedOpportunityAmount = (amount: any): number | null => {
  if (typeof amount === 'number') return amount;
  if (typeof amount === 'string') return parseFloat(amount);
  return null;
};

const formatAmount = (value: number | null | undefined): string => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    minimumFractionDigits: 2,
  }).format(value);
};

const formatAmountForExport = (amount: number | null | undefined): string => {
  const resolved = resolveEstimatedOpportunityAmount(amount);
  if (resolved == null) return "-";
  return new Intl.NumberFormat("es-CR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(resolved);
};

const formatDate = (dateString?: string | null): string => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-CR", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
};

const generateAmparoReference = () => {
    const year = new Date().getFullYear().toString().slice(-2);
    const random = Math.floor(Math.random() * 10000).toString().padStart(5, '0');
    return `${year}-000000-${random}-CO`;
};

// --- Main Component ---

export default function DealsPage() {
  const { toast } = useToast();
  
  // Data State
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<{ id: number; name: string }[]>([]); // <--- AGREGADO: Estado para usuarios
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);

  // Dialog States
  const [dialogState, setDialogState] = useState<"create" | "edit" | null>(null);
  const [dialogOpportunity, setDialogOpportunity] = useState<Opportunity | null>(null);
  const [formValues, setFormValues] = useState<OpportunityFormValues>({
    leadId: "",
    vertical: VERTICAL_OPTIONS[0],
    opportunityType: OPPORTUNITY_TYPES[0],
    status: OPPORTUNITY_STATUSES[0],
    amount: "",
    expectedCloseDate: "",
    comments: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [opportunityToDelete, setOpportunityToDelete] = useState<Opportunity | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailOpportunity, setDetailOpportunity] = useState<Opportunity | null>(null);

  const [isConvertCaseOpen, setIsConvertCaseOpen] = useState(false);
  const [convertCaseOpportunity, setConvertCaseOpportunity] = useState<Opportunity | null>(null);
  const [convertCaseValues, setConvertCaseValues] = useState<ConvertCaseFormValues>({
    reference: "",
    status: CASE_STATUS_OPTIONS[0],
    category: CASE_CATEGORY_OPTIONS[0],
    progress: "0",
    assignedTo: "",
    openedAt: "",
    description: "",
  });
  const [isConvertingCase, setIsConvertingCase] = useState(false);

  // Analisis Creation Dialog State
  const [isAnalisisDialogOpen, setIsAnalisisDialogOpen] = useState(false);
  const [analisisOpportunity, setAnalisisOpportunity] = useState<Opportunity | null>(null);

  // Analisis Form State
  const [analisisForm, setAnalisisForm] = useState({
    reference: "",
    title: "",
    status: "Activo",
    category: "Regular",
    monto_credito: "",
    leadId: "",
    opportunityId: "",
    assignedTo: "",
    openedAt: new Date().toISOString().split('T')[0],
    description: "",
    divisa: "CRC",
    plazo: "36",
  });

  // Combobox state
  const [openVertical, setOpenVertical] = useState(false);
  const [searchVertical, setSearchVertical] = useState("");
  const [openFilterVertical, setOpenFilterVertical] = useState(false);
  const [searchFilterVertical, setSearchFilterVertical] = useState("");

  // Filters & Sort
  const [filters, setFilters] = useState<OpportunityTableFilters>({
    search: "",
    status: "todos",
    vertical: "todos",
    createdFrom: "",
    createdTo: "",
  });
  const [sortConfig, setSortConfig] = useState<{ column: SortableColumn; direction: "asc" | "desc" }>(
    () => ({ column: "created_at", direction: "desc" })
  );

  const defaultStatus = useMemo(() => OPPORTUNITY_STATUSES[0], []);

  // --- Fetching ---

  const fetchOpportunities = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/api/opportunities');
      const data = response.data.data || response.data;
      
      setOpportunities(Array.isArray(data) ? data.map((item: any) => ({
          ...item,
          vertical: normalizeOpportunityVertical(item.vertical),
          opportunity_type: item.opportunity_type || OPPORTUNITY_TYPES[0],
          amount: resolveEstimatedOpportunityAmount(item.amount),
      })) : []);
    } catch (error) {
      console.error("Error fetching opportunities:", error);
      toast({ title: "Error", description: "No se pudieron cargar las oportunidades.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const fetchLeads = useCallback(async () => {
    try {
      setIsLoadingLeads(true);
      const response = await api.get('/api/leads');
      const data = response.data.data || response.data;
      setLeads(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching leads:", error);
    } finally {
      setIsLoadingLeads(false);
    }
  }, []);

  // AGREGADO: Fetch Users para el select de responsables
  const fetchUsers = useCallback(async () => {
    try {
      const response = await api.get('/api/agents');
      setUsers(response.data);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  }, []);

  useEffect(() => {
    fetchOpportunities();
    fetchLeads();
    fetchUsers(); // <--- AGREGADO
  }, [fetchOpportunities, fetchLeads, fetchUsers]);

  // --- Form Logic ---

  useEffect(() => {
    if (dialogState === "create" && formValues.leadId === "" && leads.length > 0) {
      setFormValues((prev) => ({
        ...prev,
        leadId: String(leads[0].id),
      }));
    }
  }, [dialogState, formValues.leadId, leads]);

  const resetForm = useCallback((opportunity?: Opportunity | null) => {
    const derivedVertical = opportunity ? normalizeOpportunityVertical(opportunity.vertical) : VERTICAL_OPTIONS[0];
    setFormValues({
      leadId: opportunity?.lead?.id ? String(opportunity.lead.id) : "",
      vertical: derivedVertical,
      opportunityType: opportunity?.opportunity_type || OPPORTUNITY_TYPES[0],
      status: opportunity?.status ?? defaultStatus,
      amount: opportunity?.amount != null ? String(opportunity.amount) : "",
      expectedCloseDate: opportunity?.expected_close_date ?? "",
      comments: opportunity?.comments ?? "",
    });
  }, [defaultStatus]);

  const resetConvertCaseForm = useCallback(() => {
    setConvertCaseValues({
      reference: "",
      status: CASE_STATUS_OPTIONS[0],
      category: CASE_CATEGORY_OPTIONS[0],
      progress: "0",
      assignedTo: "",
      openedAt: "",
      description: "",
    });
  }, []);

  const closeDialog = useCallback(() => {
    setDialogState(null);
    setDialogOpportunity(null);
    resetForm();
  }, [resetForm]);
  
  const openEditDialog = useCallback((opportunity: Opportunity) => {
    setDialogOpportunity(opportunity);
    resetForm(opportunity);
    setDialogState("edit");
  }, [resetForm]);

  const handleFormField = useCallback(
    (field: keyof OpportunityFormValues) =>
      (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const value = event.target.value;
        setFormValues((prev) => ({ ...prev, [field]: value }));
      },
    []
  );

  const handleSaveOpportunity = useCallback(async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setIsSaving(true);

      try {
        const selectedLead = leads.find(l => String(l.id) === formValues.leadId);
        if (!selectedLead) {
            toast({ title: "Error", description: "Lead no válido.", variant: "destructive" });
            setIsSaving(false);
            return;
        }

        const body: any = {
            lead_cedula: selectedLead.cedula,
            vertical: formValues.vertical,
            opportunity_type: formValues.opportunityType,
            status: formValues.status,
            amount: parseFloat(formValues.amount) || 0,
            expected_close_date: formValues.expectedCloseDate || null,
            comments: formValues.comments,
            assigned_to_id: selectedLead.assigned_to_id
        };

        if (dialogState === "edit" && dialogOpportunity) {
            await api.put(`/api/opportunities/${dialogOpportunity.id}`, body);
            toast({ title: "Actualizado", description: "Oportunidad actualizada correctamente." });
        } else {
            await api.post('/api/opportunities', body);
            toast({ title: "Creado", description: "Oportunidad creada correctamente." });
        }

        closeDialog();
        fetchOpportunities();
      } catch (error) {
          console.error("Error saving:", error);
          toast({ title: "Error", description: "No se pudo guardar la oportunidad.", variant: "destructive" });
      } finally {
          setIsSaving(false);
      }
  }, [dialogState, dialogOpportunity, formValues, leads, closeDialog, fetchOpportunities, toast]);

  // --- Delete Logic ---

  const openDeleteDialog = useCallback((opportunity: Opportunity) => {
    setOpportunityToDelete(opportunity);
    setIsDeleteOpen(true);
  }, []);

  const closeDeleteDialog = useCallback(() => {
    setIsDeleteOpen(false);
    setOpportunityToDelete(null);
  }, []);

  const handleDeleteOpportunity = useCallback(async () => {
      if (!opportunityToDelete) return;
      setIsDeleting(true);
      try {
          await api.delete(`/api/opportunities/${opportunityToDelete.id}`);
          toast({ title: "Eliminado", description: "Oportunidad eliminada." });
          closeDeleteDialog();
          fetchOpportunities();
      } catch (error) {
          toast({ title: "Error", description: "No se pudo eliminar.", variant: "destructive" });
      } finally {
          setIsDeleting(false);
      }
  }, [opportunityToDelete, closeDeleteDialog, fetchOpportunities, toast]);

  // --- Detail Logic ---

  const openDetailDialog = useCallback((opportunity: Opportunity) => {
    setDetailOpportunity(opportunity);
    setIsDetailOpen(true);
  }, []);

  const closeDetailDialog = useCallback(() => {
    setIsDetailOpen(false);
    setDetailOpportunity(null);
  }, []);

  // --- Convert Case Logic ---

  const openConvertCaseDialog = useCallback((opportunity: Opportunity) => {
    setConvertCaseOpportunity(opportunity);
    setConvertCaseValues({
      reference: generateAmparoReference(),
      status: CASE_STATUS_OPTIONS[0],
      category: CASE_CATEGORY_OPTIONS[0],
      progress: "0",
      assignedTo: "",
      openedAt: new Date().toISOString().slice(0, 10),
      description: opportunity.comments ?? "",
    });
    setIsConvertCaseOpen(true);
  }, []);

  const closeConvertCaseDialog = useCallback(() => {
    setIsConvertCaseOpen(false);
    setConvertCaseOpportunity(null);
    setIsConvertingCase(false);
    resetConvertCaseForm();
  }, [resetConvertCaseForm]);

  const handleConvertCaseField = useCallback(
    (field: keyof ConvertCaseFormValues) =>
      (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const value = event.target.value;
        setConvertCaseValues((prev) => ({ ...prev, [field]: value }));
      },
    []
  );

  const handleConvertCaseSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!convertCaseOpportunity) return;
      setIsConvertingCase(true);

      try {
          const body = {
              reference: convertCaseValues.reference,
              status: convertCaseValues.status,
              category: convertCaseValues.category,
              progress: parseInt(convertCaseValues.progress),
              opened_at: convertCaseValues.openedAt,
              description: convertCaseValues.description,
              assigned_to: convertCaseValues.assignedTo,
              opportunity_id: convertCaseOpportunity.id
          };

          await api.post(`/api/opportunities/${convertCaseOpportunity.id}/cases`, body);
          toast({ title: "Caso creado", description: "Oportunidad convertida a caso." });
          closeConvertCaseDialog();
          fetchOpportunities();
      } catch (error) {
          console.error("Error converting:", error);
          toast({ title: "Error", description: "No se pudo convertir a caso.", variant: "destructive" });
      } finally {
          setIsConvertingCase(false);
      }
  }, [convertCaseOpportunity, convertCaseValues, closeConvertCaseDialog, fetchOpportunities, toast]);


  // --- Analisis Logic ---

  const handleOpenAnalisisDialog = (opportunity: Opportunity) => {
    setAnalisisOpportunity(opportunity);
    setAnalisisForm({
      reference: `ANAL-${opportunity.id}`,
      title: opportunity.opportunity_type || "",
      status: "Activo",
      category: "Regular",
      monto_credito: opportunity.amount ? String(opportunity.amount) : "",
      leadId: opportunity.lead?.id ? String(opportunity.lead.id) : "",
      opportunityId: String(opportunity.id),
      assignedTo: "",
      openedAt: new Date().toISOString().split('T')[0],
      description: opportunity.comments || "",
      divisa: "CRC",
      plazo: "36",
    });
    setIsAnalisisDialogOpen(true);
  };

  const handleAnalisisFormChange = (field: string, value: string) => {
    setAnalisisForm(prev => ({ ...prev, [field]: value }));
  };

  const handleAnalisisSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/analisis', {
        ...analisisForm,
        monto_credito: parseFloat(analisisForm.monto_credito) || 0,
        lead_id: parseInt(analisisForm.leadId),
        opportunity_id: parseInt(analisisForm.opportunityId),
        plazo: parseInt(analisisForm.plazo) || 36,
      });
      toast({ title: "Éxito", description: "Análisis creado correctamente." });
      setIsAnalisisDialogOpen(false);
      fetchOpportunities();
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.message || error.message, variant: "destructive" });
    }
  };

  // Analisis State for Button
  const ANALISIS_STATES = ["preAnalisis", "Analisis", "postAnalisis"] as const;
  type AnalisisState = typeof ANALISIS_STATES[number];

  const [changeState, setChangeState] = useState<AnalisisState>("preAnalisis");

  const getAnalisisButtonProps = (state: AnalisisState) => {
    switch (state) {
      case "preAnalisis":
        return { label: "Iniciar Pre-Análisis", color: "bg-indigo-600", icon: <PlusCircle className="h-4 w-4" /> };
      case "Analisis":
        return { label: "Realizar Análisis", color: "bg-blue-600", icon: <Check className="h-4 w-4" /> };
      case "postAnalisis":
        return { label: "Finalizar y Crear Análisis", color: "bg-green-600", icon: <Check className="h-4 w-4" /> };
      default:
        return { label: "Iniciar Pre-Análisis", color: "bg-indigo-600", icon: <PlusCircle className="h-4 w-4" />  };
    }
  };

  const handleAnalisisButtonClick = (opportunity: Opportunity) => {
    if (changeState === "preAnalisis") {
      setChangeState("Analisis");
    } else if (changeState === "Analisis") {
      setChangeState("postAnalisis");
    } else if (changeState === "postAnalisis") {
      // Aquí se llamaría a AnalisisController::create (solo lógica, no implementación)
      // Por ejemplo: createAnalisis(opportunity)
      setChangeState("preAnalisis"); // Reset or keep as needed
    }
  };

  // --- Table Logic ---

  const handleFilterChange = useCallback(
    <K extends keyof OpportunityTableFilters>(field: K, value: OpportunityTableFilters[K]) => {
      setFilters((previous) => ({ ...previous, [field]: value }));
    },
    []
  );

  const handleClearFilters = useCallback(() => {
    setFilters({ search: "", status: "todos", vertical: "todos", createdFrom: "", createdTo: "" });
  }, []);

  const handleSort = useCallback((column: SortableColumn) => {
    setSortConfig((previous) => {
      if (previous.column === column) {
        return { column, direction: previous.direction === "asc" ? "desc" : "asc" };
      }
      return { column, direction: "asc" };
    });
  }, []);

  const getSortableValue = useCallback((opportunity: Opportunity, column: SortableColumn): number | string => {
    switch (column) {
      case "reference": return opportunity.id ?? 0;
      case "lead": return (opportunity.lead?.name || opportunity.lead?.email || "").toString().toLowerCase();
      case "status": return (opportunity.status ?? "Abierta").toLowerCase();
      case "type": return (opportunity.opportunity_type ?? "").toLowerCase();
      case "amount": return resolveEstimatedOpportunityAmount(opportunity.amount) ?? 0;
      case "expected_close_date": return opportunity.expected_close_date ? new Date(opportunity.expected_close_date).getTime() : 0;
      case "created_at": return opportunity.created_at ? new Date(opportunity.created_at).getTime() : 0;
      default: return "";
    }
  }, []);

  const visibleOpportunities = useMemo(() => {
    const searchTerm = filters.search.trim().toLowerCase();
    const statusFilter = filters.status.toLowerCase();
    const verticalFilter = filters.vertical.toLowerCase();
    const createdFromTime = filters.createdFrom ? new Date(filters.createdFrom).getTime() : null;
    const createdToTime = filters.createdTo ? new Date(filters.createdTo).getTime() : null;

    const filtered = opportunities.filter((opportunity) => {
      const referenceValue = String(opportunity.id).toLowerCase();
      const leadName = opportunity.lead?.name?.toLowerCase() ?? "";
      const leadEmail = opportunity.lead?.email?.toLowerCase() ?? "";

      const matchesSearch = searchTerm
        ? [referenceValue, leadName, leadEmail].some((value) => value.includes(searchTerm))
        : true;

      if (!matchesSearch) return false;

      const normalizedStatus = (opportunity.status ?? "Abierta").toLowerCase();
      if (statusFilter !== "todos" && normalizedStatus !== statusFilter) return false;

      const normalizedVertical = opportunity.vertical?.toLowerCase() || "";
      if (verticalFilter !== "todos" && normalizedVertical !== verticalFilter) return false;

      const createdAtTime = opportunity.created_at ? new Date(opportunity.created_at).getTime() : null;
      if (createdFromTime && (!createdAtTime || createdAtTime < createdFromTime)) return false;
      if (createdToTime && (!createdAtTime || createdAtTime > createdToTime)) return false;

      return true;
    });

    return filtered.sort((a, b) => {
      const aValue = getSortableValue(a, sortConfig.column);
      const bValue = getSortableValue(b, sortConfig.column);
      const multiplier = sortConfig.direction === "asc" ? 1 : -1;

      if (typeof aValue === "number" && typeof bValue === "number") {
        return (aValue - bValue) * multiplier;
      }
      return String(aValue ?? "").localeCompare(String(bValue ?? "")) * multiplier;
    });
  }, [filters, getSortableValue, opportunities, sortConfig]);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.search.trim().length > 0 ||
      filters.status !== "todos" ||
      filters.vertical !== "todos" ||
      filters.createdFrom.length > 0 ||
      filters.createdTo.length > 0
    );
  }, [filters]);

  const getAriaSort = useCallback(
    (column: SortableColumn): "ascending" | "descending" | "none" => {
      if (sortConfig.column !== column) return "none";
      return sortConfig.direction === "asc" ? "ascending" : "descending";
    },
    [sortConfig]
  );

  const renderSortIcon = useCallback(
    (column: SortableColumn) => {
      if (sortConfig.column !== column) {
        return <ArrowUpDown className="ml-1 h-4 w-4 text-muted-foreground" aria-hidden="true" />;
      }
      return sortConfig.direction === "asc" ? (
        <ArrowUp className="ml-1 h-4 w-4 text-primary" aria-hidden="true" />
      ) : (
        <ArrowDown className="ml-1 h-4 w-4 text-primary" aria-hidden="true" />
      );
    },
    [sortConfig]
  );

  // --- Export ---

  const handleExportSinglePDF = useCallback((opportunity: Opportunity) => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(12);
    doc.text(`Detalle de Oportunidad #${opportunity.id}`, 14, 16);

    autoTable(doc, {
      startY: 22,
      head: [["Referencia", "Lead", "Correo", "Estado", "Tipo", "Monto", "Cierre esperado", "Creada"]],
      body: [[
        formatOpportunityReference(opportunity.id),
        opportunity.lead?.name ?? "Lead desconocido",
        opportunity.lead?.email ?? "Sin correo",
        opportunity.status ?? "Abierta",
        opportunity.opportunity_type ?? "Sin tipo",
        formatAmountForExport(opportunity.amount),
        formatDate(opportunity.expected_close_date),
        formatDate(opportunity.created_at),
      ]],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [220, 53, 69] },
    });
    doc.save(`oportunidad_${opportunity.id}.pdf`);
  }, []);

  const handleExportCSV = useCallback(() => {
    if (visibleOpportunities.length === 0) {
      toast({ title: "Sin datos", description: "No hay datos para exportar.", variant: "destructive" });
      return;
    }
    const headers = ["Referencia", "Lead", "Correo", "Estado", "Tipo", "Monto", "Cierre esperado", "Creada"];
    const rows = visibleOpportunities.map((opportunity) => [
      formatOpportunityReference(opportunity.id),
      opportunity.lead?.name ?? "Lead desconocido",
      opportunity.lead?.email ?? "Sin correo",
      opportunity.status ?? "Abierta",
      opportunity.opportunity_type ?? "Sin tipo",
      formatAmountForExport(opportunity.amount),
      opportunity.expected_close_date ?? "",
      opportunity.created_at ?? "",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `oportunidades_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [toast, visibleOpportunities]);

  const handleExportPDF = useCallback(() => {
    if (visibleOpportunities.length === 0) {
      toast({ title: "Sin datos", description: "No hay datos para exportar.", variant: "destructive" });
      return;
    }
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(12);
    doc.text("Reporte de oportunidades", 14, 16);

    autoTable(doc, {
      startY: 22,
      head: [["Referencia", "Lead", "Correo", "Estado", "Tipo", "Monto", "Cierre esperado", "Creada"]],
      body: visibleOpportunities.map((opportunity) => [
        formatOpportunityReference(opportunity.id),
        opportunity.lead?.name ?? "Lead desconocido",
        opportunity.lead?.email ?? "Sin correo",
        opportunity.status ?? "Abierta",
        opportunity.opportunity_type ?? "Sin tipo",
        formatAmountForExport(opportunity.amount),
        formatDate(opportunity.expected_close_date),
        formatDate(opportunity.created_at),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [220, 53, 69] },
    });
    doc.save(`oportunidades_${Date.now()}.pdf`);
  }, [toast, visibleOpportunities]);

  // --- Render ---

  const dialogTitle = dialogState === "edit" ? "Editar oportunidad" : "Crear oportunidad";
  const dialogDescription = dialogState === "edit" ? "Actualiza la información de la oportunidad." : "Registra una nueva oportunidad.";

  const availableLeadOptions = useMemo(() => {
    return leads.map((lead) => ({
      value: String(lead.id),
      label: `${lead.name}${lead.email ? ` · ${lead.email}` : ""}`,
    }));
  }, [leads]);

  const filteredVerticals = useMemo(() => {
    if (!searchVertical) return VERTICAL_OPTIONS;
    return VERTICAL_OPTIONS.filter((v) => v.toLowerCase().includes(searchVertical.toLowerCase()));
  }, [searchVertical]);

  const filteredFilterVerticals = useMemo(() => {
    if (!searchFilterVertical) return VERTICAL_OPTIONS;
    return VERTICAL_OPTIONS.filter((v) => v.toLowerCase().includes(searchFilterVertical.toLowerCase()));
  }, [searchFilterVertical]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <CardTitle>Oportunidades</CardTitle>
            <CardDescription>Gestiona las oportunidades asociadas a tus leads.</CardDescription>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Desde</Label>
                <Input type="date" value={filters.createdFrom} onChange={(e) => handleFilterChange("createdFrom", e.target.value)} className="h-10 w-36" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hasta</Label>
                <Input type="date" value={filters.createdTo} onChange={(e) => handleFilterChange("createdTo", e.target.value)} className="h-10 w-36" />
              </div>
            </div>
            <Button variant="outline" onClick={handleClearFilters} disabled={!hasActiveFilters}>Limpiar filtros</Button>
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
        <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Buscar</Label>
                <Input placeholder="Referencia, lead o título" value={filters.search} onChange={(e) => handleFilterChange("search", e.target.value)} />
            </div>
            <div className="space-y-1">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado</Label>
                <Select value={filters.status} onValueChange={(value) => handleFilterChange("status", value)}>
                    <SelectTrigger><SelectValue placeholder="Todos los estados" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todos">Todos los estados</SelectItem>
                        {OPPORTUNITY_STATUSES.map((status) => (
                            <SelectItem key={status} value={status.toLowerCase()}>{status}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-1">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vertical</Label>
                <Popover open={openFilterVertical} onOpenChange={setOpenFilterVertical} modal={true}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openFilterVertical}
                      className="w-full justify-between"
                    >
                      {filters.vertical !== "todos"
                        ? VERTICAL_OPTIONS.find((v) => v === filters.vertical)
                        : "Todas las verticales"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-0 z-[200]">
                    <div className="p-2 border-b">
                        <Input 
                            placeholder="Buscar vertical..." 
                            value={searchFilterVertical} 
                            onChange={(e) => setSearchFilterVertical(e.target.value)}
                            className="h-8"
                        />
                    </div>
                    <div className="max-h-[300px] overflow-y-auto p-1">
                        <div
                            className={`relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground ${filters.vertical === "todos" ? "bg-accent text-accent-foreground" : ""}`}
                            onClick={() => {
                                handleFilterChange("vertical", "todos");
                                setOpenFilterVertical(false);
                                setSearchFilterVertical("");
                            }}
                        >
                            <Check
                                className={`mr-2 h-4 w-4 ${
                                    filters.vertical === "todos" ? "opacity-100" : "opacity-0"
                                }`}
                            />
                            Todas las verticales
                        </div>
                        {filteredFilterVerticals.length === 0 ? (
                            <div className="py-6 text-center text-sm text-muted-foreground">No se encontraron resultados.</div>
                        ) : (
                            filteredFilterVerticals.map((vertical) => (
                                <div
                                    key={vertical}
                                    className={`relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground ${filters.vertical === vertical ? "bg-accent text-accent-foreground" : ""}`}
                                    onClick={() => {
                                        handleFilterChange("vertical", vertical);
                                        setOpenFilterVertical(false);
                                        setSearchFilterVertical("");
                                    }}
                                >
                                    <Check
                                        className={`mr-2 h-4 w-4 ${
                                            filters.vertical === vertical ? "opacity-100" : "opacity-0"
                                        }`}
                                    />
                                    {vertical}
                                </div>
                            ))
                        )}
                    </div>
                  </PopoverContent>
                </Popover>
            </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead aria-sort={getAriaSort("reference")}>
                <button className="flex w-full items-center justify-between gap-1 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground" onClick={() => handleSort("reference")}>
                  Número {renderSortIcon("reference")}
                </button>
              </TableHead>
              <TableHead aria-sort={getAriaSort("lead")}>
                <button className="flex w-full items-center justify-between gap-1 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground" onClick={() => handleSort("lead")}>
                  Lead {renderSortIcon("lead")}
                </button>
              </TableHead>
              <TableHead aria-sort={getAriaSort("status")}>
                <button className="flex w-full items-center justify-between gap-1 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground" onClick={() => handleSort("status")}>
                  Estado {renderSortIcon("status")}
                </button>
              </TableHead>
              <TableHead aria-sort={getAriaSort("type")}>
                <button className="flex w-full items-center justify-between gap-1 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground" onClick={() => handleSort("type")}>
                  Tipo {renderSortIcon("type")}
                </button>
              </TableHead>
              <TableHead aria-sort={getAriaSort("amount")}>
                <button className="flex w-full items-center justify-between gap-1 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground" onClick={() => handleSort("amount")}>
                  Monto {renderSortIcon("amount")}
                </button>
              </TableHead>
              <TableHead className="hidden md:table-cell" aria-sort={getAriaSort("expected_close_date")}>
                <button className="flex w-full items-center justify-between gap-1 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground" onClick={() => handleSort("expected_close_date")}>
                  Cierre {renderSortIcon("expected_close_date")}
                </button>
              </TableHead>
              <TableHead className="hidden md:table-cell" aria-sort={getAriaSort("created_at")}>
                <button className="flex w-full items-center justify-between gap-1 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground" onClick={() => handleSort("created_at")}>
                  Creado {renderSortIcon("created_at")}
                </button>
              </TableHead>
              <TableHead><span className="sr-only">Acciones</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
            ) : visibleOpportunities.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">No hay oportunidades.</TableCell></TableRow>
            ) : (
              visibleOpportunities.map((opportunity) => {
                const badgeVariant = opportunity.status?.toLowerCase() === "ganada" ? "default" : "secondary";
                return (
                  <TableRow key={opportunity.id}>
                    <TableCell className="font-mono text-sm">
                        <div className="flex flex-col">
                            <Link href={`/dashboard/oportunidades/${opportunity.id}`} className="font-semibold text-primary hover:underline">
                                #{opportunity.id}
                            </Link>
                            <span className="text-xs text-muted-foreground">{opportunity.opportunity_type || "Sin tipo"}</span>
                        </div>
                    </TableCell>
                    <TableCell>
                        <div className="flex flex-col">
                            <span>{opportunity.lead?.name || "Desconocido"}</span>
                            <span className="text-xs text-muted-foreground">{opportunity.lead?.email || "-"}</span>
                        </div>
                    </TableCell>
                    <TableCell><Badge variant="default" className="bg-slate-900 hover:bg-slate-800">{opportunity.status || "Abierta"}</Badge></TableCell>
                    <TableCell>{opportunity.opportunity_type || "-"}</TableCell>
                    <TableCell>{formatAmount(resolveEstimatedOpportunityAmount(opportunity.amount))}</TableCell>
                    <TableCell className="hidden md:table-cell">{formatDate(opportunity.expected_close_date)}</TableCell>
                    <TableCell className="hidden md:table-cell">{formatDate(opportunity.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Link href={`/dashboard/oportunidades/${opportunity.id}`} className="inline-flex">
                                <Button size="icon" className="h-9 w-9 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 border-0">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent>Ver detalle</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" className="h-9 w-9 rounded-md bg-blue-900 text-white hover:bg-blue-800 border-0" onClick={() => handleExportSinglePDF(opportunity)}>
                                <Download className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Exportar PDF</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                className={`h-9 w-9 rounded-md text-white border-0 ${getAnalisisButtonProps(changeState).color}`}
                                onClick={() => handleAnalisisButtonClick(opportunity)}
                              >
                                {getAnalisisButtonProps(changeState).icon}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{getAnalisisButtonProps(changeState).label}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogState !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSaveOpportunity}>
            <div className="space-y-2">
              <Label>Lead asociado</Label>
              <Select value={formValues.leadId} onValueChange={(val) => setFormValues(prev => ({ ...prev, leadId: val }))} disabled={isLoadingLeads}>
                <SelectTrigger><SelectValue placeholder={isLoadingLeads ? "Cargando..." : "Selecciona un lead"} /></SelectTrigger>
                <SelectContent>
                    {availableLeadOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
                <Label>Vertical</Label>
                <Popover open={openVertical} onOpenChange={setOpenVertical} modal={true}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openVertical}
                      className="w-full justify-between"
                    >
                      {formValues.vertical
                        ? VERTICAL_OPTIONS.find((v) => v === formValues.vertical)
                        : "Seleccionar vertical..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0 z-[200]">
                    <div className="p-2 border-b">
                        <Input 
                            placeholder="Buscar vertical..." 
                            value={searchVertical} 
                            onChange={(e) => setSearchVertical(e.target.value)}
                            className="h-8"
                        />
                    </div>
                    <div className="max-h-[300px] overflow-y-auto p-1">
                        {filteredVerticals.length === 0 ? (
                            <div className="py-6 text-center text-sm text-muted-foreground">No se encontraron resultados.</div>
                        ) : (
                            filteredVerticals.map((vertical) => (
                                <div
                                    key={vertical}
                                    className={`relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ${formValues.vertical === vertical ? "bg-accent text-accent-foreground" : ""}`}
                                    onClick={() => {
                                        setFormValues(prev => ({ ...prev, vertical: vertical }));
                                        setOpenVertical(false);
                                        setSearchVertical("");
                                    }}
                                >
                                    <Check
                                        className={`mr-2 h-4 w-4 ${
                                            formValues.vertical === vertical ? "opacity-100" : "opacity-0"
                                        }`}
                                    />
                                    {vertical}
                                </div>
                            ))
                        )}
                    </div>
                  </PopoverContent>
                </Popover>
            </div>
            <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={formValues.opportunityType} onValueChange={(val) => setFormValues(prev => ({ ...prev, opportunityType: val }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {OPPORTUNITY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <Label>Estado</Label>
                    <Select value={formValues.status} onValueChange={(val) => setFormValues(prev => ({ ...prev, status: val }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {OPPORTUNITY_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Monto</Label>
                    <Input type="number" value={formValues.amount} onChange={handleFormField("amount")} placeholder="0.00" />
                </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <Label>Cierre esperado</Label>
                    <Input type="date" value={formValues.expectedCloseDate} onChange={handleFormField("expectedCloseDate")} />
                </div>
                <div className="space-y-2 md:col-span-2">
                    <Label>Comentarios</Label>
                    <Textarea value={formValues.comments} onChange={handleFormField("comments")} rows={3} />
                </div>
            </div>
            <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>Cancelar</Button>
                <Button type="submit" disabled={isSaving}>{isSaving ? "Guardando..." : "Guardar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Detalle de Oportunidad</DialogTitle>
                <DialogDescription>Información completa del registro.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-4">
                    <div><p className="font-medium text-muted-foreground">ID</p><p>#{detailOpportunity?.id}</p></div>
                    <div><p className="font-medium text-muted-foreground">Lead</p><p>{detailOpportunity?.lead?.name}</p></div>
                    <div><p className="font-medium text-muted-foreground">Estado</p><p>{detailOpportunity?.status}</p></div>
                    <div><p className="font-medium text-muted-foreground">Monto</p><p>{formatAmount(resolveEstimatedOpportunityAmount(detailOpportunity?.amount))}</p></div>
                    <div><p className="font-medium text-muted-foreground">Vertical</p><p>{detailOpportunity?.vertical}</p></div>
                    <div><p className="font-medium text-muted-foreground">Tipo</p><p>{detailOpportunity?.opportunity_type}</p></div>
                    <div className="col-span-2"><p className="font-medium text-muted-foreground">Comentarios</p><p>{detailOpportunity?.comments || "Sin comentarios"}</p></div>
                </div>
            </div>
        </DialogContent>
      </Dialog>

      {/* Convert Case Dialog */}
      <Dialog open={isConvertCaseOpen} onOpenChange={(open) => !open && closeConvertCaseDialog()}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Convertir a Caso</DialogTitle>
                <DialogDescription>Crea un nuevo caso legal a partir de esta oportunidad.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleConvertCaseSubmit} className="space-y-4">
                <div className="space-y-2">
                    <Label>Referencia</Label>
                    <Input value={convertCaseValues.reference} onChange={handleConvertCaseField("reference")} required />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label>Estado</Label>
                        <Select value={convertCaseValues.status} onValueChange={(val) => setConvertCaseValues(prev => ({ ...prev, status: val }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{CASE_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Categoría</Label>
                        <Select value={convertCaseValues.category} onValueChange={(val) => setConvertCaseValues(prev => ({ ...prev, category: val }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{CASE_CATEGORY_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>Descripción</Label>
                    <Textarea value={convertCaseValues.description} onChange={handleConvertCaseField("description")} />
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={closeConvertCaseDialog}>Cancelar</Button>
                    <Button type="submit" disabled={isConvertingCase}>{isConvertingCase ? "Creando..." : "Crear Caso"}</Button>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>

      {/* Analisis Creation Dialog */}
      <Dialog open={isAnalisisDialogOpen} onOpenChange={setIsAnalisisDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Nuevo Análisis</DialogTitle>
            <DialogDescription>Completa la información del análisis.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAnalisisSubmit} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="reference">Referencia</Label>
                <Input id="reference" value={analisisForm.reference} onChange={e => handleAnalisisFormChange('reference', e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Título</Label>
                <Input id="title" value={analisisForm.title} onChange={e => handleAnalisisFormChange('title', e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Estado</Label>
                <Select value={analisisForm.status} onValueChange={v => handleAnalisisFormChange('status', v)}>
                  <SelectTrigger id="status"><SelectValue placeholder="Selecciona el estado" /></SelectTrigger>
                  <SelectContent>
                    {["Activo", "Mora", "Cerrado", "Legal"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoría</Label>
                <Select value={analisisForm.category} onValueChange={v => handleAnalisisFormChange('category', v)}>
                  <SelectTrigger id="category"><SelectValue placeholder="Selecciona la categoría" /></SelectTrigger>
                  <SelectContent>
                    {["Regular", "Micro-crédito", "Hipotecario", "Personal"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="divisa">Divisa</Label>
                <Select value={analisisForm.divisa} onValueChange={v => handleAnalisisFormChange('divisa', v)}>
                  <SelectTrigger id="divisa"><SelectValue placeholder="Selecciona la divisa" /></SelectTrigger>
                  <SelectContent>
                    {["CRC", "USD", "EUR", "GBP"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="monto">Monto</Label>
                <Input id="monto" type="number" step="0.01" min="0" value={analisisForm.monto_credito} onChange={e => handleAnalisisFormChange('monto_credito', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plazo">Plazo (Meses)</Label>
                <Select value={analisisForm.plazo} onValueChange={v => handleAnalisisFormChange('plazo', v)}>
                  <SelectTrigger id="plazo"><SelectValue placeholder="Selecciona el plazo" /></SelectTrigger>
                  <SelectContent>
                    {["36", "60", "120"].map(p => <SelectItem key={p} value={p}>{p} meses</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {/* CAMBIO APLICADO: Select de Responsable */}
              <div className="space-y-2">
                <Label htmlFor="assignedTo">Responsable</Label>
                <Select value={analisisForm.assignedTo} onValueChange={v => handleAnalisisFormChange('assignedTo', v)}>
                  <SelectTrigger id="assignedTo"><SelectValue placeholder="Selecciona un responsable" /></SelectTrigger>
                  <SelectContent>
                    {users.map(u => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="openedAt">Fecha Apertura</Label>
                <Input id="openedAt" type="date" value={analisisForm.openedAt} onChange={e => handleAnalisisFormChange('openedAt', e.target.value)} />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea id="description" value={analisisForm.description} onChange={e => handleAnalisisFormChange('description', e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAnalisisDialogOpen(false)}>Cancelar</Button>
              <Button type="submit">Guardar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Alert */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar oportunidad?</AlertDialogTitle>
                <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteOpportunity} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {isDeleting ? "Eliminando..." : "Eliminar"}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}