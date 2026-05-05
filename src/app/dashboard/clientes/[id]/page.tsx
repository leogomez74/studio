"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User as UserIcon, Save, Loader2, PanelRightClose, PanelRightOpen, ChevronDown, ChevronUp, Paperclip, Send, Smile, Pencil, Sparkles, Archive, FileText, Plus, CreditCard, Banknote, Calendar, CheckCircle2, Clock, AlertCircle, ExternalLink, ChevronsUpDown, Check, FileSpreadsheet, DollarSign, TrendingUp, Activity, PieChart, Target, Eye, Building2, Car, Home, Shield, Users, Search, RefreshCw } from "lucide-react";
import { generateEstadoCuenta } from "@/lib/pdf/estadoCuenta";
import { ReassignButton } from "@/components/ReassignButton";

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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { CaseChat } from "@/components/case-chat";
import { CreateOpportunityDialog } from "@/components/opportunities/create-opportunity-dialog";
import { DocumentManager } from "@/components/document-manager";
import { TareasTab } from "@/components/TareasTab";

import api from "@/lib/axios";
import { Client, Credit, CreditPayment, chatMessages, Lead, Opportunity, OPPORTUNITY_STATUSES } from "@/lib/data";
import { PROVINCES, Province, Canton, Location } from "@/lib/cr-locations";
import { hasActiveOpportunity, getActiveOpportunityMessage } from "@/lib/opportunity-helpers";

