import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function CobroJudicialPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cobro Judicial</CardTitle>
        <CardDescription>
          Módulo para la gestión de casos en cobro judicial.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p>
          Aquí se gestionarán los créditos que han sido enviados a cobro
          judicial, similar al antiguo módulo de "Amparos".
        </p>
      </CardContent>
    </Card>
  );
}
