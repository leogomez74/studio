'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Bell, Home, ChevronRight, AlertTriangle, Users, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import api from '@/lib/axios';

interface LeadAlertItem {
  id: number;
  name: string;
}

interface OpportunityAlertItem {
  id: string;
  reference: string;
  lead_name: string;
}

interface LeadAlert {
  id: number;
  alert_type: string;
  alert_number: number;
  inactive_leads: LeadAlertItem[];
  inactive_opportunities: OpportunityAlertItem[];
  message: string;
  is_read: boolean;
  created_at: string;
}

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
  const [alerts, setAlerts] = useState<LeadAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [expandedAlert, setExpandedAlert] = useState<number | null>(null);

  const fetchAlerts = async () => {
    try {
      const [alertsRes, countRes] = await Promise.all([
        api.get('/api/lead-alerts', { params: { is_read: false, per_page: 5 } }),
        api.get('/api/lead-alerts/count'),
      ]);
      setAlerts(alertsRes.data.data || []);
      setUnreadCount(countRes.data.unread_count || 0);
    } catch (error) {
      console.error('Error cargando alertas:', error);
    }
  };

  const markAsRead = async (id: number) => {
    try {
      await api.patch(`/api/lead-alerts/${id}/read`);
      fetchAlerts();
    } catch (error) {
      console.error('Error marcando alerta:', error);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000);
    return () => clearInterval(interval);
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const alertLabel = (alert: LeadAlert) => {
    if (alert.alert_number === 3) return 'Alerta Final';
    return `Alerta ${alert.alert_number}/3`;
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur-sm md:px-6">
      <div className="flex items-center gap-4">
        <SidebarTrigger />
        <Breadcrumbs />
      </div>

      <div className="flex flex-1 items-center justify-end gap-2 md:gap-4">
        <Button
          variant="destructive"
          size="sm"
          className="gap-2"
        >
          <AlertTriangle className="h-4 w-4" />
          Eliminar Leo
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative shrink-0">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/75 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent"></span>
                </span>
              )}
              <span className="sr-only">Ver notificaciones</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-96 p-0 max-h-[500px] overflow-hidden flex flex-col">
            <div className="p-4 font-medium flex items-center justify-between flex-shrink-0">
              <span>Notificaciones</span>
              {unreadCount > 0 && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                  {unreadCount} sin leer
                </span>
              )}
            </div>

            <div className="border-t overflow-y-auto flex-1">
              {alerts.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No hay alertas pendientes.
                </div>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="border-b last:border-b-0 transition-colors hover:bg-accent/50"
                  >
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className={cn(
                            "h-4 w-4 flex-shrink-0",
                            alert.alert_number === 3 ? "text-red-500" : "text-amber-500"
                          )} />
                          <span className={cn(
                            "text-xs font-semibold px-1.5 py-0.5 rounded",
                            alert.alert_number === 3
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-700"
                          )}>
                            {alertLabel(alert)}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {formatDate(alert.created_at)}
                        </span>
                      </div>

                      <p className="text-sm mt-2 text-muted-foreground">{alert.message}</p>

                      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                        {alert.inactive_leads.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {alert.inactive_leads.length} leads
                          </span>
                        )}
                        {alert.inactive_opportunities.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Briefcase className="h-3 w-3" />
                            {alert.inactive_opportunities.length} oportunidades
                          </span>
                        )}
                      </div>

                      {/* Lista expandible */}
                      <button
                        onClick={() => setExpandedAlert(expandedAlert === alert.id ? null : alert.id)}
                        className="text-xs text-primary mt-2 hover:underline"
                      >
                        {expandedAlert === alert.id ? 'Ocultar detalle' : 'Ver detalle'}
                      </button>

                      {expandedAlert === alert.id && (
                        <div className="mt-2 space-y-2 text-xs">
                          {alert.inactive_leads.length > 0 && (
                            <div>
                              <p className="font-medium text-muted-foreground mb-1">Leads:</p>
                              <ul className="space-y-0.5 ml-2">
                                {alert.inactive_leads.map((lead) => (
                                  <li key={lead.id} className="text-foreground">
                                    <Link href={`/dashboard/leads/${lead.id}`} className="hover:underline text-primary">
                                      {lead.name}
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {alert.inactive_opportunities.length > 0 && (
                            <div>
                              <p className="font-medium text-muted-foreground mb-1">Oportunidades:</p>
                              <ul className="space-y-0.5 ml-2">
                                {alert.inactive_opportunities.map((opp) => (
                                  <li key={opp.id} className="text-foreground">
                                    <Link href={`/dashboard/oportunidades/${opp.id}`} className="hover:underline text-primary">
                                      {opp.reference}
                                    </Link>
                                    <span className="text-muted-foreground"> - {opp.lead_name}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Marcar como leída */}
                      <div className="mt-2 flex justify-end">
                        <button
                          onClick={() => markAsRead(alert.id)}
                          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                        >
                          Marcar como leída
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t bg-background/50 p-2 text-center flex-shrink-0">
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
