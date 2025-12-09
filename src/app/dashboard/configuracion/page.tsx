'use client';
import React, { useState, useEffect } from 'react';
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
import { patronos, Patrono, deductoras, Deductora, creditConfigs } from '@/lib/data';
import { API_BASE_URL } from '@/lib/env';
import { useAuth } from '@/components/auth-guard';

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
  });

  useEffect(() => {
    if (token) {
      fetchUsers();
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
      const res = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(newUser),
      });

      if (res.ok) {
        toast({
          title: "Usuario Creado",
          description: "El usuario ha sido registrado exitosamente.",
        });
        setIsCreateUserOpen(false);
        setNewUser({ name: '', email: '', password: '', password_confirmation: '' });
        fetchUsers();
      } else {
        const errorData = await res.json();
        toast({
          title: "Error al crear usuario",
          description: errorData.message || "Ocurrió un error inesperado.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error creating user:', error);
      toast({
        title: "Error de conexión",
        description: "No se pudo conectar con el servidor.",
        variant: "destructive",
      });
    } finally {
      setCreatingUser(false);
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

  return (
    <Tabs defaultValue="prestamos">
      <TabsList className="mb-4">
        <TabsTrigger value="prestamos">Préstamos</TabsTrigger>
        <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
        <TabsTrigger value="patronos">Patronos</TabsTrigger>
        <TabsTrigger value="deductoras">Deductoras</TabsTrigger>
        <TabsTrigger value="api">API ERP</TabsTrigger>
      </TabsList>
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
                  Tasa de Interés Anual (%)
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
                  <Button size="sm" className="gap-1">
                    <PlusCircle className="h-4 w-4" />
                    Agregar Usuario
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Agregar Nuevo Usuario</DialogTitle>
                    <DialogDescription>
                      Ingresa los datos del nuevo usuario. Todos los campos son obligatorios.
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
                    <DialogFooter>
                      <Button type="submit" disabled={creatingUser}>
                        {creatingUser && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Crear Usuario
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
                    <TableHead>Fecha Creación</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
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
                            <DropdownMenuItem>Editar</DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600">Eliminar</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
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
               <Button size="sm" className="gap-1">
                    <PlusCircle className="h-4 w-4" />
                    Agregar Deductora
                </Button>
            </div>
          </CardHeader>
          <CardContent>
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
                {deductoras.map((deductora) => (
                  <TableRow key={deductora.id}>
                    <TableCell className="font-medium">{deductora.name}</TableCell>
                    <TableCell>{deductora.paymentDate}</TableCell>
                    <TableCell className="text-right font-mono">{(deductora.commission || 0).toFixed(2)}%</TableCell>
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
