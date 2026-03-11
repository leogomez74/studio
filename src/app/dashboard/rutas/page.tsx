"use client";

import React, { useState, useEffect, useCallback } from "react";
import { PackageCheck, PlusCircle, Truck, Calendar as CalendarIcon, Navigation } from "lucide-react";
import { ProtectedPage } from "@/components/ProtectedPage";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/components/auth-guard";
import api from "@/lib/axios";
import type { UserOption } from "@/components/rutas/types";
import TareasPendientesTab from "@/components/rutas/TareasPendientesTab";
import GenerarRutaTab from "@/components/rutas/GenerarRutaTab";
import RutasActivasTab from "@/components/rutas/RutasActivasTab";
import HistorialTab from "@/components/rutas/HistorialTab";
import MiRutaTab from "@/components/rutas/MiRutaTab";

export default function RutasPage() {
  const { user } = useAuth();
  const isAdmin = user?.role?.full_access === true;

  const [activeTab, setActiveTab] = useState(isAdmin ? "pendientes" : "mi-ruta");
  const [users, setUsers] = useState<UserOption[]>([]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.get("/api/agents");
      setUsers(res.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Asegurar tab válido al cambiar de rol (edge case)
  useEffect(() => {
    if (!isAdmin && (activeTab === "pendientes" || activeTab === "generar" || activeTab === "activas")) {
      setActiveTab("mi-ruta");
    }
  }, [isAdmin, activeTab]);

  return (
    <ProtectedPage module="rutas">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Rutas</h1>
            <p className="text-muted-foreground">Gestión de tareas logísticas y rutas de mensajería</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-center">
            {isAdmin && (
              <>
                <TabsTrigger value="pendientes">
                  <PackageCheck className="h-4 w-4 mr-1" />
                  Panel
                </TabsTrigger>
                <TabsTrigger value="generar">
                  <PlusCircle className="h-4 w-4 mr-1" />
                  Generar Ruta
                </TabsTrigger>
                <TabsTrigger value="activas">
                  <Truck className="h-4 w-4 mr-1" />
                  Rutas Activas
                </TabsTrigger>
              </>
            )}
            {!isAdmin && (
              <TabsTrigger value="mi-ruta">
                <Navigation className="h-4 w-4 mr-1" />
                Mi Ruta
              </TabsTrigger>
            )}
            <TabsTrigger value="historial">
              <CalendarIcon className="h-4 w-4 mr-1" />
              Historial
            </TabsTrigger>
          </TabsList>

          {isAdmin && (
            <>
              <TabsContent value="pendientes">
                <TareasPendientesTab users={users} />
              </TabsContent>
              <TabsContent value="generar">
                <GenerarRutaTab users={users} onGenerated={() => setActiveTab("activas")} />
              </TabsContent>
              <TabsContent value="activas">
                <RutasActivasTab />
              </TabsContent>
            </>
          )}
          {!isAdmin && (
            <TabsContent value="mi-ruta">
              <MiRutaTab />
            </TabsContent>
          )}
          <TabsContent value="historial">
            <HistorialTab />
          </TabsContent>
        </Tabs>
      </div>
    </ProtectedPage>
  );
}
