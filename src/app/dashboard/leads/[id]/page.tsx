"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User as UserIcon, Save, Loader2, PanelRightClose, PanelRightOpen, Pencil, Sparkles, UserCheck, Archive } from "lucide-react";

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
import { useToast } from "@/hooks/use-toast";
import { CaseChat } from "@/components/case-chat";

import api from "@/lib/axios";
import { Lead } from "@/lib/data";

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

        if (id) {
            fetchLead();
        }
    }, [id, toast]);

    const handleInputChange = (field: keyof Lead, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
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
                    <Button variant="outline" size="icon" onClick={() => router.back()}>
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
                                                    <Button size="icon" className="h-9 w-9 rounded-md bg-blue-900 text-white hover:bg-blue-800 border-0">
                                                        <Sparkles className="h-4 w-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>Análisis AI</TooltipContent>
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
                                        <Label>Fecha de Nacimiento</Label>
                                        <Input
                                            type="date"
                                            value={formData.fecha_nacimiento || ""}
                                            onChange={(e) => handleInputChange("fecha_nacimiento", e.target.value)}
                                            disabled={!isEditMode}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Estado Civil</Label>
                                        <Input
                                            value={formData.estado_civil || ""}
                                            onChange={(e) => handleInputChange("estado_civil", e.target.value)}
                                            disabled={!isEditMode}
                                        />
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
                                    <div className="space-y-2">
                                        <Label>Teléfono Amigo</Label>
                                        <Input
                                            value={(formData as any).tel_amigo || ""}
                                            onChange={(e) => handleInputChange("tel_amigo" as keyof Lead, e.target.value)}
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
                                        <Input
                                            value={(formData as any).province || ""}
                                            onChange={(e) => handleInputChange("province" as keyof Lead, e.target.value)}
                                            disabled={!isEditMode}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Cantón</Label>
                                        <Input
                                            value={(formData as any).canton || ""}
                                            onChange={(e) => handleInputChange("canton" as keyof Lead, e.target.value)}
                                            disabled={!isEditMode}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Distrito</Label>
                                        <Input
                                            value={(formData as any).distrito || ""}
                                            onChange={(e) => handleInputChange("distrito" as keyof Lead, e.target.value)}
                                            disabled={!isEditMode}
                                        />
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
                                        <Label>Ocupación</Label>
                                        <Input
                                            value={(formData as any).ocupacion || ""}
                                            onChange={(e) => handleInputChange("ocupacion" as keyof Lead, e.target.value)}
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
                                        <Label>Estado</Label>
                                        <Input
                                            value={(formData as any).status || ""}
                                            onChange={(e) => handleInputChange("status" as keyof Lead, e.target.value)}
                                            disabled={!isEditMode}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Fuente (Source)</Label>
                                        <Input
                                            value={(formData as any).source || ""}
                                            onChange={(e) => handleInputChange("source" as keyof Lead, e.target.value)}
                                            disabled={!isEditMode}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Relacionado A</Label>
                                        <Input
                                            value={(formData as any).relacionado_a || ""}
                                            onChange={(e) => handleInputChange("relacionado_a" as keyof Lead, e.target.value)}
                                            disabled={!isEditMode}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Tipo Relación</Label>
                                        <Input
                                            value={(formData as any).tipo_relacion || ""}
                                            onChange={(e) => handleInputChange("tipo_relacion" as keyof Lead, e.target.value)}
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
                </div>

                {/* Side Panel */}
                {isPanelVisible && (
                    <div className="space-y-6 lg:col-span-2">
                        <CaseChat conversationId={id} />
                    </div>
                )}
            </div>
        </div>
    );
}
