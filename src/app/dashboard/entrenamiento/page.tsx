import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/**
 * Componente de la página de Entrenamiento.
 */
export default function EntrenamientoPage() {
  return (
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
  );
}
