"use client";

import React, { useEffect, useState, FormEvent } from "react";
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
  Receipt,
  PlusCircle,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import api from "@/lib/axios";
import { Opportunity, OPPORTUNITY_STATUSES } from "@/lib/data";
// COMENTADO TEMPORALMENTE
// import { CaseChat } from "@/components/case-chat";
import { Label } from "@/components/ui/label";
import { usePermissions } from "@/contexts/PermissionsContext";

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
  const { hasPermission, loading: permsLoading } = usePermissions();
  const id = params.id as string;

  const canEdit = hasPermission('oportunidades', 'edit');
  const canViewAnalisis = hasPermission('analizados', 'view');
  const canCreateAnalisis = hasPermission('analizados', 'create');

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingType, setUpdatingType] = useState(false);

  // Analisis state
  const [existingAnalisis, setExistingAnalisis] = useState<any>(null);
  const [isAnalisisDialogOpen, setIsAnalisisDialogOpen] = useState(false);
  const [analisisForm, setAnalisisForm] = useState({
    reference: "",
    title: "",
    category: "Crédito",
    monto_credito: "",
    ingreso_bruto: "",
    ingreso_neto: "",
    propuesta: "",
    leadId: "",
    opportunityId: "",
    assignedTo: "",
    openedAt: new Date().toISOString().split('T')[0],
    divisa: "CRC",
    plazo: "36",
    cargo: "",
    nombramiento: "",
  });

  // Estados para archivos
  const [heredados, setHeredados] = useState<OpportunityFile[]>([]);
  const [especificos, setEspecificos] = useState<OpportunityFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxFile, setLightboxFile] = useState<OpportunityFile | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [zoom, setZoom] = useState(1);

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

  // Verificar si existe un análisis para esta oportunidad
  const fetchExistingAnalisis = async () => {
    try {
      const res = await api.get('/api/analisis');
      const analisisList = res.data.data || res.data;
      const analisis = analisisList.find((a: any) => String(a.opportunity_id) === String(id));
      setExistingAnalisis(analisis || null);
    } catch (error) {
      console.error("Error fetching análisis:", error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [opportunityRes, productsRes, usersRes] = await Promise.all([
          api.get(`/api/opportunities/${id}`),
          api.get('/api/products'),
          api.get('/api/agents'),
        ]);

        const opportunityData = opportunityRes.data.data || opportunityRes.data;
        const productsData = productsRes.data as Product[];

        setOpportunity(opportunityData);
        setProducts(productsData);
        setUsers(usersRes.data);

        // Cargar archivos y verificar análisis existente
        fetchFiles();
        fetchExistingAnalisis();
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

  // Lightbox functions
  const getViewableFiles = () => {
    const allFiles = [...heredados, ...especificos];
    return allFiles.filter(f => isImageFile(f.name) || isPdfFile(f.name));
  };

  const openLightbox = (file: OpportunityFile) => {
    const viewableFiles = getViewableFiles();
    const index = viewableFiles.findIndex(f => f.path === file.path);
    setLightboxFile(file);
    setLightboxIndex(index >= 0 ? index : 0);
    setZoom(1);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    setLightboxFile(null);
    setZoom(1);
  };

  const goToPrevious = () => {
    const viewableFiles = getViewableFiles();
    if (viewableFiles.length <= 1) return;
    const newIndex = lightboxIndex === 0 ? viewableFiles.length - 1 : lightboxIndex - 1;
    setLightboxIndex(newIndex);
    setLightboxFile(viewableFiles[newIndex]);
    setZoom(1);
  };

  const goToNext = () => {
    const viewableFiles = getViewableFiles();
    if (viewableFiles.length <= 1) return;
    const newIndex = lightboxIndex === viewableFiles.length - 1 ? 0 : lightboxIndex + 1;
    setLightboxIndex(newIndex);
    setLightboxFile(viewableFiles[newIndex]);
    setZoom(1);
  };

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!lightboxOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') goToPrevious();
      if (e.key === 'ArrowRight') goToNext();
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(z + 0.25, 3));
      if (e.key === '-') setZoom(z => Math.max(z - 0.25, 0.5));
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, lightboxIndex]);

  const handleStatusChange = async (newStatus: string) => {
    if (!opportunity) return;

    const previousStatus = opportunity.status; // Save previous value for rollback

    try {
      setUpdatingStatus(true);
      // Optimistic update
      setOpportunity(prev => prev ? { ...prev, status: newStatus } : null);

      // API call
      await api.put(`/api/opportunities/${opportunity.id}`, { status: newStatus });

      // Si el nuevo estado es "Analizada", verificar si existe un análisis
      if (newStatus === "Analizada") {
        await fetchExistingAnalisis();
      }

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

  // Formatear número con separadores de miles (coma) - para inputs de análisis
  const formatNumberWithCommas = (value: string | number): string => {
    const num = typeof value === 'string' ? value.replace(/[^\d]/g, '') : String(value);
    if (!num) return '';
    return Number(num).toLocaleString('en-US');
  };

  // Parsear valor formateado a número
  const parseFormattedNumber = (value: string): string => {
    return value.replace(/[^\d]/g, '');
  };

  // Analisis Logic
  const handleOpenAnalisisDialog = () => {
    if (!opportunity) return;

    setAnalisisForm({
      reference: String(opportunity.id),
      title: opportunity.opportunity_type || "",
      category: "Crédito",
      monto_credito: opportunity.amount ? String(opportunity.amount) : "",
      ingreso_bruto: "",
      ingreso_neto: "",
      propuesta: "",
      leadId: opportunity.lead?.id ? String(opportunity.lead.id) : "",
      opportunityId: String(opportunity.id),
      assignedTo: "",
      openedAt: new Date().toISOString().split('T')[0],
      divisa: "CRC",
      plazo: "36",
      cargo: "",
      nombramiento: "",
    });
    setIsAnalisisDialogOpen(true);
  };

  const handleAnalisisFormChange = (field: string, value: string) => {
    // Para campos de moneda, guardar solo el valor numérico
    if (['monto_credito', 'ingreso_bruto', 'ingreso_neto'].includes(field)) {
      const numericValue = parseFormattedNumber(value);
      setAnalisisForm(prev => ({ ...prev, [field]: numericValue }));
    } else if (field === 'plazo') {
      // Limitar plazo a máximo 120 meses
      const plazoNum = parseInt(value) || 0;
      const limitedValue = Math.min(Math.max(plazoNum, 0), 120).toString();
      setAnalisisForm(prev => ({ ...prev, [field]: plazoNum > 120 ? limitedValue : value }));
    } else {
      setAnalisisForm(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleAnalisisSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Validar plazo máximo de 120 meses
    const plazoValue = parseInt(analisisForm.plazo) || 36;
    if (plazoValue > 120) {
      toast({ title: "Error", description: "El plazo no puede ser mayor a 120 meses.", variant: "destructive" });
      return;
    }
    if (plazoValue < 1) {
      toast({ title: "Error", description: "El plazo debe ser al menos 1 mes.", variant: "destructive" });
      return;
    }

    try {
      const payload: Record<string, any> = {
        reference: analisisForm.reference,
        title: analisisForm.title,
        status: "Pendiente",
        category: analisisForm.category,
        monto_credito: parseFloat(analisisForm.monto_credito) || 0,
        ingreso_bruto: parseFloat(analisisForm.ingreso_bruto) || 0,
        ingreso_neto: parseFloat(analisisForm.ingreso_neto) || 0,
        propuesta: analisisForm.propuesta || null,
        lead_id: parseInt(analisisForm.leadId),
        opportunity_id: analisisForm.opportunityId,
        plazo: parseInt(analisisForm.plazo) || 36,
        divisa: analisisForm.divisa,
        opened_at: analisisForm.openedAt,
        assigned_to: analisisForm.assignedTo || null,
      };

      // Actualizar campos del lead si se especificaron
      if (analisisForm.leadId && (analisisForm.cargo || analisisForm.nombramiento)) {
        const leadUpdateData: Record<string, string> = {};
        if (analisisForm.cargo) leadUpdateData.puesto = analisisForm.cargo;
        if (analisisForm.nombramiento) leadUpdateData.estado_puesto = analisisForm.nombramiento;

        await api.put(`/api/leads/${analisisForm.leadId}`, leadUpdateData);
      }

      const response = await api.post('/api/analisis', payload);
      toast({ title: "Éxito", description: "Análisis creado correctamente." });
      setIsAnalisisDialogOpen(false);

      // Actualizar el análisis existente para que el botón cambie
      fetchExistingAnalisis();
    } catch (error: any) {
      if (error.response?.status === 409) {
        toast({ title: "Análisis existente", description: "Ya existe un análisis para esta oportunidad." });
        setIsAnalisisDialogOpen(false);
      } else {
        toast({ title: "Error", description: error.response?.data?.message || error.message, variant: "destructive" });
      }
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
                        disabled={updatingStatus || !canEdit || permsLoading}
                        className={`h-8 text-xs ${
                          opportunity.status === status
                            ? "bg-slate-900 text-white hover:bg-slate-800"
                            : "text-slate-600 border-slate-200"
                        }`}
                      >
                        {status}
                      </Button>
                    ))}
                    {opportunity.status === "Analizada" && (
                      existingAnalisis ? (
                        canViewAnalisis && (
                          <Button
                            variant="default"
                            onClick={() => router.push(`/dashboard/analisis/${existingAnalisis.id}`)}
                            className="h-8 text-xs bg-green-600 text-white hover:bg-green-700 gap-1"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Ver Análisis
                          </Button>
                        )
                      ) : (
                        canCreateAnalisis && (
                          <Button
                            variant="default"
                            onClick={handleOpenAnalisisDialog}
                            className="h-8 text-xs bg-indigo-600 text-white hover:bg-indigo-700 gap-1"
                          >
                            <PlusCircle className="h-3.5 w-3.5" />
                            Crear Análisis
                          </Button>
                        )
                      )
                    )}
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
                              disabled={updatingType || !canEdit || permsLoading}
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
                                  <button
                                    type="button"
                                    onClick={() => openLightbox(cedulaFile)}
                                    className="relative w-full h-48 bg-muted rounded-lg overflow-hidden border cursor-pointer group"
                                  >
                                    {isImageFile(cedulaFile.name) ? (
                                      <img
                                        src={cedulaFile.url}
                                        alt="Cédula"
                                        className="w-full h-full object-contain group-hover:opacity-90 transition-opacity"
                                      />
                                    ) : isPdfFile(cedulaFile.name) ? (
                                      <iframe
                                        src={cedulaFile.url}
                                        className="w-full h-full pointer-events-none"
                                        title="Cédula PDF"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <FileText className="h-16 w-16 text-muted-foreground" />
                                      </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                      <Maximize2 className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                                    </div>
                                  </button>
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
                                  <button
                                    type="button"
                                    onClick={() => openLightbox(reciboFile)}
                                    className="relative w-full h-48 bg-muted rounded-lg overflow-hidden border cursor-pointer group"
                                  >
                                    {isImageFile(reciboFile.name) ? (
                                      <img
                                        src={reciboFile.url}
                                        alt="Recibo"
                                        className="w-full h-full object-contain group-hover:opacity-90 transition-opacity"
                                      />
                                    ) : isPdfFile(reciboFile.name) ? (
                                      <iframe
                                        src={reciboFile.url}
                                        className="w-full h-full pointer-events-none"
                                        title="Recibo PDF"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <FileText className="h-16 w-16 text-muted-foreground" />
                                      </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                      <Maximize2 className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                                    </div>
                                  </button>
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
                                  {(isImageFile(file.name) || isPdfFile(file.name)) ? (
                                    <button
                                      type="button"
                                      onClick={() => openLightbox(file)}
                                      className="h-32 w-full bg-muted flex items-center justify-center cursor-pointer relative group"
                                    >
                                      {isImageFile(file.name) ? (
                                        <img
                                          src={file.url}
                                          alt={file.name}
                                          className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                                        />
                                      ) : (
                                        <iframe
                                          src={file.url}
                                          className="w-full h-full pointer-events-none"
                                          title={file.name}
                                        />
                                      )}
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                        <Maximize2 className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                                      </div>
                                    </button>
                                  ) : (
                                    <div className="h-32 bg-muted flex items-center justify-center">
                                      <FileIcon className={`h-12 w-12 ${color}`} />
                                    </div>
                                  )}
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

      {/* Analisis Creation Dialog */}
      <Dialog open={isAnalisisDialogOpen} onOpenChange={setIsAnalisisDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Nuevo Análisis</DialogTitle>
            <DialogDescription>Completa la información del análisis.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAnalisisSubmit} className="flex-1 overflow-y-auto space-y-4 pr-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="reference" className="text-xs">Referencia</Label>
                <Input
                  id="reference"
                  value={analisisForm.reference}
                  readOnly
                  className="bg-muted h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="title" className="text-xs">Título</Label>
                <Input id="title" className="h-8 text-sm" value={analisisForm.title} onChange={e => handleAnalisisFormChange('title', e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="category" className="text-xs">Categoría</Label>
                <Select value={analisisForm.category} onValueChange={v => handleAnalisisFormChange('category', v)}>
                  <SelectTrigger id="category" className="h-8 text-sm"><SelectValue placeholder="Selecciona" /></SelectTrigger>
                  <SelectContent>
                    {products.map(product => <SelectItem key={product.id} value={product.name}>{product.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="divisa" className="text-xs">Divisa</Label>
                <Select value={analisisForm.divisa} onValueChange={v => handleAnalisisFormChange('divisa', v)}>
                  <SelectTrigger id="divisa" className="h-8 text-sm"><SelectValue placeholder="Selecciona" /></SelectTrigger>
                  <SelectContent>
                    {["CRC", "USD", "EUR", "GBP"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="cargo" className="text-xs">Cargo</Label>
                <Input
                  id="cargo"
                  value={analisisForm.cargo}
                  onChange={e => handleAnalisisFormChange('cargo', e.target.value)}
                  className="h-8 text-sm"
                  placeholder="Ej: Ingeniero, Docente, etc."
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nombramiento" className="text-xs">Nombramiento</Label>
                <Select value={analisisForm.nombramiento} onValueChange={v => handleAnalisisFormChange('nombramiento', v)}>
                  <SelectTrigger id="nombramiento" className="h-8 text-sm"><SelectValue placeholder="Selecciona" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Propiedad">Propiedad</SelectItem>
                    <SelectItem value="Interino">Interino</SelectItem>
                    <SelectItem value="De paso">De paso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="monto" className="text-xs">Monto Crédito</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₡</span>
                  <Input id="monto" className="h-8 text-sm pl-7" type="text" inputMode="numeric" value={formatNumberWithCommas(analisisForm.monto_credito)} onChange={e => handleAnalisisFormChange('monto_credito', e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="ingreso_bruto" className="text-xs">Ingreso Bruto</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₡</span>
                  <Input id="ingreso_bruto" className="h-8 text-sm pl-7" type="text" inputMode="numeric" value={formatNumberWithCommas(analisisForm.ingreso_bruto)} onChange={e => handleAnalisisFormChange('ingreso_bruto', e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="ingreso_neto" className="text-xs">Ingreso Neto</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₡</span>
                  <Input id="ingreso_neto" className="h-8 text-sm pl-7" type="text" inputMode="numeric" value={formatNumberWithCommas(analisisForm.ingreso_neto)} onChange={e => handleAnalisisFormChange('ingreso_neto', e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="plazo" className="text-xs">Plazo (Meses)</Label>
                <Input id="plazo" className="h-8 text-sm" type="number" min="1" max="120" value={analisisForm.plazo} onChange={e => handleAnalisisFormChange('plazo', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="assignedTo" className="text-xs">Responsable</Label>
                <Select value={analisisForm.assignedTo} onValueChange={v => handleAnalisisFormChange('assignedTo', v)}>
                  <SelectTrigger id="assignedTo" className="h-8 text-sm"><SelectValue placeholder="Selecciona" /></SelectTrigger>
                  <SelectContent>
                    {users.map(u => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="openedAt" className="text-xs">Fecha Apertura</Label>
                <Input id="openedAt" className="h-8 text-sm" type="date" value={analisisForm.openedAt} onChange={e => handleAnalisisFormChange('openedAt', e.target.value)} />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="propuesta" className="text-xs">Propuesta de Análisis</Label>
                <Textarea id="propuesta" rows={2} className="text-sm" placeholder="Escriba aquí la propuesta o conclusiones del análisis..." value={analisisForm.propuesta} onChange={e => handleAnalisisFormChange('propuesta', e.target.value)} />
              </div>
            </div>
          </form>
          <DialogFooter className="flex-shrink-0 pt-2 border-t">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsAnalisisDialogOpen(false)}>Cancelar</Button>
            <Button type="submit" size="sm" onClick={handleAnalisisSubmit}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox Modal */}
      <Dialog open={lightboxOpen} onOpenChange={(open) => !open && closeLightbox()}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-auto h-auto p-0 bg-black/95 border-none overflow-hidden">
          <DialogTitle className="sr-only">
            {lightboxFile?.name || 'Vista previa del documento'}
          </DialogTitle>

          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-50 text-white hover:bg-white/20 h-10 w-10"
            onClick={closeLightbox}
          >
            <X className="h-6 w-6" />
          </Button>

          {/* Navigation arrows */}
          {getViewableFiles().length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 h-12 w-12"
                onClick={goToPrevious}
              >
                <ChevronLeft className="h-8 w-8" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 h-12 w-12"
                onClick={goToNext}
              >
                <ChevronRight className="h-8 w-8" />
              </Button>
            </>
          )}

          {/* Document content */}
          {lightboxFile && (
            <>
              {isImageFile(lightboxFile.name) ? (
                <div className="flex items-center justify-center w-full h-[85vh] p-4">
                  <img
                    src={lightboxFile.url}
                    alt={lightboxFile.name}
                    className="max-w-full max-h-full object-contain transition-transform duration-200"
                    style={{ transform: `scale(${zoom})` }}
                  />
                </div>
              ) : isPdfFile(lightboxFile.name) ? (
                <div className="w-[90vw] h-[85vh]">
                  <iframe
                    src={lightboxFile.url}
                    className="w-full h-full"
                    title={lightboxFile.name}
                  />
                </div>
              ) : null}
            </>
          )}

          {/* Bottom bar with file info and controls */}
          <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium truncate max-w-[300px]">
                {lightboxFile?.name}
              </span>
              {getViewableFiles().length > 1 && (
                <span className="text-sm text-white/60">
                  {lightboxIndex + 1} / {getViewableFiles().length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Zoom controls for images */}
              {lightboxFile && isImageFile(lightboxFile.name) && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/20"
                    onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-sm w-12 text-center">{Math.round(zoom * 100)}%</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/20"
                    onClick={() => setZoom(z => Math.min(z + 0.25, 3))}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </>
              )}
              {/* Download button */}
              {lightboxFile && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20"
                  onClick={() => handleDownloadFile(lightboxFile)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Descargar
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
