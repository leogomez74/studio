"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  FileText,
  Pencil,
  PlusCircle,
  Sparkles,
  UserCheck,
  Loader2,
  Trash,
  Upload,
  X
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

// Importamos la conexión real y los tipos
import api from '@/lib/axios';
import { type Client, type Lead, type User } from '@/lib/data';
import { CreateOpportunityDialog } from "@/components/opportunities/create-opportunity-dialog";

// --- Helpers ---

const normalizeCedulaInput = (value: string): string => value.replace(/[^0-9]/g, "");

const normalizePhoneInput = (value: string): string => value.replace(/[^0-9]/g, "");

const formatCedula = (value: string): string => {
  const numericValue = value.replace(/[^0-9]/g, "");
  if (numericValue.length <= 1) {
    return numericValue;
  }
  if (numericValue.length <= 5) {
    return `${numericValue.slice(0, 1)}-${numericValue.slice(1)}`;
  }
  return `${numericValue.slice(0, 1)}-${numericValue.slice(1, 5)}-${numericValue.slice(5, 9)}`;
};

const leadSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  apellido1: z.string().min(1, "El primer apellido es requerido"),
  apellido2: z.string().min(1, "El segundo apellido es requerido"),
  cedula: z.string().min(11, "La cédula debe tener 9 dígitos").refine((cedula) => {
    if (!cedula) return false;
    return /^\d{1}-\d{4}-\d{4}$/.test(cedula);
  }, "El formato de la cédula debe ser X-XXXX-XXXX"),
  email: z.string().email("Correo inválido").optional(),
  phone: z.string().refine((phone) => {
    if (!phone) return false;
    return /^\d{8}$/.test(phone);
  }, "El número de teléfono debe tener 8 dígitos"),
  fechaNacimiento: z.string().refine((date) => {
    if (!date) return false;
    const today = new Date();
    const [day, month, year] = date.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    today.setHours(0, 0, 0, 0);
    return /^\d{2}-\d{2}-\d{4}$/.test(date) && dateObj <= today;
  }, "La fecha de nacimiento no puede ser en el futuro y debe tener el formato DD-MM-AAAA"),
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

// --- Main Component ---

