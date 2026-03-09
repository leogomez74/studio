'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import api from '@/lib/axios';

const formatColones = (value: string | number): string => {
  const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
  if (isNaN(num) || num === 0) return '';
  return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
};

const parseColones = (value: string): string => value.replace(/,/g, '');

const PrestamosTab: React.FC = () => {
  const { toast } = useToast();

  const [regularConfig, setRegularConfig] = useState({ minAmount: '', maxAmount: '', interestRate: '', minTerm: '', maxTerm: '', permitirMultiplesCreditos: true });
  const [microConfig, setMicroConfig] = useState({ minAmount: '', maxAmount: '', interestRate: '', minTerm: '', maxTerm: '', permitirMultiplesCreditos: true });
  const [loadingLoanConfigs, setLoadingLoanConfigs] = useState(false);
  const [savingRegular, setSavingRegular] = useState(false);
  const [savingMicro, setSavingMicro] = useState(false);

  const fetchLoanConfigurations = useCallback(async () => {
    setLoadingLoanConfigs(true);
    try {
      const response = await api.get('/api/loan-configurations');
      const configs = response.data;
      const regular = configs.find((c: any) => c.tipo === 'regular');
      const micro = configs.find((c: any) => c.tipo === 'microcredito');

      if (regular) {
        setRegularConfig({
          minAmount: regular.monto_minimo?.toString() || '', maxAmount: regular.monto_maximo?.toString() || '',
          interestRate: regular.tasa?.tasa?.toString() || '', minTerm: regular.plazo_minimo?.toString() || '',
          maxTerm: regular.plazo_maximo?.toString() || '', permitirMultiplesCreditos: regular.permitir_multiples_creditos ?? true,
        });
      }
      if (micro) {
        setMicroConfig({
          minAmount: micro.monto_minimo?.toString() || '', maxAmount: micro.monto_maximo?.toString() || '',
          interestRate: micro.tasa?.tasa?.toString() || '', minTerm: micro.plazo_minimo?.toString() || '',
          maxTerm: micro.plazo_maximo?.toString() || '', permitirMultiplesCreditos: micro.permitir_multiples_creditos ?? true,
        });
      }
    } catch (error) {
      console.error('Error fetching loan configurations:', error);
      toast({ title: 'Error', description: 'No se pudieron cargar las configuraciones de préstamos.', variant: 'destructive' });
    } finally { setLoadingLoanConfigs(false); }
  }, [toast]);

  useEffect(() => { fetchLoanConfigurations(); }, [fetchLoanConfigurations]);

  const handleRegularChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    if (id === 'minAmount' || id === 'maxAmount') setRegularConfig((prev) => ({ ...prev, [id]: parseColones(value) }));
    else setRegularConfig((prev) => ({ ...prev, [id]: value }));
  };

  const handleMicroChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    if (id === 'minAmount' || id === 'maxAmount') setMicroConfig((prev) => ({ ...prev, [id]: parseColones(value) }));
    else setMicroConfig((prev) => ({ ...prev, [id]: value }));
  };

  const handleSave = async (creditType: 'regular' | 'microcredito') => {
    const config = creditType === 'regular' ? regularConfig : microConfig;
    const setLoading = creditType === 'regular' ? setSavingRegular : setSavingMicro;
    const label = creditType === 'regular' ? 'Crédito Regular' : 'Micro-crédito';

    const minAmount = parseFloat(config.minAmount);
    const maxAmount = parseFloat(config.maxAmount);
    const minTerm = parseInt(config.minTerm);
    const maxTerm = parseInt(config.maxTerm);
    const interestRate = parseFloat(config.interestRate);

    if (!config.minAmount || !config.maxAmount || !config.interestRate || !config.minTerm || !config.maxTerm) {
      toast({ title: 'Campos incompletos', description: 'Todos los campos son obligatorios.', variant: 'destructive' }); return;
    }
    if (minAmount <= 0 || maxAmount <= 0) { toast({ title: 'Valores inválidos', description: 'Los montos deben ser mayores a cero.', variant: 'destructive' }); return; }
    if (minTerm <= 0 || maxTerm <= 0) { toast({ title: 'Valores inválidos', description: 'Los plazos deben ser mayores a cero.', variant: 'destructive' }); return; }
    if (interestRate <= 0 || interestRate > 100) { toast({ title: 'Tasa inválida', description: 'La tasa debe estar entre 0 y 100%.', variant: 'destructive' }); return; }
    if (minAmount >= maxAmount) { toast({ title: 'Rango inválido', description: 'El monto mínimo debe ser menor al monto máximo.', variant: 'destructive' }); return; }
    if (minTerm >= maxTerm) { toast({ title: 'Rango inválido', description: 'El plazo mínimo debe ser menor al plazo máximo.', variant: 'destructive' }); return; }

    setLoading(true);
    try {
      await api.put(`/api/loan-configurations/${creditType}`, {
        monto_minimo: minAmount, monto_maximo: maxAmount, tasa_anual: interestRate,
        plazo_minimo: minTerm, plazo_maximo: maxTerm, permitir_multiples_creditos: config.permitirMultiplesCreditos,
      });
      toast({ title: 'Parámetros Guardados', description: `La configuración para ${label} ha sido actualizada.`, duration: 3000 });
      await fetchLoanConfigurations();
    } catch (error: any) {
      console.error('Error saving loan configuration:', error);
      toast({ title: 'Error', description: error?.response?.data?.message || `No se pudo guardar la configuración de ${label}.`, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  if (loadingLoanConfigs) {
    return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const renderConfigCard = (
    title: string, description: string, config: typeof regularConfig,
    handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
    setConfig: React.Dispatch<React.SetStateAction<typeof regularConfig>>,
    saving: boolean, creditType: 'regular' | 'microcredito'
  ) => (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Monto Mínimo</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₡</span>
              <Input id="minAmount" type="text" value={formatColones(config.minAmount)} onChange={handleChange} className="font-mono pl-7" disabled={saving} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Monto Máximo</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₡</span>
              <Input id="maxAmount" type="text" value={formatColones(config.maxAmount)} onChange={handleChange} className="font-mono pl-7" disabled={saving} />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Tasa Anual</Label>
          <p className="font-mono text-sm border rounded-md px-3 py-2 bg-muted text-muted-foreground">{config.interestRate}%</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Plazo Mínimo (meses)</Label>
            <Input id="minTerm" type="number" value={config.minTerm} onChange={handleChange} className="font-mono" disabled={saving} />
          </div>
          <div className="space-y-2">
            <Label>Plazo Máximo (meses)</Label>
            <Input id="maxTerm" type="number" value={config.maxTerm} onChange={handleChange} className="font-mono" disabled={saving} />
          </div>
        </div>
        <div className="flex items-center justify-between space-x-2 pt-4 border-t">
          <div className="space-y-0.5">
            <Label>Permitir Múltiples Créditos</Label>
            <p className="text-sm text-muted-foreground">Permite que un cliente tenga más de un crédito activo simultáneamente</p>
          </div>
          <Switch checked={config.permitirMultiplesCreditos} onCheckedChange={(checked) => setConfig(prev => ({ ...prev, permitirMultiplesCreditos: checked }))} disabled={saving} />
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={() => handleSave(creditType)} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Guardar Cambios
        </Button>
      </CardFooter>
    </Card>
  );

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {renderConfigCard('Crédito Regular', 'Parámetros para los créditos regulares de deducción de planilla.', regularConfig, handleRegularChange, setRegularConfig, savingRegular, 'regular')}
      {renderConfigCard('Micro-crédito', 'Parámetros para micro-créditos de rápida aprobación.', microConfig, handleMicroChange, setMicroConfig, savingMicro, 'microcredito')}
    </div>
  );
};

export default PrestamosTab;
