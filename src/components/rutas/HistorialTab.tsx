'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Calendar as CalendarIcon, Truck, Loader2, MapPin, PackageCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/axios';
import type { RutaDiaria, ExternalRoute, ExternalIntegrationResult } from './types';
import { tipoIcons, statusColors, statusLabels, rutaStatusColors, rutaStatusLabels, extStatusColors } from './utils';

export default function HistorialTab() {
  const { toast } = useToast();
  const [rutas, setRutas] = useState<RutaDiaria[]>([]);
  const [extResults, setExtResults] = useState<ExternalIntegrationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRuta, setSelectedRuta] = useState<RutaDiaria | null>(null);
  const [selectedExtRoute, setSelectedExtRoute] = useState<{ route: ExternalRoute; source: string } | null>(null);

  const fetchHistorial = useCallback(async () => {
    setLoading(true);
    try {
      const [rutasRes, extRes] = await Promise.all([
        api.get('/api/rutas-diarias'),
        api.get('/api/external-routes'),
      ]);
      setRutas(rutasRes.data);
      setExtResults(Array.isArray(extRes.data) ? extRes.data : []);
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchHistorial(); }, [fetchHistorial]);

  const fetchDetail = async (id: number) => {
    setSelectedExtRoute(null);
    try {
      const res = await api.get(`/api/rutas-diarias/${id}`);
      setSelectedRuta(res.data);
    } catch { /* ignore */ }
  };

  const selectExtRoute = (route: ExternalRoute, source: string) => {
    setSelectedRuta(null);
    setSelectedExtRoute({ route, source });
  };

  // Flatten external routes for the sidebar
  const extRoutes: { route: ExternalRoute; source: string }[] = [];
  extResults.forEach(r => {
    if (r.success) {
      r.routes.forEach(route => extRoutes.push({ route, source: r.integration_name }));
    }
  });

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Historial de Rutas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (rutas.length === 0 && extRoutes.length === 0) ? (
            <p className="text-center py-8 text-muted-foreground">No hay rutas registradas.</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {rutas.map((r) => (
                <div
                  key={`pep-${r.id}`}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedRuta?.id === r.id ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/30' : 'hover:bg-muted/50'}`}
                  onClick={() => fetchDetail(r.id)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">
                      {new Date(r.fecha).toLocaleDateString('es-CR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <Badge className={rutaStatusColors[r.status]}>{rutaStatusLabels[r.status]}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {r.mensajero?.name} — {r.completadas_count ?? r.completadas}/{r.tareas_count ?? r.total_tareas} tareas
                  </div>
                </div>
              ))}

              {extRoutes.length > 0 && rutas.length > 0 && (
                <div className="border-t pt-2 mt-2" />
              )}

              {extRoutes.map(({ route, source }) => {
                const completedStops = route.stops?.filter(s => s.status === 'Completada').length || 0;
                const totalStops = route.stops?.length || 0;
                return (
                  <div
                    key={`ext-${source}-${route.id}`}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedExtRoute?.route.id === route.id && selectedExtRoute?.source === source ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/30' : 'hover:bg-muted/50'}`}
                    onClick={() => selectExtRoute(route, source)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{route.name}</span>
                        <Badge variant="outline" className="text-xs">{source}</Badge>
                      </div>
                      <Badge className={extStatusColors[route.status] || 'bg-gray-100 text-gray-700'}>{route.status}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {route.courier?.name || 'Sin mensajero'} — {completedStops}/{totalStops} paradas
                      {route.scheduled_date && ` — ${new Date(route.scheduled_date).toLocaleDateString('es-CR', { day: 'numeric', month: 'short' })}`}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Detalle</CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedRuta && !selectedExtRoute ? (
            <p className="text-center py-12 text-muted-foreground">Selecciona una ruta.</p>
          ) : selectedRuta ? (
            <div className="space-y-2">
              {selectedRuta.tareas?.map((t) => (
                <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted text-xs font-bold shrink-0">
                    {t.posicion}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {tipoIcons[t.tipo]}
                      <span className="font-medium text-sm">{t.titulo}</span>
                    </div>
                    {t.empresa_destino && <div className="text-xs text-muted-foreground">{t.empresa_destino}</div>}
                  </div>
                  <Badge className={statusColors[t.status]}>{statusLabels[t.status]}</Badge>
                  {t.completada_at && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(t.completada_at).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : selectedExtRoute ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
                <Truck className="h-4 w-4" />
                {selectedExtRoute.route.courier?.name}
                {selectedExtRoute.route.courier?.vehicle_type && ` (${selectedExtRoute.route.courier.vehicle_type})`}
              </div>
              {selectedExtRoute.route.stops?.sort((a, b) => a.sequence - b.sequence).map((stop) => (
                <div key={stop.id} className="flex items-start gap-3 p-3 rounded-lg border">
                  <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted text-xs font-bold shrink-0">
                    {stop.sequence}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span className="font-medium text-sm">{stop.branch_name}</span>
                    </div>
                    {stop.address && <div className="text-xs text-muted-foreground">{stop.address}</div>}
                    {stop.pickups && stop.pickups.length > 0 && (
                      <div className="mt-1.5 space-y-1">
                        {stop.pickups.map(p => (
                          <div key={p.id} className="flex items-center gap-2 text-xs bg-muted/40 rounded px-2 py-1">
                            <PackageCheck className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium">{p.reference}</span>
                            <span className="text-muted-foreground">—</span>
                            <span className="truncate">{p.client_name}</span>
                            {p.document_count && (
                              <Badge variant="outline" className="text-xs ml-auto">{p.document_count} doc{p.document_count !== 1 ? 's' : ''}</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <Badge className={extStatusColors[stop.status] || 'bg-gray-100 text-gray-700'}>{stop.status}</Badge>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
