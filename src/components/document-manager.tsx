'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Paperclip, Trash, Upload, Loader2, File, Image as ImageIcon, FileSpreadsheet, FileCode, Download, X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/axios';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

interface Document {
  id: number;
  name: string;
  created_at: string;
  url?: string | null;
  mime_type?: string | null;
}

interface DocumentManagerProps {
  personId: number;
  initialDocuments?: Document[];
  readonly?: boolean;
  onDocumentChange?: () => void;
}

// Helper function to determine file type info
const getFileTypeInfo = (mimeType?: string | null, fileName?: string) => {
  const type = mimeType || '';
  const name = fileName?.toLowerCase() || '';

  if (type.includes('image') || name.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
    return { icon: ImageIcon, label: 'Imagen', color: 'text-purple-600', isImage: true, isPdf: false };
  }
  if (type.includes('pdf') || name.endsWith('.pdf')) {
    return { icon: FileText, label: 'PDF', color: 'text-red-600', isImage: false, isPdf: true };
  }
  if (type.includes('spreadsheet') || type.includes('excel') || name.match(/\.(xls|xlsx|csv)$/)) {
    return { icon: FileSpreadsheet, label: 'Excel', color: 'text-green-600', isImage: false, isPdf: false };
  }
  if (type.includes('word') || name.match(/\.(doc|docx)$/)) {
    return { icon: FileText, label: 'Word', color: 'text-blue-600', isImage: false, isPdf: false };
  }

  return { icon: File, label: 'Archivo', color: 'text-slate-600', isImage: false, isPdf: false };
};

