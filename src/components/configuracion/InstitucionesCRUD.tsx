'use client';

import React, { useState, useEffect } from 'react';
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, MoreHorizontal, Loader2 } from 'lucide-react';
import api from '@/lib/axios';

interface Institucion {
  id?: number;
  nombre: string;
  activa: boolean;
}

const InstitucionesCRUD: React.FC = () => {
  const { toast } = useToast();
  const [instituciones, setInstituciones] = useState<Institucion[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingInstitucion, setEditingInstitucion] = useState<Institucion | null>(null);
  const [institucionForm, setInstitucionForm] = useState<Institucion>({
    nombre: '',
    activa: true,
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [perPage, setPerPage] = useState(10);

  const fetchInstituciones = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/instituciones', {
        params: { page: currentPage, per_page: perPage },
      });

      if (res.data.data && res.data.current_page) {
        setInstituciones(res.data.data);
        setCurrentPage(res.data.current_page);
        setTotalPages(res.data.last_page);
        setTotalItems(res.data.total);
      } else {
        setInstituciones(res.data);
      }
    } catch (err) {
      console.error('Error fetching instituciones:', err);
      toast({ title: 'Error', description: 'No se pudieron cargar las instituciones.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstituciones();
  }, [currentPage, perPage]);

  const openCreateDialog = () => {
    setEditingInstitucion(null);
    setInstitucionForm({ nombre: '', activa: true });
    setIsDialogOpen(true);
  };

  const openEditDialog = (institucion: Institucion) => {
    setEditingInstitucion(institucion);
    setInstitucionForm({ ...institucion });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingInstitucion(null);
    setInstitucionForm({ nombre: '', activa: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institucionForm.nombre.trim()) {
      toast({ title: 'Error', description: 'El nombre de la institución es obligatorio.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const payload = { nombre: institucionForm.nombre.trim(), activa: institucionForm.activa };

      if (editingInstitucion) {
        await api.put(`/api/instituciones/${editingInstitucion.id}`, payload);
        toast({ title: 'Actualizado', description: 'Institución actualizada correctamente.' });
      } else {
        await api.post('/api/instituciones', payload);
        toast({ title: 'Creado', description: 'Institución creada correctamente.' });
      }

      closeDialog();
      fetchInstituciones();
    } catch (err: any) {
      console.error(err);
      const msg = err?.response?.data?.message || 'No se pudo guardar la institución.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (institucion: Institucion) => {
    if (!confirm(`¿Eliminar la institución "${institucion.nombre}"?`)) return;

    try {
      await api.delete(`/api/instituciones/${institucion.id}`);
      toast({ title: 'Eliminado', description: 'Institución eliminada correctamente.' });
      fetchInstituciones();
    } catch (err) {
      console.error('Error deleting institucion:', err);
      toast({ title: 'Error', description: 'No se pudo eliminar la institución.', variant: 'destructive' });
    }
  };

  const handleNextPage = () => { if (currentPage < totalPages) setCurrentPage(currentPage + 1); };
  const handlePreviousPage = () => { if (currentPage > 1) setCurrentPage(currentPage - 1); };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Instituciones</CardTitle>
            <CardDescription>Gestiona la lista de instituciones disponibles para oportunidades y cuestionarios.</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">Registros:</Label>
              <Select value={String(perPage)} onValueChange={(value) => { setPerPage(Number(value)); setCurrentPage(1); }}>
                <SelectTrigger className="h-8 w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="30">30</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1" onClick={openCreateDialog}>
                <PlusCircle className="h-4 w-4" />
                Nueva Institución
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingInstitucion ? 'Editar Institución' : 'Crear Institución'}</DialogTitle>
                <DialogDescription>Define el nombre de la institución.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="institucion-nombre">Nombre</Label>
                  <Input
                    id="institucion-nombre"
                    value={institucionForm.nombre}
                    onChange={(e) => setInstitucionForm({ ...institucionForm, nombre: e.target.value })}
                    placeholder="Ej: I.M.A.S"
                    required
                    disabled={saving}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="institucion-activa"
                    checked={institucionForm.activa}
                    onChange={(e) => setInstitucionForm({ ...institucionForm, activa: e.target.checked })}
                    disabled={saving}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="institucion-activa" className="text-sm font-normal">Activa</Label>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={closeDialog} disabled={saving}>Cancelar</Button>
                  <Button type="submit" disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editingInstitucion ? 'Actualizar' : 'Crear'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead className="w-[100px]">Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instituciones.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">No hay instituciones registradas.</TableCell>
                </TableRow>
              ) : (
                instituciones.map((institucion) => (
                  <TableRow key={institucion.id}>
                    <TableCell className="font-medium">{institucion.nombre}</TableCell>
                    <TableCell>
                      {institucion.activa ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">Activa</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">Inactiva</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menú</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => openEditDialog(institucion)}>Editar</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(institucion)}>Eliminar</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}

        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-2 py-4 border-t">
            <div className="text-sm text-muted-foreground">
              Mostrando {instituciones.length} de {totalItems} instituciones
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePreviousPage} disabled={currentPage === 1}>Anterior</Button>
              <div className="text-sm">Página {currentPage} de {totalPages}</div>
              <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage === totalPages}>Siguiente</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InstitucionesCRUD;
