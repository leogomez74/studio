'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Truck, Loader2, CheckCircle2, XCircle, Building2, Navigation, Phone, MapPin, PackageCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/axios';
import type { RutaDiaria, ExternalRoute, ExternalIntegrationResult } from './types';
import { tipoIcons, statusColors, statusLabels, rutaStatusColors, rutaStatusLabels, extStatusColors } from './utils';

export default function RutasActivasTab() {
  const { toast } = useToast();
  const [rutas, setRutas] = useState<RutaDiaria[]>([]);
  const [extResults, setExtResults] = useState<ExternalIntegrationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRuta, setSelectedRuta] = useState<RutaDiaria | null>(null);
  const [selectedExtRoute, setSelectedExtRoute] = useState<{ route: ExternalRoute; source: string } | null>(null);
  const [showCancelarDialog, setShowCancelarDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRutas = useCallback(async () => {
    setLoading(true);
    try {
      const [rutasRes, extRes] = await Promise.all([
        api.get('/api/rutas-diarias'),
        api.get('/api/external-routes'),
      ]);
      const activas = (rutasRes.data as RutaDiaria[]).filter((r) => r.status !== 'completada');
      setRutas(activas);
      setExtResults(Array.isArray(extRes.data) ? extRes.data : []);
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar las rutas.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchRutas(); }, [fetchRutas]);

  const fetchRutaDetail = async (id: number) => {
    setSelectedExtRoute(null);
    try {
      const res = await api.get(`/api/rutas-diarias/${id}`);
      setSelectedRuta(res.data);
    } catch {
      toast({ title: 'Error', description: 'No se pudo cargar la ruta.', variant: 'destructive' });
    }
  };

  const selectExtRoute = (route: ExternalRoute, source: string) => {
    setSelectedRuta(null);
    setSelectedExtRoute({ route, source });
  };

  const handleConfirmar = async (id: number) => {
    try {
      await api.patch(`/api/rutas-diarias/${id}/confirmar`);
      toast({ title: 'Ruta confirmada' });
      fetchRutas();
      if (selectedRuta?.id === id) fetchRutaDetail(id);
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const handleCancelarRuta = async () => {
    if (!selectedRuta) return;
    setActionLoading(true);
    try {
      await api.delete(`/api/rutas-diarias/${selectedRuta.id}/cancelar`);
      toast({ title: 'Ruta cancelada', description: 'Las tareas pendientes fueron liberadas.' });
      setShowCancelarDialog(false);
      setSelectedRuta(null);
      fetchRutas();
    } catch {
      toast({ title: 'Error', description: 'No se pudo cancelar la ruta.', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  // Rutas externas activas (Planificada o En Progreso)
  const extRoutesActivas: { route: ExternalRoute; source: string }[] = [];
  extResults.forEach(r => {
    if (r.success) {
      r.routes
        .filter(route => route.status !== 'Completada')
        .forEach(route => extRoutesActivas.push({ route, source: r.integration_name }));
    }
  });

  const hasNoRoutes = rutas.length === 0 && extRoutesActivas.length === 0;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Left: Route list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Rutas Activas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : hasNoRoutes ? (
            <p className="text-center py-8 text-muted-foreground">No hay rutas activas.</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {rutas.map((r) => (
                <div
                  key={`pep-${r.id}`}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedRuta?.id === r.id ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/30' : 'hover:bg-muted/50'}`}
                  onClick={() => fetchRutaDetail(r.id)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{new Date(r.fecha).toLocaleDateString('es-CR', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                    <Badge className={rutaStatusColors[r.status]}>{rutaStatusLabels[r.status]}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {r.mensajero?.name || 'Sin asignar'} — {r.completadas_count ?? r.completadas}/{r.tareas_count ?? r.total_tareas} tareas
                  </div>
                  <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${((r.completadas_count ?? r.completadas) / Math.max(r.tareas_count ?? r.total_tareas, 1)) * 100}%` }}
                    />
                  </div>
                </div>
              ))}

              {extRoutesActivas.length > 0 && rutas.length > 0 && (
                <div className="border-t pt-2 mt-2" />
              )}

              {extRoutesActivas.map(({ route, source }) => {
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
                    </div>
                    {totalStops > 0 && (
                      <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all"
                          style={{ width: `${(completedStops / totalStops) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Right: Route detail */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Detalle de Ruta</CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedRuta && !selectedExtRoute ? (
            <p className="text-center py-12 text-muted-foreground">Selecciona una ruta para ver sus tareas.</p>
          ) : selectedRuta ? (
            <div className="space-y-4">
              {/* Actions */}
              <div className="flex items-center gap-2">
                {selectedRuta.status === 'borrador' && (
                  <Button size="sm" onClick={() => handleConfirmar(selectedRuta.id)}>
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Confirmar Ruta
                  </Button>
                )}
                <div className="ml-auto flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {selectedRuta.tareas?.filter((t) => t.status === 'completada').length || 0} / {selectedRuta.tareas?.length || 0} completadas
                  </span>
                  {selectedRuta.status === 'borrador' && (
                    <Button size="sm" variant="destructive" onClick={() => setShowCancelarDialog(true)}>
                      <XCircle className="h-4 w-4 mr-1" />
                      Cancelar Ruta
                    </Button>
                  )}
                </div>
              </div>

              {/* Tasks list */}
              <div className="space-y-2">
                {selectedRuta.tareas?.map((t) => (
                  <div key={t.id} className={`p-3 rounded-lg border ${t.status === 'completada' ? 'opacity-60 bg-green-50/50 dark:bg-green-950/10' : ''}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted text-xs font-bold shrink-0">
                        {t.posicion}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {tipoIcons[t.tipo]}
                          <span className="font-medium text-sm">{t.titulo}</span>
                          <Badge className={`${statusColors[t.status]} text-xs`}>{statusLabels[t.status]}</Badge>
                        </div>
                        {t.empresa_destino && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <Building2 className="h-3 w-3" />
                            {t.empresa_destino}
                          </div>
                        )}
                        {t.direccion_destino && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.direccion_destino)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 mt-1 text-xs text-blue-600 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Navigation className="h-3 w-3" />
                            {t.direccion_destino}
                          </a>
                        )}
                        {t.contacto_nombre && (
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span>{t.contacto_nombre}</span>
                            {t.contacto_telefono && (
                              <a href={`tel:${t.contacto_telefono}`} className="flex items-center gap-1 text-blue-600">
                                <Phone className="h-3 w-3" />
                                {t.contacto_telefono}
                              </a>
                            )}
                          </div>
                        )}
                        {t.notas_completado && (
                          <div className="mt-1 text-xs text-green-700">Nota: {t.notas_completado}</div>
                        )}
                        {t.motivo_fallo && (
                          <div className="mt-1 text-xs text-red-600">Motivo fallo: {t.motivo_fallo}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : selectedExtRoute ? (
            <div className="space-y-4">
              {/* External route header */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Truck className="h-4 w-4" />
                {selectedExtRoute.route.courier?.name}
                {selectedExtRoute.route.courier?.vehicle_type && ` (${selectedExtRoute.route.courier.vehicle_type})`}
                {selectedExtRoute.route.courier?.phone && (
                  <a href={`tel:${selectedExtRoute.route.courier.phone}`} className="flex items-center gap-1 text-blue-600 hover:underline">
                    <Phone className="h-3 w-3" />
                    {selectedExtRoute.route.courier.phone}
                  </a>
                )}
              </div>

              {/* Stops list */}
              <div className="space-y-2">
                {selectedExtRoute.route.stops?.sort((a, b) => a.sequence - b.sequence).map((stop) => (
                  <div key={stop.id} className={`p-3 rounded-lg border ${stop.status === 'Completada' ? 'opacity-60 bg-green-50/50 dark:bg-green-950/10' : ''}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted text-xs font-bold shrink-0">
                        {stop.sequence}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <span className="font-medium text-sm">{stop.branch_name}</span>
                        </div>
                        {stop.address && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 mt-1 text-xs text-blue-600 hover:underline"
                          >
                            <Navigation className="h-3 w-3" />
                            {stop.address}
                          </a>
                        )}
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
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Cancelar ruta dialog */}
      <AlertDialog open={showCancelarDialog} onOpenChange={setShowCancelarDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar ruta</AlertDialogTitle>
            <AlertDialogDescription>
              Se cancelará la ruta y todas las tareas no completadas volverán a pendientes para re-asignación.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelarRuta} disabled={actionLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {actionLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Cancelar Ruta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
