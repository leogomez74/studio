'use client';

import React, { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProtectedPage } from '@/components/ProtectedPage';
import { usePermissions } from '@/contexts/PermissionsContext';
import EmpresasCRUD from '@/components/configuracion/EmpresasCRUD';
import InstitucionesCRUD from '@/components/configuracion/InstitucionesCRUD';
import ProductosCRUD from '@/components/configuracion/ProductosCRUD';
import RolesPermisosManager from '@/components/configuracion/RolesPermisosManager';
import TasasCRUD from '@/components/configuracion/TasasCRUD';
import ContabilidadErpTab from '@/components/configuracion/ContabilidadErpTab';
import EmbargoConfiguracionTab from '@/components/embargo-configuracion-tab';
import UsuariosTab from '@/components/configuracion/UsuariosTab';
import PrestamosTab from '@/components/configuracion/PrestamosTab';
import PolizaTab from '@/components/configuracion/PolizaTab';
import PatronosTab from '@/components/configuracion/PatronosTab';
import DeductorasTab from '@/components/configuracion/DeductorasTab';
import ProfesionesCRUD from '@/components/configuracion/ProfesionesCRUD';
import TareasAutomationTab from '@/components/configuracion/TareasAutomationTab';
import { WorkflowsTab } from '@/components/configuracion/WorkflowsTab';
import { LabelManager } from '@/components/configuracion/LabelManager';
import IntegracionesTab from '@/components/configuracion/IntegracionesTab';
import ApiTokensTab from '@/components/configuracion/ApiTokensTab';
import { EvolutionApiTab } from '@/components/configuracion/EvolutionApiTab';

type TabDef = {
  value: string;
  label: string;
  module: string;
  Component: React.ComponentType;
};

const TABS: TabDef[] = [
  { value: 'prestamos',      label: 'Préstamos',             module: 'config_prestamos',     Component: PrestamosTab },
  { value: 'tasas',          label: 'Tasas',                 module: 'config_tasas',         Component: TasasCRUD },
  { value: 'productos',      label: 'Créditos',              module: 'config_productos',     Component: ProductosCRUD },
  { value: 'poliza',         label: 'Póliza',                module: 'config_poliza',        Component: PolizaTab },
  { value: 'embargo',        label: 'Embargo',               module: 'config_embargo',       Component: EmbargoConfiguracionTab },
  { value: 'usuarios',       label: 'Usuarios',              module: 'config_usuarios',      Component: UsuariosTab },
  { value: 'roles-permisos', label: 'Roles y Permisos',      module: 'config_roles',         Component: RolesPermisosManager },
  { value: 'patronos',       label: 'Patronos',              module: 'config_patronos',      Component: PatronosTab },
  { value: 'deductoras',     label: 'Deductoras',            module: 'config_deductoras',    Component: DeductorasTab },
  { value: 'empresas',       label: 'Docs. por Institución', module: 'config_empresas',      Component: EmpresasCRUD },
  { value: 'instituciones',  label: 'Instituciones',         module: 'config_instituciones', Component: InstitucionesCRUD },
  { value: 'profesiones',    label: 'Profesiones',           module: 'profesiones',          Component: ProfesionesCRUD },
  { value: 'api',            label: 'Contabilidad ERP',      module: 'config_contabilidad',  Component: ContabilidadErpTab },
  { value: 'tareas',         label: 'Tareas',                module: 'config_tareas_auto',   Component: TareasAutomationTab },
  { value: 'workflows',      label: 'Flujos',                module: 'config_workflows',     Component: WorkflowsTab },
  { value: 'labels',         label: 'Etiquetas',             module: 'config_labels',        Component: LabelManager },
  { value: 'integraciones',  label: 'Integraciones',         module: 'config_integraciones', Component: IntegracionesTab },
  { value: 'api-tokens',     label: 'API Tokens',            module: 'config_api_tokens',    Component: ApiTokensTab },
  { value: 'evolution-api',  label: 'WhatsApp',              module: 'config_whatsapp',      Component: EvolutionApiTab },
];

const CONFIG_MODULES = TABS.map(t => t.module);

export default function ConfiguracionPage() {
  const { canViewModule, loading } = usePermissions();

  // Durante loading, canViewModule devuelve true para todo (evita flicker).
  // Una vez cargado, filtra estrictamente por permisos del usuario.
  const visibleTabs = useMemo(() => {
    return TABS.filter(t => canViewModule(t.module));
  }, [canViewModule, loading]);

  const [activeTab, setActiveTab] = useState<string>('');

  React.useEffect(() => {
    if (!activeTab && visibleTabs.length > 0) {
      setActiveTab(visibleTabs[0].value);
    }
  }, [visibleTabs, activeTab]);

  return (
    <ProtectedPage module={CONFIG_MODULES}>
      {!loading && visibleTabs.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          No tienes permiso para ver ninguna sección de configuración.
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(String(v))}>
          <TabsList className="mb-4 h-auto flex-wrap gap-y-1">
            {visibleTabs.map(t => (
              <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
            ))}
          </TabsList>

          {visibleTabs.map(t => {
            const Comp = t.Component;
            return (
              <TabsContent key={t.value} value={t.value}>
                <Comp />
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </ProtectedPage>
  );
}
