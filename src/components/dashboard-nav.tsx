'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  Users,
  Handshake,
  Landmark,
  Route,
  MessageSquare,
  UserCheck,
  Briefcase,
  Bell,
  ClipboardCheck,
  FileSearch,
  Calculator,
  Gavel,
  Banknote,
  DollarSign,
  PiggyBank,
  Receipt,
  FileText,
  GraduationCap,
  Trophy,
  BarChart3,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'REPORTES' },
  { href: '/dashboard/kpis', icon: BarChart3, label: 'KPIs' },
  { href: '/dashboard/clientes', icon: UserCheck, label: 'CRM' },
  { href: '/dashboard/oportunidades', icon: Handshake, label: 'OPORTUNIDADES' },
  { href: '/dashboard/analisis', icon: FileSearch, label: 'ANALIZADOS' },
  { href: '/dashboard/creditos', icon: Landmark, label: 'CRÉDITOS' },
  { href: '/dashboard/calculos', icon: Calculator, label: 'CÁLCULOS' },
  { href: '/dashboard/cobros', icon: Banknote, label: 'COBROS' },
  { href: '/dashboard/cobro-judicial', icon: Gavel, label: 'COBRO JUDICIAL' },
  { href: '/dashboard/ventas', icon: DollarSign, label: 'VENTAS' },
  { href: '/dashboard/inversiones', icon: PiggyBank, label: 'INVERSIONES' },
  { href: '/dashboard/rutas', icon: Route, label: 'RUTAS' },
  { href: '/dashboard/tareas', icon: ClipboardCheck, label: 'PROYECTOS' },
  {
    href: '/dashboard/comunicaciones',
    icon: MessageSquare,
    label: 'COMUNICACIONES',
  },
  { href: '/dashboard/staff', icon: Briefcase, label: 'COLABORADORES' },
  { href: '/dashboard/entrenamiento', icon: GraduationCap, label: 'ENTRENAMIENTO' },
  { href: '/dashboard/rewards', icon: Trophy, label: 'RECOMPENSAS' },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {navItems.map((item) => (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton
            asChild
            isActive={
              item.href === '/dashboard'
                ? pathname === item.href
                : pathname.startsWith(item.href)
            }
            tooltip={item.label}
          >
            <Link href={item.href}>
                <item.icon />
              {item.label}
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
