'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PermissionButton } from '@/components/PermissionButton';
import { ProtectedPage } from '@/components/ProtectedPage';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, MoreHorizontal, Loader2, Pencil, Trash } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { patronos } from '@/lib/data';
import { API_BASE_URL } from '@/lib/env';
import { useAuth } from '@/components/auth-guard';
import api from '@/lib/axios';
import { EMPRESAS_MOCK, Empresa, Requirement } from '@/lib/empresas-mock';

// ----------------------------------------------------------------------
// 1. COMPONENTES Y CONSTANTES AUXILIARES (Definidos FUERA del componente principal)
// ----------------------------------------------------------------------

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
  
  // Estado del formulario
  const [businessName, setBusinessName] = useState('');
  const [requirements, setRequirements] = useState<Requirement[]>([]);

  const fetchEmpresas = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/enterprises', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const apiData = res.data;

      // Si la API tiene más datos que el mock, usar API; si no, usar mock
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
    setRequirements([{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }]); // Default
    setIsDialogOpen(true);
  };

  const openEditDialog = (empresa: Empresa) => {
    setEditingEmpresa(empresa);
    setBusinessName(empresa.business_name);
    // Cargar requisitos existentes o poner uno por defecto si no tiene
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

  // Manejo de requisitos dinámicos
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

    // Validar campos vacíos
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
      // Operación local con mock
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
      // Operación con API
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
              <PermissionButton module="configuracion" action="create" size="sm" className="gap-1" onClick={openCreateDialog}>
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
                        <MoreHorizontal className="h-4 w-4 rotate-45" /> {/* Using generic icon as X */}
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

// Productos CRUD Component
interface Product {
  id?: number;
  name: string;
  slug?: string;
  description: string | null;
  is_default: boolean;
  order_column: number;
}

// ==================================================================================
// INSTITUCIONES CRUD
// ==================================================================================

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

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [perPage, setPerPage] = useState(10);

  const fetchInstituciones = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/instituciones', {
        params: {
          page: currentPage,
          per_page: perPage,
        }
      });

      // Detectar si la respuesta está paginada
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
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las instituciones.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstituciones();
  }, [currentPage, perPage]);

  const openCreateDialog = () => {
    setEditingInstitucion(null);
    setInstitucionForm({
      nombre: '',
      activa: true,
    });
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
    setInstitucionForm({
      nombre: '',
      activa: true,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institucionForm.nombre.trim()) {
      toast({
        title: 'Error',
        description: 'El nombre de la institución es obligatorio.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nombre: institucionForm.nombre.trim(),
        activa: institucionForm.activa,
      };

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

  // Handlers de paginación
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

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
              <Select value={String(perPage)} onValueChange={(value) => {
                setPerPage(Number(value));
                setCurrentPage(1);
              }}>
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
                <DialogDescription>
                  Define el nombre de la institución.
                </DialogDescription>
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
                  <Label htmlFor="institucion-activa" className="text-sm font-normal">
                    Activa
                  </Label>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={closeDialog} disabled={saving}>
                    Cancelar
                  </Button>
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
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No hay instituciones registradas.
                  </TableCell>
                </TableRow>
              ) : (
                instituciones.map((institucion) => (
                  <TableRow key={institucion.id}>
                    <TableCell className="font-medium">{institucion.nombre}</TableCell>
                    <TableCell>
                      {institucion.activa ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                          Activa
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                          Inactiva
                        </span>
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
                          <DropdownMenuItem onClick={() => openEditDialog(institucion)}>
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(institucion)}
                          >
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}

        {/* Paginación */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-2 py-4 border-t">
            <div className="text-sm text-muted-foreground">
              Mostrando {instituciones.length} de {totalItems} instituciones
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
              >
                Anterior
              </Button>
              <div className="text-sm">
                Página {currentPage} de {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ==================================================================================
// PRODUCTOS CRUD
// ==================================================================================

const ProductosCRUD: React.FC = () => {
  const { toast } = useToast();
  const { token } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form state
  const [productForm, setProductForm] = useState<Product>({
    name: '',
    description: '',
    is_default: false,
    order_column: 0,
  });

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/products');
      setProducts(res.data);
    } catch (err) {
      console.error('Error fetching products:', err);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los créditos.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const openCreateDialog = () => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      description: '',
      is_default: false,
      order_column: products.length + 1,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setProductForm({ ...product });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingProduct(null);
    setProductForm({
      name: '',
      description: '',
      is_default: false,
      order_column: 0,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim()) {
      toast({
        title: 'Error',
        description: 'El nombre del crédito es obligatorio.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: productForm.name.trim(),
        description: productForm.description || '',
        is_default: productForm.is_default,
        order_column: productForm.order_column,
      };

      if (editingProduct) {
        await api.put(`/api/products/${editingProduct.id}`, payload);
        toast({
          title: 'Actualizado',
          description: 'Crédito actualizado correctamente.',
        });
      } else {
        await api.post('/api/products', payload);
        toast({
          title: 'Creado',
          description: 'Crédito creado correctamente.',
        });
      }

      closeDialog();
      fetchProducts();
    } catch (err: any) {
      console.error(err);
      const msg = err?.response?.data?.message || 'No se pudo guardar el crédito.';
      toast({
        title: 'Error',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`¿Eliminar el crédito "${product.name}"?`)) return;

    try {
      await api.delete(`/api/products/${product.id}`);
      toast({
        title: 'Eliminado',
        description: 'Crédito eliminado correctamente.',
      });
      fetchProducts();
    } catch (err) {
      console.error('Error deleting product:', err);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el crédito.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Tipos de Créditos</CardTitle>
            <CardDescription>
              Gestiona los tipos de créditos y servicios ofrecidos por la empresa.
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1" onClick={openCreateDialog}>
                <PlusCircle className="h-4 w-4" />
                Nuevo Crédito
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingProduct ? 'Editar Crédito' : 'Crear Crédito'}
                </DialogTitle>
                <DialogDescription>
                  Define el nombre y descripción del tipo de crédito.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="product-name">Nombre del Crédito</Label>
                  <Input
                    id="product-name"
                    value={productForm.name}
                    onChange={(e) =>
                      setProductForm({ ...productForm, name: e.target.value })
                    }
                    placeholder="Ej: Micro Crédito"
                    required
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="product-description">Descripción</Label>
                  <Input
                    id="product-description"
                    value={productForm.description || ''}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        description: e.target.value,
                      })
                    }
                    placeholder="Ej: Préstamos pequeños de rápida aprobación"
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="product-order">Orden</Label>
                  <Input
                    id="product-order"
                    type="number"
                    min="1"
                    value={productForm.order_column}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        order_column: parseInt(e.target.value) || 1,
                      })
                    }
                    disabled={saving}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="product-default"
                    checked={productForm.is_default}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        is_default: e.target.checked,
                      })
                    }
                    disabled={saving}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="product-default" className="text-sm font-normal">
                    Marcar como crédito por defecto
                  </Label>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeDialog}
                    disabled={saving}
                  >
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
                <TableHead className="w-[50px]">Orden</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="w-[100px]">Por Defecto</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No hay créditos registrados.
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-mono">{product.order_column}</TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {product.description || '-'}
                    </TableCell>
                    <TableCell>
                      {product.is_default ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                          Sí
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">No</span>
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
                          <DropdownMenuItem onClick={() => openEditDialog(product)}>
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(product)}
                          >
                            Eliminar
                          </DropdownMenuItem>
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

// ==================================================================================
// ROLES Y PERMISOS MANAGER
// ==================================================================================

interface Permission {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  archive?: boolean;
}

interface RolePermissions {
  [moduleName: string]: Permission;
}

interface Role {
  id?: number;
  name: string;
  description: string;
  full_access: boolean;
  permissions: RolePermissions;
}

interface Module {
  key: string;
  label: string;
  permissions?: ('view' | 'create' | 'edit' | 'delete' | 'archive')[];
  customPermissionLabels?: {
    view?: string;
    create?: string;
    edit?: string;
    delete?: string;
    archive?: string;
  };
}

const MODULES: Module[] = [
  { key: 'reportes', label: 'Reportes', permissions: ['view'] },
  { key: 'kpis', label: 'KPIs', permissions: ['view'] },
  { key: 'crm', label: 'CRM (Leads)', permissions: ['view', 'create', 'edit', 'delete', 'archive'] },
  { key: 'oportunidades', label: 'Oportunidades', permissions: ['view', 'create', 'edit', 'delete'] },
  {
    key: 'analizados',
    label: 'Analizados',
    permissions: ['view', 'create', 'edit', 'delete', 'archive'],
    customPermissionLabels: {
      delete: 'Estado PEP',
      archive: 'Estado Cliente'
    }
  },
  { key: 'creditos', label: 'Créditos', permissions: ['view', 'create', 'edit', 'delete'] },
  { key: 'calculos', label: 'Cálculos', permissions: ['view'] },
  {
    key: 'cobros',
    label: 'Cobros',
    permissions: ['view', 'create', 'edit', 'delete'],
    customPermissionLabels: {
      create: 'Registrar Abono',
      edit: 'Cargar Planilla',
      delete: 'Exportar'
    }
  },
  { key: 'cobro_judicial', label: 'Cobro Judicial', permissions: ['view'] },
  { key: 'ventas', label: 'Ventas', permissions: ['view'] },
  { key: 'inversiones', label: 'Inversiones', permissions: ['view', 'create', 'edit', 'delete'] },
  { key: 'rutas', label: 'Rutas', permissions: ['view', 'create', 'edit', 'delete'] },
  { key: 'proyectos', label: 'Proyectos', permissions: ['view', 'create', 'edit', 'delete'] },
  { key: 'comunicaciones', label: 'Comunicaciones', permissions: ['view', 'create'] },
  { key: 'staff', label: 'Colaboradores', permissions: ['view', 'create', 'edit', 'delete'] },
  { key: 'entrenamiento', label: 'Entrenamiento', permissions: ['view'] },
  { key: 'recompensas', label: 'Recompensas', permissions: ['view', 'create', 'edit', 'delete'] },
  { key: 'configuracion', label: 'Configuración', permissions: ['view', 'create', 'edit', 'delete'] },
];

const RolesPermisosManager: React.FC = () => {
  const { toast } = useToast();
  const { token } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleForm, setRoleForm] = useState<Role>({
    name: '',
    description: '',
    full_access: false,
    permissions: {},
  });

  // Inicializar permisos para todos los módulos
  const initializePermissions = (): RolePermissions => {
    const perms: RolePermissions = {};
    MODULES.forEach(module => {
      perms[module.key] = {
        view: false,
        create: false,
        edit: false,
        delete: false,
        archive: false,
      };
    });
    return perms;
  };

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/roles`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        setRoles(data);
      } else {
        throw new Error('Failed to fetch roles');
      }

      /* Mock data por ahora
      setRoles([
        {
          id: 1,
          name: 'Administrador',
          description: 'Acceso completo al sistema',
          full_access: true,
          permissions: initializePermissions(),
        },
        {
          id: 2,
          name: 'Colaborador',
          description: 'Acceso limitado para colaboradores de ventas',
          full_access: false,
          permissions: {
            reportes: { view: true, create: false, edit: false, delete: false },
            kpis: { view: true, create: false, edit: false, delete: false },
            crm: { view: true, create: true, edit: true, delete: false },
            oportunidades: { view: true, create: true, edit: true, delete: false },
            analizados: { view: true, create: false, edit: true, delete: false },
            creditos: { view: true, create: false, edit: false, delete: false },
            calculos: { view: true, create: false, edit: false, delete: false },
            cobros: { view: false, create: false, edit: false, delete: false },
            cobro_judicial: { view: false, create: false, edit: false, delete: false },
            ventas: { view: true, create: false, edit: false, delete: false },
            inversiones: { view: false, create: false, edit: false, delete: false },
            rutas: { view: true, create: false, edit: false, delete: false },
            proyectos: { view: false, create: false, edit: false, delete: false },
            comunicaciones: { view: false, create: false, edit: false, delete: false },
            staff: { view: false, create: false, edit: false, delete: false },
            entrenamiento: { view: true, create: false, edit: false, delete: false },
            recompensas: { view: true, create: false, edit: false, delete: false },
            configuracion: { view: false, create: false, edit: false, delete: false },
          } as RolePermissions,
        },
        {
          id: 3,
          name: 'Finanzas',
          description: 'Acceso completo a módulos financieros y de cobro',
          full_access: false,
          permissions: {
            reportes: { view: true, create: false, edit: false, delete: false },
            kpis: { view: true, create: false, edit: false, delete: false },
            crm: { view: true, create: false, edit: false, delete: false },
            oportunidades: { view: true, create: false, edit: false, delete: false },
            analizados: { view: true, create: false, edit: false, delete: false },
            creditos: { view: true, create: true, edit: true, delete: true },
            calculos: { view: true, create: false, edit: false, delete: false },
            cobros: { view: true, create: true, edit: true, delete: false },
            cobro_judicial: { view: true, create: true, edit: true, delete: true },
            ventas: { view: true, create: false, edit: false, delete: false },
            inversiones: { view: true, create: true, edit: true, delete: true },
            rutas: { view: false, create: false, edit: false, delete: false },
            proyectos: { view: false, create: false, edit: false, delete: false },
            comunicaciones: { view: true, create: true, edit: false, delete: false },
            staff: { view: false, create: false, edit: false, delete: false },
            entrenamiento: { view: false, create: false, edit: false, delete: false },
            recompensas: { view: false, create: false, edit: false, delete: false },
            configuracion: { view: false, create: false, edit: false, delete: false },
          } as RolePermissions,
        },
      ]); */
    } catch (err) {
      console.error('Error fetching roles:', err);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los roles.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const openCreateDialog = () => {
    setEditingRole(null);
    setRoleForm({
      name: '',
      description: '',
      full_access: false,
      permissions: initializePermissions(),
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (role: Role) => {
    setEditingRole(role);
    // Asegurar que todos los módulos tengan permisos definidos con merge profundo
    const basePermissions = initializePermissions();
    const completePermissions: RolePermissions = {};

    Object.keys(basePermissions).forEach(moduleKey => {
      completePermissions[moduleKey] = {
        ...basePermissions[moduleKey],
        ...(role.permissions[moduleKey] || {}),
      };
    });

    setRoleForm({
      ...role,
      permissions: completePermissions,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingRole(null);
    setRoleForm({
      name: '',
      description: '',
      full_access: false,
      permissions: {},
    });
  };

  const handlePermissionChange = (moduleKey: string, permType: 'view' | 'create' | 'edit' | 'delete' | 'archive', value: boolean) => {
    setRoleForm(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [moduleKey]: {
          ...(prev.permissions[moduleKey] || { view: false, create: false, edit: false, delete: false, archive: false }),
          [permType]: value,
        },
      },
    }));
  };

  const handleModuleToggle = (moduleKey: string, enabled: boolean) => {
    const module = MODULES.find(m => m.key === moduleKey);
    const modulePermissions = module?.permissions || ['view', 'create', 'edit', 'delete'];

    setRoleForm(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [moduleKey]: {
          view: enabled && modulePermissions.includes('view'),
          create: enabled && modulePermissions.includes('create'),
          edit: enabled && modulePermissions.includes('edit'),
          delete: enabled && modulePermissions.includes('delete'),
          archive: enabled && modulePermissions.includes('archive'),
        },
      },
    }));
  };

  const handleFullAccessToggle = (enabled: boolean) => {
    if (enabled) {
      // Si se activa acceso total, marcar solo los permisos disponibles para cada módulo
      const allPerms: RolePermissions = {};
      MODULES.forEach(module => {
        const modulePermissions = module.permissions || ['view', 'create', 'edit', 'delete'];
        allPerms[module.key] = {
          view: modulePermissions.includes('view'),
          create: modulePermissions.includes('create'),
          edit: modulePermissions.includes('edit'),
          delete: modulePermissions.includes('delete'),
          archive: modulePermissions.includes('archive'),
        };
      });
      setRoleForm(prev => ({
        ...prev,
        full_access: true,
        permissions: allPerms,
      }));
    } else {
      setRoleForm(prev => ({
        ...prev,
        full_access: false,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleForm.name.trim()) {
      toast({
        title: 'Error',
        description: 'El nombre del rol es obligatorio.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const url = editingRole
        ? `${API_BASE_URL}/roles/${editingRole.id}`
        : `${API_BASE_URL}/roles`;

      const method = editingRole ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(roleForm),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Error al guardar el rol');
      }

      toast({
        title: editingRole ? 'Actualizado' : 'Creado',
        description: editingRole ? 'Rol actualizado correctamente.' : 'Rol creado correctamente.',
      });
      closeDialog();
      fetchRoles();
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Error',
        description: err.message || 'No se pudo guardar el rol.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (role: Role) => {
    if (!confirm(`¿Eliminar el rol "${role.name}"?`)) return;

    try {
      const res = await fetch(`${API_BASE_URL}/roles/${role.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Error al eliminar el rol');
      }

      toast({
        title: 'Eliminado',
        description: 'Rol eliminado correctamente.',
      });
      fetchRoles();
    } catch (err: any) {
      console.error('Error deleting role:', err);
      toast({
        title: 'Error',
        description: err.message || 'No se pudo eliminar el rol.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Roles y Permisos</CardTitle>
            <CardDescription>Gestiona los roles y permisos de acceso al sistema.</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1" onClick={openCreateDialog}>
                <PlusCircle className="h-4 w-4" />
                Nuevo Rol
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingRole ? 'Editar Rol' : 'Crear Rol'}</DialogTitle>
                <DialogDescription>
                  Define el nombre del rol y asigna los permisos correspondientes.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="role-name">Nombre del rol</Label>
                    <Input
                      id="role-name"
                      value={roleForm.name}
                      onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                      placeholder="Ej: Abogado"
                      required
                      disabled={saving}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role-description">Descripción</Label>
                    <Input
                      id="role-description"
                      value={roleForm.description}
                      onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                      placeholder="Ej: Rol jurídico con control completo sobre módulos legales."
                      disabled={saving}
                    />
                  </div>
                </div>

                <div className="flex items-start space-x-3 rounded-md border p-4 bg-muted/20">
                  <input
                    type="checkbox"
                    id="full-access"
                    checked={roleForm.full_access}
                    onChange={(e) => handleFullAccessToggle(e.target.checked)}
                    disabled={saving}
                    className="h-5 w-5 mt-0.5"
                  />
                  <div className="flex-1">
                    <Label htmlFor="full-access" className="text-base font-medium cursor-pointer">
                      Acceso total al panel
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Si está activo, no necesitas marcar permisos manualmente.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-base">Permisos por Módulo</Label>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-[40px]">
                            <input type="checkbox" className="h-4 w-4" disabled />
                          </TableHead>
                          <TableHead className="font-semibold">Módulo</TableHead>
                          <TableHead className="text-center font-semibold w-[100px]">Ver</TableHead>
                          <TableHead className="text-center font-semibold w-[100px]">Crear</TableHead>
                          <TableHead className="text-center font-semibold w-[100px]">Editar</TableHead>
                          <TableHead className="text-center font-semibold w-[100px]">Eliminar</TableHead>
                          <TableHead className="text-center font-semibold w-[100px]">Archivar</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {MODULES.map((module) => {
                          const perms = roleForm.permissions[module.key] || {
                            view: false,
                            create: false,
                            edit: false,
                            delete: false,
                            archive: false,
                          };
                          const modulePermissions = module.permissions || ['view', 'create', 'edit', 'delete'];
                          const isModuleEnabled = perms.view || perms.create || perms.edit || perms.delete || perms.archive;

                          return (
                            <TableRow key={module.key}>
                              <TableCell>
                                <input
                                  type="checkbox"
                                  checked={isModuleEnabled}
                                  onChange={(e) => handleModuleToggle(module.key, e.target.checked)}
                                  disabled={saving || roleForm.full_access}
                                  className="h-4 w-4"
                                />
                              </TableCell>
                              <TableCell className="font-medium">{module.label}</TableCell>
                              <TableCell className="text-center">
                                {modulePermissions.includes('view') ? (
                                  <div className="flex flex-col items-center gap-1">
                                    <input
                                      type="checkbox"
                                      checked={perms.view}
                                      onChange={(e) => handlePermissionChange(module.key, 'view', e.target.checked)}
                                      disabled={saving || roleForm.full_access}
                                      className="h-4 w-4"
                                    />
                                    {module.customPermissionLabels?.view && (
                                      <span className="text-[10px] text-muted-foreground">
                                        {module.customPermissionLabels.view}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {modulePermissions.includes('create') ? (
                                  <div className="flex flex-col items-center gap-1">
                                    <input
                                      type="checkbox"
                                      checked={perms.create}
                                      onChange={(e) => handlePermissionChange(module.key, 'create', e.target.checked)}
                                      disabled={saving || roleForm.full_access}
                                      className="h-4 w-4"
                                    />
                                    {module.customPermissionLabels?.create && (
                                      <span className="text-[10px] text-muted-foreground">
                                        {module.customPermissionLabels.create}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {modulePermissions.includes('edit') ? (
                                  <div className="flex flex-col items-center gap-1">
                                    <input
                                      type="checkbox"
                                      checked={perms.edit}
                                      onChange={(e) => handlePermissionChange(module.key, 'edit', e.target.checked)}
                                      disabled={saving || roleForm.full_access}
                                      className="h-4 w-4"
                                    />
                                    {module.customPermissionLabels?.edit && (
                                      <span className="text-[10px] text-muted-foreground">
                                        {module.customPermissionLabels.edit}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {modulePermissions.includes('delete') ? (
                                  <div className="flex flex-col items-center gap-1">
                                    <input
                                      type="checkbox"
                                      checked={perms.delete}
                                      onChange={(e) => handlePermissionChange(module.key, 'delete', e.target.checked)}
                                      disabled={saving || roleForm.full_access}
                                      className="h-4 w-4"
                                    />
                                    {module.customPermissionLabels?.delete && (
                                      <span className="text-[10px] text-muted-foreground">
                                        {module.customPermissionLabels.delete}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {modulePermissions.includes('archive') ? (
                                  <div className="flex flex-col items-center gap-1">
                                    <input
                                      type="checkbox"
                                      checked={perms.archive || false}
                                      onChange={(e) => handlePermissionChange(module.key, 'archive', e.target.checked)}
                                      disabled={saving || roleForm.full_access}
                                      className="h-4 w-4"
                                    />
                                    {module.customPermissionLabels?.archive && (
                                      <span className="text-[10px] text-muted-foreground">
                                        {module.customPermissionLabels.archive}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={closeDialog} disabled={saving}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editingRole ? 'Actualizar Rol' : 'Crear Rol'}
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
                <TableHead>Nombre</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="w-[150px]">Acceso Total</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No hay roles registrados.
                  </TableCell>
                </TableRow>
              ) : (
                roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell className="text-muted-foreground">{role.description}</TableCell>
                    <TableCell>
                      {role.full_access ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                          Sí
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                          No
                        </span>
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
                          <DropdownMenuItem onClick={() => openEditDialog(role)}>
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(role)}
                          >
                            Eliminar
                          </DropdownMenuItem>
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

// ----------------------------------------------------------------------
// 2. COMPONENTE PRINCIPAL
// ----------------------------------------------------------------------

interface Deductora {
  id: number;
  nombre: string;
  fecha_reporte_pago: string | null;
  comision: number | null;
}

// ====== TASAS CRUD ======
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
    nombre: '',
    tasa: '',
    tasa_maxima: '',
    inicio: new Date().toISOString().split('T')[0],
    fin: '',
    activo: true,
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

  useEffect(() => {
    fetchTasas();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validaciones
    const tasa = parseFloat(formData.tasa);
    const tasaMaxima = formData.tasa_maxima ? parseFloat(formData.tasa_maxima) : null;

    // Validar que la tasa sea un número válido
    if (isNaN(tasa) || tasa <= 0) {
      toast({
        title: 'Tasa inválida',
        description: 'La tasa debe ser un número mayor a cero.',
        variant: 'destructive',
      });
      return;
    }

    // Validar rango de tasa (0-100%)
    if (tasa > 100) {
      toast({
        title: 'Tasa inválida',
        description: 'La tasa no puede ser mayor a 100%.',
        variant: 'destructive',
      });
      return;
    }

    // Validar que tasa <= tasa_maxima (si está definida)
    if (tasaMaxima !== null) {
      if (isNaN(tasaMaxima) || tasaMaxima <= 0) {
        toast({
          title: 'Tasa máxima inválida',
          description: 'La tasa máxima debe ser un número mayor a cero.',
          variant: 'destructive',
        });
        return;
      }

      if (tasaMaxima > 100) {
        toast({
          title: 'Tasa máxima inválida',
          description: 'La tasa máxima no puede ser mayor a 100%.',
          variant: 'destructive',
        });
        return;
      }

      if (tasa > tasaMaxima) {
        toast({
          title: 'Rangos inválidos',
          description: 'La tasa no puede ser mayor a la tasa máxima.',
          variant: 'destructive',
        });
        return;
      }
    }

    // Validar fechas al crear
    if (!editingTasa) {
      const inicioDate = new Date(formData.inicio);
      const finDate = formData.fin ? new Date(formData.fin) : null;

      if (finDate && inicioDate >= finDate) {
        toast({
          title: 'Fechas inválidas',
          description: 'La fecha de inicio debe ser anterior a la fecha de fin.',
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      if (editingTasa) {
        // Al editar, solo enviar nombre, tasa y tasa_maxima
        const payload = {
          nombre: formData.nombre,
          tasa,
          tasa_maxima: tasaMaxima,
        };
        await api.put(`/api/tasas/${editingTasa.id}`, payload);
        toast({ title: 'Éxito', description: 'Tasa actualizada correctamente' });
      } else {
        // Al crear, enviar todos los campos
        const payload = {
          nombre: formData.nombre,
          tasa,
          tasa_maxima: tasaMaxima,
          inicio: formData.inicio,
          fin: formData.fin || null,
          activo: formData.activo,
        };
        await api.post('/api/tasas', payload);
        toast({ title: 'Éxito', description: 'Tasa creada correctamente' });
      }

      setIsDialogOpen(false);
      setEditingTasa(null);
      setFormData({ nombre: '', tasa: '', tasa_maxima: '', inicio: new Date().toISOString().split('T')[0], fin: '', activo: true });
      fetchTasas();
    } catch (error: any) {
      console.error('Error saving tasa:', error);
      toast({
        title: 'Error',
        description: error?.response?.data?.message || 'No se pudo guardar la tasa',
        variant: 'destructive'
      });
    }
  };

  const handleEdit = (tasa: Tasa) => {
    setEditingTasa(tasa);
    setFormData({
      nombre: tasa.nombre,
      tasa: tasa.tasa.toString(),
      tasa_maxima: tasa.tasa_maxima?.toString() || '',
      inicio: tasa.inicio.split('T')[0], // Asegurar formato YYYY-MM-DD
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
      toast({
        title: 'Error',
        description: error?.response?.data?.message || 'No se pudo eliminar la tasa',
        variant: 'destructive'
      });
    }
  };

  const handleToggleActivo = async (tasa: Tasa) => {
    const nuevoEstado = !tasa.activo;

    // Optimistic update: actualizar UI inmediatamente
    setTasas(prev => prev.map(t =>
      t.id === tasa.id ? {
        ...t,
        activo: nuevoEstado,
        fin: nuevoEstado ? null : new Date().toISOString().split('T')[0]
      } : t
    ));

    try {
      const response = await api.patch(`/api/tasas/${tasa.id}/toggle-activo`);
      const tasaActualizada = response.data.tasa;

      // Confirmar con datos del servidor
      setTasas(prev => prev.map(t =>
        t.id === tasa.id ? tasaActualizada : t
      ));

      toast({
        title: 'Éxito',
        description: `Tasa ${tasaActualizada.activo ? 'activada' : 'desactivada'} correctamente`
      });
    } catch (error) {
      console.error('Error toggling tasa:', error);

      // Revertir cambio en caso de error
      setTasas(prev => prev.map(t =>
        t.id === tasa.id ? tasa : t
      ));

      toast({
        title: 'Error',
        description: 'No se pudo cambiar el estado de la tasa',
        variant: 'destructive'
      });
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
                      <Switch
                        checked={tasa.activo}
                        onCheckedChange={() => handleToggleActivo(tasa)}
                      />
                      <span className="text-sm text-muted-foreground">
                        {tasa.activo ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(tasa)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(tasa.id)}>
                        <Trash className="h-4 w-4 text-destructive" />
                      </Button>
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

                    // Establecer tasa máxima por defecto según el nombre
                    if (!editingTasa && !formData.tasa_maxima) {
                      if (nombre.toLowerCase().includes('micro')) {
                        tasaMaxima = '51.21';
                      } else if (nombre.toLowerCase().includes('regular') || nombre.toLowerCase().includes('crédito')) {
                        tasaMaxima = '36.27';
                      }
                    }

                    setFormData({ ...formData, nombre, tasa_maxima: tasaMaxima });
                  }}
                  placeholder="Ej: Tasa Regular, Tasa Mora"
                  required
                  disabled={!!editingTasa}
                />
                {editingTasa && (
                  <p className="text-xs text-muted-foreground mt-1">
                    El nombre no se puede modificar después de crear la tasa
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="tasa">Tasa (%)</Label>
                <Input
                  id="tasa"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.tasa}
                  onChange={(e) => setFormData({ ...formData, tasa: e.target.value })}
                  placeholder="33.50"
                  required
                />
              </div>
              <div>
                <Label htmlFor="tasa_maxima">Tasa Máxima (%) - Opcional</Label>
                <Input
                  id="tasa_maxima"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.tasa_maxima}
                  onChange={(e) => setFormData({ ...formData, tasa_maxima: e.target.value })}
                  placeholder="51.21"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Tasa máxima permitida para este tipo de crédito
                </p>
              </div>
              {!editingTasa && (
                <>
                  <div>
                    <Label htmlFor="inicio">Inicio de Vigencia</Label>
                    <Input
                      id="inicio"
                      type="date"
                      value={formData.inicio}
                      onChange={(e) => setFormData({ ...formData, inicio: e.target.value })}
                      required
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="activo"
                      checked={formData.activo}
                      onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="activo">Activa desde el inicio</Label>
                  </div>
                </>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingTasa ? 'Actualizar' : 'Crear'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default function ConfiguracionPage() {
  const { toast } = useToast();
  const { token } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    password_confirmation: '',
    role_id: 'none',
    status: 'Activo',
  });
  const [editingUser, setEditingUser] = useState<any | null>(null);

  // Roles state
  const [availableRoles, setAvailableRoles] = useState<any[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);

  // Deductoras state
  const [deductorasList, setDeductorasList] = useState<Deductora[]>([]);
  const [loadingDeductoras, setLoadingDeductoras] = useState(false);
  const [isDeductoraDialogOpen, setIsDeductoraDialogOpen] = useState(false);
  const [editingDeductora, setEditingDeductora] = useState<Deductora | null>(null);
  const [savingDeductora, setSavingDeductora] = useState(false);
  const [deductoraForm, setDeductoraForm] = useState({
    nombre: '',
    fecha_reporte_pago: '',
    comision: 0,
  });

  useEffect(() => {
    if (token) {
      fetchUsers();
      fetchDeductoras();
      fetchRoles();
    }
  }, [token]);

  const fetchRoles = async () => {
    setLoadingRoles(true);
    try {
      const res = await fetch(`${API_BASE_URL}/roles`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      if (res.ok) {
        const data = await res.json();
        console.log('Roles fetched for usuarios tab:', data);
        setAvailableRoles(data);
      } else {
        console.error('Failed to fetch roles, status:', res.status);
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
    } finally {
      setLoadingRoles(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch(`${API_BASE_URL}/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      if (res.ok) {
        const data = await res.json();
        console.log('Users fetched:', data);
        setUsers(data);
      } else {
        console.error('Failed to fetch users, status:', res.status);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchDeductoras = async () => {
    setLoadingDeductoras(true);
    try {
      const response = await api.get('/api/deductoras');
      setDeductorasList(response.data);
    } catch (error) {
      console.error('Error fetching deductoras from API, using static data:', error);
      // Fall back to static data from data.ts if API fails
      // setDeductorasList(deductorasData); 
      toast({
        title: "Usando datos locales",
        description: "No se pudo conectar con el servidor.",
        variant: "default",
      });
    } finally {
      setLoadingDeductoras(false);
    }
  };

  const handleDeductoraInputChange = (field: keyof typeof deductoraForm, value: any) => {
    setDeductoraForm(prev => ({ ...prev, [field]: value }));
  };

  const openCreateDeductoraDialog = () => {
    setEditingDeductora(null);
    setDeductoraForm({
      nombre: '',
      fecha_reporte_pago: '',
      comision: 0,
    });
    setIsDeductoraDialogOpen(true);
  };

  const openCreateUserDialog = () => {
    setEditingUser(null);
    setNewUser({
      name: '',
      email: '',
      password: '',
      password_confirmation: '',
      role_id: 'none',
      status: 'Activo',
    });
    setIsCreateUserOpen(true);
  };

  const openEditUserDialog = (user: any) => {
    setEditingUser(user);
    setNewUser({
      name: user.name || '',
      email: user.email || '',
      password: '',
      password_confirmation: '',
      role_id: user.role_id ? user.role_id.toString() : 'none',
      status: user.status || 'Activo',
    });
    setIsCreateUserOpen(true);
  };

  const openEditDeductoraDialog = (deductora: Deductora) => {
    setEditingDeductora(deductora);
    setDeductoraForm({
      nombre: deductora.nombre || '',
      fecha_reporte_pago: deductora.fecha_reporte_pago || '',
      comision: deductora.comision || 0,
    });
    setIsDeductoraDialogOpen(true);
  };

  const closeDeductoraDialog = () => {
    setIsDeductoraDialogOpen(false);
    setEditingDeductora(null);
    setDeductoraForm({
      nombre: '',
      fecha_reporte_pago: '',
      comision: 0,
    });
  };

  const handleDeductoraSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deductoraForm.nombre?.trim()) {
      toast({
        title: "Error",
        description: "El nombre es obligatorio.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSavingDeductora(true);
      const payload = {
        nombre: deductoraForm.nombre.trim(),
        fecha_reporte_pago: deductoraForm.fecha_reporte_pago || null,
        comision: deductoraForm.comision || null,
      };

      if (editingDeductora) {
        await api.put(`/api/deductoras/${editingDeductora.id}`, payload);
        toast({
          title: "Actualizado",
          description: "Deductora actualizada correctamente.",
        });
      } else {
        await api.post('/api/deductoras', payload);
        toast({
          title: "Creado",
          description: "Deductora creada correctamente.",
        });
      }

      closeDeductoraDialog();
      fetchDeductoras();
    } catch (error: any) {
      console.error('Error saving deductora:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar la deductora.",
        variant: "destructive",
      });
    } finally {
      setSavingDeductora(false);
    }
  };

  const handleDeleteDeductora = async (deductora: Deductora) => {
    if (!confirm(`¿Eliminar la deductora "${deductora.nombre}"?`)) return;

    try {
      await api.delete(`/api/deductoras/${deductora.id}`);
      toast({
        title: "Eliminado",
        description: "Deductora eliminada correctamente.",
      });
      fetchDeductoras();
    } catch (error) {
      console.error('Error deleting deductora:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la deductora.",
        variant: "destructive",
      });
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newUser.password !== newUser.password_confirmation) {
      toast({
        title: "Error de validación",
        description: "Las contraseñas no coinciden.",
        variant: "destructive",
      });
      return;
    }
    setCreatingUser(true);
    try {
      const method = editingUser ? 'PUT' : 'POST';
      const url = editingUser ? `${API_BASE_URL}/users/${editingUser.id}` : `${API_BASE_URL}/users`;

      // Convertir 'none' a null para role_id
      const payload = {
        ...newUser,
        role_id: newUser.role_id === 'none' ? null : parseInt(newUser.role_id)
      };

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast({
          title: editingUser ? "Usuario Actualizado" : "Usuario Creado",
          description: editingUser ? "El usuario ha sido actualizado." : "El usuario ha sido registrado exitosamente.",
        });
        setIsCreateUserOpen(false);
        setEditingUser(null);
        setNewUser({
          name: '',
          email: '',
          password: '',
          password_confirmation: '',
          role_id: 'none',
          status: 'Activo'
        });
        fetchUsers();
      } else {
        const errorData = await res.json();
        toast({
          title: editingUser ? "Error al actualizar usuario" : "Error al crear usuario",
          description: errorData.message || "Ocurrió un error inesperado.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error saving user:', error);
      toast({
        title: "Error de conexión",
        description: "No se pudo conectar con el servidor.",
        variant: "destructive",
      });
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = async (user: any) => {
    if (!confirm(`¿Eliminar al usuario "${user.name}"?`)) return;
    try {
      await fetch(`${API_BASE_URL}/users/${user.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      toast({ title: 'Eliminado', description: 'Usuario eliminado correctamente.' });
      fetchUsers();
    } catch (err) {
      console.error('Error deleting user', err);
      toast({ title: 'Error', description: 'No se pudo eliminar el usuario.', variant: 'destructive' });
    }
  };

  const handleUpdateUserRole = async (userId: number, roleId: string) => {
    try {
      const payload = {
        role_id: roleId === 'none' ? null : parseInt(roleId)
      };

      const res = await fetch(`${API_BASE_URL}/users/${userId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast({
          title: "Rol actualizado",
          description: "El rol del usuario ha sido actualizado correctamente.",
        });
        fetchUsers();
      } else {
        const errorData = await res.json();
        toast({
          title: "Error al actualizar rol",
          description: errorData.message || "Ocurrió un error inesperado.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error updating user role:', error);
      toast({
        title: "Error de conexión",
        description: "No se pudo conectar con el servidor.",
        variant: "destructive",
      });
    }
  };

  // Estado para configuraciones de préstamos
  const [regularConfig, setRegularConfig] = useState({
    minAmount: '',
    maxAmount: '',
    interestRate: '',
    minTerm: '',
    maxTerm: '',
  });

  const [microConfig, setMicroConfig] = useState({
    minAmount: '',
    maxAmount: '',
    interestRate: '',
    minTerm: '',
    maxTerm: '',
  });

  const [loadingLoanConfigs, setLoadingLoanConfigs] = useState(false);
  const [savingRegular, setSavingRegular] = useState(false);
  const [savingMicro, setSavingMicro] = useState(false);
  const [availableTasas, setAvailableTasas] = useState<Tasa[]>([]);

  // Función para formatear número a colones con comas
  const formatColones = (value: string | number): string => {
    const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
    if (isNaN(num) || num === 0) return '';
    // Usar formato con comas como separador de miles
    return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
  };

  // Función para parsear colones a número
  const parseColones = (value: string): string => {
    return value.replace(/,/g, '');
  };

  // Cargar tasas disponibles desde la API
  const fetchAvailableTasas = useCallback(async () => {
    try {
      const response = await api.get('/api/tasas');
      setAvailableTasas(response.data);
    } catch (error) {
      console.error('Error fetching tasas:', error);
    }
  }, []);

  // Cargar configuraciones de préstamos desde la API
  const fetchLoanConfigurations = useCallback(async () => {
    setLoadingLoanConfigs(true);
    try {
      const response = await api.get('/api/loan-configurations');
      const configs = response.data;

      const regular = configs.find((c: any) => c.tipo === 'regular');
      const micro = configs.find((c: any) => c.tipo === 'microcredito');

      if (regular) {
        setRegularConfig({
          minAmount: regular.monto_minimo?.toString() || '',
          maxAmount: regular.monto_maximo?.toString() || '',
          interestRate: regular.tasa?.tasa?.toString() || '',
          minTerm: regular.plazo_minimo?.toString() || '',
          maxTerm: regular.plazo_maximo?.toString() || '',
        });
      }

      if (micro) {
        setMicroConfig({
          minAmount: micro.monto_minimo?.toString() || '',
          maxAmount: micro.monto_maximo?.toString() || '',
          interestRate: micro.tasa?.tasa?.toString() || '',
          minTerm: micro.plazo_minimo?.toString() || '',
          maxTerm: micro.plazo_maximo?.toString() || '',
        });
      }
    } catch (error) {
      console.error('Error fetching loan configurations:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las configuraciones de préstamos.',
        variant: 'destructive',
      });
    } finally {
      setLoadingLoanConfigs(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAvailableTasas();
    fetchLoanConfigurations();
  }, [fetchAvailableTasas, fetchLoanConfigurations]);

  const handleRegularChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    // Para montos, guardar sin formato
    if (id === 'minAmount' || id === 'maxAmount') {
      setRegularConfig((prev) => ({ ...prev, [id]: parseColones(value) }));
    } else {
      setRegularConfig((prev) => ({ ...prev, [id]: value }));
    }
  };

  const handleMicroChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    // Para montos, guardar sin formato
    if (id === 'minAmount' || id === 'maxAmount') {
      setMicroConfig((prev) => ({ ...prev, [id]: parseColones(value) }));
    } else {
      setMicroConfig((prev) => ({ ...prev, [id]: value }));
    }
  };

  const handleSave = async (creditType: 'regular' | 'microcredito') => {
    const config = creditType === 'regular' ? regularConfig : microConfig;
    const setLoading = creditType === 'regular' ? setSavingRegular : setSavingMicro;
    const label = creditType === 'regular' ? 'Crédito Regular' : 'Micro-crédito';

    // Validaciones de rangos
    const minAmount = parseFloat(config.minAmount);
    const maxAmount = parseFloat(config.maxAmount);
    const minTerm = parseInt(config.minTerm);
    const maxTerm = parseInt(config.maxTerm);
    const interestRate = parseFloat(config.interestRate);

    // Validar que los campos no estén vacíos
    if (!config.minAmount || !config.maxAmount || !config.interestRate || !config.minTerm || !config.maxTerm) {
      toast({
        title: 'Campos incompletos',
        description: 'Todos los campos son obligatorios.',
        variant: 'destructive',
      });
      return;
    }

    // Validar valores positivos
    if (minAmount <= 0 || maxAmount <= 0) {
      toast({
        title: 'Valores inválidos',
        description: 'Los montos deben ser mayores a cero.',
        variant: 'destructive',
      });
      return;
    }

    if (minTerm <= 0 || maxTerm <= 0) {
      toast({
        title: 'Valores inválidos',
        description: 'Los plazos deben ser mayores a cero.',
        variant: 'destructive',
      });
      return;
    }

    if (interestRate <= 0 || interestRate > 100) {
      toast({
        title: 'Tasa inválida',
        description: 'La tasa debe estar entre 0 y 100%.',
        variant: 'destructive',
      });
      return;
    }

    // Validar rangos mínimo < máximo
    if (minAmount >= maxAmount) {
      toast({
        title: 'Rango inválido',
        description: 'El monto mínimo debe ser menor al monto máximo.',
        variant: 'destructive',
      });
      return;
    }

    if (minTerm >= maxTerm) {
      toast({
        title: 'Rango inválido',
        description: 'El plazo mínimo debe ser menor al plazo máximo.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      await api.put(`/api/loan-configurations/${creditType}`, {
        monto_minimo: minAmount,
        monto_maximo: maxAmount,
        tasa_anual: interestRate,
        plazo_minimo: minTerm,
        plazo_maximo: maxTerm,
      });

      toast({
        title: "Parámetros Guardados",
        description: `La configuración para ${label} ha sido actualizada.`,
        duration: 3000,
      });

      // Recargar configuraciones para reflejar cambios del backend
      await fetchLoanConfigurations();
    } catch (error: any) {
      console.error('Error saving loan configuration:', error);
      toast({
        title: 'Error',
        description: error?.response?.data?.message || `No se pudo guardar la configuración de ${label}.`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const [tasaActual, setTasaActual] = useState<string>('33.5');
  const [tasaLoading, setTasaLoading] = useState(false);
  const [tasaSaving, setTasaSaving] = useState(false);
  const [tasaCreditId, setTasaCreditId] = useState<number | null>(null);
  const [polizaActual, setPolizaActual] = useState<string>('0');
  const [polizaLoading, setPolizaLoading] = useState(false);
  const [polizaSaving, setPolizaSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('prestamos');

  const fetchReferenceCredit = useCallback(async () => {
    const res = await api.get('/api/credits');
    const list = res.data;
    if (Array.isArray(list) && list.length > 0) {
      return list[0];
    }
    return null;
  }, []);

  const loadTasa = useCallback(async () => {
    setTasaLoading(true);
    try {
      const credit = await fetchReferenceCredit();
      if (credit) {
        setTasaCreditId(credit.id);
        const tasaValue = credit.tasa_actual ?? credit.tasa_anual;
        setTasaActual(tasaValue ? String(tasaValue) : '33.5');
      } else {
        setTasaActual('33.5');
        setTasaCreditId(null);
      }
    } catch (err) {
      console.error('Failed to load tasa_actual from credits:', err);
      toast({ title: 'Error', description: 'No se pudo obtener la tasa actual.', variant: 'destructive' });
    } finally {
      setTasaLoading(false);
    }
  }, [fetchReferenceCredit, toast]);

  const loadPoliza = useCallback(async () => {
    setPolizaLoading(true);
    try {
      const res = await api.get('/api/loan-configurations/regular');
      const config = res.data;
      setPolizaActual(String(config.monto_poliza ?? 0));
    } catch (err) {
      console.error('Failed to load monto_poliza from loan_configurations:', err);
      toast({ title: 'Error', description: 'No se pudo obtener la póliza.', variant: 'destructive' });
    } finally {
      setPolizaLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (activeTab === 'tasa_actual') {
      loadTasa();
    }
  }, [activeTab, loadTasa]);

  useEffect(() => {
    if (activeTab === 'poliza') {
      loadPoliza();
    }
  }, [activeTab, loadPoliza]);

  return (
    <ProtectedPage module="configuracion">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(String(v))}>
      <TabsList className="mb-4">
        <TabsTrigger value="prestamos">Préstamos</TabsTrigger>
        <TabsTrigger value="tasas">Tasas</TabsTrigger>
        <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
        <TabsTrigger value="roles-permisos">Roles y Permisos</TabsTrigger>
        <TabsTrigger value="patronos">Patronos</TabsTrigger>
        <TabsTrigger value="deductoras">Deductoras</TabsTrigger>
        <TabsTrigger value="empresas">Empresas</TabsTrigger>
        <TabsTrigger value="instituciones">Instituciones</TabsTrigger>
        <TabsTrigger value="productos">Créditos</TabsTrigger>
        <TabsTrigger value="api">API ERP</TabsTrigger>
        <TabsTrigger value="poliza">Póliza</TabsTrigger>
      </TabsList>


      <TabsContent value="empresas">
        <EmpresasCRUD />
      </TabsContent>

      <TabsContent value="instituciones">
        <InstitucionesCRUD />
      </TabsContent>

      <TabsContent value="productos">
        <ProductosCRUD />
      </TabsContent>

      <TabsContent value="tasas">
        <TasasCRUD />
      </TabsContent>

      <TabsContent value="tasa_actual_old">
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <Label htmlFor="tasa-actual" className="text-center">Tasa de Mora Anual (%)</Label>
            <Input
              id="tasa-actual"
              type="number"
              value={tasaActual}
              onChange={(e) => setTasaActual(e.target.value)}
              className="max-w-xs text-center font-mono"
              disabled={tasaLoading}
            />
            <div className="flex items-center gap-2">
              <Button
                onClick={async () => {
                  if (tasaCreditId === null) {
                    toast({ title: 'Error', description: 'No hay crédito seleccionado para actualizar.', variant: 'destructive' });
                    return;
                  }
                  setTasaSaving(true);
                  try {
                    await api.put(`/api/credits/${tasaCreditId}`, { tasa_anual: parseFloat(tasaActual) || 0 });
                    toast({ title: 'Guardado', description: 'Tasa actualizada correctamente.' });
                    await loadTasa();
                  } catch (err) {
                    console.error('Failed to save tasa_actual:', err);
                    toast({ title: 'Error', description: 'No se pudo guardar la tasa.', variant: 'destructive' });
                  } finally {
                    setTasaSaving(false);
                  }
                }}
                disabled={tasaLoading || tasaSaving}
              >
                {tasaSaving ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="poliza">
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <Label htmlFor="poliza-actual" className="text-center">Monto de Póliza por Cuota (₡)</Label>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Este monto fijo se aplicará a cada cuota del plan de pagos cuando el crédito tenga póliza activa.
            </p>
            <Input
              id="poliza-actual"
              type="number"
              value={polizaActual}
              onChange={(e) => setPolizaActual(e.target.value)}
              className="max-w-xs text-center font-mono"
              disabled={polizaLoading}
            />
            <div className="flex items-center gap-2">
              <Button
                onClick={async () => {
                  setPolizaSaving(true);
                  try {
                    await api.put('/api/loan-configurations/regular', { monto_poliza: parseFloat(polizaActual) || 0 });
                    toast({ title: 'Guardado', description: 'Póliza actualizada correctamente.' });
                    await loadPoliza();
                  } catch (err) {
                    console.error('Failed to save monto_poliza:', err);
                    toast({ title: 'Error', description: 'No se pudo guardar la póliza.', variant: 'destructive' });
                  } finally {
                    setPolizaSaving(false);
                  }
                }}
                disabled={polizaLoading || polizaSaving}
              >
                {polizaSaving ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="prestamos">
        {loadingLoanConfigs ? (
          <div className="flex justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Crédito Regular</CardTitle>
                <CardDescription>
                  Parámetros para los créditos regulares de deducción de planilla.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="regular-minAmount">Monto Mínimo</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₡</span>
                      <Input
                        id="minAmount"
                        type="text"
                        value={formatColones(regularConfig.minAmount)}
                        onChange={handleRegularChange}
                        className="font-mono pl-7"
                        disabled={savingRegular}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="regular-maxAmount">Monto Máximo</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₡</span>
                      <Input
                        id="maxAmount"
                        type="text"
                        value={formatColones(regularConfig.maxAmount)}
                        onChange={handleRegularChange}
                        className="font-mono pl-7"
                        disabled={savingRegular}
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="regular-interestRate">Tasa Anual</Label>
                  <Select
                    value={regularConfig.interestRate}
                    onValueChange={(value) => {
                      setRegularConfig(prev => ({ ...prev, interestRate: value }));
                    }}
                    disabled={savingRegular}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione una tasa" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTasas
                        .filter(tasa => tasa.activo)
                        .map((tasa) => (
                          <SelectItem key={tasa.id} value={tasa.tasa.toString()}>
                            {tasa.nombre} - {tasa.tasa}%
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="regular-minTerm">Plazo Mínimo (meses)</Label>
                    <Input
                      id="minTerm"
                      type="number"
                      value={regularConfig.minTerm}
                      onChange={handleRegularChange}
                      className="font-mono"
                      disabled={savingRegular}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="regular-maxTerm">Plazo Máximo (meses)</Label>
                    <Input
                      id="maxTerm"
                      type="number"
                      value={regularConfig.maxTerm}
                      onChange={handleRegularChange}
                      className="font-mono"
                      disabled={savingRegular}
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={() => handleSave('regular')} disabled={savingRegular}>
                  {savingRegular && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Guardar Cambios
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Micro-crédito</CardTitle>
                <CardDescription>
                  Parámetros para micro-créditos de rápida aprobación.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="micro-minAmount">Monto Mínimo</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₡</span>
                      <Input
                        id="minAmount"
                        type="text"
                        value={formatColones(microConfig.minAmount)}
                        onChange={handleMicroChange}
                        className="font-mono pl-7"
                        disabled={savingMicro}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="micro-maxAmount">Monto Máximo</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₡</span>
                      <Input
                        id="maxAmount"
                        type="text"
                        value={formatColones(microConfig.maxAmount)}
                        onChange={handleMicroChange}
                        className="font-mono pl-7"
                        disabled={savingMicro}
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="micro-interestRate">Tasa de Interés Anual</Label>
                  <Select
                    value={microConfig.interestRate}
                    onValueChange={(value) => {
                      setMicroConfig(prev => ({ ...prev, interestRate: value }));
                    }}
                    disabled={savingMicro}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione una tasa" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTasas
                        .filter(tasa => tasa.activo)
                        .map((tasa) => (
                          <SelectItem key={tasa.id} value={tasa.tasa.toString()}>
                            {tasa.nombre} - {tasa.tasa}%
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="micro-minTerm">Plazo Mínimo (meses)</Label>
                    <Input
                      id="minTerm"
                      type="number"
                      value={microConfig.minTerm}
                      onChange={handleMicroChange}
                      className="font-mono"
                      disabled={savingMicro}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="micro-maxTerm">Plazo Máximo (meses)</Label>
                    <Input
                      id="maxTerm"
                      type="number"
                      value={microConfig.maxTerm}
                      onChange={handleMicroChange}
                      className="font-mono"
                      disabled={savingMicro}
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={() => handleSave('microcredito')} disabled={savingMicro}>
                  {savingMicro && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Guardar Cambios
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}
      </TabsContent>

      <TabsContent value="usuarios">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Usuarios del Sistema</CardTitle>
                <CardDescription>
                  Administra los usuarios que tienen acceso al panel.
                </CardDescription>
              </div>
              <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1" onClick={openCreateUserDialog}>
                    <PlusCircle className="h-4 w-4" />
                    Agregar Usuario
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingUser ? 'Editar Usuario' : 'Agregar Nuevo Usuario'}</DialogTitle>
                    <DialogDescription>
                      {editingUser ? 'Modifica los datos del usuario.' : 'Ingresa los datos del nuevo usuario. Todos los campos son obligatorios.'}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateUser} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nombre Completo</Label>
                      <Input
                        id="name"
                        value={newUser.name}
                        onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Correo Electrónico</Label>
                      <Input
                        id="email"
                        type="email"
                        value={newUser.email}
                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Contraseña</Label>
                      <Input
                        id="password"
                        type="password"
                        value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password_confirmation">Confirmar Contraseña</Label>
                      <Input
                        id="password_confirmation"
                        type="password"
                        value={newUser.password_confirmation}
                        onChange={(e) => setNewUser({ ...newUser, password_confirmation: e.target.value })}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="role">Rol</Label>
                        <Select
                          value={newUser.role_id}
                          onValueChange={(value) => setNewUser({ ...newUser, role_id: value })}
                        >
                          <SelectTrigger id="role">
                            <SelectValue placeholder="Seleccionar rol" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin Rol Asignado</SelectItem>
                            {loadingRoles ? (
                              <div className="px-2 py-1.5 text-sm text-muted-foreground">Cargando roles...</div>
                            ) : (
                              availableRoles.map((role) => (
                                <SelectItem key={role.id} value={role.id.toString()}>
                                  {role.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="status">Estado</Label>
                        <Select
                          value={newUser.status}
                          onValueChange={(value) => setNewUser({ ...newUser, status: value })}
                        >
                          <SelectTrigger id="status">
                            <SelectValue placeholder="Seleccionar estado" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Activo">Activo</SelectItem>
                            <SelectItem value="Suspendido">Suspendido</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={creatingUser}>
                        {creatingUser && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {editingUser ? 'Actualizar Usuario' : 'Crear Usuario'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {loadingUsers ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha Creación</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Select
                          value={user.role_id ? user.role_id.toString() : 'none'}
                          onValueChange={(value) => handleUpdateUserRole(user.id, value)}
                          disabled={loadingRoles}
                        >
                          <SelectTrigger className="w-[180px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin Rol Asignado</SelectItem>
                            {availableRoles.map((role) => (
                              <SelectItem key={role.id} value={role.id.toString()}>
                                {role.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${user.status === 'Activo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                          {user.status || 'Activo'}
                        </span>
                      </TableCell>
                      <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
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
                            <DropdownMenuItem onClick={() => openEditUserDialog(user)}>Editar</DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteUser(user)}>Eliminar</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No hay usuarios registrados.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="roles-permisos">
        <RolesPermisosManager />
      </TabsContent>

      <Dialog open={isDeductoraDialogOpen} onOpenChange={setIsDeductoraDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDeductora ? "Editar Deductora" : "Crear Deductora"}
            </DialogTitle>
            <DialogDescription>
              {editingDeductora
                ? "Modifica los datos de la deductora."
                : "Ingresa los datos de la nueva deductora."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDeductoraSubmit}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="deductora-nombre">Nombre</Label>
                <Input
                  id="deductora-nombre"
                  value={deductoraForm.nombre}
                  onChange={(e) => handleDeductoraInputChange("nombre", e.target.value)}
                  required
                  disabled={savingDeductora}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deductora-fecha">Fecha Reporte Pago</Label>
                <Input
                  id="deductora-fecha"
                  type="date"
                  value={deductoraForm.fecha_reporte_pago}
                  onChange={(e) => handleDeductoraInputChange("fecha_reporte_pago", e.target.value)}
                  disabled={savingDeductora}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deductora-comision">Comisión (%)</Label>
                <Input
                  id="deductora-comision"
                  type="number"
                  step="0.01"
                  value={deductoraForm.comision}
                  onChange={(e) => handleDeductoraInputChange("comision", parseFloat(e.target.value) || 0)}
                  disabled={savingDeductora}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDeductoraDialog} disabled={savingDeductora}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingDeductora}>
                {savingDeductora && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingDeductora ? "Actualizar" : "Crear"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <TabsContent value="patronos">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Patronos</CardTitle>
                <CardDescription>
                  Gestiona la lista de instituciones y patronos para deducción de planilla.
                </CardDescription>
              </div>
              <Button size="sm" className="gap-1">
                <PlusCircle className="h-4 w-4" />
                Agregar Patrono
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre del Patrono</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Fecha de Cobro</TableHead>
                  <TableHead>
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patronos.map((patrono) => (
                  <TableRow key={patrono.id}>
                    <TableCell className="font-medium">{patrono.name}</TableCell>
                    <TableCell>{patrono.category}</TableCell>
                    <TableCell>{patrono.paymentDate}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            aria-haspopup="true"
                            size="icon"
                            variant="ghost"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Alternar menú</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                          <DropdownMenuItem>Editar</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="deductoras">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Entidades Deductoras</CardTitle>
                <CardDescription>
                  Gestiona las cooperativas y entidades que procesan las deducciones.
                </CardDescription>
              </div>
              <Button size="sm" className="gap-1" onClick={openCreateDeductoraDialog}>
                <PlusCircle className="h-4 w-4" />
                Agregar Deductora
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingDeductoras ? (
              <div className="flex justify-center p-8">
                <Loader2 className="animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre de la Deductora</TableHead>
                    <TableHead>Fecha de Cobro</TableHead>
                    <TableHead className="text-right">Comisión (%)</TableHead>
                    <TableHead>
                      <span className="sr-only">Acciones</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deductorasList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No hay deductoras registradas.
                      </TableCell>
                    </TableRow>
                  ) : (
                    deductorasList.map((deductora) => (
                      <TableRow key={deductora.id}>
                        <TableCell className="font-medium">{deductora.nombre}</TableCell>
                        <TableCell>{deductora.fecha_reporte_pago ? new Date(deductora.fecha_reporte_pago).toLocaleDateString('es-CR') : '-'}</TableCell>
                        <TableCell className="text-right font-mono">{(parseFloat(deductora.comision?.toString() || '0')).toFixed(2)}%</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                aria-haspopup="true"
                                size="icon"
                                variant="ghost"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Alternar menú</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => openEditDeductoraDialog(deductora)}>Editar</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteDeductora(deductora)}>
                                Eliminar
                              </DropdownMenuItem>
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
      </TabsContent>

      <TabsContent value="api">
        <Card>
          <CardHeader>
            <CardTitle>Configuración de API</CardTitle>
            <CardDescription>
              Gestiona la conexión con el sistema ERP.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="max-w-md space-y-4">
              <div className="space-y-2">
                <Label htmlFor="api-url">URL del ERP</Label>
                <Input
                  id="api-url"
                  placeholder="https://erp.example.com/api"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="api-key">Clave de API (API Key)</Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder="Ingresa tu clave de API"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline">Probar Conexión</Button>
                <Button type="submit">Guardar Cambios</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </TabsContent>
      </Tabs>
    </ProtectedPage>
  );
}