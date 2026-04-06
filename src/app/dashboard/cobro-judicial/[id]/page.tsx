'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarDays,
  ClipboardList,
  Edit,
  FileText,
  Gavel,
  Hash,
  RefreshCw,
  User,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ProtectedPage } from '@/components/ProtectedPage';
import api from '@/lib/axios';
import { toastSuccess, toastError } from '@/hooks/use-toast';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Actuacion {
  id: number;
  tipo: string;
  descripcion: string;
  user: { id: number; name: string } | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface Notificacion {
  id: number;
  tipo_acto: string;
  descripcion: string | null;
  fecha_acto: string | null;
  estado_procesamiento: string;
  confianza_clasificacion: number | null;
  archivo_pdf: string | null;
  recibido_at: string;
}

interface ExpedienteDetalle {
  id: number;
  numero_expediente: string | null;
  credit_id: number | null;
  cedula_deudor: string;
  nombre_deudor: string;
  patrono_deudor: string | null;
  patrono_anterior: string | null;
  monto_demanda: string;
  estado: string;
  sub_estado: string | null;
  credipep_es_actor: boolean;
  aprobado_por: { id: number; name: string } | null;
  propuesto_por: { id: number; name: string } | null;
  abogado: string | null;
  juzgado: string | null;
  fecha_presentacion: string | null;
  fecha_ultima_actuacion: string | null;
  alerta_impulso: boolean;
  alerta_prescripcion: boolean;
  notas: string | null;
  credit: {
    operacion: string;
    lead: { cedula: string; nombre: string; apellido: string };
  } | null;
  actuaciones: Actuacion[];
  notificaciones: Notificacion[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SUB_ESTADOS = [
  { value: 'curso', label: 'En Curso' },
  { value: 'embargo_salario', label: 'Embargo Salario' },
  { value: 'retencion', label: 'Retención' },
  { value: 'notificado', label: 'Notificado' },
] as const;

const TIPO_ACTUACION_LABELS: Record<string, string> = {
  cambio_estado: 'Cambio de estado',
  notificacion_recibida: 'Notificación recibida',
  actuacion_manual: 'Actuación manual',
  aprobacion: 'Aprobación',
  rechazo: 'Rechazo',
  alerta_inactividad: 'Alerta inactividad',
  nota: 'Nota',
};

const TIPO_ACTUACION_COLORS: Record<string, string> = {
  cambio_estado: 'text-blue-600',
  aprobacion: 'text-green-600',
  rechazo: 'text-red-600',
  alerta_inactividad: 'text-amber-600',
  notificacion_recibida: 'text-purple-600',
  actuacion_manual: 'text-foreground',
  nota: 'text-muted-foreground',
};

const fmt = (monto: string) =>
  `₡${parseFloat(monto).toLocaleString('de-DE', { minimumFractionDigits: 2 })}`;

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value ?? '—'}</p>
      </div>
    </div>
  );
}

// ─── Modal: Registrar actuación manual ───────────────────────────────────────

