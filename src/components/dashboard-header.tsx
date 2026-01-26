'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Home, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { notifications } from '@/lib/data';
import { cn } from '@/lib/utils';

/**
 * Componente que renderiza las "migas de pan" (breadcrumbs) para mostrar la ubicación actual del usuario en la aplicación.
 * Utiliza el hook 'usePathname' de Next.js para obtener la ruta actual y la divide en segmentos para construir la navegación.
 */
function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean); // Divide la URL en partes y elimina los elementos vacíos.

  return (
    <nav className="hidden items-center gap-2 text-sm font-medium md:flex">
      {/* Si hay al menos un segmento en la ruta (es decir, no estamos en el dashboard raíz), muestra el ícono de Home. */}
      {segments.length > 0 && (
        <Link
          href="/dashboard"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <Home className="h-4 w-4" />
        </Link>
      )}
      {/* Mapea cada segmento de la URL para crear un enlace de "miga de pan". */}
      {segments.map((segment, index) => {
        const href = '/' + segments.slice(0, index + 1).join('/'); // Construye la URL para este segmento.
        const isLast = index === segments.length - 1; // Comprueba si es el último segmento en la ruta.
        // Decodifica el segmento para mostrarlo correctamente (ej. %20 -> espacio) y reemplaza guiones por espacios.
        const segmentDisplay = decodeURIComponent(segment).replace(/-/g, ' ');

        return (
          <div key={href} className="flex items-center gap-2">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <Link
              href={href}
              className={cn(
                'capitalize transition-colors', // 'capitalize' pone la primera letra en mayúscula.
                isLast
                  ? 'text-foreground' // Si es el último, el texto es más oscuro.
                  : 'text-muted-foreground hover:text-foreground' // Si no, es más claro y cambia al pasar el mouse.
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

/**
 * Componente principal del encabezado del dashboard.
 * Contiene el disparador de la barra lateral para móviles, las migas de pan y las notificaciones.
 */
export function DashboardHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur-sm md:px-6">
      {/* Contenedor para el botón de la barra lateral y las migas de pan. */}
      <div className="flex items-center gap-4">
        <SidebarTrigger /> {/* Botón para colapsar/expandir el sidebar */}
        <Breadcrumbs /> {/* Las migas de pan. */}
      </div>

      {/* Contenedor para notificaciones y menú de usuario, alineado a la derecha. */}
      <div className="flex flex-1 items-center justify-end gap-2 md:gap-4">
        {/* Popover para las notificaciones. */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative shrink-0">
              <Bell className="h-5 w-5" />
              {/* Este pequeño punto indica que hay notificaciones nuevas. */}
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
              {/* Muestra las primeras 4 notificaciones de los datos de ejemplo. */}
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
            {/* Enlace para ver todas las notificaciones. */}
            <div className="border-t bg-background/50 p-2 text-center">
              <Button variant="link" size="sm" asChild>
                <Link href="/dashboard/notificaciones">
                  Ver todas las notificaciones
                </Link>
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}
