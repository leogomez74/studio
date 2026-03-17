'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Bell, Home, ChevronRight, AlertTriangle, Users, Briefcase, Loader2, MessageSquare, CheckCheck, ClipboardCheck, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import api from '@/lib/axios';
import { useToast } from '@/hooks/use-toast';
import { useOverdueTasks } from '@/hooks/use-overdue-tasks';

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

interface CommentNotification {
  id: number;
  type: string;
  title: string;
  body: string;
  data: {
    comment_id?: number;
    commentable_type?: string;
    commentable_id?: number;
    sender_name?: string;
    comment_body?: string;
    entity_reference?: string;
    verification_id?: number;
    credit_reference?: string;
    payment_type_label?: string;
    monto?: number;
    status?: string;
    verifier_name?: string;
    notes?: string;
  } | null;
  read_at: string | null;
  created_at: string;
}

const ENTITY_ROUTES: Record<string, string> = {
  'App\\Models\\Credit': '/dashboard/creditos',
  'App\\Models\\Opportunity': '/dashboard/oportunidades',
  'App\\Models\\Lead': '/dashboard/leads',
  'App\\Models\\Client': '/dashboard/clientes',
  'App\\Models\\Analisis': '/dashboard/analisis',
  'App\\Models\\User': '/dashboard/comunicaciones',
  'credit': '/dashboard/creditos',
  'opportunity': '/dashboard/oportunidades',
  'lead': '/dashboard/leads',
  'client': '/dashboard/clientes',
  'analisis': '/dashboard/analisis',
  'direct': '/dashboard/comunicaciones',
};

const ENTITY_LABELS: Record<string, string> = {
  'App\\Models\\Credit': 'Crédito',
  'App\\Models\\Opportunity': 'Oportunidad',
  'App\\Models\\Lead': 'Lead',
  'App\\Models\\Client': 'Cliente',
  'App\\Models\\Analisis': 'Análisis',
  'credit': 'Crédito',
  'opportunity': 'Oportunidad',
  'lead': 'Lead',
  'client': 'Cliente',
  'analisis': 'Análisis',
};

const ENTITY_COLORS: Record<string, string> = {
  'App\\Models\\Credit': 'bg-emerald-100 text-emerald-700',
  'App\\Models\\Opportunity': 'bg-blue-100 text-blue-700',
  'App\\Models\\Lead': 'bg-violet-100 text-violet-700',
  'App\\Models\\Client': 'bg-amber-100 text-amber-700',
  'App\\Models\\Analisis': 'bg-cyan-100 text-cyan-700',
  'credit': 'bg-emerald-100 text-emerald-700',
  'opportunity': 'bg-blue-100 text-blue-700',
  'lead': 'bg-violet-100 text-violet-700',
  'client': 'bg-amber-100 text-amber-700',
  'analisis': 'bg-cyan-100 text-cyan-700',
};

