'use client';

import React, { useState } from 'react';
import { FileText, Paperclip, Trash, Upload, Loader2, File, Image as ImageIcon, FileSpreadsheet, FileCode, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/axios';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

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
}

export function DocumentManager({ personId, initialDocuments = [], readonly = false }: DocumentManagerProps) {
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('person_id', String(personId));

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

  return (
    <div className="space-y-4">
      {!readonly && (
        <div className="flex items-center gap-4">
          <div className="grid w-full max-w-sm items-center gap-1.5 transition-colors cursor-pointer">
            <Label htmlFor="document-upload">Subir Documento</Label>
            <Input className='cursor-pointer' id="document-upload" type="file" onChange={handleFileUpload} disabled={uploading} />
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
                      <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="w-full h-full">
                        <img
                          src={fullUrl}
                          alt={doc.name}
                          className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                        />
                      </a>
                    ) : isPdf && fullUrl ? (
                      <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="w-full h-full">
                        <iframe
                          src={fullUrl}
                          className="w-full h-full pointer-events-none"
                          title={doc.name}
                        />
                      </a>
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
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-[10px] h-5 px-1.5 font-normal ${color} border-current opacity-80`}>
                            {label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{formatDate(doc.created_at)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {fullUrl && (
                          <>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
                              <a href={fullUrl} target="_blank" rel="noopener noreferrer">
                                <FileIcon className={`h-4 w-4 ${color}`} />
                                <span className="sr-only">Ver</span>
                              </a>
                            </Button>
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
    </div>
  );
}
