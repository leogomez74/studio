'use client';

import React, { useState, useCallback } from 'react';
import { FileText, Trash, File, Image as ImageIcon, FileSpreadsheet, Download, X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/axios';

interface InvestorDocument {
  id: number;
  name: string;
  created_at?: string;
  url?: string | null;
  mime_type?: string | null;
  category?: string;
}

interface InvestorDocumentManagerProps {
  investorId: number;
  tipoPersona?: string;
  initialDocuments?: InvestorDocument[];
  onDocumentChange?: () => void;
}

const getFileTypeInfo = (mimeType?: string | null, fileName?: string) => {
  const type = mimeType || '';
  const name = fileName?.toLowerCase() || '';
  if (type.includes('image') || name.match(/\.(jpg|jpeg|png|gif|webp)$/))
    return { icon: ImageIcon, label: 'Imagen', color: 'text-purple-600', isImage: true, isPdf: false };
  if (type.includes('pdf') || name.endsWith('.pdf'))
    return { icon: FileText, label: 'PDF', color: 'text-red-600', isImage: false, isPdf: true };
  if (type.includes('spreadsheet') || type.includes('excel') || name.match(/\.(xls|xlsx|csv)$/))
    return { icon: FileSpreadsheet, label: 'Excel', color: 'text-green-600', isImage: false, isPdf: false };
  return { icon: File, label: 'Archivo', color: 'text-slate-600', isImage: false, isPdf: false };
};

const getCategoryLabel = (cat?: string, tipoPersona?: string) => {
  if (cat === 'cedula_pasaporte') return tipoPersona === 'Persona Jurídica' ? 'Cédula Jurídica' : 'Cédula / Pasaporte';
  if (cat === 'contrato_inversion') return 'Contrato de Inversionista';
  return cat ?? 'Otro';
};

export default function InvestorDocumentManager({ investorId, tipoPersona, initialDocuments = [], onDocumentChange }: InvestorDocumentManagerProps) {
  const cedulaLabel = tipoPersona === 'Persona Jurídica' ? 'Cédula Jurídica' : 'Cédula / Pasaporte';
  const CATEGORIES = [
    { key: 'cedula_pasaporte', label: cedulaLabel, required: true },
    { key: 'contrato_inversion', label: 'Contrato de Inversionista', required: true },
  ];
  const [documents, setDocuments] = useState<InvestorDocument[]>(initialDocuments);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [lightbox, setLightbox] = useState<{ open: boolean; index: number }>({ open: false, index: 0 });
  const [zoom, setZoom] = useState(1);
  const { toast } = useToast();

  const viewableDocs = documents.filter(d => {
    const { isImage, isPdf } = getFileTypeInfo(d.mime_type, d.name);
    return isImage || isPdf;
  });

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>, category: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if category already has a document
    const existing = documents.find(d => d.category === category);
    if (existing) {
      toast({ title: 'Ya existe un archivo', description: `Solo se permite un archivo por categoría. Elimina el actual primero.`, variant: 'destructive' });
      e.target.value = '';
      return;
    }

    setUploading(prev => ({ ...prev, [category]: true }));
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('investor_id', String(investorId));
      formData.append('category', category);

      const res = await api.post('/api/investor-documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setDocuments(prev => [...prev, res.data.document]);
      onDocumentChange?.();
      toast({ title: 'Archivo subido correctamente' });
    } catch {
      toast({ title: 'Error al subir archivo', variant: 'destructive' });
    } finally {
      setUploading(prev => ({ ...prev, [category]: false }));
      e.target.value = '';
    }
  }, [documents, investorId, onDocumentChange, toast]);

  const handleDelete = useCallback(async (id: number) => {
    try {
      await api.delete(`/api/investor-documents/${id}`);
      setDocuments(prev => prev.filter(d => d.id !== id));
      onDocumentChange?.();
      toast({ title: 'Archivo eliminado' });
    } catch {
      toast({ title: 'Error al eliminar archivo', variant: 'destructive' });
    }
  }, [onDocumentChange, toast]);

  const openLightbox = (doc: InvestorDocument) => {
    const idx = viewableDocs.findIndex(d => d.id === doc.id);
    if (idx >= 0) { setLightbox({ open: true, index: idx }); setZoom(1); }
  };

  const handleDownload = async (doc: InvestorDocument) => {
    if (!doc.url) return;
    const a = document.createElement('a');
    a.href = doc.url;
    a.download = doc.name;
    a.target = '_blank';
    a.click();
  };

  const currentDoc = viewableDocs[lightbox.index];

  return (
    <div className="space-y-6">
      {/* Upload sections */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CATEGORIES.map(cat => {
          const existing = documents.find(d => d.category === cat.key);
          return (
            <div key={cat.key}>
              <label className="block text-sm font-medium mb-1">
                {cat.label}
                {cat.required && <span className="ml-1 text-red-500">*</span>}
                {existing && <span className="ml-2 text-xs text-green-600 font-normal">✓ Subido</span>}
              </label>
              <label
                htmlFor={`investor-doc-${cat.key}`}
                className={`flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer text-sm transition-colors ${
                  existing ? 'bg-green-50 border-green-300 text-green-700' : 'bg-background border-input hover:bg-muted'
                } ${uploading[cat.key] ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {uploading[cat.key] ? (
                  <span className="text-xs text-muted-foreground">Subiendo...</span>
                ) : existing ? (
                  <span className="text-xs truncate">{existing.name}</span>
                ) : (
                  <span className="text-xs text-muted-foreground">Seleccionar archivo</span>
                )}
              </label>
              <input
                id={`investor-doc-${cat.key}`}
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,image/*,application/pdf"
                disabled={!!existing || uploading[cat.key]}
                onChange={e => handleUpload(e, cat.key)}
              />
            </div>
          );
        })}
      </div>

      {/* Document grid */}
      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Sin documentos adjuntos</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map(doc => {
            const { icon: Icon, label, color, isImage, isPdf } = getFileTypeInfo(doc.mime_type, doc.name);
            const isViewable = isImage || isPdf;
            return (
              <div key={doc.id} className="border rounded-lg overflow-hidden bg-card">
                {/* Thumbnail */}
                <div
                  className={`h-32 bg-muted flex items-center justify-center ${isViewable ? 'cursor-pointer' : ''}`}
                  onClick={() => isViewable && openLightbox(doc)}
                >
                  {isImage && doc.url ? (
                    <img src={doc.url} alt={doc.name} className="h-full w-full object-cover" />
                  ) : isPdf ? (
                    <FileText className="h-12 w-12 text-red-400" />
                  ) : (
                    <Icon className={`h-12 w-12 ${color}`} />
                  )}
                </div>

                {/* Footer */}
                <div className="p-2 space-y-1">
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-xs font-medium truncate flex-1">{doc.name}</span>
                    <div className="flex gap-1 shrink-0">
                      {isViewable && (
                        <button onClick={() => openLightbox(doc)} className="text-blue-500 hover:text-blue-700" title="Ver">
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </button>
                      )}
                      <button onClick={() => handleDownload(doc)} className="text-blue-500 hover:text-blue-700" title="Descargar">
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDelete(doc.id)} className="text-red-500 hover:text-red-700" title="Eliminar">
                        <Trash className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    <Badge variant="outline" className={`text-[10px] px-1 py-0 ${color}`}>{label}</Badge>
                    <Badge variant="outline" className="text-[10px] px-1 py-0 text-blue-600 border-blue-200">{getCategoryLabel(doc.category, tipoPersona)}</Badge>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      <Dialog open={lightbox.open} onOpenChange={open => { if (!open) setLightbox(p => ({ ...p, open: false })); }}>
        <DialogContent className="max-w-4xl w-full p-0 bg-black/95 border-0" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Vista previa</DialogTitle>
          <div className="relative flex flex-col h-[80vh]">
            <div className="flex items-center justify-between px-4 py-2 bg-black/80">
              <span className="text-white text-sm truncate max-w-xs">{currentDoc?.name}</span>
              <div className="flex gap-2 items-center">
                {getFileTypeInfo(currentDoc?.mime_type, currentDoc?.name).isImage && (
                  <>
                    <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="text-white hover:text-gray-300"><ZoomOut className="h-4 w-4" /></button>
                    <span className="text-white text-xs">{Math.round(zoom * 100)}%</span>
                    <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="text-white hover:text-gray-300"><ZoomIn className="h-4 w-4" /></button>
                  </>
                )}
                <button onClick={() => currentDoc && handleDownload(currentDoc)} className="text-white hover:text-gray-300"><Download className="h-4 w-4" /></button>
                <button onClick={() => setLightbox(p => ({ ...p, open: false }))} className="text-white hover:text-gray-300"><X className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center">
              {currentDoc && getFileTypeInfo(currentDoc.mime_type, currentDoc.name).isImage && currentDoc.url ? (
                <img src={currentDoc.url} alt={currentDoc.name} style={{ transform: `scale(${zoom})`, transformOrigin: 'center', transition: 'transform 0.2s' }} className="max-h-full max-w-full object-contain" />
              ) : currentDoc && getFileTypeInfo(currentDoc.mime_type, currentDoc.name).isPdf && currentDoc.url ? (
                <iframe src={currentDoc.url} className="w-full h-full border-0" title={currentDoc.name} />
              ) : null}
            </div>
            {viewableDocs.length > 1 && (
              <>
                <button onClick={() => { setLightbox(p => ({ ...p, index: (p.index - 1 + viewableDocs.length) % viewableDocs.length })); setZoom(1); }} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1 hover:bg-black/80"><ChevronLeft className="h-5 w-5" /></button>
                <button onClick={() => { setLightbox(p => ({ ...p, index: (p.index + 1) % viewableDocs.length })); setZoom(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1 hover:bg-black/80"><ChevronRight className="h-5 w-5" /></button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
