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
import { Opportunity, chatMessages, OPPORTUNITY_STATUSES, OPPORTUNITY_TYPES } from "@/lib/data";
import { DocumentManager } from "@/components/document-manager";
import { CaseChat } from "@/components/case-chat";

export default function OpportunityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = params.id as string;

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingType, setUpdatingType] = useState(false);

  useEffect(() => {
    const fetchOpportunity = async () => {
      try {
        const response = await api.get(`/api/opportunities/${id}`);
        const data = response.data.data || response.data;
        setOpportunity(data);
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

    const previousStatus = opportunity.status; // Save previous value for rollback

    try {
      setUpdatingStatus(true);
      // Optimistic update
      setOpportunity(prev => prev ? { ...prev, status: newStatus } : null);

      // API call
      await api.put(`/api/opportunities/${opportunity.id}`, { status: newStatus });

      toast({ title: "Estado actualizado", description: `La oportunidad ahora está ${newStatus}.` });
    } catch (error) {
      console.error("Error updating status:", error);
      // Revert optimistic update on failure
      setOpportunity(prev => prev ? { ...prev, status: previousStatus } : null);
      toast({ title: "Error", description: "No se pudo actualizar el estado.", variant: "destructive" });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleTypeChange = async (newType: string) => {
    if (!opportunity) return;

    const previousType = opportunity.opportunity_type; // Save previous value for rollback

    try {
      setUpdatingType(true);
      // Optimistic update
      setOpportunity(prev => prev ? { ...prev, opportunity_type: newType } : null);

      // API call
      await api.put(`/api/opportunities/${opportunity.id}`, { opportunity_type: newType });

      toast({ title: "Tipo actualizado", description: `La oportunidad ahora es de tipo ${newType}.` });
    } catch (error) {
      console.error("Error updating type:", error);
      // Revert optimistic update on failure
      setOpportunity(prev => prev ? { ...prev, opportunity_type: previousType } : null);
      toast({ title: "Error", description: "No se pudo actualizar el tipo.", variant: "destructive" });
    } finally {
      setUpdatingType(false);
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Main Content - Left Column (Refactored with Archivos as main tab) */}
        <div className="lg:col-span-3 space-y-6">
          <Tabs defaultValue="resumen" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="resumen">Resumen</TabsTrigger>
              <TabsTrigger value="tareas">Tareas</TabsTrigger>
              <TabsTrigger value="archivos">Archivos</TabsTrigger>
            </TabsList>

            <TabsContent value="resumen">
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
                          {OPPORTUNITY_TYPES.map((type) => (
                            <Button
                              key={type}
                              variant={opportunity.opportunity_type === type ? "default" : "outline"}
                              onClick={() => handleTypeChange(type)}
                              disabled={updatingType}
                              className={`h-7 text-xs ${
                                opportunity.opportunity_type === type 
                                  ? "bg-slate-900 text-white hover:bg-slate-800" 
                                  : "text-slate-600 border-slate-200"
                              }`}
                            >
                              {type}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase mb-1">MONTO ESTIMADO</p>
                        <p className="text-sm font-medium text-slate-900">{formatCurrency(opportunity.amount)}</p>
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

            <TabsContent value="archivos">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Paperclip className="h-5 w-5" />
                    Archivos de la Oportunidad
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Use DocumentManager as in leads */}
                  <DocumentManager 
                    personId={opportunity.lead ? Number(opportunity.lead.id) : 0}
                    initialDocuments={(opportunity.lead && (opportunity.lead as any).documents) ? (opportunity.lead as any).documents : []}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Side Panel - Chat lateral igual que leads */}
        <div className="space-y-1 lg:col-span-2">
          <CaseChat conversationId={id} />
        </div>
      </div>
    </div>
  );
}
