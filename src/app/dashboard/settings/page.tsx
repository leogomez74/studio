// Importamos los componentes de UI que necesitamos.
// Este es un Componente de Servidor por defecto, ya que no necesita interactividad del lado del cliente.
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Esta es la función principal que define la página de Configuración.
 * Actualmente, muestra un formulario para configurar la conexión con una API de un ERP.
 */
export default function SettingsPage() {
  // La función devuelve el contenido de la página.
  return (
    <div className="space-y-6">
      <Card>
        {/* El encabezado de la tarjeta muestra el título y la descripción de la página. */}
        <CardHeader>
          <CardTitle>Configuración de API</CardTitle>
          <CardDescription>
            {/* $$$ CONECTOR ERP: Esta sección es clave para la integración. Aquí se gestionará la conexión con el sistema ERP de DSF. */}
            Gestiona la conexión con el sistema ERP de DSF.
          </CardDescription>
        </CardHeader>
        {/* El contenido de la tarjeta ahora tiene un formulario para la configuración de la API. */}
        <CardContent>
          <form className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="api-url">URL del ERP</Label>
              <Input
                id="api-url"
                placeholder="https://erp.dsf.cr/api"
                defaultValue="https://erp.dsf.cr"
                disabled // Este campo está deshabilitado para no poder ser modificado.
              />
               <p className="text-xs text-muted-foreground">La URL base del ERP no se puede modificar.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-key">Clave de API (API Key)</Label>
              <Input id="api-key" type="password" placeholder="Ingresa tu clave de API" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-secret">Secreto de API (API Secret)</Label>
              <Input id="api-secret" type="password" placeholder="Ingresa tu secreto de API" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
                {/* $$$ CONECTOR ERP: Estos botones probarán y guardarán las credenciales para conectar con el ERP. */}
                <Button variant="outline">Probar Conexión</Button>
                <Button type="submit">Guardar Cambios</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
