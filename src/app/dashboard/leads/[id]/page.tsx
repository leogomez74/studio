"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User as UserIcon, Save, Loader2, PanelRightClose, PanelRightOpen, Pencil, Sparkles, UserCheck, Archive, Plus, Paperclip } from "lucide-react";

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

import api from "@/lib/axios";
import { Lead } from "@/lib/data";
import { COSTA_RICA_PROVINCES, getProvinceOptions, getCantonOptions, getDistrictOptions } from '@/lib/costa-rica-regions';

export default function LeadDetailPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();

    // Force re-eval
    const id = params.id as string;
    const mode = searchParams.get("mode") || "view"; // view | edit
    const isEditMode = mode === "edit";

    const [lead, setLead] = useState<Lead | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState<Partial<Lead>>({});
    const [isPanelVisible, setIsPanelVisible] = useState(true);
    const [isOpportunityDialogOpen, setIsOpportunityDialogOpen] = useState(false);
    const [agents, setAgents] = useState<{id: number, name: string}[]>([]);
    const [deductoras, setDeductoras] = useState<{id: string, nombre: string}[]>([]);

    useEffect(() => {
        const fetchLead = async () => {
            try {
                const response = await api.get(`/api/leads/${id}`);
                setLead(response.data);
                setFormData(response.data);
            } catch (error) {
                console.error("Error fetching lead:", error);
                toast({ title: "Error", description: "No se pudo cargar el lead.", variant: "destructive" });
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

        if (id) {
            fetchLead();
            fetchAgents();
            fetchDeductoras();
        }
    }, [id, toast]);

    const handleInputChange = (field: keyof Lead, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // --- Provincias / Cantones / Distritos (dirección principal)
    const provinceOptions = useMemo(() => getProvinceOptions(), []);

    const cantonOptions = useMemo(() => {
        const options = getCantonOptions(formData.province ?? "");
        if (formData.canton && !options.some(o => o.value === formData.canton)) {
            return [{ value: formData.canton, label: formData.canton }, ...options];
        }
        return options;
    }, [formData.province, formData.canton]);

    const districtOptions = useMemo(() => {
        const options = getDistrictOptions(formData.province ?? "", formData.canton ?? "");
        if (formData.distrito && !options.some(o => o.value === formData.distrito)) {
            return [{ value: formData.distrito, label: formData.distrito }, ...options];
        }
        return options;
    }, [formData.province, formData.canton, formData.distrito]);

    // --- Provincias / Cantones / Distritos (dirección trabajo)
    const workProvinceOptions = useMemo(() => getProvinceOptions(), []);

    const workCantonOptions = useMemo(() => {
        const options = getCantonOptions((formData as any).trabajo_provincia ?? "");
        const current = (formData as any).trabajo_canton;
        if (current && !options.some(o => o.value === current)) {
            return [{ value: current, label: current }, ...options];
        }
        return options;
    }, [(formData as any).trabajo_provincia, (formData as any).trabajo_canton]);

    const workDistrictOptions = useMemo(() => {
        const options = getDistrictOptions((formData as any).trabajo_provincia ?? "", (formData as any).trabajo_canton ?? "");
        const current = (formData as any).trabajo_distrito;
        if (current && !options.some(o => o.value === current)) {
            return [{ value: current, label: current }, ...options];
        }
        return options;
    }, [(formData as any).trabajo_provincia, (formData as any).trabajo_canton, (formData as any).trabajo_distrito]);

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
            await api.put(`/api/leads/${id}`, formData);
            toast({ title: "Guardado", description: "Lead actualizado correctamente." });
            setLead(prev => ({ ...prev, ...formData } as Lead));
            router.push(`/dashboard/leads/${id}?mode=view`);
        } catch (error) {
            console.error("Error updating lead:", error);
            toast({ title: "Error", description: "No se pudo guardar los cambios.", variant: "destructive" });
        } finally {
            setSaving(false);
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
                    {isEditMode && (
                        <>
                            <Button variant="ghost" onClick={() => router.push(`/dashboard/leads/${id}?mode=view`)}>Cancelar</Button>
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
                    <Tabs defaultValue="datos" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-4">
                            <TabsTrigger value="datos">Datos</TabsTrigger>
                            <TabsTrigger value="archivos">Archivos</TabsTrigger>
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
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button size="icon" className="h-9 w-9 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border-0" onClick={() => router.push(`/dashboard/leads/${id}?mode=edit`)}>
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>Editar Lead</TooltipContent>
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
                                                    <Button size="icon" className="h-9 w-9 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 border-0">
                                                        <UserCheck className="h-4 w-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>Convertir a Cliente</TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>

                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button size="icon" className="h-9 w-9 rounded-md bg-red-600 text-white hover:bg-red-700 border-0">
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
                                            value={formData.apellido1 || ""}
                                            onChange={(e) => handleInputChange("apellido1", e.target.value)}
                                            disabled={!isEditMode}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Segundo Apellido</Label>
                                        <Input
                                            value={formData.apellido2 || ""}
                                            onChange={(e) => handleInputChange("apellido2", e.target.value)}
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
                                            onChange={(e) => handleInputChange("cedula_vencimiento" as keyof Lead, e.target.value)}
                                            disabled={!isEditMode}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Fecha de Nacimiento</Label>
                                        <Input
                                            type="date"
                                            value={formData.fecha_nacimiento ? String(formData.fecha_nacimiento).split('T')[0] : ""}
                                            onChange={(e) => handleInputChange("fecha_nacimiento", e.target.value)}
                                            disabled={!isEditMode}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Género</Label>
                                        {isEditMode ? (
                                            <Select 
                                                value={(formData as any).genero || ""} 
                                                onValueChange={(value) => handleInputChange("genero" as keyof Lead, value)}
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
                                        <Label>Estado Civil</Label>
                                        {isEditMode ? (
                                            <Select 
                                                value={(formData as any).estado_civil || ""} 
                                                onValueChange={(value) => handleInputChange("estado_civil" as keyof Lead, value)}
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
                                            onChange={(e) => handleInputChange("telefono2" as keyof Lead, e.target.value)}
                                            disabled={!isEditMode}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Teléfono 3</Label>
                                        <Input
                                            value={(formData as any).telefono3 || ""}
                                            onChange={(e) => handleInputChange("telefono3" as keyof Lead, e.target.value)}
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
                                            onChange={(e) => handleInputChange("tel_casa" as keyof Lead, e.target.value)}
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
                                                    {provinceOptions.map((p) => (
                                                        <SelectItem key={p.value} value={p.value}>
                                                            {p.label}
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
                                             <Input value={(formData as any).canton || ""} disabled />
                                         )}
                                     </div>
                                     <div className="space-y-2">
                                         <Label>Distrito</Label>
                                         {isEditMode ? (
                                            <Select
                                                value={(formData as any).distrito || ""} 
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
                                            onChange={(e) => handleInputChange("direccion2" as keyof Lead, e.target.value)}
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
                                            onChange={(e) => handleInputChange("nivel_academico" as keyof Lead, e.target.value)} 
                                            disabled={!isEditMode} 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Profesión</Label>
                                        <Input 
                                            value={(formData as any).profesion || ""} 
                                            onChange={(e) => handleInputChange("profesion" as keyof Lead, e.target.value)} 
                                            disabled={!isEditMode} 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Sector</Label>
                                        <Input 
                                            value={(formData as any).sector || ""} 
                                            onChange={(e) => handleInputChange("sector" as keyof Lead, e.target.value)} 
                                            disabled={!isEditMode} 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Puesto</Label>
                                        <Input 
                                            value={(formData as any).puesto || ""} 
                                            onChange={(e) => handleInputChange("puesto" as keyof Lead, e.target.value)} 
                                            disabled={!isEditMode} 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Estado del Puesto</Label>
                                        <Select 
                                            value={(formData as any).estado_puesto || ""} 
                                            onValueChange={(value) => handleInputChange("estado_puesto" as keyof Lead, value)}
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
                                            onChange={(e) => handleInputChange("institucion_labora" as keyof Lead, e.target.value)} 
                                            disabled={!isEditMode} 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Deductora</Label>
                                        {isEditMode ? (
                                            <Select 
                                                value={(formData as any).deductora_id || ""} 
                                                onValueChange={(value) => handleInputChange("deductora_id" as keyof Lead, value)}
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
                                            onChange={(e) => handleInputChange("institucion_direccion" as keyof Lead, e.target.value)} 
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
                                                    {workProvinceOptions.map((p) => (
                                                        <SelectItem key={p.value} value={p.value}>
                                                            {p.label}
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
                                                disabled={!((formData as any).trabajo_provincia)}
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
                                             <Input value={(formData as any).trabajo_canton || ""} disabled />
                                         )}
                                     </div>
                                     <div className="space-y-2">
                                         <Label>Distrito</Label>
                                         {isEditMode ? (
                                            <Select
                                                value={(formData as any).trabajo_distrito || ""} 
                                                onValueChange={handleWorkDistrictChange}
                                                disabled={!((formData as any).trabajo_canton)}
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
                                             <Input value={(formData as any).trabajo_distrito || ""} disabled />
                                         )}
                                     </div>
                                    <div className="col-span-3 space-y-2">
                                         <Label>Dirección Exacta (Trabajo)</Label>
                                         <Textarea
                                             value={(formData as any).trabajo_direccion || ""}
                                             onChange={(e) => handleInputChange("trabajo_direccion" as keyof Lead, e.target.value)}
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
                                            onChange={(e) => handleInputChange("actividad_economica" as keyof Lead, e.target.value)} 
                                            disabled={!isEditMode} 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Tipo Sociedad</Label>
                                        {isEditMode ? (
                                            <Select 
                                                value={(formData as any).tipo_sociedad || ""} 
                                                onValueChange={(value) => handleInputChange("tipo_sociedad" as keyof Lead, value)}
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
                                            onChange={(e) => handleInputChange("nombramientos" as keyof Lead, e.target.value)} 
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
                                    <div className="space-y-2">
                                        <Label>Responsable</Label>
                                        {isEditMode ? (
                                            <Select 
                                                value={String((formData as any).assigned_to_id || "")} 
                                                onValueChange={(value) => handleInputChange("assigned_to_id" as keyof Lead, value)}
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
                                    {/*<div className="space-y-2">*/}
                                    {/*    <Label>Estado</Label>*/}
                                    {/*    <Input*/}
                                    {/*        value={(formData as any).status || ""}*/}
                                    {/*        onChange={(e) => handleInputChange("status" as keyof Lead, e.target.value)}*/}
                                    {/*        disabled={!isEditMode}*/}
                                    {/*    />*/}
                                    {/*</div>*/}
                                    <div className="space-y-2">
                                        <Label>Fuente (Source)</Label>
                                        <Input
                                            value={(formData as any).source || ""}
                                            onChange={(e) => handleInputChange("source" as keyof Lead, e.target.value)}
                                            disabled={!isEditMode}
                                        />
                                    </div>
                                    <div className="col-span-3 space-y-2">
                                        <Label>Notas</Label>
                                        <Textarea
                                            value={(formData as any).notes || ""}
                                            onChange={(e) => handleInputChange("notes" as keyof Lead, e.target.value)}
                                            disabled={!isEditMode}
                                        />
                                    </div>
                                </div>
                            </div>

                        </CardContent>
                    </Card>
                        </TabsContent>

                        <TabsContent value="archivos">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Paperclip className="h-5 w-5" />
                                        Archivos del Lead
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <DocumentManager 
                                        personId={Number(lead.id)} 
                                        initialDocuments={(lead as any).documents || []} 
                                    />
                                </CardContent>
                            </Card>
                        </TabsContent>
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
        </div>
    );
}
