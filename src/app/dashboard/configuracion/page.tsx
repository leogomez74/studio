'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProtectedPage } from '@/components/ProtectedPage';
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
import TareasAutomationTab from '@/components/configuracion/TareasAutomationTab';
import { WorkflowsTab } from '@/components/configuracion/WorkflowsTab';
import { LabelManager } from '@/components/configuracion/LabelManager';
import IntegracionesTab from '@/components/configuracion/IntegracionesTab';
import ApiTokensTab from '@/components/configuracion/ApiTokensTab';

export default function ConfiguracionPage() {
  const [activeTab, setActiveTab] = useState<string>('prestamos');

  return (
    <ProtectedPage module={['config_general', 'config_personas', 'config_usuarios', 'config_contabilidad', 'config_sistema']}>
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(String(v))}>
        <TabsList className="mb-4 h-auto flex-wrap gap-y-1">
          <TabsTrigger value="prestamos">Préstamos</TabsTrigger>
          <TabsTrigger value="tasas">Tasas</TabsTrigger>
          <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
          <TabsTrigger value="roles-permisos">Roles y Permisos</TabsTrigger>
          <TabsTrigger value="patronos">Patronos</TabsTrigger>
          <TabsTrigger value="deductoras">Deductoras</TabsTrigger>
          <TabsTrigger value="empresas">Empresas</TabsTrigger>
          <TabsTrigger value="instituciones">Instituciones</TabsTrigger>
          <TabsTrigger value="productos">Créditos</TabsTrigger>
          <TabsTrigger value="api">Contabilidad ERP</TabsTrigger>
          <TabsTrigger value="poliza">Póliza</TabsTrigger>
          <TabsTrigger value="embargo">Embargo</TabsTrigger>
          <TabsTrigger value="tareas">Tareas</TabsTrigger>
          <TabsTrigger value="workflows">Flujos</TabsTrigger>
          <TabsTrigger value="labels">Etiquetas</TabsTrigger>
          <TabsTrigger value="integraciones">Integraciones</TabsTrigger>
          <TabsTrigger value="api-tokens">API Tokens</TabsTrigger>
        </TabsList>

        <TabsContent value="prestamos">
          <PrestamosTab />
        </TabsContent>

        <TabsContent value="tasas">
          <TasasCRUD />
        </TabsContent>

        <TabsContent value="usuarios">
          <UsuariosTab />
        </TabsContent>

        <TabsContent value="roles-permisos">
          <RolesPermisosManager />
        </TabsContent>

        <TabsContent value="patronos">
          <PatronosTab />
        </TabsContent>

        <TabsContent value="deductoras">
          <DeductorasTab />
        </TabsContent>

        <TabsContent value="empresas">
          <EmpresasCRUD />
        </TabsContent>

        <TabsContent value="instituciones">
          <InstitucionesCRUD />
        </TabsContent>

        <TabsContent value="productos">
          <ProductosCRUD />
        </TabsContent>

        <TabsContent value="api">
          <ContabilidadErpTab />
        </TabsContent>

        <TabsContent value="poliza">
          <PolizaTab />
        </TabsContent>

        <TabsContent value="embargo">
          <EmbargoConfiguracionTab />
        </TabsContent>

        <TabsContent value="tareas">
          <TareasAutomationTab />
        </TabsContent>

        <TabsContent value="workflows">
          <WorkflowsTab />
        </TabsContent>

        <TabsContent value="labels">
          <LabelManager />
        </TabsContent>

        <TabsContent value="integraciones">
          <IntegracionesTab />
        </TabsContent>

        <TabsContent value="api-tokens">
          <ApiTokensTab />
        </TabsContent>
      </Tabs>
    </ProtectedPage>
  );
}
