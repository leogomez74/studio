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
// Table imports kept for the roles list below
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
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';

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

interface ModuleGroup {
  group: string;
  modules: Module[];
}

const MODULE_GROUPS: ModuleGroup[] = [
  {
    group: 'Ventas',
    modules: [
      {
        // Ver leads/clientes, crear, editar, eliminar, archivar
        key: 'crm', label: 'CRM (Leads y Clientes)',
        permissions: ['view', 'create', 'edit', 'archive'],
        customPermissionLabels: { archive: 'Archivar' },
      },
      {
        // Ver oportunidades, crear, editar, archivar — eliminar no aplica en oportunidades
        key: 'oportunidades', label: 'Oportunidades',
        permissions: ['view', 'create', 'edit', 'archive'],
        customPermissionLabels: { archive: 'Archivar' },
      },
      {
        // Permisos repropósito: delete=Estado PEP, archive=Estado Cliente, assign=Responsable
        key: 'analizados', label: 'Analizados',
        permissions: ['view', 'create', 'edit', 'delete', 'archive', 'assign'],
        customPermissionLabels: { delete: 'Estado PEP', archive: 'Estado Cliente', assign: 'Responsable' },
      },
      {
        // Ver, crear, editar créditos — eliminar no aplica (registro financiero permanente)
        key: 'creditos', label: 'Créditos',
        permissions: ['view', 'create', 'edit'],
      },
      {
        // Solo visualizar la calculadora
        key: 'calculos', label: 'Cálculos',
        permissions: ['view'],
      },
    ],
  },
  {
    group: 'Finanzas',
    modules: [
      {
        // Acciones específicas de cobros, cada permiso tiene función propia
        key: 'cobros', label: 'Cobros',
        permissions: ['view', 'create', 'edit', 'delete', 'archive', 'assign'],
        customPermissionLabels: {
          create: 'Registrar Abono',
          edit: 'Cargar Planilla',
          delete: 'Exportar',
          archive: 'Anular Abono',
          assign: 'Reintegro de Saldo',
        },
      },
      {
        // Cobro judicial: ver, gestionar expedientes, editar estado, eliminar
        key: 'cobro_judicial', label: 'Cobro Judicial',
        permissions: ['view', 'create', 'edit', 'delete'],
        customPermissionLabels: { create: 'Abrir expediente', delete: 'Cerrar expediente' },
      },
      {
        // Solo visualizar módulo de ventas
        key: 'ventas', label: 'Ventas',
        permissions: ['view'],
      },
      {
        // Inversiones: ver, crear, editar — archivar cuando se cierra una inversión
        key: 'inversiones', label: 'Inversiones',
        permissions: ['view', 'create', 'edit', 'archive'],
        customPermissionLabels: { archive: 'Cerrar inversión' },
      },
      {
        // Reportes: ver y exportar
        key: 'reportes', label: 'Reportes',
        permissions: ['view', 'create'],
        customPermissionLabels: { create: 'Exportar' },
      },
    ],
  },
  {
    group: 'Operaciones',
    modules: [
      {
        // KPIs: solo visualización
        key: 'kpis', label: 'KPIs',
        permissions: ['view'],
      },
      {
        // Rutas: ver, crear, editar y eliminar rutas del día
        key: 'rutas', label: 'Rutas',
        permissions: ['view', 'create', 'edit', 'delete'],
      },
      {
        // Tareas: ver todas, crear, editar, eliminar, archivar
        key: 'tareas', label: 'Tareas',
        permissions: ['view', 'create', 'edit', 'delete', 'archive'],
        customPermissionLabels: { view: 'Ver todas' },
      },
      {
        // Comunicaciones: ver mensajes, enviar — eliminar no aplica
        key: 'comunicaciones', label: 'Comunicaciones',
        permissions: ['view', 'create'],
        customPermissionLabels: { create: 'Enviar mensaje' },
      },
    ],
  },
  {
    group: 'Equipo',
    modules: [
      {
        // Colaboradores: gestión completa de staff
        key: 'staff', label: 'Colaboradores',
        permissions: ['view', 'create', 'edit', 'delete'],
      },
      {
        // Entrenamiento: solo visualización de materiales
        key: 'entrenamiento', label: 'Entrenamiento',
        permissions: ['view'],
      },
      {
        // Recompensas: ver, crear, editar y eliminar recompensas del sistema
        key: 'recompensas', label: 'Recompensas',
        permissions: ['view', 'create', 'edit', 'delete'],
      },
    ],
  },
  {
    group: 'Sistema',
    modules: [
      {
        // Auditoría: solo lectura (bitácora inmutable)
        key: 'auditoria', label: 'Auditoría',
        permissions: ['view'],
      },
      {
        // Incidencias: ver, reportar, editar estado, eliminar
        key: 'incidencias', label: 'Incidencias',
        permissions: ['view', 'create', 'edit', 'delete'],
        customPermissionLabels: { create: 'Reportar' },
      },
    ],
  },
  {
    group: 'Configuración',
    modules: [
      {
        // Préstamos, tasas y productos: gestión completa
        key: 'config_general', label: 'Config: Préstamos, Tasas y Productos',
        permissions: ['view', 'create', 'edit', 'delete'],
      },
      {
        // Patronos, deductoras, empresas, instituciones
        key: 'config_personas', label: 'Config: Patronos, Deductoras, Empresas e Instituciones',
        permissions: ['view', 'create', 'edit', 'delete'],
      },
      {
        // Usuarios y roles: gestión completa
        key: 'config_usuarios', label: 'Config: Usuarios y Roles',
        permissions: ['view', 'create', 'edit', 'delete'],
      },
      {
        // Contabilidad ERP: ver, crear cuentas, editar, eliminar mapeos
        key: 'config_contabilidad', label: 'Config: Contabilidad ERP',
        permissions: ['view', 'create', 'edit', 'delete'],
      },
      {
        // Integraciones, API tokens, flujos, etiquetas
        key: 'config_sistema', label: 'Config: Integraciones, API Tokens, Flujos y Etiquetas',
        permissions: ['view', 'create', 'edit', 'delete'],
      },
    ],
  },
];

