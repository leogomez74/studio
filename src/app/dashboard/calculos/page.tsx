// 'use client' indica que este es un Componente de Cliente, lo cual es necesario para usar hooks de React como 'useState' y 'useEffect'.
'use client';

// Importamos los hooks y componentes necesarios de React y de nuestra biblioteca de UI.
import { useState, useEffect, useMemo } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
// Importamos los íconos que usaremos.
import { Calculator, Search, RefreshCw, MessageSquare, Mail } from 'lucide-react';
// $$$ CONECTOR MYSQL: Se importan la configuración de créditos.
// Los créditos y leads ahora se obtienen de la API en tiempo real.
import { Credit, creditConfigs, type Lead } from '@/lib/data';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from "@/hooks/use-toast";
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import api from '@/lib/axios';
import { type Opportunity } from '@/lib/data';

/**
 * Componente principal de la página de Cálculos.
 * Contiene dos calculadoras: una para cuotas de nuevos créditos y otra para arreglos de pago.
 */
export default function CalculosPage() {
  const { toast } = useToast();

  // --- Estados para la Calculadora de Cuotas ---
  const [creditType, setCreditType] = useState<'regular' | 'micro'>('regular'); // Tipo de crédito seleccionado
  const [amount, setAmount] = useState('5000000'); // Monto del préstamo
  const [rate, setRate] = useState(creditConfigs.regular.interestRate.toString()); // Tasa de interés anual, inicializada con la de crédito regular
  const [term, setTerm] = useState('36'); // Plazo en meses
  const [monthlyPayment, setMonthlyPayment] = useState<number | null>(null); // Cuota mensual calculada
  const [selectedLead, setSelectedLead] = useState<string | undefined>(undefined); // Lead seleccionado para enviarle la cotización
  const [leads, setLeads] = useState<Lead[]>([]); // Lista de leads desde la API
  const [loadingLeads, setLoadingLeads] = useState(false); // Estado de carga de leads

  // --- Estados para la Calculadora de Arreglos de Pago ---
  const [operationNumber, setOperationNumber] = useState(''); // Número de operación a buscar
  const [foundCredit, setFoundCredit] = useState<Credit | null>(null); // Crédito encontrado
  const [newTerm, setNewTerm] = useState('12'); // Nuevo plazo para el arreglo
  const [newMonthlyPayment, setNewMonthlyPayment] = useState<number | null>(null); // Nueva cuota calculada
  const [searchError, setSearchError] = useState<string | null>(null); // Mensaje de error si no se encuentra el crédito
  const [searchingCredit, setSearchingCredit] = useState(false); // Estado de carga para la búsqueda

  // --- Opportunity Search State ---
  const [opportunitySearch, setOpportunitySearch] = useState('');
  const [selectedOpportunityId, setSelectedOpportunityId] = useState('');
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [isLoadingOpportunities, setIsLoadingOpportunities] = useState(false);

  useEffect(() => {
    const fetchOpportunities = async () => {
      setIsLoadingOpportunities(true);
      try {
        const response = await api.get('/api/opportunities');
        const data = response.data.data || response.data;
        setOpportunities(Array.isArray(data) ? data : []);
      } catch (error) {
        // Optionally handle error
      } finally {
        setIsLoadingOpportunities(false);
      }
    };
    fetchOpportunities();
  }, []);

  const filteredOpportunities = useMemo(() =>
    opportunities.filter(o => {
      const ref = o.id ? String(o.id) : '';
      const type = o.opportunity_type || '';
      return ref.toLowerCase().includes(opportunitySearch.toLowerCase()) ||
        type.toLowerCase().includes(opportunitySearch.toLowerCase());
    }),
    [opportunitySearch, opportunities]
  );

  /**
   * Efecto que carga los datos de la oportunidad seleccionada en el formulario de cálculo.
   */
  useEffect(() => {
    if (!selectedOpportunityId) return;

    const selectedOpportunity = opportunities.find(o => String(o.id) === selectedOpportunityId);
    if (!selectedOpportunity) return;

    // Cargar el monto de la oportunidad
    if (selectedOpportunity.amount) {
      setAmount(String(selectedOpportunity.amount));
    }

    // Determinar el tipo de crédito basado en opportunity_type
    const oppType = selectedOpportunity.opportunity_type?.toLowerCase() || '';
    if (oppType.includes('micro')) {
      setCreditType('micro');
    } else {
      setCreditType('regular');
    }

    // Resetear el cálculo previo
    setMonthlyPayment(null);
    setSelectedLead(undefined);

    toast({
      title: "Oportunidad cargada",
      description: `Datos de la oportunidad #${selectedOpportunity.id} cargados en la calculadora.`,
    });
  }, [selectedOpportunityId, opportunities, toast]);

  /**
   * Efecto que carga los leads desde la API al montar el componente.
   */
  useEffect(() => {
    const fetchLeads = async () => {
      setLoadingLeads(true);
      try {
        const response = await api.get('/api/leads');
        const leadsList = Array.isArray(response.data) ? response.data : response.data.data || [];
        setLeads(leadsList);
      } catch (error) {
        console.error('Error cargando leads:', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar los leads.",
          variant: "destructive",
        });
      } finally {
        setLoadingLeads(false);
      }
    };

    fetchLeads();
  }, [toast]);

  /**
   * Efecto que se ejecuta cuando el tipo de crédito cambia.
   * Actualiza la tasa de interés en el formulario según la configuración del tipo de crédito seleccionado.
   */
  useEffect(() => {
    // Cuando el usuario cambia el tipo de crédito (regular o micro),
    // buscamos la tasa de interés correspondiente en nuestro objeto de configuración
    // y actualizamos el estado 'rate' del formulario.
    setRate(creditConfigs[creditType].interestRate.toString());
  }, [creditType]);

  /**
   * Calcula la cuota mensual para un nuevo préstamo.
   * Utiliza la fórmula del sistema de amortización francés.
   */
  const handleCalculateFee = () => {
    // Convertimos los valores de texto a números.
    const principal = parseFloat(amount);
    const annualInterestRate = parseFloat(rate) / 100;
    const numberOfMonths = parseInt(term, 10);

    // Validamos que los datos sean números válidos y positivos.
    if (
      isNaN(principal) ||
      isNaN(annualInterestRate) ||
      isNaN(numberOfMonths) ||
      principal <= 0 ||
      annualInterestRate <= 0 ||
      numberOfMonths <= 0
    ) {
      setMonthlyPayment(null); // Si no son válidos, reseteamos el resultado.
      return;
    }

    // Fórmula para calcular la cuota mensual.
    const monthlyInterestRate = annualInterestRate / 12;
    const power = Math.pow(1 + monthlyInterestRate, numberOfMonths);
    const payment =
      principal * ((monthlyInterestRate * power) / (power - 1));

    setMonthlyPayment(payment); // Guardamos el resultado en el estado.
    setSelectedLead(undefined); // Reseteamos el lead seleccionado al hacer un nuevo cálculo.
  };

  /**
   * Busca un crédito existente en la base de datos por su número de operación.
   */
  const handleSearchCredit = async () => {
    if (!operationNumber.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa un número de operación.",
        variant: "destructive",
      });
      return;
    }

    setSearchError(null);
    setNewMonthlyPayment(null);
    setFoundCredit(null);
    setSearchingCredit(true);

    try {
      // Llamamos a la API para obtener todos los créditos
      const response = await api.get('/api/credits');
      const creditsList = Array.isArray(response.data) ? response.data : response.data.data || [];

      // Buscamos el crédito por número de operación (ignorando mayúsculas/minúsculas)
      // El campo principal es 'reference', pero mantenemos compatibilidad con 'numero_operacion'
      const credit = creditsList.find((c: Credit) =>
        c.reference?.toLowerCase() === operationNumber.toLowerCase() ||
        c.numero_operacion?.toLowerCase() === operationNumber.toLowerCase()
      );

      if (credit) {
        setFoundCredit(credit);
        const debtorName = credit.lead?.name || 'Cliente sin nombre';
        toast({
          title: "Crédito encontrado",
          description: `Crédito de ${debtorName} cargado correctamente.`,
        });
      } else {
        setFoundCredit(null);
        setSearchError(`No se encontró ningún crédito con el número de operación "${operationNumber}".`);
        toast({
          title: "No encontrado",
          description: `No existe un crédito con el número "${operationNumber}".`,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error searching credit:', error);
      setFoundCredit(null);
      setSearchError('Error al buscar el crédito. Por favor intenta de nuevo.');
      toast({
        title: "Error de conexión",
        description: error?.response?.data?.message || "No se pudo conectar con el servidor.",
        variant: "destructive",
      });
    } finally {
      setSearchingCredit(false);
    }
  };

  /**
   * Calcula la nueva cuota para un arreglo de pago sobre un crédito existente.
   */
  const handleCalculateSettlement = () => {
      if (!foundCredit) return;

      // Tomamos los datos del crédito encontrado y el nuevo plazo.
      const principal = foundCredit.saldo || 0;
      const annualInterestRate = (foundCredit.tasa_anual || 0) / 100;
      const numberOfMonths = parseInt(newTerm, 10);

      // Validamos los datos.
      if (isNaN(principal) || isNaN(annualInterestRate) || isNaN(numberOfMonths) || principal <= 0) {
        setNewMonthlyPayment(null);
        return;
      }

      // Aplicamos la misma fórmula de cálculo de cuota.
      const monthlyInterestRate = annualInterestRate / 12;
      const power = Math.pow(1 + monthlyInterestRate, numberOfMonths);
      const payment = principal * ((monthlyInterestRate * power) / (power - 1));

      setNewMonthlyPayment(payment);
  };

  /**
   * Envía la cotización a un lead por email o comunicaciones.
   * @param {'comunicaciones' | 'email'} method - El método de envío.
   */
  const handleSendQuote = async (method: 'comunicaciones' | 'email') => {
    const lead = leads.find(l => String(l.id) === selectedLead);
    if (!lead || !monthlyPayment) return;

    // Validar que el lead tenga email antes de continuar
    if (!lead.email) {
      toast({
        title: "Error de validación",
        description: `El lead ${lead.name} no tiene un correo electrónico registrado.`,
        variant: "destructive",
        duration: 5000,
      });
      return;
    }

    try {
      const payload = {
        lead_id: String(lead.id),
        lead_name: lead.name,
        lead_email: lead.email,
        amount: parseFloat(amount),
        rate: parseFloat(rate),
        term: parseInt(term, 10),
        monthly_payment: monthlyPayment,
        credit_type: creditType,
        method: method,
      };

      console.log('Enviando cotización con payload:', payload);

      const response = await api.post('/api/quotes/send', payload);

      if (response.data.success) {
        toast({
          title: "Cotización Enviada",
          description: response.data.message || `La cotización ha sido enviada a ${lead.name} por ${method === 'email' ? 'correo electrónico' : 'el sistema de comunicaciones'}.`,
          duration: 4000,
        });
      }
    } catch (error: any) {
      console.error('Error enviando cotización:', error);
      console.error('Detalles del error:', error?.response?.data);

      const errorMessage = error?.response?.data?.errors
        ? Object.values(error.response.data.errors).flat().join(', ')
        : error?.response?.data?.message || "No se pudo enviar la cotización. Por favor intenta de nuevo.";

      toast({
        title: "Error al enviar",
        description: errorMessage,
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* --- Opportunity Search Input --- */}
      <Card className="col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cargar desde Oportunidad</CardTitle>
          <CardDescription>Selecciona una oportunidad para cargar sus datos en la calculadora</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-center">
            <Input
              placeholder="Buscar por ID o tipo..."
              value={opportunitySearch}
              onChange={e => setOpportunitySearch(e.target.value)}
              className="max-w-xs"
            />
            <Select value={selectedOpportunityId} onValueChange={setSelectedOpportunityId}>
              <SelectTrigger className="w-[350px]">
                <SelectValue placeholder={isLoadingOpportunities ? 'Cargando...' : 'Selecciona una oportunidad'} />
              </SelectTrigger>
              <SelectContent>
                {filteredOpportunities.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    {isLoadingOpportunities ? "Cargando..." : "No hay oportunidades disponibles"}
                  </div>
                ) : (
                  filteredOpportunities.map(o => (
                    <SelectItem key={o.id} value={String(o.id)}>
                      <span className="font-medium">#{o.id}</span>
                      <span className="mx-2 text-muted-foreground">|</span>
                      <span>{o.opportunity_type || 'Sin tipo'}</span>
                      {o.amount && (
                        <>
                          <span className="mx-2 text-muted-foreground">|</span>
                          <span className="text-green-600">₡{Number(o.amount).toLocaleString('de-DE')}</span>
                        </>
                      )}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      {/* --- Tarjeta de Calculadora de Cuotas --- */}
      <Card>
        <CardHeader>
          <CardTitle>Calculadora de Cuotas</CardTitle>
          <CardDescription>
            Estima la cuota mensual de un crédito.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
           {/* Selector para el tipo de crédito */}
          <div className="space-y-2">
            <Label>Tipo de Crédito</Label>
            <RadioGroup
              defaultValue="regular"
              className="flex gap-4 pt-2"
              onValueChange={(value) => setCreditType(value as 'regular' | 'micro')}
              value={creditType}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="regular" id="r1" />
                <Label htmlFor="r1">Crédito Regular</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="micro" id="r2" />
                <Label htmlFor="r2">Micro-crédito</Label>
              </div>
            </RadioGroup>
          </div>
          {/* Campo para el monto del préstamo */}
          <div className="space-y-2">
            <Label htmlFor="amount">Monto del Préstamo (₡)</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Ej: 5000000"
            />
          </div>
          {/* Campo para la tasa de interés */}
          <div className="space-y-2">
            <Label htmlFor="rate">Tasa de Interés Anual (%)</Label>
            <Input
              id="rate"
              type="number"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="Ej: 24"
            />
          </div>
          {/* Selector para el plazo en meses */}
          <div className="space-y-2">
            <Label htmlFor="term">Plazo (meses)</Label>
            <Select value={term} onValueChange={setTerm}>
              <SelectTrigger id="term">
                <SelectValue placeholder="Selecciona un plazo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6 meses</SelectItem>
                <SelectItem value="9">9 meses</SelectItem>
                <SelectItem value="12">12 meses</SelectItem>
                <SelectItem value="18">18 meses</SelectItem>
                <SelectItem value="24">24 meses</SelectItem>
                <SelectItem value="36">36 meses</SelectItem>
                <SelectItem value="48">48 meses</SelectItem>
                <SelectItem value="60">60 meses</SelectItem>
                <SelectItem value="72">72 meses</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleCalculateFee} className="w-full">
            <Calculator className="mr-2 h-4 w-4" />
            Calcular
          </Button>

          {/* Mostramos el resultado del cálculo si existe. */}
          {monthlyPayment !== null && (
            <div className="space-y-4">
                <div className="rounded-lg border bg-muted p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                        Cuota Mensual Estimada
                    </p>
                    <p className="text-2xl font-bold text-primary">
                        {/* Formateamos el número a un estilo de moneda local. */}
                        ₡{monthlyPayment.toLocaleString('de-DE', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                        })}
                    </p>
                </div>

                 {/* Sección para enviar la cotización a un lead */}
                <Separator />
                <div className="space-y-3 pt-2">
                    <h4 className="font-medium">Enviar Cotización a Lead</h4>
                     <div className="space-y-2">
                        <Label htmlFor="select-lead">Seleccionar Lead</Label>
                        <Select value={selectedLead} onValueChange={setSelectedLead} disabled={loadingLeads}>
                            <SelectTrigger id="select-lead">
                                <SelectValue placeholder={loadingLeads ? "Cargando leads..." : "Selecciona un lead..."} />
                            </SelectTrigger>
                            <SelectContent>
                                {leads.length === 0 ? (
                                    <div className="p-2 text-sm text-muted-foreground text-center">
                                        {loadingLeads ? "Cargando..." : "No hay leads disponibles"}
                                    </div>
                                ) : (
                                    leads.map(lead => (
                                        <SelectItem key={lead.id} value={String(lead.id)}>
                                            {lead.name} ({lead.cedula})
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                     {/* Los botones de envío solo se muestran si se ha seleccionado un lead. */}
                    {selectedLead && (
                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1" onClick={() => handleSendQuote('comunicaciones')}>
                                <MessageSquare className="mr-2 h-4 w-4" />
                                Enviar por Comunicaciones
                            </Button>
                            <Button variant="outline" className="flex-1" onClick={() => handleSendQuote('email')}>
                                <Mail className="mr-2 h-4 w-4" />
                                Enviar por Email
                            </Button>
                        </div>
                    )}
                </div>
            </div>
          )}
        </CardContent>
      </Card>
      {/* --- Tarjeta de Calculadora de Arreglos de Pago --- */}
      <Card>
        <CardHeader>
          <CardTitle>Calculadora de Arreglos de Pago</CardTitle>
          <CardDescription>
            Calcula una nueva cuota para un crédito existente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex w-full items-end gap-2">
            <div className="flex-grow space-y-2">
                <Label htmlFor="operation-number">Número de Operación</Label>
                <Input
                id="operation-number"
                value={operationNumber}
                onChange={(e) => setOperationNumber(e.target.value)}
                placeholder="Ej: 25-00001-CR"
                disabled={searchingCredit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !searchingCredit) {
                    handleSearchCredit();
                  }
                }}
                />
            </div>
            <Button onClick={handleSearchCredit} disabled={searchingCredit}>
                {searchingCredit ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Buscar
                  </>
                )}
            </Button>
          </div>

          {/* Mostramos un mensaje de error si la búsqueda falló. */}
          {searchError && (
              <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{searchError}</AlertDescription>
              </Alert>
          )}

          {/* Si se encontró un crédito, mostramos sus detalles y el formulario para el arreglo. */}
          {foundCredit && (
              <div className="space-y-4 rounded-lg border bg-muted/50 p-4">
                  <div>
                      <h4 className="font-semibold">{foundCredit.lead?.name || 'Cliente sin nombre'}</h4>
                      <p className="text-sm text-muted-foreground">{foundCredit.reference || foundCredit.numero_operacion}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                          <p className="text-muted-foreground">Saldo Actual</p>
                          <p className="font-medium">₡{(foundCredit.saldo || 0).toLocaleString('de-DE')}</p>
                      </div>
                       <div>
                          <p className="text-muted-foreground">Tasa de Interés</p>
                          <p className="font-medium">{foundCredit.tasa_anual}%</p>
                      </div>
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="new-term">Nuevo Plazo (meses)</Label>
                      <Select value={newTerm} onValueChange={setNewTerm}>
                          <SelectTrigger id="new-term">
                              <SelectValue placeholder="Selecciona un nuevo plazo" />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="12">12 meses</SelectItem>
                              <SelectItem value="18">18 meses</SelectItem>
                              <SelectItem value="24">24 meses</SelectItem>
                              <SelectItem value="36">36 meses</SelectItem>
                              <SelectItem value="48">48 meses</SelectItem>
                              <SelectItem value="60">60 meses</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
                   <Button onClick={handleCalculateSettlement} className="w-full">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Calcular Arreglo
                    </Button>
              </div>
          )}

           {/* Mostramos el resultado del cálculo del arreglo si existe. */}
           {newMonthlyPayment !== null && (
            <div className="rounded-lg border bg-accent/20 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Nueva Cuota Mensual Estimada
              </p>
              <p className="text-2xl font-bold text-primary">
                ₡{newMonthlyPayment.toLocaleString('de-DE', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
