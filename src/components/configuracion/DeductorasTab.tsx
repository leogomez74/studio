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
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/components/auth-guard';
import api from '@/lib/axios';

interface Deductora {
  id: number;
  nombre: string;
  fecha_reporte_pago: string | null;
  comision: number | null;
  erp_account_key?: string | null;
}

const DeductorasTab: React.FC = () => {
  const { toast } = useToast();
  const { token } = useAuth();
  const [deductorasList, setDeductorasList] = useState<Deductora[]>([]);
  const [loadingDeductoras, setLoadingDeductoras] = useState(false);
  const [isDeductoraDialogOpen, setIsDeductoraDialogOpen] = useState(false);
  const [editingDeductora, setEditingDeductora] = useState<Deductora | null>(null);
  const [savingDeductora, setSavingDeductora] = useState(false);
  const [deductoraForm, setDeductoraForm] = useState({ nombre: '', fecha_reporte_pago: '', comision: 0 });

  const fetchDeductoras = async () => {
    setLoadingDeductoras(true);
    try {
      const response = await api.get('/api/deductoras');
      setDeductorasList(response.data);
    } catch (error) {
      console.error('Error fetching deductoras from API:', error);
      toast({ title: 'Error', description: 'No se pudo cargar las deductoras.', variant: 'destructive' });
    } finally { setLoadingDeductoras(false); }
  };

  useEffect(() => { if (token) fetchDeductoras(); }, [token]);

  const handleDeductoraInputChange = (field: keyof typeof deductoraForm, value: any) => {
    setDeductoraForm(prev => ({ ...prev, [field]: value }));
  };

  const closeDeductoraDialog = () => {
    setIsDeductoraDialogOpen(false);
    setEditingDeductora(null);
    setDeductoraForm({ nombre: '', fecha_reporte_pago: '', comision: 0 });
  };

  const handleDeductoraSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deductoraForm.nombre?.trim()) {
      toast({ title: 'Error', description: 'El nombre es obligatorio.', variant: 'destructive' });
      return;
    }

    try {
      setSavingDeductora(true);
      const payload = { nombre: deductoraForm.nombre.trim(), fecha_reporte_pago: deductoraForm.fecha_reporte_pago || null, comision: deductoraForm.comision || null };

      if (editingDeductora) {
        await api.put(`/api/deductoras/${editingDeductora.id}`, payload);
        toast({ title: 'Actualizado', description: 'Deductora actualizada correctamente.' });
      } else {
        await api.post('/api/deductoras', payload);
        toast({ title: 'Creado', description: 'Deductora creada correctamente.' });
      }

      closeDeductoraDialog();
      fetchDeductoras();
    } catch (error: any) {
      console.error('Error saving deductora:', error);
      toast({ title: 'Error', description: 'No se pudo guardar la deductora.', variant: 'destructive' });
    } finally { setSavingDeductora(false); }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Entidades Deductoras</CardTitle>
              <CardDescription>Gestiona las cooperativas y entidades que procesan las deducciones.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingDeductoras ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre de la Deductora</TableHead>
                  <TableHead>Fecha de Cobro</TableHead>
                  <TableHead className="text-right">Comisión (%)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deductorasList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">No hay deductoras registradas.</TableCell>
                  </TableRow>
                ) : (
                  deductorasList.map((deductora) => (
                    <TableRow key={deductora.id}>
                      <TableCell className="font-medium">{deductora.nombre}</TableCell>
                      <TableCell>{deductora.fecha_reporte_pago ? new Date(deductora.fecha_reporte_pago).toLocaleDateString('es-CR') : '-'}</TableCell>
                      <TableCell className="text-right font-mono">{(parseFloat(deductora.comision?.toString() || '0')).toFixed(2)}%</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDeductoraDialogOpen} onOpenChange={setIsDeductoraDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDeductora ? 'Editar Deductora' : 'Crear Deductora'}</DialogTitle>
            <DialogDescription>{editingDeductora ? 'Modifica los datos de la deductora.' : 'Ingresa los datos de la nueva deductora.'}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDeductoraSubmit}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="deductora-nombre">Nombre</Label>
                <Input id="deductora-nombre" value={deductoraForm.nombre} onChange={(e) => handleDeductoraInputChange('nombre', e.target.value)} required disabled={savingDeductora} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deductora-fecha">Fecha Reporte Pago</Label>
                <Input id="deductora-fecha" type="date" value={deductoraForm.fecha_reporte_pago} onChange={(e) => handleDeductoraInputChange('fecha_reporte_pago', e.target.value)} disabled={savingDeductora} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deductora-comision">Comisión (%)</Label>
                <Input id="deductora-comision" type="number" step="0.01" value={deductoraForm.comision} onChange={(e) => handleDeductoraInputChange('comision', parseFloat(e.target.value) || 0)} disabled={savingDeductora} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDeductoraDialog} disabled={savingDeductora}>Cancelar</Button>
              <Button type="submit" disabled={savingDeductora}>
                {savingDeductora && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingDeductora ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DeductorasTab;
