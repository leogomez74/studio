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
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/axios';

interface PersonaEmbargo {
  id: number;
  name: string;
  cedula: string | null;
  salario_exacto: number | string | null;
  tipo: 'Lead' | 'Cliente';
}

function formatColones(value: number): string {
  return value.toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Format a raw input string with thousand separators (dots) and decimal comma */
function formatInputWithSeparators(raw: string): string {
  const cleaned = raw.replace(/[^0-9.,]/g, '');
  const withoutDots = cleaned.replace(/\./g, '');
  const parts = withoutDots.split(',');
  const intPart = parts[0].replace(/^0+(?=\d)/, '');
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (parts.length > 1) {
    return formatted + ',' + parts[1].slice(0, 2);
  }
  return formatted;
}

/** Parse a formatted string back to a plain number */
function parseFormattedInput(value: string): number {
  return parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
}

interface EmbargoDesglose {
  salario_bruto: number;
  descuento_ccss: number;
  impuesto_renta: number;
  salario_liquido: number;
  pension_alimenticia: number;
  salario_minimo_protegido: number;
  monto_embargable: number;
  limite_tramo1: number;
  embargo_tramo1: number;
  embargo_tramo2: number;
  total_embargo: number;
}

interface EmbargoResult {
  resultado: number;
  source: string;
  desglose?: EmbargoDesglose;
  config?: {
    anio: number;
    decreto: string | null;
    ultima_verificacion: string | null;
  };
}

export default function CalculadoraEmbargo() {
  const { toast } = useToast();
  const [salarioBruto, setSalarioBruto] = useState('');
  const [pensionAlimenticia, setPensionAlimenticia] = useState('');
  const [otroEmbargo1, setOtroEmbargo1] = useState('');
  const [otroEmbargo2, setOtroEmbargo2] = useState('');
  const [resultado, setResultado] = useState<EmbargoResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Person selector state
  const [personas, setPersonas] = useState<PersonaEmbargo[]>([]);
  const [loadingPersonas, setLoadingPersonas] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<PersonaEmbargo | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchPersonas = useCallback(async (q?: string) => {
    setLoadingPersonas(true);
    try {
      const params = new URLSearchParams({ per_page: '15' });
      if (q?.trim()) params.set('q', q.trim());
      const response = await api.get(`/api/embargo/personas?${params.toString()}`);
      setPersonas(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error buscando personas:', error);
    } finally {
      setLoadingPersonas(false);
    }
  }, []);

  // Load initial preview
  useEffect(() => {
    fetchPersonas();
  }, [fetchPersonas]);

  // Search with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPersonas(searchQuery), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, fetchPersonas]);

  // Focus search input when popover opens
  useEffect(() => {
    if (open) {
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [open]);

  const handleSelectPersona = (persona: PersonaEmbargo) => {
    setSelectedPersona(persona);
    setOpen(false);
    setSearchQuery('');

    const salario = persona.salario_exacto ? Number(persona.salario_exacto) : 0;
    if (salario > 0) {
      setSalarioBruto(formatInputWithSeparators(String(Math.round(salario))));
      toast({
        title: 'Persona cargada',
        description: `Salario de ${persona.name} (₡${formatColones(salario)}) cargado.`,
      });
    } else {
      setSalarioBruto('');
      toast({
        title: 'Sin salario registrado',
        description: `${persona.name} no tiene un salario exacto registrado. Ingresalo manualmente.`,
        variant: 'destructive',
      });
    }
    setResultado(null);
  };

  const handleCalcular = useCallback(async () => {
    const bruto = parseFormattedInput(salarioBruto);
    const pension = parseFormattedInput(pensionAlimenticia);
    const embargo1 = parseFormattedInput(otroEmbargo1);
    const embargo2 = parseFormattedInput(otroEmbargo2);

    if (bruto <= 0) {
      toast({
        title: 'Salario requerido',
        description: 'Ingresá un salario bruto mayor a 0.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setResultado(null);

    try {
      const response = await api.post('/api/calcular-embargo', {
        salario_bruto: bruto,
        pension_alimenticia: pension,
        otro_embargo_1: embargo1,
        otro_embargo_2: embargo2,
      });

      setResultado(response.data);
    } catch (error: any) {
      const msg =
        error?.response?.data?.error ||
        'No se pudo conectar con el servidor. Intentá de nuevo.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  }, [salarioBruto, pensionAlimenticia, otroEmbargo1, otroEmbargo2, toast]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCalcular();
  };

  const desglose = resultado?.desglose;

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
                {selectedPersona ? (
                  <span className="truncate">
                    <span className="font-medium">{selectedPersona.name}</span>
                    {selectedPersona.cedula && (
                      <span className="text-muted-foreground"> | {selectedPersona.cedula}</span>
                    )}
                    <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0">
                      {selectedPersona.tipo}
                    </Badge>
                  </span>
                ) : (
                  <span className="text-muted-foreground">Buscar persona por nombre o cedula...</span>
                )}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <div className="flex items-center border-b px-3 py-2">
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <input
                  ref={searchInputRef}
                  placeholder="Buscar por nombre o cedula..."
                  className="flex h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {loadingPersonas && <Loader2 className="ml-2 h-4 w-4 animate-spin opacity-50" />}
              </div>
              <div className="max-h-[250px] overflow-y-auto">
                {personas.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground text-center">
                    {loadingPersonas ? 'Buscando...' : 'No se encontraron resultados'}
                  </div>
                ) : (
                  personas.map((persona) => (
                    <button
                      key={persona.id}
                      type="button"
                      className="relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-3 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                      onClick={() => handleSelectPersona(persona)}
                    >
                      {selectedPersona?.id === persona.id && (
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                      )}
                      <span className={selectedPersona?.id === persona.id ? '' : 'pl-6'}>
                        <span className="font-medium">{persona.name}</span>
                        {persona.cedula && (
                          <span className="mx-2 text-muted-foreground">| {persona.cedula}</span>
                        )}
                        <Badge variant="outline" className="mx-1 text-[10px] px-1.5 py-0">
                          {persona.tipo}
                        </Badge>
                        {persona.salario_exacto && Number(persona.salario_exacto) > 0 && (
                          <span className="mx-1 text-green-600">
                            ₡{formatColones(Number(persona.salario_exacto))}
                          </span>
                        )}
                      </span>
                    </button>
                  ))
                )}
              </div>
              {!searchQuery && personas.length > 0 && (
                <div className="border-t px-3 py-2 text-xs text-muted-foreground text-center">
                  Escribi para buscar entre todas las personas
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
            Calcula el monto maximo embargable segun el Art. 172 del Codigo de
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

            {/* Pensiones alimentarias */}
            <div className="space-y-2">
              <Label htmlFor="pension">
                Pensiones alimentarias{' '}
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

          <Button onClick={handleCalcular} className="w-full" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Calculator className="mr-2 h-4 w-4" />
            )}
            {isLoading ? 'Calculando...' : 'Calcular Embargo'}
          </Button>

          {errorMsg && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
              <p className="text-sm text-destructive font-medium">{errorMsg}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Presiona &quot;Calcular Embargo&quot; para volver a intentarlo.
              </p>
            </div>
          )}

          {resultado !== null && (
            <div className="space-y-3">
              {/* Resultado principal */}
              <div className={`rounded-lg border p-4 text-center ${resultado.resultado === 0 ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-muted'}`}>
                {resultado.resultado === 0 ? (
                  <>
                    <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                      El ingreso bruto no aplica para embargo
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      El salario liquido no supera el minimo inembargable
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Total maximo a embargar
                    </p>
                    <p className="text-2xl font-bold text-primary">
                      ₡{formatColones(resultado.resultado)}
                    </p>
                  </>
                )}
              </div>

              {/* Desglose detallado */}
              {desglose && resultado.resultado > 0 && (
                <div className="rounded-lg border p-4 space-y-2">
                  <p className="text-sm font-medium mb-3">Desglose del calculo</p>
                  <div className="grid grid-cols-2 gap-y-1.5 text-sm">
                    <span className="text-muted-foreground">Salario bruto</span>
                    <span className="text-right">₡{formatColones(desglose.salario_bruto)}</span>

                    <span className="text-muted-foreground">CCSS (10.83%)</span>
                    <span className="text-right text-red-600">-₡{formatColones(desglose.descuento_ccss)}</span>

                    {desglose.impuesto_renta > 0 && (
                      <>
                        <span className="text-muted-foreground">Impuesto sobre la renta</span>
                        <span className="text-right text-red-600">-₡{formatColones(desglose.impuesto_renta)}</span>
                      </>
                    )}

                    <span className="text-muted-foreground font-medium">Salario liquido</span>
                    <span className="text-right font-medium">₡{formatColones(desglose.salario_liquido)}</span>

                    {desglose.pension_alimenticia > 0 && (
                      <>
                        <span className="text-muted-foreground">Pensión alimentaria</span>
                        <span className="text-right text-red-600">-₡{formatColones(desglose.pension_alimenticia)}</span>
                      </>
                    )}

                    <div className="col-span-2 border-t my-1" />

                    <span className="text-muted-foreground">Minimo protegido (SMI)</span>
                    <span className="text-right">₡{formatColones(desglose.salario_minimo_protegido)}</span>

                    <span className="text-muted-foreground">Monto embargable</span>
                    <span className="text-right">₡{formatColones(desglose.monto_embargable)}</span>

                    <div className="col-span-2 border-t my-1" />

                    <span className="text-muted-foreground">Tramo 1 (1/8)</span>
                    <span className="text-right">₡{formatColones(desglose.embargo_tramo1)}</span>

                    {desglose.embargo_tramo2 > 0 && (
                      <>
                        <span className="text-muted-foreground">Tramo 2 (1/4)</span>
                        <span className="text-right">₡{formatColones(desglose.embargo_tramo2)}</span>
                      </>
                    )}

                    <span className="font-semibold">Total embargo</span>
                    <span className="text-right font-semibold text-primary">₡{formatColones(desglose.total_embargo)}</span>
                  </div>

                  {resultado.config && (
                    <p className="text-xs text-muted-foreground mt-3 pt-2 border-t">
                      Decreto {resultado.config.decreto} ({resultado.config.anio})
                      {resultado.config.ultima_verificacion && (
                        <> &middot; Verificado: {new Date(resultado.config.ultima_verificacion).toLocaleDateString('es-CR')}</>
                      )}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
