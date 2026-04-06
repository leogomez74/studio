"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, User as UserIcon, Save, Loader2, PanelRightClose, PanelRightOpen, Pencil, Sparkles, Archive, Plus, Paperclip, RefreshCw, ChevronsUpDown, Check, Eye, X, AlertCircle, Handshake, DollarSign, Building2, Car, Home, Shield, Users, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
import { useToast } from "@/hooks/use-toast";
import { CaseChat } from "@/components/case-chat";
import { CreateOpportunityDialog } from "@/components/opportunities/create-opportunity-dialog";
import { DocumentManager } from "@/components/document-manager";
import { PermissionButton } from "@/components/PermissionButton";
import { usePermissions } from "@/contexts/PermissionsContext";

import api from "@/lib/axios";
import { Lead } from "@/lib/data";
import { COSTA_RICA_PROVINCES, getProvinceOptions, getCantonOptions, getDistrictOptions } from '@/lib/costa-rica-regions';
import { hasActiveOpportunity, getActiveOpportunityMessage } from "@/lib/opportunity-helpers";
import { TareasTab } from '@/components/TareasTab';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

export default function LeadDetailPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const { hasPermission, permissions, loading: permsLoading } = usePermissions();

    // Force re-eval
    const id = params.id as string;
    const mode = searchParams.get("mode") || "view"; // view | edit
    // Solo permitir modo edición si tiene permiso
    const canEdit = hasPermission('crm', 'edit');
    const canArchive = hasPermission('crm', 'archive');
    const isEditMode = mode === "edit" && canEdit;

    const [lead, setLead] = useState<Lead | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState<Partial<Lead>>({});
    const formDataRef = useRef<Partial<Lead>>({});
    const [isPanelVisible, setIsPanelVisible] = useState(false);
    const [isOpportunityDialogOpen, setIsOpportunityDialogOpen] = useState(false);
    const [agents, setAgents] = useState<{id: number, name: string}[]>([]);
    const [deductoras, setDeductoras] = useState<{id: number, nombre: string}[]>([]);
    const [instituciones, setInstituciones] = useState<{id: number, nombre: string}[]>([]);
    const [institucionSearch, setInstitucionSearch] = useState("");
    const [institucionOpen, setInstitucionOpen] = useState(false);
    const [profesionSearch, setProfesionSearch] = useState("");
    const [profesionOpen, setProfesionOpen] = useState(false);
    const [opportunities, setOpportunities] = useState<{id: string, opportunity_type: string, status: string, amount?: number}[]>([]);
    const [syncing, setSyncing] = useState(false);
    const [opportunitiesModalOpen, setOpportunitiesModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<string>("datos");
    // Datos Adicionales (Credid)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [datosAdicionales, setDatosAdicionales] = useState<any>(null);
    const [credidConsultadoAt, setCredidConsultadoAt] = useState<string | null>(null);
    const [consultandoCredid, setConsultandoCredid] = useState(false);

    // Formatear teléfono CR: XXXX-XXXX
    const formatPhoneCR = (value: string | null | undefined): string => {
        if (!value) return '';
        const digits = value.replace(/\D/g, '');
        if (digits.length <= 4) return digits;
        if (digits.length <= 8) return digits.slice(0, 4) + '-' + digits.slice(4);
        return digits; // Números internacionales sin formatear
    };

    const parsePhone = (value: string): string => {
        return value.replace(/\D/g, '');
    };

    // Validar si el registro está completo
    const REQUIRED_FIELDS = [
        'cedula', 'name', 'apellido1', 'email', 'phone', 'whatsapp', 'fecha_nacimiento', 'estado_civil',
        'profesion', 'nivel_academico', 'puesto', 'estado_puesto', 'institucion_labora', 'sector',
        'province', 'canton', 'distrito', 'direccion1',
        'trabajo_provincia', 'trabajo_canton', 'trabajo_distrito', 'trabajo_direccion'
    ];

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

    const checkIsComplete = useCallback(() => {
        if (!formData) return false;
        const allFieldsFilled = REQUIRED_FIELDS.every(field => {
            const value = (formData as Record<string, unknown>)[field];
            return value !== null && value !== undefined && value !== '';
        });
        const hasReference = hasAtLeastOneCompleteReference();
        return allFieldsFilled && hasReference;
    }, [formData, hasAtLeastOneCompleteReference]);

    const isFieldMissing = useCallback((field: string) => {
        if (!formData || !REQUIRED_FIELDS.includes(field)) return false;
        const value = (formData as Record<string, unknown>)[field];
        return value === null || value === undefined || value === '';
    }, [formData]);

    // Verificar completitud por sección
    const isSectionComplete = useCallback((fields: string[]) => {
        if (!formData) return false;
        return fields.every(field => !isFieldMissing(field));
    }, [formData, isFieldMissing]);

    const personalFields = ['name', 'apellido1', 'cedula', 'fecha_nacimiento', 'estado_civil'];
    const contactFields = ['email', 'phone', 'whatsapp'];
    const addressFields = ['province', 'canton', 'distrito', 'direccion1'];
    const employmentFields = ['profesion', 'nivel_academico', 'puesto', 'estado_puesto', 'institucion_labora', 'sector', 'trabajo_provincia', 'trabajo_canton', 'trabajo_distrito', 'trabajo_direccion'];

    const getMissingDocuments = useCallback(() => {
        const documents = lead?.documents || [];
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
    }, [lead]);

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

    // Protección: redirigir si intenta editar sin permiso
    useEffect(() => {
        if (mode === "edit" && !canEdit && !permsLoading) {
            toast({
                title: "Acceso denegado",
                description: "No tienes permiso para editar leads.",
                variant: "destructive"
            });
            router.replace(`/dashboard/leads/${id}?mode=view`);
        }
    }, [mode, canEdit, permsLoading, id, router, toast]);

    const fetchLead = useCallback(async () => {
        try {
            const response = await api.get(`/api/leads/${id}`);
            setLead(response.data);
            setFormData(response.data);
            if (response.data.datos_adicionales) {
                setDatosAdicionales(response.data.datos_adicionales);
                setCredidConsultadoAt(response.data.credid_consultado_at);
            }
        } catch (error) {
            console.error("Error fetching lead:", error);
            toast({ title: "Error", description: "No se pudo cargar el lead.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [id, toast]);

    const handleConsultarCredid = async () => {
        if (!lead?.id) return;
        setConsultandoCredid(true);
        try {
            const response = await api.post(`/api/leads/${lead.id}/consultar-credid`);
            setDatosAdicionales(response.data.datos_adicionales);
            setCredidConsultadoAt(response.data.credid_consultado_at);
            if (response.data.campos_actualizados?.length > 0) {
                toast({ title: "Datos actualizados", description: `Campos auto-llenados: ${response.data.campos_actualizados.join(', ')}` });
                fetchLead();
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

    // Keep formDataRef always in sync with latest formData
    useEffect(() => { formDataRef.current = formData; }, [formData]);

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

        const fetchInstituciones = async () => {
            try {
                const response = await api.get('/api/instituciones');
                setInstituciones(response.data.data || response.data);
            } catch (error) {
                console.error("Error fetching instituciones:", error);
            }
        };

        if (id) {
            fetchLead();
            fetchAgents();
            fetchDeductoras();
            fetchInstituciones();
        }
    }, [id, toast]);

    // Fetch opportunities when lead is loaded
    useEffect(() => {
        const fetchOpportunities = async () => {
            if (!lead?.cedula) return;
            try {
                const response = await api.get(`/api/opportunities?lead_cedula=${lead.cedula}`);
                setOpportunities(response.data.data || []);
            } catch (error) {
                console.error("Error fetching opportunities:", error);
            }
        };
        fetchOpportunities();
    }, [lead?.cedula]);

    // Sync files to all opportunities
    const handleSyncToOpportunities = async () => {
        if (!lead?.cedula || opportunities.length === 0) {
            toast({ title: "Sin oportunidades", description: "Este lead no tiene oportunidades asociadas.", variant: "destructive" });
            return;
        }

        setSyncing(true);
        let totalSynced = 0;

        try {
            for (const opp of opportunities) {
                const response = await api.post('/api/person-documents/sync-to-opportunity', {
                    cedula: lead.cedula,
                    opportunity_id: opp.id,
                });
                totalSynced += response.data.files_synced || 0;
            }

            toast({
                title: "Sincronización completada",
                description: `${totalSynced} archivo(s) sincronizado(s) a ${opportunities.length} oportunidad(es).`,
                className: "bg-green-600 text-white"
            });
        } catch (error) {
            console.error("Error syncing files:", error);
            toast({ title: "Error", description: "No se pudieron sincronizar los archivos.", variant: "destructive" });
        } finally {
            setSyncing(false);
        }
    };

    const autoSave = useCallback(async () => {
        if (!isEditMode) return;
        const currentFormData = formDataRef.current;
        const EDITABLE_FIELDS = [
            'name', 'apellido1', 'apellido2', 'cedula', 'email', 'phone', 'status', 'lead_status_id',
            'assigned_to_id', 'notes', 'source', 'whatsapp', 'tel_casa', 'tel_amigo',
            'province', 'canton', 'distrito', 'direccion1', 'direccion2',
            'ocupacion', 'estado_civil', 'relacionado_a', 'tipo_relacion', 'fecha_nacimiento',
            'is_active', 'cedula_vencimiento', 'genero', 'nacionalidad', 'telefono2', 'telefono3',
            'institucion_labora', 'departamento_cargo', 'deductora_id', 'nivel_academico',
            'profesion', 'sector', 'puesto', 'estado_puesto',
            'trabajo_provincia', 'trabajo_canton', 'trabajo_distrito', 'trabajo_direccion',
            'institucion_direccion', 'actividad_economica', 'tipo_sociedad', 'nombramientos',
            'tel_amigo_2', 'relacionado_a_2', 'tipo_relacion_2',
        ];
        const payload = Object.fromEntries(
            Object.entries(currentFormData).filter(([key]) => EDITABLE_FIELDS.includes(key))
        );
        try {
            setSaving(true);
            await api.put(`/api/leads/${id}`, payload);
            setLead(prev => ({ ...prev, ...currentFormData } as Lead));
        } catch (error) {
            console.error("Error auto-saving lead:", error);
            toast({ title: "Error", description: "No se pudo guardar los cambios.", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    }, [id, isEditMode, toast]);

    const handleInputChange = (field: keyof Lead, value: any) => {
        setFormData(prev => {
            const updated = { ...prev, [field]: value };
            formDataRef.current = updated;
            return updated;
        });
    };

    const handleSelectChange = (field: keyof Lead, value: any) => {
        setFormData(prev => {
            const updated = { ...prev, [field]: value };
            formDataRef.current = updated;
            return updated;
        });
        if (isEditMode) setTimeout(autoSave, 100);
    };

    const handleBlur = () => {
        if (isEditMode) {
            autoSave();
        }
    };

    // --- Provincias / Cantones / Distritos (dirección principal)
    const provinceOptions = useMemo(() => getProvinceOptions(), []);

    const cantonOptions = useMemo(() =>
        getCantonOptions(formData.province ?? ""),
    [formData.province]);

    const districtOptions = useMemo(() =>
        getDistrictOptions(formData.province ?? "", formData.canton ?? ""),
    [formData.province, formData.canton]);

    // --- Provincias / Cantones / Distritos (dirección trabajo)
    const workProvinceOptions = useMemo(() => getProvinceOptions(), []);

    const workCantonOptions = useMemo(() =>
        getCantonOptions(formData.trabajo_provincia ?? ""),
    [formData.trabajo_provincia]);

    const workDistrictOptions = useMemo(() =>
        getDistrictOptions(formData.trabajo_provincia ?? "", formData.trabajo_canton ?? ""),
    [formData.trabajo_provincia, formData.trabajo_canton]);

    const handleProvinceChange = (value: string) => {
        setFormData(prev => {
            const updated = { ...prev, province: value, canton: "", distrito: "" };
            formDataRef.current = updated;
            return updated;
        });
        if (isEditMode) setTimeout(autoSave, 100);
    };

    const handleCantonChange = (value: string) => {
        setFormData(prev => {
            const updated = { ...prev, canton: value, distrito: "" };
            formDataRef.current = updated;
            return updated;
        });
        if (isEditMode) setTimeout(autoSave, 100);
    };

    const handleDistrictChange = (value: string) => {
        setFormData(prev => {
            const updated = { ...prev, distrito: value };
            formDataRef.current = updated;
            return updated;
        });
        if (isEditMode) setTimeout(autoSave, 100);
    };

    // Work Address Logic
    const handleWorkProvinceChange = (value: string) => {
        setFormData(prev => {
            const updated = { ...prev, trabajo_provincia: value, trabajo_canton: "", trabajo_distrito: "" };
            formDataRef.current = updated;
            return updated;
        });
        if (isEditMode) setTimeout(autoSave, 100);
    };

    const handleWorkCantonChange = (value: string) => {
        setFormData(prev => {
            const updated = { ...prev, trabajo_canton: value, trabajo_distrito: "" };
            formDataRef.current = updated;
            return updated;
        });
        if (isEditMode) setTimeout(autoSave, 100);
    };

    const handleWorkDistrictChange = (value: string) => {
        setFormData(prev => {
            const updated = { ...prev, trabajo_distrito: value };
            formDataRef.current = updated;
            return updated;
        });
        if (isEditMode) setTimeout(autoSave, 100);
    };

    const handleOpenOpportunitiesModal = () => {
        if (opportunities.length === 1) {
            router.push(`/dashboard/oportunidades/${opportunities[0].id}`);
            return;
        }
        setOpportunitiesModalOpen(true);
    };

    const handleArchive = async () => {
        if (!lead) return;
        if (!confirm(`¿Archivar a ${lead.name}?`)) return;
        try {
            await api.patch(`/api/leads/${id}/toggle-active`);
            toast({ title: "Archivado", description: "Lead archivado correctamente." });
            router.push('/dashboard/clientes');
        } catch (error) {
            console.error("Error archiving lead:", error);
            toast({ title: "Error", description: "No se pudo archivar el lead.", variant: "destructive" });
        }
    };

    if (loading) {
        return <div className="flex h-full items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    }

    if (!lead) {
        return <div className="p-8 text-center">Lead no encontrado.</div>;
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
                    {isEditMode && saving && (
                        <span className="flex items-center text-sm text-muted-foreground">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Guardando...
                        </span>
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
                        <TabsList className="grid w-full grid-cols-3 mb-4">
                            <TabsTrigger value="datos" className="relative">
                                Datos
                                {getMissingFieldsCount() > 0 && (
                                    <span className="ml-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                                        {getMissingFieldsCount()}
                                    </span>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="archivos" className="relative">
                                Archivos
                                {getMissingDocuments().length > 0 && (
                                    <span className="ml-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                                        {getMissingDocuments().length}
                                    </span>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="tareas">Tareas</TabsTrigger>
                        </TabsList>

                        <TabsContent value="datos">
                            <Card>
                                <div className="p-6 pb-0">
                            <h1 className="text-2xl font-bold tracking-tight uppercase">{lead.name} {lead.apellido1}</h1>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                <span>ID #{lead.id}</span>
                                <span> · </span>
                                <span>{lead.cedula}</span>
                                <span> · </span>
                                <span>Registrado {lead.created_at ? new Date(lead.created_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : 'N/A'}</span>
                            </div>
                            
                            <div className="flex items-center gap-3 mt-4">
                                <Badge variant="secondary" className="rounded-full px-3 font-normal bg-slate-100 text-slate-800 hover:bg-slate-200">
                                    {lead.lead_status ? (typeof lead.lead_status === 'string' ? lead.lead_status : lead.lead_status.name) : 'abierto'}
                                </Badge>
                                <Badge variant="outline" className="rounded-full px-3 font-normal text-slate-600">
                                    Solo lectura
                                </Badge>

                                {!isEditMode && (
                                    <div className="flex items-center gap-2 ml-1">
                                        {!permsLoading && canEdit && (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            size="icon"
                                                            className="h-9 w-9 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border-0"
                                                            onClick={() => router.push(`/dashboard/leads/${id}?mode=edit`)}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Editar Lead</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}

                                        {!permsLoading && hasPermission('oportunidades', 'create') && (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            size="icon"
                                                            className="h-9 w-9 rounded-md bg-blue-900 text-white hover:bg-blue-800 border-0"
                                                            onClick={() => setIsOpportunityDialogOpen(true)}
                                                            disabled={!checkIsComplete() || hasActiveOpportunity(opportunities)}
                                                        >
                                                            <Sparkles className="h-4 w-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        {hasActiveOpportunity(opportunities)
                                                            ? getActiveOpportunityMessage(opportunities)
                                                            : checkIsComplete()
                                                            ? "Crear Oportunidad"
                                                            : "Complete el registro antes de crear oportunidad"
                                                        }
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}

                                        {!permsLoading && canArchive && (
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
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <CardContent className="space-y-8">

                            {/* Personal Information */}
                            <div>
                                <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                                    Datos Personales
                                    {isSectionComplete(personalFields) ? (
                                        <Badge className="bg-green-100 text-green-700 border-green-300">
                                            <Check className="h-3 w-3 mr-1" />
                                            Completo
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                                            {personalFields.filter(f => isFieldMissing(f)).length} pendientes
                                        </Badge>
                                    )}
                                </h3>
                                <div className="grid gap-4 md:grid-cols-3">
                                    <div className="space-y-2">
                                        <Label>Nombre {isFieldMissing('name') && <span className="text-red-500">*</span>}</Label>
                                        <Input
                                            value={formData.name || ""}
                                            onChange={(e) => handleInputChange("name", e.target.value)}
                                            disabled={!isEditMode} onBlur={handleBlur}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Primer Apellido {isFieldMissing('apellido1') && <span className="text-red-500">*</span>}</Label>
                                        <Input
                                            value={formData.apellido1 || ""}
                                            onChange={(e) => handleInputChange("apellido1", e.target.value)}
                                            disabled={!isEditMode} onBlur={handleBlur}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Segundo Apellido</Label>
                                        <Input
                                            value={formData.apellido2 || ""}
                                            onChange={(e) => handleInputChange("apellido2", e.target.value)}
                                            disabled={!isEditMode} onBlur={handleBlur}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Cédula {isFieldMissing('cedula') && <span className="text-red-500">*</span>}</Label>
                                        <Input
                                            value={formData.cedula || ""}
                                            onChange={(e) => handleInputChange("cedula", e.target.value)}
                                            disabled={!isEditMode} onBlur={handleBlur}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Vencimiento Cédula</Label>
                                        <Input
                                            type="date"
                                            value={formData.cedula_vencimiento || ""}
                                            onChange={(e) => handleInputChange("cedula_vencimiento" as keyof Lead, e.target.value)}
                                            disabled={!isEditMode} onBlur={handleBlur}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Fecha de Nacimiento {isFieldMissing('fecha_nacimiento') && <span className="text-red-500">*</span>}</Label>
                                        <Input
                                            type="date"
                                            value={formData.fecha_nacimiento ? String(formData.fecha_nacimiento).split('T')[0] : ""}
                                            onChange={(e) => handleInputChange("fecha_nacimiento", e.target.value)}
                                            disabled={!isEditMode} onBlur={handleBlur}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Género</Label>
                                        {isEditMode ? (
                                            <Select 
                                                value={formData.genero || ""} 
                                                onValueChange={(value) => handleSelectChange("genero" as keyof Lead, value)}
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
                                            <Input value={formData.genero || ""} disabled />
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Estado Civil {isFieldMissing('estado_civil') && <span className="text-red-500">*</span>}</Label>
                                        {isEditMode ? (
                                            <Select
                                                value={formData.estado_civil || ""} 
                                                onValueChange={(value) => handleSelectChange("estado_civil" as keyof Lead, value)}
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
                                <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                                    Información de Contacto
                                    {isSectionComplete(contactFields) ? (
                                        <Badge className="bg-green-100 text-green-700 border-green-300">
                                            <Check className="h-3 w-3 mr-1" />
                                            Completo
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                                            {contactFields.filter(f => isFieldMissing(f)).length} pendientes
                                        </Badge>
                                    )}
                                </h3>
                                <div className="grid gap-4 md:grid-cols-3">
                                    <div className="space-y-2">
                                        <Label>Email {isFieldMissing('email') && <span className="text-red-500">*</span>}</Label>
                                        <Input
                                            value={formData.email || ""}
                                            onChange={(e) => handleInputChange("email", e.target.value)}
                                            disabled={!isEditMode} onBlur={handleBlur}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Teléfono Móvil {isFieldMissing('phone') && <span className="text-red-500">*</span>}</Label>
                                        <Input
                                            value={formatPhoneCR(formData.phone)}
                                            onChange={(e) => handleInputChange("phone", parsePhone(e.target.value))}
                                            disabled={!isEditMode} onBlur={handleBlur}
                                            inputMode="tel"
                                            placeholder="8888-7777"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Teléfono 2</Label>
                                        <Input
                                            value={formatPhoneCR(formData.telefono2)}
                                            onChange={(e) => handleInputChange("telefono2" as keyof Lead, parsePhone(e.target.value))}
                                            disabled={!isEditMode} onBlur={handleBlur}
                                            inputMode="tel"
                                            placeholder="8888-7777"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>WhatsApp {isFieldMissing('whatsapp') && <span className="text-red-500">*</span>}</Label>
                                        <Input
                                            value={formatPhoneCR(formData.whatsapp)}
                                            onChange={(e) => handleInputChange("whatsapp", parsePhone(e.target.value))}
                                            disabled={!isEditMode} onBlur={handleBlur}
                                            inputMode="tel"
                                            placeholder="8888-7777"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Teléfono Casa</Label>
                                        <Input
                                            value={formatPhoneCR(formData.tel_casa)}
                                            onChange={(e) => handleInputChange("tel_casa" as keyof Lead, parsePhone(e.target.value))}
                                            disabled={!isEditMode} onBlur={handleBlur}
                                            inputMode="tel"
                                            placeholder="8888-7777"
                                        />
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* Reference Information */}
                            <div>
                                <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                                    Información de Referencia (Máx. 2)
                                    {hasAtLeastOneCompleteReference() ? (
                                        <Badge className="bg-green-100 text-green-700 border-green-300">
                                            <Check className="h-3 w-3 mr-1" />
                                            Completo
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                                            1 pendiente
                                        </Badge>
                                    )}
                                </h3>

                                {/* Referencia 1 */}
                                <div className="mb-6">
                                    <h4 className="text-sm font-medium mb-3 text-muted-foreground">Referencia 1</h4>
                                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                        <div className="space-y-2">
                                            <Label>Número de Referencia {!hasAtLeastOneCompleteReference() && !formData.tel_amigo && <span className="text-red-500">*</span>}</Label>
                                            <Input
                                                value={formatPhoneCR(formData.tel_amigo)}
                                                onChange={(e) => handleInputChange("tel_amigo" as keyof Lead, parsePhone(e.target.value))}
                                                disabled={!isEditMode} onBlur={handleBlur}
                                                inputMode="tel"
                                                placeholder="8888-7777"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Nombre de la Persona {!hasAtLeastOneCompleteReference() && !formData.relacionado_a && <span className="text-red-500">*</span>}</Label>
                                            <Input
                                                value={formData.relacionado_a || ""}
                                                onChange={(e) => handleInputChange("relacionado_a" as keyof Lead, e.target.value)}
                                                disabled={!isEditMode} onBlur={handleBlur}
                                                placeholder="Nombre completo"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Relación {!hasAtLeastOneCompleteReference() && !formData.tipo_relacion && <span className="text-red-500">*</span>}</Label>
                                            <Input
                                                value={formData.tipo_relacion || ""}
                                                onChange={(e) => handleInputChange("tipo_relacion" as keyof Lead, e.target.value)}
                                                disabled={!isEditMode} onBlur={handleBlur}
                                                placeholder="Ej: Amigo, Familiar"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Referencia 2 */}
                                <div>
                                    <h4 className="text-sm font-medium mb-3 text-muted-foreground">Referencia 2</h4>
                                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                        <div className="space-y-2">
                                            <Label>Número de Referencia</Label>
                                            <Input
                                                value={formatPhoneCR(formData.tel_amigo_2)}
                                                onChange={(e) => handleInputChange("tel_amigo_2" as keyof Lead, parsePhone(e.target.value))}
                                                disabled={!isEditMode} onBlur={handleBlur}
                                                inputMode="tel"
                                                placeholder="8888-7777"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Nombre de la Persona</Label>
                                            <Input
                                                value={formData.relacionado_a_2 || ""}
                                                onChange={(e) => handleInputChange("relacionado_a_2" as keyof Lead, e.target.value)}
                                                disabled={!isEditMode} onBlur={handleBlur}
                                                placeholder="Nombre completo"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Relación</Label>
                                            <Input
                                                value={formData.tipo_relacion_2 || ""}
                                                onChange={(e) => handleInputChange("tipo_relacion_2" as keyof Lead, e.target.value)}
                                                disabled={!isEditMode} onBlur={handleBlur}
                                                placeholder="Ej: Amigo, Familiar"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* Address Information */}
                            <div>
                                <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                                    Dirección
                                    {isSectionComplete(addressFields) ? (
                                        <Badge className="bg-green-100 text-green-700 border-green-300">
                                            <Check className="h-3 w-3 mr-1" />
                                            Completo
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                                            {addressFields.filter(f => isFieldMissing(f)).length} pendientes
                                        </Badge>
                                    )}
                                </h3>
                                <div className="grid gap-4 md:grid-cols-3">
                                    <div className="space-y-2">
                                        <Label>Provincia {isFieldMissing('province') && <span className="text-red-500">*</span>}</Label>
                                        {isEditMode ? (
                                            <Select
                                                value={formData.province || ""}
                                                onValueChange={handleProvinceChange}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccionar provincia" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {provinceOptions.map((p) => (
                                                        <SelectItem key={p.value} value={p.value}>
                                                            {p.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <Input value={formData.province || ""} disabled />
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Cantón {isFieldMissing('canton') && <span className="text-red-500">*</span>}</Label>
                                        {isEditMode ? (
                                            <Select
                                                value={formData.canton || ""}
                                                onValueChange={handleCantonChange}
                                                disabled={!formData?.province}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccionar cantón" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {cantonOptions.map((c) => (
                                                        <SelectItem key={c.value} value={c.value}>
                                                            {c.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                         ) : (
                                             <Input value={formData.canton || ""} disabled />
                                         )}
                                     </div>
                                     <div className="space-y-2">
                                         <Label>Distrito {isFieldMissing('distrito') && <span className="text-red-500">*</span>}</Label>
                                         {isEditMode ? (
                                            <Select
                                                value={formData.distrito || ""}
                                                onValueChange={handleDistrictChange}
                                                disabled={!formData?.canton}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccionar distrito" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {districtOptions.map((d) => (
                                                        <SelectItem key={d.value} value={d.value}>
                                                            {d.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                         ) : (
                                             <Input value={formData.distrito || ""} disabled />
                                         )}
                                     </div>

                                    <div className="col-span-3 md:col-span-2 space-y-2">
                                        <Label>Dirección Exacta {isFieldMissing('direccion1') && <span className="text-red-500">*</span>}</Label>
                                        <Textarea
                                            value={formData.direccion1 || ""}
                                            onChange={(e) => handleInputChange("direccion1", e.target.value)}
                                            disabled={!isEditMode} onBlur={handleBlur}
                                        />
                                    </div>
                                    <div className="col-span-3 md:col-span-1 space-y-2">
                                        <Label>Dirección 2 (Opcional)</Label>
                                        <Textarea
                                            value={formData.direccion2 || ""}
                                            onChange={(e) => handleInputChange("direccion2" as keyof Lead, e.target.value)}
                                            disabled={!isEditMode} onBlur={handleBlur}
                                        />
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* Employment Information */}
                            <div>
                                <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                                    Información Laboral
                                    {isSectionComplete(employmentFields) ? (
                                        <Badge className="bg-green-100 text-green-700 border-green-300">
                                            <Check className="h-3 w-3 mr-1" />
                                            Completo
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                                            {employmentFields.filter(f => isFieldMissing(f)).length} pendientes
                                        </Badge>
                                    )}
                                </h3>
                                <div className="grid gap-4 md:grid-cols-3">
                                    <div className="space-y-2">
                                        <Label>Nivel Académico {isFieldMissing('nivel_academico') && <span className="text-red-500">*</span>}</Label>
                                        {isEditMode ? (
                                            <Select
                                                value={formData.nivel_academico || ""}
                                                onValueChange={(value) => handleSelectChange("nivel_academico" as keyof Lead, value)}
                                            >
                                                <SelectTrigger>
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
                                                                        handleSelectChange("profesion" as keyof Lead, prof);
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
                                        <Input
                                            value={formData.sector || ""}
                                            onChange={(e) => handleInputChange("sector" as keyof Lead, e.target.value)} 
                                            disabled={!isEditMode} onBlur={handleBlur} 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Puesto {isFieldMissing('puesto') && <span className="text-red-500">*</span>}</Label>
                                        <Input
                                            value={formData.puesto || ""}
                                            onChange={(e) => handleInputChange("puesto" as keyof Lead, e.target.value)} 
                                            disabled={!isEditMode} onBlur={handleBlur} 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Nombramiento {isFieldMissing('estado_puesto') && <span className="text-red-500">*</span>}</Label>
                                        <Select
                                            value={formData.estado_puesto || ""}
                                            onValueChange={(value) => handleSelectChange("estado_puesto" as keyof Lead, value)}
                                            disabled={!isEditMode}
                                        >
                                            <SelectTrigger>
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
                                                                        handleSelectChange("institucion_labora" as keyof Lead, inst.nombre);
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
                                    <div className="space-y-2">
                                        <Label>Deductora</Label>
                                        <div className="flex items-center gap-6">
                                            <Button
                                                type="button"
                                                variant={!formData.deductora_id || formData.deductora_id === 0 ? "default" : "outline"}
                                                size="default"
                                                onClick={() => { if (isEditMode) { handleSelectChange("deductora_id" as keyof Lead, null); } }}
                                                disabled={!isEditMode}
                                                className={`flex-1 ${!formData.deductora_id || formData.deductora_id === 0 ? "bg-primary text-primary-foreground" : ""}`}
                                            >
                                                Sin deductora
                                            </Button>
                                            {deductoras.map((deductora) => (
                                                <Button
                                                    key={deductora.id}
                                                    type="button"
                                                    variant={formData.deductora_id === deductora.id ? "default" : "outline"}
                                                    size="default"
                                                    onClick={() => { if (isEditMode) { handleSelectChange("deductora_id" as keyof Lead, deductora.id); } }}
                                                    disabled={!isEditMode}
                                                    className={`flex-1 ${formData.deductora_id === deductora.id ? "bg-primary text-primary-foreground" : ""}`}
                                                >
                                                    {deductora.nombre}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    {/* Work Address */}
                                    <div className="col-span-3">
                                        <h4 className="text-sm font-medium mb-2 mt-2">Dirección del Trabajo</h4>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Provincia {isFieldMissing('trabajo_provincia') && <span className="text-red-500">*</span>}</Label>
                                        {isEditMode ? (
                                            <Select
                                                value={formData.trabajo_provincia || ""}
                                                onValueChange={handleWorkProvinceChange}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccionar provincia" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {workProvinceOptions.map((p) => (
                                                        <SelectItem key={p.value} value={p.value}>
                                                            {p.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <Input value={formData.trabajo_provincia || ""} disabled />
                                        )}
                                    </div>
                                     <div className="space-y-2">
                                         <Label>Cantón {isFieldMissing('trabajo_canton') && <span className="text-red-500">*</span>}</Label>
                                         {isEditMode ? (
                                            <Select
                                                value={formData.trabajo_canton || ""}
                                                onValueChange={handleWorkCantonChange}
                                                disabled={!(formData.trabajo_provincia)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccionar cantón" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {workCantonOptions.map((c) => (
                                                        <SelectItem key={c.value} value={c.value}>
                                                            {c.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                         ) : (
                                             <Input value={formData.trabajo_canton || ""} disabled />
                                         )}
                                     </div>
                                     <div className="space-y-2">
                                         <Label>Distrito {isFieldMissing('trabajo_distrito') && <span className="text-red-500">*</span>}</Label>
                                         {isEditMode ? (
                                            <Select
                                                value={formData.trabajo_distrito || ""}
                                                onValueChange={handleWorkDistrictChange}
                                                disabled={!(formData.trabajo_canton)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccionar distrito" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {workDistrictOptions.map((d) => (
                                                        <SelectItem key={d.value} value={d.value}>
                                                            {d.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                         ) : (
                                             <Input value={formData.trabajo_distrito || ""} disabled />
                                         )}
                                     </div>
                                    <div className="col-span-3 space-y-2">
                                         <Label>Dirección Exacta (Trabajo) {isFieldMissing('trabajo_direccion') && <span className="text-red-500">*</span>}</Label>
                                         <Textarea
                                             value={formData.trabajo_direccion || ""}
                                             onChange={(e) => handleInputChange("trabajo_direccion" as keyof Lead, e.target.value)}
                                             disabled={!isEditMode} onBlur={handleBlur}
                                         />
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
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={handleConsultarCredid}
                                            disabled={consultandoCredid || !formData.cedula}
                                        >
                                            {consultandoCredid ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                                            Actualizar
                                        </Button>
                                    )}
                                </div>

                                {!datosAdicionales && (
                                    <div className="mt-3 p-4 bg-muted/30 rounded-lg text-center">
                                        <p className="text-sm text-muted-foreground mb-2">No hay datos de Credid disponibles para este lead.</p>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={handleConsultarCredid}
                                            disabled={consultandoCredid || !formData.cedula}
                                        >
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
                                                        <p className="text-sm">
                                                            {datosAdicionales.filiacion.indice_desarrollo_social}
                                                            {datosAdicionales.filiacion.nivel_desarrollo_social && (
                                                                <Badge variant="outline" className="ml-2 text-xs">{datosAdicionales.filiacion.nivel_desarrollo_social}</Badge>
                                                            )}
                                                        </p>
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
                                            {/* Resumen cards */}
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

                                            {/* Tabla Vehículos */}
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

                                            {/* Tabla Propiedades */}
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

                                            {/* Sociedades */}
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

                        </CardContent>
                    </Card>
                        </TabsContent>

                        <TabsContent value="tareas">
                            <TareasTab projectCode={`LEAD-${lead.id}`} entityLabel="del Lead" />
                        </TabsContent>

                        <TabsContent value="archivos">
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="flex items-center gap-2">
                                            <Paperclip className="h-5 w-5" />
                                            Archivos del Lead
                                        </CardTitle>
                                        {opportunities.length > 0 && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleSyncToOpportunities}
                                                disabled={syncing}
                                            >
                                                {syncing ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <RefreshCw className="mr-2 h-4 w-4" />
                                                )}
                                                Sincronizar a Oportunidades ({opportunities.length})
                                            </Button>
                                        )}
                                    </div>
                                    {opportunities.length > 0 && (
                                        <CardDescription className="mt-2">
                                            Los archivos subidos aquí se copian automáticamente a las oportunidades.
                                            Use el botón para sincronizar archivos existentes.
                                        </CardDescription>
                                    )}
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
                                        personId={Number(lead.id)}
                                        initialDocuments={lead?.documents || []}
                                        onDocumentChange={fetchLead}
                                    />
                                </CardContent>
                            </Card>
                        </TabsContent>


                        {/* Botones de acción al fondo */}
                        <div className="flex justify-end gap-2 mt-4">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="inline-flex">
                                            <Button
                                                variant="default"
                                                onClick={handleOpenOpportunitiesModal}
                                                disabled={
                                                    opportunities.length === 0 ||
                                                    !checkIsComplete() ||
                                                    getMissingDocuments().length > 0
                                                }
                                                className="gap-2"
                                            >
                                                <Handshake className="h-4 w-4" />
                                                <span>Oportunidades</span>
                                                {opportunities.length > 0 && (
                                                    <Badge variant="secondary" className="ml-1 bg-white text-slate-900 hover:bg-white">
                                                        {opportunities.length}
                                                    </Badge>
                                                )}
                                            </Button>
                                        </span>
                                    </TooltipTrigger>
                                    {(opportunities.length === 0 || !checkIsComplete() || getMissingDocuments().length > 0) && (
                                        <TooltipContent>
                                            <div className="text-xs space-y-1">
                                                {opportunities.length === 0 && <p>• No hay oportunidades para mostrar</p>}
                                                {!checkIsComplete() && (
                                                    <>
                                                        <p>• Completa todos los campos requeridos ({getMissingFieldsCount()} faltantes)</p>
                                                        {!hasAtLeastOneCompleteReference() && <p>• Al menos 1 referencia completa (teléfono, nombre y relación)</p>}
                                                    </>
                                                )}
                                                {getMissingDocuments().length > 0 && <p>• Sube los documentos: {getMissingDocuments().join(', ')}</p>}
                                            </div>
                                        </TooltipContent>
                                    )}
                                </Tooltip>
                            </TooltipProvider>
                            {activeTab === "datos" && (
                                <Button onClick={() => setActiveTab("archivos")}>
                                    Continuar
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            )}
                            {activeTab === "archivos" && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span className="inline-flex">
                                                <Button onClick={() => setIsOpportunityDialogOpen(true)} disabled={hasActiveOpportunity(opportunities)}>
                                                    Crear Oportunidad
                                                    <ArrowRight className="ml-2 h-4 w-4" />
                                                </Button>
                                            </span>
                                        </TooltipTrigger>
                                        {hasActiveOpportunity(opportunities) && (
                                            <TooltipContent>{getActiveOpportunityMessage(opportunities)}</TooltipContent>
                                        )}
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                        </div>
                    </Tabs>
                </div>

                {/* Side Panel */}
                {isPanelVisible && (
                    <div className="space-y-1 lg:col-span-2 ">
                        <CaseChat conversationId={id} />
                    </div>
                )}
            </div>

            <CreateOpportunityDialog
                open={isOpportunityDialogOpen}
                onOpenChange={setIsOpportunityDialogOpen}
                leads={lead ? [lead] : []}
                defaultLeadId={lead ? String(lead.id) : undefined}
                onSuccess={() => window.location.reload()}
            />

            {/* Modal de Oportunidades */}
            <Dialog open={opportunitiesModalOpen} onOpenChange={setOpportunitiesModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Oportunidades de {lead?.name} {lead?.apellido1}</DialogTitle>
                        <DialogDescription>
                            {opportunities.length === 0 ? 'No hay oportunidades registradas' : `${opportunities.length} oportunidad(es) encontrada(s)`}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[400px] overflow-y-auto">
                        {opportunities.length > 0 ? (
                            <div className="space-y-3">
                                {opportunities.map((opportunity) => (
                                    <Card key={opportunity.id}>
                                        <CardContent className="p-4">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex-1 space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-sm font-medium">{opportunity.id}</span>
                                                        <Badge variant="outline" className="text-xs">
                                                            {opportunity.status || 'Pendiente'}
                                                        </Badge>
                                                    </div>
                                                    <div className="text-sm text-muted-foreground">
                                                        Tipo: {opportunity.opportunity_type || 'N/A'}
                                                    </div>
                                                    {opportunity.amount && (
                                                        <div className="text-sm font-medium flex items-center gap-1">
                                                            <DollarSign className="h-3 w-3" />
                                                            {new Intl.NumberFormat('es-CR', {
                                                                style: 'currency',
                                                                currency: 'CRC',
                                                                minimumFractionDigits: 0
                                                            }).format(opportunity.amount)}
                                                        </div>
                                                    )}
                                                </div>
                                                <Button
                                                    size="sm"
                                                    className="gap-2"
                                                    onClick={() => router.push(`/dashboard/oportunidades/${opportunity.id}`)}
                                                >
                                                    <Sparkles className="h-4 w-4" />
                                                    Ver
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                No hay oportunidades registradas para este lead
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
