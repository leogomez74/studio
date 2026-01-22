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

type AnalisisItem = {
  id: number;
  reference: string;
  monto_credito: number;
  status: string;
  created_at: string;
  opportunity_id?: string;
  lead_id?: string;
  ingreso_bruto?: number;
  ingreso_neto?: number;
  propuesta?: string;
  opportunity?: Opportunity;
  lead?: Lead;
};

export default function AnalisisPage() {
  const router = useRouter();
  const [analisisList, setAnalisisList] = useState<AnalisisItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);

  const [isCreditDialogOpen, setIsCreditDialogOpen] = useState(false);

  const [creditForm, setCreditForm] = useState({
    reference: '',
    title: '',
    status: 'Activo',
    category: 'Regular',
    monto_credito: '',
    leadId: '',
    description: '',
    divisa: 'CRC',
    plazo: '36',
  });
  const [isSaving, setIsSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [analisisRes, oppsRes, leadsRes] = await Promise.all([
        api.get('/api/analisis'),
        api.get('/api/opportunities'),
        api.get('/api/leads'),
      ]);
      const analisisData = analisisRes.data as AnalisisItem[];
      const oppsData = Array.isArray(oppsRes.data.data) ? oppsRes.data.data : oppsRes.data;
      const leadsData = Array.isArray(leadsRes.data.data) ? leadsRes.data.data : leadsRes.data;
      setOpportunities(oppsData);
      setLeads(leadsData);

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
                        onClick={() => {
                          setCreditForm({
                            reference: '',
                            title: '',
                            status: 'Activo',
                            category: 'Regular',
                            monto_credito: '',
                            leadId: item.lead?.id ? String(item.lead.id) : '',
                            description: '',
                            divisa: 'CRC',
                            plazo: '36',
                          });
                          setIsCreditDialogOpen(true);
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
              setIsSaving(true);
              try {
                await api.post('/api/credits', {
                  reference: creditForm.reference,
                  title: creditForm.title,
                  status: creditForm.status,
                  category: creditForm.category,
                  monto_credito: parseFloat(creditForm.monto_credito) || 0,
                  lead_id: parseInt(creditForm.leadId),
                  description: creditForm.description,
                  divisa: creditForm.divisa,
                  plazo: parseInt(creditForm.plazo) || 36,
                });
                setIsCreditDialogOpen(false);
                fetchAll();
              } catch (err) {
                alert('Error al crear crédito');
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
                  placeholder="Ej: CRED-ABC12345"
                  value={creditForm.reference}
                  onChange={e => setCreditForm(f => ({ ...f, reference: e.target.value }))}
                  required
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
                    <SelectItem value="Regular">Regular</SelectItem>
                    <SelectItem value="Micro-crédito">Micro-crédito</SelectItem>
                    <SelectItem value="Hipotecario">Hipotecario</SelectItem>
                    <SelectItem value="Personal">Personal</SelectItem>
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
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={creditForm.monto_credito}
                  onChange={e => setCreditForm(f => ({ ...f, monto_credito: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plazo">Plazo (Meses)</Label>
                <Select value={creditForm.plazo} onValueChange={v => setCreditForm(f => ({ ...f, plazo: v }))}>
                  <SelectTrigger id="plazo"><SelectValue placeholder="Selecciona el plazo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="36">36 meses</SelectItem>
                    <SelectItem value="60">60 meses</SelectItem>
                    <SelectItem value="120">120 meses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead">Lead</Label>
                <Input
                  id="lead"
                  value={creditForm.leadId}
                  disabled
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