export default function ClientesPage() {
  const { toast } = useToast();
  const router = useRouter();

  // Data State
  const [clientsData, setClientsData] = useState<Client[]>([]);
  const [leadsData, setLeadsData] = useState<Lead[]>([]);
  const [inactiveData, setInactiveData] = useState<(Lead | Client)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lists for Dropdowns
  const [leadStatuses, setLeadStatuses] = useState<LeadStatus[]>([]);

  // UI State
  const [isLeadFiltersOpen, setIsLeadFiltersOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("leads");

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
    },
  });

  // TSE Lookup State
  const [isFetchingTse, setIsFetchingTse] = useState(false);
  const [lastTseCedula, setLastTseCedula] = useState<string | null>(null);

  // Opportunity Dialog State
  const [isOpportunityDialogOpen, setIsOpportunityDialogOpen] = useState(false);
  const [leadForOpportunity, setLeadForOpportunity] = useState<Lead | null>(null);

  // Delete Client State
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // --- Effects ---

    useEffect(() => {
    const fetchLists = async () => {
      try {
        const resStatuses = await api.get('/api/lead-statuses');
        setLeadStatuses(Array.isArray(resStatuses.data) ? resStatuses.data : []);
      } catch (err) {
        setLeadStatuses([]);
        console.error("Error loading lists:", err);
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

      const [resClients, resLeads] = await Promise.all([
        api.get('/api/clients', { params: clientParams }),
        api.get('/api/leads', { params: leadParams })
      ]);

      const clientsArray = resClients.data.data || resClients.data;
      const leadsArray = resLeads.data.data || resLeads.data;

      if (activeTab === 'inactivos') {
          const combined = [...(Array.isArray(clientsArray) ? clientsArray : []), ...(Array.isArray(leadsArray) ? leadsArray : [])];
          combined.sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime());
          setInactiveData(combined);
      } else {
          setClientsData(Array.isArray(clientsArray) ? clientsArray : []);
          setLeadsData(Array.isArray(leadsArray) ? leadsArray : []);
      }

    } catch (err) {
      console.error("Error cargando datos:", err);
      setError("Error de conexión. Verifica que el backend esté corriendo.");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, contactFilter, dateFrom, dateTo, activeTab, statusFilter]);

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
        toast({ title: "Sin datos", description: "No hay datos para exportar", variant: "destructive" });
        return;
    }

    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(12);
    doc.text(title, 14, 16);

    const tableColumn = ["Nombre", "Cédula", "Email", "Teléfono", "Estado", "Registrado"];
    const tableRows = dataToExport.map((item: any) => [
        getLeadDisplayName(item),
        item.cedula || "-",
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
        toast({ title: "Sin datos", description: "No hay datos para exportar", variant: "destructive" });
        return;
    }

    const headers = ["Nombre", "Cédula", "Email", "Teléfono", "Estado", "Registrado"];
    const rows = dataToExport.map((item: any) => [
        getLeadDisplayName(item),
        item.cedula || "-",
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
  };

  // TSE Lookup Logic
  const handleTseLookup = useCallback(
    async (cedulaInput: string): Promise<void> => {
      const trimmed = cedulaInput.trim();
      const normalizedCedulaValue = normalizeCedulaInput(trimmed);
      if (!normalizedCedulaValue || normalizedCedulaValue.length < 9 || normalizedCedulaValue === lastTseCedula) {
        return;
      }

      setIsFetchingTse(true);
      try {
        const response = await fetch(`https://www.dsf.cr/tse/${encodeURIComponent(normalizedCedulaValue)}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const payload = await response.json().catch(() => null);
        if (!payload || typeof payload !== "object") throw new Error("Respuesta inesperada");

        const normalizedName = typeof payload.nombre === "string" ? payload.nombre.trim() : "";
        const normalizedApellido1 = typeof payload.apellido1 === "string" ? payload.apellido1.trim() : "";
        const normalizedApellido2 = typeof payload.apellido2 === "string" ? payload.apellido2.trim() : "";
        const normalizedCedula = typeof payload.cedula === "string" ? payload.cedula.trim() : normalizedCedulaValue;
        const rawDate = payload["fecha-nacimiento"] || payload.fecha_nacimiento || "";

        form.setValue("name", normalizedName);
        form.setValue("apellido1", normalizedApellido1);
        form.setValue("apellido2", normalizedApellido2);
        form.setValue("cedula", formatCedula(normalizedCedula));
        form.setValue("fechaNacimiento", formatDateForInput(rawDate));

        setLastTseCedula(normalizeCedulaInput(normalizedCedula || normalizedCedulaValue));
        toast({ title: "Datos cargados", description: "Información completada desde el TSE." });
      } catch (error) {
        console.error("Error consultando TSE", error);
      } finally {
        setIsFetchingTse(false);
      }
    },
    [lastTseCedula, toast, form]
  );

  const cedulaValue = form.watch("cedula");

  useEffect(() => {
    const sanitized = (cedulaValue || "").trim();
    if (!sanitized || sanitized.length < 9 || sanitized === lastTseCedula || isFetchingTse) {
      return;
    }
    const handler = setTimeout(() => {
      void handleTseLookup(sanitized);
    }, 600);
    return () => clearTimeout(handler);
  }, [handleTseLookup, isFetchingTse, lastTseCedula, cedulaValue]);


  const onSubmit = async (values: LeadFormValues) => {
    setIsSavingLead(true);

    try {
      let formattedDate = null;
      if (values.fechaNacimiento && values.fechaNacimiento.length === 10) {
          const [day, month, year] = values.fechaNacimiento.split('-');
          if (day && month && year) {
              formattedDate = `${year}-${month}-${day}`;
          }
      }

      const body = {
        name: values.name.trim(),
        email: values.email?.trim() || null,
        cedula: values.cedula || null,
        phone: values.phone || null,
        apellido1: values.apellido1?.trim() || null,
        apellido2: values.apellido2?.trim() || null,
        ...(editingId ? {} : { status: "Nuevo" }),
        fecha_nacimiento: formattedDate,
      };

      if (editingId) {
          const endpoint = editingType === 'client' ? `/api/clients/${editingId}` : `/api/leads/${editingId}`;
          await api.put(endpoint, body);
          toast({ title: "Actualizado", description: "Datos actualizados correctamente." });
      } else {
          await api.post('/api/leads', body);
          toast({ title: "Creado", description: "Lead registrado exitosamente." });
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
        
        toast({
          title: "Error de validación", 
          description: "Por favor revisa los campos marcados en rojo.", 
          variant: "destructive"
        });
      } else {
        toast({ title: "Error", description: error.response?.data?.message || "No se pudo guardar.", variant: "destructive" });
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

  // Helper to convert YYYY-MM-DD to DD-MM-YYYY for the input
  const formatDateForInput = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    // Adjust for timezone if needed, or simple split if string format is consistent
    // Assuming YYYY-MM-DD from backend
    const [y, m, d] = dateStr.split('T')[0].split('-');
    return `${d}-${m}-${y}`;
  };

  const handleConvertLead = async (lead: Lead) => {
      try {
          await api.post(`/api/leads/${lead.id}/convert`);
          toast({ title: "Convertido", description: `${lead.name} ahora es cliente.`, className: "bg-green-600 text-white" });
          fetchData();
      } catch (error) {
          toast({ title: "Error", description: "No se pudo convertir.", variant: "destructive" });
      }
  };

  const handleArchiveLead = async (lead: Lead) => {
      if (!confirm(`¿Archivar a ${lead.name}?`)) return;
      try {
          await api.patch(`/api/leads/${lead.id}/toggle-active`);
          toast({ title: "Archivado", description: "Lead archivado correctamente." });
          fetchData();
      } catch (error) {
          toast({ title: "Error", description: "No se pudo archivar.", variant: "destructive" });
      }
  };

  const handleRestore = async (item: Lead | Client) => {
      const isLead = (item as any).lead_status_id !== undefined || (item as any).lead_status !== undefined;
      const endpoint = isLead ? `/api/leads/${item.id}/toggle-active` : `/api/clients/${item.id}/toggle-active`;
      try {
          await api.patch(endpoint);
          toast({ title: "Restaurado", description: "Registro restaurado." });
          fetchData();
      } catch (error) {
          toast({ title: "Error", description: "No se pudo restaurar.", variant: "destructive" });
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
          toast({ title: "Eliminado", description: "Cliente eliminado." });
          fetchData();
      } catch (error) {
          toast({ title: "Error", description: "No se pudo eliminar.", variant: "destructive" });
      } finally {
          setIsDeleteDialogOpen(false);
          setClientToDelete(null);
      }
  };



  if (error) return <div className="p-8 text-center text-destructive">{error}</div>;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <Card>
          <Collapsible open={isLeadFiltersOpen} onOpenChange={setIsLeadFiltersOpen} className="space-y-0">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>CRM</CardTitle>
                <CardDescription>Gestiona leads y clientes desde un solo panel.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" className="gap-2" onClick={openLeadDialog}>
                  <PlusCircle className="h-4 w-4" />
                  Nuevo lead
                </Button>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="gap-2 hover:bg-[lightgray]/48">
                    {isLeadFiltersOpen ? "Ocultar filtros" : "Mostrar filtros"}
                    {isLeadFiltersOpen ? (
                      <ChevronUp className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    )}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <CollapsibleContent className="space-y-4 rounded-md border border-dashed border-muted-foreground/30 p-4">
                  {/* Filters UI preserved */}
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Desde</Label>
                        <Input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                          className="h-10 w-36"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hasta</Label>
                        <Input
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          className="h-10 w-36"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-end gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleClearFilters}
                        className="hover:bg-[lightgray]/48"
                      >
                        Limpiar filtros
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="secondary" className="gap-2 hover:bg-[lightgray]/48">
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
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-1 md:col-span-2">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Buscar
                      </Label>
                      <Input
                        placeholder="Cédula, nombre o correo"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado</Label>
                      {activeTab === "leads" ? (
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger className="hover:bg-[lightgray]/48">
                            <SelectValue placeholder="Todos los estados" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all" className="focus:bg-[lightgray]/48 cursor-pointer">Todos los estados</SelectItem>
                            {Array.isArray(leadStatuses) && leadStatuses.length > 0
                              ? leadStatuses.map(status => (
                                  <SelectItem key={status.id} value={String(status.id)} className="focus:bg-[lightgray]/48 cursor-pointer">{status.name}</SelectItem>
                                )) : null}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger className="hover:bg-[lightgray]/48">
                            <SelectValue placeholder="Todos los estados" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all" className="focus:bg-[lightgray]/48 cursor-pointer">Todos los estados</SelectItem>
                            <SelectItem value="Cliente Premium" className="focus:bg-[lightgray]/48 cursor-pointer">Cliente Premium</SelectItem>
                            <SelectItem value="Prospecto" className="focus:bg-[lightgray]/48 cursor-pointer">Prospecto</SelectItem>
                            <SelectItem value="Descartado" className="focus:bg-[lightgray]/48 cursor-pointer">Descartado</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contacto</Label>
                      <Select value={contactFilter} onValueChange={setContactFilter}>
                        <SelectTrigger className="hover:bg-[lightgray]/48">
                          <SelectValue placeholder="Todas las opciones" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all" className="focus:bg-[lightgray]/48 cursor-pointer">Todos los contactos</SelectItem>
                          <SelectItem value="con-contacto" className="focus:bg-[lightgray]/48 cursor-pointer">Con correo o teléfono</SelectItem>
                          <SelectItem value="sin-contacto" className="focus:bg-[lightgray]/48 cursor-pointer">Sin datos de contacto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CollapsibleContent>

                <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
                  <TabsList className="grid grid-cols-3">
                    <TabsTrigger value="leads">Leads</TabsTrigger>
                    <TabsTrigger value="clientes">Clientes</TabsTrigger>
                    <TabsTrigger value="inactivos">Inactivos</TabsTrigger>
                  </TabsList>

                  <TabsContent value="leads" className="space-y-4">
                    <div>
                      <p className="text-sm font-medium">Leads recientes</p>
                      <p className="text-sm text-muted-foreground">Últimos registros del embudo.</p>
                    </div>
                    {loading ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                    ) : (
                        <LeadsTable data={leadsData} onAction={handleLeadAction} />
                    )}
                  </TabsContent>

                  <TabsContent value="clientes" className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                            <div>
                                <p className="text-sm font-medium">Clientes activos</p>
                                <p className="text-sm text-muted-foreground">Casos que ya están en seguimiento.</p>
                            </div>
                            <Button asChild size="sm" variant="outline" className="w-fit">
                                <Link href="/dashboard/clients" className="gap-1">
                                    Ver clientes
                                    <ArrowUpRight className="h-4 w-4" />
                                </Link>
                            </Button>
                        </div>
                    </div>
                    {loading ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                    ) : (
                        <ClientsTable data={clientsData} onEdit={handleEditClient} onDelete={confirmDeleteClient} />
                    )}
                  </TabsContent>

                  <TabsContent value="inactivos" className="space-y-4">
                    <div>
                      <p className="text-sm font-medium">Inactivos</p>
                      <p className="text-sm text-muted-foreground">Leads suspendidos, exclientes o archivados.</p>
                    </div>
                    {loading ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                    ) : (
                        <InactiveTable data={inactiveData} onRestore={handleRestore} />
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </CardContent>
          </Collapsible>
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
                          }}
                        />
                      </FormControl>
                      {!isViewOnly && <p className="text-xs text-muted-foreground">Al ingresar la cédula completaremos los datos desde el TSE.</p>}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input required disabled={isViewOnly} {...field} />
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
                      <FormLabel>Primer apellido</FormLabel>
                      <FormControl>
                        <Input required disabled={isViewOnly} {...field} />
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
                      <FormLabel>Segundo apellido</FormLabel>
                      <FormControl>
                        <Input required disabled={isViewOnly} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
                      <FormLabel>Teléfono</FormLabel>
                      <FormControl>
                        <Input
                          required
                          disabled={isViewOnly}
                          maxLength={8}
                          {...field}
                          onChange={(e) => {
                            const formattedValue = normalizePhoneInput(e.target.value);
                            field.onChange(formattedValue);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fechaNacimiento"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Fecha de nacimiento</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          required
                          disabled={isViewOnly}
                          max={new Date().toISOString().split('T')[0]}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
    </TooltipProvider>
  );
}


type LeadsTableProps = {
  data: Lead[];
  onAction: (action: string, lead: Lead) => void;
};

function LeadsTable({ data, onAction }: LeadsTableProps) {
  const { toast } = useToast();
  const [uploadDialogOpen, setUploadDialogOpen] = useState<string | null>(null);
  const [constanciaFile, setConstanciaFile] = useState<File | null>(null);
  const [multiFiles, setMultiFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  
  // Estados para validación de duplicados
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [currentLeadCedula, setCurrentLeadCedula] = useState<string | null>(null);

  const handleOpenUploadDialog = async (leadId: string, leadCedula?: string) => {
    // Verificar si el lead tiene cédula
    if (!leadCedula) {
      toast({
        title: "Error", 
        description: "El lead no tiene cédula registrada. No se puede subir archivos.", 
        variant: "destructive"
      });
      return;
    }

    setCheckingDuplicate(true);
    try {
      // Verificar si ya existe carpeta con archivos para esta cédula
      const checkRes = await api.get('/api/person-documents/check-cedula-folder', {
        params: { cedula: leadCedula }
      });

      if (checkRes.data?.exists) { // Updated to check 'exists' which covers DB records
        toast({
          title: "Archivos ya existen", 
          description: `Ya existen archivos para la cédula ${leadCedula}. No se permiten duplicados.`, 
          variant: "destructive"
        });
        setCheckingDuplicate(false);
        return;
      }

      // Si no hay duplicados, abrir el diálogo
      setCurrentLeadCedula(leadCedula);
      setUploadDialogOpen(leadId);
      setConstanciaFile(null);
      setMultiFiles([]);
      
    } catch (error) {
      console.error('Error verificando duplicados:', error);
      // Si falla la verificación, permitir continuar (el backend validará de nuevo)
      setCurrentLeadCedula(leadCedula);
      setUploadDialogOpen(leadId);
      setConstanciaFile(null);
      setMultiFiles([]);
    } finally {
      setCheckingDuplicate(false);
    }
  };

  const handleConstanciaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['application/pdf', 'text/html'].includes(file.type) && !file.name.endsWith('.pdf') && !file.name.endsWith('.html')) {
      toast({ title: "Archivo inválido", description: "Solo se permiten archivos PDF o HTML.", variant: "destructive" });
      return;
    }
    setConstanciaFile(file);
  };

  const handleMultiFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file =>
      (['application/pdf', 'text/html'].includes(file.type) || file.name.endsWith('.pdf') || file.name.endsWith('.html'))
    );
    if (validFiles.length !== files.length) {
      toast({ title: "Algunos archivos no son válidos", description: "Solo se permiten archivos PDF o HTML.", variant: "destructive" });
    }
    setMultiFiles(validFiles);
  };

  const handleUpload = async () => {
    if (!uploadDialogOpen) return;
    setUploading(true);
    try {
      // Subir constancia
      if (constanciaFile) {
        const formData = new FormData();
        formData.append('file', constanciaFile);
        formData.append('person_id', uploadDialogOpen); // Added person_id
        await api.post('/api/person-documents', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      
      // Subir archivos adicionales
      if (multiFiles.length > 0) {
        for (const file of multiFiles) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('person_id', uploadDialogOpen); // Added person_id
          await api.post('/api/person-documents', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        }
      }

      toast({ title: "Archivos subidos", description: "Los archivos se subieron correctamente." });
      setUploadDialogOpen(null);
      setCurrentLeadCedula(null);
    } catch (err: any) {
      // Map HTTP error codes to user-friendly messages
      const errorStatus = err.response?.status;
      let userMessage = "Error al subir los archivos. Intente nuevamente.";

      if (errorStatus === 409) {
        toast({
          title: "Ya existen archivos",
          description: err.response?.data?.message || "No se permiten duplicados para esta cédula.",
          variant: "destructive"
        });
        setUploadDialogOpen(null);
        setCurrentLeadCedula(null);
        return;
      } else if (errorStatus === 413) {
        userMessage = "El archivo es demasiado grande. El tamaño máximo permitido es 10MB.";
      } else if (errorStatus === 415) {
        userMessage = "Tipo de archivo no permitido. Solo se aceptan PDF y HTML.";
      } else if (errorStatus === 401 || errorStatus === 403) {
        userMessage = "No tiene permisos para subir archivos.";
      } else if (errorStatus === 500) {
        userMessage = "Error en el servidor. Contacte al administrador.";
      } else if (!navigator.onLine) {
        userMessage = "Sin conexión a internet. Verifique su conexión.";
      }

      toast({ title: "Error", description: userMessage, variant: "destructive" });
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
    }
  };

  if (data.length === 0) return <div className="text-center p-8 text-muted-foreground">No encontramos leads con los filtros seleccionados.</div>;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[11rem]">Cédula</TableHead>
            <TableHead>Lead</TableHead>
            <TableHead className="w-[7.5rem]">Estado</TableHead>
            <TableHead className="w-[10.5rem]">Contacto</TableHead>
            <TableHead className="text-right">Registrado</TableHead>
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
                <TableCell className="text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          size="icon" 
                          onClick={() => handleOpenUploadDialog(String(lead.id), lead.cedula || undefined)}
                          disabled={checkingDuplicate || !lead.cedula}
                        >
                          {checkingDuplicate ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {!lead.cedula ? "Requiere cédula" : "Subir Archivos Obligatorios"}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" onClick={() => onAction('create_opportunity', lead)}>
                          <Sparkles className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Crear oportunidad</TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" className="bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => onAction('convert', lead)}>
                          <UserCheck className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Convertir a cliente</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="destructive" onClick={() => onAction('archive', lead)}>
                          <Archive className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Archivar</TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {/* Upload Dialog */}
      <Dialog open={!!uploadDialogOpen} onOpenChange={open => { if (!open) { setUploadDialogOpen(null); setCurrentLeadCedula(null); } }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Subir Archivos</DialogTitle>
            <DialogDescription>
              Adjunta la constancia y otros archivos obligatorios para el lead.
              {currentLeadCedula && (
                <span className="block mt-1 text-sm font-medium text-primary">
                  Cédula: {currentLeadCedula}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Constancia File Input */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Constancia (PDF o HTML)</Label>
              <div
                onClick={() => !uploading && document.getElementById('constancia-input')?.click()}
                className={`
                  relative flex flex-col items-center justify-center gap-3 p-6
                  border-2 border-dashed rounded-lg cursor-pointer
                  transition-colors duration-200
                  ${uploading ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary hover:bg-muted/50'}
                  ${constanciaFile ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
                `}
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Arrastra tu archivo aquí</p>
                  <p className="text-xs text-muted-foreground mt-1">o</p>
                </div>
                <Button type="button" variant="secondary" size="sm" disabled={uploading}>
                  Seleccionar archivo
                </Button>
                <input
                  id="constancia-input"
                  type="file"
                  accept=".pdf,.html,application/pdf,text/html"
                  onChange={handleConstanciaChange}
                  disabled={uploading}
                  className="hidden"
                />
              </div>
              {constanciaFile && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium truncate max-w-[400px]">{constanciaFile.name}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => { e.stopPropagation(); setConstanciaFile(null); }}
                    disabled={uploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Additional Files Input */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Archivos adicionales (PDF o HTML, múltiples)</Label>
              <div
                onClick={() => !uploading && document.getElementById('multi-files-input')?.click()}
                className={`
                  relative flex flex-col items-center justify-center gap-3 p-6
                  border-2 border-dashed rounded-lg cursor-pointer
                  transition-colors duration-200
                  ${uploading ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary hover:bg-muted/50'}
                  ${multiFiles.length > 0 ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
                `}
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Arrastra tus archivos aquí</p>
                  <p className="text-xs text-muted-foreground mt-1">o</p>
                </div>
                <Button type="button" variant="secondary" size="sm" disabled={uploading}>
                  Seleccionar archivos
                </Button>
                <input
                  id="multi-files-input"
                  type="file"
                  accept=".pdf,.html,application/pdf,text/html"
                  multiple
                  onChange={handleMultiFilesChange}
                  disabled={uploading}
                  className="hidden"
                />
              </div>
              {multiFiles.length > 0 && (
                <div className="space-y-2">
                  {multiFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium truncate max-w-[400px]">{file.name}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMultiFiles(prev => prev.filter((_, i) => i !== idx));
                        }}
                        disabled={uploading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadDialogOpen(null); setCurrentLeadCedula(null); }} disabled={uploading}>
              Cancelar
            </Button>
            <Button onClick={handleUpload} disabled={uploading || (!constanciaFile && multiFiles.length === 0)}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Subir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
function ClientsTable({ data, onEdit, onDelete }: { data: Client[], onEdit: (client: Client) => void, onDelete: (client: Client) => void }) {
    if (data.length === 0) return <div className="text-center p-8 text-muted-foreground">No encontramos clientes con los filtros seleccionados.</div>;

    return (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead className="w-[11rem]">Cédula</TableHead>
              <TableHead className="w-[11rem]">Registrado</TableHead>
              <TableHead className="w-[16rem]">Estado</TableHead>
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
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon" className="bg-sky-100 text-sky-700 hover:bg-sky-200" onClick={() => onEdit(client)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Editar</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon" variant="destructive" onClick={() => onDelete(client)}>
                              <Trash className="h-4 w-4" />
                            </Button>
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
    )
}

function InactiveTable({ data, onRestore }: { data: (Lead | Client)[], onRestore: (item: Lead | Client) => void }) {
    if (data.length === 0) return <div className="text-center p-8 text-muted-foreground">No encontramos registros inactivos.</div>;

    return (
        <Table>
          <TableHeader>
            <TableRow>
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
    );
}
