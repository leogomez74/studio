'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-guard';
import { API_BASE_URL } from '@/lib/env';

export interface ModulePermissions {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  archive?: boolean;
}

export interface UserPermissions {
  [moduleKey: string]: ModulePermissions;
}

interface PermissionsContextType {
  permissions: UserPermissions;
  loading: boolean;
  hasPermission: (module: string, action: 'view' | 'create' | 'edit' | 'delete' | 'archive') => boolean;
  canViewModule: (module: string) => boolean;
  refreshPermissions: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  const [permissions, setPermissions] = useState<UserPermissions>({});
  const [loading, setLoading] = useState(true);

  const fetchPermissions = async () => {
    if (!token || !user) {
      setPermissions({});
      setLoading(false);
      return;
    }

    try {
      // Obtener el usuario con su rol y permisos
      const res = await fetch(`${API_BASE_URL}/users/${user.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (res.ok) {
        const userData = await res.json();
        console.log('User data received:', userData);

        if (userData.role) {
          // Si tiene rol, obtener los detalles del rol con permisos
          const roleRes = await fetch(`${API_BASE_URL}/roles/${userData.role.id}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
            },
          });

          if (roleRes.ok) {
            const roleData = await roleRes.json();
            const perms = roleData.permissions || {};
            console.log('=== PERMISSIONS LOADED ===');
            console.log('Role data:', roleData);
            console.log('Permissions:', perms);
            console.log('CRM permissions:', perms.crm);
            setPermissions(perms);
          } else {
            console.error('Role fetch failed:', roleRes.status);
            setPermissions({});
          }
        } else {
          console.log('User has no role assigned');
          // Sin rol asignado = sin permisos
          setPermissions({});
        }
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
      setPermissions({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, [token, user?.id]);

  const hasPermission = (module: string, action: 'view' | 'create' | 'edit' | 'delete' | 'archive'): boolean => {
    // Solo permitir visualización durante la carga para evitar flickering
    // Pero NO permitir acciones como create, edit, delete, archive
    if (loading) {
      return action === 'view';
    }

    if (!permissions[module]) {
      console.log(`[Permission Check] Module "${module}" not found in permissions`);
      return false;
    }

    const modulePerms = permissions[module];
    let result = false;

    switch (action) {
      case 'view':
        result = modulePerms.view;
        break;
      case 'create':
        result = modulePerms.create;
        break;
      case 'edit':
        result = modulePerms.edit;
        break;
      case 'delete':
        result = modulePerms.delete;
        break;
      case 'archive':
        result = modulePerms.archive ?? false;
        break;
      default:
        result = false;
    }

    console.log(`[Permission Check] module="${module}", action="${action}", result=${result}`, modulePerms);
    return result;
  };

  const canViewModule = (module: string): boolean => {
    // Mientras se cargan los permisos, permitir todo para evitar flickering
    if (loading) return true;

    return hasPermission(module, 'view');
  };

  const refreshPermissions = async () => {
    setLoading(true);
    await fetchPermissions();
  };

  return (
    <PermissionsContext.Provider
      value={{
        permissions,
        loading,
        hasPermission,
        canViewModule,
        refreshPermissions,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
}
