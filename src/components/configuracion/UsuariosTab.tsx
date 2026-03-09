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
import { useAuth } from '@/components/auth-guard';
import { API_BASE_URL } from '@/lib/env';

const UsuariosTab: React.FC = () => {
  const { toast } = useToast();
  const { token } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '', email: '', password: '', password_confirmation: '',
    role_id: 'none', status: 'Activo', monto_max_aprobacion: -1,
  });
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [availableRoles, setAvailableRoles] = useState<any[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);

  useEffect(() => {
    if (token) { fetchUsers(); fetchRoles(); }
  }, [token]);

  const fetchRoles = async () => {
    setLoadingRoles(true);
    try {
      const res = await fetch(`${API_BASE_URL}/roles`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (res.ok) { setAvailableRoles(await res.json()); }
    } catch (error) { console.error('Error fetching roles:', error); }
    finally { setLoadingRoles(false); }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch(`${API_BASE_URL}/users`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (res.ok) { setUsers(await res.json()); }
    } catch (error) { console.error('Error fetching users:', error); }
    finally { setLoadingUsers(false); }
  };

  const openCreateUserDialog = () => {
    setEditingUser(null);
    setNewUser({ name: '', email: '', password: '', password_confirmation: '', role_id: 'none', status: 'Activo', monto_max_aprobacion: -1 });
    setIsCreateUserOpen(true);
  };

  const openEditUserDialog = (user: any) => {
    setEditingUser(user);
    setNewUser({
      name: user.name || '', email: user.email || '', password: '', password_confirmation: '',
      role_id: user.role_id ? user.role_id.toString() : 'none',
      status: user.status || 'Activo', monto_max_aprobacion: user.monto_max_aprobacion ?? -1,
    });
    setIsCreateUserOpen(true);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newUser.password !== newUser.password_confirmation) {
      toast({ title: 'Error de validación', description: 'Las contraseñas no coinciden.', variant: 'destructive' });
      return;
    }
    setCreatingUser(true);
    try {
      const method = editingUser ? 'PUT' : 'POST';
      const url = editingUser ? `${API_BASE_URL}/users/${editingUser.id}` : `${API_BASE_URL}/users`;
      const payload = { ...newUser, role_id: newUser.role_id === 'none' ? null : parseInt(newUser.role_id) };

      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast({ title: editingUser ? 'Usuario Actualizado' : 'Usuario Creado', description: editingUser ? 'El usuario ha sido actualizado.' : 'El usuario ha sido registrado exitosamente.' });
        setIsCreateUserOpen(false);
        setEditingUser(null);
        setNewUser({ name: '', email: '', password: '', password_confirmation: '', role_id: 'none', status: 'Activo', monto_max_aprobacion: -1 });
        fetchUsers();
      } else {
        const errorData = await res.json();
        toast({ title: editingUser ? 'Error al actualizar usuario' : 'Error al crear usuario', description: errorData.message || 'Ocurrió un error inesperado.', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error saving user:', error);
      toast({ title: 'Error de conexión', description: 'No se pudo conectar con el servidor.', variant: 'destructive' });
    } finally { setCreatingUser(false); }
  };

  const handleDeleteUser = async (user: any) => {
    if (!confirm(`¿Eliminar al usuario "${user.name}"?`)) return;
    try {
      await fetch(`${API_BASE_URL}/users/${user.id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
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
      const payload = { role_id: roleId === 'none' ? null : parseInt(roleId) };
      const res = await fetch(`${API_BASE_URL}/users/${userId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast({ title: 'Rol actualizado', description: 'El rol del usuario ha sido actualizado correctamente.' });
        fetchUsers();
      } else {
        const errorData = await res.json();
        toast({ title: 'Error al actualizar rol', description: errorData.message || 'Ocurrió un error inesperado.', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error updating user role:', error);
      toast({ title: 'Error de conexión', description: 'No se pudo conectar con el servidor.', variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Usuarios del Sistema</CardTitle>
            <CardDescription>Administra los usuarios que tienen acceso al panel.</CardDescription>
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
                  {editingUser ? 'Modifica los datos del usuario. La contraseña es opcional.' : 'Ingresa los datos del nuevo usuario. Todos los campos son obligatorios.'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre Completo</Label>
                  <Input id="name" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Correo Electrónico</Label>
                  <Input id="email" type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input id="password" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} required={!editingUser} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password_confirmation">Confirmar Contraseña</Label>
                  <Input id="password_confirmation" type="password" value={newUser.password_confirmation} onChange={(e) => setNewUser({ ...newUser, password_confirmation: e.target.value })} required={!editingUser} />
                  {editingUser && <p className="text-xs text-muted-foreground">Dejar en blanco para conservar la contraseña actual</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="role">Rol</Label>
                    <Select value={newUser.role_id} onValueChange={(value) => setNewUser({ ...newUser, role_id: value })}>
                      <SelectTrigger id="role"><SelectValue placeholder="Seleccionar rol" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin Rol Asignado</SelectItem>
                        {loadingRoles ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">Cargando roles...</div>
                        ) : (
                          availableRoles.map((role) => (
                            <SelectItem key={role.id} value={role.id.toString()}>{role.name}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Estado</Label>
                    <Select value={newUser.status} onValueChange={(value) => setNewUser({ ...newUser, status: value })}>
                      <SelectTrigger id="status"><SelectValue placeholder="Seleccionar estado" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Activo">Activo</SelectItem>
                        <SelectItem value="Suspendido">Suspendido</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="monto_max_aprobacion">Monto Máximo de Aprobación (₡)</Label>
                  <Input id="monto_max_aprobacion" type="number" step="0.01" value={newUser.monto_max_aprobacion} onChange={(e) => setNewUser({ ...newUser, monto_max_aprobacion: parseFloat(e.target.value) || -1 })} placeholder="-1" />
                  <p className="text-xs text-muted-foreground">-1 = Sin límite (puede aprobar cualquier monto). Para restringir, ingrese el monto máximo que puede aprobar.</p>
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
                    <Select value={user.role_id ? user.role_id.toString() : 'none'} onValueChange={(value) => handleUpdateUserRole(user.id, value)} disabled={loadingRoles}>
                      <SelectTrigger className="w-[180px] h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin Rol Asignado</SelectItem>
                        {availableRoles.map((role) => (
                          <SelectItem key={role.id} value={role.id.toString()}>{role.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${user.status === 'Activo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
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
                  <TableCell colSpan={7} className="text-center text-muted-foreground">No hay usuarios registrados.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default UsuariosTab;
