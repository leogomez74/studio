// Importamos los componentes de tarjeta para la estructura de la página.
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileDown } from 'lucide-react';

/**
 * Componente de la página de Retenciones.
 * Permitirá generar y visualizar los reportes de retenciones.
 */
export default function RetencionesPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reportes de Retenciones</CardTitle>
        <CardDescription>
          Genera y descarga los reportes de retenciones aplicadas a las inversiones.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
            <p>
                Este módulo permitirá generar el reporte detallado de las retenciones en la fuente
                aplicadas a los cupones de intereses de los inversionistas.
            </p>
            <Button>
                <FileDown className="mr-2 h-4 w-4" />
                Generar Reporte de Retenciones
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}
