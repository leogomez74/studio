import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function CalculosPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Calculadoras Financieras</CardTitle>
        <CardDescription>
          Herramientas para calcular cuotas y arreglos de pago.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p>
          Este módulo contendrá la calculadora de cuotas y la calculadora de
          arreglos de pago.
        </p>
      </CardContent>
    </Card>
  );
}
