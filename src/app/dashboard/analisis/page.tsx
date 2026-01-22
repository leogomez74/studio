'use client';

import api from '@/lib/axios';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Opportunity, Lead } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';

// Funciones para formateo de moneda (Colones)
const formatCurrency = (value: string | number): string => {
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^\d.-]/g, '')) : value;
  if (isNaN(num)) return '';
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

const parseCurrencyToNumber = (value: string): string => {
  return value.replace(/[^\d.]/g, '');
};

type AnalisisItem = {
  id: number;
  reference: string;
  monto_credito: number;
  status: string;
  created_at: string;
  opportunity_id?: string;
  lead_id?: string;
  // Campos del análisis
  category?: string;
  title?: string;
  description?: string;
  divisa?: string;
  plazo?: number;
  ingreso_bruto?: number;
  ingreso_neto?: number;
  propuesta?: string;
  // Relaciones
  opportunity?: Opportunity;
  lead?: Lead;
};

type Product = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  is_default: boolean;
  order_column: number;
};

export default function AnalisisPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [analisisList, setAnalisisList] = useState<AnalisisItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [isCreditDialogOpen, setIsCreditDialogOpen] = useState(false);

  const [creditForm, setCreditForm] = useState({
    reference: '',
    title: '',
    status: 'Activo',
    category: 'Crédito',
    monto_credito: '',
    leadId: '',
    clientName: '',
    description: '',
    divisa: 'CRC',
    plazo: '36',
  });
  const [isSaving, setIsSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [analisisRes, oppsRes, leadsRes, productsRes] = await Promise.all([
        api.get('/api/analisis'),
        api.get('/api/opportunities'),
        api.get('/api/leads'),
        api.get('/api/products'),
      ]);
      const analisisData = analisisRes.data as AnalisisItem[];
      const oppsData = Array.isArray(oppsRes.data.data) ? oppsRes.data.data : oppsRes.data;
      const leadsData = Array.isArray(leadsRes.data.data) ? leadsRes.data.data : leadsRes.data;
      const productsData = productsRes.data as Product[];
      setOpportunities(oppsData);
      setLeads(leadsData);
      setProducts(productsData);

      const mapped = analisisData.map((item) => {
        const opportunity = oppsData.find((o: Opportunity) => String(o.id) === String(item.opportunity_id));
        let lead: Lead | undefined = item.lead;
        if (!lead && item.lead_id) {
          lead = leadsData.find((l: Lead) => String(l.id) === String(item.lead_id));
        } else if (!lead && opportunity?.lead) {
          lead = opportunity.lead;
        }
        return {
          ...item,
          opportunity,
          lead,
        };
      });
      setAnalisisList(mapped);
    } catch (err) {
      console.error(err);
      setError('No se pudieron cargar los datos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleOpenDetail = (item: AnalisisItem) => {
    router.push(`/dashboard/analisis/${item.id}`);
  };

  // 3. RENDERIZADO CONDICIONAL (Carga / Error)
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-500">
        Cargando análisis...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen text-red-500">
        {error}
      </div>
    );
  }

  // 4. TABLA PRINCIPAL
  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Listado de Analizados</h1>
      </div>

      <div className="overflow-x-auto bg-white shadow-md rounded-lg border border-gray-200">
        <table className="min-w-full text-sm text-left">
          <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
            <tr>
              <th className="px-6 py-3">Referencia</th>
              <th className="px-6 py-3">Cliente (Lead)</th>
              
              {/* NUEVAS COLUMNAS SOLICITADAS */}
              <th className="px-6 py-3 bg-blue-50 text-blue-800">Profesión</th>
              <th className="px-6 py-3 bg-blue-50 text-blue-800">Puesto</th>
              <th className="px-6 py-3 bg-blue-50 text-blue-800">Estado Puesto</th>
              
              <th className="px-6 py-3">Monto</th>
              <th className="px-6 py-3">Estado</th>
              <th className="px-6 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {analisisList.length > 0 ? (
              analisisList.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    <button
                      className="text-blue-600 hover:underline"
                      onClick={() => handleOpenDetail(item)}
                    >
                      {item.reference}
                    </button>
                  </td>

                  {/* Nombre del Lead */}
                  <td className="px-6 py-4 text-gray-700">
                    {item.lead?.name || 'Sin Asignar'}
                  </td>

                  {/* COLUMNA: Profesión (Acceso anidado) */}
                  <td className="px-6 py-4 text-gray-600">
                    {item.lead?.profesion || '-'}
                  </td>

                  {/* COLUMNA: Puesto */}
                  <td className="px-6 py-4 text-gray-600">
                    {item.lead?.puesto || '-'}
                  </td>

                  {/* COLUMNA: Estado Puesto */}
                  <td className="px-6 py-4 text-gray-600">
                    <span className={`px-2 py-1 rounded text-xs font-semibold
                      ${item.lead?.estado_puesto === 'Fijo' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}
                    `}>
                      {item.lead?.estado_puesto || 'N/A'}
                    </span>
                  </td>

                  {/* Monto (Formateado) */}
                  <td className="px-6 py-4 text-gray-700">
                    {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(item.monto_credito)}
                  </td>

                  {/* Estado del Análisis */}
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-semibold 
                      ${item.status === 'Aprobado' ? 'bg-green-100 text-green-700' : 
                        item.status === 'Rechazado' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-800'}`}>
                      {item.status}
                    </span>
                  </td>
                  {/* Acciones */}
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        variant="outline"
                        className="border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700"
                        title="Crear Crédito"
                        onClick={async () => {
                          try {
                            // Obtener la próxima referencia del servidor
                            const refResponse = await api.get('/api/credits/next-reference');
                            const nextReference = refResponse.data.reference;

                            setCreditForm({
                              reference: nextReference,
                              title: item.title || '',
                              status: 'Activo',
                              category: item.category || 'Regular',
                              monto_credito: item.monto_credito ? String(item.monto_credito) : '',
                              leadId: item.lead_id ? String(item.lead_id) : (item.lead?.id ? String(item.lead.id) : ''),
                              clientName: item.lead?.name || '',
                              description: item.description || '',
                              divisa: item.divisa || 'CRC',
                              plazo: item.plazo ? String(item.plazo) : '36',
                            });
                            setIsCreditDialogOpen(true);
                          } catch (err) {
                            toast({
                              variant: "destructive",
                              title: "Error",
                              description: "No se pudo obtener la referencia del crédito",
                            });
                          }
                        }}
                      >
                        Crear Crédito
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                  No hay análisis registrados aún.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Dialog for creating credit */}
      <Dialog open={isCreditDialogOpen} onOpenChange={setIsCreditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nuevo Crédito</DialogTitle>
            <DialogDescription>Completa la información del crédito.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-6"
            onSubmit={async (e) => {
              e.preventDefault();

              // Validaciones previas
              const montoNumerico = parseFloat(parseCurrencyToNumber(creditForm.monto_credito));
              const leadIdNumerico = parseInt(creditForm.leadId);
              const plazoNumerico = parseInt(creditForm.plazo);

              if (!creditForm.leadId || isNaN(leadIdNumerico)) {
                toast({
                  variant: "destructive",
                  title: "Error de validación",
                  description: "No hay un cliente asociado al análisis",
                });
                return;
              }
              if (isNaN(montoNumerico) || montoNumerico < 2) {
                toast({
                  variant: "destructive",
                  title: "Error de validación",
                  description: "El monto debe ser un número mayor a 2",
                });
                return;
              }
              if (isNaN(plazoNumerico) || plazoNumerico < 1 || plazoNumerico > 120) {
                toast({
                  variant: "destructive",
                  title: "Error de validación",
                  description: "El plazo debe ser un número entre 1 y 120",
                });
                return;
              }

              setIsSaving(true);
              const payload = {
                reference: creditForm.reference,
                title: creditForm.title,
                status: creditForm.status,
                category: creditForm.category,
                monto_credito: montoNumerico,
                lead_id: leadIdNumerico,
                description: creditForm.description,
                divisa: creditForm.divisa,
                plazo: plazoNumerico,
              };
              console.log('Enviando payload:', payload);

              try {
                const response = await api.post('/api/credits', payload);
                console.log('Respuesta:', response.data);
                setIsCreditDialogOpen(false);
                toast({
                  variant: "success",
                  title: "Crédito creado",
                  description: `El crédito ${response.data.reference} se ha creado exitosamente.`,
                });
                fetchAll();
              } catch (err: any) {
                console.error('Error completo:', err);
                console.error('Response:', err?.response);
                console.error('Response data:', err?.response?.data);
                console.error('Response status:', err?.response?.status);

                let mensaje = 'Error al crear crédito';
                if (err?.response?.data?.message) {
                  mensaje = err.response.data.message;
                } else if (err?.response?.data?.errors) {
                  mensaje = Object.values(err.response.data.errors).flat().join(', ');
                } else if (err?.message) {
                  mensaje = err.message;
                }
                toast({
                  variant: "destructive",
                  title: "Error al crear crédito",
                  description: mensaje,
                });
              } finally {
                setIsSaving(false);
              }
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="reference">Referencia</Label>
                <Input
                  id="reference"
                  placeholder="Se genera automáticamente (YY-XXXXX-CR)"
                  value={creditForm.reference}
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  placeholder="Crédito Hipotecario..."
                  value={creditForm.title}
                  onChange={e => setCreditForm(f => ({ ...f, title: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Estado</Label>
                <Select value={creditForm.status} onValueChange={v => setCreditForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger id="status"><SelectValue placeholder="Selecciona el estado" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Activo">Activo</SelectItem>
                    <SelectItem value="Mora">Mora</SelectItem>
                    <SelectItem value="Cerrado">Cerrado</SelectItem>
                    <SelectItem value="Legal">Legal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoría</Label>
                <Select value={creditForm.category} onValueChange={v => setCreditForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger id="category"><SelectValue placeholder="Selecciona la categoría" /></SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.name}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="divisa">Divisa</Label>
                <Select value={creditForm.divisa} onValueChange={v => setCreditForm(f => ({ ...f, divisa: v }))}>
                  <SelectTrigger id="divisa"><SelectValue placeholder="Selecciona la divisa" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CRC">CRC - Colón Costarricense</SelectItem>
                    <SelectItem value="USD">USD - Dólar Estadounidense</SelectItem>
                    <SelectItem value="EUR">EUR - Euro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="monto">Monto</Label>
                <Input
                  id="monto"
                  type="text"
                  placeholder="₡0.00"
                  value={creditForm.monto_credito ? formatCurrency(creditForm.monto_credito) : ''}
                  onChange={e => {
                    const rawValue = parseCurrencyToNumber(e.target.value);
                    setCreditForm(f => ({ ...f, monto_credito: rawValue }));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plazo">Plazo (Meses)</Label>
                <Input
                  id="plazo"
                  type="number"
                  min="1"
                  max="120"
                  placeholder="1 - 120"
                  value={creditForm.plazo}
                  onChange={e => {
                    const valor = parseInt(e.target.value);
                    if (e.target.value === '') {
                      setCreditForm(f => ({ ...f, plazo: '' }));
                    } else if (!isNaN(valor) && valor >= 1 && valor <= 120) {
                      setCreditForm(f => ({ ...f, plazo: String(valor) }));
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cliente">Cliente</Label>
                <Input
                  id="cliente"
                  value={creditForm.clientName}
                  disabled
                  placeholder="Cliente del análisis"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                className="min-h-[80px]"
                placeholder="Describe el contexto del crédito..."
                value={creditForm.description}
                onChange={e => setCreditForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isSaving} className="bg-green-600 text-white hover:bg-green-700">
                {isSaving ? 'Guardando...' : 'Crear Crédito'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}