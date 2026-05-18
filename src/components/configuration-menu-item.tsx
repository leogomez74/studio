'use client';

import Link from 'next/link';
import { Settings } from 'lucide-react';
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { usePermissions } from '@/contexts/PermissionsContext';

export function ConfigurationMenuItem() {
  const { canViewModule } = usePermissions();

  // Only show configuration if user has permission to ANY config tab
  const CONFIG_MODULES = [
    'config_prestamos', 'config_tasas', 'config_productos', 'config_poliza', 'config_embargo',
    'config_usuarios', 'config_roles',
    'config_patronos', 'config_deductoras', 'config_empresas', 'config_instituciones',
    'profesiones', 'config_contabilidad',
    'config_tareas_auto', 'config_workflows', 'config_labels',
    'config_integraciones', 'config_api_tokens', 'config_whatsapp',
    // Legacy keys
    'config_general', 'config_personas', 'config_sistema',
  ];
  const canSeeConfig = CONFIG_MODULES.some(m => canViewModule(m));
  if (!canSeeConfig) {
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
