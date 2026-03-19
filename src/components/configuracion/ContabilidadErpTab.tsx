'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { PlusCircle, Loader2, Pencil, Trash } from 'lucide-react';
import api from '@/lib/axios';
import { useToast } from '@/hooks/use-toast';

const ACCOUNTING_ENTRY_TYPES = [
  {
    value: 'FORMALIZACION',
    label: 'Formalización de Crédito',
    description: 'Al aprobar y formalizar un crédito',
    controller: 'CreditController@update',
    reference: 'CREDIT-{ID}'
  },
  {
    value: 'PAGO_PLANILLA',
    label: 'Pago de Planilla',
    description: 'Pago por descuento de planilla',
    controller: 'CreditPaymentController@store',
    reference: 'PLAN-{ID}'
  },
  {
    value: 'PAGO_VENTANILLA',
    label: 'Pago de Ventanilla',
    description: 'Pago manual en ventanilla',
    controller: 'CreditPaymentController@store',
    reference: 'VENT-{ID}'
  },
  {
    value: 'ABONO_EXTRAORDINARIO',
    label: 'Abono Extraordinario',
    description: 'Abono extraordinario (adelanto de cuotas)',
    controller: 'CreditPaymentController@storeExtraordinary',
    reference: 'EXTRA-{ID}'
  },
  {
    value: 'CANCELACION_ANTICIPADA',
    label: 'Cancelación Anticipada',
    description: 'Pago total anticipado del crédito',
    controller: 'CreditPaymentController@cancelCredit',
    reference: 'CANCEL-{ID}'
  },
  {
    value: 'REFUNDICION_CIERRE',
    label: 'Refundición (Cierre)',
    description: 'Cierre del crédito antiguo en refundición',
    controller: 'RefundicionController@store',
    reference: 'REFUND-CLOSE-{ID}'
  },
  {
    value: 'REFUNDICION_NUEVO',
    label: 'Refundición (Nuevo)',
    description: 'Apertura del nuevo crédito refundido',
    controller: 'RefundicionController@store',
    reference: 'REFUND-NEW-{ID}'
  },
  {
    value: 'REINTEGRO_SALDO',
    label: 'Reintegro de Saldo Pendiente',
    description: 'Devolución de saldo pendiente al cliente',
    controller: 'CreditController@reintegro',
    reference: 'DEVOL-{ID}'
  },
  {
    value: 'ANULACION_PLANILLA',
    label: 'Anulación de Planilla',
    description: 'Reversa de todos los pagos de una planilla completa',
    controller: 'PlanillaController@destroy',
    reference: 'ANUL-PLAN-{ID}'
  },
  {
    value: 'REVERSO_PAGO',
    label: 'Anulación de Abono',
    description: 'Anulación de abono individual',
    controller: 'CreditPaymentController@destroy',
    reference: 'REVERSE-PAY-{ID}'
  },
  {
    value: 'REVERSO_EXTRAORDINARIO',
    label: 'Reverso de Abono Extraordinario',
    description: 'Anulación de abono extraordinario',
    controller: 'CreditPaymentController@destroyExtraordinary',
    reference: 'REVERSE-EXTRA-{ID}'
  },
  {
    value: 'REVERSO_CANCELACION',
    label: 'Reverso de Cancelación Anticipada',
    description: 'Anulación de cancelación anticipada',
    controller: 'CreditPaymentController@destroyCancellation',
    reference: 'REVERSE-CANCEL-{ID}'
  },
  {
    value: 'ABONO_CAPITAL',
    label: 'Abono a Capital (Saldo Pendiente)',
    description: 'Aplicación de saldo sobrante como abono a capital del crédito',
    controller: 'SaldoPendienteController@asignar',
    reference: 'CAPITAL-{ID}'
  },
  {
    value: 'SALDO_SOBRANTE',
    label: 'Saldo Sobrante de Planilla',
    description: 'Se dispara automáticamente cuando queda sobrante tras pagar todos los créditos de una planilla',
    controller: 'CreditPaymentController@upload (automático)',
    reference: 'SOB-{ID}'
  },
  {
    value: 'ANULACION_SOBRANTE',
    label: 'Anulación de Sobrante de Planilla',
    description: 'Se dispara automáticamente al anular una planilla que tenía sobrante retenido. Es el espejo inverso de SALDO_SOBRANTE.',
    controller: 'PlanillaUploadController@anular (automático)',
    reference: 'ANULA-SOB-{ID}'
  },
  // --- Inversiones ---
  {
    value: 'INV_CAPITAL_RECIBIDO',
    label: 'Inversión — Capital Recibido',
    description: 'Al registrar una nueva inversión (entrada de capital del inversionista)',
    controller: 'InvestmentController@store',
    reference: 'INV-CAP-{ID}'
  },
  {
    value: 'INV_INTERES_DEVENGADO',
    label: 'Inversión — Interés Devengado',
    description: '1er asiento al marcar cupón pagado: Débito Intereses sobre Préstamos Recibidos / Crédito Intereses por Pagar [inv]',
    controller: 'InvestmentCouponController@markPaid / markBulkPaid / bulkPayByDesembolso',
    reference: 'INV-INT-{CUPON_ID}'
  },
  {
    value: 'INV_RETENCION_INTERES',
    label: 'Inversión — Retención de Interés',
    description: '2do asiento al marcar cupón pagado (automático): Débito Intereses por Pagar [inv] / Crédito Retenciones a la Fuente',
    controller: 'InvestmentCouponController@markPaid / markBulkPaid / bulkPayByDesembolso',
    reference: 'INV-RET-{CUPON_ID}'
  },
  {
    value: 'INV_CANCELACION_TOTAL',
    label: 'Inversión — Cancelación Total',
    description: 'Al devolver capital total al inversionista (con o sin intereses)',
    controller: 'InvestmentController@cancelacionTotal',
    reference: 'INV-CANCEL-{ID}'
  },
  {
    value: 'INV_PAGO_CAPITAL',
    label: 'Inversión — Pago de Capital',
    description: 'Al registrar un pago manual con tipo=Capital/Adelanto/Abono/Liquidación: Débito Préstamos por Pagar [inv] / Crédito Bancos',
    controller: 'InvestmentPaymentController@store',
    reference: 'INV-PAY-{ID}'
  },
];

