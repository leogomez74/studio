import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function ReportesPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reportes</CardTitle>
        <CardDescription>
          Genera reportes sobre el estado de la cartera y otros indicadores.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p>
          Este módulo permitirá generar los distintos tipos de reportes: estado
          de cartera, saldos, ventas, etc.
        </p>
      </CardContent>
    </Card>
  );
}
