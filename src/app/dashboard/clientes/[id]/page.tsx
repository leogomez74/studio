"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User as UserIcon, Save, Loader2, PanelRightClose, PanelRightOpen, ChevronDown, ChevronUp, Paperclip, Send, Smile, Pencil, Sparkles, Archive, FileText, Plus, CreditCard, Banknote, Calendar, CheckCircle2, Clock, AlertCircle, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { CaseChat } from "@/components/case-chat";
import { CreateOpportunityDialog } from "@/components/opportunities/create-opportunity-dialog";
import { DocumentManager } from "@/components/document-manager";

import api from "@/lib/axios";
import { Client, chatMessages, Lead } from "@/lib/data";
import { PROVINCES, Province, Canton, Location } from "@/lib/cr-locations";

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const id = params.id as string;
  const mode = searchParams.get("mode") || "view"; // view | edit
  const isEditMode = mode === "edit";

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<Client>>({});
  const [isPanelVisible, setIsPanelVisible] = useState(false);
  const [isOpportunitiesOpen, setIsOpportunitiesOpen] = useState(true);
  const [isOpportunityDialogOpen, setIsOpportunityDialogOpen] = useState(false);
  const [agents, setAgents] = useState<{id: number, name: string}[]>([]);
  const [deductoras, setDeductoras] = useState<{id: string, nombre: string}[]>([]);
  const [leads, setLeads] = useState<{id: number, name: string}[]>([]);

  // Credits and Payments state
  const [credits, setCredits] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // Refresh key to trigger data re-fetch without full page reload
  const [refreshKey, setRefreshKey] = useState(0);
  const refreshData = React.useCallback(() => setRefreshKey(k => k + 1), []);

  useEffect(() => {
    const fetchClient = async () => {
      try {
        const response = await api.get(`/api/clients/${id}`);
        setClient(response.data);
        setFormData(response.data);
      } catch (error) {
        console.error("Error fetching client:", error);
        toast({ title: "Error", description: "No se pudo cargar el cliente.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    const fetchAgents = async () => {
        try {
            const response = await api.get('/api/agents');
            setAgents(response.data);
        } catch (error) {
            console.error("Error fetching agents:", error);
        }
    };

    const fetchDeductoras = async () => {
        try {
            const response = await api.get('/api/deductoras');
            setDeductoras(response.data);
        } catch (error) {
            console.error("Error fetching deductoras:", error);
        }
    };

    const fetchLeads = async () => {
        try {
            const response = await api.get('/api/leads');
            const data = response.data.data || response.data;
            setLeads(data.map((l: any) => ({ id: l.id, name: l.name })));
        } catch (error) {
            console.error("Error fetching leads:", error);
        }
    };

    const fetchCredits = async () => {
        setLoadingCredits(true);
        try {
            const response = await api.get(`/api/credits?lead_id=${id}`);
            // Handle paginated response (response.data.data) or direct array (response.data)
            const creditsData = Array.isArray(response.data) ? response.data : (response.data.data || []);
            setCredits(creditsData);
        } catch (error) {
            console.error("Error fetching credits:", error);
            setCredits([]);
        } finally {
            setLoadingCredits(false);
        }
    };

    const fetchPayments = async () => {
        setLoadingPayments(true);
        try {
            // Use server-side filtering by passing client_id parameter
            const response = await api.get('/api/credit-payments', {
                params: { client_id: id }
            });
            const paymentsData = Array.isArray(response.data) ? response.data : (response.data?.data || []);
            setPayments(paymentsData);
        } catch (error) {
            console.error("Error fetching payments:", error);
            setPayments([]);
        } finally {
            setLoadingPayments(false);
        }
    };

    if (id) {
      fetchClient();
      fetchAgents();
      fetchDeductoras();
      fetchLeads();
      fetchCredits();
      fetchPayments();
    }
  }, [id, toast, refreshKey]);

  const leadName = React.useMemo(() => {
      if (!client || leads.length === 0) return null;
      const leadId = (client as any).lead_id || (client as any).relacionado_a;
      const found = leads.find(l => String(l.id) === String(leadId));
      return found?.name;
  }, [client, leads]);

  const handleInputChange = (field: keyof Client, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const selectedProvince = React.useMemo(() => 
    PROVINCES.find(p => p.name === formData.province), 
    [formData.province]
  );

  const selectedCanton = React.useMemo(() => 
    selectedProvince?.cantons.find(c => c.name === formData.canton), 
    [selectedProvince, formData.canton]
  );

  const cantons = selectedProvince?.cantons || [];
  const districts = selectedCanton?.districts || [];

  const handleProvinceChange = (value: string) => {
    setFormData(prev => ({ 
        ...prev, 
        province: value,
        canton: "",
        distrito: ""
    }));
  };

  const handleCantonChange = (value: string) => {
    setFormData(prev => ({ 
        ...prev, 
        canton: value,
        distrito: ""
    }));
  };

  const handleDistrictChange = (value: string) => {
    setFormData(prev => ({ ...prev, distrito: value }));
  };

  // Work Address Logic
  const selectedWorkProvince = React.useMemo(() => 
    PROVINCES.find(p => p.name === formData.trabajo_provincia), 
    [formData.trabajo_provincia]
  );

  const selectedWorkCanton = React.useMemo(() => 
    selectedWorkProvince?.cantons.find(c => c.name === formData.trabajo_canton), 
    [selectedWorkProvince, formData.trabajo_canton]
  );

  const workCantons = selectedWorkProvince?.cantons || [];
  const workDistricts = selectedWorkCanton?.districts || [];

  const handleWorkProvinceChange = (value: string) => {
    setFormData(prev => ({ 
        ...prev, 
        trabajo_provincia: value,
        trabajo_canton: "",
        trabajo_distrito: ""
    }));
  };

  const handleWorkCantonChange = (value: string) => {
    setFormData(prev => ({ 
        ...prev, 
        trabajo_canton: value,
        trabajo_distrito: ""
    }));
  };

  const handleWorkDistrictChange = (value: string) => {
    setFormData(prev => ({ ...prev, trabajo_distrito: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put(`/api/clients/${id}`, formData);
      toast({ title: "Guardado", description: "Cliente actualizado correctamente." });
      setClient(prev => ({ ...prev, ...formData } as Client));
      router.push(`/dashboard/clientes/${id}?mode=view`);
    } catch (error) {
      console.error("Error updating client:", error);
      toast({ title: "Error", description: "No se pudo guardar los cambios.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!client) return;
    if (!confirm(`¿Archivar a ${client.name}?`)) return;
    try {
      await api.patch(`/api/clients/${id}/toggle-active`);
      toast({ title: "Archivado", description: "Cliente archivado correctamente." });
      router.push('/dashboard/clientes');
    } catch (error) {
      console.error("Error archiving client:", error);
      toast({ title: "Error", description: "No se pudo archivar el cliente.", variant: "destructive" });
    }
  };

  const [activeTab, setActiveTab] = useState("datos");

  const handleViewExpediente = () => {
    setActiveTab("archivos");
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!client) {
    return <div className="p-8 text-center">Cliente no encontrado.</div>;
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.push('/dashboard/clientes')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span>volver al CRM</span>
        </div>
        <div className="flex items-center gap-2">
          {isEditMode && (
            <>
              <Button variant="ghost" onClick={() => router.push(`/dashboard/clientes/${id}?mode=view`)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar cambios
              </Button>
            </>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIsPanelVisible(!isPanelVisible)}
                >
                  {isPanelVisible ? (
                    <PanelRightClose className="h-4 w-4" />
                  ) : (
                    <PanelRightOpen className="h-4 w-4" />
                  )}
                  <span className="sr-only">Toggle Panel</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isPanelVisible ? 'Ocultar Panel' : 'Mostrar Panel'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className={isPanelVisible ? 'space-y-6 lg:col-span-3' : 'space-y-6 lg:col-span-5'}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="datos">Datos</TabsTrigger>
              <TabsTrigger value="creditos" className="flex items-center gap-1">
                <CreditCard className="h-3.5 w-3.5" />
                Créditos
                {credits.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{credits.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="pagos" className="flex items-center gap-1">
                <Banknote className="h-3.5 w-3.5" />
                Pagos
                {payments.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{payments.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="archivos">Archivos</TabsTrigger>
            </TabsList>
            
            <TabsContent value="datos">
              <Card>
                <div className="p-6 pb-0">
                <h1 className="text-2xl font-bold tracking-tight uppercase">{client.name} {(client as any).apellido1} {(client as any).apellido2}</h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <span>ID #{client.id}</span>
                    <span> · </span>
                    <span>{client.cedula}</span>
                    <span> · </span>
                    <span>Registrado {client.created_at ? new Date(client.created_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : 'N/A'}</span>
                </div>
                
                <div className="flex items-center gap-3 mt-4">
                    <Badge variant={client.is_active ? "default" : "secondary"} className="rounded-full px-3 font-normal">
                        {client.status || (client.is_active ? "Activo" : "Inactivo")}
                    </Badge>
                    <Badge variant="outline" className="rounded-full px-3 font-normal text-slate-600">
                        {leadName || client.relacionado_a || "Cliente"}
                    </Badge>

                    {!isEditMode && (
                        <div className="flex items-center gap-2 ml-1">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button size="icon" className="h-9 w-9 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border-0" onClick={() => router.push(`/dashboard/clientes/${id}?mode=edit`)}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Editar Cliente</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>

                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button 
                                            size="icon" 
                                            className="h-9 w-9 rounded-md bg-blue-900 text-white hover:bg-blue-800 border-0"
                                            onClick={() => setIsOpportunityDialogOpen(true)}
                                        >
                                            <Sparkles className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Crear Oportunidad</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>

                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            size="icon"
                                            className="h-9 w-9 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 border-0"
                                            onClick={handleViewExpediente}
                                        >
                                            <FileText className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Ver Expediente</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>

                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            size="icon"
                                            className="h-9 w-9 rounded-md bg-red-600 text-white hover:bg-red-700 border-0"
                                            onClick={handleArchive}
                                        >
                                            <Archive className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Archivar</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    )}
                </div>
            </div>
        <CardContent className="space-y-8">
          
          {/* Personal Information */}
          <div>
            <h3 className="text-lg font-medium mb-4">Datos Personales</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input 
                  value={formData.name || ""} 
                  onChange={(e) => handleInputChange("name", e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
              <div className="space-y-2">
                <Label>Primer Apellido</Label>
                <Input 
                  value={(formData as any).apellido1 || ""} 
                  onChange={(e) => handleInputChange("apellido1" as keyof Client, e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
              <div className="space-y-2">
                <Label>Segundo Apellido</Label>
                <Input 
                  value={(formData as any).apellido2 || ""} 
                  onChange={(e) => handleInputChange("apellido2" as keyof Client, e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
              <div className="space-y-2">
                <Label>Cédula</Label>
                <Input 
                  value={formData.cedula || ""} 
                  onChange={(e) => handleInputChange("cedula", e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
              <div className="space-y-2">
                <Label>Vencimiento Cédula</Label>
                <Input 
                  type="date"
                  value={(formData as any).cedula_vencimiento || ""} 
                  onChange={(e) => handleInputChange("cedula_vencimiento" as keyof Client, e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha de Nacimiento</Label>
                <Input 
                  type="date"
                  value={(formData as any).fecha_nacimiento ? String((formData as any).fecha_nacimiento).split('T')[0] : ""} 
                  onChange={(e) => handleInputChange("fecha_nacimiento" as keyof Client, e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
              <div className="space-y-2">
                <Label>Género</Label>
                {isEditMode ? (
                  <Select 
                    value={(formData as any).genero || ""} 
                    onValueChange={(value) => handleInputChange("genero" as keyof Client, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar género" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Masculino">Masculino</SelectItem>
                      <SelectItem value="Femenino">Femenino</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={(formData as any).genero || ""} disabled />
                )}
              </div>
              <div className="space-y-2">
                <Label>Nacionalidad</Label>
                <Input 
                  value={(formData as any).nacionalidad || ""} 
                  onChange={(e) => handleInputChange("nacionalidad" as keyof Client, e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
              <div className="space-y-2">
                <Label>Estado Civil</Label>
                {isEditMode ? (
                  <Select 
                    value={(formData as any).estado_civil || ""} 
                    onValueChange={(value) => handleInputChange("estado_civil" as keyof Client, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar estado civil" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Soltero(a)">Soltero(a)</SelectItem>
                      <SelectItem value="Casado(a)">Casado(a)</SelectItem>
                      <SelectItem value="Divorciado(a)">Divorciado(a)</SelectItem>
                      <SelectItem value="Viudo(a)">Viudo(a)</SelectItem>
                      <SelectItem value="Unión Libre">Unión Libre</SelectItem>
                      <SelectItem value="Otros">Otros</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={(formData as any).estado_civil || ""} disabled />
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Contact Information */}
          <div>
            <h3 className="text-lg font-medium mb-4">Información de Contacto</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input 
                  value={formData.email || ""} 
                  onChange={(e) => handleInputChange("email", e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
              <div className="space-y-2">
                <Label>Teléfono Móvil</Label>
                <Input 
                  value={formData.phone || ""} 
                  onChange={(e) => handleInputChange("phone", e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
              <div className="space-y-2">
                <Label>Teléfono 2</Label>
                <Input 
                  value={(formData as any).telefono2 || ""} 
                  onChange={(e) => handleInputChange("telefono2" as keyof Client, e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
              <div className="space-y-2">
                <Label>Teléfono 3</Label>
                <Input 
                  value={(formData as any).telefono3 || ""} 
                  onChange={(e) => handleInputChange("telefono3" as keyof Client, e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <Input 
                  value={formData.whatsapp || ""} 
                  onChange={(e) => handleInputChange("whatsapp", e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
              <div className="space-y-2">
                <Label>Teléfono Casa</Label>
                <Input 
                  value={(formData as any).tel_casa || ""} 
                  onChange={(e) => handleInputChange("tel_casa" as keyof Client, e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Address Information */}
          <div>
            <h3 className="text-lg font-medium mb-4">Dirección</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Provincia</Label>
                {isEditMode ? (
                  <Select 
                    value={(formData as any).province || ""} 
                    onValueChange={handleProvinceChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar provincia" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVINCES.map((p) => (
                        <SelectItem key={p.id} value={p.name}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={(formData as any).province || ""} disabled />
                )}
              </div>
              <div className="space-y-2">
                <Label>Cantón</Label>
                {isEditMode ? (
                  <Select 
                    value={(formData as any).canton || ""} 
                    onValueChange={handleCantonChange}
                    disabled={!selectedProvince}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar cantón" />
                    </SelectTrigger>
                    <SelectContent>
                      {cantons.map((c) => (
                        <SelectItem key={c.id} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={(formData as any).canton || ""} disabled />
                )}
              </div>
              <div className="space-y-2">
                <Label>Distrito</Label>
                {isEditMode ? (
                  <Select 
                    value={(formData as any).distrito || ""} 
                    onValueChange={handleDistrictChange}
                    disabled={!selectedCanton}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar distrito" />
                    </SelectTrigger>
                    <SelectContent>
                      {districts.map((d) => (
                        <SelectItem key={d.id} value={d.name}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={(formData as any).distrito || ""} disabled />
                )}
              </div>
              <div className="col-span-3 md:col-span-2 space-y-2">
                <Label>Dirección Exacta</Label>
                <Textarea 
                  value={formData.direccion1 || ""} 
                  onChange={(e) => handleInputChange("direccion1", e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
              <div className="col-span-3 md:col-span-1 space-y-2">
                <Label>Dirección 2 (Opcional)</Label>
                <Textarea 
                  value={(formData as any).direccion2 || ""} 
                  onChange={(e) => handleInputChange("direccion2" as keyof Client, e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Employment Information */}
          <div>
            <h3 className="text-lg font-medium mb-4">Información Laboral</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Nivel Académico</Label>
                <Input 
                  value={(formData as any).nivel_academico || ""} 
                  onChange={(e) => handleInputChange("nivel_academico" as keyof Client, e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
              <div className="space-y-2">
                <Label>Profesión</Label>
                <Input 
                  value={(formData as any).profesion || ""} 
                  onChange={(e) => handleInputChange("profesion" as keyof Client, e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
              <div className="space-y-2">
                <Label>Sector</Label>
                <Input 
                  value={(formData as any).sector || ""} 
                  onChange={(e) => handleInputChange("sector" as keyof Client, e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
              <div className="space-y-2">
                <Label>Puesto</Label>
                <Input 
                  value={(formData as any).puesto || ""} 
                  onChange={(e) => handleInputChange("puesto" as keyof Client, e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
              <div className="space-y-2">
                <Label>Estado del Puesto</Label>
                 <Select 
                    value={(formData as any).estado_puesto || ""} 
                    onValueChange={(value) => handleInputChange("estado_puesto" as keyof Client, value)}
                    disabled={!isEditMode}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar estado" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Propiedad">Propiedad</SelectItem>
                        <SelectItem value="Interino">Interino</SelectItem>
                        <SelectItem value="De paso">De paso</SelectItem>
                    </SelectContent>
                  </Select>
              </div>
               <div className="space-y-2">
                <Label>Institución</Label>
                <Input 
                  value={(formData as any).institucion_labora || ""} 
                  onChange={(e) => handleInputChange("institucion_labora" as keyof Client, e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
               <div className="space-y-2">
                <Label>Deductora</Label>
                {isEditMode ? (
                  <Select 
                    value={(formData as any).deductora_id || ""} 
                    onValueChange={(value) => handleInputChange("deductora_id" as keyof Client, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar deductora" />
                    </SelectTrigger>
                    <SelectContent>
                      {deductoras.map((deductora) => (
                        <SelectItem key={deductora.id} value={deductora.id}>
                          {deductora.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input 
                    value={deductoras.find(d => d.id === (formData as any).deductora_id)?.nombre || ""} 
                    disabled 
                  />
                )}
              </div>
               <div className="col-span-3 space-y-2">
                <Label>Dirección de la Institución</Label>
                <Textarea 
                  value={(formData as any).institucion_direccion || ""} 
                  onChange={(e) => handleInputChange("institucion_direccion" as keyof Client, e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
              
              {/* Work Address */}
               <div className="col-span-3">
                <h4 className="text-sm font-medium mb-2 mt-2">Dirección del Trabajo</h4>
               </div>
               <div className="space-y-2">
                <Label>Provincia</Label>
                {isEditMode ? (
                  <Select 
                    value={(formData as any).trabajo_provincia || ""} 
                    onValueChange={handleWorkProvinceChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar provincia" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVINCES.map((p) => (
                        <SelectItem key={p.id} value={p.name}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={(formData as any).trabajo_provincia || ""} disabled />
                )}
              </div>
              <div className="space-y-2">
                <Label>Cantón</Label>
                {isEditMode ? (
                  <Select 
                    value={(formData as any).trabajo_canton || ""} 
                    onValueChange={handleWorkCantonChange}
                    disabled={!selectedWorkProvince}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar cantón" />
                    </SelectTrigger>
                    <SelectContent>
                      {workCantons.map((c) => (
                        <SelectItem key={c.id} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={(formData as any).trabajo_canton || ""} disabled />
                )}
              </div>
              <div className="space-y-2">
                <Label>Distrito</Label>
                {isEditMode ? (
                  <Select 
                    value={(formData as any).trabajo_distrito || ""} 
                    onValueChange={handleWorkDistrictChange}
                    disabled={!selectedWorkCanton}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar distrito" />
                    </SelectTrigger>
                    <SelectContent>
                      {workDistricts.map((d) => (
                        <SelectItem key={d.id} value={d.name}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={(formData as any).trabajo_distrito || ""} disabled />
                )}
              </div>
               <div className="col-span-3 space-y-2">
                <Label>Dirección Exacta (Trabajo)</Label>
                <Textarea 
                  value={(formData as any).trabajo_direccion || ""} 
                  onChange={(e) => handleInputChange("trabajo_direccion" as keyof Client, e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>

              {/* Economic Activity */}
               <div className="col-span-3">
                <h4 className="text-sm font-medium mb-2 mt-2">Actividad Económica</h4>
               </div>
               <div className="space-y-2">
                <Label>Actividad Económica</Label>
                <Input 
                  value={(formData as any).actividad_economica || ""} 
                  onChange={(e) => handleInputChange("actividad_economica" as keyof Client, e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
               <div className="space-y-2">
                <Label>Tipo Sociedad</Label>
                {isEditMode ? (
                  <Select 
                    value={(formData as any).tipo_sociedad || ""} 
                    onValueChange={(value) => handleInputChange("tipo_sociedad" as keyof Client, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="S.R.L" textValue="Sociedad de Responsabilidad Limitada">S.R.L</SelectItem>
                      <SelectItem value="ECMAN" textValue="Empresa en Comandita">ECMAN</SelectItem>
                      <SelectItem value="LTDA" textValue="Limitada">LTDA</SelectItem>
                      <SelectItem value="OC" textValue="Optima Consultores">OC</SelectItem>
                      <SelectItem value="RL" textValue="Responsabilidad Limitada">RL</SelectItem>
                      <SelectItem value="SA" textValue="Sociedad Anónima">SA</SelectItem>
                      <SelectItem value="SACV" textValue="Sociedad Anónima de Capital Variable">SACV</SelectItem>
                      <SelectItem value="No indica" textValue="No indica">No indica</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={(formData as any).tipo_sociedad || ""} disabled />
                )}
              </div>
               <div className="col-span-3 space-y-2">
                <Label>Nombramientos</Label>
                <Textarea 
                  value={(formData as any).nombramientos || ""} 
                  onChange={(e) => handleInputChange("nombramientos" as keyof Client, e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>

            </div>
          </div>

          <Separator />

          {/* System & Other Information */}
          <div>
            <h3 className="text-lg font-medium mb-4">Otros Detalles</h3>
            <div className="grid gap-4 md:grid-cols-3">
              {/*<div className="space-y-2">*/}
              {/*  <Label>Estado</Label>*/}
              {/*  <Input */}
              {/*    value={formData.status || ""} */}
              {/*    onChange={(e) => handleInputChange("status", e.target.value)} */}
              {/*    disabled={!isEditMode} */}
              {/*  />*/}
              {/*</div>*/}
              {/*<div className="space-y-2">*/}
              {/*  <Label>Lead Status ID</Label>*/}
              {/*  <Input */}
              {/*    value={(formData as any).lead_status_id || ""} */}
              {/*    onChange={(e) => handleInputChange("lead_status_id" as keyof Client, e.target.value)} */}
              {/*    disabled={!isEditMode} */}
              {/*  />*/}
              {/*</div>*/}
              <div className="space-y-2">
                <Label>Responsable</Label>
                {isEditMode ? (
                  <Select 
                    value={String((formData as any).assigned_to_id || "")} 
                    onValueChange={(value) => handleInputChange("assigned_to_id" as keyof Client, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar responsable" />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.map((agent) => (
                        <SelectItem key={agent.id} value={String(agent.id)}>
                          {agent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input 
                    value={agents.find(a => a.id === (formData as any).assigned_to_id)?.name || (formData as any).assigned_to_id || ""} 
                    disabled 
                  />
                )}
              </div>
            </div>
          </div>

          <Separator className="my-6" />
          
          <div>
            <h3 className="text-lg font-medium mb-4">Información Adicional</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Fuente (Source)</Label>
                <Input 
                  value={(formData as any).source || ""} 
                  onChange={(e) => handleInputChange("source" as keyof Client, e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
              <div className="col-span-3 space-y-2">
                <Label>Notas</Label>
                <Textarea 
                  value={(formData as any).notes || ""} 
                  onChange={(e) => handleInputChange("notes" as keyof Client, e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
            </div>
          </div>

        </CardContent>
      </Card>
            </TabsContent>

            {/* Credits Tab */}
            <TabsContent value="creditos">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        Historial de Créditos
                      </CardTitle>
                      <CardDescription>Todos los créditos asociados a este cliente</CardDescription>
                    </div>
                    <Link href="/dashboard/creditos">
                      <Button variant="outline" size="sm">
                        <Plus className="h-4 w-4 mr-1" />
                        Nuevo Crédito
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingCredits ? (
                    <div className="flex justify-center p-8">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : credits.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-20" />
                      <p>No hay créditos registrados para este cliente.</p>
                      <Link href="/dashboard/creditos">
                        <Button variant="outline" size="sm" className="mt-4">
                          Crear primer crédito
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Summary Cards */}
                      <div className="grid gap-4 md:grid-cols-4">
                        <Card className="bg-blue-50 border-blue-100">
                          <CardContent className="p-4">
                            <div className="text-xs text-blue-600 font-medium">Total Créditos</div>
                            <div className="text-2xl font-bold text-blue-700">{credits.length}</div>
                          </CardContent>
                        </Card>
                        <Card className="bg-green-50 border-green-100">
                          <CardContent className="p-4">
                            <div className="text-xs text-green-600 font-medium">Monto Total</div>
                            <div className="text-2xl font-bold text-green-700">
                              {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(
                                credits.reduce((sum, c) => sum + (c.monto_credito || 0), 0)
                              )}
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-amber-50 border-amber-100">
                          <CardContent className="p-4">
                            <div className="text-xs text-amber-600 font-medium">Activos</div>
                            <div className="text-2xl font-bold text-amber-700">
                              {credits.filter(c => c.status !== 'Cancelado' && c.status !== 'Rechazado').length}
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-purple-50 border-purple-100">
                          <CardContent className="p-4">
                            <div className="text-xs text-purple-600 font-medium">Saldo Pendiente</div>
                            <div className="text-2xl font-bold text-purple-700">
                              {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(
                                credits.reduce((sum, c) => sum + (c.saldo || 0), 0)
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Credits Table */}
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Referencia</TableHead>
                              <TableHead>Tipo</TableHead>
                              <TableHead>Monto</TableHead>
                              <TableHead>Saldo</TableHead>
                              <TableHead>Plazo</TableHead>
                              <TableHead>Tasa</TableHead>
                              <TableHead>Estado</TableHead>
                              <TableHead>Fecha</TableHead>
                              <TableHead></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {credits.map((credit) => (
                              <TableRow key={credit.id} className="hover:bg-muted/50">
                                <TableCell className="font-medium">{credit.reference || credit.numero_operacion || `#${credit.id}`}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{credit.tipo_credito || credit.category || 'Regular'}</Badge>
                                </TableCell>
                                <TableCell className="font-mono">
                                  {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(credit.monto_credito || 0)}
                                </TableCell>
                                <TableCell className="font-mono">
                                  {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(credit.saldo || 0)}
                                </TableCell>
                                <TableCell>{credit.plazo} meses</TableCell>
                                <TableCell>{credit.tasa_anual || 0}%</TableCell>
                                <TableCell>
                                  <Badge
                                    variant={credit.status === 'Formalizado' || credit.status === 'Al día' ? 'default' :
                                             credit.status === 'En mora' ? 'destructive' :
                                             credit.status === 'Cancelado' ? 'secondary' : 'outline'}
                                    className={credit.status === 'Al día' ? 'bg-green-500' :
                                               credit.status === 'Formalizado' ? 'bg-blue-500' : ''}
                                  >
                                    {credit.status === 'Al día' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                                    {credit.status === 'En mora' && <AlertCircle className="h-3 w-3 mr-1" />}
                                    {credit.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                  {credit.opened_at ? new Date(credit.opened_at).toLocaleDateString('es-CR') : '-'}
                                </TableCell>
                                <TableCell>
                                  <Link href={`/dashboard/creditos/${credit.id}`}>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <ExternalLink className="h-4 w-4" />
                                    </Button>
                                  </Link>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Payments Tab */}
            <TabsContent value="pagos">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Banknote className="h-5 w-5" />
                    Historial de Pagos
                  </CardTitle>
                  <CardDescription>Todos los pagos realizados por este cliente</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingPayments ? (
                    <div className="flex justify-center p-8">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : payments.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Banknote className="h-12 w-12 mx-auto mb-4 opacity-20" />
                      <p>No hay pagos registrados para este cliente.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Payment Summary */}
                      <div className="grid gap-4 md:grid-cols-3">
                        <Card className="bg-green-50 border-green-100">
                          <CardContent className="p-4">
                            <div className="text-xs text-green-600 font-medium">Total Pagado</div>
                            <div className="text-2xl font-bold text-green-700">
                              {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(
                                payments.reduce((sum, p) => sum + (p.monto || 0), 0)
                              )}
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-blue-50 border-blue-100">
                          <CardContent className="p-4">
                            <div className="text-xs text-blue-600 font-medium">Número de Pagos</div>
                            <div className="text-2xl font-bold text-blue-700">{payments.length}</div>
                          </CardContent>
                        </Card>
                        <Card className="bg-purple-50 border-purple-100">
                          <CardContent className="p-4">
                            <div className="text-xs text-purple-600 font-medium">Último Pago</div>
                            <div className="text-2xl font-bold text-purple-700">
                              {payments.length > 0
                                ? new Date(payments[0].fecha || payments[0].created_at).toLocaleDateString('es-CR')
                                : '-'}
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Payments Table */}
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Fecha</TableHead>
                              <TableHead>Crédito</TableHead>
                              <TableHead>Monto</TableHead>
                              <TableHead>Capital</TableHead>
                              <TableHead>Interés</TableHead>
                              <TableHead>Mora</TableHead>
                              <TableHead>Origen</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {payments.map((payment) => (
                              <TableRow key={payment.id} className="hover:bg-muted/50">
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    {payment.fecha
                                      ? new Date(payment.fecha).toLocaleDateString('es-CR')
                                      : new Date(payment.created_at).toLocaleDateString('es-CR')}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Link href={`/dashboard/creditos/${payment.credit_id}`} className="text-primary hover:underline">
                                    {payment.credit?.reference || `#${payment.credit_id}`}
                                  </Link>
                                </TableCell>
                                <TableCell className="font-mono font-medium text-green-600">
                                  {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(payment.monto || 0)}
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                  {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(payment.capital_aplicado || 0)}
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                  {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(payment.interes_aplicado || 0)}
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                  {payment.mora_aplicada > 0 ? (
                                    <span className="text-red-500">
                                      {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(payment.mora_aplicada || 0)}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="font-normal">
                                    {payment.origen || 'Ventanilla'}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="archivos">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Paperclip className="h-5 w-5" />
                    Archivos del Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                   <DocumentManager
                      personId={parseInt(client.id)}
                      initialDocuments={(client as any).documents || []}
                   />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Side Panel */}
        {isPanelVisible && (
          <div className="space-y-6 lg:col-span-2 h-[calc(100vh-8rem)] flex flex-col">
            <Card className="flex-1 flex flex-col overflow-hidden border-0 shadow-none lg:border lg:shadow-sm">
              <Tabs defaultValue="comunicaciones" className="flex flex-col h-full">
                <div className="px-4 pt-4 border-b">
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="oportunidades">Oportunidades</TabsTrigger>
                    <TabsTrigger value="comunicaciones">Comunicaciones</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="oportunidades" className="flex-1 p-4 m-0 overflow-y-auto">
                  <div className="text-center text-muted-foreground py-8">
                    No hay oportunidades activas.
                    <div className="mt-4">
                        <Button variant="outline" size="sm" onClick={() => setIsOpportunityDialogOpen(true)}>
                            Crear oportunidad
                        </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="comunicaciones" className="flex-1 flex flex-col overflow-hidden m-0">
                  {/* Oportunidades Ligadas Accordion */}
                  <div className="border-b bg-white z-10">
                    <Collapsible
                      open={isOpportunitiesOpen}
                      onOpenChange={setIsOpportunitiesOpen}
                      className="w-full"
                    >
                      <div className="flex items-center justify-between px-4 py-3">
                        <h4 className="text-sm font-semibold text-foreground">Oportunidades ligadas</h4>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            {isOpportunitiesOpen ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                            <span className="sr-only">Toggle</span>
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                      <CollapsibleContent className="px-4 pb-3 space-y-2">
                        {client.opportunities && client.opportunities.length > 0 ? (
                          client.opportunities.map((opp) => (
                            <div key={opp.id} className="rounded-md border bg-muted/30 p-3 hover:bg-muted/50 transition-colors cursor-pointer">
                                <div className="flex justify-between items-start mb-1">
                                  <div>
                                      <p className="text-sm font-medium text-primary">{opp.opportunity_type || 'Oportunidad'}</p>
                                      <p className="text-xs text-muted-foreground">#{opp.id}</p>
                                  </div>
                                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100">{opp.status}</Badge>
                                </div>
                                <div className="flex justify-between text-xs text-muted-foreground">
                                  <span>Monto: {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(opp.amount)}</span>
                                  <span>{opp.created_at ? new Date(opp.created_at).toLocaleDateString() : ''}</span>
                                </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center text-sm text-muted-foreground py-2">
                            Aún no hay oportunidades para este lead.
                          </div>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  </div>

                  {/* Chat Area */}
                  <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50 relative">
                      {/* Messages */}
                      <div className="flex-1 overflow-y-auto p-4 space-y-4">
                          {chatMessages.map((msg, index) => (
                              <div
                                key={index}
                                className={`flex items-start gap-3 ${
                                  msg.senderType === 'agent' ? 'justify-end' : ''
                                }`}
                              >
                                {msg.senderType === 'client' && (
                                  <Avatar className="h-8 w-8 border bg-white">
                                    <AvatarImage src={msg.avatarUrl} />
                                    <AvatarFallback>{msg.senderName.charAt(0)}</AvatarFallback>
                                  </Avatar>
                                )}
                                <div
                                  className={`flex flex-col ${
                                    msg.senderType === 'agent' ? 'items-end' : 'items-start'
                                  }`}
                                >
                                  <div
                                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                                      msg.senderType === 'agent'
                                        ? 'bg-primary text-primary-foreground rounded-br-none'
                                        : 'bg-white border border-slate-100 rounded-bl-none'
                                    }`}
                                  >
                                    <p>{msg.text}</p>
                                  </div>
                                  <span className="mt-1 text-[10px] text-muted-foreground px-1">
                                    {msg.time}
                                  </span>
                                </div>
                              </div>
                          ))}
                      </div>

                      {/* Input Area */}
                      <div className="p-3 border-t bg-white">
                          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0">
                                  <Paperclip className="h-4 w-4" />
                              </Button>
                              <Input 
                                placeholder="Escribe un mensaje..." 
                                className="flex-1 h-9 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-2" 
                              />
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0">
                                  <Smile className="h-4 w-4" />
                              </Button>
                              <Button size="icon" className="h-8 w-8 shrink-0">
                                  <Send className="h-4 w-4" />
                              </Button>
                          </div>
                      </div>
                  </div>
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        )}
      </div>

      <CreateOpportunityDialog
        open={isOpportunityDialogOpen}
        onOpenChange={setIsOpportunityDialogOpen}
        leads={client ? [client as unknown as Lead] : []}
        defaultLeadId={client ? String(client.id) : undefined}
        onSuccess={() => {
            // Refresh client data to show new opportunity
            refreshData();
        }}
      />
    </div>
  );
}
