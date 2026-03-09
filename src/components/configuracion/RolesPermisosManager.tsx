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
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, MoreHorizontal, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/auth-guard';
import { API_BASE_URL } from '@/lib/env';

interface Permission {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  archive?: boolean;
  assign?: boolean;
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
  permissions?: ('view' | 'create' | 'edit' | 'delete' | 'archive' | 'assign')[];
  customPermissionLabels?: {
    view?: string;
    create?: string;
    edit?: string;
    delete?: string;
    archive?: string;
    assign?: string;
  };
}

const MODULES: Module[] = [
  { key: 'reportes', label: 'Reportes', permissions: ['view'] },
  { key: 'kpis', label: 'KPIs', permissions: ['view'] },
  { key: 'crm', label: 'CRM (Leads)', permissions: ['view', 'create', 'edit', 'delete', 'archive'] },
  { key: 'oportunidades', label: 'Oportunidades', permissions: ['view', 'create', 'edit', 'delete'] },
  {
    key: 'analizados', label: 'Analizados',
    permissions: ['view', 'create', 'edit', 'delete', 'archive', 'assign'],
    customPermissionLabels: { delete: 'Estado PEP', archive: 'Estado Cliente', assign: 'Responsable' }
  },
  { key: 'creditos', label: 'Créditos', permissions: ['view', 'create', 'edit', 'delete'] },
  { key: 'calculos', label: 'Cálculos', permissions: ['view'] },
  {
    key: 'cobros', label: 'Cobros',
    permissions: ['view', 'create', 'edit', 'delete'],
    customPermissionLabels: { create: 'Registrar Abono', edit: 'Cargar Planilla', delete: 'Exportar' }
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
  {
    key: 'tareas', label: 'Tareas',
    permissions: ['view'],
    customPermissionLabels: { view: 'Ver todas' }
  },
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
    name: '', description: '', full_access: false, permissions: {},
  });

  const initializePermissions = (): RolePermissions => {
    const perms: RolePermissions = {};
    MODULES.forEach(module => {
      perms[module.key] = { view: false, create: false, edit: false, delete: false, archive: false, assign: false };
    });
    return perms;
  };

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/roles`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setRoles(data);
      } else {
        throw new Error('Failed to fetch roles');
      }
    } catch (err) {
      console.error('Error fetching roles:', err);
      toast({ title: 'Error', description: 'No se pudieron cargar los roles.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRoles(); }, []);

  const openCreateDialog = () => {
    setEditingRole(null);
    setRoleForm({ name: '', description: '', full_access: false, permissions: initializePermissions() });
    setIsDialogOpen(true);
  };

  const openEditDialog = (role: Role) => {
    setEditingRole(role);
    const basePermissions = initializePermissions();
    const completePermissions: RolePermissions = {};
    Object.keys(basePermissions).forEach(moduleKey => {
      completePermissions[moduleKey] = { ...basePermissions[moduleKey], ...(role.permissions[moduleKey] || {}) };
    });
    setRoleForm({ ...role, permissions: completePermissions });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingRole(null);
    setRoleForm({ name: '', description: '', full_access: false, permissions: {} });
  };

  const handlePermissionChange = (moduleKey: string, permType: 'view' | 'create' | 'edit' | 'delete' | 'archive' | 'assign', value: boolean) => {
    setRoleForm(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [moduleKey]: {
          ...(prev.permissions[moduleKey] || { view: false, create: false, edit: false, delete: false, archive: false, assign: false }),
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
          assign: enabled && modulePermissions.includes('assign'),
        },
      },
    }));
  };

  const handleFullAccessToggle = (enabled: boolean) => {
    if (enabled) {
      const allPerms: RolePermissions = {};
      MODULES.forEach(module => {
        const modulePermissions = module.permissions || ['view', 'create', 'edit', 'delete'];
        allPerms[module.key] = {
          view: modulePermissions.includes('view'),
          create: modulePermissions.includes('create'),
          edit: modulePermissions.includes('edit'),
          delete: modulePermissions.includes('delete'),
          archive: modulePermissions.includes('archive'),
          assign: modulePermissions.includes('assign'),
        };
      });
      setRoleForm(prev => ({ ...prev, full_access: true, permissions: allPerms }));
    } else {
      setRoleForm(prev => ({ ...prev, full_access: false }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleForm.name.trim()) {
      toast({ title: 'Error', description: 'El nombre del rol es obligatorio.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const url = editingRole ? `${API_BASE_URL}/roles/${editingRole.id}` : `${API_BASE_URL}/roles`;
      const method = editingRole ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(roleForm),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Error al guardar el rol');
      }

      toast({ title: editingRole ? 'Actualizado' : 'Creado', description: editingRole ? 'Rol actualizado correctamente.' : 'Rol creado correctamente.' });
      closeDialog();
      fetchRoles();
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Error', description: err.message || 'No se pudo guardar el rol.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (role: Role) => {
    if (!confirm(`¿Eliminar el rol "${role.name}"?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/roles/${role.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Error al eliminar el rol');
      }
      toast({ title: 'Eliminado', description: 'Rol eliminado correctamente.' });
      fetchRoles();
    } catch (err: any) {
      console.error('Error deleting role:', err);
      toast({ title: 'Error', description: err.message || 'No se pudo eliminar el rol.', variant: 'destructive' });
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
                <DialogDescription>Define el nombre del rol y asigna los permisos correspondientes.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="role-name">Nombre del rol</Label>
                    <Input id="role-name" value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} placeholder="Ej: Abogado" required disabled={saving} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role-description">Descripción</Label>
                    <Input id="role-description" value={roleForm.description} onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })} placeholder="Ej: Rol jurídico con control completo sobre módulos legales." disabled={saving} />
                  </div>
                </div>

                <div className="flex items-start space-x-3 rounded-md border p-4 bg-muted/20">
                  <input type="checkbox" id="full-access" checked={roleForm.full_access} onChange={(e) => handleFullAccessToggle(e.target.checked)} disabled={saving} className="h-5 w-5 mt-0.5" />
                  <div className="flex-1">
                    <Label htmlFor="full-access" className="text-base font-medium cursor-pointer">Acceso total al panel</Label>
                    <p className="text-sm text-muted-foreground mt-1">Si está activo, no necesitas marcar permisos manualmente.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-base">Permisos por Módulo</Label>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-[40px]"><input type="checkbox" className="h-4 w-4" disabled /></TableHead>
                          <TableHead className="font-semibold">Módulo</TableHead>
                          <TableHead className="text-center font-semibold w-[100px]">Ver</TableHead>
                          <TableHead className="text-center font-semibold w-[100px]">Crear</TableHead>
                          <TableHead className="text-center font-semibold w-[100px]">Editar</TableHead>
                          <TableHead className="text-center font-semibold w-[100px]">Eliminar</TableHead>
                          <TableHead className="text-center font-semibold w-[100px]">Archivar</TableHead>
                          <TableHead className="text-center font-semibold w-[100px]">Asignar</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {MODULES.map((module) => {
                          const perms = roleForm.permissions[module.key] || { view: false, create: false, edit: false, delete: false, archive: false };
                          const modulePermissions = module.permissions || ['view', 'create', 'edit', 'delete'];
                          const isModuleEnabled = perms.view || perms.create || perms.edit || perms.delete || perms.archive || perms.assign;

                          const renderPermCell = (permType: 'view' | 'create' | 'edit' | 'delete' | 'archive' | 'assign') => {
                            if (!modulePermissions.includes(permType)) return <span className="text-muted-foreground">-</span>;
                            return (
                              <div className="flex flex-col items-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={(perms as any)[permType] || false}
                                  onChange={(e) => handlePermissionChange(module.key, permType, e.target.checked)}
                                  disabled={saving || roleForm.full_access}
                                  className="h-4 w-4"
                                />
                                {module.customPermissionLabels?.[permType] && (
                                  <span className="text-[10px] text-muted-foreground">{module.customPermissionLabels[permType]}</span>
                                )}
                              </div>
                            );
                          };

                          return (
                            <TableRow key={module.key}>
                              <TableCell>
                                <input type="checkbox" checked={isModuleEnabled} onChange={(e) => handleModuleToggle(module.key, e.target.checked)} disabled={saving || roleForm.full_access} className="h-4 w-4" />
                              </TableCell>
                              <TableCell className="font-medium">{module.label}</TableCell>
                              <TableCell className="text-center">{renderPermCell('view')}</TableCell>
                              <TableCell className="text-center">{renderPermCell('create')}</TableCell>
                              <TableCell className="text-center">{renderPermCell('edit')}</TableCell>
                              <TableCell className="text-center">{renderPermCell('delete')}</TableCell>
                              <TableCell className="text-center">{renderPermCell('archive')}</TableCell>
                              <TableCell className="text-center">{renderPermCell('assign')}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={closeDialog} disabled={saving}>Cancelar</Button>
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
                  <TableCell colSpan={4} className="text-center text-muted-foreground">No hay roles registrados.</TableCell>
                </TableRow>
              ) : (
                roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell className="text-muted-foreground">{role.description}</TableCell>
                    <TableCell>
                      {role.full_access ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">Sí</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">No</span>
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
                          <DropdownMenuItem onClick={() => openEditDialog(role)}>Editar</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(role)}>Eliminar</DropdownMenuItem>
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

export default RolesPermisosManager;
