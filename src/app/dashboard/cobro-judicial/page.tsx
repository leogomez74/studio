'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle,
  Gavel,
  Inbox,
  MoreHorizontal,
  PlusCircle,
  RefreshCw,
  XCircle,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ProtectedPage } from '@/components/ProtectedPage';
import api from '@/lib/axios';
import { toastSuccess, toastError } from '@/hooks/use-toast';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Expediente {
  id: number;
  numero_expediente: string | null;
  credit_id: number | null;
  cedula_deudor: string;
  nombre_deudor: string;
  patrono_deudor: string | null;
  monto_demanda: string;
  estado: 'propuesto' | 'activo' | 'rechazado' | 'cerrado';
  sub_estado: 'curso' | 'embargo_salario' | 'retencion' | 'notificado' | null;
  credipep_es_actor: boolean;
  alerta_impulso: boolean;
  alerta_prescripcion: boolean;
  fecha_ultima_actuacion: string | null;
  propuesto_por?: { id: number; name: string };
  credit?: { operacion: string };
}

interface PosibleCredito {
  id: number;
  operacion: string;
  lead: { cedula: string; nombre: string; apellido: string } | null;
  deductora: { name: string } | null;
  status: string;
  monto_total: string;
}

interface NotificacionIndefinida {
  id: number;
  tipo_acto: string;
  descripcion: string | null;
  correo_origen: string | null;
  recibido_at: string;
  estado_procesamiento: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SUB_ESTADO_LABELS: Record<string, string> = {
  curso: 'En Curso',
  embargo_salario: 'Embargo Salario',
  retencion: 'Retención',
  notificado: 'Notificado',
};

function SubEstadoBadge({ sub }: { sub: string | null }) {
  if (!sub) return <span className="text-muted-foreground text-sm">—</span>;
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    curso: 'secondary',
    embargo_salario: 'default',
    retencion: 'destructive',
    notificado: 'outline',
  };
  return <Badge variant={variants[sub] ?? 'outline'}>{SUB_ESTADO_LABELS[sub] ?? sub}</Badge>;
}

function AlertaBadges({ exp }: { exp: Expediente }) {
  return (
    <div className="flex gap-1">
      {exp.alerta_impulso && (
        <Badge variant="destructive" title="Falta de impulso procesal (90+ días)">
          <AlertTriangle className="h-3 w-3 mr-1" /> Impulso
        </Badge>
      )}
      {exp.alerta_prescripcion && (
        <Badge variant="destructive" title="Riesgo de prescripción (4+ años)">
          <AlertTriangle className="h-3 w-3 mr-1" /> Prescripción
        </Badge>
      )}
    </div>
  );
}

const fmt = (monto: string) =>
  `₡${parseFloat(monto).toLocaleString('de-DE', { minimumFractionDigits: 2 })}`;

// ─── Tab: Expedientes activos ─────────────────────────────────────────────────

