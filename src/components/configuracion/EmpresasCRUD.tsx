'use client';

import React, { useState, useEffect } from 'react';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PermissionButton } from '@/components/PermissionButton';
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
import { useAuth } from '@/components/auth-guard';
import api from '@/lib/axios';
import { EMPRESAS_MOCK, Empresa, Requirement } from '@/lib/empresas-mock';

const extensionOptions = [
  { label: 'PDF', value: 'pdf' },
  { label: 'Imagen (JPG/JPEG)', value: 'jpg' },
  { label: 'Imagen (PNG)', value: 'png' },
  { label: 'HTML', value: 'html' },
];

const EmpresasCRUD: React.FC = () => {
  const { toast } = useToast();
  const { token } = useAuth();
  const [empresas, setEmpresas] = useState<Empresa[]>(EMPRESAS_MOCK);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [usingMock, setUsingMock] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null);

  const [businessName, setBusinessName] = useState('');
  const [requirements, setRequirements] = useState<Requirement[]>([]);

  const fetchEmpresas = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/enterprises', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const apiData = res.data;

      if (apiData.length > EMPRESAS_MOCK.length) {
        setEmpresas(apiData);
        setUsingMock(false);
      } else {
        setEmpresas(EMPRESAS_MOCK);
        setUsingMock(true);
      }
    } catch (err) {
      console.error('Error fetching empresas, using mock data:', err);
      setEmpresas(EMPRESAS_MOCK);
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmpresas();
  }, [token]);

  const openCreateDialog = () => {
    setEditingEmpresa(null);
    setBusinessName('');
    setRequirements([{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }]);
    setIsDialogOpen(true);
  };

  const openEditDialog = (empresa: Empresa) => {
    setEditingEmpresa(empresa);
    setBusinessName(empresa.business_name);
    setRequirements(empresa.requirements.length > 0
      ? empresa.requirements.map(r => ({ ...r }))
      : [{ name: '', file_extension: 'pdf', quantity: 1 }]
    );
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingEmpresa(null);
    setBusinessName('');
    setRequirements([]);
  };

  const addRequirement = () => {
    setRequirements([...requirements, { name: '', file_extension: 'pdf', quantity: 1 }]);
  };

  const removeRequirement = (index: number) => {
    const newReqs = [...requirements];
    newReqs.splice(index, 1);
    setRequirements(newReqs);
  };

  const updateRequirement = (index: number, field: keyof Requirement, value: any) => {
    const newReqs = [...requirements];
    newReqs[index] = { ...newReqs[index], [field]: value };
    setRequirements(newReqs);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim()) {
      toast({ title: 'Error', description: 'El nombre es obligatorio.', variant: 'destructive' });
      return;
    }
    if (requirements.length === 0) {
      toast({ title: 'Error', description: 'Agrega al menos un requisito.', variant: 'destructive' });
      return;
    }

    for (const req of requirements) {
      if (!req.name.trim()) {
        toast({ title: 'Error', description: 'Todos los documentos deben tener nombre.', variant: 'destructive' });
        return;
      }
    }

    setSaving(true);

    const newRequirements = requirements.map(r => ({
      name: r.name,
      file_extension: r.file_extension,
      quantity: r.quantity || 1,
    }));

    if (usingMock) {
      if (editingEmpresa) {
        setEmpresas(prev => prev.map(emp =>
          emp.id === editingEmpresa.id
            ? { ...emp, business_name: businessName.trim(), requirements: newRequirements }
            : emp
        ));
        toast({ title: 'Actualizado', description: 'Empresa actualizada correctamente.' });
      } else {
        const newId = Math.max(...empresas.map(e => e.id), 0) + 1;
        setEmpresas(prev => [...prev, {
          id: newId,
          business_name: businessName.trim(),
          requirements: newRequirements
        }]);
        toast({ title: 'Creado', description: 'Empresa creada correctamente.' });
      }
      closeDialog();
      setSaving(false);
    } else {
      try {
        const now = new Date().toISOString();
        const requirementsPayload = requirements.map(r => ({
          name: r.name,
          file_extension: r.file_extension,
          quantity: r.quantity || 1,
          upload_date: now,
          last_updated: now,
        }));

        const payload = {
          business_name: businessName.trim(),
          requirements: requirementsPayload,
        };

        if (editingEmpresa) {
          await api.put(`/api/enterprises/${editingEmpresa.id}`, payload, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          toast({ title: 'Actualizado', description: 'Empresa actualizada correctamente.' });
        } else {
          await api.post('/api/enterprises', payload, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          toast({ title: 'Creado', description: 'Empresa creada correctamente.' });
        }

        closeDialog();
        fetchEmpresas();
      } catch (err: any) {
        console.error(err);
        const msg = err?.response?.data?.message || 'No se pudo guardar la empresa.';
        toast({ title: 'Error', description: msg, variant: 'destructive' });
      } finally {
        setSaving(false);
      }
    }
  };

  const handleDelete = async (empresa: Empresa) => {
    if (!confirm(`¿Eliminar la empresa "${empresa.business_name}"?`)) return;

    if (usingMock) {
      setEmpresas(prev => prev.filter(e => e.id !== empresa.id));
      toast({ title: 'Eliminado', description: 'Empresa eliminada correctamente.' });
    } else {
      try {
        await api.delete(`/api/enterprises/${empresa.id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        toast({ title: 'Eliminado', description: 'Empresa eliminada correctamente.' });
        fetchEmpresas();
      } catch (err) {
        console.error('Error deleting empresa:', err);
        toast({ title: 'Error', description: 'No se pudo eliminar la empresa.', variant: 'destructive' });
      }
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Empresas y Requisitos</CardTitle>
            <CardDescription>Configura los documentos necesarios por cada institución.</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <PermissionButton module="config_personas" action="create" size="sm" className="gap-1" onClick={openCreateDialog}>
                <PlusCircle className="h-4 w-4" />
                Nueva Empresa
              </PermissionButton>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingEmpresa ? 'Editar Empresa' : 'Crear Empresa'}</DialogTitle>
                <DialogDescription>
                  Define el nombre y los documentos que se deben solicitar.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="empresa-name">Nombre de la Empresa</Label>
                  <Input
                    id="empresa-name"
                    value={businessName}
                    onChange={e => setBusinessName(e.target.value)}
                    placeholder="Ej: Ministerio de Educación (MEP)"
                    required
                    disabled={saving}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Documentos Requeridos</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addRequirement} disabled={saving}>
                      <PlusCircle className="h-3 w-3 mr-1" /> Agregar
                    </Button>
                  </div>

                  {requirements.map((req, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row gap-3 items-start sm:items-end p-3 border rounded-md bg-muted/20">
                      <div className="flex-1 w-full space-y-1">
                        <Label className="text-xs">Nombre del Documento</Label>
                        <Input
                          value={req.name}
                          onChange={e => updateRequirement(idx, 'name', e.target.value)}
                          placeholder="Ej: Constancia Salarial"
                          className="h-8"
                          disabled={saving}
                        />
                      </div>
                      <div className="w-full sm:w-32 space-y-1">
                        <Label className="text-xs">Formato</Label>
                        <Select
                          value={req.file_extension}
                          onValueChange={v => updateRequirement(idx, 'file_extension', v)}
                          disabled={saving}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {extensionOptions.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-full sm:w-20 space-y-1">
                        <Label className="text-xs">Cant.</Label>
                        <Input
                          type="number"
                          min="1"
                          value={req.quantity}
                          onChange={e => updateRequirement(idx, 'quantity', parseInt(e.target.value) || 1)}
                          className="h-8"
                          disabled={saving}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive/90"
                        onClick={() => removeRequirement(idx)}
                        disabled={requirements.length === 1 || saving}
                      >
                        <MoreHorizontal className="h-4 w-4 rotate-45" />
                      </Button>
                    </div>
                  ))}
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={closeDialog} disabled={saving}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Guardar
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">ID</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Requerimientos</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {empresas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No hay empresas registradas.
                  </TableCell>
                </TableRow>
              ) : (
                empresas.map((empresa) => (
                  <TableRow key={empresa.id}>
                    <TableCell>{empresa.id}</TableCell>
                    <TableCell className="font-medium">{empresa.business_name}</TableCell>
                    <TableCell>
                      {empresa.requirements && empresa.requirements.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {empresa.requirements.map((req, idx) => (
                            <div key={idx} className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-xs text-muted-foreground shadow-sm">
                              <span className="font-medium text-foreground">{req.name}</span>
                              <span className="text-[10px] uppercase bg-secondary px-1 rounded">{req.file_extension}</span>
                              {req.quantity > 1 && (
                                <span className="font-bold text-primary">x{req.quantity}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin requerimientos</span>
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
                          <DropdownMenuItem onClick={() => openEditDialog(empresa)}>Editar</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(empresa)}>Eliminar</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default EmpresasCRUD;
