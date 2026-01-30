// Importamos los componentes de tarjeta para la estructura de la página.
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ProtectedPage } from "@/components/ProtectedPage";

/**
 * Componente de la página de Reportes.
 * Actualmente es un marcador de posición para la futura funcionalidad de generación de reportes.
 */
export default function ReportesPage() {
  return (
    <ProtectedPage module="reportes">
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
    </ProtectedPage>
  );
}
