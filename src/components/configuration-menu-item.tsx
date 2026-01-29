'use client';

import Link from 'next/link';
import { Settings } from 'lucide-react';
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { usePermissions } from '@/contexts/PermissionsContext';

export function ConfigurationMenuItem() {
  const { canViewModule } = usePermissions();

  // Only show configuration if user has permission
  if (!canViewModule('configuracion')) {
    return null;
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild tooltip="Configuración" className="h-9 px-3 rounded-lg hover:bg-blue-900/30">
          <Link href="/dashboard/configuracion" className="flex items-center gap-3">
            <Settings className="h-4 w-4" />
            <span className="text-sm font-medium">Configuración</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
