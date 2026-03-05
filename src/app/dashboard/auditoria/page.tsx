'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ShieldCheck,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  X,
  Activity,
  Users,
  AlertTriangle,
  CalendarDays,
  ShieldAlert,
} from 'lucide-react';
import api from '@/lib/axios';
import { useToast } from '@/hooks/use-toast';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
interface ActivityLogEntry {
  id: number;
  user_id: number | null;
  user_name: string | null;
  action: string;
  module: string;
  model_type: string | null;
  model_id: string | null;
  model_label: string | null;
  changes: ChangeItem[] | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

interface ChangeItem {
  field: string;
  old_value: unknown;
  new_value: unknown;
}

interface Stats {
  total: number;
  hoy: number;
  usuarios_activos_hoy: number;
  eliminaciones_24h: number;
  logins_fallidos_24h: number;
  por_modulo: { module: string; count: number }[];
  por_accion: { action: string; count: number }[];
  top_usuarios: { user_id: number; user_name: string; count: number }[];
}

interface PaginatedResponse {
  data: ActivityLogEntry[];
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
}

interface UserOption {
  id: number;
  name: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const MODULES = [
  'Leads', 'Clientes', 'Créditos', 'Pagos', 'Planilla',
  'Análisis', 'Oportunidades', 'Tareas', 'Usuarios',
  'Configuración', 'Tasas', 'Deductoras', 'Config. Contable',
  'Config. ERP', 'Saldo Pendiente',
];

const ACTIONS = [
  { value: 'create',       label: 'Crear' },
  { value: 'update',       label: 'Actualizar' },
  { value: 'delete',       label: 'Eliminar' },
  { value: 'login',        label: 'Inicio de sesión' },
  { value: 'login_failed', label: 'Intento fallido' },
  { value: 'logout',       label: 'Cierre de sesión' },
  { value: 'export',       label: 'Exportar' },
  { value: 'upload',       label: 'Subir archivo' },
  { value: 'restore',      label: 'Restaurar' },
];

const ACTION_COLORS: Record<string, string> = {
  create:       'bg-green-500/20 text-green-400 border-green-500/30',
  update:       'bg-blue-500/20 text-blue-400 border-blue-500/30',
  delete:       'bg-red-500/20 text-red-400 border-red-500/30',
  login:        'bg-gray-500/20 text-gray-400 border-gray-500/30',
  login_failed: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  logout:       'bg-gray-500/20 text-gray-400 border-gray-500/30',
  export:       'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  upload:       'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  restore:      'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

const ACTION_LABELS: Record<string, string> = {
  create:       'Crear',
  update:       'Actualizar',
  delete:       'Eliminar',
  login:        'Login',
  login_failed: 'Login fallido',
  logout:       'Logout',
  export:       'Exportar',
  upload:       'Subir',
  restore:      'Restaurar',
};

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export default function AuditoriaPage() {
  const { toast } = useToast();

  // Stats
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Tabla
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Filtros
  const [search, setSearch] = useState('');
  const [filterModule, setFilterModule] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterUserId, setFilterUserId] = useState('');
  const [filterFechaDesde, setFilterFechaDesde] = useState('');
  const [filterFechaHasta, setFilterFechaHasta] = useState('');
  const [filterIp, setFilterIp] = useState('');

  // Usuarios para el selector
  const [users, setUsers] = useState<UserOption[]>([]);

  // Detalle
  const [selectedLog, setSelectedLog] = useState<ActivityLogEntry | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Exportar
  const [exporting, setExporting] = useState(false);

  // ---------------------------------------------------------------------------
  // Carga de datos
  // ---------------------------------------------------------------------------
  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const res = await api.get('/api/activity-logs/stats');
      setStats(res.data);
    } catch {
      // silencioso
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const loadLogs = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { per_page: '20', page: String(p) };
      if (search)           params.search        = search;
      if (filterModule)     params.module        = filterModule;
      if (filterAction)     params.action        = filterAction;
      if (filterUserId)     params.user_id       = filterUserId;
      if (filterFechaDesde) params.fecha_desde   = filterFechaDesde;
      if (filterFechaHasta) params.fecha_hasta   = filterFechaHasta;
      if (filterIp)         params.ip_address    = filterIp;

      const res = await api.get<PaginatedResponse>('/api/activity-logs', { params });
      setLogs(res.data.data);
      setPage(res.data.current_page);
      setLastPage(res.data.last_page);
      setTotal(res.data.total);
    } catch {
      toast({ title: 'Error', description: 'No se pudo cargar la bitácora', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [search, filterModule, filterAction, filterUserId, filterFechaDesde, filterFechaHasta, filterIp, toast]);

  const loadUsers = useCallback(async () => {
    try {
      const res = await api.get('/api/users?per_page=200');
      const data = res.data?.data ?? res.data ?? [];
      setUsers(Array.isArray(data) ? data.map((u: { id: number; name: string }) => ({ id: u.id, name: u.name })) : []);
    } catch {
      // silencioso
    }
  }, []);

  useEffect(() => {
    loadStats();
    loadUsers();
    loadLogs(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Acciones
  // ---------------------------------------------------------------------------
  const handleFilter = () => {
    loadLogs(1);
    loadStats();
  };

  const handleClear = () => {
    setSearch('');
    setFilterModule('');
    setFilterAction('');
    setFilterUserId('');
    setFilterFechaDesde('');
    setFilterFechaHasta('');
    setFilterIp('');
    setTimeout(() => loadLogs(1), 0);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (search)           params.set('search',       search);
      if (filterModule)     params.set('module',       filterModule);
      if (filterAction)     params.set('action',       filterAction);
      if (filterUserId)     params.set('user_id',      filterUserId);
      if (filterFechaDesde) params.set('fecha_desde',  filterFechaDesde);
      if (filterFechaHasta) params.set('fecha_hasta',  filterFechaHasta);
      if (filterIp)         params.set('ip_address',   filterIp);

      const res = await api.get(`/api/activity-logs/export?${params.toString()}`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `auditoria_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    } catch {
      toast({ title: 'Error', description: 'No se pudo exportar', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const openDetail = (log: ActivityLogEntry) => {
    setSelectedLog(log);
    setDetailOpen(true);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold">Auditoría del Sistema</h1>
          <p className="text-sm text-muted-foreground">Bitácora completa de actividad de usuarios</p>
        </div>
      </div>

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          icon={<Activity className="h-5 w-5 text-blue-400" />}
          label="Total eventos"
          value={loadingStats ? '...' : (stats?.total ?? 0).toLocaleString()}
          color="blue"
        />
        <StatCard
          icon={<CalendarDays className="h-5 w-5 text-green-400" />}
          label="Hoy"
          value={loadingStats ? '...' : (stats?.hoy ?? 0).toLocaleString()}
          color="green"
        />
        <StatCard
          icon={<Users className="h-5 w-5 text-purple-400" />}
          label="Usuarios activos hoy"
          value={loadingStats ? '...' : (stats?.usuarios_activos_hoy ?? 0).toLocaleString()}
          color="purple"
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5 text-red-400" />}
          label="Eliminaciones (24h)"
          value={loadingStats ? '...' : (stats?.eliminaciones_24h ?? 0).toLocaleString()}
          color={(stats?.eliminaciones_24h ?? 0) > 0 ? 'red' : 'gray'}
          alert={(stats?.eliminaciones_24h ?? 0) > 0}
        />
        <StatCard
          icon={<ShieldAlert className="h-5 w-5 text-orange-400" />}
          label="Logins fallidos (24h)"
          value={loadingStats ? '...' : (stats?.logins_fallidos_24h ?? 0).toLocaleString()}
          alert={(stats?.logins_fallidos_24h ?? 0) > 0}
          alertColor="orange"
        />
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-3">
            {/* Búsqueda libre */}
            <div className="xl:col-span-3 relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por registro o usuario..."
                className="pl-8"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleFilter()}
              />
            </div>

            {/* Módulo */}
            <Select value={filterModule || '__all__'} onValueChange={v => setFilterModule(v === '__all__' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Módulo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos los módulos</SelectItem>
                {MODULES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>

            {/* Acción */}
            <Select value={filterAction || '__all__'} onValueChange={v => setFilterAction(v === '__all__' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Acción" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas las acciones</SelectItem>
                {ACTIONS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
              </SelectContent>
            </Select>

            {/* Usuario */}
            <Select value={filterUserId || '__all__'} onValueChange={v => setFilterUserId(v === '__all__' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Usuario" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos los usuarios</SelectItem>
                {users.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>

            {/* Fecha desde */}
            <Input
              type="date"
              className="text-xs"
              value={filterFechaDesde}
              onChange={e => setFilterFechaDesde(e.target.value)}
            />

            {/* Fecha hasta */}
            <Input
              type="date"
              className="text-xs"
              value={filterFechaHasta}
              onChange={e => setFilterFechaHasta(e.target.value)}
            />

            {/* IP */}
            <Input
              placeholder="Filtrar por IP..."
              className="text-xs font-mono"
              value={filterIp}
              onChange={e => setFilterIp(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleFilter()}
            />
          </div>

          {/* Botones */}
          <div className="flex gap-2 mt-3 flex-wrap">
            <Button onClick={handleFilter} disabled={loading} size="sm">
              {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
              Filtrar
            </Button>
            <Button variant="outline" size="sm" onClick={handleClear}>
              <X className="h-4 w-4 mr-1" /> Limpiar
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting} className="ml-auto">
              {exporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
              Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Registros{' '}
            {!loading && <span className="text-muted-foreground font-normal text-sm">({total.toLocaleString()} en total)</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Fecha / Hora</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead className="w-28">Acción</TableHead>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Registro</TableHead>
                  <TableHead className="w-32">IP</TableHead>
                  <TableHead className="w-12 text-center">Ver</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                      No se encontraron registros
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map(log => (
                    <TableRow key={log.id} className="hover:bg-muted/30">
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {fmtDateTime(log.created_at)}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {log.user_name ?? <span className="text-muted-foreground italic">Sistema</span>}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${ACTION_COLORS[log.action] ?? 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                          {ACTION_LABELS[log.action] ?? log.action}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{log.module}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate" title={log.model_label ?? ''}>
                        {log.model_label ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.ip_address ?? '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDetail(log)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Paginación */}
          {lastPage > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-sm text-muted-foreground">
                Página {page} de {lastPage}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline" size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => loadLogs(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline" size="sm"
                  disabled={page >= lastPage || loading}
                  onClick={() => loadLogs(page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de detalle */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-400" />
              Detalle del evento #{selectedLog?.id}
            </DialogTitle>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4">
              {/* Información del evento */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <InfoRow label="Fecha" value={fmtDateTime(selectedLog.created_at)} />
                <InfoRow label="Acción" value={
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${ACTION_COLORS[selectedLog.action] ?? ''}`}>
                    {ACTION_LABELS[selectedLog.action] ?? selectedLog.action}
                  </span>
                } />
                <InfoRow label="Usuario" value={selectedLog.user_name ?? 'Sistema'} />
                <InfoRow label="Módulo" value={selectedLog.module} />
                <InfoRow label="Tipo de registro" value={selectedLog.model_type?.split('\\').pop() ?? '—'} />
                <InfoRow label="ID Registro" value={selectedLog.model_id ?? '—'} />
                <InfoRow label="Referencia" value={selectedLog.model_label ?? '—'} />
                <InfoRow label="IP" value={selectedLog.ip_address ?? '—'} />
              </div>

              {selectedLog.user_agent && (
                <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2 break-all">
                  {selectedLog.user_agent}
                </div>
              )}

              {/* Tabla de cambios */}
              {selectedLog.changes && selectedLog.changes.length > 0 ? (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Campos modificados</h4>
                  <div className="rounded border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-1/4">Campo</TableHead>
                          <TableHead className="w-[37.5%]">Valor anterior</TableHead>
                          <TableHead className="w-[37.5%]">Valor nuevo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedLog.changes.map((ch, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-xs">{ch.field}</TableCell>
                            <TableCell className="text-xs text-red-400 break-all">
                              {formatValue(ch.old_value)}
                            </TableCell>
                            <TableCell className="text-xs text-green-400 break-all">
                              {formatValue(ch.new_value)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                selectedLog.action === 'update' && (
                  <p className="text-sm text-muted-foreground italic">Sin cambios de campos registrados.</p>
                )
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------
function StatCard({
  icon, label, value, alert, alertColor = 'red',
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color?: string;
  alert?: boolean;
  alertColor?: 'red' | 'orange';
}) {
  const borderMap = { red: 'border-red-500/50', orange: 'border-orange-500/50' };
  const textMap   = { red: 'text-red-400',      orange: 'text-orange-400' };
  const borderColor = alert ? borderMap[alertColor] : 'border-border/40';
  const textColor   = alert ? textMap[alertColor]   : '';
  return (
    <Card className={`border ${borderColor}`}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-2 mb-1">
          {icon}
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className={`text-2xl font-bold ${textColor}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
