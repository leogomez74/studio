'use client';

import React, { useState, useEffect } from 'react';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Pencil, Trash } from 'lucide-react';
import api from '@/lib/axios';

interface Tasa {
  id: number;
  nombre: string;
  tasa: number;
  tasa_maxima: number | null;
  inicio: string;
  fin: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

const TasasCRUD: React.FC = () => {
  const { toast } = useToast();
  const [tasas, setTasas] = useState<Tasa[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTasa, setEditingTasa] = useState<Tasa | null>(null);
  const [formData, setFormData] = useState({
    nombre: '', tasa: '', tasa_maxima: '',
    inicio: new Date().toISOString().split('T')[0], fin: '', activo: true,
  });

  const fetchTasas = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/tasas');
      setTasas(response.data);
    } catch (error) {
      console.error('Error fetching tasas:', error);
      toast({ title: 'Error', description: 'No se pudieron cargar las tasas', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTasas(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const tasa = parseFloat(formData.tasa);
    const tasaMaxima = formData.tasa_maxima ? parseFloat(formData.tasa_maxima) : null;

    if (isNaN(tasa) || tasa <= 0) {
      toast({ title: 'Tasa inválida', description: 'La tasa debe ser un número mayor a cero.', variant: 'destructive' });
      return;
    }
    if (tasa > 100) {
      toast({ title: 'Tasa inválida', description: 'La tasa no puede ser mayor a 100%.', variant: 'destructive' });
      return;
    }
    if (tasaMaxima !== null) {
      if (isNaN(tasaMaxima) || tasaMaxima <= 0) {
        toast({ title: 'Tasa máxima inválida', description: 'La tasa máxima debe ser un número mayor a cero.', variant: 'destructive' });
        return;
      }
      if (tasaMaxima > 100) {
        toast({ title: 'Tasa máxima inválida', description: 'La tasa máxima no puede ser mayor a 100%.', variant: 'destructive' });
        return;
      }
      if (tasa > tasaMaxima) {
        toast({ title: 'Rangos inválidos', description: 'La tasa no puede ser mayor a la tasa máxima.', variant: 'destructive' });
        return;
      }
    }

    if (!editingTasa) {
      const inicioDate = new Date(formData.inicio);
      const finDate = formData.fin ? new Date(formData.fin) : null;
      if (finDate && inicioDate >= finDate) {
        toast({ title: 'Fechas inválidas', description: 'La fecha de inicio debe ser anterior a la fecha de fin.', variant: 'destructive' });
        return;
      }
    }

    try {
      if (editingTasa) {
        await api.put(`/api/tasas/${editingTasa.id}`, { nombre: formData.nombre, tasa, tasa_maxima: tasaMaxima });
        toast({ title: 'Éxito', description: 'Tasa actualizada correctamente' });
      } else {
        await api.post('/api/tasas', { nombre: formData.nombre, tasa, tasa_maxima: tasaMaxima, inicio: formData.inicio, fin: formData.fin || null, activo: formData.activo });
        toast({ title: 'Éxito', description: 'Tasa creada correctamente' });
      }

      setIsDialogOpen(false);
      setEditingTasa(null);
      setFormData({ nombre: '', tasa: '', tasa_maxima: '', inicio: new Date().toISOString().split('T')[0], fin: '', activo: true });
      fetchTasas();
    } catch (error: any) {
      console.error('Error saving tasa:', error);
      toast({ title: 'Error', description: error?.response?.data?.message || 'No se pudo guardar la tasa', variant: 'destructive' });
    }
  };

  const handleEdit = (tasa: Tasa) => {
    setEditingTasa(tasa);
    setFormData({
      nombre: tasa.nombre,
      tasa: tasa.tasa.toString(),
      tasa_maxima: tasa.tasa_maxima?.toString() || '',
      inicio: tasa.inicio.split('T')[0],
      fin: tasa.fin ? tasa.fin.split('T')[0] : '',
      activo: tasa.activo,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Está seguro de eliminar esta tasa?')) return;
    try {
      await api.delete(`/api/tasas/${id}`);
      toast({ title: 'Éxito', description: 'Tasa eliminada correctamente' });
      fetchTasas();
    } catch (error: any) {
      console.error('Error deleting tasa:', error);
      toast({ title: 'Error', description: error?.response?.data?.message || 'No se pudo eliminar la tasa', variant: 'destructive' });
    }
  };

  const handleToggleActivo = async (tasa: Tasa) => {
    const nuevoEstado = !tasa.activo;
    setTasas(prev => prev.map(t => t.id === tasa.id ? { ...t, activo: nuevoEstado, fin: nuevoEstado ? null : new Date().toISOString().split('T')[0] } : t));

    try {
      const response = await api.patch(`/api/tasas/${tasa.id}/toggle-activo`);
      const tasaActualizada = response.data.tasa;
      setTasas(prev => prev.map(t => t.id === tasa.id ? tasaActualizada : t));
      toast({ title: 'Éxito', description: `Tasa ${tasaActualizada.activo ? 'activada' : 'desactivada'} correctamente` });
    } catch (error) {
      console.error('Error toggling tasa:', error);
      setTasas(prev => prev.map(t => t.id === tasa.id ? tasa : t));
      toast({ title: 'Error', description: 'No se pudo cambiar el estado de la tasa', variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestión de Tasas</CardTitle>
        <CardDescription>Configure las tasas de interés y mora para los créditos</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-end mb-4">
          <Button onClick={() => { setEditingTasa(null); setFormData({ nombre: '', tasa: '', tasa_maxima: '', inicio: new Date().toISOString().split('T')[0], fin: '', activo: true }); setIsDialogOpen(true); }}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Nueva Tasa
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-8">Cargando...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tasa (%)</TableHead>
                <TableHead>Tasa Máxima (%)</TableHead>
                <TableHead>Inicio Vigencia</TableHead>
                <TableHead>Fin Vigencia</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasas.map((tasa) => (
                <TableRow key={tasa.id}>
                  <TableCell className="font-medium">{tasa.nombre}</TableCell>
                  <TableCell>{tasa.tasa}%</TableCell>
                  <TableCell>{tasa.tasa_maxima ? `${tasa.tasa_maxima}%` : 'No definida'}</TableCell>
                  <TableCell>{new Date(tasa.inicio).toLocaleDateString()}</TableCell>
                  <TableCell>{tasa.fin ? new Date(tasa.fin).toLocaleDateString() : 'Indefinido'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch checked={tasa.activo} onCheckedChange={() => handleToggleActivo(tasa)} />
                      <span className="text-sm text-muted-foreground">{tasa.activo ? 'Activa' : 'Inactiva'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(tasa)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(tasa.id)}><Trash className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTasa ? 'Editar Tasa' : 'Nueva Tasa'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="nombre">Nombre de la Tasa</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => {
                    const nombre = e.target.value;
                    let tasaMaxima = formData.tasa_maxima;
                    if (!editingTasa && !formData.tasa_maxima) {
                      if (nombre.toLowerCase().includes('micro')) tasaMaxima = '51.21';
                      else if (nombre.toLowerCase().includes('regular') || nombre.toLowerCase().includes('crédito')) tasaMaxima = '36.27';
                    }
                    setFormData({ ...formData, nombre, tasa_maxima: tasaMaxima });
                  }}
                  placeholder="Ej: Tasa Regular, Tasa Mora"
                  required
                  disabled={!!editingTasa}
                />
                {editingTasa && <p className="text-xs text-muted-foreground mt-1">El nombre no se puede modificar después de crear la tasa</p>}
              </div>
              <div>
                <Label htmlFor="tasa">Tasa (%)</Label>
                <Input id="tasa" type="number" step="0.01" min="0" max="100" value={formData.tasa} onChange={(e) => setFormData({ ...formData, tasa: e.target.value })} placeholder="33.50" required />
              </div>
              <div>
                <Label htmlFor="tasa_maxima">Tasa Máxima (%) - Opcional</Label>
                <Input id="tasa_maxima" type="number" step="0.01" min="0" max="100" value={formData.tasa_maxima} onChange={(e) => setFormData({ ...formData, tasa_maxima: e.target.value })} placeholder="51.21" />
                <p className="text-xs text-muted-foreground mt-1">Tasa máxima permitida para este tipo de crédito</p>
              </div>
              {!editingTasa && (
                <>
                  <div>
                    <Label htmlFor="inicio">Inicio de Vigencia</Label>
                    <Input id="inicio" type="date" value={formData.inicio} onChange={(e) => setFormData({ ...formData, inicio: e.target.value })} required />
                  </div>
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" id="activo" checked={formData.activo} onChange={(e) => setFormData({ ...formData, activo: e.target.checked })} className="h-4 w-4" />
                    <Label htmlFor="activo">Activa desde el inicio</Label>
                  </div>
                </>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button type="submit">{editingTasa ? 'Actualizar' : 'Crear'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default TasasCRUD;