const PROFESIONES_LIST = [
  "Abogado(a)",
  "Actor/Actriz",
  "Administrador(a) de Empresas",
  "Administrador(a) de Fincas",
  "Administrador(a) Público",
  "Agrónomo(a)",
  "Analista de Datos",
  "Analista de Sistemas",
  "Antropólogo(a)",
  "Archivista",
  "Arquitecto(a)",
  "Asistente Administrativo(a)",
  "Asistente Dental",
  "Asistente Legal",
  "Auditor(a)",
  "Bibliotecólogo(a)",
  "Biólogo(a)",
  "Bombero(a)",
  "Cajero(a)",
  "Chef / Cocinero(a)",
  "Chofer / Conductor(a)",
  "Comunicador(a) Social",
  "Conserje",
  "Contador(a)",
  "Criminólogo(a)",
  "Dentista / Odontólogo(a)",
  "Desarrollador(a) de Software",
  "Diseñador(a) Gráfico",
  "Diseñador(a) Industrial",
  "Economista",
  "Educador(a)",
  "Electricista",
  "Enfermero(a)",
  "Escritor(a)",
  "Estadístico(a)",
  "Farmacéutico(a)",
  "Filólogo(a)",
  "Filósofo(a)",
  "Físico(a)",
  "Fisioterapeuta",
  "Fotógrafo(a)",
  "Funcionario(a) Público",
  "Geógrafo(a)",
  "Geólogo(a)",
  "Gestor(a) Ambiental",
  "Guarda de Seguridad",
  "Historiador(a)",
  "Ingeniero(a) Agrícola",
  "Ingeniero(a) Ambiental",
  "Ingeniero(a) Civil",
  "Ingeniero(a) Eléctrico",
  "Ingeniero(a) Electrónico",
  "Ingeniero(a) en Computación",
  "Ingeniero(a) en Sistemas",
  "Ingeniero(a) Industrial",
  "Ingeniero(a) Mecánico",
  "Ingeniero(a) Químico",
  "Investigador(a)",
  "Laboratorista",
  "Locutor(a)",
  "Matemático(a)",
  "Mecánico(a)",
  "Médico(a)",
  "Mercadólogo(a)",
  "Meteorólogo(a)",
  "Microbiólogo(a)",
  "Misceláneo(a)",
  "Músico(a)",
  "Notario(a)",
  "Nutricionista",
  "Obrero(a)",
  "Oficial de Seguridad",
  "Operador(a) de Maquinaria",
  "Optometrista",
  "Orientador(a)",
  "Paramédico(a)",
  "Pediatra",
  "Periodista",
  "Piloto",
  "Planificador(a)",
  "Policía",
  "Politólogo(a)",
  "Profesor(a)",
  "Profesor(a) Universitario",
  "Programador(a)",
  "Promotor(a) Social",
  "Psicólogo(a)",
  "Psiquiatra",
  "Publicista",
  "Químico(a)",
  "Radiólogo(a)",
  "Recepcionista",
  "Relacionista Público",
  "Secretario(a)",
  "Sociólogo(a)",
  "Soldador(a)",
  "Técnico(a) en Electrónica",
  "Técnico(a) en Enfermería",
  "Técnico(a) en Informática",
  "Técnico(a) en Mantenimiento",
  "Técnico(a) en Refrigeración",
  "Tecnólogo(a) Médico",
  "Teólogo(a)",
  "Terapeuta Ocupacional",
  "Topógrafo(a)",
  "Trabajador(a) Social",
  "Traductor(a)",
  "Vendedor(a)",
  "Veterinario(a)",
  "Otro",
].sort();


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
  const [deductoras, setDeductoras] = useState<{id: number, nombre: string}[]>([]);
  const [leads, setLeads] = useState<{id: number, name: string}[]>([]);
  const [instituciones, setInstituciones] = useState<{id: number, nombre: string}[]>([]);
  const [institucionSearch, setInstitucionSearch] = useState("");
  const [institucionOpen, setInstitucionOpen] = useState(false);
  const [profesionSearch, setProfesionSearch] = useState("");
  const [profesionOpen, setProfesionOpen] = useState(false);
  const [provinciaOpen, setProvinciaOpen] = useState(false);
  const [provinciaSearch, setProvinciaSearch] = useState("");
  const [cantonOpen, setCantonOpen] = useState(false);
  const [cantonSearch, setCantonSearch] = useState("");
  const [distritoOpen, setDistritoOpen] = useState(false);
  const [distritoSearch, setDistritoSearch] = useState("");
  const [workProvinciaOpen, setWorkProvinciaOpen] = useState(false);
  const [workProvinciaSearch, setWorkProvinciaSearch] = useState("");
  const [workCantonOpen, setWorkCantonOpen] = useState(false);
  const [workCantonSearch, setWorkCantonSearch] = useState("");
  const [workDistritoOpen, setWorkDistritoOpen] = useState(false);
  const [workDistritoSearch, setWorkDistritoSearch] = useState("");
  const [fieldStatus, setFieldStatus] = useState<Record<string, "editing" | "success" | "error">>({});
  const [focusedValue, setFocusedValue] = useState<Record<string, string>>({});

  // Datos Adicionales (Credid)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [datosAdicionales, setDatosAdicionales] = useState<any>(null);
  const [credidConsultadoAt, setCredidConsultadoAt] = useState<string | null>(null);
  const [consultandoCredid, setConsultandoCredid] = useState(false);

  // Credits and Payments state
  const [credits, setCredits] = useState<Credit[]>([]);
  const [payments, setPayments] = useState<CreditPayment[]>([]);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // Opportunities state
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loadingOpportunities, setLoadingOpportunities] = useState(false);
  const [oppSubTab, setOppSubTab] = useState<"activas" | "inactivas">("activas");

  // Balance General state
  const [selectedBalanceCreditId, setSelectedBalanceCreditId] = useState<number | null>(null);
  const [balanceData, setBalanceData] = useState<{
    credit_id: number;
    numero_operacion: string;
    client_name: string;
    monto_original: number;
    saldo_actual: number;
    total_capital_pagado: number;
    total_intereses_pagados: number;
    total_pagado: number;
    fecha_ultimo_pago: string | null;
    proximo_pago: { fecha: string; monto: number } | null;
    progreso_pagos: number;
  } | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  // Refresh key to trigger data re-fetch without full page reload
  const [refreshKey, setRefreshKey] = useState(0);
  const refreshData = React.useCallback(() => setRefreshKey(k => k + 1), []);

  const fetchClient = useCallback(async () => {
    try {
      const response = await api.get(`/api/clients/${id}`);
      setClient(response.data);
      setFormData(response.data);
      if (response.data.datos_adicionales) {
        setDatosAdicionales(response.data.datos_adicionales);
        setCredidConsultadoAt(response.data.credid_consultado_at);
      }
    } catch (error) {
      console.error("Error fetching client:", error);
      toast({ title: "Error", description: "No se pudo cargar el cliente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  const handleConsultarCredid = async () => {
    if (!client?.id) return;
    setConsultandoCredid(true);
    try {
      const response = await api.post(`/api/clients/${client.id}/consultar-credid`);
      setDatosAdicionales(response.data.datos_adicionales);
      setCredidConsultadoAt(response.data.credid_consultado_at);
      if (response.data.campos_actualizados?.length > 0) {
        toast({ title: "Datos actualizados", description: `Campos auto-llenados: ${response.data.campos_actualizados.join(', ')}` });
        fetchClient();
      } else {
        toast({ title: "Consulta exitosa", description: "Datos de Credid obtenidos correctamente." });
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast({ title: "Error", description: err.response?.data?.message || "No se pudo consultar Credid.", variant: "destructive" });
    } finally {
      setConsultandoCredid(false);
    }
  };

  useEffect(() => {

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
            const response = await api.get('/api/leads?all=true');
            const data = response.data.data || response.data;
            setLeads(data.map((l: { id: number; name: string }) => ({ id: l.id, name: l.name })));
        } catch (error) {
            console.error("Error fetching leads:", error);
        }
    };

    const fetchInstituciones = async () => {
        try {
            const response = await api.get('/api/instituciones');
            setInstituciones(response.data);
        } catch (error) {
            console.error("Error fetching instituciones:", error);
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
      fetchInstituciones();
      fetchCredits();
      fetchPayments();
    }
  }, [id, toast, refreshKey]);

  // Fetch opportunities when client data is available (needs cedula)
  useEffect(() => {
    if (!client?.cedula) return;
    const fetchOpportunities = async () => {
      setLoadingOpportunities(true);
      try {
        const response = await api.get('/api/opportunities', {
          params: { lead_cedula: client.cedula, per_page: 100, with_documents: true }
        });
        const data = Array.isArray(response.data) ? response.data : (response.data?.data || []);
        setOpportunities(data);
      } catch (error) {
        console.error("Error fetching opportunities:", error);
        setOpportunities([]);
      } finally {
        setLoadingOpportunities(false);
      }
    };
    fetchOpportunities();
  }, [client?.cedula, refreshKey]);

  const fetchBalance = async (creditId: number) => {
    setLoadingBalance(true);
    setBalanceData(null);
    try {
      const response = await api.get(`/api/credits/${creditId}/balance`);
      setBalanceData(response.data);
    } catch (error) {
      console.error("Error fetching balance:", error);
      setBalanceData(null);
    } finally {
      setLoadingBalance(false);
    }
  };

  const toggleBalance = (creditId: number) => {
    if (selectedBalanceCreditId === creditId) {
      setSelectedBalanceCreditId(null);
      setBalanceData(null);
    } else {
      setSelectedBalanceCreditId(creditId);
      fetchBalance(creditId);
    }
  };

  const leadName = React.useMemo(() => {
      if (!client || leads.length === 0) return null;
      const leadId = client.lead_id || client.relacionado_a;
      const found = leads.find(l => String(l.id) === String(leadId));
      return found?.name;
  }, [client, leads]);

  const REQUIRED_FIELDS = [
    'cedula', 'name', 'apellido1', 'email', 'phone', 'whatsapp', 'fecha_nacimiento', 'estado_civil',
    'profesion', 'nivel_academico', 'puesto', 'institucion_labora', 'sector',
    'province', 'canton', 'distrito', 'direccion1',
    'trabajo_provincia', 'trabajo_canton', 'trabajo_distrito', 'trabajo_direccion'
  ];

  const isFieldMissing = useCallback((field: string) => {
    if (!formData || !REQUIRED_FIELDS.includes(field)) return false;
    const value = (formData as Record<string, unknown>)[field];
    return value === null || value === undefined || value === '';
  }, [formData]);

  // Validar que al menos 1 referencia esté completa
  const hasAtLeastOneCompleteReference = useCallback(() => {
    if (!formData) return false;

    // Verificar Referencia 1
    const ref1Complete =
      formData.tel_amigo && formData.tel_amigo !== '' &&
      formData.relacionado_a && formData.relacionado_a !== '' &&
      formData.tipo_relacion && formData.tipo_relacion !== '';

    // Verificar Referencia 2
    const ref2Complete =
      formData.tel_amigo_2 && formData.tel_amigo_2 !== '' &&
      formData.relacionado_a_2 && formData.relacionado_a_2 !== '' &&
      formData.tipo_relacion_2 && formData.tipo_relacion_2 !== '';

    return ref1Complete || ref2Complete;
  }, [formData]);

  const getMissingDocuments = useCallback(() => {
    const documents = client?.documents || [];
    if (documents.length === 0) return ['Cédula', 'Cédula (Reverso)', 'Recibo de Servicio'];

    // Si ningún documento tiene categoría asignada (archivos viejos), no mostrar alerta
    const hasAnyCategory = documents.some((doc: any) => doc.category && doc.category !== 'otro');
    if (!hasAnyCategory) return [];

    const missing = [];
    const hasCedula = documents.some((doc: any) => doc.category === 'cedula');
    const hasCedulaReverso = documents.some((doc: any) => doc.category === 'cedula_reverso');
    const hasRecibo = documents.some((doc: any) => doc.category === 'recibo_servicio');

    if (!hasCedula) missing.push('Cédula');
    if (!hasCedulaReverso) missing.push('Cédula (Reverso)');
    if (!hasRecibo) missing.push('Recibo de Servicio');

    return missing;
  }, [client]);

  const getMissingFieldsCount = useCallback(() => {
    if (!formData) return 0;
    let count = REQUIRED_FIELDS.filter(field => {
      const value = (formData as Record<string, unknown>)[field];
      return value === null || value === undefined || value === '';
    }).length;

    // Agregar 1 si no hay al menos una referencia completa
    if (!hasAtLeastOneCompleteReference()) {
      count += 1;
    }

    return count;
  }, [formData, hasAtLeastOneCompleteReference]);

  const handleInputChange = (field: keyof Client, value: string | number | boolean | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Per-field autosave helpers
  const getFieldClass = (key: string) => {
    const status = fieldStatus[key];
    if (status === "editing") return "border-yellow-500 ring-1 ring-yellow-500 focus-visible:ring-yellow-500 transition-none";
    if (status === "success") return "border-green-500 ring-1 ring-green-500 focus-visible:ring-green-500 transition-none";
    if (status === "error") return "border-red-500 ring-1 ring-red-500 focus-visible:ring-red-500 transition-none";
    return "transition-colors duration-1000";
  };

  const handleInputFocus = (key: string, value: string) => {
    setFocusedValue(p => ({ ...p, [key]: value }));
    setFieldStatus(p => ({ ...p, [key]: "editing" }));
  };

  const handleSaveField = useCallback(async (key: string, newValue: string, skipFocusCheck = false) => {
    if (!isEditMode) return;
    if (!skipFocusCheck && focusedValue[key] === newValue) {
      setFieldStatus(p => { const next = { ...p }; delete next[key]; return next; });
      return;
    }
    const value: unknown = key === 'deductora_id' ? (newValue ? Number(newValue) : null) : newValue;
    try {
      await api.put(`/api/clients/${id}`, { [key]: value });
      setClient(prev => prev ? { ...prev, [key]: value } as Client : prev);
      setFieldStatus(p => ({ ...p, [key]: "success" }));
      setTimeout(() => {
        setFieldStatus(p => { if (p[key] === "success") { const next = { ...p }; delete next[key]; return next; } return p; });
      }, 2000);
    } catch {
      setFieldStatus(p => ({ ...p, [key]: "error" }));
      toast({ title: "Error", description: "No se pudo guardar el campo.", variant: "destructive" });
    }
  }, [id, isEditMode, focusedValue, toast]);

  const bindInput = (key: keyof Client) => ({
    value: String(formData[key] ?? ""),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setFormData(p => ({ ...p, [key]: e.target.value })),
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      handleInputFocus(String(key), e.target.value),
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      void handleSaveField(String(key), e.target.value),
    className: getFieldClass(String(key)),
    disabled: !isEditMode,
  });

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
    setFormData(prev => ({ ...prev, province: value, canton: "", distrito: "" }));
    if (isEditMode) setTimeout(autoSave, 100);
  };

  const handleCantonChange = (value: string) => {
    setFormData(prev => ({ ...prev, canton: value, distrito: "" }));
    if (isEditMode) setTimeout(autoSave, 100);
  };

  const handleDistrictChange = (value: string) => {
    setFormData(prev => ({ ...prev, distrito: value }));
    if (isEditMode) setTimeout(autoSave, 100);
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
    setFormData(prev => ({ ...prev, trabajo_provincia: value, trabajo_canton: "", trabajo_distrito: "" }));
    if (isEditMode) setTimeout(autoSave, 100);
  };

  const handleWorkCantonChange = (value: string) => {
    setFormData(prev => ({ ...prev, trabajo_canton: value, trabajo_distrito: "" }));
    if (isEditMode) setTimeout(autoSave, 100);
  };

  const handleWorkDistrictChange = (value: string) => {
    setFormData(prev => ({ ...prev, trabajo_distrito: value }));
    if (isEditMode) setTimeout(autoSave, 100);
  };

  // autoSave usado exclusivamente por cascade selects (province/canton/district)
  const autoSave = useCallback(async () => {
    if (!isEditMode) return;
    const EDITABLE_FIELDS = [
      'province', 'canton', 'distrito',
      'trabajo_provincia', 'trabajo_canton', 'trabajo_distrito',
    ];
    const payload: Record<string, unknown> = Object.fromEntries(
      Object.entries(formData).filter(([key]) => EDITABLE_FIELDS.includes(key))
    );
    try {
      await api.put(`/api/clients/${id}`, payload);
      setClient(prev => ({ ...prev, ...formData } as Client));
    } catch {
      toast({ title: "Error", description: "No se pudo guardar la ubicación.", variant: "destructive" });
    }
  }, [id, formData, isEditMode, toast]);

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

  // Verificar si hay créditos formalizados
  const hasFormalizedCredit = credits.some(c => c.status === 'Formalizado');

  // Función para exportar Estado de Cuenta (PDF) — usa la misma función que cobros
  const handleExportEstadoCuenta = async () => {
    const formalizedCredit = credits.find(c => c.status === 'Formalizado');
    if (!formalizedCredit) return;
    await generateEstadoCuenta(formalizedCredit.id!);
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
              {saving ? (
                <span className="flex items-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </span>
              ) : null}
              <Button variant="ghost" onClick={() => router.push(`/dashboard/clientes/${id}?mode=view`)}>Cancelar</Button>
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
            <TabsList className="grid w-full grid-cols-6 mb-4">
              <TabsTrigger value="datos" className="relative">
                Datos
                {getMissingFieldsCount() > 0 && (
                  <span className="ml-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {getMissingFieldsCount()}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="oportunidades" className="flex items-center gap-1">
                <Target className="h-3.5 w-3.5" />
                Oportunidades
                {opportunities.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{opportunities.length}</Badge>
                )}
              </TabsTrigger>
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
              <TabsTrigger value="tareas">Tareas</TabsTrigger>
              <TabsTrigger value="archivos" className="relative">
                Archivos
                {getMissingDocuments().length > 0 && (
                  <span className="ml-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {getMissingDocuments().length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="datos">
              <Card>
                <div className="p-6 pb-0">
                <h1 className="text-2xl font-bold tracking-tight uppercase">{client.name} {client.apellido1} {client.apellido2}</h1>
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

                    <ReassignButton
                      currentAssigneeId={formData.assigned_to_id ?? null}
                      currentAssigneeName={agents.find(a => a.id === formData.assigned_to_id)?.name ?? null}
                      agents={agents}
                      endpoint={`/api/clients/${client.id}`}
                      onReassigned={(id) => {
                        setClient(prev => prev ? { ...prev, assigned_to_id: id } : prev);
                        handleInputChange('assigned_to_id', id);
                      }}
                    />

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
                                            disabled={hasActiveOpportunity(opportunities)}
                                        >
                                            <Sparkles className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>{getActiveOpportunityMessage(opportunities) || "Crear Oportunidad"}</TooltipContent>
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

                            {hasFormalizedCredit && (
                              <TooltipProvider>
                                  <Tooltip>
                                      <TooltipTrigger asChild>
                                          <Button
                                              size="icon"
                                              className="h-9 w-9 rounded-md bg-blue-600 text-white hover:bg-blue-700 border-0"
                                              onClick={handleExportEstadoCuenta}
                                          >
                                              <FileSpreadsheet className="h-4 w-4" />
                                          </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Estado de Cuenta</TooltipContent>
                                  </Tooltip>
                              </TooltipProvider>
                            )}

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
                <Label>Nombre {isFieldMissing('name') && <span className="text-red-500">*</span>}</Label>
                <Input {...bindInput("name")} />
              </div>
              <div className="space-y-2">
                <Label>Primer Apellido {isFieldMissing('apellido1') && <span className="text-red-500">*</span>}</Label>
                <Input {...bindInput("apellido1")} />
              </div>
              <div className="space-y-2">
                <Label>Segundo Apellido</Label>
                <Input {...bindInput("apellido2")} />
              </div>
              <div className="space-y-2">
                <Label>Cédula {isFieldMissing('cedula') && <span className="text-red-500">*</span>}</Label>
                <Input {...bindInput("cedula")} />
              </div>
              <div className="space-y-2">
                <Label>Vencimiento Cédula</Label>
                <Input
                  type="date"
                  value={formData.cedula_vencimiento || ""}
                  onChange={(e) => setFormData(p => ({ ...p, cedula_vencimiento: e.target.value }))}
                  onFocus={(e) => handleInputFocus("cedula_vencimiento", e.target.value)}
                  onBlur={(e) => void handleSaveField("cedula_vencimiento", e.target.value)}
                  className={getFieldClass("cedula_vencimiento")}
                  disabled={!isEditMode}
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha de Nacimiento {isFieldMissing('fecha_nacimiento') && <span className="text-red-500">*</span>}</Label>
                <Input
                  type="date"
                  value={formData.fecha_nacimiento ? String(formData.fecha_nacimiento).split('T')[0] : ""}
                  onChange={(e) => setFormData(p => ({ ...p, fecha_nacimiento: e.target.value }))}
                  onFocus={(e) => handleInputFocus("fecha_nacimiento", e.target.value)}
                  onBlur={(e) => void handleSaveField("fecha_nacimiento", e.target.value)}
                  className={getFieldClass("fecha_nacimiento")}
                  disabled={!isEditMode}
                />
              </div>
              <div className="space-y-2">
                <Label>Género</Label>
                {isEditMode ? (
                  <Select
                    value={formData.genero || ""}
                    onValueChange={(value) => { handleInputChange("genero", value); void handleSaveField("genero", value, true); }}
                  >
                    <SelectTrigger className={getFieldClass("genero")}>
                      <SelectValue placeholder="Seleccionar género" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Masculino">Masculino</SelectItem>
                      <SelectItem value="Femenino">Femenino</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={formData.genero || ""} disabled />
                )}
              </div>
              <div className="space-y-2">
                <Label>Estado Civil {isFieldMissing('estado_civil') && <span className="text-red-500">*</span>}</Label>
                {isEditMode ? (
                  <Select
                    value={formData.estado_civil || ""}
                    onValueChange={(value) => { handleInputChange("estado_civil", value); void handleSaveField("estado_civil", value, true); }}
                  >
                    <SelectTrigger className={getFieldClass("estado_civil")}>
                      <SelectValue placeholder="Seleccionar estado civil" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Soltero(a)">Soltero(a)</SelectItem>
                      <SelectItem value="Casado(a)">Casado(a)</SelectItem>
                      <SelectItem value="Divorciado(a)">Divorciado(a)</SelectItem>
                      <SelectItem value="Viudo(a)">Viudo(a)</SelectItem>
                      <SelectItem value="Unión Libre">Unión Libre</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={formData.estado_civil || ""} disabled />
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
                <Label>Email {isFieldMissing('email') && <span className="text-red-500">*</span>}</Label>
                <Input {...bindInput("email")} />
              </div>
              <div className="space-y-2">
                <Label>Teléfono Móvil {isFieldMissing('phone') && <span className="text-red-500">*</span>}</Label>
                <Input {...bindInput("phone")} />
              </div>
              <div className="space-y-2">
                <Label>Teléfono 2</Label>
                <Input {...bindInput("telefono2")} />
              </div>
              <div className="space-y-2">
                <Label>Teléfono Amigo</Label>
                <Input {...bindInput("telefono3")} />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp {isFieldMissing('whatsapp') && <span className="text-red-500">*</span>}</Label>
                <Input {...bindInput("whatsapp")} />
              </div>
              <div className="space-y-2">
                <Label>Teléfono Casa</Label>
                <Input {...bindInput("tel_casa")} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Reference Information */}
          <div>
            <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
              Información de Referencia (Máx. 2)
            </h3>

            {/* Referencia 1 */}
            <div className="mb-6">
              <h4 className="text-sm font-medium mb-3 text-muted-foreground">Referencia 1</h4>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label>Número de Referencia</Label>
                  <Input {...bindInput("tel_amigo")} placeholder="Número telefónico" />
                </div>
                <div className="space-y-2">
                  <Label>Nombre de la Persona</Label>
                  <Input {...bindInput("relacionado_a")} placeholder="Nombre completo" />
                </div>
                <div className="space-y-2">
                  <Label>Relación</Label>
                  <Input {...bindInput("tipo_relacion")} placeholder="Ej: Amigo, Familiar" />
                </div>
              </div>
            </div>

            {/* Referencia 2 */}
            <div>
              <h4 className="text-sm font-medium mb-3 text-muted-foreground">Referencia 2</h4>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label>Número de Referencia</Label>
                  <Input {...bindInput("tel_amigo_2")} placeholder="Número telefónico" />
                </div>
                <div className="space-y-2">
                  <Label>Nombre de la Persona</Label>
                  <Input {...bindInput("relacionado_a_2")} placeholder="Nombre completo" />
                </div>
                <div className="space-y-2">
                  <Label>Relación</Label>
                  <Input {...bindInput("tipo_relacion_2")} placeholder="Ej: Amigo, Familiar" />
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Address Information */}
          <div>
            <h3 className="text-lg font-medium mb-4">Dirección</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Provincia {isFieldMissing('province') && <span className="text-red-500">*</span>}</Label>
                {isEditMode ? (
                  <Popover open={provinciaOpen} onOpenChange={setProvinciaOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                        {formData.province || "Seleccionar provincia"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[250px] p-0" align="start">
                      <div className="p-2 border-b"><Input placeholder="Buscar provincia..." value={provinciaSearch} onChange={e => setProvinciaSearch(e.target.value)} className="h-8" autoFocus /></div>
                      <div className="max-h-[200px] overflow-y-auto">
                        {PROVINCES.filter(p => p.name.toLowerCase().includes(provinciaSearch.toLowerCase())).map(p => (
                          <div key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent" onClick={() => { handleProvinceChange(p.name); setProvinciaOpen(false); setProvinciaSearch(""); }}>
                            {formData.province === p.name && <Check className="h-4 w-4 text-primary" />}{p.name}
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : (<Input value={formData.province || ""} disabled />)}
              </div>
              <div className="space-y-2">
                <Label>Cantón {isFieldMissing('canton') && <span className="text-red-500">*</span>}</Label>
                {isEditMode ? (
                  <Popover open={cantonOpen} onOpenChange={setCantonOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between font-normal" disabled={!selectedProvince}>
                        {formData.canton || "Seleccionar cantón"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[250px] p-0" align="start">
                      <div className="p-2 border-b"><Input placeholder="Buscar cantón..." value={cantonSearch} onChange={e => setCantonSearch(e.target.value)} className="h-8" autoFocus /></div>
                      <div className="max-h-[200px] overflow-y-auto">
                        {cantons.filter(c => c.name.toLowerCase().includes(cantonSearch.toLowerCase())).map(c => (
                          <div key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent" onClick={() => { handleCantonChange(c.name); setCantonOpen(false); setCantonSearch(""); }}>
                            {formData.canton === c.name && <Check className="h-4 w-4 text-primary" />}{c.name}
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : (<Input value={formData.canton || ""} disabled />)}
              </div>
              <div className="space-y-2">
                <Label>Distrito {isFieldMissing('distrito') && <span className="text-red-500">*</span>}</Label>
                {isEditMode ? (
                  <Popover open={distritoOpen} onOpenChange={setDistritoOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between font-normal" disabled={!selectedCanton}>
                        {formData.distrito || "Seleccionar distrito"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[250px] p-0" align="start">
                      <div className="p-2 border-b"><Input placeholder="Buscar distrito..." value={distritoSearch} onChange={e => setDistritoSearch(e.target.value)} className="h-8" autoFocus /></div>
                      <div className="max-h-[200px] overflow-y-auto">
                        {districts.filter(d => d.name.toLowerCase().includes(distritoSearch.toLowerCase())).map(d => (
                          <div key={d.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent" onClick={() => { handleDistrictChange(d.name); setDistritoOpen(false); setDistritoSearch(""); }}>
                            {formData.distrito === d.name && <Check className="h-4 w-4 text-primary" />}{d.name}
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : (<Input value={formData.distrito || ""} disabled />)}
              </div>
              <div className="col-span-3 md:col-span-2 space-y-2">
                <Label>Dirección Exacta {isFieldMissing('direccion1') && <span className="text-red-500">*</span>}</Label>
                <Textarea {...bindInput("direccion1")} />
              </div>
              <div className="col-span-3 md:col-span-1 space-y-2">
                <Label>Dirección 2 (Opcional)</Label>
                <Textarea {...bindInput("direccion2")} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Employment Information */}
          <div>
            <h3 className="text-lg font-medium mb-4">Información Laboral</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Nivel Académico {isFieldMissing('nivel_academico') && <span className="text-red-500">*</span>}</Label>
                {isEditMode ? (
                  <Select
                    value={formData.nivel_academico || ""}
                    onValueChange={(value) => { handleInputChange("nivel_academico", value); void handleSaveField("nivel_academico", value, true); }}
                  >
                    <SelectTrigger className={getFieldClass("nivel_academico")}>
                      <SelectValue placeholder="Seleccionar nivel académico" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primaria">Primaria</SelectItem>
                      <SelectItem value="secundaria">Secundaria</SelectItem>
                      <SelectItem value="tecnico">Técnico / Vocacional</SelectItem>
                      <SelectItem value="universitario">Universitario</SelectItem>
                      <SelectItem value="posgrado">Posgrado</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={formData.nivel_academico || ""}
                    disabled
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label>Profesión {isFieldMissing('profesion') && <span className="text-red-500">*</span>}</Label>
                {isEditMode ? (
                  <Popover open={profesionOpen} onOpenChange={setProfesionOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={profesionOpen}
                        className="w-full justify-between font-normal"
                      >
                        {formData.profesion || "Seleccionar profesión"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="start">
                      <div className="p-2 border-b">
                        <Input
                          placeholder="Buscar profesión..."
                          value={profesionSearch}
                          onChange={(e) => setProfesionSearch(e.target.value)}
                          className="h-8"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-[200px] overflow-y-auto">
                        {PROFESIONES_LIST
                          .filter(p => p.toLowerCase().includes(profesionSearch.toLowerCase()))
                          .map((prof) => (
                            <div
                              key={prof}
                              className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent"
                              onClick={() => {
                                handleInputChange("profesion", prof);
                                void handleSaveField("profesion", prof, true);
                                setProfesionOpen(false);
                                setProfesionSearch("");
                              }}
                            >
                              <Check className={`h-4 w-4 ${formData.profesion === prof ? "opacity-100" : "opacity-0"}`} />
                              {prof}
                            </div>
                          ))
                        }
                        {PROFESIONES_LIST.filter(p => p.toLowerCase().includes(profesionSearch.toLowerCase())).length === 0 && (
                          <div className="px-3 py-2 text-sm text-muted-foreground">No se encontraron resultados</div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <Input
                    value={formData.profesion || ""}
                    disabled
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label>Sector {isFieldMissing('sector') && <span className="text-red-500">*</span>}</Label>
                <Input {...bindInput("sector")} />
              </div>
              <div className="space-y-2">
                <Label>Puesto {isFieldMissing('puesto') && <span className="text-red-500">*</span>}</Label>
                <Input {...bindInput("puesto")} />
              </div>
              <div className="space-y-2">
                <Label>Nombramiento</Label>
                <Select
                  value={formData.estado_puesto || ""}
                  onValueChange={(value) => { handleInputChange("estado_puesto", value); void handleSaveField("estado_puesto", value, true); }}
                  disabled={!isEditMode}
                >
                  <SelectTrigger className={getFieldClass("estado_puesto")}>
                    <SelectValue placeholder="Seleccionar nombramiento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Propiedad">Propiedad</SelectItem>
                    <SelectItem value="Interino">Interino</SelectItem>
                    <SelectItem value="De paso">De paso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Institución {isFieldMissing('institucion_labora') && <span className="text-red-500">*</span>}</Label>
                {isEditMode ? (
                  <Popover open={institucionOpen} onOpenChange={setInstitucionOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={institucionOpen}
                        className="w-full justify-between font-normal"
                      >
                        {formData.institucion_labora || "Seleccionar institución"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="start">
                      <div className="p-2 border-b">
                        <Input
                          placeholder="Buscar institución..."
                          value={institucionSearch}
                          onChange={(e) => setInstitucionSearch(e.target.value)}
                          className="h-8"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-[200px] overflow-y-auto">
                        {instituciones
                          .filter(inst => inst.nombre.toLowerCase().includes(institucionSearch.toLowerCase()))
                          .sort((a, b) => a.nombre.localeCompare(b.nombre))
                          .map((inst) => (
                            <div
                              key={inst.id}
                              className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent"
                              onClick={() => {
                                handleInputChange("institucion_labora", inst.nombre);
                                void handleSaveField("institucion_labora", inst.nombre, true);
                                setInstitucionOpen(false);
                                setInstitucionSearch("");
                              }}
                            >
                              <Check className={`h-4 w-4 ${formData.institucion_labora === inst.nombre ? "opacity-100" : "opacity-0"}`} />
                              {inst.nombre}
                            </div>
                          ))
                        }
                        {instituciones.filter(inst => inst.nombre.toLowerCase().includes(institucionSearch.toLowerCase())).length === 0 && (
                          <div className="px-3 py-2 text-sm text-muted-foreground">No se encontraron resultados</div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <Input
                    value={formData.institucion_labora || ""}
                    disabled
                  />
                )}
              </div>

              {/* Work Address */}
               <div className="col-span-3">
                <h4 className="text-sm font-medium mb-2 mt-2">Dirección del Trabajo</h4>
               </div>
               <div className="space-y-2">
                <Label>Provincia {isFieldMissing('trabajo_provincia') && <span className="text-red-500">*</span>}</Label>
                {isEditMode ? (
                  <Popover open={workProvinciaOpen} onOpenChange={setWorkProvinciaOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                        {formData.trabajo_provincia || "Seleccionar provincia"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[250px] p-0" align="start">
                      <div className="p-2 border-b"><Input placeholder="Buscar provincia..." value={workProvinciaSearch} onChange={e => setWorkProvinciaSearch(e.target.value)} className="h-8" autoFocus /></div>
                      <div className="max-h-[200px] overflow-y-auto">
                        {PROVINCES.filter(p => p.name.toLowerCase().includes(workProvinciaSearch.toLowerCase())).map(p => (
                          <div key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent" onClick={() => { handleWorkProvinceChange(p.name); setWorkProvinciaOpen(false); setWorkProvinciaSearch(""); }}>
                            {formData.trabajo_provincia === p.name && <Check className="h-4 w-4 text-primary" />}{p.name}
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : (<Input value={formData.trabajo_provincia || ""} disabled />)}
              </div>
              <div className="space-y-2">
                <Label>Cantón {isFieldMissing('trabajo_canton') && <span className="text-red-500">*</span>}</Label>
                {isEditMode ? (
                  <Popover open={workCantonOpen} onOpenChange={setWorkCantonOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between font-normal" disabled={!selectedWorkProvince}>
                        {formData.trabajo_canton || "Seleccionar cantón"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[250px] p-0" align="start">
                      <div className="p-2 border-b"><Input placeholder="Buscar cantón..." value={workCantonSearch} onChange={e => setWorkCantonSearch(e.target.value)} className="h-8" autoFocus /></div>
                      <div className="max-h-[200px] overflow-y-auto">
                        {workCantons.filter(c => c.name.toLowerCase().includes(workCantonSearch.toLowerCase())).map(c => (
                          <div key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent" onClick={() => { handleWorkCantonChange(c.name); setWorkCantonOpen(false); setWorkCantonSearch(""); }}>
                            {formData.trabajo_canton === c.name && <Check className="h-4 w-4 text-primary" />}{c.name}
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : (<Input value={formData.trabajo_canton || ""} disabled />)}
              </div>
              <div className="space-y-2">
                <Label>Distrito {isFieldMissing('trabajo_distrito') && <span className="text-red-500">*</span>}</Label>
                {isEditMode ? (
                  <Popover open={workDistritoOpen} onOpenChange={setWorkDistritoOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between font-normal" disabled={!selectedWorkCanton}>
                        {formData.trabajo_distrito || "Seleccionar distrito"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[250px] p-0" align="start">
                      <div className="p-2 border-b"><Input placeholder="Buscar distrito..." value={workDistritoSearch} onChange={e => setWorkDistritoSearch(e.target.value)} className="h-8" autoFocus /></div>
                      <div className="max-h-[200px] overflow-y-auto">
                        {workDistricts.filter(d => d.name.toLowerCase().includes(workDistritoSearch.toLowerCase())).map(d => (
                          <div key={d.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent" onClick={() => { handleWorkDistrictChange(d.name); setWorkDistritoOpen(false); setWorkDistritoSearch(""); }}>
                            {formData.trabajo_distrito === d.name && <Check className="h-4 w-4 text-primary" />}{d.name}
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : (<Input value={formData.trabajo_distrito || ""} disabled />)}
              </div>
              <div className="col-span-3 space-y-2">
                <Label>Dirección Exacta (Trabajo) {isFieldMissing('trabajo_direccion') && <span className="text-red-500">*</span>}</Label>
                <Textarea {...bindInput("trabajo_direccion")} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Datos Adicionales (Credid) */}
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <Search className="h-5 w-5" />
                Datos Adicionales
                {credidConsultadoAt && (
                  <Badge variant="outline" className="text-xs font-normal">
                    Consultado: {new Date(credidConsultadoAt).toLocaleDateString('es-CR')}
                  </Badge>
                )}
                {formData.es_pep && <Badge className="bg-red-100 text-red-700 border-red-300">PEP</Badge>}
                {formData.en_listas_internacionales && <Badge className="bg-red-100 text-red-700 border-red-300">Listas Int.</Badge>}
              </h3>
              {datosAdicionales && (
                <Button size="sm" variant="outline" onClick={handleConsultarCredid} disabled={consultandoCredid || !formData.cedula}>
                  {consultandoCredid ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                  Actualizar
                </Button>
              )}
            </div>

            {!datosAdicionales && (
              <div className="mt-3 p-4 bg-muted/30 rounded-lg text-center">
                <p className="text-sm text-muted-foreground mb-2">No hay datos de Credid disponibles para este cliente.</p>
                <Button size="sm" variant="outline" onClick={handleConsultarCredid} disabled={consultandoCredid || !formData.cedula}>
                  {consultandoCredid ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                  Consultar Credid
                </Button>
              </div>
            )}

            {datosAdicionales && (
              <div className="mt-4 space-y-6">
                {/* Panel 1: Información Personal */}
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Información Personal
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {datosAdicionales.filiacion?.nacionalidad && (
                      <div><Label className="text-muted-foreground text-xs">Nacionalidad</Label><p className="text-sm">{datosAdicionales.filiacion.nacionalidad}</p></div>
                    )}
                    {datosAdicionales.filiacion?.fecha_nacimiento && (
                      <div><Label className="text-muted-foreground text-xs">Fecha de Nacimiento</Label><p className="text-sm">{datosAdicionales.filiacion.fecha_nacimiento} ({datosAdicionales.filiacion.edad} años)</p></div>
                    )}
                    {datosAdicionales.filiacion?.genero && (
                      <div><Label className="text-muted-foreground text-xs">Género</Label><p className="text-sm">{datosAdicionales.filiacion.genero}</p></div>
                    )}
                    {datosAdicionales.filiacion?.lugar_nacimiento && (
                      <div><Label className="text-muted-foreground text-xs">Lugar de Nacimiento</Label><p className="text-sm">{datosAdicionales.filiacion.lugar_nacimiento}</p></div>
                    )}
                    {datosAdicionales.filiacion?.vencimiento_cedula && (
                      <div>
                        <Label className="text-muted-foreground text-xs">Vencimiento Cédula</Label>
                        <p className={`text-sm ${new Date(datosAdicionales.filiacion.vencimiento_cedula) < new Date() ? 'text-red-600 font-semibold' : ''}`}>
                          {datosAdicionales.filiacion.vencimiento_cedula}
                          {new Date(datosAdicionales.filiacion.vencimiento_cedula) < new Date() && ' (VENCIDA)'}
                        </p>
                      </div>
                    )}
                    {datosAdicionales.filiacion?.indice_desarrollo_social != null && (
                      <div>
                        <Label className="text-muted-foreground text-xs">Índice Desarrollo Social</Label>
                        <div className="flex items-center gap-1 text-sm">
                          {datosAdicionales.filiacion.indice_desarrollo_social}
                          {datosAdicionales.filiacion.nivel_desarrollo_social && (
                            <Badge variant="outline" className="ml-2 text-xs">{datosAdicionales.filiacion.nivel_desarrollo_social}</Badge>
                          )}
                        </div>
                      </div>
                    )}
                    {datosAdicionales.filiacion?.domicilio_electoral?.provincia && (
                      <div><Label className="text-muted-foreground text-xs">Domicilio Electoral</Label><p className="text-sm">{datosAdicionales.filiacion.domicilio_electoral.distrito}, {datosAdicionales.filiacion.domicilio_electoral.canton}, {datosAdicionales.filiacion.domicilio_electoral.provincia}</p></div>
                    )}
                    {datosAdicionales.matrimonio_actual && (
                      <div><Label className="text-muted-foreground text-xs">Estado Civil</Label><p className="text-sm">{datosAdicionales.matrimonio_actual.relacion} — {datosAdicionales.matrimonio_actual.nombre}</p></div>
                    )}
                    {datosAdicionales.total_hijos != null && (
                      <div><Label className="text-muted-foreground text-xs">Total de Hijos</Label><p className="text-sm">{datosAdicionales.total_hijos}</p></div>
                    )}
                  </div>
                  {datosAdicionales.filiacion?.profesiones?.length > 0 && (
                    <div className="mt-2">
                      <Label className="text-muted-foreground text-xs">Profesiones Registradas</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {datosAdicionales.filiacion.profesiones.map((p: string, i: number) => (
                          <Badge key={i} variant="secondary" className="text-xs">{p}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {datosAdicionales.filiacion?.colegios_profesionales?.length > 0 && (
                    <div className="mt-2">
                      <Label className="text-muted-foreground text-xs">Colegios Profesionales</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {datosAdicionales.filiacion.colegios_profesionales.map((c: { colegio: string; estado: string }, i: number) => (
                          <Badge key={i} variant={c.estado === 'Activo' ? 'default' : 'outline'} className="text-xs">{c.colegio} ({c.estado})</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {datosAdicionales.filiacion?.defuncion && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                      <p className="text-sm text-red-700 font-semibold">PERSONA FALLECIDA — Fecha: {datosAdicionales.filiacion.defuncion.Fecha}</p>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Panel 2: Patrimonio */}
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Patrimonio
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <div className="p-3 bg-muted/50 rounded-lg text-center">
                      <Car className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-lg font-semibold">{datosAdicionales.vehiculos?.length || 0}</p>
                      <p className="text-xs text-muted-foreground">Vehículos</p>
                      {(datosAdicionales.vehiculos?.length > 0) && (
                        <p className="text-xs font-medium mt-1">₡{datosAdicionales.vehiculos.reduce((s: number, v: { valor_fiscal: number }) => s + v.valor_fiscal, 0).toLocaleString('es-CR')}</p>
                      )}
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg text-center">
                      <Home className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-lg font-semibold">{datosAdicionales.propiedades?.length || 0}</p>
                      <p className="text-xs text-muted-foreground">Propiedades</p>
                      {(datosAdicionales.propiedades?.length > 0) && (
                        <p className="text-xs font-medium mt-1">₡{datosAdicionales.propiedades.reduce((s: number, p: { valor_fiscal: number }) => s + p.valor_fiscal, 0).toLocaleString('es-CR')}</p>
                      )}
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground mb-1">Hipotecas</p>
                      <p className="text-lg font-semibold text-orange-600">
                        ₡{(datosAdicionales.propiedades?.reduce((s: number, p: { valor_hipotecas: number }) => s + p.valor_hipotecas, 0) || 0).toLocaleString('es-CR')}
                      </p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground mb-1">Prendas</p>
                      <p className="text-lg font-semibold text-orange-600">
                        ₡{(datosAdicionales.vehiculos?.reduce((s: number, v: { valor_prendas: number }) => s + v.valor_prendas, 0) || 0).toLocaleString('es-CR')}
                      </p>
                    </div>
                  </div>

                  {datosAdicionales.vehiculos?.length > 0 && (
                    <div className="mb-4">
                      <Label className="text-muted-foreground text-xs mb-2 block">Vehículos Propios</Label>
                      <div className="border rounded-md overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left p-2 font-medium">Tipo</th>
                              <th className="text-left p-2 font-medium">Placa</th>
                              <th className="text-left p-2 font-medium">Marca/Modelo</th>
                              <th className="text-left p-2 font-medium">Año</th>
                              <th className="text-right p-2 font-medium">Valor Fiscal</th>
                              <th className="text-right p-2 font-medium">Prendas</th>
                            </tr>
                          </thead>
                          <tbody>
                            {datosAdicionales.vehiculos.map((v: { tipo: string; placa: string; marca: string; modelo: string; anio: string; valor_fiscal: number; valor_prendas: number; embargos: number }, i: number) => (
                              <tr key={i} className="border-t">
                                <td className="p-2">{v.tipo}</td>
                                <td className="p-2 font-mono">{v.placa}</td>
                                <td className="p-2">{v.marca} {v.modelo}</td>
                                <td className="p-2">{v.anio}</td>
                                <td className="p-2 text-right">₡{v.valor_fiscal.toLocaleString('es-CR')}</td>
                                <td className="p-2 text-right">{v.valor_prendas > 0 ? `₡${v.valor_prendas.toLocaleString('es-CR')}` : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {datosAdicionales.propiedades?.length > 0 && (
                    <div className="mb-4">
                      <Label className="text-muted-foreground text-xs mb-2 block">Propiedades</Label>
                      <div className="border rounded-md overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left p-2 font-medium">Finca</th>
                              <th className="text-left p-2 font-medium">Ubicación</th>
                              <th className="text-right p-2 font-medium">Medida m²</th>
                              <th className="text-right p-2 font-medium">Valor Fiscal</th>
                              <th className="text-right p-2 font-medium">Hipotecas</th>
                              <th className="text-right p-2 font-medium">Embargos</th>
                            </tr>
                          </thead>
                          <tbody>
                            {datosAdicionales.propiedades.map((p: { numero: string; distrito: string; canton: string; provincia: string; medida: number; valor_fiscal: number; valor_hipotecas: number; embargos: number }, i: number) => (
                              <tr key={i} className="border-t">
                                <td className="p-2 font-mono">{p.numero}</td>
                                <td className="p-2">{p.distrito}, {p.canton}, {p.provincia}</td>
                                <td className="p-2 text-right">{p.medida?.toLocaleString('es-CR')}</td>
                                <td className="p-2 text-right">₡{p.valor_fiscal.toLocaleString('es-CR')}</td>
                                <td className="p-2 text-right">{p.valor_hipotecas > 0 ? `₡${p.valor_hipotecas.toLocaleString('es-CR')}` : '—'}</td>
                                <td className="p-2 text-right">{p.embargos > 0 ? <Badge variant="destructive" className="text-xs">{p.embargos}</Badge> : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {datosAdicionales.representaciones?.length > 0 && (
                    <div>
                      <Label className="text-muted-foreground text-xs mb-2 block">Representaciones en Sociedades</Label>
                      <div className="border rounded-md overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left p-2 font-medium">Sociedad</th>
                              <th className="text-left p-2 font-medium">Cédula Jurídica</th>
                              <th className="text-left p-2 font-medium">Puesto</th>
                            </tr>
                          </thead>
                          <tbody>
                            {datosAdicionales.representaciones.map((r: { nombre: string; identificacion: string; puesto: string }, i: number) => (
                              <tr key={i} className="border-t">
                                <td className="p-2">{r.nombre}</td>
                                <td className="p-2 font-mono">{r.identificacion}</td>
                                <td className="p-2">{r.puesto}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Panel 3: Cumplimiento */}
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Cumplimiento
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className={`p-3 rounded-lg border ${datosAdicionales.pep ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                      <p className="text-xs text-muted-foreground">PEP</p>
                      <p className={`text-sm font-semibold ${datosAdicionales.pep ? 'text-red-700' : 'text-green-700'}`}>
                        {datosAdicionales.pep ? `Sí — ${datosAdicionales.pep.puesto} (${datosAdicionales.pep.institucion})` : 'No'}
                      </p>
                    </div>
                    <div className={`p-3 rounded-lg border ${datosAdicionales.listas_internacionales?.total_exacto > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                      <p className="text-xs text-muted-foreground">Listas Internacionales</p>
                      <p className={`text-sm font-semibold ${datosAdicionales.listas_internacionales?.total_exacto > 0 ? 'text-red-700' : 'text-green-700'}`}>
                        {datosAdicionales.listas_internacionales?.total_exacto > 0
                          ? `${datosAdicionales.listas_internacionales.total_exacto} coincidencia(s)`
                          : 'Sin coincidencias'}
                      </p>
                      {datosAdicionales.listas_internacionales?.fuentes?.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {datosAdicionales.listas_internacionales.fuentes.map((f: { fuente: string; total: number }, i: number) => (
                            <Badge key={i} variant="destructive" className="text-xs">{f.fuente}: {f.total}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className={`p-3 rounded-lg border ${datosAdicionales.apnfd?.length > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
                      <p className="text-xs text-muted-foreground">APNFD</p>
                      <p className={`text-sm font-semibold ${datosAdicionales.apnfd?.length > 0 ? 'text-yellow-700' : 'text-green-700'}`}>
                        {datosAdicionales.apnfd?.length > 0
                          ? datosAdicionales.apnfd.map((a: { actividad: string }) => a.actividad).join(', ')
                          : 'No registrado'}
                      </p>
                    </div>
                  </div>
                  {datosAdicionales.ccss && (
                    <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                      <Label className="text-muted-foreground text-xs">CCSS Patronal</Label>
                      <p className="text-sm">Estado: {datosAdicionales.ccss.EstadoPatrono || 'N/A'} — Adeudado: {datosAdicionales.ccss.MontoAdeudado || '₡0'}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
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
              {/*    value={formData.lead_status_id || ""} */}
              {/*    onChange={(e) => handleInputChange("lead_status_id", e.target.value)} */}
              {/*    disabled={!isEditMode} */}
              {/*  />*/}
              {/*</div>*/}
              <div className="space-y-2">
                <Label>Responsable</Label>
                {isEditMode ? (
                  <Select
                    value={String(formData.assigned_to_id || "")}
                    onValueChange={(value) => { handleInputChange("assigned_to_id", value); void handleSaveField("assigned_to_id", value, true); }}
                  >
                    <SelectTrigger className={getFieldClass("assigned_to_id")}>
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
                    value={agents.find(a => a.id === formData.assigned_to_id)?.name || formData.assigned_to_id || ""} 
                    disabled 
                  />
                )}
              </div>
            </div>
          </div>

        </CardContent>
      </Card>
            </TabsContent>

            {/* Oportunidades Tab */}
            <TabsContent value="oportunidades">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5" />
                        Oportunidades
                      </CardTitle>
                      <CardDescription>Todas las oportunidades asociadas a este cliente</CardDescription>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <Button variant="outline" size="sm" onClick={() => setIsOpportunityDialogOpen(true)} disabled={hasActiveOpportunity(opportunities)}>
                              <Plus className="h-4 w-4 mr-1" />
                              Nueva Oportunidad
                            </Button>
                          </span>
                        </TooltipTrigger>
                        {hasActiveOpportunity(opportunities) && (
                          <TooltipContent>{getActiveOpportunityMessage(opportunities)}</TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingOpportunities ? (
                    <div className="flex justify-center p-8">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : opportunities.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Target className="h-12 w-12 mx-auto mb-4 opacity-20" />
                      <p>No hay oportunidades registradas para este cliente.</p>
                      <Button variant="outline" size="sm" className="mt-4" onClick={() => setIsOpportunityDialogOpen(true)}>
                        Crear primera oportunidad
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Summary Cards */}
                      <div className="grid gap-4 md:grid-cols-4">
                        <Card className="bg-blue-50 border-blue-100">
                          <CardContent className="p-4">
                            <div className="text-xs text-blue-600 font-medium">Total Oportunidades</div>
                            <div className="text-2xl font-bold text-blue-700">{opportunities.length}</div>
                          </CardContent>
                        </Card>
                        <Card className="bg-green-50 border-green-100">
                          <CardContent className="p-4">
                            <div className="text-xs text-green-600 font-medium">Monto Total</div>
                            <div className="text-2xl font-bold text-green-700">
                              {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(
                                opportunities.reduce((sum, o) => sum + (o.amount || 0), 0)
                              )}
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-amber-50 border-amber-100">
                          <CardContent className="p-4">
                            <div className="text-xs text-amber-600 font-medium">En Seguimiento</div>
                            <div className="text-2xl font-bold text-amber-700">
                              {opportunities.filter(o => o.status === 'En seguimiento').length}
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-purple-50 border-purple-100">
                          <CardContent className="p-4">
                            <div className="text-xs text-purple-600 font-medium">Analizadas</div>
                            <div className="text-2xl font-bold text-purple-700">
                              {opportunities.filter(o => o.status === 'Analizada').length}
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Sub-tabs Activas/Inactivas */}
                      <div className="flex gap-2 border-b pb-2">
                        <Button
                          variant={oppSubTab === "activas" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setOppSubTab("activas")}
                        >
                          Activas
                          <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                            {opportunities.filter(o => ['Pendiente', 'En seguimiento', 'Analizada'].includes(o.status)).length}
                          </Badge>
                        </Button>
                        <Button
                          variant={oppSubTab === "inactivas" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setOppSubTab("inactivas")}
                        >
                          Inactivas
                          <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                            {opportunities.filter(o => ['Ganada', 'Perdida', 'Cerrada'].includes(o.status)).length}
                          </Badge>
                        </Button>
                      </div>

                      {/* Opportunities Table */}
                      {(() => {
                        const filtered = oppSubTab === "activas"
                          ? opportunities.filter(o => ['Pendiente', 'En seguimiento', 'Analizada'].includes(o.status))
                          : opportunities.filter(o => ['Ganada', 'Perdida', 'Cerrada'].includes(o.status));

                        if (filtered.length === 0) {
                          return (
                            <div className="text-center py-8 text-muted-foreground">
                              <p>No hay oportunidades {oppSubTab === "activas" ? "activas" : "inactivas"}.</p>
                            </div>
                          );
                        }

                        return (
                          <div className="rounded-md border overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Referencia</TableHead>
                                  <TableHead>Tipo</TableHead>
                                  <TableHead>Monto</TableHead>
                                  <TableHead>Estado</TableHead>
                                  <TableHead>Documentos</TableHead>
                                  <TableHead>Cierre</TableHead>
                                  <TableHead>Creado</TableHead>
                                  <TableHead></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {filtered.map((opp) => {
                                  const missingDocs = opp.missing_documents || [];
                                  const statusColor =
                                    opp.status === 'Pendiente' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                    opp.status === 'En seguimiento' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                    opp.status === 'Analizada' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                                    opp.status === 'Ganada' ? 'bg-green-100 text-green-800 border-green-200' :
                                    opp.status === 'Perdida' ? 'bg-red-100 text-red-800 border-red-200' :
                                    'bg-gray-100 text-gray-800 border-gray-200';

                                  return (
                                    <TableRow key={opp.id} className="hover:bg-muted/50">
                                      <TableCell className="font-medium">
                                        <Link href={`/dashboard/oportunidades/${opp.id}`} className="text-primary hover:underline">
                                          {String(opp.id).padStart(6, '0')}
                                        </Link>
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant="outline">{opp.opportunity_type || opp.creditType || '-'}</Badge>
                                      </TableCell>
                                      <TableCell className="font-mono">
                                        {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(opp.amount || 0)}
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant="outline" className={statusColor}>
                                          {opp.status}
                                        </Badge>
                                      </TableCell>
                                      <TableCell>
                                        {missingDocs.length > 0 ? (
                                          <Badge variant="destructive" className="text-xs">
                                            Faltan {missingDocs.length}
                                          </Badge>
                                        ) : (
                                          <Badge variant="outline" className="text-xs border-green-200 text-green-700 bg-green-50">
                                            Completo
                                          </Badge>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-muted-foreground text-sm">
                                        {opp.expected_close_date
                                          ? new Date(opp.expected_close_date).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' })
                                          : '-'}
                                      </TableCell>
                                      <TableCell className="text-muted-foreground text-sm">
                                        {opp.created_at
                                          ? new Date(opp.created_at).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' })
                                          : '-'}
                                      </TableCell>
                                      <TableCell>
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Link href={`/dashboard/oportunidades/${opp.id}`}>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                  <Eye className="h-4 w-4" />
                                                </Button>
                                              </Link>
                                            </TooltipTrigger>
                                            <TooltipContent>Ver detalle</TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        );
                      })()}
                    </div>
                  )}
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
                              <React.Fragment key={credit.id}>
                                <TableRow className="hover:bg-muted/50">
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
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant={selectedBalanceCreditId === credit.id ? 'default' : 'ghost'}
                                        size="icon"
                                        className="h-8 w-8"
                                        title="Balance General"
                                        onClick={() => toggleBalance(credit.id!)}

                                      >
                                        <DollarSign className="h-4 w-4" />
                                      </Button>
                                      <Link href={`/dashboard/creditos/${credit.id}`}>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                          <ExternalLink className="h-4 w-4" />
                                        </Button>
                                      </Link>
                                    </div>
                                  </TableCell>
                                </TableRow>
                                {/* Balance General expandible */}
                                {selectedBalanceCreditId === credit.id && (
                                  <TableRow>
                                    <TableCell colSpan={9} className="p-0 border-b-2 border-blue-200">
                                      <div className="bg-slate-50 p-6 space-y-6">
                                        {loadingBalance ? (
                                          <div className="flex justify-center py-8">
                                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                          </div>
                                        ) : !balanceData ? (
                                          <p className="text-center text-muted-foreground py-4">No hay información de balance disponible.</p>
                                        ) : (
                                          <>
                                            <div className="flex items-center justify-between">
                                              <h3 className="text-lg font-bold tracking-tight">Balance General</h3>
                                              <span className="text-sm text-muted-foreground">Op: {balanceData.numero_operacion}</span>
                                            </div>
                                            {/* Stats Grid */}
                                            <div className="grid gap-4 md:grid-cols-4">
                                              <Card>
                                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                  <CardTitle className="text-sm font-medium">Saldo Actual</CardTitle>
                                                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                </CardHeader>
                                                <CardContent>
                                                  <div className="text-2xl font-bold">
                                                    {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(balanceData.saldo_actual)}
                                                  </div>
                                                  <p className="text-xs text-muted-foreground">
                                                    De un original de {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(balanceData.monto_original)}
                                                  </p>
                                                </CardContent>
                                              </Card>
                                              <Card>
                                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                  <CardTitle className="text-sm font-medium">Capital Pagado</CardTitle>
                                                  <TrendingUp className="h-4 w-4 text-green-500" />
                                                </CardHeader>
                                                <CardContent>
                                                  <div className="text-2xl font-bold">
                                                    {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(balanceData.total_capital_pagado)}
                                                  </div>
                                                  <p className="text-xs text-muted-foreground">Amortización principal</p>
                                                </CardContent>
                                              </Card>
                                              <Card>
                                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                  <CardTitle className="text-sm font-medium">Intereses Pagados</CardTitle>
                                                  <Activity className="h-4 w-4 text-blue-500" />
                                                </CardHeader>
                                                <CardContent>
                                                  <div className="text-2xl font-bold">
                                                    {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(balanceData.total_intereses_pagados)}
                                                  </div>
                                                  <p className="text-xs text-muted-foreground">Costo financiero acumulado</p>
                                                </CardContent>
                                              </Card>
                                              <Card>
                                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                  <CardTitle className="text-sm font-medium">Progreso</CardTitle>
                                                  <PieChart className="h-4 w-4 text-muted-foreground" />
                                                </CardHeader>
                                                <CardContent>
                                                  <div className="text-2xl font-bold">{balanceData.progreso_pagos}%</div>
                                                  <Progress value={balanceData.progreso_pagos} className="mt-2 h-2" />
                                                </CardContent>
                                              </Card>
                                            </div>
                                            {/* Detail Cards */}
                                            <div className="grid gap-6 md:grid-cols-2">
                                              <Card>
                                                <CardHeader>
                                                  <CardTitle className="text-base">Estado de Pagos</CardTitle>
                                                  <CardDescription>Resumen de la actividad reciente</CardDescription>
                                                </CardHeader>
                                                <CardContent className="space-y-4">
                                                  <div className="flex items-center justify-between border-b pb-4">
                                                    <div className="space-y-1">
                                                      <p className="text-sm font-medium leading-none">Último Pago Realizado</p>
                                                      <p className="text-sm text-muted-foreground">Fecha de aplicación</p>
                                                    </div>
                                                    <div className="font-medium">
                                                      {balanceData.fecha_ultimo_pago
                                                        ? new Intl.DateTimeFormat('es-CR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(balanceData.fecha_ultimo_pago))
                                                        : '-'}
                                                    </div>
                                                  </div>
                                                  <div className="flex items-center justify-between pt-2">
                                                    <div className="space-y-1">
                                                      <p className="text-sm font-medium leading-none">Próximo Pago</p>
                                                      <p className="text-sm text-muted-foreground">Vencimiento estimado</p>
                                                    </div>
                                                    <div className="text-right">
                                                      <div className="font-medium">
                                                        {balanceData.proximo_pago?.fecha
                                                          ? new Intl.DateTimeFormat('es-CR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(balanceData.proximo_pago.fecha))
                                                          : '-'}
                                                      </div>
                                                      <div className="text-sm text-muted-foreground">
                                                        {balanceData.proximo_pago?.monto
                                                          ? new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(balanceData.proximo_pago.monto)
                                                          : '-'}
                                                      </div>
                                                    </div>
                                                  </div>
                                                </CardContent>
                                              </Card>
                                              <Card>
                                                <CardHeader>
                                                  <CardTitle className="text-base">Resumen Financiero</CardTitle>
                                                  <CardDescription>Distribución total de pagos</CardDescription>
                                                </CardHeader>
                                                <CardContent>
                                                  <div className="space-y-4">
                                                    <div className="flex items-center justify-between">
                                                      <span className="text-sm font-medium">Total Pagado (Bruto)</span>
                                                      <span className="font-bold">
                                                        {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(balanceData.total_pagado)}
                                                      </span>
                                                    </div>
                                                    <div className="h-[1px] bg-border" />
                                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                                      <div>
                                                        <span className="text-muted-foreground">Capital:</span>
                                                        <div className="font-medium">
                                                          {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(balanceData.total_capital_pagado)}
                                                        </div>
                                                      </div>
                                                      <div>
                                                        <span className="text-muted-foreground">Intereses:</span>
                                                        <div className="font-medium">
                                                          {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(balanceData.total_intereses_pagados)}
                                                        </div>
                                                      </div>
                                                    </div>
                                                  </div>
                                                </CardContent>
                                              </Card>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </React.Fragment>
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
                                ? new Date(payments[0].fecha || payments[0].created_at || '').toLocaleDateString('es-CR')
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
                                      : new Date(payment.created_at || '').toLocaleDateString('es-CR')}
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
                                  {(payment.mora_aplicada ?? 0) > 0 ? (
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

            <TabsContent value="tareas">
              <TareasTab projectCode={`CLIENT-${client.id}`} entityLabel="del Cliente" />
            </TabsContent>

            <TabsContent value="archivos">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Paperclip className="h-5 w-5" />
                    Archivos del Cliente
                  </CardTitle>
                </CardHeader>
                {getMissingDocuments().length > 0 && (
                  <div className="px-6 pb-4">
                    <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-900">Documentos obligatorios faltantes</p>
                        <p className="text-sm text-red-700 mt-1">
                          {getMissingDocuments().map((doc, i) => (
                            <span key={doc}>
                              {i > 0 && ', '}
                              <span className="font-semibold">{doc}</span>
                            </span>
                          ))}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                <CardContent>
                   <DocumentManager
                      personId={parseInt(client.id)}
                      initialDocuments={(client.documents || []).map(doc => ({ id: doc.id, name: doc.name, created_at: doc.file_created_at || '', url: doc.url, mime_type: doc.mime_type }))}
                      onDocumentChange={fetchClient}
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
                    {hasActiveOpportunity(opportunities) ? "Ya existe una oportunidad activa." : "No hay oportunidades activas."}
                    <div className="mt-4">
                        <Button variant="outline" size="sm" onClick={() => setIsOpportunityDialogOpen(true)} disabled={hasActiveOpportunity(opportunities)}>
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
