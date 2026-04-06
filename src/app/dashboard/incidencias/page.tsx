'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  Bug, Plus, Search, Loader2, GripVertical, User, Clock,
  AlertTriangle, Trash2, X, ImagePlus, ChevronRight, Filter
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/axios';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BugImage {
  id: number;
  path: string;
  original_name: string;
  size: number;
}

interface BugItem {
  id: number;
  reference: string;
  title: string;
  description: string | null;
  status: 'abierto' | 'en_progreso' | 'en_revision' | 'cerrado';
  priority: 'baja' | 'media' | 'alta' | 'critica';
  assigned_to: number | null;
  created_by: number;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  assignee: { id: number; name: string } | null;
  creator: { id: number; name: string } | null;
  images: BugImage[];
}

interface UserOption {
  id: number;
  name: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLUMNS: { key: BugItem['status']; label: string; color: string; bgColor: string; borderColor: string }[] = [
  { key: 'abierto',     label: 'Abierto',      color: 'text-blue-700',   bgColor: 'bg-blue-50',   borderColor: 'border-blue-200' },
  { key: 'en_progreso', label: 'En Progreso',   color: 'text-amber-700',  bgColor: 'bg-amber-50',  borderColor: 'border-amber-200' },
  { key: 'en_revision', label: 'En Revisión',   color: 'text-purple-700', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' },
  { key: 'cerrado',     label: 'Cerrado',       color: 'text-green-700',  bgColor: 'bg-green-50',  borderColor: 'border-green-200' },
];

const PRIORITY_CONFIG: Record<string, { label: string; color: string; badgeCls: string }> = {
  critica: { label: 'Crítica',  color: 'text-red-700',    badgeCls: 'bg-red-100 text-red-800 border-red-300' },
  alta:    { label: 'Alta',     color: 'text-orange-700', badgeCls: 'bg-orange-100 text-orange-800 border-orange-300' },
  media:   { label: 'Media',    color: 'text-yellow-700', badgeCls: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  baja:    { label: 'Baja',     color: 'text-green-700',  badgeCls: 'bg-green-100 text-green-800 border-green-300' },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IncidenciasPage() {
  const { toast } = useToast();
  const [bugs, setBugs] = useState<BugItem[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterUser, setFilterUser] = useState<string>('all');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedBug, setSelectedBug] = useState<BugItem | null>(null);

  // Create form
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPriority, setFormPriority] = useState<string>('media');
  const [formAssignee, setFormAssignee] = useState<string>('');
  const [formImages, setFormImages] = useState<File[]>([]);
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreviews, setImagePreviews] = useState<{ file: File; url: string }[]>([]);

  // Drag & drop
  const [draggedBug, setDraggedBug] = useState<BugItem | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // ── Clipboard paste handler ──────────────────────────────────────────────────
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length === 0) return;
      e.preventDefault();

