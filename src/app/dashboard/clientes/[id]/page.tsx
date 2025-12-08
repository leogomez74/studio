"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User as UserIcon, Save, Loader2, PanelRightClose, PanelRightOpen, ChevronDown, ChevronUp, Paperclip, Send, Smile, Pencil, Sparkles, Archive, FileText } from "lucide-react";

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
import { useToast } from "@/hooks/use-toast";
import { CaseChat } from "@/components/case-chat";

import api from "@/lib/axios";
import { Client, chatMessages } from "@/lib/data";

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
  const [isPanelVisible, setIsPanelVisible] = useState(true);
  const [isOpportunitiesOpen, setIsOpportunitiesOpen] = useState(true);

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

    if (id) {
      fetchClient();
    }
  }, [id, toast]);

  const handleInputChange = (field: keyof Client, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
          <Button variant="outline" size="icon" onClick={() => router.back()}>
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
          <Card>
            <div className="p-6 pb-0">
                <h1 className="text-2xl font-bold tracking-tight uppercase">{client.name} {(client as any).apellido1}</h1>
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
                        Cliente
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
                                            <FileText className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Ver Expediente</TooltipContent>
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
                <Label>Fecha de Nacimiento</Label>
                <Input 
                  type="date"
                  value={(formData as any).fecha_nacimiento || ""} 
                  onChange={(e) => handleInputChange("fecha_nacimiento" as keyof Client, e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
              <div className="space-y-2">
                <Label>Género</Label>
                <Input 
                  value={(formData as any).genero || ""} 
                  onChange={(e) => handleInputChange("genero" as keyof Client, e.target.value)} 
                  disabled={!isEditMode} 
                />
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
                <Input 
                  value={(formData as any).estado_civil || ""} 
                  onChange={(e) => handleInputChange("estado_civil" as keyof Client, e.target.value)} 
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
              <div className="space-y-2">
                <Label>Teléfono Amigo</Label>
                <Input 
                  value={(formData as any).tel_amigo || ""} 
                  onChange={(e) => handleInputChange("tel_amigo" as keyof Client, e.target.value)} 
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
                  onChange={(e) => handleInputChange("province" as keyof Client, e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
              <div className="space-y-2">
                <Label>Cantón</Label>
                <Input 
                  value={(formData as any).canton || ""} 
                  onChange={(e) => handleInputChange("canton" as keyof Client, e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
              <div className="space-y-2">
                <Label>Distrito</Label>
                <Input 
                  value={(formData as any).distrito || ""} 
                  onChange={(e) => handleInputChange("distrito" as keyof Client, e.target.value)} 
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
                <Label>Institución</Label>
                <Input 
                  value={(formData as any).institucion_labora || ""} 
                  onChange={(e) => handleInputChange("institucion_labora" as keyof Client, e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
              <div className="space-y-2">
                <Label>Departamento / Cargo</Label>
                <Input 
                  value={(formData as any).departamento_cargo || ""} 
                  onChange={(e) => handleInputChange("departamento_cargo" as keyof Client, e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
              <div className="space-y-2">
                <Label>Ocupación</Label>
                <Input 
                  value={(formData as any).ocupacion || ""} 
                  onChange={(e) => handleInputChange("ocupacion" as keyof Client, e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
              <div className="space-y-2">
                <Label>Deductora ID</Label>
                <Input 
                  value={(formData as any).deductora_id || ""} 
                  onChange={(e) => handleInputChange("deductora_id" as keyof Client, e.target.value)} 
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
                  value={formData.status || ""} 
                  onChange={(e) => handleInputChange("status", e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
              <div className="space-y-2">
                <Label>Lead Status ID</Label>
                <Input 
                  value={(formData as any).lead_status_id || ""} 
                  onChange={(e) => handleInputChange("lead_status_id" as keyof Client, e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
              <div className="space-y-2">
                <Label>Assigned Agent ID</Label>
                <Input 
                  value={(formData as any).assigned_to_id || ""} 
                  onChange={(e) => handleInputChange("assigned_to_id" as keyof Client, e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
              <div className="space-y-2">
                <Label>Person Type ID</Label>
                <Input 
                  value={(formData as any).person_type_id || ""} 
                  onChange={(e) => handleInputChange("person_type_id" as keyof Client, e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
              <div className="space-y-2">
                <Label>Is Active</Label>
                <Select 
                    value={formData.is_active ? "true" : "false"} 
                    onValueChange={(value) => handleInputChange("is_active" as keyof Client, value === "true")}
                    disabled={!isEditMode}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="true">Active</SelectItem>
                        <SelectItem value="false">Inactive</SelectItem>
                    </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fuente (Source)</Label>
                <Input 
                  value={(formData as any).source || ""} 
                  onChange={(e) => handleInputChange("source" as keyof Client, e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
              <div className="space-y-2">
                <Label>Relacionado A</Label>
                <Input 
                  value={(formData as any).relacionado_a || ""} 
                  onChange={(e) => handleInputChange("relacionado_a" as keyof Client, e.target.value)} 
                  disabled={!isEditMode} 
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo Relación</Label>
                <Input 
                  value={(formData as any).tipo_relacion || ""} 
                  onChange={(e) => handleInputChange("tipo_relacion" as keyof Client, e.target.value)} 
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
        </div>

        {/* Side Panel */}
        {isPanelVisible && (
          <div className="space-y-6 lg:col-span-2 h-[calc(100vh-8rem)] flex flex-col">
            <Card className="flex-1 flex flex-col overflow-hidden border-0 shadow-none lg:border lg:shadow-sm">
              <Tabs defaultValue="comunicaciones" className="flex flex-col h-full">
                <div className="px-4 pt-4 border-b">
                  <TabsList className="grid w-full grid-cols-3 mb-4">
                    <TabsTrigger value="oportunidades">Oportunidades</TabsTrigger>
                    <TabsTrigger value="comunicaciones">Comunicaciones</TabsTrigger>
                    <TabsTrigger value="archivos">Archivos</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="oportunidades" className="flex-1 p-4 m-0 overflow-y-auto">
                  <div className="text-center text-muted-foreground py-8">
                    No hay oportunidades activas.
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

                <TabsContent value="archivos" className="flex-1 p-4 m-0 overflow-y-auto">
                   <div className="text-center text-muted-foreground py-8">
                    No hay archivos adjuntos.
                  </div>
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
