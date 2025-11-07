import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function AnalisisPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Análisis de Crédito</CardTitle>
        <CardDescription>
          Módulo para análisis de riesgo crediticio de leads y clientes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p>
          Aquí se integrará la funcionalidad para el análisis de crédito,
          incluyendo la consulta a protectoras de crédito vía API o la carga de
          reportes.
        </p>
      </CardContent>
    </Card>
  );
}
