"use client";

import React, { useState, useEffect, useMemo, useCallback, FormEvent, ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Checkbox } from "@/components/ui/checkbox";
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

import { useDebounce } from "@/hooks/use-debounce";
import api from "@/lib/axios";
import {
  DEDUCCIONES_TIPOS,
  EditableDeduccion,
} from "@/lib/analisis";
import { type Opportunity, type Lead, OPPORTUNITY_STATUSES, OPPORTUNITY_TYPES } from "@/lib/data";

const opportunitySchema = z.object({
  leadId: z.string().min(1, "Debes seleccionar un lead"),
  vertical: z.string(),
  opportunityType: z.string(),
  status: z.string(),
  amount: z.coerce.number().min(0, "El monto debe ser positivo"),
  expectedCloseDate: z.string().optional().refine((date) => {
    if (!date) return true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(date) >= today;
  }, { message: "La fecha no puede ser anterior a hoy" }),
  comments: z.string().optional(),
});

type OpportunityFormValues = z.infer<typeof opportunitySchema>;

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

interface ConvertCaseFormValues {
  reference: string;
  status: string;
  category: string;
  progress: string;
  assignedTo: string;
  openedAt: string;
  description: string;
}

const normalizeOpportunityVertical = (vertical?: string | null, instituciones?: Array<{ id: number; nombre: string; activa: boolean }>) => {
  if (!vertical || !instituciones || instituciones.length === 0) return "";
  const found = instituciones.find(inst => inst.nombre.toLowerCase() === vertical.toLowerCase());
  return found ? found.nombre : "";
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

type Product = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  is_default: boolean;
  order_column: number;
};

