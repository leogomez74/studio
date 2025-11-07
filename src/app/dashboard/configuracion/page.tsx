import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ConfiguracionPage() {
  return (
    <Tabs defaultValue="prestamos">
      <TabsList className="mb-4">
        <TabsTrigger value="prestamos">Préstamos</TabsTrigger>
        <TabsTrigger value="patronos">Patronos</TabsTrigger>
        <TabsTrigger value="api">API ERP</TabsTrigger>
      </TabsList>
      <TabsContent value="prestamos">
        <Card>
          <CardHeader>
            <CardTitle>Tipos de Préstamo</CardTitle>
            <CardDescription>
              Configura los diferentes tipos de crédito que ofrece Credipep.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>
              Formularios para definir los tipos de préstamo, tasas de interés,
              plazos y tasas de interés moratorio.
            </p>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="patronos">
        <Card>
          <CardHeader>
            <CardTitle>Patronos</CardTitle>
            <CardDescription>
              Gestiona la lista de instituciones y patronos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>
              Tabla para administrar las instituciones empleadoras, quién
              cobra y las fechas de cobro.
            </p>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="api">
        <Card>
          <CardHeader>
            <CardTitle>Configuración de API</CardTitle>
            <CardDescription>
              Gestiona la conexión con el sistema ERP.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="max-w-md space-y-4">
              <div className="space-y-2">
                <Label htmlFor="api-url">URL del ERP</Label>
                <Input
                  id="api-url"
                  placeholder="https://erp.example.com/api"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="api-key">Clave de API (API Key)</Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder="Ingresa tu clave de API"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline">Probar Conexión</Button>
                <Button type="submit">Guardar Cambios</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
