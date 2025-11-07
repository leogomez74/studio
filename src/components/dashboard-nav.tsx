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
  LineChart,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'REPORTES' },
  { href: '/dashboard/leads', icon: Handshake, label: 'LEADS' },
  { href: '/dashboard/oportunidades', icon: Users, label: 'OPORTUNIDADES' },
  { href: '/dashboard/clientes', icon: UserCheck, label: 'CLIENTES' },
  { href: '/dashboard/analisis', icon: FileSearch, label: 'ANÁLISIS' },
  { href: '/dashboard/creditos', icon: Landmark, label: 'CRÉDITOS' },
  { href: '/dashboard/calculos', icon: Calculator, label: 'CÁLCULOS' },
  { href: '/dashboard/cobros', icon: Banknote, label: 'COBROS' },
  { href: '/dashboard/cobro-judicial', icon: Gavel, label: 'COBRO JUDICIAL' },
  { href: '/dashboard/pagos', icon: '💸', label: 'PAGOS' }, // Using emoji as no direct icon
  { href: '/dashboard/rutas', icon: Route, label: 'RUTAS' },
  { href: '/dashboard/notificaciones', icon: Bell, label: 'NOTIFICACIONES' },
  { href: '/dashboard/tareas', icon: ClipboardCheck, label: 'TAREAS' },
  { href: '/dashboard/comunicaciones', icon: MessageSquare, label: 'COMUNICACIONES' },
  { href: '/dashboard/staff', icon: Briefcase, label: 'COLABORADORES' },
  { href: '/dashboard/reportes', icon: LineChart, label: 'REPORTES' },
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
          >
            <Link href={item.href}>
                {typeof item.icon === 'string' ? <span className="text-lg">{item.icon}</span> : <item.icon />}
              {item.label}
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
