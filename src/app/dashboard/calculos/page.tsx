// 'use client' indica que este es un Componente de Cliente, lo cual es necesario para usar hooks de React como 'useState'.
'use client';

// Importamos los hooks y componentes necesarios de React y de nuestra biblioteca de UI.
import { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calculator, Search, RefreshCw } from 'lucide-react'; // Íconos
import { credits, Credit } from '@/lib/data'; // Datos de ejemplo
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/**
 * Componente principal de la página de Cálculos.
 * Contiene dos calculadoras: una para cuotas de nuevos créditos y otra para arreglos de pago.
 */
export default function CalculosPage() {
  // --- Estados para la Calculadora de Cuotas ---
  const [amount, setAmount] = useState('5000000'); // Monto del préstamo
  const [rate, setRate] = useState('24'); // Tasa de interés anual
  const [term, setTerm] = useState('36'); // Plazo en meses
  const [monthlyPayment, setMonthlyPayment] = useState<number | null>(null); // Cuota mensual calculada

  // --- Estados para la Calculadora de Arreglos de Pago ---
  const [operationNumber, setOperationNumber] = useState(''); // Número de operación a buscar
  const [foundCredit, setFoundCredit] = useState<Credit | null>(null); // Crédito encontrado
  const [newTerm, setNewTerm] = useState('12'); // Nuevo plazo para el arreglo
  const [newMonthlyPayment, setNewMonthlyPayment] = useState<number | null>(null); // Nueva cuota calculada
  const [searchError, setSearchError] = useState<string | null>(null); // Mensaje de error si no se encuentra el crédito

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
  };

  /**
   * Busca un crédito existente en los datos de ejemplo por su número de operación.
   */
  const handleSearchCredit = () => {
    setSearchError(null); // Limpiamos cualquier error previo.
    setNewMonthlyPayment(null); // Limpiamos cualquier cálculo de arreglo previo.
    // Buscamos el crédito ignorando mayúsculas/minúsculas.
    const credit = credits.find(c => c.operationNumber.toLowerCase() === operationNumber.toLowerCase());
    if (credit) {
      setFoundCredit(credit); // Si lo encontramos, lo guardamos en el estado.
    } else {
      setFoundCredit(null); // Si no, reseteamos el crédito encontrado.
      setSearchError(`No se encontró ningún crédito con el número de operación "${operationNumber}".`); // Y mostramos un error.
    }
  };

  /**
   * Calcula la nueva cuota para un arreglo de pago sobre un crédito existente.
   */
  const handleCalculateSettlement = () => {
      if (!foundCredit) return; // Si no hay un crédito cargado, no hacemos nada.

      // Tomamos los datos del crédito encontrado y el nuevo plazo.
      const principal = foundCredit.balance;
      const annualInterestRate = foundCredit.rate / 100;
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
      
      setNewMonthlyPayment(payment); // Guardamos el resultado.
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* --- Tarjeta de Calculadora de Cuotas --- */}
      <Card>
        <CardHeader>
          <CardTitle>Calculadora de Cuotas</CardTitle>
          <CardDescription>
            Estima la cuota mensual de un crédito.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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
                placeholder="Ej: CR-002"
                />
            </div>
            <Button onClick={handleSearchCredit}>
                <Search className="mr-2 h-4 w-4" />
                Buscar
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
                      <h4 className="font-semibold">{foundCredit.debtorName}</h4>
                      <p className="text-sm text-muted-foreground">{foundCredit.operationNumber}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                          <p className="text-muted-foreground">Saldo Actual</p>
                          <p className="font-medium">₡{foundCredit.balance.toLocaleString('de-DE')}</p>
                      </div>
                       <div>
                          <p className="text-muted-foreground">Tasa de Interés</p>
                          <p className="font-medium">{foundCredit.rate}%</p>
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