// Flat list para compatibilidad con lógica existente
const MODULES: Module[] = MODULE_GROUPS.flatMap(g => g.modules);

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
                  <div className="border rounded-lg overflow-auto max-h-[450px] divide-y">
                    {MODULE_GROUPS.map((group) => (
                      <div key={group.group}>
                        {/* Encabezado de grupo */}
                        <div className="bg-muted px-4 py-2 sticky top-0 z-10">
                          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{group.group}</span>
                        </div>
                        {/* Filas de módulos */}
                        {group.modules.map((module) => {
                          const perms = roleForm.permissions[module.key] || { view: false, create: false, edit: false, delete: false, archive: false, assign: false };
                          const modulePermissions = module.permissions || ['view', 'create', 'edit', 'delete'];
                          const isModuleEnabled = perms.view || perms.create || perms.edit || perms.delete || perms.archive || perms.assign;

                          const defaultLabels: Record<string, string> = {
                            view: 'Ver', create: 'Crear', edit: 'Editar',
                            delete: 'Eliminar', archive: 'Archivar', assign: 'Asignar',
                          };

                          // Para tareas: chips especiales de visibilidad (mutuamente excluyentes)
                          const isTareas = module.key === 'tareas';
                          const tareasVerPropias = isModuleEnabled && !perms.view;
                          const tareasVerTodas = perms.view;

                          return (
                            <div key={module.key} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/10">
                              {/* Toggle módulo completo */}
                              <input
                                type="checkbox"
                                checked={isModuleEnabled}
                                onChange={(e) => handleModuleToggle(module.key, e.target.checked)}
                                disabled={saving || roleForm.full_access}
                                className="h-4 w-4 shrink-0 cursor-pointer"
                              />
                              {/* Nombre del módulo */}
                              <span className="w-56 shrink-0 text-sm font-medium">{module.label}</span>
                              {/* Chips de permisos */}
                              <div className="flex flex-wrap gap-2">
                                {isTareas ? (
                                  <>
                                    {/* Chip: Solo ver propias — activo si módulo habilitado y view=false */}
                                    <label className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer select-none transition-colors ${
                                      saving || roleForm.full_access ? 'opacity-50 cursor-not-allowed' : ''
                                    } ${
                                      tareasVerPropias
                                        ? 'bg-amber-500 text-white border-amber-500'
                                        : 'bg-background text-muted-foreground border-border hover:border-amber-400/50'
                                    }`}>
                                      <input type="radio" name={`tareas-vis-${module.key}`} className="sr-only"
                                        checked={tareasVerPropias}
                                        disabled={saving || roleForm.full_access}
                                        onChange={() => {
                                          // Habilitar módulo + view=false
                                          setRoleForm(prev => ({
                                            ...prev,
                                            permissions: {
                                              ...prev.permissions,
                                              tareas: { ...(prev.permissions['tareas'] || {}), view: false, create: prev.permissions['tareas']?.create || false, edit: prev.permissions['tareas']?.edit || false, delete: prev.permissions['tareas']?.delete || false, archive: prev.permissions['tareas']?.archive || false, assign: false },
                                            },
                                          }));
                                        }}
                                      />
                                      Ver propias
                                    </label>
                                    {/* Chip: Ver todas — activo si view=true */}
                                    <label className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer select-none transition-colors ${
                                      saving || roleForm.full_access ? 'opacity-50 cursor-not-allowed' : ''
                                    } ${
                                      tareasVerTodas
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                                    }`}>
                                      <input type="radio" name={`tareas-vis-${module.key}`} className="sr-only"
                                        checked={tareasVerTodas}
                                        disabled={saving || roleForm.full_access}
                                        onChange={() => handlePermissionChange('tareas', 'view', true)}
                                      />
                                      Ver todas
                                    </label>
                                    {/* Resto de chips normales (crear, editar, etc.) */}
                                    {modulePermissions.filter(p => p !== 'view').map((permType) => {
                                      const pt = permType as 'create' | 'edit' | 'delete' | 'archive' | 'assign';
                                      const label = module.customPermissionLabels?.[pt] ?? defaultLabels[pt];
                                      const checked = perms[pt] || false;
                                      return (
                                        <label key={pt} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer select-none transition-colors ${
                                          saving || roleForm.full_access ? 'opacity-50 cursor-not-allowed' : ''
                                        } ${checked ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary/50'}`}>
                                          <input type="checkbox" checked={checked} onChange={(e) => handlePermissionChange('tareas', pt, e.target.checked)} disabled={saving || roleForm.full_access} className="sr-only" />
                                          {label}
                                        </label>
                                      );
                                    })}
                                  </>
                                ) : (
                                  modulePermissions.map((permType) => {
                                    const pt = permType as 'view' | 'create' | 'edit' | 'delete' | 'archive' | 'assign';
                                    const label = module.customPermissionLabels?.[pt] ?? defaultLabels[pt];
                                    const checked = perms[pt] || false;
                                    return (
                                      <label key={pt} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer select-none transition-colors ${
                                        saving || roleForm.full_access ? 'opacity-50 cursor-not-allowed' : ''
                                      } ${checked ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary/50'}`}>
                                        <input type="checkbox" checked={checked} onChange={(e) => handlePermissionChange(module.key, pt, e.target.checked)} disabled={saving || roleForm.full_access} className="sr-only" />
                                        {label}
                                      </label>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
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
