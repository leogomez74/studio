'use client';

import React from 'react';
import { usePermissions } from '@/contexts/PermissionsContext';
import { Button } from '@/components/ui/button';
import type { ButtonProps } from '@/components/ui/button';

interface PermissionButtonProps extends ButtonProps {
  module: string;
  action: 'create' | 'edit' | 'delete';
  children: React.ReactNode;
}

export function PermissionButton({
  module,
  action,
  children,
  ...buttonProps
}: PermissionButtonProps) {
  const { hasPermission, loading } = usePermissions();

  // No mostrar el botón si no tiene permiso
  if (loading) return null;
  if (!hasPermission(module, action)) return null;

  return <Button {...buttonProps}>{children}</Button>;
}
