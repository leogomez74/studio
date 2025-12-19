"use client";

import React, { useState, useEffect, useMemo, useCallback, FormEvent, ChangeEvent } from "react";
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
  Pencil,
  PlusCircle,
  Sparkles,
  UserCheck,
  Loader2,
  Trash,
  Upload
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
import { useToast } from "@/hooks/use-toast";

// Importamos la conexión real y los tipos
import api from '@/lib/axios';
import { type Client, type Lead, type User } from '@/lib/data';
import { CreateOpportunityDialog } from "@/components/opportunities/create-opportunity-dialog";

// --- Helpers ---

const normalizeCedulaInput = (value: string): string => value.replace(/[^0-9]/g, "");

const createEmptyLeadForm = () => ({
  name: "",
  apellido1: "",
  apellido2: "",
  email: "",
  phone: "",
  cedula: "",
  fechaNacimiento: "",
});

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
  // Try to construct full name if available or fallback to name
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
  
  // Data State (Preserved from original)
  const [clientsData, setClientsData] = useState<Client[]>([]);
  const [leadsData, setLeadsData] = useState<Lead[]>([]);
  const [inactiveData, setInactiveData] = useState<(Lead | Client)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lists for Dropdowns (Preserved)
  const [leadStatuses, setLeadStatuses] = useState<LeadStatus[]>([]);

  // UI State (New Layout)
  const [isLeadFiltersOpen, setIsLeadFiltersOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("leads");

  // Filters State (Mapped to original logic where possible)
  const [searchQuery, setSearchQuery] = useState("");
  const [contactFilter, setContactFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Dialog State
  const [isLeadDialogOpen, setIsLeadDialogOpen] = useState(false);
  const [isSavingLead, setIsSavingLead] = useState(false);
  const [leadFormValues, setLeadFormValues] = useState(createEmptyLeadForm());
  const [editingId, setEditingId] = useState<string | Number | null>(null);
  const [editingType, setEditingType] = useState<'lead' | 'client' | null>(null);
  const [isViewOnly, setIsViewOnly] = useState(false);
  
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

  // Fetch Lists (Statuses) once
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

  // Fetch Data Logic (Preserved)
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      const commonParams: any = {};
      if (searchQuery) commonParams.q = searchQuery;
      if (contactFilter !== "all") commonParams.has_contact = contactFilter;
      if (dateFrom) commonParams.date_from = dateFrom;
      if (dateTo) commonParams.date_to = dateTo;

      // Prepare specific params
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

  // Trigger fetch when filters change
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

  // Export Handlers (Adapted to new UI style but keeping logic)
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
    setLeadFormValues(createEmptyLeadForm());
    setEditingId(null);
    setEditingType(null);
    setLastTseCedula(null);
    setIsViewOnly(false);
    setIsLeadDialogOpen(true);
  };

  const closeLeadDialog = () => {
    setIsLeadDialogOpen(false);
    setLeadFormValues(createEmptyLeadForm());
    setEditingId(null);
    setEditingType(null);
    setLastTseCedula(null);
    setIsViewOnly(false);
  };

  const handleLeadFieldChange = (field: string) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setLeadFormValues((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  // TSE Lookup Logic (New Feature)
  const handleTseLookup = useCallback(
    async (cedulaInput: string): Promise<void> => {
      const trimmed = cedulaInput.trim();
      const normalizedCedulaValue = normalizeCedulaInput(trimmed);
      if (!normalizedCedulaValue || normalizedCedulaValue === lastTseCedula) {
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
        
        // Format date from TSE (usually DD/MM/YYYY or similar) to display format
        const rawDate = payload["fecha-nacimiento"] || payload.fecha_nacimiento || "";
        
        setLeadFormValues((previous) => ({
          ...previous,
          name: normalizedName || previous.name,
          apellido1: normalizedApellido1 || previous.apellido1,
          apellido2: normalizedApellido2 || previous.apellido2,
          cedula: normalizedCedula || previous.cedula,
          fechaNacimiento: rawDate || previous.fechaNacimiento,
        }));

        setLastTseCedula(normalizeCedulaInput(normalizedCedula || normalizedCedulaValue));
        toast({ title: "Datos cargados", description: "Información completada desde el TSE." });
      } catch (error) {
        console.error("Error consultando TSE", error);
        // Silent fail or mild toast
      } finally {
        setIsFetchingTse(false);
      }
    },
    [lastTseCedula, toast]
  );

  // Trigger TSE lookup on cedula change
  useEffect(() => {
    const sanitized = normalizeCedulaInput(leadFormValues.cedula.trim());
    if (!sanitized || sanitized.length < 9 || sanitized === lastTseCedula || isFetchingTse) {
      return;
    }
    const handler = setTimeout(() => {
      void handleTseLookup(sanitized);
    }, 600);
    return () => clearTimeout(handler);
  }, [handleTseLookup, isFetchingTse, lastTseCedula, leadFormValues.cedula]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ''); // Remove non-digits
    if (value.length > 8) value = value.slice(0, 8); // Limit to 8 digits

    let formattedValue = '';
    if (value.length > 4) {
      formattedValue = `${value.slice(0, 2)}-${value.slice(2, 4)}-${value.slice(4)}`;
    } else if (value.length > 2) {
      formattedValue = `${value.slice(0, 2)}-${value.slice(2)}`;
    } else {
      formattedValue = value;
    }

    setLeadFormValues((prev) => ({
      ...prev,
      fechaNacimiento: formattedValue,
    }));
  };

  const handleLeadSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = leadFormValues.name.trim();
    const trimmedEmail = leadFormValues.email.trim();

    if (!trimmedName || !trimmedEmail) {
      toast({ title: "Faltan datos", description: "Nombre y correo son obligatorios.", variant: "destructive" });
      return;
    }

    try {
      setIsSavingLead(true);

      // Convert DD-MM-YYYY to YYYY-MM-DD
      let formattedDate = null;
      if (leadFormValues.fechaNacimiento && leadFormValues.fechaNacimiento.length === 10) {
          const [day, month, year] = leadFormValues.fechaNacimiento.split('-');
          if (day && month && year) {
              formattedDate = `${year}-${month}-${day}`;
          }
      }

      const body = {
        name: trimmedName,
        email: trimmedEmail,
        cedula: normalizeCedulaInput(leadFormValues.cedula) || null,
        phone: leadFormValues.phone.trim() || null,
        apellido1: leadFormValues.apellido1.trim() || null,
        apellido2: leadFormValues.apellido2.trim() || null,
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
      toast({ title: "Error", description: "No se pudo guardar.", variant: "destructive" });
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
              router.push(`/dashboard/leads/${lead.id}?mode=edit`);
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
      router.push(`/dashboard/clientes/${client.id}?mode=edit`);
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
                                ))
                              : null}
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
          <form className="space-y-4" onSubmit={handleLeadSubmit}>
            <div className="space-y-2">
              <Label htmlFor="lead-cedula">Cédula</Label>
              <Input
                id="lead-cedula"
                value={leadFormValues.cedula}
                onChange={handleLeadFieldChange("cedula")}
                placeholder="0-0000-0000"
                disabled={isViewOnly}
              />
              {!isViewOnly && <p className="text-xs text-muted-foreground">Al ingresar la cédula completaremos los datos desde el TSE.</p>}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="lead-name">Nombre</Label>
                <Input id="lead-name" value={leadFormValues.name} onChange={handleLeadFieldChange("name")} required disabled={isViewOnly} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-apellido1">Primer apellido</Label>
                <Input
                  id="lead-apellido1"
                  value={leadFormValues.apellido1}
                  onChange={handleLeadFieldChange("apellido1")}
                  disabled={isViewOnly}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-apellido2">Segundo apellido</Label>
                <Input
                  id="lead-apellido2"
                  value={leadFormValues.apellido2}
                  onChange={handleLeadFieldChange("apellido2")}
                  disabled={isViewOnly}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="lead-email">Correo</Label>
                <Input
                  id="lead-email"
                  type="email"
                  value={leadFormValues.email}
                  onChange={handleLeadFieldChange("email")}
                  required
                  disabled={isViewOnly}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-phone">Teléfono</Label>
                <Input id="lead-phone" value={leadFormValues.phone} onChange={handleLeadFieldChange("phone")} disabled={isViewOnly} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="lead-birthdate">Fecha de nacimiento</Label>
                <Input
                  id="lead-birthdate"
                  type="text"
                  inputMode="numeric"
                  placeholder="DD-MM-AAAA"
                  value={leadFormValues.fechaNacimiento}
                  onChange={handleDateChange}
                  disabled={isViewOnly}
                  maxLength={10}
                />
              </div>
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

  const handleOpenUploadDialog = (leadId: string) => {
    setUploadDialogOpen(leadId);
    setConstanciaFile(null);
    setMultiFiles([]);
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
      const uploadedFilePaths: string[] = [];
      if (constanciaFile) {
        const formData = new FormData();
        formData.append('file', constanciaFile);
        const res = await api.post(`/api/leads/${uploadDialogOpen}/documents`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (res.data && res.data.path) uploadedFilePaths.push(res.data.path);
      }
      if (multiFiles.length > 0) {
        for (const file of multiFiles) {
          const formData = new FormData();
          formData.append('file', file);
          const res = await api.post(`/api/leads/${uploadDialogOpen}/documents`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          if (res.data && res.data.path) uploadedFilePaths.push(res.data.path);
        }
      }

      // Fetch the lead to get the cedula
      let cedula = null;
      try {
        const leadRes = await api.get(`/api/leads/${uploadDialogOpen}`);
        cedula = leadRes.data?.cedula;
      } catch (e) { /* ignore */ }

      // Call backend to create folder with cedula and move/copy files
      if (cedula && uploadedFilePaths.length > 0) {
        try {
          await api.post('/api/leads/create-cedula-folder', {
            cedula,
            files: uploadedFilePaths,
          });
        } catch (e) {
          toast({ title: "Advertencia", description: "No se pudo crear la carpeta por cédula.", variant: "destructive" });
        }
      }

      toast({ title: "Archivos subidos", description: "Los archivos se subieron correctamente." });
      setUploadDialogOpen(null);
    } catch (err) {
      toast({ title: "Error al subir", description: "No se pudo subir uno o más archivos.", variant: "destructive" });
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
                        <Button size="icon" onClick={() => handleOpenUploadDialog(String(lead.id))}>
                          <Upload className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Subir Archivos Obligatorios</TooltipContent>
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
      <Dialog open={!!uploadDialogOpen} onOpenChange={open => { if (!open) setUploadDialogOpen(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Subir Archivos</DialogTitle>
            <DialogDescription>
              Adjunta la constancia y otros archivos obligatorios para el lead.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block font-medium mb-1">Constancia (PDF o HTML)</label>
              <input
                type="file"
                accept=".pdf,.html,application/pdf,text/html"
                onChange={handleConstanciaChange}
                disabled={uploading}
              />
              {constanciaFile && <div className="text-xs mt-1 text-muted-foreground">{constanciaFile.name}</div>}
            </div>
            <div>
              <label className="block font-medium mb-1">Archivos adicionales (PDF o HTML, múltiples)</label>
              <input
                type="file"
                accept=".pdf,.html,application/pdf,text/html"
                multiple
                onChange={handleMultiFilesChange}
                disabled={uploading}
              />
              {multiFiles.length > 0 && (
                <ul className="mt-2 text-xs text-muted-foreground list-disc pl-4">
                  {multiFiles.map((file, idx) => (
                    <li key={idx}>{file.name}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(null)} disabled={uploading}>Cancelar</Button>
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
