'use client';

import Link from 'next/link';
import { User, LogOut, Settings } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { useAuth } from '@/components/auth-guard';
import { usePermissions } from '@/contexts/PermissionsContext';

const CONFIG_MODULES = ['config_general', 'config_personas', 'config_usuarios', 'config_contabilidad', 'config_sistema'];

export function SidebarUserMenu() {
  const { user, logout } = useAuth();
  const { canViewModule } = usePermissions();
  const canSeeConfig = CONFIG_MODULES.some(m => canViewModule(m));

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              tooltip={user?.name || 'Usuario'}
              className="h-10 px-3 rounded-lg hover:bg-blue-900/30"
            >
              <div className="flex items-center gap-3 w-full">
                <Avatar className="h-7 w-7">
                  <AvatarImage
                    src="https://picsum.photos/seed/admin-avatar/40/40"
                    alt={user?.name || 'Usuario'}
                  />
                  <AvatarFallback>
                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start text-left min-w-0 flex-1">
                  <span className="text-sm font-medium truncate w-full">
                    {user?.name || 'Usuario'}
                  </span>
                  <span className="text-xs text-muted-foreground truncate w-full">
                    {user?.email || 'cargando...'}
                  </span>
                </div>
              </div>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuLabel>
              <p>{user?.name || 'Usuario'}</p>
              <p className="text-xs font-normal text-muted-foreground">
                {user?.email || 'cargando...'}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              <span>Perfil</span>
            </DropdownMenuItem>
            {canSeeConfig && (
              <DropdownMenuItem asChild>
                <Link href="/dashboard/configuracion">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Configuración</span>
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => logout()}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Cerrar sesión</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
