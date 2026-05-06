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
  assign?: boolean;
  formalizar?: boolean;
  formalizar_admin?: boolean;
  autoaplicar_abono?: boolean;
}

export interface UserPermissions {
  [moduleKey: string]: ModulePermissions;
}

interface PermissionsContextType {
  permissions: UserPermissions;
  loading: boolean;
  hasPermission: (module: string, action: 'view' | 'create' | 'edit' | 'delete' | 'archive' | 'assign' | 'formalizar' | 'formalizar_admin' | 'autoaplicar_abono') => boolean;
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
      // Obtener permisos directamente del endpoint /me (no requiere admin)
      const res = await fetch(`${API_BASE_URL}/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        const perms = data.permissions || {};
        setPermissions(perms);
      } else {
        console.error('Permissions fetch failed:', res.status);
        setPermissions({});
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

  const hasPermission = (module: string, action: 'view' | 'create' | 'edit' | 'delete' | 'archive' | 'assign' | 'formalizar' | 'formalizar_admin'): boolean => {
    // Solo permitir visualización durante la carga para evitar flickering
    // Pero NO permitir acciones como create, edit, delete, archive
    if (loading) {
      return action === 'view';
    }

    if (!permissions[module]) {
      return false;
    }

    const modulePerms = permissions[module];

    switch (action) {
      case 'view':
        return modulePerms.view;
      case 'create':
        return modulePerms.create;
      case 'edit':
        return modulePerms.edit;
      case 'delete':
        return modulePerms.delete;
      case 'archive':
        return modulePerms.archive ?? false;
      case 'assign':
        return modulePerms.assign ?? false;
      case 'formalizar':
        return modulePerms.formalizar ?? false;
      case 'formalizar_admin':
        return modulePerms.formalizar_admin ?? false;
      case 'autoaplicar_abono':
        return modulePerms.autoaplicar_abono ?? false;
      default:
        return false;
    }
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
