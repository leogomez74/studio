'use client';
import React, { useState, useEffect } from 'react';
import { MoreHorizontal, PlusCircle, Loader2, Download, Sparkles, Pencil, Eye, UserCheck, Archive, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Importamos la conexión real y los tipos
import api from '@/lib/axios';
import { type Client, type Lead, type User } from '@/lib/data';

type LeadStatus = {
    id: number;
    name: string;
};

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

export default function ClientesPage() {
  const { toast } = useToast();
  const [clientsData, setClientsData] = useState<Client[]>([]);
  const [leadsData, setLeadsData] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Dialog State
  const [isLeadDialogOpen, setIsLeadDialogOpen] = useState(false);
  const [isSavingLead, setIsSavingLead] = useState(false);
  const [leadFormValues, setLeadFormValues] = useState(createEmptyLeadForm());

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState("leads");
  const [searchQuery, setSearchQuery] = useState("");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all"); // Shared state for specific status
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Lists for Dropdowns
  const [agents, setAgents] = useState<User[]>([]);
  const [leadStatuses, setLeadStatuses] = useState<LeadStatus[]>([]);

  // Fetch Lists (Agents & Statuses) once
  useEffect(() => {
    const fetchLists = async () => {
        try {
            const [resAgents, resStatuses] = await Promise.all([
                api.get('/api/agents'),
                api.get('/api/lead-statuses')
            ]);
            setAgents(resAgents.data);
            setLeadStatuses(resStatuses.data);
        } catch (err) {
            console.error("Error loading lists:", err);
        }
    };
    fetchLists();
  }, []);

  // Define fetchData outside useEffect so it can be reused
  const fetchData = async () => {
    try {
      setLoading(true);
      
      const commonParams: any = {};
      if (searchQuery) commonParams.q = searchQuery;
      if (agentFilter !== "all") commonParams.assigned_to_id = agentFilter;
      if (dateFrom) commonParams.date_from = dateFrom;
      if (dateTo) commonParams.date_to = dateTo;

      // Prepare specific params
      const leadParams = { ...commonParams };
      const clientParams = { ...commonParams };

      if (statusFilter !== "all") {
          if (activeTab === "leads") {
              leadParams.lead_status_id = statusFilter;
          } else {
              // Logic for Clients: Map "Activo"/"Inactivo" to is_active, others to status
              if (statusFilter === "Activo") {
                  clientParams.is_active = 1;
              } else if (statusFilter === "Inactivo") {
                  clientParams.is_active = 0;
              } else {
                  clientParams.status = statusFilter;
              }
          }
      }

      // Hacemos las peticiones paralelas
      const [resClients, resLeads] = await Promise.all([
        api.get('/api/clients', { params: clientParams }),
        api.get('/api/leads', { params: leadParams })
      ]);

      // Manejo robusto de la respuesta (por si viene paginada o no)
      const clientsArray = resClients.data.data || resClients.data;
      const leadsArray = resLeads.data.data || resLeads.data;

      setClientsData(Array.isArray(clientsArray) ? clientsArray : []);
      setLeadsData(Array.isArray(leadsArray) ? leadsArray : []);

    } catch (err) {
      console.error("Error cargando datos:", err);
      setError("Error de conexión. Verifica que el backend esté corriendo.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch Data when filters change
  useEffect(() => {
    // Debounce search
    const timeoutId = setTimeout(() => {
        fetchData();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, agentFilter, statusFilter, activeTab, dateFrom, dateTo]);

  // Reset specific status filter when switching tabs
  const handleTabChange = (value: string) => {
      setActiveTab(value);
      setStatusFilter("all");
  };

  const handleExportPDF = () => {
    const isLeads = activeTab === "leads";
    const dataToExport = isLeads ? leadsData : clientsData;
    const title = isLeads ? "Reporte de Leads" : "Reporte de Clientes";

    if (dataToExport.length === 0) {
        alert("No hay datos para exportar");
        return;
    }

    const doc = new jsPDF();
    doc.setFontSize(12);
    doc.text(title, 14, 16);

    const tableColumn = ["Nombre", "Cédula", "Email", "Teléfono", "Estado"];

    const tableRows = dataToExport.map((item: any) => [
        item.name,
        item.cedula || "-",
        item.email,
        item.phone || "-",
        isLeads ? (item.lead_status?.name || item.lead_status_id) : (item.status || (item.is_active ? 'Activo' : 'Inactivo'))
    ]);

    autoTable(doc, {
        startY: 22,
        head: [tableColumn],
        body: tableRows,
    });

    doc.save(`${isLeads ? 'leads' : 'clientes'}_${Date.now()}.pdf`);
  };

  const handleClearFilters = () => {
      setSearchQuery("");
      setAgentFilter("all");
      setStatusFilter("all");
      setDateFrom("");
      setDateTo("");
  };

  // --- Add Lead Logic ---
  const openLeadDialog = () => {
    setLeadFormValues(createEmptyLeadForm());
    setIsLeadDialogOpen(true);
  };

  const closeLeadDialog = () => {
    setIsLeadDialogOpen(false);
    setLeadFormValues(createEmptyLeadForm());
  };

  // Opportunity Dialog State
  const [isOpportunityDialogOpen, setIsOpportunityDialogOpen] = useState(false);
  const [leadForOpportunity, setLeadForOpportunity] = useState<Lead | null>(null);
  const [opportunityAmount, setOpportunityAmount] = useState("");
  const [opportunityType, setOpportunityType] = useState("regular");

  const handleCreateOpportunity = async () => {
      if (!leadForOpportunity || !leadForOpportunity.cedula) {
          toast({ title: "Error", description: "El lead no tiene cédula válida.", variant: "destructive" });
          return;
      }
      if (!opportunityAmount) {
          toast({ title: "Error", description: "Ingresa un monto válido.", variant: "destructive" });
          return;
      }

      try {
          await api.post('/api/opportunities', {
              lead_cedula: leadForOpportunity.cedula,
              amount: parseFloat(opportunityAmount),
              opportunity_type: opportunityType,
              status: 'Abierta',
              assigned_to_id: leadForOpportunity.assigned_to_id
          });
          toast({ title: "Oportunidad creada", description: "La oportunidad ha sido registrada exitosamente." });
          setIsOpportunityDialogOpen(false);
          setOpportunityAmount("");
          setOpportunityType("regular");
      } catch (error) {
          console.error("Error creating opportunity:", error);
          toast({ title: "Error", description: "No se pudo crear la oportunidad.", variant: "destructive" });
      }
  };

  const handleLeadAction = (action: string, lead: Lead) => {
      switch (action) {
          case 'create_opportunity':
              setLeadForOpportunity(lead);
              setIsOpportunityDialogOpen(true);
              break;
          case 'edit':
              setLeadFormValues({
                  name: lead.name || "",
                  apellido1: lead.apellido1 || "",
                  apellido2: lead.apellido2 || "",
                  email: lead.email || "",
                  phone: lead.phone || "",
                  cedula: lead.cedula || "",
                  fechaNacimiento: lead.fecha_nacimiento || "",
              });
              setIsLeadDialogOpen(true);
              break;
          case 'view':
              // For now, just show a toast or reuse edit dialog in read-only mode
              // Let's reuse edit dialog for simplicity, maybe add a readOnly flag later
              setLeadFormValues({
                  name: lead.name || "",
                  apellido1: lead.apellido1 || "",
                  apellido2: lead.apellido2 || "",
                  email: lead.email || "",
                  phone: lead.phone || "",
                  cedula: lead.cedula || "",
                  fechaNacimiento: lead.fecha_nacimiento || "",
              });
              setIsLeadDialogOpen(true);
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
          toast({ 
              title: "¡Éxito! Lead convertido", 
              description: `${lead.name} ahora es un cliente activo.`,
              className: "bg-green-600 text-white border-none shadow-lg"
          });
          fetchData();
      } catch (error) {
          console.error("Error converting lead:", error);
          toast({ title: "Error", description: "No se pudo convertir el lead.", variant: "destructive" });
      }
  };

  const handleArchiveLead = async (lead: Lead) => {
      if (!confirm(`¿Estás seguro de archivar a ${lead.name}?`)) return;
      try {
          await api.patch(`/api/leads/${lead.id}/toggle-active`);
          toast({ title: "Lead archivado", description: `${lead.name} ha sido archivado.` });
          fetchData();
      } catch (error) {
          console.error("Error archiving lead:", error);
          toast({ title: "Error", description: "No se pudo archivar el lead.", variant: "destructive" });
      }
  };

  const handleLeadFieldChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setLeadFormValues((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleLeadSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = leadFormValues.name.trim();
    const trimmedEmail = leadFormValues.email.trim();

    if (!trimmedName || !trimmedEmail) {
      toast({
        title: "Faltan datos",
        description: "Ingresa al menos el nombre y el correo del lead.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSavingLead(true);

      const body = {
        name: trimmedName,
        email: trimmedEmail,
        cedula: normalizeCedulaInput(leadFormValues.cedula) || null,
        phone: leadFormValues.phone.trim() || null,
        apellido1: leadFormValues.apellido1.trim() || null,
        apellido2: leadFormValues.apellido2.trim() || null,
        status: "Nuevo",
        // Note: Backend expects 'fecha_nacimiento' if using the same controller logic as dsf3, 
        // but standard Laravel convention might be snake_case. 
        // Let's assume the backend handles it or we map it.
        // In dsf3 it was sending 'fecha_nacimiento'.
        fecha_nacimiento: leadFormValues.fechaNacimiento || null,
      };

      await api.post('/api/leads', body);

      toast({ title: "Lead creado", description: `${trimmedName} ya aparece en el panel.` });
      closeLeadDialog();
      fetchData(); // Reload list
    } catch (error: any) {
      console.error("Error creando lead:", error);
      const message = error.response?.data?.message || "No pudimos registrar el lead.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSavingLead(false);
    }
  };

  if (error) return <div className="p-8 text-center text-destructive">{error}</div>;

  return (
    <>
      <div className="space-y-6">
        <Card>
          <Collapsible open={showFilters} onOpenChange={setShowFilters} className="space-y-0">
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
                  <Button type="button" variant="ghost" size="sm" className="gap-2 hover:bg-gray-200/50">
                    {showFilters ? "Ocultar filtros" : "Mostrar filtros"}
                    {showFilters ? (
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
                      <Button variant="outline" onClick={handleClearFilters} className="hover:bg-gray-200/50">
                        Limpiar filtros
                      </Button>
                      <Button variant="secondary" onClick={handleExportPDF} className="gap-2 hover:bg-gray-200/50">
                        <Download className="h-4 w-4" />
                        Exportar
                      </Button>
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
                          <SelectTrigger>
                            <SelectValue placeholder="Todos los estados" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos los estados</SelectItem>
                            {leadStatuses.map(status => (
                              <SelectItem key={status.id} value={String(status.id)}>{status.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger>
                            <SelectValue placeholder="Todos los estados" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos los estados</SelectItem>
                            <SelectItem value="Activo">Activo</SelectItem>
                            <SelectItem value="Inactivo">Inactivo</SelectItem>
                            <SelectItem value="Cliente Premium">Cliente Premium</SelectItem>
                            <SelectItem value="Prospecto">Prospecto</SelectItem>
                            <SelectItem value="Descartado">Descartado</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Agente</Label>
                      <Select value={agentFilter} onValueChange={setAgentFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Todos los agentes" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos los agentes</SelectItem>
                          {agents.map(agent => (
                            <SelectItem key={agent.id} value={String(agent.id)}>{agent.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CollapsibleContent>

                <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
                  <TabsList className="grid grid-cols-2 w-[400px]">
                    <TabsTrigger value="leads" className="hover:bg-gray-200/50">Leads</TabsTrigger>
                    <TabsTrigger value="clientes" className="hover:bg-gray-200/50">Clientes</TabsTrigger>
                  </TabsList>

                  <TabsContent value="leads" className="space-y-4">
                    {loading ? <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div> : <LeadsTable data={leadsData} onAction={handleLeadAction} />}
                  </TabsContent>

                  <TabsContent value="clientes" className="space-y-4">
                    {loading ? <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div> : <ClientsTable data={clientsData} />}
                  </TabsContent>
                </Tabs>
              </div>
            </CardContent>
          </Collapsible>
        </Card>
      </div>

      <Dialog open={isLeadDialogOpen} onOpenChange={setIsLeadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar nuevo lead</DialogTitle>
            <DialogDescription>Captura los datos del contacto para comenzar el seguimiento.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleLeadSubmit}>
            <div className="space-y-2">
              <Label htmlFor="lead-cedula">Cédula</Label>
              <Input
                id="lead-cedula"
                value={leadFormValues.cedula}
                onChange={handleLeadFieldChange("cedula")}
                placeholder="0-0000-0000"
              />
              <p className="text-xs text-muted-foreground">Al ingresar la cédula completaremos los datos desde el TSE.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="lead-name">Nombre</Label>
                <Input id="lead-name" value={leadFormValues.name} onChange={handleLeadFieldChange("name")} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-apellido1">Primer apellido</Label>
                <Input
                  id="lead-apellido1"
                  value={leadFormValues.apellido1}
                  onChange={handleLeadFieldChange("apellido1")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-apellido2">Segundo apellido</Label>
                <Input
                  id="lead-apellido2"
                  value={leadFormValues.apellido2}
                  onChange={handleLeadFieldChange("apellido2")}
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
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-phone">Teléfono</Label>
                <Input id="lead-phone" value={leadFormValues.phone} onChange={handleLeadFieldChange("phone")} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="lead-birthdate">Fecha de nacimiento</Label>
                <Input
                  id="lead-birthdate"
                  type="text"
                  inputMode="numeric"
                  placeholder="DD-MM-AAAA"
                  value={leadFormValues.fechaNacimiento}
                  onChange={handleLeadFieldChange("fechaNacimiento")}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeLeadDialog} disabled={isSavingLead}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSavingLead}>
                {isSavingLead ? "Guardando..." : "Crear lead"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isOpportunityDialogOpen} onOpenChange={setIsOpportunityDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Oportunidad</DialogTitle>
            <DialogDescription>Registrar una nueva oportunidad para {leadForOpportunity?.name}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="opp-amount" className="text-right">Monto</Label>
              <Input 
                id="opp-amount" 
                placeholder="0.00" 
                className="col-span-3" 
                type="number"
                value={opportunityAmount}
                onChange={(e) => setOpportunityAmount(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="opp-type" className="text-right">Tipo</Label>
              <Select value={opportunityType} onValueChange={setOpportunityType}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Regular">Regular</SelectItem>
                  <SelectItem value="Micro-crédito">Micro-crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpportunityDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateOpportunity}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// --- Componentes de Tabla ---

function ClientsTable({ data }: { data: Client[] }) {
    if (data.length === 0) return <div className="text-center p-4 text-muted-foreground">No hay clientes registrados.</div>;

    return (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Cédula</TableHead>
              <TableHead className="hidden md:table-cell">Contacto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead><span className="sr-only">Acciones</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((client) => (
              <TableRow key={client.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={`https://ui-avatars.com/api/?name=${client.name}`} />
                      <AvatarFallback>{client.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="font-medium">{client.name}</div>
                  </div>
                </TableCell>
                <TableCell>{client.cedula}</TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="text-sm text-muted-foreground">{client.email}</div>
                  <div className="text-sm text-muted-foreground">{client.phone}</div>
                </TableCell>
                <TableCell>
                    <Badge variant={client.status === 'Activo' ? "default" : "secondary"}>
                        {client.status || (client.is_active ? 'Activo' : 'Inactivo')}
                    </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="hover:bg-gray-200/50"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                      <DropdownMenuItem className="hover:bg-gray-200/50">Ver Perfil</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
    )
}

function LeadsTable({ data, onAction }: { data: Lead[], onAction: (action: string, lead: Lead) => void }) {
    if (data.length === 0) return <div className="text-center p-4 text-muted-foreground">No hay leads registrados.</div>;

    return (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lead</TableHead>
              <TableHead>Cédula</TableHead>
              <TableHead className="hidden md:table-cell">Contacto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((lead) => (
              <TableRow key={lead.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                        <AvatarImage src={`https://ui-avatars.com/api/?name=${lead.name}&background=random`} />
                        <AvatarFallback>{lead.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="font-medium">{lead.name}</div>
                  </div>
                </TableCell>
                <TableCell>{lead.cedula}</TableCell>
                <TableCell className="hidden md:table-cell">
                    <div className="text-sm text-muted-foreground">{lead.email}</div>
                    <div className="text-sm text-muted-foreground">{lead.phone}</div>
                </TableCell>
                <TableCell>
                    <Badge variant="outline">
                        {lead.lead_status?.name || lead.lead_status_id || 'Nuevo'}
                    </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                      <Button 
                        size="icon" 
                        variant="outline" 
                        className="h-8 w-8 bg-yellow-50 border-yellow-200 text-yellow-600 hover:bg-yellow-100 hover:text-yellow-700" 
                        onClick={() => onAction('create_opportunity', lead)} 
                        title="Crear Oportunidad"
                      >
                          <Sparkles className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="outline" 
                        className="h-8 w-8 bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100 hover:text-blue-700" 
                        onClick={() => onAction('edit', lead)} 
                        title="Editar Lead"
                      >
                          <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="outline" 
                        className="h-8 w-8 bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-700" 
                        onClick={() => onAction('view', lead)} 
                        title="Ver Lead"
                      >
                          <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="outline" 
                        className="h-8 w-8 bg-green-50 border-green-200 text-green-600 hover:bg-green-100 hover:text-green-700" 
                        onClick={() => onAction('convert', lead)} 
                        title="Convertir a Cliente"
                      >
                          <UserCheck className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="outline" 
                        className="h-8 w-8 bg-red-50 border-red-200 text-red-600 hover:bg-red-100 hover:text-red-700" 
                        onClick={() => onAction('archive', lead)} 
                        title="Archivar"
                      >
                          <Archive className="h-4 w-4" />
                      </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
    );
}