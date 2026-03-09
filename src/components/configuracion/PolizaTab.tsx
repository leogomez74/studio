'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/axios';

const PolizaTab: React.FC = () => {
  const { toast } = useToast();
  const [polizaActual, setPolizaActual] = useState<string>('0');
  const [polizaLoading, setPolizaLoading] = useState(false);
  const [polizaSaving, setPolizaSaving] = useState(false);

  const loadPoliza = useCallback(async () => {
    setPolizaLoading(true);
    try {
      const res = await api.get('/api/loan-configurations/regular');
      const config = res.data;
      setPolizaActual(String(config.monto_poliza ?? 0));
    } catch (err) {
      console.error('Failed to load monto_poliza from loan_configurations:', err);
      toast({ title: 'Error', description: 'No se pudo obtener la póliza.', variant: 'destructive' });
    } finally {
      setPolizaLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadPoliza(); }, [loadPoliza]);

  return (
    <div className="flex items-center justify-center py-12">
      <div className="flex flex-col items-center gap-3">
        <Label htmlFor="poliza-actual" className="text-center">Monto de Póliza por Cuota (₡)</Label>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Este monto fijo se aplicará a cada cuota del plan de pagos cuando el crédito tenga póliza activa.
        </p>
        <Input
          id="poliza-actual"
          type="number"
          value={polizaActual}
          onChange={(e) => setPolizaActual(e.target.value)}
          className="max-w-xs text-center font-mono"
          disabled={polizaLoading}
        />
        <div className="flex items-center gap-2">
          <Button
            onClick={async () => {
              setPolizaSaving(true);
              try {
                await api.put('/api/loan-configurations/regular', { monto_poliza: parseFloat(polizaActual) || 0 });
                toast({ title: 'Guardado', description: 'Póliza actualizada correctamente.' });
                await loadPoliza();
              } catch (err) {
                console.error('Failed to save monto_poliza:', err);
                toast({ title: 'Error', description: 'No se pudo guardar la póliza.', variant: 'destructive' });
              } finally {
                setPolizaSaving(false);
              }
            }}
            disabled={polizaLoading || polizaSaving}
          >
            {polizaSaving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PolizaTab;
