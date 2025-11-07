'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  Home,
  ChevronRight,
  Search,
  User as UserIcon,
  LogOut,
  Settings,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { notifications } from '@/lib/data';
import { cn } from '@/lib/utils';

function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  return (
    <nav className="hidden items-center gap-2 text-sm font-medium md:flex">
      {segments.length > 0 && (
        <Link
          href="/dashboard"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <Home className="h-4 w-4" />
        </Link>
      )}
      {segments.map((segment, index) => {
        const href = '/' + segments.slice(0, index + 1).join('/');
        const isLast = index === segments.length - 1;
        // Decode URI component and replace dashes for display
        const segmentDisplay = decodeURIComponent(segment).replace(/-/g, ' ');

        return (
          <div key={href} className="flex items-center gap-2">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <Link
              href={href}
              className={cn(
                'capitalize transition-colors',
                isLast
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {segmentDisplay}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}

export function DashboardHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur-sm md:px-6">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="md:hidden" />
        <Breadcrumbs />
      </div>

      <div className="flex flex-1 items-center justify-end gap-2 md:gap-4">
        <div className="relative ml-auto w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar..." className="pl-9" />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative shrink-0">
              <Bell className="h-5 w-5" />
              <span className="absolute right-1 top-1 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/75 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent"></span>
              </span>
              <span className="sr-only">Ver notificaciones</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0">
            <div className="p-4 font-medium">Notificaciones</div>
            <div className="border-t">
              {notifications.slice(0, 4).map((notif) => (
                <div
                  key={notif.id}
                  className="border-b p-4 text-sm last:border-b-0 transition-colors hover:bg-accent"
                >
                  <p>{notif.text}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {notif.time}
                  </p>
                </div>
              ))}
            </div>
            <div className="border-t bg-background/50 p-2 text-center">
              <Button variant="link" size="sm" asChild>
                <Link href="/dashboard/notificaciones">
                  Ver todas las notificaciones
                </Link>
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-9 w-9">
                <AvatarImage
                  src="https://picsum.photos/seed/admin-avatar/40/40"
                  alt="Admin"
                  data-ai-hint="professional person"
                />
                <AvatarFallback>AD</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuLabel>
              <p>Usuario Admin</p>
              <p className="text-xs font-normal text-muted-foreground">
                admin@crepipep.com
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <UserIcon className="mr-2 h-4 w-4" />
              <span>Perfil</span>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/configuracion">
                <Settings className="mr-2 h-4 w-4" />
                <span>Configuración</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Cerrar sesión</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
