import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ProtectedPage } from "@/components/ProtectedPage";

/**
 * Componente de la página de Entrenamiento.
 */
export default function EntrenamientoPage() {
  return (
    <ProtectedPage module="entrenamiento">
      <Card>
      <CardHeader>
        <CardTitle>Entrenamiento</CardTitle>
        <CardDescription>
          Módulo de entrenamiento del sistema.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p>
          hola mundo
        </p>
      </CardContent>
    </Card>
    </ProtectedPage>
  );
}
