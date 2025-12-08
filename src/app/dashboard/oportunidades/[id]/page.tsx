"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  RefreshCw, 
  Paperclip, 
  Smile, 
  Send, 
  List, 
  MessageSquare, 
  MessageCircle 
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";

import api from "@/lib/axios";
import { Opportunity, chatMessages, OPPORTUNITY_STATUSES } from "@/lib/data";

export default function OpportunityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = params.id as string;

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Mock data for initial render if API fails or for development
  const mockOpportunity: Opportunity = {
    id: "25-00001-OP",
    lead_cedula: "1-2345-6789",
    vertical: "CCSS",
    amount: 2090900,
    status: "En seguimiento",
    created_at: "2025-11-19T21:31:00",
    updated_at: "2025-12-08T16:00:00",
    expected_close_date: "2026-01-14",
    amparo_id: "AMP-2025-001",
    tags: ["Lista de espera", "Cita a largo plazo"],
    lead: {
      id: "1",
      name: "Maria",
      apellido1: "Fernández",
      cedula: "1-2345-6789",
      email: "maria@example.com",
      phone: "8888-8888"
    }
  };

  useEffect(() => {
    const fetchOpportunity = async () => {
      try {
        // In a real scenario, uncomment this:
        // const response = await api.get(`/api/opportunities/${id}`);
        // setOpportunity(response.data);
        
        // For now, use mock data to match the design requirement
        setOpportunity(mockOpportunity);
      } catch (error) {
        console.error("Error fetching opportunity:", error);
        toast({ title: "Error", description: "No se pudo cargar la oportunidad.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchOpportunity();
    }
  }, [id, toast]);

  const handleStatusChange = async (newStatus: string) => {
    if (!opportunity) return;
    
    try {
      setUpdatingStatus(true);
      // Optimistic update
      setOpportunity(prev => prev ? { ...prev, status: newStatus } : null);
      
      // API call
      await api.put(`/api/opportunities/${opportunity.id}`, { status: newStatus });
      
      toast({ title: "Estado actualizado", description: `La oportunidad ahora está ${newStatus}.` });
    } catch (error) {
      console.error("Error updating status:", error);
      toast({ title: "Error", description: "No se pudo actualizar el estado.", variant: "destructive" });
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center p-8">Cargando...</div>;
  }

  if (!opportunity) {
    return <div className="p-8 text-center">Oportunidad no encontrada.</div>;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(amount);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('es-ES', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
  };

  return (
    <div className="space-y-6 p-6 bg-slate-50/50 min-h-screen">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" className="gap-2 pl-0 hover:bg-transparent hover:text-primary" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Regresar al listado
        </Button>
        <Button variant="outline" className="gap-2 bg-white">
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Content - Left Column */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="resumen" className="w-full">
            <TabsList className="w-full justify-start bg-transparent p-0 border-b rounded-none h-auto">
              <TabsTrigger 
                value="resumen" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
              >
                Resumen
              </TabsTrigger>
              <TabsTrigger 
                value="tareas" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
              >
                Tareas
              </TabsTrigger>
            </TabsList>

            <TabsContent value="resumen" className="mt-6">
              <Card className="border shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7 border-b">
                  <CardTitle className="text-xl font-bold">{opportunity.id}</CardTitle>
                  <div className="flex items-center gap-2">
                    {OPPORTUNITY_STATUSES.map((status) => (
                      <Button
                        key={status}
                        variant={opportunity.status === status ? "default" : "outline"}
                        onClick={() => handleStatusChange(status)}
                        disabled={updatingStatus}
                        className={`h-8 text-xs ${
                          opportunity.status === status 
                            ? "bg-slate-900 text-white hover:bg-slate-800" 
                            : "text-slate-600 border-slate-200"
                        }`}
                      >
                        {status}
                      </Button>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-8 gap-x-12">
                    
                    {/* Left Column of Details */}
                    <div className="space-y-6">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase mb-1">CÉDULA</p>
                        <p className="text-sm font-medium text-slate-900">{opportunity.lead_cedula}</p>
                      </div>
                      
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase mb-1">VERTICAL</p>
                        <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-0">
                          {opportunity.vertical}
                        </Badge>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase mb-1">NOMBRE COMPLETO</p>
                        <p className="text-sm font-medium text-slate-900">
                          {opportunity.lead ? `${opportunity.lead.name} ${opportunity.lead.apellido1}` : 'N/A'}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase mb-1">TIPO</p>
                        <div className="flex flex-wrap gap-2">
                          {opportunity.tags?.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-slate-600 font-normal">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase mb-1">MONTO ESTIMADO</p>
                        <p className="text-sm font-medium text-slate-900">{formatCurrency(opportunity.amount)}</p>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase mb-1">AMPARO VINCULADO</p>
                        <p className="text-sm font-medium text-blue-600 hover:underline cursor-pointer">
                          {opportunity.amparo_id}
                        </p>
                      </div>
                    </div>

                    {/* Right Column of Details */}
                    <div className="space-y-6">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase mb-1">CIERRE ESPERADO</p>
                        <p className="text-sm font-medium text-slate-900">{formatDate(opportunity.expected_close_date)}</p>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase mb-1">CREADA</p>
                        <p className="text-sm font-medium text-slate-900">{formatDateTime(opportunity.created_at)}</p>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase mb-1">ACTUALIZADA</p>
                        <p className="text-sm font-medium text-slate-900">{formatDateTime(opportunity.updated_at)}</p>
                      </div>
                    </div>

                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="tareas">
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  No hay tareas pendientes.
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Side Panel - Right Column */}
        <div className="lg:col-span-1 space-y-6">
          <Tabs defaultValue="comunicaciones" className="w-full">
            <TabsList className="w-full grid grid-cols-2 bg-white p-1 border rounded-lg h-auto">
              <TabsTrigger value="comunicaciones" className="data-[state=active]:bg-slate-100">Comunicaciones</TabsTrigger>
              <TabsTrigger value="archivos" className="data-[state=active]:bg-slate-100">Archivos</TabsTrigger>
            </TabsList>

            <TabsContent value="comunicaciones" className="mt-4">
              <Card className="border shadow-sm h-[600px] flex flex-col">
                <div className="p-3 border-b">
                  <div className="flex gap-2 bg-slate-100 p-1 rounded-md w-fit">
                    <Button variant="ghost" size="sm" className="h-7 px-3 bg-white shadow-sm text-xs font-medium">
                      <List className="h-3 w-3 mr-1.5" />
                      Todo
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-3 text-muted-foreground text-xs font-medium hover:bg-white/50">
                      <MessageSquare className="h-3 w-3 mr-1.5" />
                      Mensajes
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-3 text-muted-foreground text-xs font-medium hover:bg-white/50">
                      <MessageCircle className="h-3 w-3 mr-1.5" />
                      Comentarios
                    </Button>
                  </div>
                </div>

                <div className="p-4 border-b bg-slate-50/30">
                  <div className="relative rounded-lg border bg-white shadow-sm focus-within:ring-1 focus-within:ring-primary">
                    <Input 
                      className="border-0 focus-visible:ring-0 px-4 py-3 h-auto text-sm" 
                      placeholder="Escribe tu mensaje..." 
                    />
                    <div className="flex items-center justify-between px-2 pb-2 pt-1">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                          <Paperclip className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                          <Smile className="h-4 w-4" />
                        </Button>
                      </div>
                      <Button size="icon" className="h-8 w-8 bg-slate-400 hover:bg-slate-500">
                        <Send className="h-4 w-4 text-white" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
                   {/* Placeholder for empty state or messages */}
                   <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm">
                      <p>No hay comunicaciones recientes</p>
                   </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="archivos" className="mt-4">
               <Card className="border shadow-sm h-[600px]">
                 <CardContent className="p-6 text-center text-muted-foreground">
                   No hay archivos adjuntos.
                 </CardContent>
               </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
