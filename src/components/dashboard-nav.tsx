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

// Grouped navigation items for better organization
const navGroups = [
  {
    label: 'General',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Reportes' },
      { href: '/dashboard/kpis', icon: BarChart3, label: 'KPIs' },
    ],
  },
  {
    label: 'Ventas',
    items: [
      { href: '/dashboard/clientes', icon: UserCheck, label: 'CRM' },
      { href: '/dashboard/oportunidades', icon: Handshake, label: 'Oportunidades' },
      { href: '/dashboard/analisis', icon: FileSearch, label: 'Analizados' },
      { href: '/dashboard/creditos', icon: Landmark, label: 'Créditos' },
      { href: '/dashboard/calculos', icon: Calculator, label: 'Cálculos' },
    ],
  },
  {
    label: 'Finanzas',
    items: [
      { href: '/dashboard/cobros', icon: Banknote, label: 'Cobros' },
      { href: '/dashboard/cobro-judicial', icon: Gavel, label: 'Cobro Judicial' },
      { href: '/dashboard/ventas', icon: DollarSign, label: 'Ventas' },
      { href: '/dashboard/inversiones', icon: PiggyBank, label: 'Inversiones' },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { href: '/dashboard/rutas', icon: Route, label: 'Rutas' },
      { href: '/dashboard/tareas', icon: ClipboardCheck, label: 'Proyectos' },
      { href: '/dashboard/comunicaciones', icon: MessageSquare, label: 'Comunicaciones' },
    ],
  },
  {
    label: 'Equipo',
    items: [
      { href: '/dashboard/staff', icon: Briefcase, label: 'Colaboradores' },
      { href: '/dashboard/entrenamiento', icon: GraduationCap, label: 'Entrenamiento' },
      { href: '/dashboard/rewards', icon: Trophy, label: 'Recompensas' },
    ],
  },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-1 px-2">
      {navGroups.map((group) => (
        <SidebarGroup key={group.label} className="p-0">
          <SidebarGroupLabel className="text-xs font-semibold text-foreground/90 uppercase tracking-wider mb-1 px-2">
            {group.label}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      item.href === '/dashboard'
                        ? pathname === item.href
                        : pathname.startsWith(item.href)
                    }
                    tooltip={item.label}
                    className="h-9 px-3 rounded-lg transition-all duration-200 data-[active=true]:bg-blue-900/50 data-[active=true]:text-white hover:bg-muted"
                  >
                    <Link href={item.href} className="flex items-center gap-3">
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </div>
  );
}
