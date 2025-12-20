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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, PlusCircle, MoreHorizontal, Loader2 } from 'lucide-react';
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
import { patronos, deductoras as deductorasData, creditConfigs } from '@/lib/data'; // Ajusté deductorasData por si acaso
import { API_BASE_URL } from '@/lib/env';
import { useAuth } from '@/components/auth-guard';
import api from '@/lib/axios';

// ----------------------------------------------------------------------
// 1. COMPONENTES Y CONSTANTES AUXILIARES (Definidos FUERA del componente principal)
// ----------------------------------------------------------------------

const tiposOptions = [
  { label: 'Constancia', value: 'Constancia' },
  { label: 'Colilla', value: 'Colilla' },
];

function EnterpriseCreateForm() {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [tipos, setTipos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const { token } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: 'Error', description: 'El nombre es obligatorio.', variant: 'destructive' });
      return;
    }
    if (tipos.length === 0) {
      toast({ title: 'Error', description: 'Selecciona al menos un tipo.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const extensiones = ['pdf', 'html'];

      const requirements = tipos.flatMap(tipo =>
        extensiones.map(ext => ({
          file_extension: ext,
          upload_date: now,
          last_updated: now,
        }))
      );

      const payload = {
        business_name: name.trim(),
        requirements,
      };

      await api.post('/api/enterprises', payload, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      toast({ title: 'Empresa creada', description: `Nombre: ${name}, Tipos: ${tipos.join(', ')}` });
      setName('');
      setTipos([]);
    } catch (err: any) {
      console.error(err);
      const msg = err?.response?.data?.message || 'No se pudo crear la empresa.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="space-y-4 max-w-md" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="enterprise-name">Nombre de la empresa</Label>
        <Input
          id="enterprise-name"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Ej: I.M.A.S, C.N.P., ..."
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="enterprise-tipos">Tipos</Label>
        {/* Nota: El Select de Shadcn estándar es Single Select. 
            Si necesitas selección múltiple real, necesitarás un componente MultiSelect custom 
            o usar Checkboxes. Aquí simulo la selección simple por compatibilidad, 
            o agrega lógica acumulativa si tu componente lo soporta. */}
        <Select
          value={tipos.length > 0 ? tipos[0] : ''}
          onValueChange={(val) => {
            // Lógica simple: Reemplaza. Si quieres múltiple, cambia a checkboxes o MultiSelect component.
            setTipos([val]);
          }}
        >
          <SelectTrigger id="enterprise-tipos">
            <SelectValue placeholder="Selecciona tipos" />
          </SelectTrigger>
          <SelectContent>
            {tiposOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          * Para selección múltiple, implementa un componente MultiSelect o usa checkboxes.
        </p>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? 'Guardando...' : 'Crear Empresa'}
        </Button>
      </div>
    </form>
  );
}

// ----------------------------------------------------------------------
// 2. COMPONENTE PRINCIPAL
// ----------------------------------------------------------------------

interface Deductora {
  id: number;
  nombre: string;
  fecha_reporte_pago: string | null;
  comision: number | null;
}

const EmpresasTable: React.FC = () => {
  const [empresas, setEmpresas] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const { token } = useAuth();

  React.useEffect(() => {
    const fetchEmpresas = async () => {
      setLoading(true);
      try {
        const res = await api.get('/api/enterprises', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        setEmpresas(res.data);
      } catch (err) {
        setEmpresas([]);
      } finally {
        setLoading(false);
      }
    };
    fetchEmpresas();
  }, [token]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lista de Empresas</CardTitle>
        <CardDescription>Visualiza todas las empresas registradas.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="animate-spin" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Requerimientos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {empresas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No hay empresas registradas.
                  </TableCell>
                </TableRow>
              ) : (
                empresas.map((empresa: any) => (
                  <TableRow key={empresa.id}>
                    <TableCell>{empresa.id}</TableCell>
                    <TableCell>{empresa.business_name}</TableCell>
                    <TableCell>
                      {empresa.requirements && empresa.requirements.length > 0 ? (
                        <ul className="list-disc pl-4">
                          {empresa.requirements.map((req: any, idx: number) => (
                            <li key={idx}>
                              {req.name}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin requerimientos</span>
                      )}
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
    role: 'Sin Rol Asignado',
    status: 'Activo',
  });
  const [editingUser, setEditingUser] = useState<any | null>(null);

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
    }
  }, [token]);

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
        setUsers(data);
      } else {
        console.error('Failed to fetch users');
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
      role: 'Sin Rol Asignado',
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
      role: user.role || 'Sin Rol Asignado',
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

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(newUser),
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
          role: 'Sin Rol Asignado',
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

  // Estado para el Crédito Regular
  const [regularConfig, setRegularConfig] = useState({
    minAmount: '500000',
    maxAmount: '10000000',
    interestRate: creditConfigs.regular.interestRate.toString(),
    minTerm: '12',
    maxTerm: '72',
  });

  // Estado para el Micro-Crédito
  const [microConfig, setMicroConfig] = useState({
    minAmount: '100000',
    maxAmount: '1000000',
    interestRate: creditConfigs.micro.interestRate.toString(),
    minTerm: '6',
    maxTerm: '24',
  });

  const handleRegularChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setRegularConfig((prev) => ({ ...prev, [id]: value }));
  };

  const handleMicroChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setMicroConfig((prev) => ({ ...prev, [id]: value }));
  };

  const handleSave = (creditType: 'Crédito Regular' | 'Micro-crédito') => {
    toast({
      title: "Parámetros Guardados",
      description: `La configuración para ${creditType} ha sido actualizada.`,
      duration: 3000,
    });
  };

  const [tasaActual, setTasaActual] = useState<string>('33.5');
  const [tasaLoading, setTasaLoading] = useState(false);
  const [tasaSaving, setTasaSaving] = useState(false);
  const [tasaCreditId, setTasaCreditId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<string>('prestamos');

  const loadTasa = useCallback(async () => {
    setTasaLoading(true);
    try {
      const res = await api.get('/api/credits');
      const list = res.data;
      if (Array.isArray(list) && list.length > 0) {
        const first = list[0];
        setTasaCreditId(first.id);
        setTasaActual(first.tasa_actual ? String(first.tasa_actual) : '33.5');
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
  }, [toast]);

  useEffect(() => {
    if (activeTab === 'tasa_actual') {
      loadTasa();
    }
  }, [activeTab, loadTasa]);

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(String(v))}>
      <TabsList className="mb-4">
        <TabsTrigger value="prestamos">Préstamos</TabsTrigger>
        <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
        <TabsTrigger value="patronos">Patronos</TabsTrigger>
        <TabsTrigger value="deductoras">Deductoras</TabsTrigger>
        <TabsTrigger value="empresas">Empresas</TabsTrigger>
        <TabsTrigger value="api">API ERP</TabsTrigger>
        <TabsTrigger value="tasa_actual">Tasa Actual</TabsTrigger>
      </TabsList>


      <TabsContent value="empresas">
        <Tabs defaultValue="crud" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="crud">CRUD</TabsTrigger>
            <TabsTrigger value="tabla">Tabla</TabsTrigger>
          </TabsList>
          <TabsContent value="crud">
            <Card>
              <CardHeader>
                <CardTitle>Empresas</CardTitle>
                <CardDescription>Agrega una nueva empresa y selecciona los tipos asociados.</CardDescription>
              </CardHeader>
              <CardContent>
                <EnterpriseCreateForm />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="tabla">
            <EmpresasTable />
          </TabsContent>
        </Tabs>
      </TabsContent>

      <TabsContent value="tasa_actual">
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <Label htmlFor="tasa-actual" className="text-center">Tasa de Interés Anual (%)</Label>
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

      <TabsContent value="prestamos">
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
                  <Label htmlFor="regular-minAmount">Monto Mínimo (₡)</Label>
                  <Input
                    id="minAmount"
                    type="number"
                    value={regularConfig.minAmount}
                    onChange={handleRegularChange}
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="regular-maxAmount">Monto Máximo (₡)</Label>
                  <Input
                    id="maxAmount"
                    type="number"
                    value={regularConfig.maxAmount}
                    onChange={handleRegularChange}
                    className="font-mono"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="regular-interestRate">
                  Tasa Anual (%)
                </Label>
                <Input
                  id="interestRate"
                  type="number"
                  value={regularConfig.interestRate}

                  onChange={handleRegularChange}
                  className="font-mono"
                />
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
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={() => handleSave('Crédito Regular')}>Guardar Cambios</Button>
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
                  <Label htmlFor="micro-minAmount">Monto Mínimo (₡)</Label>
                  <Input
                    id="minAmount"
                    type="number"
                    value={microConfig.minAmount}
                    onChange={handleMicroChange}
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="micro-maxAmount">Monto Máximo (₡)</Label>
                  <Input
                    id="maxAmount"
                    type="number"
                    value={microConfig.maxAmount}
                    onChange={handleMicroChange}
                    className="font-mono"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="micro-interestRate">
                  Tasa de Interés Anual (%)
                </Label>
                <Input
                  id="interestRate"
                  type="number"
                  value={microConfig.interestRate}
                  onChange={handleMicroChange}
                  className="font-mono"
                  placeholder='35.5'
                />
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
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={() => handleSave('Micro-crédito')}>Guardar Cambios</Button>
            </CardFooter>
          </Card>
        </div>
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
                          value={newUser.role}
                          onValueChange={(value) => setNewUser({ ...newUser, role: value })}
                        >
                          <SelectTrigger id="role">
                            <SelectValue placeholder="Seleccionar rol" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Sin Rol Asignado">Sin Rol Asignado</SelectItem>
                            <SelectItem value="Administrador">Administrador</SelectItem>
                            <SelectItem value="Colaborador">Colaborador</SelectItem>
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
                      <TableCell>{user.role || 'Sin Rol Asignado'}</TableCell>
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
  );
}