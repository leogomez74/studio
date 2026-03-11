'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PlusCircle, Loader2, XCircle, ArrowUp, AlertTriangle, Filter, Clock, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { PackageCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/axios';
import type { TareaRuta, TareaTipo, TareaPrioridad, UserOption } from './types';
import { tipoLabels, tipoIcons, prioridadColors, prioridadLabels } from './utils';

interface Props {
  users: UserOption[];
}

export default function TareasPendientesTab({ users }: Props) {
  const { toast } = useToast();
  const [tareas, setTareas] = useState<TareaRuta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingTarea, setEditingTarea] = useState<TareaRuta | null>(null);
  const [filterTipo, setFilterTipo] = useState<string>('todos');
  const [filterPrioridad, setFilterPrioridad] = useState<string>('todos');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    titulo: '', descripcion: '', tipo: 'entrega' as TareaTipo, prioridad: 'normal' as TareaPrioridad,
    empresa_destino: '', direccion_destino: '', provincia: '', canton: '',
    contacto_nombre: '', contacto_telefono: '', fecha_limite: '',
  });

  const fetchTareas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/tareas-ruta', { params: { status: 'pendiente' } });
      setTareas(res.data);
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar las tareas.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchTareas(); }, [fetchTareas]);

  const filteredTareas = tareas.filter((t) => {
    if (filterTipo !== 'todos' && t.tipo !== filterTipo) return false;
    if (filterPrioridad !== 'todos' && t.prioridad !== filterPrioridad) return false;
    return true;
  });

  const resetForm = () => {
    setForm({ titulo: '', descripcion: '', tipo: 'entrega', prioridad: 'normal', empresa_destino: '', direccion_destino: '', provincia: '', canton: '', contacto_nombre: '', contacto_telefono: '', fecha_limite: '' });
    setEditingTarea(null);
  };

  const openCreate = () => { resetForm(); setShowDialog(true); };

  const openEdit = (t: TareaRuta) => {
    setEditingTarea(t);
    setForm({
      titulo: t.titulo, descripcion: t.descripcion || '', tipo: t.tipo, prioridad: t.prioridad,
      empresa_destino: t.empresa_destino || '', direccion_destino: t.direccion_destino || '',
      provincia: t.provincia || '', canton: t.canton || '',
      contacto_nombre: t.contacto_nombre || '', contacto_telefono: t.contacto_telefono || '',
      fecha_limite: t.fecha_limite ? t.fecha_limite.slice(0, 10) : '',
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.titulo.trim()) {
      toast({ title: 'Error', description: 'El título es requerido.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, fecha_limite: form.fecha_limite || null, descripcion: form.descripcion || null };
      if (editingTarea) {
        await api.put(`/api/tareas-ruta/${editingTarea.id}`, payload);
        toast({ title: 'Tarea actualizada' });
      } else {
        await api.post('/api/tareas-ruta', payload);
        toast({ title: 'Tarea creada' });
      }
      setShowDialog(false);
      resetForm();
      fetchTareas();
    } catch {
      toast({ title: 'Error', description: 'No se pudo guardar la tarea.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/tareas-ruta/${id}`);
      toast({ title: 'Tarea eliminada' });
      fetchTareas();
    } catch {
      toast({ title: 'Error', description: 'No se pudo eliminar.', variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5" />
            Tareas Pendientes
          </CardTitle>
          <CardDescription>
            Tareas ordenadas por prioridad (FIFO). {filteredTareas.length} tarea{filteredTareas.length !== 1 ? 's' : ''}.
          </CardDescription>
        </div>
        <Button size="sm" onClick={openCreate}>
          <PlusCircle className="h-4 w-4 mr-1" />
          Nueva Tarea
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="w-[150px] h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los tipos</SelectItem>
                {Object.entries(tipoLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Select value={filterPrioridad} onValueChange={setFilterPrioridad}>
            <SelectTrigger className="w-[160px] h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Toda prioridad</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="urgente">Urgente</SelectItem>
              <SelectItem value="critica">Crítica</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : filteredTareas.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No hay tareas pendientes.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>Tarea</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Fecha Límite</TableHead>
                <TableHead>Solicitado por</TableHead>
                <TableHead className="w-[100px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTareas.map((t, i) => (
                <TableRow key={t.id}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell>
                    <div className="font-medium">{t.titulo}</div>
                    {t.descripcion && <div className="text-xs text-muted-foreground line-clamp-1">{t.descripcion}</div>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {tipoIcons[t.tipo]}
                      <span className="text-sm">{tipoLabels[t.tipo]}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={prioridadColors[t.prioridad]}>
                      {t.prioridad_override && <AlertTriangle className="h-3 w-3 mr-1" />}
                      {prioridadLabels[t.prioridad]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{t.empresa_destino || '-'}</div>
                    {t.canton && <div className="text-xs text-muted-foreground">{t.canton}, {t.provincia}</div>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {t.fecha_limite ? new Date(t.fecha_limite).toLocaleDateString('es-CR') : '-'}
                  </TableCell>
                  <TableCell className="text-sm">{t.solicitante?.name || '-'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(t.id)}>
                        <XCircle className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTarea ? 'Editar Tarea' : 'Nueva Tarea de Ruta'}</DialogTitle>
            <DialogDescription>
              {editingTarea ? 'Modifica los datos de la tarea.' : 'Crea una nueva tarea para asignar a una ruta.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Título *</Label>
              <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ej: Entregar cheque a CCSS" />
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as TareaTipo })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(tipoLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridad</Label>
                <Select value={form.prioridad} onValueChange={(v) => setForm({ ...form, prioridad: v as TareaPrioridad })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                    <SelectItem value="critica">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Empresa / Institución destino</Label>
              <Input value={form.empresa_destino} onChange={(e) => setForm({ ...form, empresa_destino: e.target.value })} placeholder="Ej: CCSS San José" />
            </div>
            <div>
              <Label>Dirección destino</Label>
              <Input value={form.direccion_destino} onChange={(e) => setForm({ ...form, direccion_destino: e.target.value })} placeholder="Ej: Av 2, Calle 5" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Provincia</Label>
                <Input value={form.provincia} onChange={(e) => setForm({ ...form, provincia: e.target.value })} />
              </div>
              <div>
                <Label>Cantón</Label>
                <Input value={form.canton} onChange={(e) => setForm({ ...form, canton: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Contacto</Label>
                <Input value={form.contacto_nombre} onChange={(e) => setForm({ ...form, contacto_nombre: e.target.value })} placeholder="Nombre" />
              </div>
              <div>
                <Label>Teléfono</Label>
                <Input value={form.contacto_telefono} onChange={(e) => setForm({ ...form, contacto_telefono: e.target.value })} placeholder="8888-8888" />
              </div>
            </div>
            <div>
              <Label>Fecha límite</Label>
              <Input type="date" value={form.fecha_limite} onChange={(e) => setForm({ ...form, fecha_limite: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editingTarea ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