export function DocumentManager({ personId, initialDocuments = [], readonly = false, onDocumentChange }: DocumentManagerProps) {
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState<string>('otro');
  const { toast } = useToast();

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxDoc, setLightboxDoc] = useState<Document | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [zoom, setZoom] = useState(1);

  // Get viewable documents (images and PDFs)
  const viewableDocs = documents.filter(doc => {
    const { isImage, isPdf } = getFileTypeInfo(doc.mime_type, doc.name);
    return isImage || isPdf;
  });

  const openLightbox = (doc: Document) => {
    const index = viewableDocs.findIndex(d => d.id === doc.id);
    setLightboxDoc(doc);
    setLightboxIndex(index >= 0 ? index : 0);
    setZoom(1);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    setLightboxDoc(null);
    setZoom(1);
  };

  const goToPrevious = useCallback(() => {
    if (viewableDocs.length <= 1) return;
    const newIndex = lightboxIndex === 0 ? viewableDocs.length - 1 : lightboxIndex - 1;
    setLightboxIndex(newIndex);
    setLightboxDoc(viewableDocs[newIndex]);
    setZoom(1);
  }, [lightboxIndex, viewableDocs]);

  const goToNext = useCallback(() => {
    if (viewableDocs.length <= 1) return;
    const newIndex = lightboxIndex === viewableDocs.length - 1 ? 0 : lightboxIndex + 1;
    setLightboxIndex(newIndex);
    setLightboxDoc(viewableDocs[newIndex]);
    setZoom(1);
  }, [lightboxIndex, viewableDocs]);

  // Keyboard navigation
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
  }, [lightboxOpen, goToPrevious, goToNext]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('person_id', String(personId));
    formData.append('category', category);

    try {
      setUploading(true);
      const response = await api.post('/api/person-documents', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      // Backend devuelve { document: {...}, synced_to_opportunities: N }
      const newDoc = response.data.document || response.data;
      setDocuments((prev) => [newDoc, ...prev]);

      const syncCount = response.data.synced_to_opportunities || 0;
      const syncMsg = syncCount > 0 ? ` (sincronizado a ${syncCount} oportunidad${syncCount > 1 ? 'es' : ''})` : '';
      toast({ title: 'Éxito', description: `Documento subido correctamente.${syncMsg}` });

      // Notify parent component to refresh
      if (onDocumentChange) {
        onDocumentChange();
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      toast({ title: 'Error', description: 'No se pudo subir el documento.', variant: 'destructive' });
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/person-documents/${id}`);
      setDocuments((prev) => prev.filter((doc) => doc.id !== id));
      toast({ title: 'Éxito', description: 'Documento eliminado.' });

      // Notify parent component to refresh
      if (onDocumentChange) {
        onDocumentChange();
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({ title: 'Error', description: 'No se pudo eliminar el documento.', variant: 'destructive' });
    }
  };

  function formatDate(dateString?: string | null): string {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat("es-CR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }

  const getFullUrl = (url: string) => {
    // If the URL is already absolute (e.g. from Laravel asset()), use it directly.
    if (url.startsWith('http')) return url;

    // Otherwise, construct the URL using the environment variable.
    // In production, ensure NEXT_PUBLIC_API_BASE_URL is set to your production API URL.
    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
    const baseUrl = backendUrl.replace(/\/api\/?$/, '');
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${baseUrl}${path}`;
  };

  return (
    <div className="space-y-4">
      {!readonly && (
        <div className="flex items-end gap-4">
          <div className="grid w-full max-w-xs items-center gap-1.5">
            <Label htmlFor="document-category">Tipo de Documento</Label>
            <Select value={category} onValueChange={setCategory} disabled={uploading}>
              <SelectTrigger id="document-category">
                <SelectValue placeholder="Seleccionar tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cedula">Cédula</SelectItem>
                <SelectItem value="recibo_servicio">Recibo de Servicio</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid w-full max-w-sm items-center gap-1.5 transition-colors cursor-pointer">
            <Label htmlFor="document-upload">Archivo</Label>
            <Input
              className='cursor-pointer'
              id="document-upload"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,image/*,application/pdf"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </div>
          {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
      )}

      <div className="space-y-2">
        {documents.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No hay archivos adjuntos.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map((doc) => {
              const { icon: FileIcon, label, color, isImage, isPdf } = getFileTypeInfo(doc.mime_type, doc.name);
              const fullUrl = doc.url ? getFullUrl(doc.url) : '';
              return (
                <div
                  key={doc.id}
                  className="rounded-lg border overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* Miniatura */}
                  <div className="h-32 bg-muted flex items-center justify-center relative">
                    {isImage && fullUrl ? (
                      <button
                        type="button"
                        onClick={() => openLightbox(doc)}
                        className="w-full h-full cursor-pointer"
                      >
                        <img
                          src={fullUrl}
                          alt={doc.name}
                          className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                        />
                      </button>
                    ) : isPdf && fullUrl ? (
                      <button
                        type="button"
                        onClick={() => openLightbox(doc)}
                        className="w-full h-full cursor-pointer relative group"
                      >
                        <iframe
                          src={fullUrl}
                          className="w-full h-full pointer-events-none"
                          title={doc.name}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                          <Maximize2 className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                        </div>
                      </button>
                    ) : (
                      <a href={fullUrl || '#'} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-full h-full hover:bg-muted/80 transition-colors">
                        <FileIcon className={`h-12 w-12 ${color}`} />
                      </a>
                    )}
                  </div>
                  {/* Info del archivo */}
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Checkbox id={`doc-${doc.id}`} className="shrink-0" />
                          <a
                            href={fullUrl || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium truncate hover:underline block"
                            title={doc.name}
                          >
                            {doc.name}
                          </a>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={`text-[10px] h-5 px-1.5 font-normal ${color} border-current opacity-80`}>
                            {label}
                          </Badge>
                          {(doc as any).category && (doc as any).category !== 'otro' && (
                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal">
                              {{
                                cedula: '📄 Cédula',
                                recibo_servicio: '💡 Recibo',
                                comprobante_ingresos: '💰 Ingresos',
                                constancia_trabajo: '💼 Trabajo'
                              }[(doc as any).category] || (doc as any).category}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">{formatDate(doc.created_at)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {fullUrl && (
                          <>
                            {(isImage || isPdf) ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => openLightbox(doc)}
                              >
                                <Maximize2 className={`h-4 w-4 ${color}`} />
                                <span className="sr-only">Ver</span>
                              </Button>
                            ) : (
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
                                <a href={fullUrl} target="_blank" rel="noopener noreferrer">
                                  <FileIcon className={`h-4 w-4 ${color}`} />
                                  <span className="sr-only">Ver</span>
                                </a>
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
                              <a href={fullUrl} download={doc.name}>
                                <Download className="h-4 w-4 text-blue-600" />
                                <span className="sr-only">Descargar</span>
                              </a>
                            </Button>
                          </>
                        )}
                        {!readonly && (
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleDelete(doc.id)}>
                            <Trash className="h-4 w-4 text-destructive" />
                            <span className="sr-only">Eliminar</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      <Dialog open={lightboxOpen} onOpenChange={(open) => !open && closeLightbox()}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-auto h-auto p-0 bg-black/95 border-none overflow-hidden">
          <DialogTitle className="sr-only">
            {lightboxDoc?.name || 'Vista previa del documento'}
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
          {viewableDocs.length > 1 && (
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
          {lightboxDoc && (() => {
            const { isImage, isPdf } = getFileTypeInfo(lightboxDoc.mime_type, lightboxDoc.name);
            const fullUrl = lightboxDoc.url ? getFullUrl(lightboxDoc.url) : '';

            if (isImage && fullUrl) {
              return (
                <div className="flex items-center justify-center w-full h-[85vh] p-4">
                  <img
                    src={fullUrl}
                    alt={lightboxDoc.name}
                    className="max-w-full max-h-full object-contain transition-transform duration-200"
                    style={{ transform: `scale(${zoom})` }}
                  />
                </div>
              );
            }

            if (isPdf && fullUrl) {
              return (
                <div className="w-[90vw] h-[85vh]">
                  <iframe
                    src={fullUrl}
                    className="w-full h-full"
                    title={lightboxDoc.name}
                  />
                </div>
              );
            }

            return null;
          })()}

          {/* Bottom bar with file info and controls */}
          <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium truncate max-w-[300px]">
                {lightboxDoc?.name}
              </span>
              {viewableDocs.length > 1 && (
                <span className="text-sm text-white/60">
                  {lightboxIndex + 1} / {viewableDocs.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Zoom controls for images */}
              {lightboxDoc && getFileTypeInfo(lightboxDoc.mime_type, lightboxDoc.name).isImage && (
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
              {lightboxDoc?.url && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20"
                  asChild
                >
                  <a href={getFullUrl(lightboxDoc.url)} download={lightboxDoc.name}>
                    <Download className="h-4 w-4 mr-2" />
                    Descargar
                  </a>
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
