'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Loader2, Search, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/axios';
import type { ManchaDetalle, JuicioDetalle, EmbargoDetalle, DeduccionMensual } from '@/lib/analisis';
import type { Opportunity } from '@/lib/data';

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export interface DatosPreAnalisis {
  // Credid
  numero_manchas: number;
  numero_juicios: number;
  numero_embargos: number;
  manchas_detalle: ManchaDetalle[];
  juicios_detalle: JuicioDetalle[];
  embargos_detalle: EmbargoDetalle[];
  cargo: string;
  nombramiento: string;
  score: number | null;
  scoreRiesgo: { score_riesgo: number; score_riesgo_color: string; score_riesgo_label: string } | null;
  // Ingresos (1-12; quincenas para micro, meses para regular)
  ingreso_bruto: string;
  ingreso_bruto_2: string;
  ingreso_bruto_3: string;
  ingreso_bruto_4: string;
  ingreso_bruto_5: string;
  ingreso_bruto_6: string;
  ingreso_bruto_7: string;
  ingreso_bruto_8: string;
  ingreso_bruto_9: string;
  ingreso_bruto_10: string;
  ingreso_bruto_11: string;
  ingreso_bruto_12: string;
  deducciones_mensuales: DeduccionMensual[];
  // Propuesta
  monto_sugerido: string;
  plazo: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return '₡' + v.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Agrega puntos de miles para mostrar en el input (ej: "300000" → "300.000") */
function withCommas(raw: string): string {
  if (!raw) return '';
  return raw.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Quita comas y caracteres no numéricos para guardar en estado */
function stripCommas(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

/** Elige negro o blanco según luminosidad del fondo para que el texto siempre sea legible */
function contrastColor(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return '#fff';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55 ? '#000' : '#fff';
}

// ─── Componente ───────────────────────────────────────────────────────────────

interface HojaDeTrabajoProps {
  opportunity: Opportunity;
  onCrearAnalisis: (datos: DatosPreAnalisis) => void;
}

export function HojaDeTrabajo({ opportunity, onCrearAnalisis }: HojaDeTrabajoProps) {
  const { toast } = useToast();
  const lead = opportunity.lead;
  const esMicro = (opportunity.opportunity_type || '').toLowerCase().includes('micro');
  const totalPeriodos = esMicro ? 6 : 12;
  const labelPeriodo = esMicro ? 'Quincena' : 'Mes';

  // ── Paso 1: Credid ──────────────────────────────────────────────────────────
  const [credidData, setCredidData] = useState<any>(null);
  const [loadingCredid, setLoadingCredid] = useState(false);
  const [credidError, setCredidError] = useState('');

  const consultarCredid = async () => {
    if (!lead?.cedula) {
      toast({ title: 'Cédula no disponible', description: 'El lead no tiene cédula registrada.', variant: 'destructive' });
      return;
    }
    setLoadingCredid(true);
    setCredidError('');
    try {
      const res = await api.get('/api/credid/reporte', { params: { cedula: lead.cedula } });
      if (res.data.success) {
        setCredidData(res.data.datos_analisis);
      } else {
        setCredidError(res.data.message || 'No se pudo obtener el reporte.');
      }
    } catch (err: any) {
      setCredidError(err.response?.data?.message || 'Error al consultar Credid.');
    } finally {
      setLoadingCredid(false);
    }
  };

  // ── Paso 2: Ingresos ─────────────────────────────────────────────────────────
  const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  // Para micro: 3 meses × 2 quincenas = 6 periodos. Para regular: 12 meses = 12 periodos.
  const totalMeses = esMicro ? 3 : 12;
  const mesesNombres = useMemo(() => Array.from({ length: totalMeses }, (_, i) => {
    const d = new Date();
    // Excluir el mes actual (en circulación), empezar desde el mes anterior
    d.setMonth(d.getMonth() - (totalMeses - i));
    return MESES_ES[d.getMonth()];
  }), [totalMeses]);

  const [ingresos, setIngresos] = useState(() =>
    Array.from({ length: 12 }, (_, i) => ({ num: i + 1, liquido: '' }))
  );

  const updateIngreso = (num: number, value: string) => {
    setIngresos(prev => prev.map(i => i.num === num ? { ...i, liquido: stripCommas(value) } : i));
  };

  const periodos = ingresos.slice(0, totalPeriodos);

  // Solo calcular promedio cuando TODOS los períodos tengan líquido > 0
  const todosLlenos = useMemo(() =>
    periodos.every(i => (parseFloat(i.liquido) || 0) > 0),
    [periodos]
  );

  // Para micro: promedio = suma de totales mensuales (q1+q2) / 3 meses
  // Para regular: promedio = suma de líquidos / 12
  const promedioLiquido = useMemo(() => {
    if (!todosLlenos) return 0;
    const vals = periodos.map(i => parseFloat(i.liquido) || 0);
    if (esMicro) {
      // Sumar pares (q1+q2) por mes y promediar
      const totalesMes = Array.from({ length: totalMeses }, (_, mi) =>
        (vals[mi * 2] || 0) + (vals[mi * 2 + 1] || 0)
      );
      return totalesMes.reduce((a, b) => a + b, 0) / totalMeses;
    }
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [periodos, todosLlenos, esMicro, totalMeses]);

  // ── Paso 3: Embargo ──────────────────────────────────────────────────────────
  const [pensionAlimenticia, setPensionAlimenticia] = useState('');
  const [otroEmbargo, setOtroEmbargo] = useState('');
  const [embargableResult, setEmbargableResult] = useState<any>(null);
  const [loadingEmbargo, setLoadingEmbargo] = useState(false);

  const calcularEmbargo = useCallback(async (bruto: number) => {
    if (bruto <= 0) return;
    setLoadingEmbargo(true);
    try {
      const res = await api.post('/api/calcular-embargo', {
        salario_bruto: bruto,
        pension_alimenticia: parseFloat(pensionAlimenticia) || 0,
        otro_embargo_1: parseFloat(otroEmbargo) || 0,
      });
      setEmbargableResult(res.data);
    } catch { /* silencioso */ }
    finally { setLoadingEmbargo(false); }
  }, [pensionAlimenticia, otroEmbargo]);

  useEffect(() => {
    if (promedioLiquido > 0) {
      const t = setTimeout(() => calcularEmbargo(promedioLiquido), 600);
      return () => clearTimeout(t);
    }
  }, [promedioLiquido, pensionAlimenticia, otroEmbargo, calcularEmbargo]);

  // ── Paso 4: Propuesta ────────────────────────────────────────────────────────
  const [montoSugerido, setMontoSugerido] = useState('');
  const [plazo, setPlazo] = useState('36');
  const [loanConfigs, setLoanConfigs] = useState<Record<string, any>>({});

  useEffect(() => {
    api.get('/api/loan-configurations/rangos').then(r => setLoanConfigs(r.data)).catch(() => {});
  }, []);

  const cuotaCalculada = useMemo(() => {
    const monto = parseFloat(montoSugerido) || 0;
    const m = parseInt(plazo) || 0;
    if (monto <= 0 || m <= 0) return 0;
    const cfg = loanConfigs[esMicro ? 'microcredito' : 'regular'];
    const ta = cfg ? parseFloat(String(cfg.tasa_anual)) : (esMicro ? 54 : 36);
    const r = (ta / 100) / 12;
    if (r <= 0) return monto / m;
    const p = Math.pow(1 + r, m);
    return monto * ((r * p) / (p - 1));
  }, [montoSugerido, plazo, loanConfigs, esMicro]);

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleCrearAnalisis = () => {
    const get = (num: number) => ingresos.find(i => i.num === num)?.liquido ?? '';
    onCrearAnalisis({
      numero_manchas: credidData?.numero_manchas || 0,
      numero_juicios: credidData?.numero_juicios || 0,
      numero_embargos: credidData?.numero_embargos || 0,
      manchas_detalle: credidData?.manchas_detalle || [],
      juicios_detalle: credidData?.juicios_detalle || [],
      embargos_detalle: credidData?.embargos_detalle || [],
      cargo: credidData?.cargo || lead?.puesto || '',
      nombramiento: credidData?.nombramiento || lead?.estado_puesto || '',
      score: credidData?.score ?? null,
      scoreRiesgo: credidData?.score_riesgo != null ? {
        score_riesgo: credidData.score_riesgo,
        score_riesgo_color: credidData.score_riesgo_color,
        score_riesgo_label: credidData.score_riesgo_label,
      } : null,
      ingreso_bruto: get(1),
      ingreso_bruto_2: get(2),
      ingreso_bruto_3: get(3),
      ingreso_bruto_4: get(4),
      ingreso_bruto_5: get(5),
      ingreso_bruto_6: get(6),
      ingreso_bruto_7: get(7),
      ingreso_bruto_8: get(8),
      ingreso_bruto_9: get(9),
      ingreso_bruto_10: get(10),
      ingreso_bruto_11: get(11),
      ingreso_bruto_12: get(12),
      deducciones_mensuales: [],
      monto_sugerido: montoSugerido,
      plazo,
    });
  };

  const desglose = embargableResult?.desglose;
  const totalEmbargo = desglose?.total_embargo ?? embargableResult?.resultado ?? 0;
  const cuotaSuperaEmbargo = cuotaCalculada > 0 && embargableResult != null && cuotaCalculada > totalEmbargo;

  const cfg = loanConfigs[esMicro ? 'microcredito' : 'regular'];
  const montoMaxConfig = cfg ? parseFloat(String(cfg.monto_maximo)) : (esMicro ? 690000 : Infinity);
  const montoMinConfig = cfg ? parseFloat(String(cfg.monto_minimo)) : 0;
  const montoActual = parseFloat(montoSugerido) || 0;
  const montoSuperaLimite = montoActual > 0 && montoActual > montoMaxConfig;
  const montoBajoMinimo = montoActual > 0 && montoActual < montoMinConfig;

  return (
    <div className="space-y-4">

      {/* ── Card 1: Credid ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-5">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">1</span>
            <CardTitle className="text-sm font-semibold">Récord Crediticio (Credid)</CardTitle>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {lead?.name && <strong className="text-slate-700">{lead.name} · </strong>}
                Cédula: <strong>{lead?.cedula || '—'}</strong>
              </span>
              <Button onClick={consultarCredid} disabled={loadingCredid || !lead?.cedula} size="sm" variant="outline" className="h-7 text-xs gap-1.5">
                {loadingCredid ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                {credidData ? 'Actualizar' : 'Consultar Credid'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {credidError && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 p-2.5 rounded mb-3">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {credidError}
            </div>
          )}
          {!credidData && !loadingCredid && (
            <div className="text-xs text-muted-foreground text-center py-4 bg-slate-50 rounded">
              Haz clic en "Consultar Credid" para obtener el récord crediticio
            </div>
          )}
          {credidData && (
            <div className="space-y-3">
              {/* Contadores + Score en una fila */}
              <div className="flex items-center gap-3 flex-wrap">
                {[
                  { label: 'Manchas', val: credidData.numero_manchas, color: 'red' },
                  { label: 'Juicios', val: credidData.numero_juicios, color: 'orange' },
                  { label: 'Embargos', val: credidData.numero_embargos, color: 'orange' },
                ].map(({ label, val, color }) => (
                  <div key={label} className="flex items-center gap-1.5 bg-slate-50 rounded px-3 py-1.5">
                    <span className="text-xs text-muted-foreground">{label}:</span>
                    <span className={`text-base font-bold ${val > 0 ? `text-${color}-600` : 'text-green-600'}`}>{val}</span>
                  </div>
                ))}
                {credidData.score_riesgo != null && (() => {
                  const s = credidData.score_riesgo;
                  const cls = s >= 67
                    ? 'bg-green-100 text-green-800 border-green-300'
                    : s >= 34
                    ? 'bg-orange-100 text-orange-800 border-orange-300'
                    : 'bg-red-100 text-red-800 border-red-300';
                  return (
                    <Badge variant="outline" className={`text-xs font-semibold ${cls}`}>
                      Score {s}/100 — {credidData.score_riesgo_label}
                    </Badge>
                  );
                })()}
                {credidData.cargo && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    {credidData.cargo} {credidData.nombramiento && `· ${credidData.nombramiento}`}
                  </span>
                )}
              </div>

              {/* Detalles colapsados en texto pequeño */}
              {credidData.manchas_detalle?.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Manchas</p>
                  {credidData.manchas_detalle.map((m: ManchaDetalle, i: number) => (
                    <div key={i} className="text-xs flex justify-between bg-red-50 rounded px-2.5 py-1.5">
                      <span className="text-muted-foreground">{m.fecha_inicio} — {m.descripcion}</span>
                      <span className="font-medium text-red-700">₡{m.monto.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
              {credidData.juicios_detalle?.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Juicios</p>
                  {credidData.juicios_detalle.map((j: JuicioDetalle, i: number) => (
                    <div key={i} className="text-xs flex justify-between bg-orange-50 rounded px-2.5 py-1.5">
                      <span className="text-muted-foreground">
                        {j.fecha_inicio}{j.estado && ` — ${j.estado}`}{j.expediente && ` · Exp: ${j.expediente}`}
                      </span>
                      {j.monto != null && <span className="font-medium text-orange-700 shrink-0 ml-3">₡{j.monto.toLocaleString()}</span>}
                    </div>
                  ))}
                </div>
              )}
              {credidData.embargos_detalle?.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Embargos</p>
                  {credidData.embargos_detalle.map((e: EmbargoDetalle, i: number) => (
                    <div key={i} className="text-xs flex justify-between bg-yellow-50 rounded px-2.5 py-1.5">
                      <span className="text-muted-foreground">
                        {e.fecha_inicio}{e.motivo && ` — ${e.motivo}`}
                      </span>
                      {e.monto != null && <span className="font-medium text-yellow-700 shrink-0 ml-3">₡{e.monto.toLocaleString()}</span>}
                    </div>
                  ))}
                </div>
              )}
              {credidData.numero_manchas === 0 && credidData.numero_juicios === 0 && credidData.numero_embargos === 0 && (
                <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 px-3 py-2 rounded">
                  <CheckCircle className="h-3.5 w-3.5" /> Récord limpio
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Card 2: Colillas ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-5">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">2</span>
            <CardTitle className="text-sm font-semibold">
              {esMicro ? `Colillas / Ingresos (${totalMeses} meses × 2 quincenas)` : `Colillas / Ingresos (12 meses)`}
            </CardTitle>
            {promedioLiquido > 0 && (
              <Badge variant="outline" className="ml-auto text-blue-700 border-blue-300 text-xs">
                Prom. mensual: {fmt(promedioLiquido)}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {esMicro ? (
            /* Micro: 3 meses × 2 quincenas */
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-3">
              {mesesNombres.map((nombreMes, mi) => {
                const q1 = ingresos[mi * 2];
                const q2 = ingresos[mi * 2 + 1];
                const totalMes = (parseFloat(q1?.liquido) || 0) + (parseFloat(q2?.liquido) || 0);
                return (
                  <div key={mi} className="border rounded-md p-3 bg-slate-50">
                    <p className="text-xs font-semibold text-slate-700 mb-2">{nombreMes}</p>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-slate-500 w-5">1Q</span>
                        <Input
                          value={withCommas(q1?.liquido || '')}
                          onChange={e => updateIngreso(q1.num, e.target.value)}
                          placeholder="0"
                          className="h-7 text-xs px-2 flex-1"
                          inputMode="numeric"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-slate-500 w-5">2Q</span>
                        <Input
                          value={withCommas(q2?.liquido || '')}
                          onChange={e => updateIngreso(q2.num, e.target.value)}
                          placeholder="0"
                          className="h-7 text-xs px-2 flex-1"
                          inputMode="numeric"
                        />
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                        <span className="text-[10px] text-slate-500">Total</span>
                        <span className={`text-xs font-semibold tabular-nums ${totalMes > 0 ? 'text-green-700' : 'text-slate-400'}`}>
                          {totalMes > 0 ? fmt(totalMes) : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Regular: 12 meses, 1 entrada por mes */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              {[0, 1].map(col => {
                const mitad = Math.ceil(totalMeses / 2);
                const inicio = col === 0 ? 0 : mitad;
                const grupo = mesesNombres.slice(inicio, col === 0 ? mitad : totalMeses);
                return (
                  <div key={col}>
                    {grupo.map((nombreMes, idx) => {
                      const ingreso = ingresos[inicio + idx];
                      const hayLiquido = (parseFloat(ingreso?.liquido) || 0) > 0;
                      return (
                        <div key={inicio + idx} className="grid grid-cols-[80px_minmax(0,1fr)] gap-2 items-center py-1 border-b border-dashed">
                          <span className="text-xs font-medium text-slate-600">{nombreMes}</span>
                          <Input
                            value={withCommas(ingreso?.liquido || '')}
                            onChange={e => updateIngreso(ingreso.num, e.target.value)}
                            placeholder="0"
                            className={`h-7 text-xs px-2 ${hayLiquido ? 'border-green-300' : ''}`}
                            inputMode="numeric"
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {!todosLlenos && periodos.some(i => (parseFloat(i.liquido) || 0) > 0) && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-amber-50 rounded border border-amber-200 text-xs text-amber-700">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              Faltan {periodos.filter(i => !(parseFloat(i.liquido) || 0)).length} {esMicro ? 'quincena(s)' : 'mes(es)'} por completar para calcular el promedio
            </div>
          )}
          {promedioLiquido > 0 && (
            <div className="mt-3 flex justify-end items-center px-3 py-2 bg-blue-50 rounded border border-blue-100 text-xs">
              <span className="font-bold text-blue-900">Promedio mensual líquido: {fmt(promedioLiquido)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Card 3: Embargable + Propuesta (fusionados) ─────────────────────── */}
      <Card>
        <CardContent className="px-5 pt-4 pb-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Embargable */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">3</span>
                <p className="text-sm font-semibold">Máximo Embargable</p>
                {totalEmbargo > 0 && (
                  <Badge variant="outline" className="text-purple-700 border-purple-300 text-xs ml-auto">
                    Máx: {fmt(totalEmbargo)}
                  </Badge>
                )}
              </div>

              {promedioLiquido === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-6 bg-slate-50 rounded">
                  Ingresa los ingresos en el Paso 2
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Pensión Alimenticia (₡)</Label>
                      <Input value={withCommas(pensionAlimenticia)} onChange={e => setPensionAlimenticia(stripCommas(e.target.value))} placeholder="0" className="h-8 text-xs mt-1" inputMode="numeric" />
                    </div>
                    <div>
                      <Label className="text-xs">Otro Embargo (₡)</Label>
                      <Input value={withCommas(otroEmbargo)} onChange={e => setOtroEmbargo(stripCommas(e.target.value))} placeholder="0" className="h-8 text-xs mt-1" inputMode="numeric" />
                    </div>
                  </div>

                  {loadingEmbargo && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Calculando...
                    </div>
                  )}

                  {desglose && (
                    <div className="space-y-1 text-xs">
                      {[
                        { label: 'Salario Bruto', val: desglose.salario_bruto, cls: '' },
                        { label: '− CCSS', val: -desglose.descuento_ccss, cls: 'text-red-600' },
                        { label: '− Renta', val: -desglose.impuesto_renta, cls: 'text-red-600' },
                        { label: '= Salario Líquido', val: desglose.salario_liquido, cls: 'font-medium border-t pt-1' },
                        ...(desglose.pension_alimenticia > 0 ? [{ label: '− Pensión Alimenticia', val: -desglose.pension_alimenticia, cls: 'text-orange-600' }] : []),
                        ...(desglose.otro_embargo > 0 ? [{ label: '− Otro Embargo', val: -desglose.otro_embargo, cls: 'text-orange-600' }] : []),
                        { label: 'Tramo 1', val: desglose.embargo_tramo1, cls: '' },
                        { label: 'Tramo 2', val: desglose.embargo_tramo2, cls: '' },
                      ].map(({ label, val, cls }) => (
                        <div key={label} className={`flex justify-between ${cls}`}>
                          <span className="text-muted-foreground">{label}</span>
                          <span>{fmt(Math.abs(val))}</span>
                        </div>
                      ))}
                      <div className={`flex justify-between font-bold border-t pt-1 ${desglose.total_embargo <= 0 ? 'text-red-600' : 'text-purple-700'}`}>
                        <span>= Máx Embargable</span>
                        <span>{desglose.total_embargo <= 0 ? '₡0 (sin capacidad)' : fmt(desglose.total_embargo)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Propuesta */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">4</span>
                <p className="text-sm font-semibold">Propuesta Sugerida</p>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Monto Sugerido (₡)</Label>
                    {montoMaxConfig < Infinity && (
                      <span className="text-[10px] text-muted-foreground">
                        {fmt(montoMinConfig)} — {fmt(montoMaxConfig)}
                      </span>
                    )}
                  </div>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₡</span>
                    <Input
                      value={withCommas(montoSugerido)}
                      onChange={e => setMontoSugerido(stripCommas(e.target.value))}
                      placeholder="0"
                      className={`h-8 text-sm pl-7 ${montoSuperaLimite || montoBajoMinimo ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                      inputMode="numeric"
                    />
                  </div>
                  {montoSuperaLimite && (
                    <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      Supera el máximo permitido de {fmt(montoMaxConfig)}
                    </p>
                  )}
                  {montoBajoMinimo && (
                    <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      El mínimo para este tipo es {fmt(montoMinConfig)}
                    </p>
                  )}
                </div>

                <div>
                  <Label className="text-xs">Plazo (meses)</Label>
                  <Select value={plazo} onValueChange={setPlazo}>
                    <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 72, 84, 96, 108, 120]
                        .filter(p => {
                          const min = cfg?.plazo_minimo ?? 6;
                          const max = cfg?.plazo_maximo ?? 120;
                          return p >= min && p <= max;
                        })
                        .map(p => (
                          <SelectItem key={p} value={String(p)}>{p} meses</SelectItem>
                        ))
                      }
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-between items-center px-3 py-2 bg-slate-50 rounded border text-sm">
                  <span className="text-xs text-muted-foreground">Cuota estimada</span>
                  <span className="font-bold text-slate-700">{cuotaCalculada > 0 ? fmt(cuotaCalculada) : '—'}</span>
                </div>

                {totalEmbargo > 0 && cuotaCalculada > 0 && (
                  <div className={`flex justify-between items-center px-3 py-2 rounded border text-xs ${cuotaSuperaEmbargo ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                    <span className="text-muted-foreground">Cuota vs Máx embargable</span>
                    <div className="flex items-center gap-1.5">
                      <span className={cuotaSuperaEmbargo ? 'text-red-700 font-medium' : 'text-green-700 font-medium'}>{fmt(cuotaCalculada)}</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-purple-700">{fmt(totalEmbargo)}</span>
                      {cuotaSuperaEmbargo
                        ? <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                        : <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                      }
                    </div>
                  </div>
                )}

                <Separator />

                {cuotaSuperaEmbargo && (() => {
                  // Calcular monto máximo viable con el plazo actual (respetando límite de config)
                  const cfg = loanConfigs[esMicro ? 'microcredito' : 'regular'];
                  const ta = cfg ? parseFloat(String(cfg.tasa_anual)) : (esMicro ? 54 : 36);
                  const r = (ta / 100) / 12;
                  const m = parseInt(plazo) || 0;
                  const maxMontoEmbargo = m > 0 && r > 0
                    ? Math.floor(totalEmbargo * (Math.pow(1 + r, m) - 1) / (r * Math.pow(1 + r, m)))
                    : 0;
                  const maxMonto = Math.min(maxMontoEmbargo, montoMaxConfig);
                  return (
                    <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 space-y-1">
                      <div className="flex items-center gap-1.5 font-medium">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        Cuota ({fmt(cuotaCalculada)}) supera el máximo embargable ({fmt(totalEmbargo)})
                      </div>
                      {maxMonto > 0 && (
                        <div className="flex items-center justify-between gap-2 pl-5">
                          <span className="text-red-600">Monto máximo viable a {plazo} meses:</span>
                          <button
                            type="button"
                            className="font-bold underline text-indigo-700 hover:text-indigo-900"
                            onClick={() => setMontoSugerido(String(maxMonto))}
                          >
                            {fmt(maxMonto)} — aplicar
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <Button
                  onClick={handleCrearAnalisis}
                  disabled={!montoSugerido || !plazo || cuotaSuperaEmbargo || montoSuperaLimite || montoBajoMinimo}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-2 disabled:opacity-50"
                >
                  <CheckCircle className="h-4 w-4" />
                  Listo — Crear Análisis
                </Button>
              </div>
            </div>

          </div>
        </CardContent>
      </Card>

    </div>
  );
}
