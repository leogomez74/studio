"use client";

import React, { useCallback, useState, useEffect } from "react";
import {
  Calculator,
  ChevronLeft,
  ChevronRight,
  Wallet,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth-guard";
import api from "@/lib/axios";
import Link from "next/link";

interface Deductora {
  id: number;
  nombre: string;
}

interface SaldosPorAsignarProps {
  /** Si se pasa, filtra por cédula exacta y oculta filtros/columnas de cliente */
  cedula?: string;
  /** Nombre del cliente para mostrar en la descripción */
  clientName?: string;
  /** Lista de deductoras para el filtro (solo modo completo) */
  deductoras?: Deductora[];
  /** Callback después de una asignación exitosa */
  onAssigned?: () => void;
  /** Callback cuando cambia el conteo de saldos (para mostrar badge en tab trigger) */
  onCountChange?: (count: number) => void;
}

export function SaldosPorAsignar({
  cedula,
  clientName,
  deductoras = [],
  onAssigned,
  onCountChange,
}: SaldosPorAsignarProps) {
  const { toast } = useToast();
  const { user } = useAuth();

  // Determinar modo: compacto (para crédito) o completo (para cobros)
  const isCompact = !!cedula;

  // --- Estado de lista ---
  const [saldosPendientes, setSaldosPendientes] = useState<any[]>([]);
  const [loadingSaldos, setLoadingSaldos] = useState(false);
  const [procesandoSaldo, setProcesandoSaldo] = useState<number | null>(null);
  const [saldosPage, setSaldosPage] = useState(1);
  const [saldosPerPage, setSaldosPerPage] = useState(isCompact ? 50 : 10);
  const [saldosTotal, setSaldosTotal] = useState(0);

  // --- Filtros (solo modo completo) ---
  const [saldosSearch, setSaldosSearch] = useState("");
  const [saldosFilterDeductora, setSaldosFilterDeductora] = useState("all");
  const [saldosFilterFechaDesde, setSaldosFilterFechaDesde] = useState("");
  const [saldosFilterFechaHasta, setSaldosFilterFechaHasta] = useState("");

  // --- Modal de confirmación ---
  const [previewSaldoData, setPreviewSaldoData] = useState<any>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingSaldoId, setPendingSaldoId] = useState<number | null>(null);
  const [pendingAccion, setPendingAccion] = useState<
    "cuota" | "capital" | null
  >(null);
  const [pendingCreditId, setPendingCreditId] = useState<number | null>(null);
  const [pendingMonto, setPendingMonto] = useState<number | null>(null);

  // --- Modal de estrategia de capital ---
  const [capitalStrategy, setCapitalStrategy] = useState<
    "reduce_amount" | "reduce_term"
  >("reduce_amount");
  const [strategyModalOpen, setStrategyModalOpen] = useState(false);
  const [pendingCapitalData, setPendingCapitalData] = useState<{
    saldoId: number;
    creditId?: number;
    monto?: number;
  } | null>(null);

  // --- Modal de reintegro ---
  const [reintegroDialogOpen, setReintegroDialogOpen] = useState(false);
  const [saldoToReintegrar, setSaldoToReintegrar] = useState<any>(null);

  // --- Fetch ---
  const fetchSaldosPendientes = useCallback(async () => {
    setLoadingSaldos(true);
    try {
      const params: any = {
        page: saldosPage,
        per_page: saldosPerPage,
      };
      if (cedula) {
        params.cedula = cedula;
      } else {
        if (saldosFilterDeductora && saldosFilterDeductora !== "all") {
          params.deductora_id = saldosFilterDeductora;
        }
        if (saldosFilterFechaDesde) params.fecha_desde = saldosFilterFechaDesde;
        if (saldosFilterFechaHasta) params.fecha_hasta = saldosFilterFechaHasta;
        if (saldosSearch) params.search = saldosSearch;
      }
      const res = await api.get("/api/saldos-pendientes", { params });
      setSaldosPendientes(res.data.data || res.data || []);
      setSaldosTotal(res.data.total || res.data.length || 0);
    } catch (err) {
      console.error("Error fetching saldos pendientes:", err);
    } finally {
      setLoadingSaldos(false);
    }
  }, [
    saldosPage,
    saldosPerPage,
    cedula,
    saldosFilterDeductora,
    saldosFilterFechaDesde,
    saldosFilterFechaHasta,
    saldosSearch,
  ]);

  useEffect(() => {
    fetchSaldosPendientes();
  }, [fetchSaldosPendientes]);

  // Notificar al padre cuando cambia el conteo
  useEffect(() => {
    onCountChange?.(saldosTotal);
  }, [saldosTotal, onCountChange]);

  // --- Handlers ---
  const handleAsignarSaldo = async (
    saldoId: number,
    accion: "cuota" | "capital",
    creditId?: number,
    monto?: number
  ) => {
    if (user?.role?.name !== "Administrador" && !user?.role?.full_access) {
      toast({
        title: "Acceso denegado",
        description: "Solo administradores pueden aplicar saldos",
        variant: "destructive",
      });
      return;
    }

    // Si es capital, mostrar modal de estrategia primero
    if (accion === "capital") {
      setPendingCapitalData({ saldoId, creditId, monto });
      setCapitalStrategy("reduce_amount");
      setStrategyModalOpen(true);
      return;
    }

    // Obtener preview para cuota
    try {
      const body: any = { accion };
      if (creditId) body.credit_id = creditId;
      if (monto) body.monto = monto;
      const res = await api.post(
        `/api/saldos-pendientes/${saldoId}/preview`,
        body
      );
      setPreviewSaldoData(res.data);
      setPendingSaldoId(saldoId);
      setPendingAccion(accion);
      setPendingCreditId(creditId || null);
      setPendingMonto(monto || null);
      setConfirmDialogOpen(true);
    } catch (err: any) {
      toast({
        title: "Error",
        description:
          err.response?.data?.message || "Error al obtener preview",
        variant: "destructive",
      });
    }
  };

  const confirmarEstrategiaCapital = async () => {
    if (!pendingCapitalData) return;
    const { saldoId, creditId, monto } = pendingCapitalData;
    setStrategyModalOpen(false);

    try {
      const body: any = {
        accion: "capital",
        capital_strategy: capitalStrategy,
      };
      if (creditId) body.credit_id = creditId;
      if (monto) body.monto = monto;

      const res = await api.post(
        `/api/saldos-pendientes/${saldoId}/preview`,
        body
      );
      setPreviewSaldoData(res.data);
      setPendingSaldoId(saldoId);
      setPendingAccion("capital");
      setPendingCreditId(creditId || null);
      setPendingMonto(monto || null);
      setConfirmDialogOpen(true);
      setPendingCapitalData(null);
    } catch (err: any) {
      toast({
        title: "Error",
        description:
          err.response?.data?.message || "Error al obtener preview",
        variant: "destructive",
      });
    }
  };

  const confirmarAsignacion = async () => {
    if (!pendingSaldoId || !pendingAccion) return;
    setProcesandoSaldo(pendingSaldoId);
    try {
      const body: any = { accion: pendingAccion };
      if (pendingCreditId) body.credit_id = pendingCreditId;
      if (pendingMonto) body.monto = pendingMonto;
      if (pendingAccion === "capital") {
        body.capital_strategy = capitalStrategy;
      }
      const res = await api.post(
        `/api/saldos-pendientes/${pendingSaldoId}/asignar`,
        body
      );
      toast({ title: "Éxito", description: res.data.message });
      setConfirmDialogOpen(false);
      setPreviewSaldoData(null);
      await fetchSaldosPendientes();
      onAssigned?.();
    } catch (err: any) {
      toast({
        title: "Error",
        description:
          err.response?.data?.message || "Error al asignar saldo",
        variant: "destructive",
      });
    } finally {
      setProcesandoSaldo(null);
      setPendingSaldoId(null);
      setPendingAccion(null);
      setPendingCreditId(null);
      setPendingMonto(null);
    }
  };

  const handleReintegrarSaldo = (saldo: any) => {
    if (user?.role?.name !== "Administrador" && !user?.role?.full_access) {
      toast({
        title: "Acceso denegado",
        description: "Solo administradores pueden reintegrar saldos",
        variant: "destructive",
      });
      return;
    }
    setSaldoToReintegrar(saldo);
    setReintegroDialogOpen(true);
  };

  const confirmarReintegro = async () => {
    if (!saldoToReintegrar) return;
    setProcesandoSaldo(saldoToReintegrar.id);
    setReintegroDialogOpen(false);
    try {
      const res = await api.post(
        `/api/saldos-pendientes/${saldoToReintegrar.id}/reintegrar`,
        { motivo: "Reintegrado desde interfaz de usuario" }
      );
      toast({ title: "Éxito", description: res.data.message });
      await fetchSaldosPendientes();
      onAssigned?.();
    } catch (err: any) {
      toast({
        title: "Error",
        description:
          err.response?.data?.message || "Error al reintegrar saldo",
        variant: "destructive",
      });
    } finally {
      setProcesandoSaldo(null);
      setSaldoToReintegrar(null);
    }
  };

  const totalPages = Math.ceil(saldosTotal / saldosPerPage) || 1;

  return (
    <>
      <Card>
        <CardHeader className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Saldos por Asignar</CardTitle>
              <CardDescription>
                {isCompact
                  ? `Sobrantes de planilla pendientes de asignación para ${clientName || "este cliente"} (Cédula: ${cedula}).`
                  : "Sobrantes de planilla pendientes de asignación. Puede aplicarlos a la siguiente cuota o como abono a capital."}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchSaldosPendientes}
              disabled={loadingSaldos}
            >
              {loadingSaldos ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Filtros - solo modo completo */}
          {!isCompact && (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 mt-4">
              <div>
                <Label htmlFor="saldos-search">Buscar</Label>
                <Input
                  id="saldos-search"
                  type="text"
                  placeholder="Cédula, nombre o crédito..."
                  value={saldosSearch}
                  onChange={(e) => {
                    setSaldosSearch(e.target.value);
                    setSaldosPage(1);
                  }}
                />
              </div>
              <div>
                <Label htmlFor="saldos-deductora">Deductora</Label>
                <Select
                  value={saldosFilterDeductora}
                  onValueChange={(val) => {
                    setSaldosFilterDeductora(val);
                    setSaldosPage(1);
                  }}
                >
                  <SelectTrigger id="saldos-deductora">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las deductoras</SelectItem>
                    {deductoras.map((ded) => (
                      <SelectItem key={ded.id} value={ded.id.toString()}>
                        {ded.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="saldos-fecha-desde">Desde</Label>
                <Input
                  id="saldos-fecha-desde"
                  type="date"
                  value={saldosFilterFechaDesde}
                  onChange={(e) => {
                    setSaldosFilterFechaDesde(e.target.value);
                    setSaldosPage(1);
                  }}
                />
              </div>
              <div>
                <Label htmlFor="saldos-fecha-hasta">Hasta</Label>
                <Input
                  id="saldos-fecha-hasta"
                  type="date"
                  value={saldosFilterFechaHasta}
                  onChange={(e) => {
                    setSaldosFilterFechaHasta(e.target.value);
                    setSaldosPage(1);
                  }}
                />
              </div>
              <div>
                <Label htmlFor="saldos-per-page">Por página</Label>
                <Select
                  value={saldosPerPage.toString()}
                  onValueChange={(val) => {
                    setSaldosPerPage(parseInt(val));
                    setSaldosPage(1);
                  }}
                >
                  <SelectTrigger id="saldos-per-page">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {loadingSaldos ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : saldosPendientes.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Wallet className="mx-auto h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">No hay saldos pendientes por asignar.</p>
              <p className="text-xs mt-1">
                Los sobrantes aparecerán aquí cuando se cargue una planilla
                donde {isCompact ? "este cliente pague" : "un cliente pague"}{" "}
                más que su cuota.
              </p>
            </div>
          ) : (
            <div className="relative w-full overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {!isCompact && <TableHead>Cliente</TableHead>}
                    {!isCompact && <TableHead>Cédula</TableHead>}
                    {isCompact && <TableHead>Crédito Origen</TableHead>}
                    <TableHead className="text-right">
                      Monto Sobrante
                    </TableHead>
                    <TableHead>Deductora</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Distribución Posible</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {saldosPendientes.map((saldo: any) => (
                    <TableRow key={saldo.id} className="align-top">
                      {!isCompact && (
                        <TableCell className="font-medium">
                          {saldo.lead_id ? (
                            <Link
                              href={
                                saldo.person_type_id === 1
                                  ? `/dashboard/leads/${saldo.lead_id}?mode=view`
                                  : `/dashboard/clientes/${saldo.lead_id}?mode=view`
                              }
                              className="text-primary hover:underline"
                            >
                              {saldo.lead_name}
                            </Link>
                          ) : (
                            saldo.lead_name
                          )}
                        </TableCell>
                      )}
                      {!isCompact && (
                        <TableCell className="text-sm">
                          {saldo.cedula}
                        </TableCell>
                      )}
                      {isCompact && (
                        <TableCell className="font-medium">
                          <Link
                            href={`/dashboard/creditos/${saldo.credit_id}`}
                            className="text-primary hover:underline"
                          >
                            {saldo.credit_reference}
                          </Link>
                        </TableCell>
                      )}
                      <TableCell className="text-right font-mono font-semibold text-orange-600">
                        ₡
                        {Number(saldo.monto).toLocaleString("de-DE", {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-sm">
                        {saldo.deductora}
                      </TableCell>
                      <TableCell className="text-sm">
                        {saldo.fecha_origen
                          ? new Date(
                              saldo.fecha_origen
                            ).toLocaleDateString()
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {saldo.distribuciones &&
                        saldo.distribuciones.length > 0 ? (
                          <div className="space-y-2">
                            {saldo.distribuciones.map((dist: any) => (
                              <div
                                key={dist.credit_id}
                                className="p-2 bg-gray-50 rounded-md border text-xs"
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <Link
                                    href={`/dashboard/creditos/${dist.credit_id}`}
                                    className="text-primary hover:underline font-medium"
                                  >
                                    {dist.reference}
                                  </Link>
                                  <span className="text-muted-foreground">
                                    Saldo: ₡
                                    {Number(
                                      dist.saldo_credito
                                    ).toLocaleString("de-DE", {
                                      minimumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>
                                <div className="text-muted-foreground mb-1">
                                  Cuota: ₡
                                  {Number(dist.cuota).toLocaleString(
                                    "de-DE",
                                    { minimumFractionDigits: 2 }
                                  )}
                                  {dist.max_cuotas > 0 && (
                                    <>
                                      {" · "}
                                      <span className="text-blue-700">
                                        Alcanza {dist.max_cuotas} cuota
                                        {dist.max_cuotas !== 1 ? "s" : ""}
                                      </span>
                                    </>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {Array.from(
                                    {
                                      length: Math.min(dist.max_cuotas, 5),
                                    },
                                    (_, i) => (
                                      <Button
                                        key={i}
                                        variant="outline"
                                        size="sm"
                                        className="text-xs h-7 px-2"
                                        disabled={
                                          procesandoSaldo === saldo.id
                                        }
                                        onClick={() =>
                                          handleAsignarSaldo(
                                            saldo.id,
                                            "cuota",
                                            dist.credit_id,
                                            dist.cuota
                                          )
                                        }
                                      >
                                        {procesandoSaldo === saldo.id ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          `Cuota ${i + 1}`
                                        )}
                                      </Button>
                                    )
                                  )}
                                  {((dist.restante > 1 &&
                                    dist.restante < dist.cuota) ||
                                    (dist.max_cuotas === 0 &&
                                      saldo.monto > 1)) && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className={`text-xs h-7 px-2 ${dist.es_parcial ? "border-blue-300 text-blue-700 hover:bg-blue-50" : "border-green-300 text-green-700 hover:bg-green-50"}`}
                                      disabled={
                                        procesandoSaldo === saldo.id
                                      }
                                      onClick={() =>
                                        handleAsignarSaldo(
                                          saldo.id,
                                          "cuota",
                                          dist.credit_id,
                                          dist.restante > 1 &&
                                            dist.restante < dist.cuota
                                            ? dist.restante
                                            : saldo.monto
                                        )
                                      }
                                    >
                                      {procesandoSaldo === saldo.id ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        `${dist.es_parcial ? "Parcial" : "Completo"} ₡${Number(dist.restante > 1 && dist.restante < dist.cuota ? dist.restante : saldo.monto).toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                                      )}
                                    </Button>
                                  )}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs h-7 px-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                                    disabled={procesandoSaldo === saldo.id}
                                    onClick={() =>
                                      handleAsignarSaldo(
                                        saldo.id,
                                        "capital",
                                        dist.credit_id
                                      )
                                    }
                                  >
                                    {procesandoSaldo === saldo.id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      "Aplicar Capital"
                                    )}
                                  </Button>
                                </div>
                              </div>
                            ))}
                            {/* Botón de Reintegro */}
                            <div className="mt-2 pt-2 border-t">
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs h-7 px-2 w-full border-red-300 text-red-700 hover:bg-red-50"
                                disabled={procesandoSaldo === saldo.id}
                                onClick={() =>
                                  handleReintegrarSaldo(saldo)
                                }
                              >
                                {procesandoSaldo === saldo.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  "Reintegro de Saldo"
                                )}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              disabled={procesandoSaldo === saldo.id}
                              onClick={() =>
                                handleAsignarSaldo(saldo.id, "cuota")
                              }
                            >
                              {procesandoSaldo === saldo.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Aplicar a Cuota"
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              disabled={procesandoSaldo === saldo.id}
                              onClick={() =>
                                handleAsignarSaldo(saldo.id, "capital")
                              }
                            >
                              {procesandoSaldo === saldo.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Aplicar a Capital"
                              )}
                            </Button>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs w-full border-red-300 text-red-700 hover:bg-red-50"
                              disabled={procesandoSaldo === saldo.id}
                              onClick={() =>
                                handleReintegrarSaldo(saldo)
                              }
                            >
                              {procesandoSaldo === saldo.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Reintegro de Saldo"
                              )}
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Paginación */}
          {!loadingSaldos && saldosPendientes.length > 0 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Mostrando {(saldosPage - 1) * saldosPerPage + 1} a{" "}
                {Math.min(saldosPage * saldosPerPage, saldosTotal)} de{" "}
                {saldosTotal} registros
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={saldosPage <= 1}
                  onClick={() => setSaldosPage(saldosPage - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  {saldosPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={saldosPage >= totalPages}
                  onClick={() => setSaldosPage(saldosPage + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: Seleccionar Estrategia para Aplicar Capital */}
      <Dialog open={strategyModalOpen} onOpenChange={setStrategyModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Seleccionar Estrategia de Aplicación a Capital
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-2">
              El saldo se aplicará directamente al capital. Seleccione cómo
              desea que afecte el plan de pagos:
            </p>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-muted/50 p-4 rounded-md border border-dashed border-primary/50 space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <Calculator className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Estrategia de Aplicación
                </span>
              </div>
              <div className="flex flex-col gap-3 pl-1">
                <label className="flex items-start gap-3 cursor-pointer p-3 border rounded-md hover:bg-background transition-colors">
                  <input
                    type="radio"
                    name="capital-strategy"
                    value="reduce_amount"
                    checked={capitalStrategy === "reduce_amount"}
                    onChange={() => setCapitalStrategy("reduce_amount")}
                    className="mt-1 text-primary focus:ring-primary"
                  />
                  <div>
                    <div className="font-medium">
                      Disminuir monto de la cuota
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Mantiene el plazo original (mismo número de cuotas). La
                      cuota mensual será menor y los intereses corrientes se
                      recalcularán.
                    </p>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer p-3 border rounded-md hover:bg-background transition-colors">
                  <input
                    type="radio"
                    name="capital-strategy"
                    value="reduce_term"
                    checked={capitalStrategy === "reduce_term"}
                    onChange={() => setCapitalStrategy("reduce_term")}
                    className="mt-1 text-primary focus:ring-primary"
                  />
                  <div>
                    <div className="font-medium">Disminuir plazo</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Mantiene la cuota mensual actual. Se reduce el número
                      total de cuotas (termina de pagar antes).
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setStrategyModalOpen(false);
                setPendingCapitalData(null);
              }}
            >
              Cancelar
            </Button>
            <Button onClick={confirmarEstrategiaCapital}>Continuar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirmación de Aplicación de Saldo */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Aplicación de Saldo</DialogTitle>
          </DialogHeader>

          {previewSaldoData && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">
                    Saldo disponible
                  </p>
                  <p className="text-lg font-bold">
                    {new Intl.NumberFormat("es-CR", {
                      style: "currency",
                      currency: "CRC",
                    }).format(previewSaldoData.monto_disponible)}
                  </p>
                </div>
                {previewSaldoData.monto_a_aplicar &&
                  previewSaldoData.monto_a_aplicar !==
                    previewSaldoData.monto_disponible && (
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">
                        Monto a aplicar
                      </p>
                      <p className="text-lg font-bold text-blue-600">
                        {new Intl.NumberFormat("es-CR", {
                          style: "currency",
                          currency: "CRC",
                        }).format(previewSaldoData.monto_a_aplicar)}
                      </p>
                    </div>
                  )}
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Crédito</p>
                  <p className="font-medium text-sm">
                    {previewSaldoData.credit?.reference ||
                      previewSaldoData.credit?.numero_operacion ||
                      "-"}
                  </p>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Destino</p>
                  <p className="font-semibold">{previewSaldoData.destino}</p>
                </div>
              </div>

              {previewSaldoData.distribucion && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Distribución:
                  </p>
                  <div className="space-y-1 text-sm">
                    {previewSaldoData.distribucion.interes_moratorio > 0 && (
                      <div className="flex justify-between">
                        <span>Interés Moratorio:</span>
                        <span className="font-mono">
                          {new Intl.NumberFormat("es-CR", {
                            style: "currency",
                            currency: "CRC",
                          }).format(
                            previewSaldoData.distribucion.interes_moratorio
                          )}
                        </span>
                      </div>
                    )}
                    {previewSaldoData.distribucion.interes_corriente > 0 && (
                      <div className="flex justify-between">
                        <span>Interés Corriente:</span>
                        <span className="font-mono">
                          {new Intl.NumberFormat("es-CR", {
                            style: "currency",
                            currency: "CRC",
                          }).format(
                            previewSaldoData.distribucion.interes_corriente
                          )}
                        </span>
                      </div>
                    )}
                    {previewSaldoData.distribucion.poliza > 0 && (
                      <div className="flex justify-between">
                        <span>Póliza:</span>
                        <span className="font-mono">
                          {new Intl.NumberFormat("es-CR", {
                            style: "currency",
                            currency: "CRC",
                          }).format(previewSaldoData.distribucion.poliza)}
                        </span>
                      </div>
                    )}
                    {previewSaldoData.distribucion.amortizacion > 0 && (
                      <div className="flex justify-between">
                        <span>Capital:</span>
                        <span className="font-mono">
                          {new Intl.NumberFormat("es-CR", {
                            style: "currency",
                            currency: "CRC",
                          }).format(
                            previewSaldoData.distribucion.amortizacion
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Impacto en la cuota */}
              {previewSaldoData.accion === "cuota" &&
                previewSaldoData.distribucion && (
                  <div className="bg-amber-50 border border-amber-200 rounded-md p-4 space-y-3">
                    <div className="flex items-center gap-2 text-amber-800 font-medium">
                      <Calculator className="h-4 w-4" />
                      <span>Impacto en la Cuota</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Cuota a pagar:
                        </span>
                        <span className="font-medium">
                          {previewSaldoData.destino}
                        </span>
                      </div>
                      {(() => {
                        const totalAplicado =
                          previewSaldoData.total_aplicado ||
                          (previewSaldoData.distribucion.interes_moratorio ||
                            0) +
                            (previewSaldoData.distribucion
                              .interes_corriente || 0) +
                            (previewSaldoData.distribucion.poliza || 0) +
                            (previewSaldoData.distribucion.amortizacion ||
                              0);
                        const totalPendiente =
                          previewSaldoData.total_pendiente_cuota || 0;
                        const cuotaCompleta =
                          previewSaldoData.cuota_completa ??
                          totalAplicado >= totalPendiente - 0.01;
                        const faltante = Math.max(
                          0,
                          totalPendiente - totalAplicado
                        );

                        return (
                          <>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Monto aplicado:
                              </span>
                              <span className="font-bold text-amber-700">
                                ₡
                                {totalAplicado.toLocaleString("de-DE", {
                                  minimumFractionDigits: 2,
                                })}
                              </span>
                            </div>
                            {!cuotaCompleta && faltante > 0.01 && (
                              <div className="flex justify-between text-orange-700">
                                <span className="text-muted-foreground">
                                  Falta por pagar:
                                </span>
                                <span className="font-medium">
                                  ₡
                                  {faltante.toLocaleString("de-DE", {
                                    minimumFractionDigits: 2,
                                  })}
                                </span>
                              </div>
                            )}
                            <div className="pt-2 border-t border-amber-300">
                              <div className="flex items-center gap-2">
                                {!cuotaCompleta ? (
                                  <>
                                    <Badge
                                      variant="outline"
                                      className="bg-yellow-100 text-yellow-800 border-yellow-300"
                                    >
                                      Pago Parcial
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      La cuota quedará pendiente de completar
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <Badge
                                      variant="outline"
                                      className="bg-green-100 text-green-800 border-green-300"
                                    >
                                      Pago Completo
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      La cuota quedará pagada totalmente
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}

              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground">
                  Saldo del crédito
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-sm line-through">
                    {new Intl.NumberFormat("es-CR", {
                      style: "currency",
                      currency: "CRC",
                    }).format(previewSaldoData.credit.saldo_actual)}
                  </span>
                  <span>→</span>
                  <span className="text-lg font-bold text-green-600">
                    {new Intl.NumberFormat("es-CR", {
                      style: "currency",
                      currency: "CRC",
                    }).format(previewSaldoData.saldo_nuevo_credit)}
                  </span>
                </div>
              </div>

              {/* Impacto en plan de pagos (capital) */}
              {previewSaldoData.estrategia &&
                previewSaldoData.saldo_nuevo_credit > 0 &&
                !previewSaldoData.finalizado && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-4 space-y-3">
                    <div className="flex items-center gap-2 text-blue-800 font-medium">
                      <Calculator className="h-4 w-4" />
                      <span>Impacto en el Plan de Pagos</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">
                          Cuota Mensual
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={
                              previewSaldoData.estrategia === "reduce_amount"
                                ? "line-through text-xs"
                                : "font-mono"
                            }
                          >
                            ₡
                            {Number(
                              previewSaldoData.cuota_actual
                            ).toLocaleString("de-DE", {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                          {previewSaldoData.estrategia ===
                            "reduce_amount" && (
                            <>
                              <span>→</span>
                              <span className="font-bold text-blue-700">
                                ₡
                                {Number(
                                  previewSaldoData.nueva_cuota
                                ).toLocaleString("de-DE", {
                                  minimumFractionDigits: 2,
                                })}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">
                          Plazo Total
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={
                              previewSaldoData.estrategia === "reduce_term"
                                ? "line-through text-xs"
                                : "font-mono"
                            }
                          >
                            {previewSaldoData.plazo_actual} meses
                          </span>
                          {previewSaldoData.estrategia === "reduce_term" && (
                            <>
                              <span>→</span>
                              <span className="font-bold text-blue-700">
                                {previewSaldoData.nuevo_plazo} meses
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-blue-700 mt-2">
                      {previewSaldoData.estrategia === "reduce_amount" ? (
                        <span>
                          La cuota mensual será menor, manteniendo el mismo
                          plazo
                        </span>
                      ) : (
                        <span>
                          Terminará de pagar{" "}
                          {previewSaldoData.plazo_actual -
                            previewSaldoData.nuevo_plazo}{" "}
                          meses antes, manteniendo la misma cuota
                        </span>
                      )}
                    </div>
                  </div>
                )}

              {previewSaldoData.finalizado && (
                <div className="bg-green-50 border border-green-200 rounded-md p-3">
                  <p className="text-sm text-green-800 font-medium">
                    Este abono finalizará el crédito completamente
                  </p>
                </div>
              )}

              {previewSaldoData.restante_saldo > 0.5 && (
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                  <p className="text-sm text-amber-800">
                    Saldo restante después de aplicar:{" "}
                    <strong>
                      ₡
                      {Number(
                        previewSaldoData.restante_saldo
                      ).toLocaleString("de-DE", {
                        minimumFractionDigits: 2,
                      })}
                    </strong>
                  </p>
                </div>
              )}
              {previewSaldoData.excedente > 0.5 && (
                <Alert>
                  <AlertDescription>
                    Excedente de ₡{previewSaldoData.excedente.toFixed(2)} no
                    se puede aplicar a esta cuota
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button onClick={confirmarAsignacion}>
              Confirmar Aplicación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirmar Reintegro de Saldo */}
      <Dialog open={reintegroDialogOpen} onOpenChange={setReintegroDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Reintegro de Saldo</DialogTitle>
            <DialogDescription>
              Esta acción marcará el saldo como procesado sin aplicarlo a ningún
              crédito.
            </DialogDescription>
          </DialogHeader>

          {saldoToReintegrar && (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cliente:</span>
                      <span className="font-medium">
                        {saldoToReintegrar.lead_name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cédula:</span>
                      <span className="font-medium">
                        {saldoToReintegrar.cedula}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monto:</span>
                      <span className="font-bold text-lg text-orange-600">
                        ₡
                        {Number(saldoToReintegrar.monto).toLocaleString(
                          "de-DE",
                          { minimumFractionDigits: 2 }
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Deductora:</span>
                      <span className="font-medium">
                        {saldoToReintegrar.deductora}
                      </span>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>

              <Alert variant="destructive">
                <AlertDescription>
                  <strong>Importante:</strong> El saldo será marcado como
                  reintegrado y ya no aparecerá en esta lista. No se aplicará a
                  ningún crédito ni se registrarán movimientos contables.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReintegroDialogOpen(false);
                setSaldoToReintegrar(null);
              }}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmarReintegro}>
              Confirmar Reintegro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Badge para mostrar el conteo de saldos pendientes en un tab trigger */
export function SaldosBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-1.5 inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full bg-orange-500 text-white text-xs font-bold">
      {count}
    </span>
  );
}