function ExpedientesTab({
  expedientes,
  loading,
  onRefresh,
}: {
  expedientes: Expediente[];
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Expedientes Activos</CardTitle>
          <CardDescription>Casos en proceso judicial gestionados por Credipep.</CardDescription>
        </div>
        <Button variant="outline" size="icon" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Expediente PJ</TableHead>
              <TableHead>Deudor</TableHead>
              <TableHead>Patrono</TableHead>
              <TableHead>Sub-estado</TableHead>
              <TableHead className="text-right">Monto Demanda</TableHead>
              <TableHead>Alertas</TableHead>
              <TableHead><span className="sr-only">Acciones</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : expedientes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No hay expedientes activos.
                </TableCell>
              </TableRow>
            ) : (
              expedientes.map((exp) => (
                <TableRow key={exp.id}>
                  <TableCell className="font-mono text-sm">
                    <Link
                      href={`/dashboard/cobro-judicial/${exp.id}`}
                      className="hover:underline font-medium"
                    >
                      {exp.numero_expediente ?? `#${exp.id}`}
                    </Link>
                    {!exp.credipep_es_actor && (
                      <Badge variant="outline" className="ml-2 text-xs">Citado</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{exp.nombre_deudor}</div>
                    <div className="text-xs text-muted-foreground">{exp.cedula_deudor}</div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {exp.patrono_deudor ?? '—'}
                  </TableCell>
                  <TableCell>
                    <SubEstadoBadge sub={exp.sub_estado} />
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {fmt(exp.monto_demanda)}
                  </TableCell>
                  <TableCell>
                    <AlertaBadges exp={exp} />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/dashboard/cobro-judicial/${exp.id}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── Tab: Propuestos (pendientes de aprobación) ──────────────────────────────

function PropuestosTab({
  propuestos,
  loading,
  onDecision,
}: {
  propuestos: Expediente[];
  loading: boolean;
  onDecision: (exp: Expediente, decision: 'aprobar' | 'rechazar') => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Propuestos — Pendientes de Aprobación</CardTitle>
        <CardDescription>
          Casos propuestos por el equipo de cobros. Aprueba o rechaza cada uno.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Deudor</TableHead>
              <TableHead>Cédula</TableHead>
              <TableHead className="text-right">Monto Demanda</TableHead>
              <TableHead>Propuesto por</TableHead>
              <TableHead>Notas</TableHead>
              <TableHead><span className="sr-only">Acciones</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : propuestos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No hay propuestas pendientes.
                </TableCell>
              </TableRow>
            ) : (
              propuestos.map((exp) => (
                <TableRow key={exp.id}>
                  <TableCell className="font-medium">{exp.nombre_deudor}</TableCell>
                  <TableCell className="text-muted-foreground">{exp.cedula_deudor}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(exp.monto_demanda)}</TableCell>
                  <TableCell>{exp.propuesto_por?.name ?? '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    —
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => onDecision(exp, 'aprobar')}
                        className="gap-1"
                      >
                        <CheckCircle className="h-3 w-3" /> Aprobar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => onDecision(exp, 'rechazar')}
                        className="gap-1"
                      >
                        <XCircle className="h-3 w-3" /> Rechazar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── Tab: Posibles ───────────────────────────────────────────────────────────

function PosiblesTab({
  posibles,
  loading,
  onProponer,
  onDescartar,
}: {
  posibles: PosibleCredito[];
  loading: boolean;
  onProponer: (credit: PosibleCredito) => void;
  onDescartar: (credit: PosibleCredito) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Posibles Casos Judiciales</CardTitle>
        <CardDescription>
          Créditos con 4+ meses de atraso que aún no tienen expediente judicial.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Operación</TableHead>
              <TableHead>Deudor</TableHead>
              <TableHead>Cédula</TableHead>
              <TableHead>Deductora</TableHead>
              <TableHead className="text-right">Monto Total</TableHead>
              <TableHead><span className="sr-only">Acciones</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : posibles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No hay casos posibles en este momento.
                </TableCell>
              </TableRow>
            ) : (
              posibles.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-sm font-medium">{c.operacion}</TableCell>
                  <TableCell>
                    {c.lead ? `${c.lead.nombre} ${c.lead.apellido}` : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.lead?.cedula ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{c.deductora?.name ?? '—'}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(c.monto_total)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => onProponer(c)}>
                          <Gavel className="mr-2 h-4 w-4" /> Proponer a Leo
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onDescartar(c)}
                          className="text-destructive"
                        >
                          <XCircle className="mr-2 h-4 w-4" /> Descartar caso
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── Tab: Notificaciones Indefinidas ─────────────────────────────────────────

function IndefinadasTab({
  notificaciones,
  loading,
  onRefresh,
}: {
  notificaciones: NotificacionIndefinida[];
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Notificaciones Indefinidas</CardTitle>
          <CardDescription>
            Correos recibidos que no pudieron ser clasificados automáticamente por la IA.
          </CardDescription>
        </div>
        <Button variant="outline" size="icon" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo de Acto</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Correo Origen</TableHead>
              <TableHead>Recibido</TableHead>
              <TableHead><span className="sr-only">Acciones</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : notificaciones.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  <Inbox className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                  No hay notificaciones indefinidas.
                </TableCell>
              </TableRow>
            ) : (
              notificaciones.map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="font-medium">{n.tipo_acto}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {n.descripcion ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{n.correo_origen ?? '—'}</TableCell>
                  <TableCell className="text-sm">
                    {new Date(n.recibido_at).toLocaleDateString('es-CR')}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/cobro-judicial/notificaciones/${n.id}`}>
                            Ver y Clasificar
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── Modales ─────────────────────────────────────────────────────────────────

function ProponerModal({
  credit,
  onClose,
  onSuccess,
}: {
  credit: PosibleCredito | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!credit) return;
    setLoading(true);
    try {
      await api.post('/api/cobro-judicial/proponer', { credit_id: credit.id, notas });
      toastSuccess('Propuesta enviada', 'El caso fue propuesto para aprobación de Leo.');
      onSuccess();
      onClose();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toastError('Error', err.response?.data?.message ?? 'No se pudo enviar la propuesta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!credit} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Proponer caso a cobro judicial</DialogTitle>
          <DialogDescription>
            {credit
              ? `${credit.lead ? `${credit.lead.nombre} ${credit.lead.apellido}` : credit.operacion} — ${fmt(credit.monto_total)}`
              : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Notas (opcional)</Label>
            <Textarea
              placeholder="Observaciones para Leo..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>
            {loading ? 'Enviando...' : 'Proponer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DescartarModal({
  credit,
  onClose,
  onSuccess,
}: {
  credit: PosibleCredito | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!credit || !motivo.trim()) return;
    setLoading(true);
    try {
      await api.post(`/api/cobro-judicial/posibles/${credit.id}/descartar`, { motivo });
      toastSuccess('Caso descartado', 'El crédito fue removido de la lista de posibles.');
      onSuccess();
      onClose();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toastError('Error', err.response?.data?.message ?? 'No se pudo descartar el caso.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!credit} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Descartar caso</DialogTitle>
          <DialogDescription>
            Este crédito será removido de los posibles casos judiciales con trazabilidad.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Motivo del descarte <span className="text-destructive">*</span></Label>
            <Textarea
              placeholder="Explica por qué se descarta este caso..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={loading || !motivo.trim()}
          >
            {loading ? 'Descartando...' : 'Descartar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DecisionModal({
  expediente,
  decision,
  onClose,
  onSuccess,
}: {
  expediente: Expediente | null;
  decision: 'aprobar' | 'rechazar' | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [razon, setRazon] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!expediente || !decision) return;
    if (decision === 'rechazar' && !razon.trim()) return;
    setLoading(true);
    try {
      await api.post(`/api/cobro-judicial/expedientes/${expediente.id}/decision`, {
        decision,
        razon_rechazo: decision === 'rechazar' ? razon : undefined,
      });
      toastSuccess(
        decision === 'aprobar' ? 'Caso aprobado' : 'Caso rechazado',
        decision === 'aprobar'
          ? 'El expediente quedó en estado activo.'
          : 'El expediente fue rechazado.',
      );
      onSuccess();
      onClose();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toastError('Error', err.response?.data?.message ?? 'No se pudo procesar la decisión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!expediente && !!decision} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {decision === 'aprobar' ? 'Aprobar propuesta' : 'Rechazar propuesta'}
          </DialogTitle>
          <DialogDescription>
            {expediente?.nombre_deudor} — {expediente ? fmt(expediente.monto_demanda) : ''}
          </DialogDescription>
        </DialogHeader>
        {decision === 'rechazar' && (
          <div className="space-y-2 py-2">
            <Label>Razón del rechazo <span className="text-destructive">*</span></Label>
            <Textarea
              placeholder="Explica el motivo del rechazo..."
              value={razon}
              onChange={(e) => setRazon(e.target.value)}
              rows={3}
            />
          </div>
        )}
        {decision === 'aprobar' && (
          <p className="text-sm text-muted-foreground py-2">
            El expediente pasará a estado <strong>Activo — En Curso</strong>.
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button
            variant={decision === 'rechazar' ? 'destructive' : 'default'}
            onClick={submit}
            disabled={loading || (decision === 'rechazar' && !razon.trim())}
          >
            {loading ? 'Procesando...' : decision === 'aprobar' ? 'Confirmar aprobación' : 'Confirmar rechazo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RegistrarCitadoModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    cedula_deudor: '',
    nombre_deudor: '',
    numero_expediente: '',
    monto_demanda: '',
    juzgado: '',
    abogado: '',
    notas: '',
  });
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setLoading(true);
    try {
      await api.post('/api/cobro-judicial/registrar-citado', {
        ...form,
        monto_demanda: form.monto_demanda ? parseFloat(form.monto_demanda) : undefined,
      });
      toastSuccess('Expediente registrado', 'El caso donde Credipep fue citada quedó registrado.');
      onSuccess();
      onClose();
      setForm({ cedula_deudor: '', nombre_deudor: '', numero_expediente: '', monto_demanda: '', juzgado: '', abogado: '', notas: '' });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toastError('Error', err.response?.data?.message ?? 'No se pudo registrar el expediente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar expediente — Credipep citada</DialogTitle>
          <DialogDescription>
            Usa esto cuando Credipep fue citada en un proceso judicial (no es el actor).
            No requiere aprobación.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="space-y-2">
            <Label>Cédula deudor <span className="text-destructive">*</span></Label>
            <Input value={form.cedula_deudor} onChange={(e) => set('cedula_deudor', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Nombre deudor <span className="text-destructive">*</span></Label>
            <Input value={form.nombre_deudor} onChange={(e) => set('nombre_deudor', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>N° Expediente PJ</Label>
            <Input value={form.numero_expediente} onChange={(e) => set('numero_expediente', e.target.value)} placeholder="26-000123-0182-CI" />
          </div>
          <div className="space-y-2">
            <Label>Monto demanda</Label>
            <Input type="number" value={form.monto_demanda} onChange={(e) => set('monto_demanda', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Juzgado</Label>
            <Input value={form.juzgado} onChange={(e) => set('juzgado', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Abogado</Label>
            <Input value={form.abogado} onChange={(e) => set('abogado', e.target.value)} />
          </div>
          <div className="col-span-2 space-y-2">
            <Label>Notas</Label>
            <Textarea value={form.notas} onChange={(e) => set('notas', e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button
            onClick={submit}
            disabled={loading || !form.cedula_deudor.trim() || !form.nombre_deudor.trim()}
          >
            {loading ? 'Registrando...' : 'Registrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function CobroJudicialPage() {
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [propuestos, setPropuestos] = useState<Expediente[]>([]);
  const [posibles, setPosibles] = useState<PosibleCredito[]>([]);
  const [indefinidas, setIndefinidas] = useState<NotificacionIndefinida[]>([]);
  const [loadingExp, setLoadingExp] = useState(false);
  const [loadingProp, setLoadingProp] = useState(false);
  const [loadingPos, setLoadingPos] = useState(false);
  const [loadingInd, setLoadingInd] = useState(false);

  // Modal state
  const [proponerCredit, setProponerCredit] = useState<PosibleCredito | null>(null);
  const [descartarCredit, setDescartarCredit] = useState<PosibleCredito | null>(null);
  const [decisionExp, setDecisionExp] = useState<Expediente | null>(null);
  const [decisionTipo, setDecisionTipo] = useState<'aprobar' | 'rechazar' | null>(null);
  const [citadoOpen, setCitadoOpen] = useState(false);

  const loadExpedientes = useCallback(async () => {
    setLoadingExp(true);
    try {
      const res = await api.get('/api/cobro-judicial/expedientes?estado=activo');
      setExpedientes(res.data.data ?? res.data);
    } catch {
      toastError('Error', 'No se pudieron cargar los expedientes.');
    } finally {
      setLoadingExp(false);
    }
  }, []);

  const loadPropuestos = useCallback(async () => {
    setLoadingProp(true);
    try {
      const res = await api.get('/api/cobro-judicial/expedientes?estado=propuesto');
      setPropuestos(res.data.data ?? res.data);
    } catch {
      toastError('Error', 'No se pudieron cargar las propuestas.');
    } finally {
      setLoadingProp(false);
    }
  }, []);

  const loadPosibles = useCallback(async () => {
    setLoadingPos(true);
    try {
      const res = await api.get('/api/cobro-judicial/posibles');
      setPosibles(res.data);
    } catch {
      toastError('Error', 'No se pudieron cargar los posibles casos.');
    } finally {
      setLoadingPos(false);
    }
  }, []);

  const loadIndefinidas = useCallback(async () => {
    setLoadingInd(true);
    try {
      const res = await api.get('/api/cobro-judicial/notificaciones/indefinidas');
      setIndefinidas(res.data.data ?? res.data);
    } catch {
      toastError('Error', 'No se pudieron cargar las notificaciones indefinidas.');
    } finally {
      setLoadingInd(false);
    }
  }, []);

  useEffect(() => {
    loadExpedientes();
    loadPropuestos();
    loadPosibles();
    loadIndefinidas();
  }, [loadExpedientes, loadPropuestos, loadPosibles, loadIndefinidas]);

  const handleDecision = (exp: Expediente, decision: 'aprobar' | 'rechazar') => {
    setDecisionExp(exp);
    setDecisionTipo(decision);
  };

  return (
    <ProtectedPage module="cobro_judicial">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Cobro Judicial</h1>
            <p className="text-sm text-muted-foreground">
              Gestión de expedientes judiciales y notificaciones del PJ.
            </p>
          </div>
          <Button onClick={() => setCitadoOpen(true)} variant="outline" className="gap-2">
            <PlusCircle className="h-4 w-4" /> Registrar citado
          </Button>
        </div>

        <Tabs defaultValue="activos">
          <TabsList>
            <TabsTrigger value="activos">
              Activos
              {expedientes.length > 0 && (
                <Badge variant="secondary" className="ml-2">{expedientes.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="propuestos">
              Propuestos
              {propuestos.length > 0 && (
                <Badge variant="default" className="ml-2">{propuestos.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="posibles">
              Posibles
              {posibles.length > 0 && (
                <Badge variant="outline" className="ml-2">{posibles.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="indefinidas">
              Indefinidas
              {indefinidas.length > 0 && (
                <Badge variant="destructive" className="ml-2">{indefinidas.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="activos">
            <ExpedientesTab
              expedientes={expedientes}
              loading={loadingExp}
              onRefresh={loadExpedientes}
            />
          </TabsContent>

          <TabsContent value="propuestos">
            <PropuestosTab
              propuestos={propuestos}
              loading={loadingProp}
              onDecision={handleDecision}
            />
          </TabsContent>

          <TabsContent value="posibles">
            <PosiblesTab
              posibles={posibles}
              loading={loadingPos}
              onProponer={setProponerCredit}
              onDescartar={setDescartarCredit}
            />
          </TabsContent>

          <TabsContent value="indefinidas">
            <IndefinadasTab
              notificaciones={indefinidas}
              loading={loadingInd}
              onRefresh={loadIndefinidas}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Modales */}
      <ProponerModal
        credit={proponerCredit}
        onClose={() => setProponerCredit(null)}
        onSuccess={() => { loadPosibles(); loadPropuestos(); }}
      />
      <DescartarModal
        credit={descartarCredit}
        onClose={() => setDescartarCredit(null)}
        onSuccess={loadPosibles}
      />
      <DecisionModal
        expediente={decisionExp}
        decision={decisionTipo}
        onClose={() => { setDecisionExp(null); setDecisionTipo(null); }}
        onSuccess={() => { loadPropuestos(); loadExpedientes(); }}
      />
      <RegistrarCitadoModal
        open={citadoOpen}
        onClose={() => setCitadoOpen(false)}
        onSuccess={loadExpedientes}
      />
    </ProtectedPage>
  );
}