function ActuacionModal({
  expedienteId,
  open,
  onClose,
  onSuccess,
}: {
  expedienteId: number;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [descripcion, setDescripcion] = useState('');
  const [tipo, setTipo] = useState<'actuacion_manual' | 'nota'>('actuacion_manual');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!descripcion.trim()) return;
    setLoading(true);
    try {
      await api.post(`/api/cobro-judicial/expedientes/${expedienteId}/actuacion`, {
        descripcion,
        tipo,
      });
      toastSuccess('Actuación registrada', 'La actuación fue guardada y el contador reiniciado.');
      setDescripcion('');
      onSuccess();
      onClose();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toastError('Error', err.response?.data?.message ?? 'No se pudo registrar la actuación.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar actuación</DialogTitle>
          <DialogDescription>
            Registra una actuación manual. Esto reinicia el contador de impulso procesal (90 días).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="actuacion_manual">Actuación manual</SelectItem>
                <SelectItem value="nota">Nota interna</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Descripción <span className="text-destructive">*</span></Label>
            <Textarea
              placeholder="Describe la actuación realizada..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={submit} disabled={loading || !descripcion.trim()}>
            {loading ? 'Guardando...' : 'Registrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal: Cambiar sub-estado ────────────────────────────────────────────────

function SubEstadoModal({
  expedienteId,
  currentSubEstado,
  open,
  onClose,
  onSuccess,
}: {
  expedienteId: number;
  currentSubEstado: string | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [subEstado, setSubEstado] = useState(currentSubEstado ?? 'curso');
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      await api.patch(`/api/cobro-judicial/expedientes/${expedienteId}/sub-estado`, {
        sub_estado: subEstado,
        notas: notas || undefined,
      });
      toastSuccess('Sub-estado actualizado', `El expediente pasó a: ${subEstado}.`);
      onSuccess();
      onClose();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toastError('Error', err.response?.data?.message ?? 'No se pudo actualizar el sub-estado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambiar sub-estado</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Sub-estado</Label>
            <Select value={subEstado} onValueChange={setSubEstado}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUB_ESTADOS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Notas (opcional)</Label>
            <Textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Contexto del cambio..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>
            {loading ? 'Guardando...' : 'Actualizar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal: Cambiar patrono ───────────────────────────────────────────────────

function PatronoModal({
  expedienteId,
  currentPatrono,
  open,
  onClose,
  onSuccess,
}: {
  expedienteId: number;
  currentPatrono: string | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [patrono, setPatrono] = useState('');
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!patrono.trim()) return;
    setLoading(true);
    try {
      await api.patch(`/api/cobro-judicial/expedientes/${expedienteId}/patrono`, {
        patrono_nuevo: patrono,
        notas: notas || undefined,
      });
      toastSuccess('Patrono actualizado', 'El cambio de patrono fue registrado.');
      onSuccess();
      onClose();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toastError('Error', err.response?.data?.message ?? 'No se pudo actualizar el patrono.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambiar patrono (empleador)</DialogTitle>
          <DialogDescription>
            Patrono actual: <strong>{currentPatrono ?? '—'}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nuevo patrono <span className="text-destructive">*</span></Label>
            <Input
              value={patrono}
              onChange={(e) => setPatrono(e.target.value)}
              placeholder="Nombre de la institución / empresa..."
            />
          </div>
          <div className="space-y-2">
            <Label>Notas (opcional)</Label>
            <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={submit} disabled={loading || !patrono.trim()}>
            {loading ? 'Guardando...' : 'Actualizar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal: Actualizar número expediente ──────────────────────────────────────

function NumeroExpedienteModal({
  expedienteId,
  currentNumero,
  open,
  onClose,
  onSuccess,
}: {
  expedienteId: number;
  currentNumero: string | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [numero, setNumero] = useState('');
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!numero.trim()) return;
    setLoading(true);
    try {
      await api.patch(`/api/cobro-judicial/expedientes/${expedienteId}/numero-expediente`, {
        numero_expediente: numero,
        notas: notas || undefined,
      });
      toastSuccess('Número actualizado', 'El número de expediente fue actualizado.');
      onSuccess();
      onClose();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toastError('Error', err.response?.data?.message ?? 'No se pudo actualizar el número.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Actualizar número de expediente</DialogTitle>
          <DialogDescription>
            Número actual: <strong>{currentNumero ?? '—'}</strong>. Úsalo cuando hay incompetencia territorial y se genera un nuevo número.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nuevo número de expediente <span className="text-destructive">*</span></Label>
            <Input
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="26-000123-0182-CI"
            />
          </div>
          <div className="space-y-2">
            <Label>Notas (opcional)</Label>
            <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} placeholder="Ej: Incompetencia territorial, traslado al Juzgado de San José..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={submit} disabled={loading || !numero.trim()}>
            {loading ? 'Guardando...' : 'Actualizar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Trazabilidad ─────────────────────────────────────────────────────────────

function TrazabilidadList({ actuaciones }: { actuaciones: Actuacion[] }) {
  if (actuaciones.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground py-8">
        No hay actuaciones registradas.
      </p>
    );
  }

  return (
    <ol className="relative border-l border-border ml-3 space-y-6">
      {actuaciones.map((a) => (
        <li key={a.id} className="ml-4">
          <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-background bg-border" />
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className={`text-sm font-medium ${TIPO_ACTUACION_COLORS[a.tipo] ?? ''}`}>
                {TIPO_ACTUACION_LABELS[a.tipo] ?? a.tipo}
              </p>
              <p className="text-sm text-foreground mt-0.5">{a.descripcion}</p>
              {a.user && (
                <p className="text-xs text-muted-foreground mt-1">Por: {a.user.name}</p>
              )}
            </div>
            <time className="text-xs text-muted-foreground whitespace-nowrap">
              {new Date(a.created_at).toLocaleDateString('es-CR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </time>
          </div>
        </li>
      ))}
    </ol>
  );
}

// ─── Notificaciones vinculadas ────────────────────────────────────────────────

function NotificacionesList({ notificaciones }: { notificaciones: Notificacion[] }) {
  if (notificaciones.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground py-8">
        No hay notificaciones vinculadas.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {notificaciones.map((n) => (
        <div key={n.id} className="rounded-lg border p-3 space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{n.tipo_acto}</p>
            <Badge variant="outline" className="text-xs">
              {n.estado_procesamiento}
            </Badge>
          </div>
          {n.descripcion && (
            <p className="text-xs text-muted-foreground">{n.descripcion}</p>
          )}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {n.fecha_acto && <span>Fecha acto: {new Date(n.fecha_acto).toLocaleDateString('es-CR')}</span>}
            <span>Recibido: {new Date(n.recibido_at).toLocaleDateString('es-CR')}</span>
            {n.confianza_clasificacion && (
              <span>Confianza: {n.confianza_clasificacion}%</span>
            )}
          </div>
          {n.archivo_pdf && (
            <a
              href={n.archivo_pdf}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
            >
              <FileText className="h-3 w-3" /> Ver PDF
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Página de detalle ────────────────────────────────────────────────────────

export default function ExpedienteDetallePage() {
  const params = useParams();
  const id = params.id as string;

  const [expediente, setExpediente] = useState<ExpedienteDetalle | null>(null);
  const [loading, setLoading] = useState(true);

  // Modales
  const [actuacionOpen, setActuacionOpen] = useState(false);
  const [subEstadoOpen, setSubEstadoOpen] = useState(false);
  const [patronoOpen, setPatronoOpen] = useState(false);
  const [numeroOpen, setNumeroOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/cobro-judicial/expedientes/${id}`);
      setExpediente(res.data);
    } catch {
      toastError('Error', 'No se pudo cargar el expediente.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <ProtectedPage module="cobro_judicial">
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Cargando expediente...
        </div>
      </ProtectedPage>
    );
  }

  if (!expediente) {
    return (
      <ProtectedPage module="cobro_judicial">
        <div className="text-center py-24">
          <p className="text-muted-foreground">Expediente no encontrado.</p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/dashboard/cobro-judicial">Volver</Link>
          </Button>
        </div>
      </ProtectedPage>
    );
  }

  const isActivo = expediente.estado === 'activo';

  return (
    <ProtectedPage module="cobro_judicial">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" asChild>
              <Link href="/dashboard/cobro-judicial">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <Gavel className="h-5 w-5 text-muted-foreground" />
                {expediente.numero_expediente ?? `Expediente #${expediente.id}`}
                {!expediente.credipep_es_actor && (
                  <Badge variant="outline">Citado</Badge>
                )}
              </h1>
              <p className="text-sm text-muted-foreground">
                {expediente.nombre_deudor} · {expediente.cedula_deudor}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {isActivo && (
              <>
                <Button variant="outline" size="sm" onClick={() => setActuacionOpen(true)} className="gap-1">
                  <ClipboardList className="h-4 w-4" /> Actuación
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSubEstadoOpen(true)} className="gap-1">
                  <Edit className="h-4 w-4" /> Sub-estado
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" onClick={load}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Alertas */}
        {(expediente.alerta_impulso || expediente.alerta_prescripcion) && (
          <div className="flex gap-3 flex-wrap">
            {expediente.alerta_impulso && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-amber-800 text-sm dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4" />
                <strong>Alerta impulso procesal:</strong> más de 90 días sin actuación. Riesgo de abandono del proceso.
              </div>
            )}
            {expediente.alerta_prescripcion && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-red-800 text-sm dark:bg-red-950 dark:border-red-800 dark:text-red-200">
                <AlertTriangle className="h-4 w-4" />
                <strong>CRÍTICO — Prescripción:</strong> más de 4 años sin actuación. La deuda puede quedar irrecuperable.
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Info del expediente */}
          <div className="space-y-4 lg:col-span-1">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Información del expediente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <InfoRow icon={Hash} label="N° Expediente PJ" value={
                  <span className="flex items-center gap-2">
                    {expediente.numero_expediente ?? '—'}
                    {isActivo && (
                      <button
                        onClick={() => setNumeroOpen(true)}
                        className="text-muted-foreground hover:text-foreground"
                        title="Actualizar número"
                      >
                        <Edit className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                } />
                <InfoRow icon={User} label="Deudor" value={`${expediente.nombre_deudor} (${expediente.cedula_deudor})`} />
                <InfoRow icon={Building2} label="Patrono actual" value={
                  <span className="flex items-center gap-2">
                    {expediente.patrono_deudor ?? '—'}
                    {isActivo && (
                      <button
                        onClick={() => setPatronoOpen(true)}
                        className="text-muted-foreground hover:text-foreground"
                        title="Cambiar patrono"
                      >
                        <Edit className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                } />
                {expediente.patrono_anterior && (
                  <InfoRow icon={Building2} label="Patrono anterior" value={expediente.patrono_anterior} />
                )}
                <InfoRow icon={Gavel} label="Juzgado" value={expediente.juzgado} />
                <InfoRow icon={User} label="Abogado" value={expediente.abogado} />
                <InfoRow icon={CalendarDays} label="Fecha presentación" value={
                  expediente.fecha_presentacion
                    ? new Date(expediente.fecha_presentacion).toLocaleDateString('es-CR')
                    : null
                } />
                <InfoRow icon={CalendarDays} label="Última actuación" value={
                  expediente.fecha_ultima_actuacion
                    ? new Date(expediente.fecha_ultima_actuacion).toLocaleDateString('es-CR')
                    : null
                } />
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-1">Monto demanda</p>
                  <p className="text-lg font-semibold">{fmt(expediente.monto_demanda)}</p>
                </div>
                {expediente.credit && (
                  <Button variant="outline" size="sm" asChild className="w-full">
                    <Link href={`/dashboard/creditos/${expediente.credit_id}`}>
                      <FileText className="mr-2 h-4 w-4" /> Ver crédito ({expediente.credit.operacion})
                    </Link>
                  </Button>
                )}
                {expediente.notas && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-1">Notas</p>
                    <p className="text-sm">{expediente.notas}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Trazabilidad y notificaciones */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="trazabilidad">
              <TabsList>
                <TabsTrigger value="trazabilidad">
                  Trazabilidad
                  <Badge variant="secondary" className="ml-2">{expediente.actuaciones.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="notificaciones">
                  Notificaciones
                  <Badge variant="secondary" className="ml-2">{expediente.notificaciones.length}</Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="trazabilidad">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-base">Historial de actuaciones</CardTitle>
                    {isActivo && (
                      <Button size="sm" onClick={() => setActuacionOpen(true)} className="gap-1">
                        <ClipboardList className="h-4 w-4" /> Nueva actuación
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    <TrazabilidadList actuaciones={expediente.actuaciones} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="notificaciones">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Notificaciones judiciales</CardTitle>
                    <CardDescription>
                      Notificaciones del Poder Judicial recibidas y vinculadas a este expediente.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <NotificacionesList notificaciones={expediente.notificaciones} />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Modales */}
      <ActuacionModal
        expedienteId={expediente.id}
        open={actuacionOpen}
        onClose={() => setActuacionOpen(false)}
        onSuccess={load}
      />
      <SubEstadoModal
        expedienteId={expediente.id}
        currentSubEstado={expediente.sub_estado}
        open={subEstadoOpen}
        onClose={() => setSubEstadoOpen(false)}
        onSuccess={load}
      />
      <PatronoModal
        expedienteId={expediente.id}
        currentPatrono={expediente.patrono_deudor}
        open={patronoOpen}
        onClose={() => setPatronoOpen(false)}
        onSuccess={load}
      />
      <NumeroExpedienteModal
        expedienteId={expediente.id}
        currentNumero={expediente.numero_expediente}
        open={numeroOpen}
        onClose={() => setNumeroOpen(false)}
        onSuccess={load}
      />
    </ProtectedPage>
  );
}