      if (showCreateModal) {
        setFormImages(prev => [...prev, ...imageFiles]);
        // Update previews
        const newPreviews = imageFiles.map(f => ({ file: f, url: URL.createObjectURL(f) }));
        setImagePreviews(prev => [...prev, ...newPreviews]);
        toast({ title: `${imageFiles.length} imagen(es) pegada(s)`, description: 'Se adjuntaron desde el portapapeles' });
      } else if (showDetailModal && selectedBug) {
        // Upload directly
        const fd = new FormData();
        imageFiles.forEach(f => fd.append('images[]', f));
        api.post(`/api/bugs/${selectedBug.id}/images`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        }).then(res => {
          setBugs(prev => prev.map(b => b.id === selectedBug.id ? { ...b, images: [...b.images, ...res.data] } : b));
          setSelectedBug(prev => prev ? { ...prev, images: [...prev.images, ...res.data] } : prev);
          toast({ title: `${imageFiles.length} imagen(es) pegada(s)` });
        }).catch(() => {
          toast({ title: 'Error', description: 'No se pudieron subir las imágenes pegadas', variant: 'destructive' });
        });
      }
    };

    if (showCreateModal || showDetailModal) {
      document.addEventListener('paste', handlePaste);
      return () => document.removeEventListener('paste', handlePaste);
    }
  }, [showCreateModal, showDetailModal, selectedBug]);

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchBugs = useCallback(async () => {
    try {
      const res = await api.get('/api/bugs');
      setBugs(res.data);
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar las incidencias', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.all([
      api.get('/api/bugs'),
      api.get('/api/agents'),
    ]).then(([bugsRes, usersRes]) => {
      setBugs(bugsRes.data);
      setUsers(usersRes.data);
    }).catch(() => {
      toast({ title: 'Error', description: 'Error al cargar datos', variant: 'destructive' });
    }).finally(() => setLoading(false));
  }, []);

  // ── Filtrado ──────────────────────────────────────────────────────────────────
  const filteredBugs = bugs.filter(b => {
    if (search && !b.title.toLowerCase().includes(search.toLowerCase()) && !b.reference.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterPriority !== 'all' && b.priority !== filterPriority) return false;
    if (filterUser !== 'all' && String(b.assigned_to) !== filterUser) return false;
    return true;
  });

  const columnBugs = (status: BugItem['status']) =>
    filteredBugs.filter(b => b.status === status);

  // ── Crear bug ─────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!formTitle.trim()) return;
    setCreating(true);
    try {
      const res = await api.post('/api/bugs', {
        title: formTitle.trim(),
        description: formDesc.trim() || null,
        priority: formPriority,
        assigned_to: formAssignee || null,
      });
      const newBug = res.data;

      // Subir imágenes si hay
      if (formImages.length > 0) {
        const fd = new FormData();
        formImages.forEach(f => fd.append('images[]', f));
        const imgRes = await api.post(`/api/bugs/${newBug.id}/images`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        newBug.images = imgRes.data;
      }

      setBugs(prev => [newBug, ...prev]);
      setShowCreateModal(false);
      resetForm();
      toast({ title: 'Creada', description: `Incidencia ${newBug.reference} creada exitosamente` });
    } catch {
      toast({ title: 'Error', description: 'No se pudo crear la incidencia', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    // Liberar URLs de previews
    imagePreviews.forEach(p => URL.revokeObjectURL(p.url));
    setFormTitle('');
    setFormDesc('');
    setFormPriority('media');
    setFormAssignee('');
    setFormImages([]);
    setImagePreviews([]);
  };

  // Mantener imagePreviews sincronizado con formImages
  const addFilesToForm = (files: File[]) => {
    setFormImages(prev => [...prev, ...files]);
    const newPreviews = files.map(f => ({ file: f, url: URL.createObjectURL(f) }));
    setImagePreviews(prev => [...prev, ...newPreviews]);
  };

  const removeFileFromForm = (idx: number) => {
    URL.revokeObjectURL(imagePreviews[idx]?.url);
    setFormImages(prev => prev.filter((_, i) => i !== idx));
    setImagePreviews(prev => prev.filter((_, i) => i !== idx));
  };

  // ── Drag & Drop ───────────────────────────────────────────────────────────────
  const handleDragStart = (bug: BugItem) => {
    setDraggedBug(bug);
  };

  const handleDragOver = (e: React.DragEvent, columnKey: string) => {
    e.preventDefault();
    setDragOverColumn(columnKey);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: BugItem['status']) => {
    e.preventDefault();
    setDragOverColumn(null);
    if (!draggedBug || draggedBug.status === newStatus) {
      setDraggedBug(null);
      return;
    }

    // Optimistic update
    const oldStatus = draggedBug.status;
    setBugs(prev => prev.map(b => b.id === draggedBug.id ? { ...b, status: newStatus } : b));

    try {
      await api.patch(`/api/bugs/${draggedBug.id}/status`, { status: newStatus });
    } catch {
      setBugs(prev => prev.map(b => b.id === draggedBug.id ? { ...b, status: oldStatus } : b));
      toast({ title: 'Error', description: 'No se pudo actualizar el estado', variant: 'destructive' });
    }
    setDraggedBug(null);
  };

  // ── Eliminar bug ──────────────────────────────────────────────────────────────
  const handleDelete = async (bugId: number) => {
    if (!confirm('¿Eliminar esta incidencia?')) return;
    try {
      await api.delete(`/api/bugs/${bugId}`);
      setBugs(prev => prev.filter(b => b.id !== bugId));
      setShowDetailModal(false);
      setSelectedBug(null);
      toast({ title: 'Eliminada', description: 'Incidencia eliminada' });
    } catch {
      toast({ title: 'Error', description: 'No se pudo eliminar', variant: 'destructive' });
    }
  };

  // ── Upload imagen en detalle ──────────────────────────────────────────────────
  const handleUploadImagesDetail = async (bugId: number, files: FileList) => {
    const fd = new FormData();
    Array.from(files).forEach(f => fd.append('images[]', f));
    try {
      const res = await api.post(`/api/bugs/${bugId}/images`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setBugs(prev => prev.map(b => b.id === bugId ? { ...b, images: [...b.images, ...res.data] } : b));
      setSelectedBug(prev => prev ? { ...prev, images: [...prev.images, ...res.data] } : prev);
      toast({ title: 'Imágenes subidas' });
    } catch {
      toast({ title: 'Error', description: 'No se pudieron subir las imágenes', variant: 'destructive' });
    }
  };

  // ── Delete imagen ─────────────────────────────────────────────────────────────
  const handleDeleteImage = async (bugId: number, imageId: number) => {
    try {
      await api.delete(`/api/bugs/${bugId}/images/${imageId}`);
      setBugs(prev => prev.map(b => b.id === bugId ? { ...b, images: b.images.filter(i => i.id !== imageId) } : b));
      setSelectedBug(prev => prev ? { ...prev, images: prev.images.filter(i => i.id !== imageId) } : prev);
    } catch {
      toast({ title: 'Error', description: 'No se pudo eliminar la imagen', variant: 'destructive' });
    }
  };

  // ── Editar bug inline ─────────────────────────────────────────────────────────
  const handleUpdateBug = async (bugId: number, data: Partial<BugItem>) => {
    try {
      const res = await api.put(`/api/bugs/${bugId}`, data);
      setBugs(prev => prev.map(b => b.id === bugId ? res.data : b));
      setSelectedBug(res.data);
    } catch {
      toast({ title: 'Error', description: 'No se pudo actualizar', variant: 'destructive' });
    }
  };

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-100 text-red-700 flex items-center justify-center">
            <Bug className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Incidencias</h1>
            <p className="text-xs text-muted-foreground">{bugs.length} total · {bugs.filter(b => b.status !== 'cerrado').length} abiertas</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 w-48 pl-8 text-xs"
            />
          </div>
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Prioridad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="critica">Crítica</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Media</SelectItem>
              <SelectItem value="baja">Baja</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterUser} onValueChange={setFilterUser}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <User className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Asignado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {users.map(u => (
                <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setShowCreateModal(true)} size="sm" className="h-8 gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs">
            <Plus className="h-3.5 w-3.5" />
            Nueva Incidencia
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-4 gap-3 flex-1 min-h-0 overflow-x-auto">
        {COLUMNS.map(col => {
          const items = columnBugs(col.key);
          const isDragOver = dragOverColumn === col.key;
          return (
            <div
              key={col.key}
              className={`flex flex-col rounded-xl border-2 transition-all duration-200 ${isDragOver ? `${col.borderColor} ${col.bgColor} ring-2 ring-offset-1 ring-blue-300` : 'border-slate-200 bg-slate-50/50'}`}
              onDragOver={e => handleDragOver(e, col.key)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, col.key)}
            >
              {/* Column Header */}
              <div className={`flex items-center justify-between px-3 py-2.5 border-b ${col.borderColor} ${col.bgColor} rounded-t-xl`}>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold uppercase tracking-wide ${col.color}`}>{col.label}</span>
                  <span className={`text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center ${col.bgColor} ${col.color} border ${col.borderColor}`}>
                    {items.length}
                  </span>
                </div>
              </div>

              {/* Column Body */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[200px]">
                {items.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50">
                    <Bug className="h-6 w-6 mb-1" />
                    <span className="text-[10px]">Sin incidencias</span>
                  </div>
                )}

                {items.map(bug => {
                  const prio = PRIORITY_CONFIG[bug.priority];
                  return (
                    <div
                      key={bug.id}
                      draggable
                      onDragStart={() => handleDragStart(bug)}
                      onClick={() => { setSelectedBug(bug); setShowDetailModal(true); }}
                      className={`group bg-white rounded-lg border border-slate-200 p-2.5 cursor-pointer
                        hover:border-slate-300 hover:shadow-md transition-all duration-150
                        ${draggedBug?.id === bug.id ? 'opacity-40 scale-95' : ''}`}
                    >
                      {/* Top: ref + priority */}
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-mono text-muted-foreground">{bug.reference}</span>
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${prio.badgeCls}`}>
                          {prio.label}
                        </Badge>
                      </div>

                      {/* Title */}
                      <p className="text-xs font-medium text-slate-800 line-clamp-2 mb-1.5">{bug.title}</p>

                      {/* Description preview */}
                      {bug.description && (
                        <p className="text-[10px] text-muted-foreground line-clamp-2 mb-2">{bug.description}</p>
                      )}

                      {/* Images preview */}
                      {bug.images.length > 0 && (
                        <div className="flex gap-1 mb-2">
                          {bug.images.slice(0, 3).map(img => (
                            <div key={img.id} className="w-10 h-10 rounded border bg-slate-100 overflow-hidden">
                              <img src={`${backendUrl}/storage/${img.path}`} alt="" className="w-full h-full object-cover" />
                            </div>
                          ))}
                          {bug.images.length > 3 && (
                            <div className="w-10 h-10 rounded border bg-slate-100 flex items-center justify-center text-[10px] text-muted-foreground font-medium">
                              +{bug.images.length - 3}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Footer: assignee + date */}
                      <div className="flex items-center justify-between">
                        {bug.assignee ? (
                          <div className="flex items-center gap-1">
                            <div className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[8px] font-bold">
                              {bug.assignee.name.charAt(0)}
                            </div>
                            <span className="text-[10px] text-muted-foreground">{bug.assignee.name.split(' ')[0]}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-300 italic">Sin asignar</span>
                        )}
                        <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {new Date(bug.created_at).toLocaleDateString('es-CR', { day: '2-digit', month: 'short' })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Modal: Crear Incidencia ──────────────────────────────────────────── */}
      <Dialog open={showCreateModal} onOpenChange={v => { if (!v) { setShowCreateModal(false); resetForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Bug className="h-4 w-4 text-red-600" />
              Nueva Incidencia
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-xs">Título *</Label>
              <Input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Describe brevemente el problema" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Descripción</Label>
              <Textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Detalle del bug, pasos para reproducir..." className="mt-1 min-h-[80px]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Prioridad</Label>
                <Select value={formPriority} onValueChange={setFormPriority}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baja">🟢 Baja</SelectItem>
                    <SelectItem value="media">🟡 Media</SelectItem>
                    <SelectItem value="alta">🟠 Alta</SelectItem>
                    <SelectItem value="critica">🔴 Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Asignar a</Label>
                <Select value={formAssignee} onValueChange={setFormAssignee}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                  <SelectContent>
                    {users.map(u => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Images */}
            <div>
              <Label className="text-xs">Imágenes (capturas de pantalla)</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5 mb-1.5">Puedes <strong>pegar (Ctrl+V)</strong> capturas desde el portapapeles o seleccionar archivos</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {imagePreviews.map((p, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-lg border bg-slate-50 overflow-hidden group shadow-sm">
                    <img src={p.url} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      className="absolute top-0.5 right-0.5 bg-red-500/90 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition shadow"
                      onClick={() => removeFileFromForm(idx)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5">
                      <span className="text-[8px] text-white truncate block">{formImages[idx]?.name || 'Pegado'}</span>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-1 hover:border-indigo-400 hover:bg-indigo-50 transition"
                >
                  <ImagePlus className="h-5 w-5 text-slate-400" />
                  <span className="text-[8px] text-slate-400">Agregar</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => {
                    if (e.target.files) {
                      addFilesToForm(Array.from(e.target.files));
                      e.target.value = '';
                    }
                  }}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateModal(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!formTitle.trim() || creating} className="gap-1.5 bg-red-600 hover:bg-red-700 text-white">
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Crear Incidencia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Detalle de Incidencia ────────────────────────────────────── */}
      <Dialog open={showDetailModal} onOpenChange={v => { if (!v) { setShowDetailModal(false); setSelectedBug(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedBug && (() => {
            const b = selectedBug;
            const prio = PRIORITY_CONFIG[b.priority];
            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground bg-slate-100 px-2 py-0.5 rounded">{b.reference}</span>
                    <Badge variant="outline" className={`text-[10px] ${prio.badgeCls}`}>{prio.label}</Badge>
                    <div className="ml-auto flex items-center gap-1">
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(b.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <DialogTitle className="text-base mt-1">{b.title}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Status + Asignado + Creador */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase">Estado</Label>
                      <Select value={b.status} onValueChange={val => handleUpdateBug(b.id, { status: val } as Partial<BugItem>)}>
                        <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {COLUMNS.map(c => (
                            <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase">Prioridad</Label>
                      <Select value={b.priority} onValueChange={val => handleUpdateBug(b.id, { priority: val } as Partial<BugItem>)}>
                        <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="baja">🟢 Baja</SelectItem>
                          <SelectItem value="media">🟡 Media</SelectItem>
                          <SelectItem value="alta">🟠 Alta</SelectItem>
                          <SelectItem value="critica">🔴 Crítica</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase">Asignado a</Label>
                      <Select value={b.assigned_to ? String(b.assigned_to) : 'none'} onValueChange={val => handleUpdateBug(b.id, { assigned_to: val === 'none' ? null : Number(val) } as Partial<BugItem>)}>
                        <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin asignar</SelectItem>
                          {users.map(u => (
                            <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />

                  {/* Descripción */}
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase">Descripción</Label>
                    <p className="text-sm mt-1 text-slate-700 whitespace-pre-wrap">{b.description || 'Sin descripción'}</p>
                  </div>

                  <Separator />

                  {/* Imágenes */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-[10px] text-muted-foreground uppercase">Capturas ({b.images.length})</Label>
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={e => e.target.files && handleUploadImagesDetail(b.id, e.target.files)}
                        />
                        <span className="inline-flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-800 font-medium">
                          <ImagePlus className="h-3 w-3" /> Agregar
                        </span>
                      </label>
                    </div>
                    <p className="text-[10px] text-muted-foreground mb-2">Puedes <strong>pegar (Ctrl+V)</strong> capturas desde el portapapeles</p>
                    {b.images.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Sin imágenes adjuntas</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {b.images.map(img => (
                          <div key={img.id} className="relative group rounded-lg overflow-hidden border bg-slate-50">
                            <img
                              src={`${backendUrl}/storage/${img.path}`}
                              alt={img.original_name}
                              className="w-full h-32 object-cover cursor-pointer"
                              onClick={() => window.open(`${backendUrl}/storage/${img.path}`, '_blank')}
                            />
                            <button
                              type="button"
                              className="absolute top-1 right-1 bg-red-500/80 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                              onClick={() => handleDeleteImage(b.id, img.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                            <div className="px-1.5 py-1 text-[9px] text-muted-foreground truncate">{img.original_name}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Meta */}
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Creado por <strong>{b.creator?.name || '—'}</strong></span>
                    <span>{new Date(b.created_at).toLocaleString('es-CR')}</span>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
