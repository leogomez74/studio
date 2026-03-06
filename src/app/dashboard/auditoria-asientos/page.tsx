'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
  DialogDescription,
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
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Eye,
  RefreshCw,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import api from '@/lib/axios';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
interface AuditLogEntry {
  id: number;
  entry_type: string;
  reference: string;
  status: 'pending' | 'success' | 'error' | 'skipped';
  amount: string;
  total_debit: string | null;
  total_credit: string | null;
  erp_journal_entry_id: string | null;
  erp_message: string | null;
  error_message: string | null;
  http_status: number | null;
  payload_sent: Record<string, unknown> | null;
  erp_response: Record<string, unknown> | null;
  context: Record<string, unknown> | null;
  source_method: string | null;
  retry_count: number;
  max_retries: number;
  created_at: string;
}

interface AuditLogStats {
  totals: { total: number; success: number; error: number; skipped: number; pending: number };
}

interface AccountingAlerts {
  error_count: number;
  exhausted_retries: number;
  pending_retry: number;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------
const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  success: { label: 'Exitoso',  variant: 'default' },
  error:   { label: 'Error',    variant: 'destructive' },
  skipped: { label: 'Omitido', variant: 'secondary' },
  pending: { label: 'Pendiente', variant: 'outline' },
};

const ENTRY_TYPE_LABELS: Record<string, string> = {
  FORMALIZACION:          'Formalización',
  PAGO_PLANILLA:          'Pago Planilla',
  PAGO_VENTANILLA:        'Pago Ventanilla',
  ABONO_EXTRAORDINARIO:   'Abono Extraordinario',
  CANCELACION_ANTICIPADA: 'Cancelación Anticipada',
  PAGO:                   'Pago',
  DEVOLUCION:             'Devolución',
  REFUNDICION_CIERRE:     'Refundición Cierre',
  REFUNDICION_NUEVO:      'Refundición Nuevo',
  SALDO_SOBRANTE:         'Saldo Sobrante',
  REINTEGRO_SALDO:        'Reintegro de Saldo',
  ABONO_CAPITAL:          'Abono a Capital',
  ANULACION_PLANILLA:     'Anulación Planilla',
  ANULACION_SOBRANTE:     'Anulación Sobrante',
  REVERSO_PAGO:           'Anulación de Abono',
  REVERSO_EXTRAORDINARIO: 'Reverso Extraordinario',
  REVERSO_CANCELACION:    'Reverso Cancelación',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-CR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatAmount(amount: string | number | null) {
  if (amount === null || amount === undefined) return '-';
  return '₡' + Number(amount).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------
export default function AuditoriaAsientosPage() {
  const { toast } = useToast();

  const [logs, setLogs]       = useState<AuditLogEntry[]>([]);
  const [stats, setStats]     = useState<AuditLogStats | null>(null);
  const [alerts, setAlerts]   = useState<AccountingAlerts | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [detailOpen, setDetailOpen]   = useState(false);
  const [retryingId, setRetryingId]   = useState<number | null>(null);

  // Filtros
  const [filterEntryType, setFilterEntryType]   = useState('all');
  const [filterStatus, setFilterStatus]         = useState('all');
  const [filterSearch, setFilterSearch]         = useState('');
  const [filterFechaDesde, setFilterFechaDesde] = useState('');
  const [filterFechaHasta, setFilterFechaHasta] = useState('');

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage]       = useState(1);
  const [total, setTotal]             = useState(0);

  // ---------------------------------------------------------------------------
  // Carga de datos
  // ---------------------------------------------------------------------------
  const fetchLogs = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), per_page: '15' };
      if (filterEntryType !== 'all') params.entry_type = filterEntryType;
      if (filterStatus !== 'all')    params.status      = filterStatus;
      if (filterSearch)              params.search      = filterSearch;
      if (filterFechaDesde)          params.fecha_desde = filterFechaDesde;
      if (filterFechaHasta)          params.fecha_hasta = filterFechaHasta;

      const query = new URLSearchParams(params).toString();
      const res = await api.get(`/api/accounting-entry-logs?${query}`);
      setLogs(res.data.data || []);
      setCurrentPage(res.data.current_page || 1);
      setLastPage(res.data.last_page || 1);
      setTotal(res.data.total || 0);
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar los registros', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [filterEntryType, filterStatus, filterSearch, filterFechaDesde, filterFechaHasta, toast]);

  const fetchStats = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (filterFechaDesde) params.fecha_desde = filterFechaDesde;
      if (filterFechaHasta) params.fecha_hasta = filterFechaHasta;
      const query = new URLSearchParams(params).toString();
      const res = await api.get(`/api/accounting-entry-logs/stats?${query}`);
      setStats(res.data);
    } catch { /* silencioso */ }
  }, [filterFechaDesde, filterFechaHasta]);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await api.get('/api/accounting-entry-logs/alerts');
      setAlerts(res.data);
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => {
    fetchLogs(1);
    fetchStats();
    fetchAlerts();
  }, [fetchLogs, fetchStats, fetchAlerts]);

  // ---------------------------------------------------------------------------
  // Acciones
  // ---------------------------------------------------------------------------
  const handleSearch = () => {
    setCurrentPage(1);
    fetchLogs(1);
    fetchStats();
  };

  const handleClearFilters = () => {
    setFilterEntryType('all');
    setFilterStatus('all');
    setFilterSearch('');
    setFilterFechaDesde('');
    setFilterFechaHasta('');
    setCurrentPage(1);
  };

  const handleExportCSV = async () => {
    try {
      const params: Record<string, string> = {};
      if (filterEntryType !== 'all') params.entry_type  = filterEntryType;
      if (filterStatus !== 'all')    params.status      = filterStatus;
      if (filterSearch)              params.reference   = filterSearch;
      if (filterFechaDesde)          params.fecha_desde = filterFechaDesde;
      if (filterFechaHasta)          params.fecha_hasta = filterFechaHasta;
      const query = new URLSearchParams(params).toString();
      const res = await api.get(`/api/accounting-entry-logs/export?${query}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `asientos_contables_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Error', description: 'No se pudo exportar el CSV', variant: 'destructive' });
    }
  };

  const handleRetry = async (logId: number) => {
    setRetryingId(logId);
    try {
      const res = await api.post(`/api/accounting-entry-logs/${logId}/retry`);
      const success = res.data?.log?.status === 'success';
      toast({
        title: success ? 'Reintento exitoso' : 'Reintento falló',
        description: res.data?.message || (success ? 'El asiento fue reenviado al ERP.' : 'No se pudo reenviar.'),
        variant: success ? 'default' : 'destructive',
      });
      fetchLogs(currentPage);
      fetchStats();
      if (selectedLog?.id === logId && res.data?.log) {
        setSelectedLog(res.data.log);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al reintentar';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setRetryingId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <BookOpen className="h-6 w-6 text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold">Auditoría de Asientos Contables</h1>
          <p className="text-sm text-muted-foreground">Historial de asientos enviados al ERP</p>
        </div>
      </div>

      {/* Banner de alertas */}
      {alerts && (alerts.error_count > 0 || alerts.exhausted_retries > 0) && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">
                {alerts.error_count > 0 && (
                  <span>{alerts.error_count} error{alerts.error_count !== 1 ? 'es' : ''} en las últimas 48h. </span>
                )}
                {alerts.exhausted_retries > 0 && (
                  <span>{alerts.exhausted_retries} asiento{alerts.exhausted_retries !== 1 ? 's' : ''} agotaron reintentos automáticos. </span>
                )}
                {alerts.pending_retry > 0 && (
                  <span>{alerts.pending_retry} pendiente{alerts.pending_retry !== 1 ? 's' : ''} de reintento.</span>
                )}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => { setFilterStatus('error'); handleSearch(); }}>
              Ver errores
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats.totals.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.totals.success}</p>
            <p className="text-xs text-muted-foreground">Exitosos</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{stats.totals.error}</p>
            <p className="text-xs text-muted-foreground">Errores</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{stats.totals.skipped}</p>
            <p className="text-xs text-muted-foreground">Omitidos</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.totals.pending}</p>
            <p className="text-xs text-muted-foreground">Pendientes</p>
          </CardContent></Card>
        </div>
      )}

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select value={filterEntryType} onValueChange={setFilterEntryType}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(ENTRY_TYPE_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Estado</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="success">Exitoso</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="skipped">Omitido</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Desde</Label>
              <Input type="date" value={filterFechaDesde} onChange={e => setFilterFechaDesde(e.target.value)} className="w-[150px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hasta</Label>
              <Input type="date" value={filterFechaHasta} onChange={e => setFilterFechaHasta(e.target.value)} className="w-[150px]" />
            </div>
            <div className="space-y-1 flex-1 min-w-[200px]">
              <Label className="text-xs">Buscar</Label>
              <Input
                placeholder="Referencia, tipo, ID ERP..."
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} size="sm"><Search className="h-4 w-4 mr-1" /> Filtrar</Button>
            <Button onClick={handleClearFilters} variant="outline" size="sm"><RefreshCw className="h-4 w-4 mr-1" /> Limpiar</Button>
            <Button onClick={handleExportCSV} variant="outline" size="sm"><Download className="h-4 w-4 mr-1" /> Exportar CSV</Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No hay registros de asientos contables aún.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">ID</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>ID ERP</TableHead>
                  <TableHead>Reintentos</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs">{log.id}</TableCell>
                    <TableCell className="text-xs">{formatDate(log.created_at)}</TableCell>
                    <TableCell>
                      <span className="text-xs font-medium">{ENTRY_TYPE_LABELS[log.entry_type] || log.entry_type}</span>
                    </TableCell>
                    <TableCell className="font-mono text-xs max-w-[180px] truncate">{log.reference}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_CONFIG[log.status]?.variant || 'outline'}>
                        {STATUS_CONFIG[log.status]?.label || log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatAmount(log.amount)}</TableCell>
                    <TableCell className="text-xs">{log.source_method === 'configurable' ? 'Config' : 'Legacy'}</TableCell>
                    <TableCell className="font-mono text-xs">{log.erp_journal_entry_id || '-'}</TableCell>
                    <TableCell className="text-xs text-center">
                      {log.retry_count > 0 ? `${log.retry_count}/${log.max_retries}` : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedLog(log); setDetailOpen(true); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {log.status === 'error' && log.payload_sent && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRetry(log.id)}
                            disabled={retryingId === log.id}
                            title="Reintentar envío al ERP"
                          >
                            {retryingId === log.id
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <RefreshCw className="h-4 w-4 text-orange-500" />}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {lastPage > 1 && (
          <CardFooter className="flex items-center justify-between py-3">
            <p className="text-sm text-muted-foreground">{total} registros — Página {currentPage} de {lastPage}</p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => fetchLogs(currentPage - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={currentPage >= lastPage} onClick={() => fetchLogs(currentPage + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>

      {/* Dialog de Detalle */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle del Asiento #{selectedLog?.id}</DialogTitle>
            <DialogDescription>
              {selectedLog && formatDate(selectedLog.created_at)} — {selectedLog && (ENTRY_TYPE_LABELS[selectedLog.entry_type] || selectedLog.entry_type)}
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Referencia:</span>
                  <p className="font-mono">{selectedLog.reference}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Estado:</span>
                  <p><Badge variant={STATUS_CONFIG[selectedLog.status]?.variant || 'outline'}>{STATUS_CONFIG[selectedLog.status]?.label || selectedLog.status}</Badge></p>
                </div>
                <div>
                  <span className="text-muted-foreground">Monto:</span>
                  <p className="font-mono">{formatAmount(selectedLog.amount)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Origen:</span>
                  <p>{selectedLog.source_method === 'configurable' ? 'Configurable' : 'Legacy'}</p>
                </div>
                {selectedLog.erp_journal_entry_id && (
                  <div>
                    <span className="text-muted-foreground">ID en ERP:</span>
                    <p className="font-mono">{selectedLog.erp_journal_entry_id}</p>
                  </div>
                )}
                {selectedLog.total_debit && (
                  <div>
                    <span className="text-muted-foreground">Débito / Crédito:</span>
                    <p className="font-mono">{formatAmount(selectedLog.total_debit)} / {formatAmount(selectedLog.total_credit)}</p>
                  </div>
                )}
                {selectedLog.erp_message && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Mensaje ERP:</span>
                    <p>{selectedLog.erp_message}</p>
                  </div>
                )}
                {selectedLog.error_message && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Error:</span>
                    <p className="text-red-600">{selectedLog.error_message}</p>
                  </div>
                )}
                {(selectedLog.retry_count > 0 || selectedLog.status === 'error') && (
                  <div>
                    <span className="text-muted-foreground">Reintentos:</span>
                    <p>{selectedLog.retry_count} / {selectedLog.max_retries}</p>
                  </div>
                )}
              </div>

              {selectedLog.status === 'error' && selectedLog.payload_sent && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRetry(selectedLog.id)}
                  disabled={retryingId === selectedLog.id}
                  className="w-full"
                >
                  {retryingId === selectedLog.id
                    ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    : <RefreshCw className="h-4 w-4 mr-2" />}
                  Reintentar envío al ERP
                </Button>
              )}

              {selectedLog.context && Object.keys(selectedLog.context).length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Contexto</Label>
                  <pre className="mt-1 p-3 bg-muted rounded-md text-xs overflow-x-auto max-h-[200px]">
                    {JSON.stringify(selectedLog.context, null, 2)}
                  </pre>
                </div>
              )}
              {selectedLog.payload_sent && (
                <div>
                  <Label className="text-sm font-medium">Payload Enviado al ERP</Label>
                  <pre className="mt-1 p-3 bg-muted rounded-md text-xs overflow-x-auto max-h-[200px]">
                    {JSON.stringify(selectedLog.payload_sent, null, 2)}
                  </pre>
                </div>
              )}
              {selectedLog.erp_response && (
                <div>
                  <Label className="text-sm font-medium">Respuesta del ERP</Label>
                  <pre className="mt-1 p-3 bg-muted rounded-md text-xs overflow-x-auto max-h-[200px]">
                    {JSON.stringify(selectedLog.erp_response, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
