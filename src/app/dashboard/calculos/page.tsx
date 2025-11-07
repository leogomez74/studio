'use client';

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
import { Calculator, Search, RefreshCw } from 'lucide-react';
import { credits, Credit } from '@/lib/data';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function CalculosPage() {
  const [amount, setAmount] = useState('5000000');
  const [rate, setRate] = useState('24');
  const [term, setTerm] = useState('36');
  const [monthlyPayment, setMonthlyPayment] = useState<number | null>(null);

  // State for settlement calculator
  const [operationNumber, setOperationNumber] = useState('');
  const [foundCredit, setFoundCredit] = useState<Credit | null>(null);
  const [newTerm, setNewTerm] = useState('12');
  const [newMonthlyPayment, setNewMonthlyPayment] = useState<number | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleCalculateFee = () => {
    const principal = parseFloat(amount);
    const annualInterestRate = parseFloat(rate) / 100;
    const numberOfMonths = parseInt(term, 10);

    if (
      isNaN(principal) ||
      isNaN(annualInterestRate) ||
      isNaN(numberOfMonths) ||
      principal <= 0 ||
      annualInterestRate <= 0 ||
      numberOfMonths <= 0
    ) {
      setMonthlyPayment(null);
      return;
    }

    const monthlyInterestRate = annualInterestRate / 12;
    const power = Math.pow(1 + monthlyInterestRate, numberOfMonths);
    const payment =
      principal * ((monthlyInterestRate * power) / (power - 1));

    setMonthlyPayment(payment);
  };

  const handleSearchCredit = () => {
    setSearchError(null);
    setNewMonthlyPayment(null);
    const credit = credits.find(c => c.operationNumber.toLowerCase() === operationNumber.toLowerCase());
    if (credit) {
      setFoundCredit(credit);
    } else {
      setFoundCredit(null);
      setSearchError(`No se encontró ningún crédito con el número de operación "${operationNumber}".`);
    }
  };

  const handleCalculateSettlement = () => {
      if (!foundCredit) return;

      const principal = foundCredit.balance;
      const annualInterestRate = foundCredit.rate / 100;
      const numberOfMonths = parseInt(newTerm, 10);

      if (isNaN(principal) || isNaN(annualInterestRate) || isNaN(numberOfMonths) || principal <= 0) {
        setNewMonthlyPayment(null);
        return;
      }
      
      const monthlyInterestRate = annualInterestRate / 12;
      const power = Math.pow(1 + monthlyInterestRate, numberOfMonths);
      const payment = principal * ((monthlyInterestRate * power) / (power - 1));
      
      setNewMonthlyPayment(payment);
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
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

          {monthlyPayment !== null && (
            <div className="rounded-lg border bg-muted p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Cuota Mensual Estimada
              </p>
              <p className="text-2xl font-bold text-primary">
                ₡{monthlyPayment.toLocaleString('es-CR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
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

          {searchError && (
              <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{searchError}</AlertDescription>
              </Alert>
          )}

          {foundCredit && (
              <div className="space-y-4 rounded-lg border bg-muted/50 p-4">
                  <div>
                      <h4 className="font-semibold">{foundCredit.debtorName}</h4>
                      <p className="text-sm text-muted-foreground">{foundCredit.operationNumber}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                          <p className="text-muted-foreground">Saldo Actual</p>
                          <p className="font-medium">₡{foundCredit.balance.toLocaleString('es-CR')}</p>
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

           {newMonthlyPayment !== null && (
            <div className="rounded-lg border bg-accent/20 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Nueva Cuota Mensual Estimada
              </p>
              <p className="text-2xl font-bold text-primary">
                ₡{newMonthlyPayment.toLocaleString('es-CR', {
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
