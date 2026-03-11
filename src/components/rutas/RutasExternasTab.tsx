'use client';

import React, { useEffect, useState, useCallback } from 'react';
import api from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  RefreshCw,
  MapPin,
  Package,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  AlertTriangle,
  Truck,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface ExternalStop {
  id: number;
  sequence: number;
  branch_id?: string;
  branch_name: string;
  address?: string;
  status: string;
  scheduled_at?: string;
  arrived_at?: string;
  completed_at?: string;
  notes?: string;
  pickups?: ExternalPickup[];
}

interface ExternalPickup {
  id: number;
  reference: string;
  case_reference?: string;
  client_name: string;
  branch_name?: string;
  document_count?: number;
  status: string;
  notes?: string;
}

interface ExternalRoute {
  id: number;
  reference: string;
  name: string;
  status: string;
  scheduled_date?: string;
  started_at?: string;
  completed_at?: string;
  notes?: string;
  courier?: { id: number; name: string; phone?: string; vehicle_type?: string };
  stops?: ExternalStop[];
}

interface IntegrationResult {
  integration_id: number;
  integration_name: string;
  integration_slug: string;
  success: boolean;
  error?: string;
  routes: ExternalRoute[];
  count: number;
}

const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  'Planificada': { color: 'bg-blue-100 text-blue-800', icon: <Clock className="h-3.5 w-3.5" /> },
  'En Progreso': { color: 'bg-purple-100 text-purple-800', icon: <Truck className="h-3.5 w-3.5" /> },
  'Completada': { color: 'bg-green-100 text-green-800', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  'Pendiente': { color: 'bg-slate-100 text-slate-700', icon: <Clock className="h-3.5 w-3.5" /> },
};

const getStatusStyle = (status: string) => {
  return statusConfig[status] || { color: 'bg-gray-100 text-gray-700', icon: <Clock className="h-3.5 w-3.5" /> };
};

export default function RutasExternasTab() {
  const { toast } = useToast();
  const [results, setResults] = useState<IntegrationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRoutes, setExpandedRoutes] = useState<Set<string>>(new Set());

  const fetchExternalRoutes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/external-routes');
      setResults(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar las rutas externas', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchExternalRoutes(); }, [fetchExternalRoutes]);

  const toggleRoute = (key: string) => {
    setExpandedRoutes(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const totalRoutes = results.reduce((sum, r) => sum + r.count, 0);
  const hasIntegrations = results.length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span className="text-muted-foreground">Consultando rutas externas...</span>
      </div>
    );
  }

  if (!hasIntegrations) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <ExternalLink className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-2">No hay integraciones de rutas configuradas</p>
          <p className="text-xs text-muted-foreground">
            Configura integraciones en Configuracion &gt; Integraciones
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {totalRoutes} ruta{totalRoutes !== 1 ? 's' : ''} de {results.length} integración{results.length !== 1 ? 'es' : ''}
        </div>
        <Button variant="outline" size="sm" onClick={fetchExternalRoutes} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {results.map((integrationResult) => (
        <Card key={integrationResult.integration_id}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                {integrationResult.integration_name}
                <Badge variant="outline" className="text-xs font-normal">
                  {integrationResult.count} ruta{integrationResult.count !== 1 ? 's' : ''}
                </Badge>
              </CardTitle>
              {!integrationResult.success && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Error de conexión
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!integrationResult.success ? (
              <div className="text-sm text-red-600 bg-red-50 rounded p-3">
                {integrationResult.error}
              </div>
            ) : integrationResult.routes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Sin rutas disponibles</p>
            ) : (
              <div className="space-y-2">
                {integrationResult.routes.map((route) => {
                  const routeKey = `${integrationResult.integration_id}-${route.id}`;
                  const isExpanded = expandedRoutes.has(routeKey);
                  const statusStyle = getStatusStyle(route.status);
                  const stopsCount = route.stops?.length || 0;
                  const completedStops = route.stops?.filter(s => s.status === 'Completada').length || 0;

                  return (
                    <Collapsible key={routeKey} open={isExpanded} onOpenChange={() => toggleRoute(routeKey)}>
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{route.name}</span>
                              {route.reference && (
                                <span className="text-xs text-muted-foreground">({route.reference})</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              {route.courier && (
                                <span className="flex items-center gap-1">
                                  <Truck className="h-3 w-3" />
                                  {route.courier.name}
                                </span>
                              )}
                              {route.scheduled_date && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {new Date(route.scheduled_date).toLocaleDateString('es-CR')}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {completedStops}/{stopsCount} paradas
                              </span>
                            </div>
                          </div>

                          <Badge className={`${statusStyle.color} text-xs shrink-0`}>
                            {statusStyle.icon}
                            <span className="ml-1">{route.status}</span>
                          </Badge>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="ml-8 mt-2 space-y-2 pb-2">
                          {route.notes && (
                            <p className="text-xs text-muted-foreground italic bg-muted/30 rounded p-2">
                              {route.notes}
                            </p>
                          )}

                          {route.stops && route.stops.length > 0 ? (
                            <div className="space-y-1.5">
                              {route.stops
                                .sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
                                .map((stop) => {
                                  const stopStatus = getStatusStyle(stop.status);
                                  return (
                                    <div
                                      key={stop.id}
                                      className="flex items-start gap-3 p-2.5 rounded border bg-background"
                                    >
                                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-medium shrink-0">
                                        {stop.sequence}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium text-sm">{stop.branch_name}</span>
                                          <Badge className={`${stopStatus.color} text-xs`}>
                                            {stop.status}
                                          </Badge>
                                        </div>
                                        {stop.address && (
                                          <p className="text-xs text-muted-foreground mt-0.5">{stop.address}</p>
                                        )}

                                        {/* Pickups en esta parada */}
                                        {stop.pickups && stop.pickups.length > 0 && (
                                          <div className="mt-2 space-y-1">
                                            {stop.pickups.map((pickup) => (
                                              <div
                                                key={pickup.id}
                                                className="flex items-center gap-2 text-xs bg-muted/40 rounded px-2 py-1"
                                              >
                                                <Package className="h-3 w-3 text-muted-foreground shrink-0" />
                                                <span className="font-medium">{pickup.reference}</span>
                                                <span className="text-muted-foreground">—</span>
                                                <span className="truncate">{pickup.client_name}</span>
                                                {pickup.document_count && (
                                                  <Badge variant="outline" className="text-xs ml-auto shrink-0">
                                                    {pickup.document_count} doc{pickup.document_count !== 1 ? 's' : ''}
                                                  </Badge>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">Sin paradas definidas</p>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
