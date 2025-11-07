import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function PagosPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestión de Pagos</CardTitle>
        <CardDescription>
          Aplica pagos individuales o masivos desde planillas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p>
          Este módulo permitirá registrar pagos, ya sea de forma individual o
          cargando archivos CSV, XLSX o PDF de las deductoras.
        </p>
      </CardContent>
    </Card>
  );
}