export default function ContabilidadErpTab() {
  const { toast } = useToast();

  // ERP Accounting state
  const [erpAccounts, setErpAccounts] = useState<any[]>([]);
  const [erpLoading, setErpLoading] = useState(false);
  const [erpSaving, setErpSaving] = useState<number | null>(null);
  const [erpConfigured, setErpConfigured] = useState(false);
  const [erpAccountsConfigured, setErpAccountsConfigured] = useState(false);
  const [erpTestLoading, setErpTestLoading] = useState(false);
  const [erpNewAccount, setErpNewAccount] = useState({ key: '', account_code: '', account_name: '', description: '' });
  const [erpAddDialogOpen, setErpAddDialogOpen] = useState(false);
  const [erpEditDialogOpen, setErpEditDialogOpen] = useState(false);
  const [erpEditAccount, setErpEditAccount] = useState<any | null>(null);
  const [erpEditForm, setErpEditForm] = useState({ key: '', account_code: '', account_name: '', description: '' });

  // Deductora Mapping state
  const [deductorasMapping, setDeductorasMapping] = useState<any[]>([]);
  const [deductoraMappingLoading, setDeductoraMappingLoading] = useState(false);
  const [savingDeductoraMapping, setSavingDeductoraMapping] = useState<number | null>(null);

  // Investor Mapping state
  const [investorsMapping, setInvestorsMapping] = useState<any[]>([]);
  const [investorMappingLoading, setInvestorMappingLoading] = useState(false);
  const [savingInvestorMapping, setSavingInvestorMapping] = useState<number | null>(null);

  // Accounting Entry Configuration state
  const [accountingConfigs, setAccountingConfigs] = useState<any[]>([]);
  const [accountingConfigsLoading, setAccountingConfigsLoading] = useState(false);
  const [isAccountingConfigDialogOpen, setIsAccountingConfigDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<any | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configForm, setConfigForm] = useState({
    entry_type: '',
    name: '',
    description: '',
    active: true,
    lines: [
      { movement_type: 'debit', account_type: 'fixed', account_key: '', description: '', amount_component: 'total', cargo_adicional_key: '' },
      { movement_type: 'credit', account_type: 'fixed', account_key: '', description: '', amount_component: 'total', cargo_adicional_key: '' }
    ]
  });

  const fetchErpAccounts = useCallback(async () => {
    setErpLoading(true);
    try {
      const res = await api.get('/api/erp-accounting/accounts');
      setErpAccounts(res.data.accounts || []);
      setErpConfigured(res.data.erp_configured || false);
      setErpAccountsConfigured(res.data.accounts_configured || false);
    } catch (err) {
      console.error('Error loading ERP accounts:', err);
    } finally {
      setErpLoading(false);
    }
  }, []);

  const saveErpAccount = async (id: number, accountCode: string) => {
    setErpSaving(id);
    try {
      await api.put(`/api/erp-accounting/accounts/${id}`, { account_code: accountCode });
      toast({ title: 'Cuenta actualizada', description: 'Código de cuenta guardado exitosamente.' });
      fetchErpAccounts();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'No se pudo guardar.', variant: 'destructive' });
    } finally {
      setErpSaving(null);
    }
  };

  const addErpAccount = async () => {
    if (!erpNewAccount.key || !erpNewAccount.account_code || !erpNewAccount.account_name) {
      toast({ title: 'Error', description: 'Completa los campos requeridos.', variant: 'destructive' });
      return;
    }
    try {
      await api.post('/api/erp-accounting/accounts', erpNewAccount);
      toast({ title: 'Cuenta agregada', description: 'Nueva cuenta contable registrada.' });
      setErpNewAccount({ key: '', account_code: '', account_name: '', description: '' });
      setErpAddDialogOpen(false);
      fetchErpAccounts();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'No se pudo agregar.', variant: 'destructive' });
    }
  };

  const openEditErpAccount = (account: any) => {
    setErpEditAccount(account);
    setErpEditForm({
      key: account.key,
      account_code: account.account_code || '',
      account_name: account.account_name,
      description: account.description || '',
    });
    setErpEditDialogOpen(true);
  };

  const updateErpAccount = async () => {
    if (!erpEditAccount) return;
    if (!erpEditForm.account_code || !erpEditForm.account_name) {
      toast({ title: 'Error', description: 'Código y nombre son requeridos.', variant: 'destructive' });
      return;
    }
    setErpSaving(erpEditAccount.id);
    try {
      await api.put(`/api/erp-accounting/accounts/${erpEditAccount.id}`, erpEditForm);
      toast({ title: 'Cuenta actualizada', description: 'Los datos de la cuenta fueron guardados.' });
      setErpEditDialogOpen(false);
      setErpEditAccount(null);
      fetchErpAccounts();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'No se pudo actualizar.', variant: 'destructive' });
    } finally {
      setErpSaving(null);
    }
  };

  const deleteErpAccount = async (id: number) => {
    try {
      await api.delete(`/api/erp-accounting/accounts/${id}`);
      toast({ title: 'Cuenta eliminada' });
      fetchErpAccounts();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'No se pudo eliminar.', variant: 'destructive' });
    }
  };

  const testErpConnection = async () => {
    setErpTestLoading(true);
    try {
      const res = await api.post('/api/erp-accounting/test-connection');
      toast({ title: 'Conexión exitosa', description: res.data.message, variant: 'success' });
    } catch (err: any) {
      toast({ title: 'Error de conexión', description: err.response?.data?.message || 'No se pudo conectar con el ERP.', variant: 'destructive' });
    } finally {
      setErpTestLoading(false);
    }
  };

  // Deductora Mapping functions
  const fetchDeductorasMapping = useCallback(async () => {
    setDeductoraMappingLoading(true);
    try {
      const res = await api.get('/api/deductoras');
      setDeductorasMapping(res.data || []);
    } catch (err) {
      console.error('Error loading deductoras for mapping:', err);
      toast({ title: 'Error', description: 'No se pudieron cargar las deductoras.', variant: 'destructive' });
    } finally {
      setDeductoraMappingLoading(false);
    }
  }, [toast]);

  const saveDeductoraMapping = async (deductoraId: number, erpAccountKey: string) => {
    setSavingDeductoraMapping(deductoraId);
    try {
      await api.put(`/api/deductoras/${deductoraId}`, { erp_account_key: erpAccountKey });
      toast({ title: 'Mapeo actualizado', description: 'Cuenta ERP asignada a la deductora.' });
      fetchDeductorasMapping();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'No se pudo guardar.', variant: 'destructive' });
    } finally {
      setSavingDeductoraMapping(null);
    }
  };

  // Investor Mapping functions
  const fetchInvestorsMapping = useCallback(async () => {
    setInvestorMappingLoading(true);
    try {
      const res = await api.get('/api/investors');
      setInvestorsMapping(res.data.data || res.data || []);
    } catch (err) {
      console.error('Error loading investors for mapping:', err);
      toast({ title: 'Error', description: 'No se pudieron cargar los inversionistas.', variant: 'destructive' });
    } finally {
      setInvestorMappingLoading(false);
    }
  }, [toast]);

  const saveInvestorMapping = async (investorId: number, field: 'erp_account_key_prestamos' | 'erp_account_key_intereses', erpAccountKey: string) => {
    setSavingInvestorMapping(investorId);
    try {
      await api.put(`/api/investors/${investorId}`, { [field]: erpAccountKey });
      toast({ title: 'Mapeo actualizado', description: 'Cuenta ERP asignada al inversionista.' });
      fetchInvestorsMapping();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'No se pudo guardar.', variant: 'destructive' });
    } finally {
      setSavingInvestorMapping(null);
    }
  };

  // Accounting Entry Configuration functions
  const fetchAccountingConfigs = useCallback(async () => {
    setAccountingConfigsLoading(true);
    try {
      const res = await api.get('/api/accounting-entry-configs');
      setAccountingConfigs(res.data.configs || []);
    } catch (err) {
      console.error('Error loading accounting configs:', err);
      toast({ title: 'Error', description: 'No se pudieron cargar las configuraciones de asientos.', variant: 'destructive' });
    } finally {
      setAccountingConfigsLoading(false);
    }
  }, [toast]);

  const openCreateConfigDialog = () => {
    setEditingConfig(null);
    setConfigForm({
      entry_type: '',
      name: '',
      description: '',
      active: true,
      lines: [
        { movement_type: 'debit', account_type: 'fixed', account_key: '', description: '', amount_component: 'total', cargo_adicional_key: '' },
        { movement_type: 'credit', account_type: 'fixed', account_key: '', description: '', amount_component: 'total', cargo_adicional_key: '' }
      ]
    });
    setIsAccountingConfigDialogOpen(true);
  };

  const openEditConfigDialog = (config: any) => {
    setEditingConfig(config);
    // Ensure all lines have the new fields with defaults
    const linesWithDefaults = (config.lines || []).map((line: any) => ({
      movement_type: line.movement_type || 'debit',
      account_type: line.account_type || 'fixed',
      account_key: line.account_key || '',
      description: line.description || '',
      amount_component: line.amount_component || 'total',
      cargo_adicional_key: line.cargo_adicional_key || ''
    }));

    setConfigForm({
      entry_type: config.entry_type || '',
      name: config.name || '',
      description: config.description || '',
      active: config.active ?? true,
      lines: linesWithDefaults.length > 0 ? linesWithDefaults : [
        { movement_type: 'debit', account_type: 'fixed', account_key: '', description: '', amount_component: 'total', cargo_adicional_key: '' },
        { movement_type: 'credit', account_type: 'fixed', account_key: '', description: '', amount_component: 'total', cargo_adicional_key: '' }
      ]
    });
    setIsAccountingConfigDialogOpen(true);
  };

  const closeConfigDialog = () => {
    setIsAccountingConfigDialogOpen(false);
    setEditingConfig(null);
  };

  const addConfigLine = () => {
    setConfigForm(prev => ({
      ...prev,
      lines: [...prev.lines, { movement_type: 'debit', account_type: 'fixed', account_key: '', description: '', amount_component: 'total', cargo_adicional_key: '' }]
    }));
  };

  const removeConfigLine = (index: number) => {
    setConfigForm(prev => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index)
    }));
  };

  const updateConfigLine = (index: number, field: string, value: any) => {
    setConfigForm(prev => ({
      ...prev,
      lines: prev.lines.map((line, i) => i === index ? { ...line, [field]: value } : line)
    }));
  };

  const handleConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configForm.name.trim() || !configForm.entry_type.trim()) {
      toast({ title: 'Error', description: 'Completa los campos requeridos.', variant: 'destructive' });
      return;
    }
    if (configForm.lines.length < 2) {
      toast({ title: 'Error', description: 'Se requieren al menos 2 líneas para un asiento contable.', variant: 'destructive' });
      return;
    }

    setSavingConfig(true);
    try {
      const payload = {
        entry_type: configForm.entry_type,
        name: configForm.name,
        description: configForm.description,
        active: configForm.active,
        lines: configForm.lines
      };

      if (editingConfig) {
        await api.put(`/api/accounting-entry-configs/${editingConfig.id}`, payload);
        toast({ title: 'Actualizado', description: 'Configuración de asiento actualizada.' });
      } else {
        await api.post('/api/accounting-entry-configs', payload);
        toast({ title: 'Creado', description: 'Configuración de asiento creada.' });
      }

      closeConfigDialog();
      fetchAccountingConfigs();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'No se pudo guardar.', variant: 'destructive' });
    } finally {
      setSavingConfig(false);
    }
  };

  const toggleConfigActive = async (id: number) => {
    try {
      await api.post(`/api/accounting-entry-configs/${id}/toggle`);
      toast({ title: 'Actualizado', description: 'Estado de configuración cambiado.' });
      fetchAccountingConfigs();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'No se pudo actualizar.', variant: 'destructive' });
    }
  };

  const deleteConfig = async (id: number) => {
    if (!confirm('¿Eliminar esta configuración de asiento?')) return;
    try {
      await api.delete(`/api/accounting-entry-configs/${id}`);
      toast({ title: 'Eliminado', description: 'Configuración eliminada.' });
      fetchAccountingConfigs();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'No se pudo eliminar.', variant: 'destructive' });
    }
  };

  useEffect(() => {
    fetchErpAccounts();
    fetchDeductorasMapping();
    fetchInvestorsMapping();
    fetchAccountingConfigs();
  }, [fetchErpAccounts, fetchDeductorasMapping, fetchInvestorsMapping, fetchAccountingConfigs]);

  return (
        <div className="space-y-6">
          {/* Estado de Conexión */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Conexión con ERP Contable</CardTitle>
                  <CardDescription>
                    Estado de la integración con el sistema de contabilidad externo. Las credenciales se configuran en el archivo .env del servidor.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  onClick={testErpConnection}
                  disabled={erpTestLoading}
                >
                  {erpTestLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Probar Conexión
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${erpConfigured ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  <div className={`w-2 h-2 rounded-full ${erpConfigured ? 'bg-green-500' : 'bg-red-500'}`} />
                  {erpConfigured ? 'API ERP Configurada' : 'API ERP No Configurada'}
                </div>
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${erpAccountsConfigured ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'}`}>
                  <div className={`w-2 h-2 rounded-full ${erpAccountsConfigured ? 'bg-green-500' : 'bg-yellow-500'}`} />
                  {erpAccountsConfigured ? 'Cuentas Contables Configuradas' : 'Cuentas Pendientes de Configurar'}
                </div>
              </div>
              {!erpConfigured && (
                <p className="text-sm text-muted-foreground mt-3">
                  Agrega las siguientes variables al archivo <code className="bg-muted px-1 py-0.5 rounded text-xs">.env</code> del backend: <code className="bg-muted px-1 py-0.5 rounded text-xs">ERP_API_URL</code>, <code className="bg-muted px-1 py-0.5 rounded text-xs">ERP_API_EMAIL</code>, <code className="bg-muted px-1 py-0.5 rounded text-xs">ERP_API_PASSWORD</code>
                </p>
              )}
            </CardContent>
          </Card>

          {/* Cuentas Contables */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Cuentas Contables</CardTitle>
                  <CardDescription>
                    Configura los códigos de cuenta del catálogo del ERP para los asientos contables automáticos.
                  </CardDescription>
                </div>
                <Dialog open={erpAddDialogOpen} onOpenChange={setErpAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Agregar Cuenta
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Agregar Cuenta Contable</DialogTitle>
                      <DialogDescription>Agrega una nueva cuenta del catálogo del ERP.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Identificador Interno (key)</Label>
                        <Input
                          placeholder="ej: ingresos_intereses"
                          value={erpNewAccount.key}
                          onChange={(e) => setErpNewAccount(prev => ({ ...prev, key: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Código de Cuenta (ERP)</Label>
                        <Input
                          placeholder="ej: 4-100"
                          value={erpNewAccount.account_code}
                          onChange={(e) => setErpNewAccount(prev => ({ ...prev, account_code: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Nombre de la Cuenta</Label>
                        <Input
                          placeholder="ej: Ingresos por Intereses"
                          value={erpNewAccount.account_name}
                          onChange={(e) => setErpNewAccount(prev => ({ ...prev, account_name: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Descripción (opcional)</Label>
                        <Input
                          placeholder="Para qué se usa esta cuenta"
                          value={erpNewAccount.description}
                          onChange={(e) => setErpNewAccount(prev => ({ ...prev, description: e.target.value }))}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setErpAddDialogOpen(false)}>Cancelar</Button>
                      <Button onClick={addErpAccount}>Agregar</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Dialog de Edición de Cuenta ERP */}
                <Dialog open={erpEditDialogOpen} onOpenChange={(open) => { setErpEditDialogOpen(open); if (!open) setErpEditAccount(null); }}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Editar Cuenta Contable</DialogTitle>
                      <DialogDescription>Modifica los datos de la cuenta del catálogo del ERP.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Identificador Interno (key)</Label>
                        <Input
                          placeholder="ej: ingresos_intereses"
                          value={erpEditForm.key}
                          onChange={(e) => setErpEditForm(prev => ({ ...prev, key: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Código de Cuenta (ERP)</Label>
                        <Input
                          placeholder="ej: 4-100"
                          value={erpEditForm.account_code}
                          onChange={(e) => setErpEditForm(prev => ({ ...prev, account_code: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Nombre de la Cuenta</Label>
                        <Input
                          placeholder="ej: Ingresos por Intereses"
                          value={erpEditForm.account_name}
                          onChange={(e) => setErpEditForm(prev => ({ ...prev, account_name: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Descripción (opcional)</Label>
                        <Input
                          placeholder="Para qué se usa esta cuenta"
                          value={erpEditForm.description}
                          onChange={(e) => setErpEditForm(prev => ({ ...prev, description: e.target.value }))}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => { setErpEditDialogOpen(false); setErpEditAccount(null); }}>Cancelar</Button>
                      <Button onClick={updateErpAccount}>Guardar cambios</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {erpLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Identificador</TableHead>
                      <TableHead className="w-[120px]">Código ERP</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="w-[80px]">Estado</TableHead>
                      <TableHead className="w-[120px]">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {erpAccounts.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell className="font-mono text-sm">{account.key}</TableCell>
                        <TableCell>
                          <Input
                            className="h-8 w-28"
                            defaultValue={account.account_code}
                            placeholder="ej: 1-100"
                            onBlur={(e) => {
                              if (e.target.value !== account.account_code) {
                                saveErpAccount(account.id, e.target.value);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const target = e.target as HTMLInputElement;
                                if (target.value !== account.account_code) {
                                  saveErpAccount(account.id, target.value);
                                }
                              }
                            }}
                            disabled={erpSaving === account.id}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{account.account_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{account.description || '-'}</TableCell>
                        <TableCell>
                          {account.account_code ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800">Activa</span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-800">Pendiente</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {erpSaving === account.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-blue-600 hover:text-blue-700"
                                onClick={() => openEditErpAccount(account)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {!['banco_credipep', 'cuentas_por_cobrar'].includes(account.key) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => deleteErpAccount(account.id)}
                                >
                                  <Trash className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {erpAccounts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No hay cuentas contables configuradas
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Mapeo de Deductoras a Cuentas ERP */}
          <Card>
            <CardHeader>
              <CardTitle>Mapeo de Deductoras</CardTitle>
              <CardDescription>
                Asigna una cuenta contable del ERP a cada deductora registrada en el sistema.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {deductoraMappingLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Deductora</TableHead>
                      <TableHead>Cuenta ERP</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deductorasMapping.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                          No hay deductoras registradas
                        </TableCell>
                      </TableRow>
                    ) : (
                      deductorasMapping.map((deductora) => (
                        <TableRow key={deductora.id}>
                          <TableCell className="font-medium">{deductora.nombre}</TableCell>
                          <TableCell>
                            <Select
                              value={deductora.erp_account_key || 'none'}
                              onValueChange={(value) => saveDeductoraMapping(deductora.id, value === 'none' ? '' : value)}
                              disabled={savingDeductoraMapping === deductora.id}
                            >
                              <SelectTrigger className="w-[300px]">
                                <SelectValue placeholder="Seleccionar cuenta..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Sin asignar</SelectItem>
                                {erpAccounts.map((account) => (
                                  <SelectItem key={account.id} value={account.key}>
                                    {account.account_code ? `${account.account_code} - ` : ''}{account.account_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {savingDeductoraMapping === deductora.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : deductora.erp_account_key ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800">Mapeada</span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-800">Pendiente</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Mapeo de Inversionistas a Cuentas ERP */}
          <Card>
            <CardHeader>
              <CardTitle>Mapeo de Inversionistas</CardTitle>
              <CardDescription>
                Asigna una cuenta contable del ERP a cada inversionista. Se usa en asientos de tipo <strong>Inversionista</strong> para registrar intereses por pagar individualmente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {investorMappingLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Inversionista</TableHead>
                      <TableHead>Cédula</TableHead>
                      <TableHead>Préstamos por Pagar</TableHead>
                      <TableHead>Intereses por Pagar</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {investorsMapping.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No hay inversionistas registrados
                        </TableCell>
                      </TableRow>
                    ) : (
                      investorsMapping.map((investor) => (
                        <TableRow key={investor.id}>
                          <TableCell className="font-medium">{investor.name}</TableCell>
                          <TableCell className="text-muted-foreground">{investor.cedula}</TableCell>
                          <TableCell>
                            <Select
                              value={investor.erp_account_key_prestamos || 'none'}
                              onValueChange={(value) => saveInvestorMapping(investor.id, 'erp_account_key_prestamos', value === 'none' ? '' : value)}
                              disabled={savingInvestorMapping === investor.id}
                            >
                              <SelectTrigger className="w-[240px]">
                                <SelectValue placeholder="Seleccionar cuenta..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Sin asignar</SelectItem>
                                {erpAccounts.map((account) => (
                                  <SelectItem key={account.id} value={account.key}>
                                    {account.account_code ? `${account.account_code} - ` : ''}{account.account_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={investor.erp_account_key_intereses || 'none'}
                              onValueChange={(value) => saveInvestorMapping(investor.id, 'erp_account_key_intereses', value === 'none' ? '' : value)}
                              disabled={savingInvestorMapping === investor.id}
                            >
                              <SelectTrigger className="w-[240px]">
                                <SelectValue placeholder="Seleccionar cuenta..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Sin asignar</SelectItem>
                                {erpAccounts.map((account) => (
                                  <SelectItem key={account.id} value={account.key}>
                                    {account.account_code ? `${account.account_code} - ` : ''}{account.account_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {savingInvestorMapping === investor.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : investor.erp_account_key_prestamos && investor.erp_account_key_intereses ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800">Completo</span>
                            ) : investor.erp_account_key_prestamos || investor.erp_account_key_intereses ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-800">Parcial</span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-800">Pendiente</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Referencia de Tipos de Asientos */}
          <Card>
            <CardHeader>
              <CardTitle>Tipos de Asientos Disponibles</CardTitle>
              <CardDescription>
                Referencia de los eventos del sistema donde se pueden ejecutar asientos contables automáticos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Tipo</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Controlador</TableHead>
                    <TableHead className="w-[150px]">Referencia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ACCOUNTING_ENTRY_TYPES.map((type) => (
                    <TableRow key={type.value}>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{type.value}</code>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{type.label}</span>
                          <span className="text-sm text-muted-foreground">{type.description}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs text-muted-foreground">{type.controller}</code>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1 rounded">{type.reference}</code>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Configuración de Asientos Contables */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Configuración de Asientos Contables</CardTitle>
                  <CardDescription>
                    Configura las plantillas de asientos contables. Cada configuración puede tener múltiples débitos y créditos.
                  </CardDescription>
                </div>
                <Dialog open={isAccountingConfigDialogOpen} onOpenChange={setIsAccountingConfigDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" onClick={openCreateConfigDialog}>
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Nueva Configuración
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{editingConfig ? 'Editar Configuración' : 'Nueva Configuración'}</DialogTitle>
                      <DialogDescription>
                        Define el tipo de asiento y sus líneas contables.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleConfigSubmit} className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Tipo de Asiento (Dónde se ejecuta)</Label>
                          <Select
                            value={configForm.entry_type}
                            onValueChange={(value) => setConfigForm(prev => ({ ...prev, entry_type: value }))}
                            disabled={savingConfig}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar evento..." />
                            </SelectTrigger>
                            <SelectContent>
                              {ACCOUNTING_ENTRY_TYPES.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{type.label}</span>
                                    <span className="text-xs text-muted-foreground">{type.description}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Nombre</Label>
                          <Input
                            placeholder="ej: Pago de Planilla"
                            value={configForm.name}
                            onChange={(e) => setConfigForm(prev => ({ ...prev, name: e.target.value }))}
                            required
                            disabled={savingConfig}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Descripción</Label>
                        <Input
                          placeholder="Ej: Formalización crédito {reference} - {clienteNombre} ({cedula})"
                          value={configForm.description}
                          onChange={(e) => setConfigForm(prev => ({ ...prev, description: e.target.value }))}
                          disabled={savingConfig}
                        />
                        <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                          <strong>Variables disponibles:</strong> <code>{'{reference}'}</code> <code>{'{clienteNombre}'}</code> <code>{'{cedula}'}</code> <code>{'{credit_id}'}</code> <code>{'{deductora_nombre}'}</code> <code>{'{amount}'}</code>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Líneas del Asiento</Label>
                          <Button type="button" size="sm" variant="outline" onClick={addConfigLine} disabled={savingConfig}>
                            <PlusCircle className="h-4 w-4 mr-2" />
                            Agregar Línea
                          </Button>
                        </div>
                        <div className="space-y-3">
                          {configForm.lines.map((line, index) => (
                            <div key={index} className="border rounded-lg p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Línea {index + 1}</span>
                                {configForm.lines.length > 2 && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-600"
                                    onClick={() => removeConfigLine(index)}
                                    disabled={savingConfig}
                                  >
                                    <Trash className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                              <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-2">
                                  <Label>Movimiento</Label>
                                  <Select
                                    value={line.movement_type}
                                    onValueChange={(value) => updateConfigLine(index, 'movement_type', value)}
                                    disabled={savingConfig}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="debit">Débito</SelectItem>
                                      <SelectItem value="credit">Crédito</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label>Tipo de Cuenta</Label>
                                  <Select
                                    value={line.account_type}
                                    onValueChange={(value) => updateConfigLine(index, 'account_type', value)}
                                    disabled={savingConfig}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="fixed">Cuenta Fija</SelectItem>
                                      <SelectItem value="deductora">Deductora</SelectItem>
                                      <SelectItem value="deductora_or_fixed">Deductora o Fija (auto)</SelectItem>
                                      <SelectItem value="investor_prestamos">Inversionista — Préstamos por Pagar</SelectItem>
                                      <SelectItem value="investor_intereses">Inversionista — Intereses por Pagar</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label>Cuenta{line.account_type === 'fixed' ? ' (Requerida)' : line.account_type === 'deductora_or_fixed' ? ' (Fallback si no hay deductora)' : line.account_type === 'investor_prestamos' ? ' (Dinámica — Préstamos por Pagar)' : line.account_type === 'investor_intereses' ? ' (Dinámica — Intereses por Pagar)' : ' (Dinámica)'}</Label>
                                  {(line.account_type === 'fixed' || line.account_type === 'deductora_or_fixed') ? (
                                    <Select
                                      value={line.account_key || ''}
                                      onValueChange={(value) => updateConfigLine(index, 'account_key', value)}
                                      disabled={savingConfig}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {erpAccounts.map((account) => (
                                          <SelectItem key={account.id} value={account.key}>
                                            {account.account_code ? `${account.account_code} - ` : ''}{account.account_name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <Input
                                      value="Se resuelve en tiempo de ejecución"
                                      disabled
                                      className="bg-muted"
                                    />
                                  )}
                                </div>
                              </div>
                              <div className={`grid ${line.amount_component === 'cargo_adicional' ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
                                <div className="space-y-2">
                                  <Label>Componente del Monto</Label>
                                  <Select
                                    value={line.amount_component || 'total'}
                                    onValueChange={(value) => {
                                      updateConfigLine(index, 'amount_component', value);
                                      // Si no es cargo_adicional, limpiar el key
                                      if (value !== 'cargo_adicional') {
                                        updateConfigLine(index, 'cargo_adicional_key', '');
                                      }
                                    }}
                                    disabled={savingConfig}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="total">Monto Total</SelectItem>
                                      <SelectItem value="interes_corriente">Interés Corriente</SelectItem>
                                      <SelectItem value="interes_moratorio">Interés Moratorio</SelectItem>
                                      <SelectItem value="poliza">Póliza</SelectItem>
                                      <SelectItem value="capital">Capital/Amortización</SelectItem>
                                      <SelectItem value="sobrante">Sobrante (retención de más)</SelectItem>
                                      <SelectItem value="penalizacion">Penalización (abono anticipado)</SelectItem>
                                      <SelectItem value="cargos_adicionales_total">Cargos Adicionales (sumatoria total)</SelectItem>
                                      <SelectItem value="cargo_adicional">Cargo Adicional específico (seleccionar cuál →)</SelectItem>
                                      {(configForm.entry_type === 'FORMALIZACION' || configForm.entry_type === 'REFUNDICION_NUEVO') && (
                                        <SelectItem value="monto_neto">Monto Neto (Total − Cargos Adicionales)</SelectItem>
                                      )}
                                      {configForm.entry_type?.startsWith('INV_') && (
                                        <>
                                          <SelectItem value="interes_neto">Interés Neto (después de retención)</SelectItem>
                                          <SelectItem value="interes_bruto">Interés Bruto (antes de retención)</SelectItem>
                                          <SelectItem value="retencion">Retención Fiscal</SelectItem>
                                          <SelectItem value="total_interes_bruto">Sumatoria Interés Bruto (pago masivo)</SelectItem>
                                          <SelectItem value="total_retencion">Sumatoria Retención Fiscal (pago masivo)</SelectItem>
                                        </>
                                      )}
                                    </SelectContent>
                                  </Select>
                                </div>
                                {line.amount_component === 'cargo_adicional' && (
                                  <div className="space-y-2">
                                    <Label>¿Cuál Cargo Adicional?</Label>
                                    <Select
                                      value={line.cargo_adicional_key || ''}
                                      onValueChange={(value) => updateConfigLine(index, 'cargo_adicional_key', value)}
                                      disabled={savingConfig}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar cargo..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="comision">Comisión (3%)</SelectItem>
                                        <SelectItem value="transporte">Transporte</SelectItem>
                                        <SelectItem value="respaldo_deudor">Respaldo Deudor (solo Regular)</SelectItem>
                                        <SelectItem value="descuento_factura">Descuento Factura</SelectItem>
                                        <SelectItem value="cancelacion_manchas">Cancelación de Manchas</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}
                              </div>
                              <div className="space-y-2">
                                <Label>Descripción (opcional)</Label>
                                <Input
                                  placeholder="Ej: Cuenta por cobrar - Crédito {reference} o Pago {deductora_nombre}"
                                  value={line.description}
                                  onChange={(e) => updateConfigLine(index, 'description', e.target.value)}
                                  disabled={savingConfig}
                                />
                                <p className="text-xs text-muted-foreground">
                                  Usa variables: <code className="bg-muted px-1 rounded">{'{reference}'}</code> <code className="bg-muted px-1 rounded">{'{clienteNombre}'}</code> <code className="bg-muted px-1 rounded">{'{deductora_nombre}'}</code>
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={closeConfigDialog} disabled={savingConfig}>
                          Cancelar
                        </Button>
                        <Button type="submit" disabled={savingConfig}>
                          {savingConfig ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          {editingConfig ? 'Actualizar' : 'Crear'}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {accountingConfigsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Líneas</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accountingConfigs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No hay configuraciones de asientos
                        </TableCell>
                      </TableRow>
                    ) : (
                      accountingConfigs.map((config) => (
                        <TableRow key={config.id}>
                          <TableCell className="font-mono text-sm">{config.entry_type}</TableCell>
                          <TableCell className="font-medium">{config.name}</TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {config.lines?.length || 0} líneas
                            </span>
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={config.active}
                              onCheckedChange={() => toggleConfigActive(config.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openEditConfigDialog(config)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => deleteConfig(config.id)}
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Asientos Contables Automáticos (Sistema Actual) */}
          <Card>
            <CardHeader>
              <CardTitle>Asientos Contables Automáticos (Sistema Actual)</CardTitle>
              <CardDescription>
                Estos son los asientos hardcodeados que actualmente se generan automáticamente. Estos SIGUEN FUNCIONANDO hasta que crees configuraciones personalizadas que los reemplacen.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Operación</TableHead>
                    <TableHead>Débito</TableHead>
                    <TableHead>Crédito</TableHead>
                    <TableHead>Descripción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Formalización */}
                  <TableRow>
                    <TableCell className="font-medium">Formalización de Crédito</TableCell>
                    <TableCell><span className="text-sm font-mono">Cuentas por Cobrar</span></TableCell>
                    <TableCell><span className="text-sm font-mono">Banco CREDIPEP</span></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      Al aprobar y formalizar un crédito. <code className="text-xs bg-muted px-1 rounded">Ref: CREDIT-{'{ID}'}</code>
                    </TableCell>
                  </TableRow>

                  {/* Pagos - Planilla */}
                  <TableRow>
                    <TableCell className="font-medium">Pago de Planilla</TableCell>
                    <TableCell><span className="text-sm font-mono">Banco CREDIPEP</span></TableCell>
                    <TableCell><span className="text-sm font-mono">Cuentas por Cobrar</span></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      Pago por descuento de planilla (incluye nombre de deductora). <code className="text-xs bg-muted px-1 rounded">Ref: PLAN-{'{ID}'}</code>
                    </TableCell>
                  </TableRow>

                  {/* Pagos - Ventanilla */}
                  <TableRow>
                    <TableCell className="font-medium">Pago de Ventanilla</TableCell>
                    <TableCell><span className="text-sm font-mono">Banco CREDIPEP</span></TableCell>
                    <TableCell><span className="text-sm font-mono">Cuentas por Cobrar</span></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      Pago manual en ventanilla. <code className="text-xs bg-muted px-1 rounded">Ref: VENT-{'{ID}'}</code>
                    </TableCell>
                  </TableRow>

                  {/* Abono Extraordinario */}
                  <TableRow>
                    <TableCell className="font-medium">Abono Extraordinario</TableCell>
                    <TableCell><span className="text-sm font-mono">Banco CREDIPEP</span></TableCell>
                    <TableCell><span className="text-sm font-mono">Cuentas por Cobrar</span></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      Abono extraordinario con penalización (adelanto de cuotas). <code className="text-xs bg-muted px-1 rounded">Ref: EXTRA-{'{ID}'}</code>
                    </TableCell>
                  </TableRow>

                  {/* Cancelación Anticipada */}
                  <TableRow>
                    <TableCell className="font-medium">Cancelación Anticipada</TableCell>
                    <TableCell><span className="text-sm font-mono">Banco CREDIPEP</span></TableCell>
                    <TableCell><span className="text-sm font-mono">Cuentas por Cobrar</span></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      Pago total anticipado del crédito. <code className="text-xs bg-muted px-1 rounded">Ref: CANCEL-{'{ID}'}</code>
                    </TableCell>
                  </TableRow>

                  {/* Refundición */}
                  <TableRow>
                    <TableCell className="font-medium">Refundición (Cierre)</TableCell>
                    <TableCell><span className="text-sm font-mono">Banco CREDIPEP</span></TableCell>
                    <TableCell><span className="text-sm font-mono">Cuentas por Cobrar</span></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      Cierre del crédito antiguo en refundición. <code className="text-xs bg-muted px-1 rounded">Ref: REFUND-CLOSE-{'{ID}'}</code>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Refundición (Nuevo)</TableCell>
                    <TableCell><span className="text-sm font-mono">Cuentas por Cobrar</span></TableCell>
                    <TableCell><span className="text-sm font-mono">Banco CREDIPEP</span></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      Apertura del nuevo crédito refundido. <code className="text-xs bg-muted px-1 rounded">Ref: REFUND-NEW-{'{ID}'}</code>
                    </TableCell>
                  </TableRow>

                  {/* Devolución / Reintegro */}
                  <TableRow>
                    <TableCell className="font-medium">Reintegro de Saldo Pendiente</TableCell>
                    <TableCell><span className="text-sm font-mono">Cuentas por Cobrar</span></TableCell>
                    <TableCell><span className="text-sm font-mono">Banco CREDIPEP</span></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      Devolución de saldo pendiente al cliente. <code className="text-xs bg-muted px-1 rounded">Ref: DEVOL-{'{ID}'}</code>
                    </TableCell>
                  </TableRow>

                  {/* Anulaciones y Reversos */}
                  <TableRow>
                    <TableCell className="font-medium">Anulación de Planilla</TableCell>
                    <TableCell><span className="text-sm font-mono">Cuentas por Cobrar</span></TableCell>
                    <TableCell><span className="text-sm font-mono">Banco CREDIPEP</span></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      Reversa de todos los pagos de una planilla completa. <code className="text-xs bg-muted px-1 rounded">Ref: ANUL-PLAN-{'{ID}'}</code>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Anulación de Abono</TableCell>
                    <TableCell><span className="text-sm font-mono">Cuentas por Cobrar</span></TableCell>
                    <TableCell><span className="text-sm font-mono">Banco CREDIPEP</span></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      Anulación de abono individual (ventanilla/planilla). <code className="text-xs bg-muted px-1 rounded">Ref: REVERSE-PAY-{'{ID}'}</code>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Reverso de Abono Extraordinario</TableCell>
                    <TableCell><span className="text-sm font-mono">Cuentas por Cobrar</span></TableCell>
                    <TableCell><span className="text-sm font-mono">Banco CREDIPEP</span></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      Anulación de abono extraordinario. <code className="text-xs bg-muted px-1 rounded">Ref: REVERSE-EXTRA-{'{ID}'}</code>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Reverso de Cancelación Anticipada</TableCell>
                    <TableCell><span className="text-sm font-mono">Cuentas por Cobrar</span></TableCell>
                    <TableCell><span className="text-sm font-mono">Banco CREDIPEP</span></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      Anulación de cancelación anticipada. <code className="text-xs bg-muted px-1 rounded">Ref: REVERSE-CANCEL-{'{ID}'}</code>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
  );
}