function Breadcrumbs() {
  const pathname = usePathname();
  const allSegments = pathname.split('/').filter(Boolean);
  // Leads y clientes comparten ruta unificada /dashboard/clientes
  const mappedSegments = allSegments.map(s => s === 'leads' ? 'clientes' : s);
  // Omitir 'dashboard' del breadcrumb — el ícono Home ya enlaza al dashboard
  const visibleSegments = allSegments
    .map((segment, originalIndex) => ({ segment, originalIndex }))
    .filter(({ segment }) => segment !== 'dashboard');

  return (
    <nav className="hidden items-center gap-2 text-sm font-medium md:flex">
      {allSegments.length > 0 && (
        <Link
          href="/dashboard"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <Home className="h-4 w-4" />
        </Link>
      )}
      {visibleSegments.map(({ segment, originalIndex }, index) => {
        const href = '/' + mappedSegments.slice(0, originalIndex + 1).join('/');
        const isLast = index === visibleSegments.length - 1;
        const displaySegment = segment === 'leads' ? 'clientes' : segment;
        const segmentDisplay = decodeURIComponent(displaySegment).replace(/-/g, ' ');

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

function relativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'ahora';
  if (diffMin === 1) return 'hace 1 min';
  if (diffMin < 60) return `hace ${diffMin} min`;
  if (diffHr === 1) return 'hace 1 hora';
  if (diffHr < 24) return `hace ${diffHr} horas`;
  if (diffDay === 1) return 'ayer';
  if (diffDay < 7) return `hace ${diffDay} dias`;
  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export function DashboardHeader() {
  const { toast } = useToast();
  const router = useRouter();
  const [alerts, setAlerts] = useState<LeadAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [expandedAlert, setExpandedAlert] = useState<number | null>(null);
  const [deletingLeo, setDeletingLeo] = useState(false);
  const [deletingDaniel, setDeletingDaniel] = useState(false);

  // Comment notifications state
  const [commentNotifications, setCommentNotifications] = useState<CommentNotification[]>([]);
  const [notifUnreadCount, setNotifUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<'alerts' | 'comments' | 'tasks'>('alerts');
  const overdueTasks = useOverdueTasks();
  const prevNotifCount = useRef<number | null>(null);

  const playBellSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const play = (freq: number, start: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur);
      };
      play(830, 0, 0.15);
      play(1050, 0.18, 0.25);
    } catch {}
  }, []);

  const handleDeleteLeo = async () => {
    const confirmed = window.confirm('¿Está seguro de eliminar el registro con cédula 108760664? Esta acción eliminará también todas las oportunidades, análisis, créditos y sus documentos asociados.');

    if (!confirmed) return;

    setDeletingLeo(true);
    try {
      const response = await api.post('/api/leads/delete-by-cedula', {
        cedula: '108760664'
      });

      if (response.data.success) {
        const deleted = response.data.deleted;
        const docsInfo = `Documentos: ${deleted.person_documents_files || 0} de persona, ${deleted.credit_documents_files || 0} de créditos`;

        toast({
          title: 'Eliminado correctamente',
          description: `${response.data.message}. ${docsInfo}`,
        });
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        toast({
          variant: 'destructive',
          title: 'No encontrado',
          description: 'No se encontró ningún registro con esa cédula',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.response?.data?.message || 'Error al eliminar el registro',
        });
      }
    } finally {
      setDeletingLeo(false);
    }
  };

  const handleDeleteDaniel = async () => {
    const confirmed = window.confirm('¿Está seguro de eliminar el registro con cédula 118760656? Esta acción eliminará también todas las oportunidades, análisis, créditos y sus documentos asociados.');

    if (!confirmed) return;

    setDeletingDaniel(true);
    try {
      const response = await api.post('/api/leads/delete-by-cedula', {
        cedula: '118760656'
      });

      if (response.data.success) {
        const deleted = response.data.deleted;
        const docsInfo = `Documentos: ${deleted.person_documents_files || 0} de persona, ${deleted.credit_documents_files || 0} de créditos`;

        toast({
          title: 'Eliminado correctamente',
          description: `${response.data.message}. ${docsInfo}`,
        });
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        toast({
          variant: 'destructive',
          title: 'No encontrado',
          description: 'No se encontró ningún registro con esa cédula',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.response?.data?.message || 'Error al eliminar el registro',
        });
      }
    } finally {
      setDeletingDaniel(false);
    }
  };

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

  const fetchNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const [notifsRes, countRes] = await Promise.all([
        api.get('/api/notifications', { params: { unread: true } }),
        api.get('/api/notifications/count'),
      ]);
      const newCount = countRes.data.count || 0;
      setCommentNotifications(notifsRes.data.data || []);
      if (prevNotifCount.current !== null && newCount > prevNotifCount.current) {
        playBellSound();
      }
      prevNotifCount.current = newCount;
      setNotifUnreadCount(newCount);
    } catch (error) {
      console.error('Error cargando notificaciones:', error);
    } finally {
      setNotifLoading(false);
    }
  }, []);

  const markAsRead = async (id: number) => {
    try {
      await api.patch(`/api/lead-alerts/${id}/read`);
      fetchAlerts();
    } catch (error) {
      console.error('Error marcando alerta:', error);
    }
  };

  const markNotificationAsRead = useCallback(async (id: number) => {
    try {
      await api.patch(`/api/notifications/${id}/read`);
      setCommentNotifications(prev => prev.filter(n => n.id !== id));
      setNotifUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marcando notificacion:', error);
    }
  }, []);

  const markAllNotificationsAsRead = useCallback(async () => {
    try {
      await api.patch('/api/notifications/read-all');
      setCommentNotifications([]);
      setNotifUnreadCount(0);
      toast({
        title: 'Listo',
        description: 'Todas las notificaciones marcadas como leidas.',
      });
    } catch (error) {
      console.error('Error marcando todas las notificaciones:', error);
    }
  }, [toast]);

  const handleNotificationClick = useCallback((notification: CommentNotification) => {
    const commentId = notification.data?.comment_id;
    const commentableType = notification.data?.commentable_type;
    const commentableId = notification.data?.commentable_id;

    // Navigate to comunicaciones page with the comment thread open
    if (commentId) {
      router.push(`/dashboard/comunicaciones?comment_id=${commentId}&type=${commentableType}&entity_id=${commentableId}`);
    } else if (commentableType && commentableId) {
      const route = ENTITY_ROUTES[commentableType] || '/dashboard';
      router.push(`${route}/${commentableId}`);
    }

    markNotificationAsRead(notification.id);
  }, [router, markNotificationAsRead]);

  useEffect(() => {
    fetchAlerts();
    fetchNotifications();
    const alertInterval = setInterval(fetchAlerts, 60000);
    const notifInterval = setInterval(fetchNotifications, 15000);
    return () => {
      clearInterval(alertInterval);
      clearInterval(notifInterval);
    };
  }, [fetchNotifications]);

  const overdueCount = overdueTasks?.count ?? 0;
  const totalUnread = unreadCount + notifUnreadCount + overdueCount;

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
          onClick={handleDeleteLeo}
          disabled={deletingLeo}
        >
          {deletingLeo ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Eliminando...
            </>
          ) : (
            <>
              <AlertTriangle className="h-4 w-4" />
              Eliminar Leo
            </>
          )}
        </Button>

        <Button
          variant="destructive"
          size="sm"
          className="gap-2"
          onClick={handleDeleteDaniel}
          disabled={deletingDaniel}
        >
          {deletingDaniel ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Eliminando...
            </>
          ) : (
            <>
              <AlertTriangle className="h-4 w-4" />
              Eliminar Daniel
            </>
          )}
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative shrink-0 h-10 w-10">
              <Bell className="h-6 w-6" />
              {/* LED indicators */}
              {notifUnreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-500 text-[8px] font-bold text-white ring-2 ring-background">
                  {notifUnreadCount > 9 ? '9+' : notifUnreadCount}
                </span>
              )}
              {unreadCount > 0 && (
                <span className="absolute bottom-0.5 right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-green-500 text-[8px] font-bold text-white ring-2 ring-background">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
              {overdueCount > 0 && (
                <span className="absolute top-0.5 left-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white ring-2 ring-background">
                  {overdueCount > 9 ? '9+' : overdueCount}
                </span>
              )}
              <span className="sr-only">Ver notificaciones</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-96 p-0 max-h-[560px] overflow-hidden flex flex-col">
            {/* Header with total count */}
            <div className="p-4 font-medium flex items-center justify-between flex-shrink-0">
              <span>Notificaciones</span>
              {totalUnread > 0 && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                  {totalUnread} sin leer
                </span>
              )}
            </div>

            {/* Section tabs */}
            <div className="flex border-t border-b bg-muted/30 flex-shrink-0">
              <button
                onClick={() => setActiveSection('alerts')}
                className={cn(
                  'flex-1 px-4 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1.5',
                  activeSection === 'alerts'
                    ? 'text-foreground border-b-2 border-primary bg-background'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Alertas
                {unreadCount > 0 && (
                  <span className="ml-1 bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveSection('comments')}
                className={cn(
                  'flex-1 px-4 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1.5',
                  activeSection === 'comments'
                    ? 'text-foreground border-b-2 border-primary bg-background'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Comentarios
                {notifUnreadCount > 0 && (
                  <span className="ml-1 bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {notifUnreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveSection('tasks')}
                className={cn(
                  'flex-1 px-4 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1.5',
                  activeSection === 'tasks'
                    ? 'text-foreground border-b-2 border-primary bg-background'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <ClipboardCheck className="h-3.5 w-3.5" />
                Tareas
                {overdueCount > 0 && (
                  <span className="ml-1 bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {overdueCount}
                  </span>
                )}
              </button>
            </div>

            {/* Content area */}
            <div className="overflow-y-auto flex-1">
              {activeSection === 'tasks' ? (
                /* Overdue tasks section */
                overdueCount === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    No hay tareas vencidas.
                  </div>
                ) : (
                  overdueTasks?.tasks.map((task) => (
                    <Link
                      key={task.id}
                      href={`/dashboard/tareas/${task.id}`}
                      className="block border-b last:border-b-0 transition-colors hover:bg-accent/50"
                    >
                      <div className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <ClipboardCheck className="h-4 w-4 flex-shrink-0 text-red-500" />
                            <span className="text-sm font-medium text-foreground truncate">
                              {task.title}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 flex-shrink-0">
                            {task.days_overdue}d
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                          <span>Vencida: {new Date(task.due_date).toLocaleDateString('es-CR', { day: '2-digit', month: 'short' })}</span>
                          {task.assignee && (
                            <>
                              <span className="text-muted-foreground/50">|</span>
                              <span>{task.assignee}</span>
                            </>
                          )}
                          <span className={cn(
                            'ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded',
                            task.priority === 'alta' ? 'bg-red-50 text-red-600' :
                            task.priority === 'media' ? 'bg-amber-50 text-amber-600' :
                            'bg-gray-50 text-gray-600'
                          )}>
                            {task.priority}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))
                )
              ) : activeSection === 'alerts' ? (
                /* Alerts section */
                alerts.length === 0 ? (
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

                        {/* Marcar como leida */}
                        <div className="mt-2 flex justify-end">
                          <button
                            onClick={() => markAsRead(alert.id)}
                            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                          >
                            Marcar como leida
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )
              ) : (
                /* Comment notifications section */
                notifLoading ? (
                  <div className="p-6 flex flex-col items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando notificaciones...
                  </div>
                ) : commentNotifications.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    No hay notificaciones de comentarios.
                  </div>
                ) : (
                  <>
                    {/* Mark all as read button */}
                    {notifUnreadCount > 0 && (
                      <div className="px-3 py-2 flex justify-end border-b">
                        <button
                          onClick={markAllNotificationsAsRead}
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <CheckCheck className="h-3 w-3" />
                          Marcar todas como leidas
                        </button>
                      </div>
                    )}
                    {commentNotifications.map((notif) => {
                      const isNovedad = notif.type === 'novedad_planilla';
                      const entityType = notif.data?.commentable_type || '';
                      const entityLabel = ENTITY_LABELS[entityType] || 'Entidad';
                      const senderName = notif.data?.sender_name || 'Alguien';

                      return (
                        <button
                          key={notif.id}
                          onClick={() => handleNotificationClick(notif)}
                          className="w-full text-left border-b last:border-b-0 transition-colors hover:bg-accent/50 cursor-pointer"
                        >
                          <div className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                {isNovedad ? (
                                  <FileText className="h-4 w-4 flex-shrink-0 text-orange-500" />
                                ) : (
                                  <MessageSquare className="h-4 w-4 flex-shrink-0 text-blue-500" />
                                )}
                                <span className={cn(
                                  'text-xs font-semibold',
                                  isNovedad ? 'text-orange-600' : 'text-foreground'
                                )}>
                                  {senderName}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground flex-shrink-0">
                                {relativeTime(notif.created_at)}
                              </span>
                            </div>

                            <p className="text-sm mt-1 text-foreground font-medium">
                              {notif.title}
                            </p>
                            <p className="text-xs mt-0.5 text-muted-foreground line-clamp-2">
                              {(notif.data?.comment_body || notif.body).replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1')}
                            </p>

                            {notif.data?.commentable_id && (
                              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                                <span className={cn(
                                  'text-[10px] font-medium px-1.5 py-0.5 rounded',
                                  isNovedad
                                    ? 'bg-orange-100 text-orange-700'
                                    : ENTITY_COLORS[entityType] || 'bg-gray-100 text-gray-700'
                                )}>
                                  {entityLabel}: {notif.data.entity_reference || `#${notif.data.commentable_id}`}
                                </span>
                                {isNovedad && (notif.data as any).deductora && (
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                                    {(notif.data as any).deductora}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </>
                )
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