export default function DealsPage() {
  const { toast } = useToast();
  const router = useRouter();

  // Data State
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<{ id: number; name: string }[]>([]); // <--- AGREGADO: Estado para usuarios
  const [products, setProducts] = useState<Product[]>([]); // <--- AGREGADO: Estado para productos
  const [instituciones, setInstituciones] = useState<Array<{ id: number; nombre: string; activa: boolean }>>([]); // <--- AGREGADO: Estado para instituciones
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [perPage, setPerPage] = useState(10);

  // Dialog States
  const [dialogState, setDialogState] = useState<"create" | "edit" | null>(null);
  const [dialogOpportunity, setDialogOpportunity] = useState<Opportunity | null>(null);

  const defaultStatus = useMemo(() => OPPORTUNITY_STATUSES[0], []);

  const form = useForm<OpportunityFormValues>({
    resolver: zodResolver(opportunitySchema),
    defaultValues: {
      leadId: "",
      vertical: "",
      opportunityType: "",
      status: defaultStatus,
      amount: 0,
      expectedCloseDate: "",
      comments: "",
    },
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
    category: "Crédito",
    monto_credito: "",
    ingreso_bruto: "",
    ingreso_neto: "",
    propuesta: "",
    leadId: "",
    opportunityId: "",
    assignedTo: "",
    openedAt: new Date().toISOString().split('T')[0],
    divisa: "CRC",
    plazo: "36",
  });

  // Deducciones state para el dialog de análisis
  const [deducciones, setDeducciones] = useState<EditableDeduccion[]>(
    DEDUCCIONES_TIPOS.map(nombre => ({ nombre, monto: 0, activo: false }))
  );

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
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);

  // --- Table Logic ---

  const handleFilterChange = useCallback(
    <K extends keyof OpportunityTableFilters>(field: K, value: OpportunityTableFilters[K]) => {
      setFilters((previous) => ({ ...previous, [field]: value }));
    },
    []
  );

  useEffect(() => {
    handleFilterChange("search", debouncedSearch);
  }, [debouncedSearch, handleFilterChange]);


  const [sortConfig, setSortConfig] = useState<{ column: SortableColumn; direction: "asc" | "desc" }>(
    () => ({ column: "created_at", direction: "desc" })
  );

  // --- Fetching ---

  const fetchOpportunities = useCallback(async () => {
    try {
      setIsLoading(true);
      // Send all filters to backend for server-side filtering
      const params: Record<string, string | number> = {};
      if (filters.createdFrom) params.date_from = filters.createdFrom;
      if (filters.createdTo) params.date_to = filters.createdTo;
      if (filters.status !== 'todos') params.status = filters.status;
      if (filters.vertical !== 'todos') params.vertical = filters.vertical;
      if (filters.search.trim()) params.search = filters.search.trim();
      params.page = currentPage;
      params.per_page = perPage;

      const response = await api.get('/api/opportunities', { params });

      // Handle paginated response from Laravel
      const isPaginated = response.data.data && response.data.current_page;

      if (isPaginated) {
        const data = response.data.data;
        setOpportunities(Array.isArray(data) ? data.map((item: any) => ({
          ...item,
          vertical: normalizeOpportunityVertical(item.vertical),
          opportunity_type: item.opportunity_type || OPPORTUNITY_TYPES[0],
          amount: resolveEstimatedOpportunityAmount(item.amount),
        })) : []);

        // Update pagination metadata
        setCurrentPage(response.data.current_page);
        setTotalPages(response.data.last_page);
        setTotalItems(response.data.total);
        setPerPage(response.data.per_page);
      } else {
        // Fallback for non-paginated response
        const data = response.data;
        setOpportunities(Array.isArray(data) ? data.map((item: any) => ({
          ...item,
          vertical: normalizeOpportunityVertical(item.vertical),
          opportunity_type: item.opportunity_type || OPPORTUNITY_TYPES[0],
          amount: resolveEstimatedOpportunityAmount(item.amount),
        })) : []);
      }
    } catch (error) {
      console.error("Error fetching opportunities:", error);
      toast({ title: "Error", description: "No se pudieron cargar las oportunidades.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast, filters.createdFrom, filters.createdTo, filters.status, filters.vertical, filters.search, currentPage, perPage]);

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

  // AGREGADO: Fetch Products para el select de categorías
  const fetchProducts = useCallback(async () => {
    try {
      const response = await api.get('/api/products');
      setProducts(response.data);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  }, []);

  // AGREGADO: Fetch Instituciones para el select de vertical
  const fetchInstituciones = useCallback(async () => {
    try {
      const response = await api.get('/api/instituciones?activas_only=true');
      setInstituciones(response.data);
    } catch (error) {
      console.error("Error fetching instituciones:", error);
    }
  }, []);

  useEffect(() => {
    fetchOpportunities();
    fetchLeads();
    fetchUsers();
    fetchProducts();
    fetchInstituciones();
  }, [fetchOpportunities, fetchLeads, fetchUsers, fetchProducts, fetchInstituciones]);

  // --- Form Logic ---

  useEffect(() => {
    if (dialogState === "create" && form.getValues("leadId") === "" && leads.length > 0) {
      form.setValue("leadId", String(leads[0].id));
    }
  }, [dialogState, leads, form]);

  const resetForm = useCallback((opportunity?: Opportunity | null) => {
    const derivedVertical = opportunity ? normalizeOpportunityVertical(opportunity.vertical, instituciones) : (instituciones.length > 0 ? instituciones[0].nombre : "");
    form.reset({
      leadId: opportunity?.lead?.id ? String(opportunity.lead.id) : "",
      vertical: derivedVertical,
      opportunityType: opportunity?.opportunity_type || OPPORTUNITY_TYPES[0],
      status: opportunity?.status ?? defaultStatus,
      amount: opportunity?.amount != null ? Number(opportunity.amount) : 0,
      expectedCloseDate: opportunity?.expected_close_date ?? "",
      comments: opportunity?.comments ?? "",
    });
  }, [defaultStatus, form, instituciones]);

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

  const onSubmit = async (values: OpportunityFormValues) => {
      setIsSaving(true);

      try {
        const selectedLead = leads.find(l => String(l.id) === values.leadId);
        if (!selectedLead) {
            toast({ title: "Error", description: "Lead no válido.", variant: "destructive" });
            setIsSaving(false);
            return;
        }

        const body: any = {
            lead_cedula: selectedLead.cedula,
            vertical: values.vertical,
            opportunity_type: values.opportunityType,
            status: values.status,
            amount: values.amount || 0,
            expected_close_date: values.expectedCloseDate || null,
            comments: values.comments,
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
  };

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

    // La referencia es el ID de la oportunidad
    setAnalisisForm({
      reference: String(opportunity.id),
      title: opportunity.opportunity_type || "",
      category: "Crédito",
      monto_credito: opportunity.amount ? String(opportunity.amount) : "",
      ingreso_bruto: "",
      ingreso_neto: "",
      propuesta: "",
      leadId: opportunity.lead?.id ? String(opportunity.lead.id) : "",
      opportunityId: String(opportunity.id),
      assignedTo: "",
      openedAt: new Date().toISOString().split('T')[0],
      divisa: "CRC",
      plazo: "36",
    });
    // Reset deducciones
    setDeducciones(DEDUCCIONES_TIPOS.map(nombre => ({ nombre, monto: 0, activo: false })));
    setIsAnalisisDialogOpen(true);
  };

  const handleAnalisisFormChange = (field: string, value: string) => {
    setAnalisisForm(prev => ({ ...prev, [field]: value }));
  };

  // Toggle deducción activa/inactiva
  const toggleDeduccion = (index: number) => {
    setDeducciones(prev => prev.map((d, i) =>
      i === index ? { ...d, activo: !d.activo, monto: !d.activo ? d.monto : 0 } : d
    ));
  };

  // Actualizar monto de deducción
  const updateDeduccionMonto = (index: number, monto: number) => {
    setDeducciones(prev => prev.map((d, i) =>
      i === index ? { ...d, monto } : d
    ));
  };

  const handleAnalisisSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      // Filtrar solo deducciones activas con monto > 0
      const deduccionesActivas = deducciones
        .filter(d => d.activo && d.monto > 0)
        .map(d => ({ nombre: d.nombre, monto: d.monto }));

      const payload: Record<string, any> = {
        title: analisisForm.title,
        status: "Pendiente", // Default status para análisis nuevo
        category: analisisForm.category,
        monto_credito: parseFloat(analisisForm.monto_credito) || 0,
        ingreso_bruto: parseFloat(analisisForm.ingreso_bruto) || 0,
        ingreso_neto: parseFloat(analisisForm.ingreso_neto) || 0,
        deducciones: deduccionesActivas.length > 0 ? deduccionesActivas : null,
        propuesta: analisisForm.propuesta || null,
        lead_id: parseInt(analisisForm.leadId),
        opportunity_id: analisisForm.opportunityId, // String ID como "26-00193-101-OP"
        plazo: parseInt(analisisForm.plazo) || 36,
        divisa: analisisForm.divisa,
        opened_at: analisisForm.openedAt,
        assigned_to: analisisForm.assignedTo || null,
      };
      // reference se auto-genera en backend con formato YY-XXXXX-EPP-AN

      await api.post('/api/analisis', payload);
      toast({ title: "Éxito", description: "Análisis creado correctamente." });
      setIsAnalisisDialogOpen(false);
      fetchOpportunities();
    } catch (error: any) {
      // Si ya existe un análisis (409 Conflict), mostrar mensaje
      if (error.response?.status === 409) {
        toast({ title: "Análisis existente", description: "Ya existe un análisis para esta oportunidad." });
        setIsAnalisisDialogOpen(false);
      } else {
        toast({ title: "Error", description: error.response?.data?.message || error.message, variant: "destructive" });
      }
    }
  };

  // Analisis button - opens dialog directly to create analysis for the opportunity
  const getAnalisisButtonProps = (opportunity: Opportunity) => {
    // Check if opportunity already has an analysis based on status or a flag
    const hasAnalysis = opportunity.status === 'En análisis' || (opportunity as any).has_analysis;
    const isAnalizada = opportunity.status === 'Analizada';

    if (hasAnalysis) {
      return { label: "Ver Análisis", color: "bg-green-600", icon: <Check className="h-4 w-4" />, disabled: false };
    }
    if (!isAnalizada) {
      return { label: "Solo oportunidades analizadas", color: "bg-gray-400", icon: <PlusCircle className="h-4 w-4" />, disabled: true };
    }
    return { label: "Crear Análisis", color: "bg-indigo-600", icon: <PlusCircle className="h-4 w-4" />, disabled: false };
  };

  // --- Pagination Logic ---

  const handlePageChange = useCallback((newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  }, [totalPages]);

  const handlePreviousPage = useCallback(() => {
    handlePageChange(currentPage - 1);
  }, [currentPage, handlePageChange]);

  const handleNextPage = useCallback(() => {
    handlePageChange(currentPage + 1);
  }, [currentPage, handlePageChange]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.search, filters.status, filters.vertical, filters.createdFrom, filters.createdTo]);

  // --- Table Logic ---

  const handleClearFilters = useCallback(() => {
    setFilters({ search: "", status: "todos", vertical: "todos", createdFrom: "", createdTo: "" });
    setCurrentPage(1);
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
      case "status": return (opportunity.status ?? "Pendiente").toLowerCase();
      case "type": return (opportunity.opportunity_type ?? "").toLowerCase();
      case "amount": return resolveEstimatedOpportunityAmount(opportunity.amount) ?? 0;
      case "expected_close_date": return opportunity.expected_close_date ? new Date(opportunity.expected_close_date).getTime() : 0;
      case "created_at": return opportunity.created_at ? new Date(opportunity.created_at).getTime() : 0;
      default: return "";
    }
  }, []);

  const visibleOpportunities = useMemo(() => {
    // Primary filtering is done server-side via fetchOpportunities params
    // Client-side sorting only (filtering kept as fallback for backends that don't support all params)
    return [...opportunities].sort((a, b) => {
      const aValue = getSortableValue(a, sortConfig.column);
      const bValue = getSortableValue(b, sortConfig.column);
      const multiplier = sortConfig.direction === "asc" ? 1 : -1;

      if (typeof aValue === "number" && typeof bValue === "number") {
        return (aValue - bValue) * multiplier;
      }
      return String(aValue ?? "").localeCompare(String(bValue ?? "")) * multiplier;
    });
  }, [getSortableValue, opportunities, sortConfig]);

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
        opportunity.status ?? "Pendiente",
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
      opportunity.status ?? "Pendiente",
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
        opportunity.status ?? "Pendiente",
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
    if (!searchVertical) return instituciones;
    return instituciones.filter((inst) => inst.nombre.toLowerCase().includes(searchVertical.toLowerCase()));
  }, [searchVertical, instituciones]);

  const filteredFilterVerticals = useMemo(() => {
    if (!searchFilterVertical) return instituciones;
    return instituciones.filter((inst) => inst.nombre.toLowerCase().includes(searchFilterVertical.toLowerCase()));
  }, [searchFilterVertical, instituciones]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <CardTitle>Oportunidades</CardTitle>
            <CardDescription>Gestiona las oportunidades asociadas a tus leads.</CardDescription>
            <p className="text-sm text-muted-foreground mt-1">
                {totalItems > 0 ? `${totalItems} ${totalItems === 1 ? "oportunidad" : "oportunidades"} total` : "No hay oportunidades"}
            </p>
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
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Buscar</Label>
                <Input placeholder="Referencia, lead o título" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
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
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Institución</Label>
                <Popover open={openFilterVertical} onOpenChange={setOpenFilterVertical} modal={true}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openFilterVertical}
                      className="w-full justify-between"
                    >
                      {filters.vertical !== "todos"
                        ? instituciones.find((inst) => inst.nombre === filters.vertical)?.nombre
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
                            filteredFilterVerticals.map((institucion) => (
                                <div
                                    key={institucion.id}
                                    className={`relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground ${filters.vertical === institucion.nombre ? "bg-accent text-accent-foreground" : ""}`}
                                    onClick={() => {
                                        handleFilterChange("vertical", institucion.nombre);
                                        setOpenFilterVertical(false);
                                        setSearchFilterVertical("");
                                    }}
                                >
                                    <Check
                                        className={`mr-2 h-4 w-4 ${
                                            filters.vertical === institucion.nombre ? "opacity-100" : "opacity-0"
                                        }`}
                                    />
                                    {institucion.nombre}
                                </div>
                            ))
                        )}
                    </div>
                  </PopoverContent>
                </Popover>
            </div>
            <div className="space-y-1">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Registros por página</Label>
                <Select value={String(perPage)} onValueChange={(value) => {
                  setPerPage(Number(value));
                  setCurrentPage(1);
                }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="30">30</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                </Select>
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
                    <TableCell><Badge variant="default" className="bg-slate-900 hover:bg-slate-800">{opportunity.status || "Pendiente"}</Badge></TableCell>
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
                            <TooltipContent>Ver detalles</TooltipContent>
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
                                className={`h-9 w-9 rounded-md text-white border-0 ${getAnalisisButtonProps(opportunity).color}`}
                                onClick={() => handleOpenAnalisisDialog(opportunity)}
                                disabled={getAnalisisButtonProps(opportunity).disabled}
                              >
                                {getAnalisisButtonProps(opportunity).icon}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{getAnalisisButtonProps(opportunity).label}</TooltipContent>
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

        {/* Pagination Controls */}
        {totalItems > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-6 border-t">
            <div className="text-sm text-muted-foreground">
              Mostrando {((currentPage - 1) * perPage) + 1} - {Math.min(currentPage * perPage, totalItems)} de {totalItems} oportunidades
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
              >
                Anterior
              </Button>

              {/* Page Numbers */}
              <div className="flex items-center gap-1">
                {/* First page */}
                {currentPage > 3 && (
                  <>
                    <Button
                      variant={currentPage === 1 ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(1)}
                      className="w-9 h-9 p-0"
                    >
                      1
                    </Button>
                    {currentPage > 4 && (
                      <span className="px-2 text-muted-foreground">...</span>
                    )}
                  </>
                )}

                {/* Pages around current */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    // Show current page and 2 pages on each side
                    return Math.abs(page - currentPage) <= 2;
                  })
                  .map(page => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(page)}
                      className="w-9 h-9 p-0"
                    >
                      {page}
                    </Button>
                  ))}

                {/* Last page */}
                {currentPage < totalPages - 2 && (
                  <>
                    {currentPage < totalPages - 3 && (
                      <span className="px-2 text-muted-foreground">...</span>
                    )}
                    <Button
                      variant={currentPage === totalPages ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(totalPages)}
                      className="w-9 h-9 p-0"
                    >
                      {totalPages}
                    </Button>
                  </>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                Siguiente
              </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogState !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
              <FormField
                control={form.control}
                name="leadId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lead asociado</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={isLoadingLeads}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingLeads ? "Cargando..." : "Selecciona un lead"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableLeadOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vertical"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Institución</FormLabel>
                    <Popover open={openVertical} onOpenChange={setOpenVertical} modal={true}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={openVertical}
                            className="w-full justify-between"
                          >
                            {field.value
                              ? instituciones.find((inst) => inst.nombre === field.value)?.nombre
                              : "Seleccionar institución..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
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
                            filteredVerticals.map((institucion) => (
                              <div
                                key={institucion.id}
                                className={`relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ${field.value === institucion.nombre ? "bg-accent text-accent-foreground" : ""}`}
                                onClick={() => {
                                  form.setValue("vertical", institucion.nombre);
                                  setOpenVertical(false);
                                  setSearchVertical("");
                                }}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${
                                    field.value === institucion.nombre ? "opacity-100" : "opacity-0"
                                  }`}
                                />
                                {institucion.nombre}
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
                name="opportunityType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Seleccionar tipo..." /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {products.length === 0 ? (
                          <SelectItem value="loading" disabled>Cargando...</SelectItem>
                        ) : (
                          products.map(product => (
                            <SelectItem key={product.id} value={product.name}>
                              {product.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {OPPORTUNITY_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="expectedCloseDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cierre esperado</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="comments"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Comentarios</FormLabel>
                      <FormControl>
                        <Textarea rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>Cancelar</Button>
                <Button type="submit" disabled={isSaving}>{isSaving ? "Guardando..." : "Guardar"}</Button>
              </DialogFooter>
            </form>
          </Form>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Nuevo Análisis</DialogTitle>
            <DialogDescription>Completa la información del análisis.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAnalisisSubmit} className="flex-1 overflow-y-auto space-y-4 pr-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="reference" className="text-xs">Referencia</Label>
                <Input
                  id="reference"
                  value={analisisForm.reference}
                  readOnly
                  className="bg-muted h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="title" className="text-xs">Título</Label>
                <Input id="title" className="h-8 text-sm" value={analisisForm.title} onChange={e => handleAnalisisFormChange('title', e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="category" className="text-xs">Categoría</Label>
                <Select value={analisisForm.category} onValueChange={v => handleAnalisisFormChange('category', v)}>
                  <SelectTrigger id="category" className="h-8 text-sm"><SelectValue placeholder="Selecciona" /></SelectTrigger>
                  <SelectContent>
                    {products.map(product => <SelectItem key={product.id} value={product.name}>{product.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="divisa" className="text-xs">Divisa</Label>
                <Select value={analisisForm.divisa} onValueChange={v => handleAnalisisFormChange('divisa', v)}>
                  <SelectTrigger id="divisa" className="h-8 text-sm"><SelectValue placeholder="Selecciona" /></SelectTrigger>
                  <SelectContent>
                    {["CRC", "USD", "EUR", "GBP"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="monto" className="text-xs">Monto Crédito</Label>
                <Input id="monto" className="h-8 text-sm" type="number" step="0.01" min="0" value={analisisForm.monto_credito} onChange={e => handleAnalisisFormChange('monto_credito', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ingreso_bruto" className="text-xs">Ingreso Bruto</Label>
                <Input id="ingreso_bruto" className="h-8 text-sm" type="number" step="0.01" min="0" value={analisisForm.ingreso_bruto} onChange={e => handleAnalisisFormChange('ingreso_bruto', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ingreso_neto" className="text-xs">Ingreso Neto</Label>
                <Input id="ingreso_neto" className="h-8 text-sm" type="number" step="0.01" min="0" value={analisisForm.ingreso_neto} onChange={e => handleAnalisisFormChange('ingreso_neto', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="plazo" className="text-xs">Plazo (Meses)</Label>
                <Select value={analisisForm.plazo} onValueChange={v => handleAnalisisFormChange('plazo', v)}>
                  <SelectTrigger id="plazo" className="h-8 text-sm"><SelectValue placeholder="Selecciona" /></SelectTrigger>
                  <SelectContent>
                    {["36", "60", "120"].map(p => <SelectItem key={p} value={p}>{p} meses</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="assignedTo" className="text-xs">Responsable</Label>
                <Select value={analisisForm.assignedTo} onValueChange={v => handleAnalisisFormChange('assignedTo', v)}>
                  <SelectTrigger id="assignedTo" className="h-8 text-sm"><SelectValue placeholder="Selecciona" /></SelectTrigger>
                  <SelectContent>
                    {users.map(u => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="openedAt" className="text-xs">Fecha Apertura</Label>
                <Input id="openedAt" className="h-8 text-sm" type="date" value={analisisForm.openedAt} onChange={e => handleAnalisisFormChange('openedAt', e.target.value)} />
              </div>
              {/* Deducciones Checklist */}
              <div className="sm:col-span-2 space-y-2">
                <Label className="text-xs">Deducciones al Salario</Label>
                <div className="grid gap-1.5 sm:grid-cols-2 border rounded-md p-2 bg-muted/30 max-h-[140px] overflow-y-auto">
                  {deducciones.map((deduccion, index) => (
                    <div key={deduccion.nombre} className="flex items-center gap-1.5">
                      <Checkbox
                        id={`deduccion-${index}`}
                        checked={deduccion.activo}
                        onCheckedChange={() => toggleDeduccion(index)}
                        className="h-3.5 w-3.5"
                      />
                      <label
                        htmlFor={`deduccion-${index}`}
                        className="text-xs font-medium leading-none cursor-pointer truncate flex-1"
                        title={deduccion.nombre}
                      >
                        {deduccion.nombre}
                      </label>
                      {deduccion.activo && (
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="₡"
                          className="w-20 h-6 text-xs px-1.5"
                          value={deduccion.monto || ""}
                          onChange={e => updateDeduccionMonto(index, parseFloat(e.target.value) || 0)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="propuesta" className="text-xs">Propuesta de Análisis</Label>
                <Textarea id="propuesta" rows={2} className="text-sm" placeholder="Escriba aquí la propuesta o conclusiones del análisis..." value={analisisForm.propuesta} onChange={e => handleAnalisisFormChange('propuesta', e.target.value)} />
              </div>
            </div>
          </form>
          <DialogFooter className="flex-shrink-0 pt-2 border-t">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsAnalisisDialogOpen(false)}>Cancelar</Button>
            <Button type="submit" size="sm" onClick={handleAnalisisSubmit}>Guardar</Button>
          </DialogFooter>
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
