'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, MoreHorizontal, Loader2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '@/lib/axios';
import { usePermissions } from '@/contexts/PermissionsContext';

interface Profesion {
  id?: number;
  name: string;
  slug?: string;
  is_active: boolean;
}

const PAGE_SIZE = 15;

const ProfesionesCRUD: React.FC = () => {
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('profesiones', 'create');
  const canEdit = hasPermission('profesiones', 'edit');
  const canDelete = hasPermission('profesiones', 'delete');

  const [profesiones, setProfesiones] = useState<Profesion[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Profesion | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [page, setPage] = useState(1);

  const [form, setForm] = useState<Profesion>({
    name: '',
    is_active: true,
  });

  const fetchProfesiones = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/profesiones');
      setProfesiones(res.data);
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar las profesiones.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfesiones(); }, []);

  const filteredProfesiones = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return profesiones;
    return profesiones.filter(p => p.name.toLowerCase().includes(q));
  }, [profesiones, busqueda]);

  const totalPages = Math.max(1, Math.ceil(filteredProfesiones.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageData = filteredProfesiones.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [busqueda]);

  const openCreateDialog = () => {
    setEditing(null);
    setForm({ name: '', is_active: true });
    setIsDialogOpen(true);
  };

  const openEditDialog = (p: Profesion) => {
    setEditing(p);
    setForm({ ...p });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditing(null);
    setForm({ name: '', is_active: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ title: 'Error', description: 'El nombre es obligatorio.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        is_active: form.is_active,
      };

      if (editing) {
        await api.put(`/api/profesiones/${editing.id}`, payload);
        toast({ title: 'Actualizado', description: 'Profesión actualizada.' });
      } else {
        await api.post('/api/profesiones', payload);
        toast({ title: 'Creada', description: 'Profesión creada.' });
      }

      closeDialog();
      fetchProfesiones();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'No se pudo guardar la profesión.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: Profesion) => {
    if (!confirm(`¿Eliminar la profesión "${p.name}"?`)) return;
    try {
      await api.delete(`/api/profesiones/${p.id}`);
      toast({ title: 'Eliminada', description: 'Profesión eliminada.' });
      fetchProfesiones();
    } catch {
      toast({ title: 'Error', description: 'No se pudo eliminar.', variant: 'destructive' });
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle>Profesiones</CardTitle>
            <CardDescription>Catálogo configurable usado en el campo Profesión de leads y clientes.</CardDescription>
          </div>
          {canCreate && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1" onClick={openCreateDialog}>
                  <PlusCircle className="h-4 w-4" />
                  Nueva Profesión
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editing ? 'Editar Profesión' : 'Crear Profesión'}</DialogTitle>
                  <DialogDescription>Define el nombre de la profesión.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="prof-name">Nombre</Label>
                    <Input
                      id="prof-name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Ej: Ingeniero(a) Industrial"
                      required
                      disabled={saving}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="prof-active"
                      checked={form.is_active}
                      onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                      disabled={saving}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="prof-active" className="text-sm font-normal">Activa (visible en los selectores)</Label>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={closeDialog} disabled={saving}>Cancelar</Button>
                    <Button type="submit" disabled={saving}>
                      {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Guardar
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Filtros */}
        <div className="mt-4 flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar profesión..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-8"
            />
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {filteredProfesiones.length} resultado{filteredProfesiones.length === 1 ? '' : 's'}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="w-[100px]">Activa</TableHead>
                  <TableHead className="text-right w-[100px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      {busqueda ? 'No se encontraron profesiones con ese criterio.' : 'No hay profesiones registradas.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  pageData.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>
                        {p.is_active ? (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Activa</span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">Inactiva</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {(canEdit || canDelete) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Abrir menú</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                              {canEdit && <DropdownMenuItem onClick={() => openEditDialog(p)}>Editar</DropdownMenuItem>}
                              {canDelete && <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(p)}>Eliminar</DropdownMenuItem>}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {/* Paginación */}
            {filteredProfesiones.length > PAGE_SIZE && (
              <div className="flex items-center justify-between mt-4">
                <span className="text-xs text-muted-foreground">
                  Página {currentPage} de {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ProfesionesCRUD;
