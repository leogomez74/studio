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
import Swal from 'sweetalert2';

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
  jira_key: string | null;
  archived_at: string | null;
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
  assignees: { id: number; name: string }[];
  creator: { id: number; name: string } | null;
  images: BugImage[];
}

interface UserOption {
  id: number;
  name: string;
}

interface Subtask {
  key: string;
  summary: string;
  status: string;
  assignee: string | null;
  url: string;
}

interface JiraUser {
  accountId: string;
  displayName: string;
  email: string | null;
  avatar: string | null;
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
  const [jiraUsers, setJiraUsers] = useState<JiraUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterUser, setFilterUser] = useState<string>('all');
  const [jiraConnected, setJiraConnected] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedBug, setSelectedBug] = useState<BugItem | null>(null);

  // Create form
  const [formJiraAssignee, setFormJiraAssignee] = useState<string>('');
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPriority, setFormPriority] = useState<string>('media');
  const [formAssignees, setFormAssignees] = useState<number[]>([]);
  const [formImages, setFormImages] = useState<File[]>([]);
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreviews, setImagePreviews] = useState<{ file: File; url: string }[]>([]);

  // Subtareas Jira
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loadingSubtasks, setLoadingSubtasks] = useState(false);
  const [newSubtask, setNewSubtask] = useState('');
  const [newSubtaskAssignee, setNewSubtaskAssignee] = useState('');
  const [creatingSubtask, setCreatingSubtask] = useState(false);

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

  // ── Polling Jira — refresca cada 15s cuando el modal está abierto ────────────
  useEffect(() => {
    if (!showDetailModal || !selectedBug) return;
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/api/bugs/${selectedBug.id}`);
        const updated = res.data;
        // Actualizar bug en la lista y en el modal si cambió en Jira
        setBugs(prev => prev.map(b => b.id === updated.id ? updated : b));
        setSelectedBug(prev => {
          if (!prev || prev.id !== updated.id) return prev;
          // Solo actualizar si hay cambios reales
          if (prev.status !== updated.status || prev.priority !== updated.priority ||
              prev.title !== updated.title || prev.assigned_to !== updated.assigned_to) {
            return updated;
          }
          return prev;
        });
      } catch { /* silencioso */ }
    }, 15000);
    return () => clearInterval(interval);
  }, [showDetailModal, selectedBug?.id]);

  // ── Polling global — sincroniza con Jira y refresca el kanban cada 10 minutos
  useEffect(() => {
    const interval = setInterval(() => {
      if (jiraConnected) api.post('/api/jira/sync').catch(() => {});
      fetchBugs();
    }, 600000);
    return () => clearInterval(interval);
  }, [fetchBugs, jiraConnected]);

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

    // Jira users, status y auto-sync al entrar
    api.get('/api/jira/users').then(res => setJiraUsers(res.data || [])).catch(() => setJiraUsers([]));
    api.get('/api/jira/status').then(res => {
      const connected = res.data?.connected ?? false;
      setJiraConnected(connected);
      if (connected) api.post('/api/jira/sync').then(() => fetchBugs()).catch(() => {});
    }).catch(() => setJiraConnected(false));
  }, []);

  // ── Filtrado ──────────────────────────────────────────────────────────────────
  const filteredBugs = bugs.filter(b => {
    if (search && !b.title.toLowerCase().includes(search.toLowerCase()) && !b.reference.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterPriority !== 'all' && b.priority !== filterPriority) return false;
    if (filterUser !== 'all') {
      if (jiraUsers.length > 0) {
        // Filtrar por nombre del assignee comparando con displayName de Jira
        const jiraUser = jiraUsers.find(u => u.accountId === filterUser);
        if (!jiraUser) return false;
        const assigneeName = b.assignee?.name?.toLowerCase() || '';
        if (!assigneeName.includes(jiraUser.displayName.split(' ')[0].toLowerCase())) return false;
      } else {
        if (String(b.assigned_to) !== filterUser) return false;
      }
    }
    return true;
  });

  const columnBugs = (status: BugItem['status']) =>
    filteredBugs.filter(b => b.status === status);

  // ── Crear bug ─────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!formTitle.trim()) return;
    setCreating(true);
    try {
      // Mapear primer asignado de Studio → cuenta Jira por nombre
      const primaryUser = formAssignees.length > 0 ? users.find(u => u.id === formAssignees[0]) : null;
      const jiraAccountId = primaryUser
        ? (jiraUsers.find(u => u.displayName.toLowerCase().includes(primaryUser.name.split(' ')[0].toLowerCase()))?.accountId ?? null)
        : null;

      const primaryId = formAssignees[0] ?? null;

      const res = await api.post('/api/bugs', {
        title: formTitle.trim(),
        description: formDesc.trim() || null,
        priority: formPriority,
        assigned_to: primaryId,
        jira_assignee_id: jiraAccountId,
      });
      const newBug = res.data;

      // Sincronizar todos los asignados
      if (formAssignees.length > 0) {
        const assignRes = await api.patch(`/api/bugs/${newBug.id}/assignees`, { user_ids: formAssignees });
        newBug.assignees = assignRes.data.assignees;
      }

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
    setFormAssignees([]);
    setFormJiraAssignee('');
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
  const handleArchive = async (bugId: number) => {
    const result = await Swal.fire({
      title: '¿Archivar incidencia?',
      text: 'Se ocultará del kanban y se cerrará en Jira.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, archivar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#6b7280',
      cancelButtonColor: '#3b82f6',
      customClass: { container: 'swal-over-modal' },
      didOpen: () => { document.body.style.pointerEvents = 'auto'; },
    });
    if (!result.isConfirmed) return;
    try {
      await api.patch(`/api/bugs/${bugId}/archive`);
      setBugs(prev => prev.filter(b => b.id !== bugId));
      setShowDetailModal(false);
      setSelectedBug(null);
      toast({ title: 'Archivada', description: 'Incidencia archivada y cerrada en Jira' });
    } catch {
      toast({ title: 'Error', description: 'No se pudo archivar', variant: 'destructive' });
    }
  };

  const handleSyncJira = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/api/jira/sync');
      await fetchBugs();
      toast({ title: 'Sincronización completa', description: `${res.data.created} creadas, ${res.data.updated} actualizadas de ${res.data.total} tareas en Jira` });
    } catch {
      toast({ title: 'Error', description: 'No se pudo sincronizar con Jira', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async (bugId: number) => {
    const result = await Swal.fire({
      title: '¿Eliminar incidencia?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      customClass: { container: 'swal-over-modal' },
      didOpen: () => { document.body.style.pointerEvents = 'auto'; },
    });
    if (!result.isConfirmed) return;
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
  const handleCreateSubtask = async () => {
    if (!newSubtask.trim() || !selectedBug) return;
    setCreatingSubtask(true);
    try {
      const res = await api.post(`/api/bugs/${selectedBug.id}/subtasks`, {
        title: newSubtask.trim(),
        assignee_id: newSubtaskAssignee && newSubtaskAssignee !== 'none' ? newSubtaskAssignee : null,
      });
      setSubtasks(prev => [...prev, { key: res.data.key, summary: newSubtask.trim(), status: 'Tareas por hacer', assignee: null, url: `https://ssccr.atlassian.net/browse/${res.data.key}` }]);
      setNewSubtask('');
      setNewSubtaskAssignee('');
      toast({ title: 'Subtarea creada', description: `${res.data.key} creada en Jira` });
    } catch {
      toast({ title: 'Error', description: 'No se pudo crear la subtarea', variant: 'destructive' });
    } finally {
      setCreatingSubtask(false);
    }
  };

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

  const backendUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api').replace('/api', '');

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
              {jiraUsers.length > 0
                ? jiraUsers.map(u => (
                    <SelectItem key={u.accountId} value={u.accountId}>{u.displayName}</SelectItem>
                  ))
                : users.map(u => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                  ))
              }
            </SelectContent>
          </Select>
          {/* Indicador de conexión Jira */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-white text-xs">
            <span className={`w-2 h-2 rounded-full ${jiraConnected === null ? 'bg-gray-300 animate-pulse' : jiraConnected ? 'bg-green-500' : 'bg-red-400'}`} />
            <span className="text-muted-foreground">{jiraConnected ? 'Jira' : 'Sin Jira'}</span>
          </div>
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
              <div className="overflow-y-auto p-2 space-y-2" style={{ maxHeight: 'calc(100vh - 200px)' }}>
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
                      onClick={() => {
                        setSelectedBug(bug);
                        setShowDetailModal(true);
                        setSubtasks([]);
                        setNewSubtask('');
                        setNewSubtaskAssignee('');
                        if (bug.jira_key) {
                          setLoadingSubtasks(true);
                          api.get(`/api/bugs/${bug.id}/subtasks`)
                            .then(r => setSubtasks(r.data || []))
                            .catch(() => {})
                            .finally(() => setLoadingSubtasks(false));
                        }
                      }}
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

                      {/* Footer: assignees + date */}
                      <div className="flex items-center justify-between">
                        {(bug.assignees?.length > 0) ? (
                          <div className="flex items-center -space-x-1">
                            {bug.assignees.slice(0, 3).map(a => (
                              <div key={a.id} title={a.name} className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 border border-white flex items-center justify-center text-[8px] font-bold">
                                {a.name.charAt(0)}
                              </div>
                            ))}
                            {bug.assignees.length > 3 && (
                              <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 border border-white flex items-center justify-center text-[8px] font-bold">
                                +{bug.assignees.length - 3}
                              </div>
                            )}
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
                <div className="mt-1 border rounded-md p-1.5 bg-white min-h-[36px] flex flex-wrap gap-1 items-center">
                  {formAssignees.map(id => {
                    const u = users.find(x => x.id === id);
                    if (!u) return null;
                    return (
                      <span key={id} className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-800 text-xs px-2 py-0.5 rounded-full">
                        {u.name.split(' ')[0]}
                        <button type="button" className="hover:text-red-600 font-bold"
                          onClick={() => setFormAssignees(prev => prev.filter(x => x !== id))}>×</button>
                      </span>
                    );
                  })}
                  <Select onValueChange={val => {
                    const id = Number(val);
                    if (!formAssignees.includes(id)) setFormAssignees(prev => [...prev, id]);
                  }}>
                    <SelectTrigger className="h-7 text-xs w-auto border-dashed border-indigo-300 text-indigo-500 px-2 flex-1 min-w-[100px]">
                      <SelectValue placeholder="+ Agregar persona" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.filter(u => !formAssignees.includes(u.id)).map(u => (
                        <SelectItem key={u.id} value={String(u.id)} className="text-xs">{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-muted-foreground bg-slate-100 px-2 py-0.5 rounded">{b.reference}</span>
                    <Badge variant="outline" className={`text-[10px] ${prio.badgeCls}`}>{prio.label}</Badge>
                    {b.jira_key && (
                      <a
                        href={`https://ssccr.atlassian.net/browse/${b.jira_key}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-mono bg-blue-600 text-white px-2 py-0.5 rounded hover:bg-blue-700 transition"
                      >
                        <span className="font-bold">J</span> {b.jira_key}
                      </a>
                    )}
                    <div className="ml-auto flex items-center gap-1">
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50" onClick={() => handleArchive(b.id)}>
                        <span className="text-[10px]">Archivar</span>
                      </Button>
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
                      <Label className="text-[10px] text-muted-foreground uppercase">Asignados</Label>
                      <div className="mt-1 border rounded-md p-1.5 bg-white min-h-[32px] flex flex-wrap gap-1">
                        {(b.assignees || []).map(u => (
                          <span key={u.id} className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-800 text-[10px] px-1.5 py-0.5 rounded-full">
                            {u.name.split(' ')[0]}
                            <button type="button" className="hover:text-red-600"
                              onClick={() => {
                                const ids = (b.assignees || []).filter(a => a.id !== u.id).map(a => a.id);
                                api.patch(`/api/bugs/${b.id}/assignees`, { user_ids: ids }).then(r => {
                                  setBugs(prev => prev.map(x => x.id === b.id ? r.data : x));
                                  setSelectedBug(r.data);
                                });
                              }}>×</button>
                          </span>
                        ))}
                        <Select onValueChange={val => {
                          const current = (b.assignees || []).map(a => a.id);
                          if (current.includes(Number(val))) return;
                          api.patch(`/api/bugs/${b.id}/assignees`, { user_ids: [...current, Number(val)] }).then(r => {
                            setBugs(prev => prev.map(x => x.id === b.id ? r.data : x));
                            setSelectedBug(r.data);
                          });
                        }}>
                          <SelectTrigger className="h-6 text-[10px] w-auto border-dashed border-indigo-300 text-indigo-600 px-1.5">
                            <span>+ Agregar</span>
                          </SelectTrigger>
                          <SelectContent>
                            {users.filter(u => !(b.assignees || []).some(a => a.id === u.id)).map(u => (
                              <SelectItem key={u.id} value={String(u.id)} className="text-xs">{u.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
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

                  {/* Subtareas Jira */}
                  {b.jira_key && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                          <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-sm bg-blue-600 text-white text-[8px] font-bold">J</span>
                          Subtareas Jira
                        </Label>
                      </div>

                      {/* Lista de subtareas existentes */}
                      {loadingSubtasks ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                          <Loader2 className="h-3 w-3 animate-spin" /> Cargando...
                        </div>
                      ) : subtasks.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic mb-2">Sin subtareas</p>
                      ) : (
                        <div className="space-y-1 mb-3">
                          {subtasks.map(s => (
                            <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center justify-between p-2 rounded border border-slate-100 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 transition group">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[10px] font-mono text-blue-600 shrink-0">{s.key}</span>
                                <span className="text-xs text-slate-700 truncate">{s.summary}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                {s.assignee && <span className="text-[10px] text-muted-foreground">{s.assignee.split(' ')[0]}</span>}
                                <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">{s.status}</span>
                              </div>
                            </a>
                          ))}
                        </div>
                      )}

                      {/* Crear nueva subtarea */}
                      <div className="flex gap-2 mt-2">
                        <Input
                          value={newSubtask}
                          onChange={e => setNewSubtask(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleCreateSubtask()}
                          placeholder="Nueva subtarea..."
                          className="h-7 text-xs flex-1"
                        />
                        <Select value={newSubtaskAssignee} onValueChange={setNewSubtaskAssignee}>
                          <SelectTrigger className="h-7 text-xs w-32"><SelectValue placeholder="Asignar" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin asignar</SelectItem>
                            {jiraUsers.map(u => (
                              <SelectItem key={u.accountId} value={u.accountId}>{u.displayName.split(' ')[0]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white px-2"
                          disabled={!newSubtask.trim() || creatingSubtask}
                          onClick={handleCreateSubtask}>
                          {creatingSubtask ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                  )}

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
