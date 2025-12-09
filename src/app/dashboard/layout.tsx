// Este archivo define la estructura principal del panel de control (dashboard).
// 'ReactNode' es un tipo que representa cualquier cosa que React puede renderizar.
import React, { type ReactNode } from "react";
// 'Link' es un componente de Next.js para navegar entre páginas sin recargar la página completa.
import Link from "next/link";
// Importamos los componentes que forman la barra lateral (sidebar).
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
} from "@/components/ui/sidebar";
// Importamos el icono de configuración.
import {
  Settings
} from "lucide-react";
// Importamos los componentes personalizados para el encabezado y la navegación del dashboard.
import { DashboardHeader } from "@/components/dashboard-header";
import { Logo } from "@/components/logo";
import { DashboardNav } from "@/components/dashboard-nav";

// Esta es la función principal del layout del dashboard.
// Recibe 'children', que es el contenido específico de cada página del dashboard.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  // La función devuelve la estructura de la página.
  return (
    // 'SidebarProvider' envuelve todo para que los componentes internos puedan acceder al estado de la barra lateral.
    <SidebarProvider>
      {/* 'Sidebar' es el contenedor principal de la barra lateral. */}
      <Sidebar>
        {/* 'SidebarHeader' contiene la parte superior de la barra lateral, como el logo. */}
        <SidebarHeader>
          <Logo />
        </SidebarHeader>
        {/* 'SidebarContent' contiene el menú de navegación principal. */}
        <SidebarContent>
          <DashboardNav />
        </SidebarContent>
        {/* 'SidebarFooter' contiene la parte inferior, como el enlace a configuración. */}
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href="/dashboard/configuracion">
                  <Settings />
                  CONFIGURACIÓN
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      {/* 'SidebarInset' es el área principal de contenido que se ajusta al lado de la barra lateral. */}
      <SidebarInset>
        {/* Muestra el encabezado del dashboard. */}
          <DashboardHeader />
          {/* 'main' es donde se renderizará el contenido de cada página ('children').
              Envolvemos children en Suspense para permitir que componentes cliente
              que usan hooks como useSearchParams se hidraten correctamente durante
              el prerender y evitar el error de "missing suspense with csr bailout". */}
          <div className="flex flex-1 flex-col p-4 lg:p-6 w-full min-w-0 overflow-x-hidden">
            <React.Suspense fallback={<div />}>{children}</React.Suspense>
          </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
