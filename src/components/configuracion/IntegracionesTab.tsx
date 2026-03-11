'use client';

import React, { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Wifi, WifiOff, TestTube, Loader2, ExternalLink } from 'lucide-react';

interface ExternalIntegration {
  id: number;
  name: string;
  slug: string;
  type: 'rutas' | 'general';
  base_url: string;
  auth_type: 'bearer' | 'basic' | 'api_key' | 'none';
  is_active: boolean;
  has_token: boolean;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_message: string | null;
  created_at: string;
}

const emptyForm = {
  name: '',
  slug: '',
  type: 'rutas' as 'rutas' | 'general',
  is_active: true,
};

export default function IntegracionesTab() {
  const { toast } = useToast();
  const [integrations, setIntegrations] = useState<ExternalIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ExternalIntegration | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<number | null>(null);

  const fetchIntegrations = async () => {
    try {
      const res = await api.get('/api/external-integrations');
      setIntegrations(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar las integraciones', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchIntegrations(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const openEdit = (integration: ExternalIntegration) => {
    setEditing(integration);
    setForm({
      name: integration.name,
      slug: integration.slug,
      type: integration.type,
      is_active: integration.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) {
      toast({ title: 'Error', description: 'El nombre es requerido', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name,
        slug: form.slug || undefined,
        type: form.type,
        is_active: form.is_active,
      };

      if (editing) {
        await api.put(`/api/external-integrations/${editing.id}`, payload);
        toast({ title: 'Integración actualizada' });
      } else {
        await api.post('/api/external-integrations', payload);
        toast({ title: 'Integración creada' });
      }

      setDialogOpen(false);
      fetchIntegrations();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast({ title: 'Error', description: error.response?.data?.message || 'Error al guardar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar esta integración?')) return;
    try {
      await api.delete(`/api/external-integrations/${id}`);
      toast({ title: 'Integración eliminada' });
      fetchIntegrations();
    } catch {
      toast({ title: 'Error', description: 'No se pudo eliminar', variant: 'destructive' });
    }
  };

  const handleTest = async (id: number) => {
    setTesting(id);
    try {
      const res = await api.post(`/api/external-integrations/${id}/test`);
      const data = res.data;
      toast({
        title: data.success ? 'Conexión exitosa' : 'Error de conexión',
        description: data.message,
        variant: data.success ? 'default' : 'destructive',
      });
      fetchIntegrations();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast({
        title: 'Error de conexión',
        description: error.response?.data?.message || 'No se pudo conectar',
        variant: 'destructive',
      });
      fetchIntegrations();
    } finally {
      setTesting(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Nunca';
    return new Date(dateStr).toLocaleString('es-CR', { dateStyle: 'short', timeStyle: 'short' });
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Integraciones Externas</h2>
          <p className="text-sm text-muted-foreground">
            Conexiones API con empresas externas (URL, token y endpoints se configuran en .env)
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Integración
        </Button>
      </div>

      {integrations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ExternalLink className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay integraciones configuradas</p>
            <Button variant="outline" className="mt-4" onClick={openCreate}>
              Agregar primera integración
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {integrations.map(integration => (
            <Card key={integration.id} className={!integration.is_active ? 'opacity-60' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    {integration.is_active ? (
                      <Wifi className="h-4 w-4 text-green-500" />
                    ) : (
                      <WifiOff className="h-4 w-4 text-gray-400" />
                    )}
                    {integration.name}
                  </CardTitle>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(integration)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDelete(integration.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <CardDescription className="text-xs truncate">{integration.base_url}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline">{integration.type}</Badge>
                  <Badge variant="outline">{integration.auth_type}</Badge>
                  {integration.has_token && <Badge variant="secondary">Token configurado</Badge>}
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Última prueba: {formatDate(integration.last_sync_at)}</span>
                  {integration.last_sync_status && (
                    <Badge variant={integration.last_sync_status === 'success' ? 'default' : 'destructive'} className="text-xs">
                      {integration.last_sync_status === 'success' ? 'OK' : 'Error'}
                    </Badge>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={testing === integration.id || !integration.is_active}
                  onClick={() => handleTest(integration.id)}
                >
                  {testing === integration.id ? (
                    <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  ) : (
                    <TestTube className="h-3.5 w-3.5 mr-2" />
                  )}
                  Probar Conexión
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog crear/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Integración' : 'Nueva Integración'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="DSF3"
                />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input
                  value={form.slug}
                  onChange={e => setForm(prev => ({ ...prev, slug: e.target.value }))}
                  placeholder="auto-generado"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={v => setForm(prev => ({ ...prev, type: v as 'rutas' | 'general' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rutas">Rutas</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end pb-1">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.is_active}
                    onCheckedChange={v => setForm(prev => ({ ...prev, is_active: v }))}
                  />
                  <Label>Activa</Label>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              La URL, token y endpoints se configuran en el archivo .env del servidor.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
