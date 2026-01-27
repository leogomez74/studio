"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  CheckCircle,
  Users,
  Briefcase,
  ChevronLeft,
  Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import api from "@/lib/axios";

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
  updated_at: string;
}

export default function NotificacionesPage() {
  const [alerts, setAlerts] = useState<LeadAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("no-leidas");
  const [selectedAlert, setSelectedAlert] = useState<LeadAlert | null>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const isRead = activeTab === "leidas";
      const res = await api.get("/api/lead-alerts", {
        params: { is_read: isRead, per_page: 50 },
      });
      setAlerts(res.data.data || []);
    } catch (error) {
      console.error("Error cargando alertas:", error);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const markAsRead = async (id: number) => {
    try {
      await api.patch(`/api/lead-alerts/${id}/read`);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      if (selectedAlert?.id === id) {
        setSelectedAlert((prev) => (prev ? { ...prev, is_read: true } : null));
      }
    } catch (error) {
      console.error("Error marcando alerta:", error);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-CR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const alertLabel = (alert: LeadAlert) => {
    if (alert.alert_number === 3) return "Alerta Final";
    return `Alerta ${alert.alert_number}/3`;
  };

  const alertColor = (alert: LeadAlert) => {
    if (alert.alert_number === 3) return "destructive" as const;
    return "secondary" as const;
  };

  // Vista de detalle
  if (selectedAlert) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setSelectedAlert(null)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">Detalle de Alerta</CardTitle>
                <Badge variant={alertColor(selectedAlert)}>
                  {alertLabel(selectedAlert)}
                </Badge>
                {selectedAlert.is_read && (
                  <Badge variant="outline" className="text-green-600 border-green-300">
                    Leída
                  </Badge>
                )}
              </div>
              <CardDescription>{formatDate(selectedAlert.created_at)}</CardDescription>
            </div>
            {!selectedAlert.is_read && (
              <Button variant="outline" size="sm" onClick={() => markAsRead(selectedAlert.id)}>
                <Eye className="h-4 w-4 mr-1" />
                Marcar como leída
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Mensaje */}
          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
            <AlertTriangle
              className={cn(
                "h-5 w-5 mt-0.5 flex-shrink-0",
                selectedAlert.alert_number === 3 ? "text-red-500" : "text-amber-500"
              )}
            />
            <p className="text-sm">{selectedAlert.message}</p>
          </div>

          {/* Resumen */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {selectedAlert.inactive_leads.length > 0 && (
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                {selectedAlert.inactive_leads.length} leads inactivos
              </span>
            )}
            {selectedAlert.inactive_opportunities.length > 0 && (
              <span className="flex items-center gap-1.5">
                <Briefcase className="h-4 w-4" />
                {selectedAlert.inactive_opportunities.length} oportunidades inactivas
              </span>
            )}
          </div>

          {/* Lista de Leads */}
          {selectedAlert.inactive_leads.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Leads Inactivos ({selectedAlert.inactive_leads.length})
              </h3>
              <div className="border rounded-lg divide-y">
                {selectedAlert.inactive_leads.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-sm">{lead.name}</span>
                    <Link href={`/dashboard/leads/${lead.id}`}>
                      <Button variant="ghost" size="sm" className="text-xs">
                        Ver lead
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lista de Oportunidades */}
          {selectedAlert.inactive_opportunities.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Oportunidades Inactivas ({selectedAlert.inactive_opportunities.length})
              </h3>
              <div className="border rounded-lg divide-y">
                {selectedAlert.inactive_opportunities.map((opp) => (
                  <div
                    key={opp.id}
                    className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <span className="text-sm font-medium">{opp.reference}</span>
                      <span className="text-sm text-muted-foreground ml-2">- {opp.lead_name}</span>
                    </div>
                    <Link href={`/dashboard/oportunidades/${opp.id}`}>
                      <Button variant="ghost" size="sm" className="text-xs">
                        Ver oportunidad
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Vista de lista
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5" />
          <div>
            <CardTitle>Notificaciones</CardTitle>
            <CardDescription>Alertas de inactividad de leads y oportunidades</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2 w-full sm:w-80">
            <TabsTrigger value="no-leidas">No leídas</TabsTrigger>
            <TabsTrigger value="leidas">Leídas</TabsTrigger>
          </TabsList>

          <TabsContent value="no-leidas" className="mt-4">
            <AlertList
              alerts={alerts}
              loading={loading}
              onSelect={setSelectedAlert}
              onMarkAsRead={markAsRead}
              formatDate={formatDate}
              alertLabel={alertLabel}
              alertColor={alertColor}
              emptyMessage="No hay alertas sin leer."
              showMarkAsRead
            />
          </TabsContent>

          <TabsContent value="leidas" className="mt-4">
            <AlertList
              alerts={alerts}
              loading={loading}
              onSelect={setSelectedAlert}
              onMarkAsRead={markAsRead}
              formatDate={formatDate}
              alertLabel={alertLabel}
              alertColor={alertColor}
              emptyMessage="No hay alertas leídas."
              showMarkAsRead={false}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function AlertList({
  alerts,
  loading,
  onSelect,
  onMarkAsRead,
  formatDate,
  alertLabel,
  alertColor,
  emptyMessage,
  showMarkAsRead,
}: {
  alerts: LeadAlert[];
  loading: boolean;
  onSelect: (alert: LeadAlert) => void;
  onMarkAsRead: (id: number) => void;
  formatDate: (d: string) => string;
  alertLabel: (a: LeadAlert) => string;
  alertColor: (a: LeadAlert) => "destructive" | "secondary";
  emptyMessage: string;
  showMarkAsRead: boolean;
}) {
  if (loading) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Cargando alertas...</p>;
  }

  if (alerts.length === 0) {
    return (
      <div className="py-12 text-center">
        <CheckCircle className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg divide-y">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="flex items-start gap-4 p-4 hover:bg-muted/50 transition-colors cursor-pointer"
          onClick={() => onSelect(alert)}
        >
          <AlertTriangle
            className={cn(
              "h-5 w-5 mt-0.5 flex-shrink-0",
              alert.alert_number === 3 ? "text-red-500" : "text-amber-500"
            )}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={alertColor(alert)}>{alertLabel(alert)}</Badge>
              <span className="text-xs text-muted-foreground">{formatDate(alert.created_at)}</span>
            </div>
            <p className="text-sm mt-1 text-muted-foreground line-clamp-2">{alert.message}</p>
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
          </div>
          {showMarkAsRead && (
            <Button
              variant="ghost"
              size="sm"
              className="flex-shrink-0 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onMarkAsRead(alert.id);
              }}
            >
              <Eye className="h-3.5 w-3.5 mr-1" />
              Leída
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
