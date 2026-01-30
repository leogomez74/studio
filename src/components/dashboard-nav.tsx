'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  Handshake,
  Landmark,
  Route,
  MessageSquare,
  UserCheck,
  Bell,
  Briefcase,
  ClipboardCheck,
  FileSearch,
  Calculator,
  Gavel,
  Banknote,
  DollarSign,
  PiggyBank,
  GraduationCap,
  Trophy,
  BarChart3,
} from 'lucide-react';
import { usePermissions } from '@/contexts/PermissionsContext';
import { Badge } from '@/components/ui/badge';

// Grouped navigation items for better organization
const navGroups = [
  {
    label: 'General',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Reportes', module: 'reportes' },
      { href: '/dashboard/kpis', icon: BarChart3, label: 'KPIs', module: 'kpis' },
    ],
  },
  {
    label: 'Ventas',
    items: [
      { href: '/dashboard/clientes', icon: UserCheck, label: 'CRM', module: 'crm' },
      { href: '/dashboard/oportunidades', icon: Handshake, label: 'Oportunidades', module: 'oportunidades' },
      { href: '/dashboard/analisis', icon: FileSearch, label: 'Analizados', module: 'analizados' },
      { href: '/dashboard/creditos', icon: Landmark, label: 'Créditos', module: 'creditos' },
      { href: '/dashboard/calculos', icon: Calculator, label: 'Cálculos', module: 'calculos' },
    ],
  },
  {
    label: 'Finanzas',
    items: [
      { href: '/dashboard/cobros', icon: Banknote, label: 'Cobros', module: 'cobros' },
      { href: '/dashboard/cobro-judicial', icon: Gavel, label: 'Cobro Judicial', module: 'cobro_judicial', badge: 'Próximamente' },
      { href: '/dashboard/ventas', icon: DollarSign, label: 'Ventas', module: 'ventas', badge: 'Próximamente' },
      { href: '/dashboard/inversiones', icon: PiggyBank, label: 'Inversiones', module: 'inversiones', badge: 'Próximamente' },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { href: '/dashboard/rutas', icon: Route, label: 'Rutas', module: 'rutas', badge: 'Próximamente' },
      { href: '/dashboard/tareas', icon: ClipboardCheck, label: 'Proyectos', module: 'proyectos', badge: 'Próximamente' },
      { href: '/dashboard/comunicaciones', icon: MessageSquare, label: 'Comunicaciones', module: 'comunicaciones', badge: 'Próximamente' },
    ],
  },
  {
    label: 'Equipo',
    items: [
      { href: '/dashboard/staff', icon: Briefcase, label: 'Colaboradores', module: 'staff', badge: 'Próximamente' },
      { href: '/dashboard/entrenamiento', icon: GraduationCap, label: 'Entrenamiento', module: 'entrenamiento', badge: 'Próximamente' },
      { href: '/dashboard/rewards', icon: Trophy, label: 'Recompensas', module: 'recompensas', badge: 'Próximamente' },
    ],
  },
];

export function DashboardNav() {
  const pathname = usePathname();
  const { canViewModule } = usePermissions();

  return (
    <div className="flex flex-col gap-1 px-2">
      {navGroups.map((group) => {
        // Filter items based on permissions
        const visibleItems = group.items.filter((item) => canViewModule(item.module));

        // Only render group if it has visible items
        if (visibleItems.length === 0) return null;

        return (
          <SidebarGroup key={group.label} className="p-0">
            <SidebarGroupLabel className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-1 px-2">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={
                        item.href === '/dashboard'
                          ? pathname === item.href
                          : pathname.startsWith(item.href)
                      }
                      tooltip={item.label}
                      className="h-9 px-3 rounded-lg transition-all duration-200 data-[active=true]:bg-blue-900/50 data-[active=true]:text-white hover:bg-blue-900/30"
                    >
                      <Link href={item.href} className="flex items-center gap-3">
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="text-sm font-medium">{item.label}</span>
                        {item.badge && (
                          <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">
                            {item.badge}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        );
      })}
    </div>
  );
}
