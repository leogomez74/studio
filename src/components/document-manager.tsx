'use client';

import React, { useState } from 'react';
import { FileText, Paperclip, Trash, Upload, Loader2, File, Image as ImageIcon, FileSpreadsheet, FileCode } from 'lucide-react';
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
      setDocuments((prev) => [response.data, ...prev]);
      toast({ title: 'Éxito', description: 'Documento subido correctamente.' });
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
        return { icon: ImageIcon, label: 'Imagen', color: 'text-purple-600' };
    }
    if (type.includes('pdf') || name.endsWith('.pdf')) {
        return { icon: FileText, label: 'PDF', color: 'text-red-600' };
    }
    if (type.includes('spreadsheet') || type.includes('excel') || name.match(/\.(xls|xlsx|csv)$/)) {
        return { icon: FileSpreadsheet, label: 'Excel', color: 'text-green-600' };
    }
    if (type.includes('word') || name.match(/\.(doc|docx)$/)) {
        return { icon: FileText, label: 'Word', color: 'text-blue-600' };
    }
    
    return { icon: File, label: 'Archivo', color: 'text-slate-600' };
  };

  return (
    <div className="space-y-4">
      {!readonly && (
        <div className="flex items-center gap-4">
          <div className="grid w-full max-w-sm items-center gap-1.5 hover:bg-muted/50 transition-colors cursor-pointer">
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
          documents.map((doc) => {
            const { icon: FileIcon, label, color } = getFileTypeInfo(doc.mime_type, doc.name);
            return (
            <div
              key={doc.id}
              className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Checkbox id={`doc-${doc.id}`} />
                <div className="grid gap-1.5 leading-none">
                    <div className="flex items-center gap-2">
                        <label
                            htmlFor={`doc-${doc.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                            {doc.name}
                        </label>
                        <Badge variant="outline" className={`text-[10px] h-5 px-1.5 font-normal ${color} border-current opacity-80`}>
                            {label}
                        </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                        {formatDate(doc.created_at)}
                    </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {doc.url && (
                  <Button variant="ghost" size="sm" asChild>
                    <a href={getFullUrl(doc.url)} target="_blank" rel="noopener noreferrer">
                      <FileIcon className={`h-4 w-4 ${color}`} />
                      <span className="sr-only">Ver</span>
                    </a>
                  </Button>
                )}
                {!readonly && (
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(doc.id)}>
                    <Trash className="h-4 w-4 text-destructive" />
                    <span className="sr-only">Eliminar</span>
                  </Button>
                )}
              </div>
            </div>
          )})
        )}
      </div>
    </div>
  );
}
