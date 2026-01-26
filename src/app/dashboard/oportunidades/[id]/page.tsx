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
  MessageCircle,
  FileText,
  File,
  Image as ImageIcon,
  FileSpreadsheet,
  Trash,
  Upload,
  Loader2,
  FolderOpen,
  FolderInput,
  Download,
  CreditCard,
  Receipt
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
import { Opportunity, OPPORTUNITY_STATUSES } from "@/lib/data";
// COMENTADO TEMPORALMENTE
// import { CaseChat } from "@/components/case-chat";
import { Label } from "@/components/ui/label";

// Tipo para archivos del filesystem
interface OpportunityFile {
  name: string;
  path: string;
  url: string;
  size: number;
  last_modified: number;
}

type Product = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  is_default: boolean;
  order_column: number;
};

export default function OpportunityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = params.id as string;

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingType, setUpdatingType] = useState(false);

  // Estados para archivos
  const [heredados, setHeredados] = useState<OpportunityFile[]>([]);
  const [especificos, setEspecificos] = useState<OpportunityFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Cargar archivos de la oportunidad
  const fetchFiles = async () => {
    try {
      setLoadingFiles(true);
      const res = await api.get(`/api/opportunities/${id}/files`);
      setHeredados(res.data.heredados || []);
      setEspecificos(res.data.especificos || []);
    } catch (error) {
      console.error("Error fetching files:", error);
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [opportunityRes, productsRes] = await Promise.all([
          api.get(`/api/opportunities/${id}`),
          api.get('/api/products'),
        ]);

        const opportunityData = opportunityRes.data.data || opportunityRes.data;
        const productsData = productsRes.data as Product[];

        setOpportunity(opportunityData);
        setProducts(productsData);

        // Cargar archivos
        fetchFiles();
      } catch (error) {
        console.error("Error fetching data:", error);
        toast({ title: "Error", description: "No se pudo cargar la información.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchData();
    }
  }, [id, toast]);

  // Estados para uploads individuales
  const [uploadingCedula, setUploadingCedula] = useState(false);
  const [uploadingRecibo, setUploadingRecibo] = useState(false);

  // Subir archivo con prefijo específico
  const handleFileUploadWithType = async (e: React.ChangeEvent<HTMLInputElement>, type: 'cedula' | 'recibo') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const setUploadingState = type === 'cedula' ? setUploadingCedula : setUploadingRecibo;
    const prefix = type === 'cedula' ? 'cedula' : 'recibo';

    // Renombrar archivo con prefijo
    const ext = file.name.split('.').pop();
    const newFileName = `${prefix}_${opportunity?.lead_cedula || 'unknown'}.${ext}`;
    const renamedFile = new File([file], newFileName, { type: file.type });

    const formData = new FormData();
    formData.append('file', renamedFile);

    try {
      setUploadingState(true);
      await api.post(`/api/opportunities/${id}/files`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast({ title: "Éxito", description: `${type === 'cedula' ? 'Cédula' : 'Recibo'} subido correctamente.` });
      fetchFiles();
    } catch (error) {
      console.error("Error uploading file:", error);
      toast({ title: "Error", description: "No se pudo subir el archivo.", variant: "destructive" });
    } finally {
      setUploadingState(false);
      e.target.value = '';
    }
  };

  // Subir archivo(s) específico(s) (genérico)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);

        try {
          await api.post(`/api/opportunities/${id}/files`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          successCount++;
        } catch (error) {
          console.error(`Error uploading file ${file.name}:`, error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast({
          title: "Éxito",
          description: `${successCount} archivo(s) subido(s) correctamente.${errorCount > 0 ? ` ${errorCount} fallaron.` : ''}`
        });
        fetchFiles();
      } else {
        toast({ title: "Error", description: "No se pudo subir ningún archivo.", variant: "destructive" });
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // Descargar archivo
  const handleDownloadFile = (file: OpportunityFile) => {
    const link = document.createElement('a');
    link.href = file.url;
    link.download = file.name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Verificar si un archivo es imagen
  const isImageFile = (fileName: string) => {
    return fileName.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/);
  };

  // Verificar si un archivo es PDF
  const isPdfFile = (fileName: string) => {
    return fileName.toLowerCase().endsWith('.pdf');
  };

  // Obtener archivo de cédula
  const getCedulaFile = () => {
    return heredados.find(f => f.name.toLowerCase().startsWith('cedula'));
  };

  // Obtener archivo de recibo
  const getReciboFile = () => {
    return heredados.find(f => f.name.toLowerCase().startsWith('recibo'));
  };

  // Eliminar archivo
  const handleDeleteFile = async (filename: string) => {
    if (!confirm(`¿Eliminar el archivo "${filename}"?`)) return;

    try {
      await api.delete(`/api/opportunities/${id}/files/${encodeURIComponent(filename)}`);
      toast({ title: "Éxito", description: "Archivo eliminado." });
      fetchFiles();
    } catch (error) {
      console.error("Error deleting file:", error);
      toast({ title: "Error", description: "No se pudo eliminar el archivo.", variant: "destructive" });
    }
  };

  // Helper para obtener info del tipo de archivo
  const getFileTypeInfo = (fileName: string) => {
    const name = fileName.toLowerCase();
    if (name.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
      return { icon: ImageIcon, label: 'Imagen', color: 'text-purple-600' };
    }
    if (name.endsWith('.pdf')) {
      return { icon: FileText, label: 'PDF', color: 'text-red-600' };
    }
    if (name.match(/\.(xls|xlsx|csv)$/)) {
      return { icon: FileSpreadsheet, label: 'Excel', color: 'text-green-600' };
    }
    if (name.match(/\.(doc|docx)$/)) {
      return { icon: FileText, label: 'Word', color: 'text-blue-600' };
    }
    if (name.match(/\.(html|htm)$/)) {
      return { icon: FileText, label: 'HTML', color: 'text-orange-600' };
    }
    return { icon: File, label: 'Archivo', color: 'text-slate-600' };
  };

  // Formatear tamaño de archivo
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

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

      <div className="grid grid-cols-1 gap-6">
        {/* Main Content - Full Width (Chat panel commented out) */}
        <div className="space-y-6">
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
                        <p className="text-xs font-medium text-muted-foreground uppercase mb-1">INSTITUCIÓN</p>
                        <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-0">
                          {opportunity.vertical}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase mb-1">NOMBRE COMPLETO</p>
                        <p className="text-sm font-medium text-slate-900">
                          {`${opportunity.lead?.name ? opportunity.lead?.name : ''} ${opportunity.lead?.apellido1 ? opportunity.lead?.apellido1 : ''}`}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase mb-1">TIPO</p>
                        <div className="flex flex-wrap gap-2">
                          {products.map((product) => (
                            <Button
                              key={product.id}
                              variant={opportunity.opportunity_type === product.name ? "default" : "outline"}
                              onClick={() => handleTypeChange(product.name)}
                              disabled={updatingType}
                              className={`h-7 text-xs ${
                                opportunity.opportunity_type === product.name
                                  ? "bg-slate-900 text-white hover:bg-slate-800"
                                  : "text-slate-600 border-slate-200"
                              }`}
                            >
                              {product.name}
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
              <div className="space-y-4">
                {loadingFiles ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    {/* Documentos Requeridos: Cédula y Recibo */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Cédula */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-blue-500" />
                            Cédula
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {(() => {
                            const cedulaFile = getCedulaFile();
                            if (cedulaFile) {
                              return (
                                <div className="space-y-3">
                                  {/* Miniatura */}
                                  <div className="relative w-full h-48 bg-muted rounded-lg overflow-hidden border">
                                    {isImageFile(cedulaFile.name) ? (
                                      <img
                                        src={cedulaFile.url}
                                        alt="Cédula"
                                        className="w-full h-full object-contain"
                                      />
                                    ) : isPdfFile(cedulaFile.name) ? (
                                      <iframe
                                        src={cedulaFile.url}
                                        className="w-full h-full"
                                        title="Cédula PDF"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <FileText className="h-16 w-16 text-muted-foreground" />
                                      </div>
                                    )}
                                  </div>
                                  {/* Info y acciones */}
                                  <div className="flex items-center justify-between">
                                    <div className="text-sm">
                                      <p className="font-medium truncate">{cedulaFile.name}</p>
                                      <p className="text-xs text-muted-foreground">{formatFileSize(cedulaFile.size)}</p>
                                    </div>
                                    <div className="flex gap-1">
                                      <Button variant="outline" size="sm" onClick={() => handleDownloadFile(cedulaFile)}>
                                        <Download className="h-4 w-4" />
                                      </Button>
                                      <Button variant="ghost" size="sm" onClick={() => handleDeleteFile(cedulaFile.name)}>
                                        <Trash className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            return (
                              <div className="space-y-3">
                                <div className="w-full h-48 bg-muted/50 rounded-lg border-2 border-dashed flex items-center justify-center">
                                  <div className="text-center text-muted-foreground">
                                    <CreditCard className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">Sin cédula</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Input
                                    id="cedula-upload"
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={(e) => handleFileUploadWithType(e, 'cedula')}
                                    disabled={uploadingCedula}
                                    className="cursor-pointer"
                                  />
                                  {uploadingCedula && <Loader2 className="h-4 w-4 animate-spin" />}
                                </div>
                              </div>
                            );
                          })()}
                        </CardContent>
                      </Card>

                      {/* Recibo de Servicio */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Receipt className="h-4 w-4 text-green-500" />
                            Recibo de Servicio
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {(() => {
                            const reciboFile = getReciboFile();
                            if (reciboFile) {
                              return (
                                <div className="space-y-3">
                                  {/* Miniatura */}
                                  <div className="relative w-full h-48 bg-muted rounded-lg overflow-hidden border">
                                    {isImageFile(reciboFile.name) ? (
                                      <img
                                        src={reciboFile.url}
                                        alt="Recibo"
                                        className="w-full h-full object-contain"
                                      />
                                    ) : isPdfFile(reciboFile.name) ? (
                                      <iframe
                                        src={reciboFile.url}
                                        className="w-full h-full"
                                        title="Recibo PDF"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <FileText className="h-16 w-16 text-muted-foreground" />
                                      </div>
                                    )}
                                  </div>
                                  {/* Info y acciones */}
                                  <div className="flex items-center justify-between">
                                    <div className="text-sm">
                                      <p className="font-medium truncate">{reciboFile.name}</p>
                                      <p className="text-xs text-muted-foreground">{formatFileSize(reciboFile.size)}</p>
                                    </div>
                                    <div className="flex gap-1">
                                      <Button variant="outline" size="sm" onClick={() => handleDownloadFile(reciboFile)}>
                                        <Download className="h-4 w-4" />
                                      </Button>
                                      <Button variant="ghost" size="sm" onClick={() => handleDeleteFile(reciboFile.name)}>
                                        <Trash className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            return (
                              <div className="space-y-3">
                                <div className="w-full h-48 bg-muted/50 rounded-lg border-2 border-dashed flex items-center justify-center">
                                  <div className="text-center text-muted-foreground">
                                    <Receipt className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">Sin recibo</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Input
                                    id="recibo-upload"
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={(e) => handleFileUploadWithType(e, 'recibo')}
                                    disabled={uploadingRecibo}
                                    className="cursor-pointer"
                                  />
                                  {uploadingRecibo && <Loader2 className="h-4 w-4 animate-spin" />}
                                </div>
                              </div>
                            );
                          })()}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Específicos de Oportunidad */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <FolderOpen className="h-4 w-4 text-green-500" />
                          Específicos de Oportunidad
                          <Badge variant="secondary" className="ml-auto">{especificos.length}</Badge>
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">Documentos subidos directamente aquí</p>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Upload para documentos específicos */}
                        <div className="flex items-center gap-4 pb-3 border-b">
                          <div className="grid w-full max-w-sm items-center gap-1.5">
                            <Label htmlFor="file-upload">Agregar documento específico a esta oportunidad</Label>
                            <Input
                              id="file-upload"
                              type="file"
                              multiple
                              onChange={handleFileUpload}
                              disabled={uploading}
                              className="cursor-pointer"
                            />
                          </div>
                          {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                        </div>

                        {/* Lista de archivos específicos */}
                        {especificos.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">Sin archivos específicos</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
                            {especificos.map((file) => {
                              const { icon: FileIcon, color } = getFileTypeInfo(file.name);
                              return (
                                <div key={file.path} className="border rounded-lg overflow-hidden">
                                  {/* Miniatura */}
                                  <div className="h-32 bg-muted flex items-center justify-center">
                                    {isImageFile(file.name) ? (
                                      <img
                                        src={file.url}
                                        alt={file.name}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : isPdfFile(file.name) ? (
                                      <iframe
                                        src={file.url}
                                        className="w-full h-full pointer-events-none"
                                        title={file.name}
                                      />
                                    ) : (
                                      <FileIcon className={`h-12 w-12 ${color}`} />
                                    )}
                                  </div>
                                  {/* Info */}
                                  <div className="p-2">
                                    <a
                                      href={file.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs font-medium hover:underline truncate block"
                                    >
                                      {file.name}
                                    </a>
                                    <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                                    <div className="flex gap-1 mt-2">
                                      <Button variant="outline" size="sm" className="h-7 flex-1" onClick={() => handleDownloadFile(file)}>
                                        <Download className="h-3 w-3 mr-1" />
                                        <span className="text-xs">Descargar</span>
                                      </Button>
                                      <Button variant="ghost" size="sm" className="h-7" onClick={() => handleDeleteFile(file.name)}>
                                        <Trash className="h-3 w-3 text-destructive" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Side Panel - Chat lateral igual que leads */}
        {/* COMENTADO TEMPORALMENTE
        <div className="space-y-1 lg:col-span-1">
          <CaseChat conversationId={id} />
        </div>
        */}
      </div>
    </div>
  );
}
