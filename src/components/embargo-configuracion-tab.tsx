'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Save, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/axios';

interface TramoRenta {
  limite: number | null;
  tasa: number;
}

interface EmbargoConfig {
  id: number;
  salario_minimo_inembargable: string;
  tasa_ccss: string;
  tasa_tramo1: string;
  tasa_tramo2: string;
  multiplicador_tramo1: number;
  tramos_renta: TramoRenta[];
  fuente: string;
  decreto: string | null;
  anio: number;
  activo: boolean;
  ultima_verificacion: string | null;
}

function formatColones(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '';
  return num.toLocaleString('es-CR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseNumber(value: string): string {
  return value.replace(/[^0-9.,]/g, '').replace(/\./g, '').replace(',', '.');
}

export default function EmbargoConfiguracionTab() {
  const { toast } = useToast();
  const [config, setConfig] = useState<EmbargoConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Editable form state
  const [smi, setSmi] = useState('');
  const [tasaCcss, setTasaCcss] = useState('');
  const [tasaTramo1, setTasaTramo1] = useState('');
  const [tasaTramo2, setTasaTramo2] = useState('');
  const [multTramo1, setMultTramo1] = useState('3');
  const [tramosRenta, setTramosRenta] = useState<TramoRenta[]>([]);
  const [decreto, setDecreto] = useState('');
  const [anio, setAnio] = useState(String(new Date().getFullYear()));

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/embargo-configuracion');
      const data = res.data as EmbargoConfig;
      setConfig(data);
      setSmi(formatColones(data.salario_minimo_inembargable));
      setTasaCcss(String(parseFloat(data.tasa_ccss) * 100));
      setTasaTramo1(String(parseFloat(data.tasa_tramo1) * 100));
      setTasaTramo2(String(parseFloat(data.tasa_tramo2) * 100));
      setMultTramo1(String(data.multiplicador_tramo1));
      setTramosRenta(data.tramos_renta || []);
      setDecreto(data.decreto || '');
      setAnio(String(data.anio));
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo cargar la configuracion de embargo.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        salario_minimo_inembargable: parseFloat(parseNumber(smi)) || 0,
        tasa_ccss: (parseFloat(tasaCcss) || 0) / 100,
        tasa_tramo1: (parseFloat(tasaTramo1) || 0) / 100,
        tasa_tramo2: (parseFloat(tasaTramo2) || 0) / 100,
        multiplicador_tramo1: parseInt(multTramo1) || 3,
        tramos_renta: tramosRenta,
        decreto: decreto || null,
        anio: parseInt(anio) || new Date().getFullYear(),
      };

      const res = await api.put('/api/embargo-configuracion', payload);
      setConfig(res.data);
      toast({
        title: 'Configuracion guardada',
        description: 'Los parametros de embargo se actualizaron correctamente.',
      });
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Error al guardar la configuracion.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyPdf = async () => {
    setVerifying(true);
    try {
      const res = await api.post('/api/embargo-configuracion/verificar-pdf');
      if (res.data.success) {
        toast({
          title: 'Verificacion completada',
          description: res.data.output,
        });
        fetchConfig();
      } else {
        toast({
          title: 'Error en verificacion',
          description: res.data.error,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'No se pudo verificar el PDF del MTSS.',
        variant: 'destructive',
      });
    } finally {
      setVerifying(false);
    }
  };

  const updateTramo = (index: number, field: 'limite' | 'tasa', value: string) => {
    setTramosRenta(prev => {
      const updated = [...prev];
      if (field === 'limite') {
        updated[index] = { ...updated[index], limite: value === '' ? null : parseFloat(value) || 0 };
      } else {
        updated[index] = { ...updated[index], tasa: (parseFloat(value) || 0) / 100 };
      }
      return updated;
    });
  };

  const addTramo = () => {
    setTramosRenta(prev => [...prev, { limite: null, tasa: 0 }]);
  };

  const removeTramo = (index: number) => {
    setTramosRenta(prev => prev.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Parametros principales */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Parametros de Embargo</CardTitle>
              <CardDescription>
                Art. 172 del Codigo de Trabajo de Costa Rica.
              </CardDescription>
            </div>
            {config && (
              <Badge variant={config.fuente === 'pdf_mtss' ? 'default' : 'secondary'}>
                {config.fuente === 'pdf_mtss' ? 'PDF MTSS' : 'Manual'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="embargo-smi">Salario Minimo Inembargable (SMI)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₡</span>
              <Input
                id="embargo-smi"
                type="text"
                value={smi}
                onChange={(e) => setSmi(e.target.value)}
                className="font-mono pl-7"
                disabled={saving}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Salario mensual mas bajo del decreto de salarios minimos vigente.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="embargo-ccss">Tasa CCSS (%)</Label>
              <Input
                id="embargo-ccss"
                type="number"
                step="0.01"
                value={tasaCcss}
                onChange={(e) => setTasaCcss(e.target.value)}
                className="font-mono"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="embargo-mult">Multiplicador Tramo 1</Label>
              <Input
                id="embargo-mult"
                type="number"
                min="1"
                max="10"
                value={multTramo1}
                onChange={(e) => setMultTramo1(e.target.value)}
                className="font-mono"
                disabled={saving}
              />
              <p className="text-xs text-muted-foreground">
                Limite = SMI x {multTramo1}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="embargo-t1">Tasa Tramo 1 - 1/8 (%)</Label>
              <Input
                id="embargo-t1"
                type="number"
                step="0.01"
                value={tasaTramo1}
                onChange={(e) => setTasaTramo1(e.target.value)}
                className="font-mono"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="embargo-t2">Tasa Tramo 2 - 1/4 (%)</Label>
              <Input
                id="embargo-t2"
                type="number"
                step="0.01"
                value={tasaTramo2}
                onChange={(e) => setTasaTramo2(e.target.value)}
                className="font-mono"
                disabled={saving}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="embargo-decreto">Decreto</Label>
              <Input
                id="embargo-decreto"
                type="text"
                value={decreto}
                onChange={(e) => setDecreto(e.target.value)}
                className="font-mono"
                placeholder="ej: 45303-MTSS"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="embargo-anio">Año vigencia</Label>
              <Input
                id="embargo-anio"
                type="number"
                min="2020"
                max="2100"
                value={anio}
                onChange={(e) => setAnio(e.target.value)}
                className="font-mono"
                disabled={saving}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar Cambios
          </Button>
          <Button variant="outline" onClick={handleVerifyPdf} disabled={verifying}>
            {verifying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Verificar PDF MTSS
          </Button>
        </CardFooter>
      </Card>

      {/* Tramos de Impuesto sobre la Renta */}
      <Card>
        <CardHeader>
          <CardTitle>Tramos del Impuesto sobre la Renta</CardTitle>
          <CardDescription>
            Art. 34 Ley del Impuesto sobre la Renta. Se deducen del salario antes de calcular el embargo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-[1fr_80px_32px] gap-2 items-center text-xs font-medium text-muted-foreground mb-1">
            <span>Limite superior (₡)</span>
            <span>Tasa (%)</span>
            <span></span>
          </div>

          {tramosRenta.map((tramo, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_32px] gap-2 items-center">
              <Input
                type="text"
                value={tramo.limite === null ? '' : String(tramo.limite)}
                onChange={(e) => updateTramo(i, 'limite', e.target.value)}
                placeholder={i === tramosRenta.length - 1 ? 'Sin limite' : '0'}
                className="font-mono text-sm"
                disabled={saving}
              />
              <Input
                type="number"
                step="0.01"
                value={String((tramo.tasa * 100))}
                onChange={(e) => updateTramo(i, 'tasa', e.target.value)}
                className="font-mono text-sm"
                disabled={saving}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => removeTramo(i)}
                disabled={saving}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={addTramo} disabled={saving} className="w-full">
            <Plus className="h-3.5 w-3.5 mr-1" />
            Agregar tramo
          </Button>
        </CardContent>

        {config?.ultima_verificacion && (
          <CardFooter>
            <p className="text-xs text-muted-foreground">
              Ultima verificacion: {new Date(config.ultima_verificacion).toLocaleString('es-CR')}
              {config.decreto && <> &middot; Decreto {config.decreto}</>}
              {config.anio && <> ({config.anio})</>}
            </p>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
