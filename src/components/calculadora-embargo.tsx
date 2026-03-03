'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calculator, ChevronsUpDown, Search, Loader2, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { type Lead } from '@/lib/data';
import api from '@/lib/axios';

// ─── Configuración por defecto (Costa Rica 2026) ───────────────────────────

interface CalculadoraEmbargoConfig {
  salarioMinimoInembargable: number;
  tasaCargasSociales: number;
  tasaPrimerTramo: number;
  tasaSegundoTramo: number;
}

const DEFAULTS: CalculadoraEmbargoConfig = {
  salarioMinimoInembargable: 268731.31,
  tasaCargasSociales: 0.1083,
  tasaPrimerTramo: 0.125,
  tasaSegundoTramo: 0.25,
};

function formatColones(value: number): string {
  return value.toLocaleString('es-CR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Format a raw input string with thousand separators (dots) */
function formatInputWithSeparators(raw: string): string {
  // Strip everything except digits and comma/dot for decimals
  const cleaned = raw.replace(/[^0-9.,]/g, '');
  // Remove dots (thousand seps) to get just digits + possible comma decimal
  const withoutDots = cleaned.replace(/\./g, '');
  // Split on comma for decimal part
  const parts = withoutDots.split(',');
  const intPart = parts[0].replace(/^0+(?=\d)/, ''); // remove leading zeros
  // Add thousand separators (dots)
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (parts.length > 1) {
    return formatted + ',' + parts[1].slice(0, 2);
  }
  return formatted;
}

/** Parse a formatted string back to a plain number string */
function parseFormattedInput(value: string): number {
  // Remove dots (thousand seps), replace comma with dot for decimal
  return parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
}

function calcularEmbargo(
  salarioBruto: number,
  pensionAlimenticia: number,
  otroEmbargo1: number,
  otroEmbargo2: number,
  config: CalculadoraEmbargoConfig
): number {
  const {
    salarioMinimoInembargable: smi,
    tasaCargasSociales,
    tasaPrimerTramo,
    tasaSegundoTramo,
  } = config;

  const salarioNeto = salarioBruto * (1 - tasaCargasSociales);
  const despuesPension = salarioNeto - pensionAlimenticia;
  const despuesOtrosEmbargos = despuesPension - otroEmbargo1 - otroEmbargo2;
  const embargable = Math.max(0, despuesOtrosEmbargos - smi);

  if (embargable <= 0) return 0;

  const limiteTramo1 = 2 * smi;
  const montoTramo1 = Math.min(embargable, limiteTramo1) * tasaPrimerTramo;
  const montoTramo2 =
    Math.max(0, embargable - limiteTramo1) * tasaSegundoTramo;

  return Math.round((montoTramo1 + montoTramo2) * 100) / 100;
}

export default function CalculadoraEmbargo() {
  const { toast } = useToast();
  const [salarioBruto, setSalarioBruto] = useState('');
  const [pensionAlimenticia, setPensionAlimenticia] = useState('');
  const [otroEmbargo1, setOtroEmbargo1] = useState('');
  const [otroEmbargo2, setOtroEmbargo2] = useState('');
  const [resultado, setResultado] = useState<number | null>(null);

  // Person selector state
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load initial preview (few recent records)
  useEffect(() => {
    const fetchPreview = async () => {
      setLoadingLeads(true);
      try {
        const response = await api.get('/api/leads?per_page=8&is_active=all');
        const list = Array.isArray(response.data) ? response.data : response.data.data || [];
        setLeads(list);
      } catch (error) {
        console.error('Error cargando personas:', error);
      } finally {
        setLoadingLeads(false);
      }
    };
    fetchPreview();
  }, []);

  // Search leads with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoadingLeads(true);
      try {
        const params = new URLSearchParams({ per_page: '15', is_active: 'all' });
        if (searchQuery.trim()) params.set('q', searchQuery.trim());
        const response = await api.get(`/api/leads?${params.toString()}`);
        const list = Array.isArray(response.data) ? response.data : response.data.data || [];
        setLeads(list);
      } catch (error) {
        console.error('Error buscando personas:', error);
      } finally {
        setLoadingLeads(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  // Focus search input when popover opens
  useEffect(() => {
    if (open) {
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [open]);

  const handleSelectLead = (lead: Lead) => {
    setSelectedLead(lead);
    setOpen(false);
    setSearchQuery('');

    const salario = lead.salario_exacto ? Number(lead.salario_exacto) : 0;
    if (salario > 0) {
      setSalarioBruto(formatInputWithSeparators(String(Math.round(salario))));
      toast({
        title: 'Persona cargada',
        description: `Salario de ${lead.name} (₡${formatColones(salario)}) cargado.`,
      });
    } else {
      setSalarioBruto('');
      toast({
        title: 'Sin salario registrado',
        description: `${lead.name} no tiene un salario exacto registrado. Ingresalo manualmente.`,
        variant: 'destructive',
      });
    }
    setResultado(null);
  };

  const handleCalcular = useCallback(() => {
    const bruto = parseFormattedInput(salarioBruto);
    const pension = parseFormattedInput(pensionAlimenticia);
    const embargo1 = parseFormattedInput(otroEmbargo1);
    const embargo2 = parseFormattedInput(otroEmbargo2);

    const total = calcularEmbargo(bruto, pension, embargo1, embargo2, DEFAULTS);
    setResultado(total);
  }, [salarioBruto, pensionAlimenticia, otroEmbargo1, otroEmbargo2]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCalcular();
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Selector de persona */}
      <Card className="col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cargar desde Persona Registrada</CardTitle>
          <CardDescription>
            Selecciona una persona para usar su salario registrado como salario bruto
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full md:w-[500px] justify-between font-normal"
              >
                {selectedLead ? (
                  <span className="truncate">
                    <span className="font-medium">{selectedLead.name}</span>
                    {selectedLead.cedula && (
                      <span className="text-muted-foreground"> | {selectedLead.cedula}</span>
                    )}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Buscar persona por nombre o cédula...</span>
                )}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <div className="flex items-center border-b px-3 py-2">
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <input
                  ref={searchInputRef}
                  placeholder="Buscar por nombre o cédula..."
                  className="flex h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {loadingLeads && <Loader2 className="ml-2 h-4 w-4 animate-spin opacity-50" />}
              </div>
              <div className="max-h-[250px] overflow-y-auto">
                {leads.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground text-center">
                    {loadingLeads ? 'Buscando...' : 'No se encontraron resultados'}
                  </div>
                ) : (
                  leads.map((lead) => (
                    <button
                      key={lead.id}
                      type="button"
                      className="relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-3 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                      onClick={() => handleSelectLead(lead)}
                    >
                      {selectedLead?.id === lead.id && (
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                      )}
                      <span className={selectedLead?.id === lead.id ? '' : 'pl-6'}>
                        <span className="font-medium">{lead.name}</span>
                        {lead.cedula && (
                          <span className="mx-2 text-muted-foreground">| {lead.cedula}</span>
                        )}
                        {lead.salario_exacto && Number(lead.salario_exacto) > 0 && (
                          <span className="mx-2 text-green-600">
                            ₡{formatColones(Number(lead.salario_exacto))}
                          </span>
                        )}
                      </span>
                    </button>
                  ))
                )}
              </div>
              {!searchQuery && leads.length > 0 && (
                <div className="border-t px-3 py-2 text-xs text-muted-foreground text-center">
                  Escribí para buscar entre todas las personas
                </div>
              )}
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      {/* Calculadora */}
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle>Calculadora de Embargo</CardTitle>
          <CardDescription>
            Calcula el monto máximo embargable según el Art. 172 del Código de
            Trabajo de Costa Rica.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {/* Salario bruto mensual */}
            <div className="space-y-2">
              <Label htmlFor="salario-bruto">Salario bruto mensual</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  ₡
                </span>
                <Input
                  id="salario-bruto"
                  type="text"
                  inputMode="numeric"
                  className="pl-7"
                  value={salarioBruto}
                  onChange={(e) => setSalarioBruto(formatInputWithSeparators(e.target.value))}
                  onKeyDown={handleKeyDown}
                  placeholder="ejemplo 700.000"
                />
              </div>
            </div>

            {/* Pensiones alimenticias */}
            <div className="space-y-2">
              <Label htmlFor="pension">
                Pensiones alimenticias{' '}
                <span className="font-normal text-muted-foreground">
                  (si aplica)
                </span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  ₡
                </span>
                <Input
                  id="pension"
                  type="text"
                  inputMode="numeric"
                  className="pl-7"
                  value={pensionAlimenticia}
                  onChange={(e) => setPensionAlimenticia(formatInputWithSeparators(e.target.value))}
                  onKeyDown={handleKeyDown}
                  placeholder="ejemplo 350.000"
                />
              </div>
            </div>

            {/* Otro embargo #1 */}
            <div className="space-y-2">
              <Label htmlFor="embargo1">
                Otro embargo #1{' '}
                <span className="font-normal text-muted-foreground">
                  (si aplica)
                </span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  ₡
                </span>
                <Input
                  id="embargo1"
                  type="text"
                  inputMode="numeric"
                  className="pl-7"
                  value={otroEmbargo1}
                  onChange={(e) => setOtroEmbargo1(formatInputWithSeparators(e.target.value))}
                  onKeyDown={handleKeyDown}
                  placeholder="ejemplo 10.000"
                />
              </div>
            </div>

            {/* Otro embargo #2 */}
            <div className="space-y-2">
              <Label htmlFor="embargo2">
                Otro embargo #2{' '}
                <span className="font-normal text-muted-foreground">
                  (si aplica)
                </span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  ₡
                </span>
                <Input
                  id="embargo2"
                  type="text"
                  inputMode="numeric"
                  className="pl-7"
                  value={otroEmbargo2}
                  onChange={(e) => setOtroEmbargo2(formatInputWithSeparators(e.target.value))}
                  onKeyDown={handleKeyDown}
                  placeholder="ejemplo 15.000"
                />
              </div>
            </div>
          </div>

          <Button onClick={handleCalcular} className="w-full">
            <Calculator className="mr-2 h-4 w-4" />
            Calcular Embargo
          </Button>

          {resultado !== null && (
            <div className={`rounded-lg border p-4 text-center ${resultado === 0 ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-muted'}`}>
              {resultado === 0 ? (
                <>
                  <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                    El ingreso bruto no aplica para embargo
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    El salario neto no supera el mínimo inembargable (₡{formatColones(DEFAULTS.salarioMinimoInembargable)})
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Total máximo a embargar
                  </p>
                  <p className="text-2xl font-bold text-primary">
                    ₡{formatColones(resultado)}
                  </p>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
