'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, Trash2, Loader2, Wifi, WifiOff, Phone, Save, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/axios';

interface EvolutionInstance {
  id: number;
  alias: string;
  instance_name: string;
  phone_number: string;
  profile_name: string;
  status: string;
  has_api_key: boolean;
  is_active: boolean;
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  open:       { label: 'Conectado',    className: 'bg-green-500/10 text-green-700 border-green-200' },
  connecting: { label: 'Conectando',   className: 'bg-yellow-500/10 text-yellow-700 border-yellow-200' },
  closed:     { label: 'Desconectado', className: 'bg-red-500/10 text-red-700 border-red-200' },
  unknown:    { label: 'Desconocido',  className: 'bg-gray-500/10 text-gray-600 border-gray-200' },
};

export function EvolutionApiTab() {
  const { toast } = useToast();

  // ─── Estado: configuración del servidor ──────────────────────────────
  const [serverUrl, setServerUrl]         = useState('');
  const [savingUrl, setSavingUrl]         = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // ─── Estado: instancias ───────────────────────────────────────────────
  const [instances, setInstances]               = useState<EvolutionInstance[]>([]);
  const [loadingList, setLoadingList]           = useState(true);
  const [dialogOpen, setDialogOpen]             = useState(false);
  const [apiKey, setApiKey]                     = useState('');
  const [connecting, setConnecting]             = useState(false);
  const [reconnectingId, setReconnectingId]     = useState<number | null>(null);
  const [aliasDialogOpen, setAliasDialogOpen]   = useState(false);
  const [editingInstance, setEditingInstance]   = useState<EvolutionInstance | null>(null);
  const [aliasValue, setAliasValue]             = useState('');
  const [savingAlias, setSavingAlias]           = useState(false);

  // ─── Cargar configuración del servidor ───────────────────────────────
  const fetchServerConfig = useCallback(async () => {
    try {
      const res = await api.get('/api/evolution-server-config');
      setServerUrl(res.data.base_url ?? '');
    } catch {
      toast({ title: 'Error', description: 'No se pudo cargar la configuración del servidor', variant: 'destructive' });
    } finally {
      setLoadingConfig(false);
    }
  }, [toast]);

  // ─── Cargar instancias ────────────────────────────────────────────────
  const fetchInstances = useCallback(async () => {
    try {
      const res = await api.get('/api/evolution-instances');
      setInstances(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar las instancias', variant: 'destructive' });
    } finally {
      setLoadingList(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchServerConfig();
    fetchInstances();
  }, [fetchServerConfig, fetchInstances]);

  // ─── Guardar URL del servidor ─────────────────────────────────────────
  const handleSaveUrl = async () => {
    if (!serverUrl.trim()) {
      toast({ title: 'URL requerida', variant: 'destructive' });
      return;
    }
    try {
      setSavingUrl(true);
      await api.put('/api/evolution-server-config', { base_url: serverUrl.trim() });
      toast({ title: 'URL del servidor guardada' });
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast({ title: 'Error', description: error.response?.data?.message ?? 'Error al guardar', variant: 'destructive' });
    } finally {
      setSavingUrl(false);
    }
  };

  // ─── Conectar nueva instancia ─────────────────────────────────────────
  const handleConnect = async () => {
    if (!apiKey.trim()) {
      toast({ title: 'API Key requerida', variant: 'destructive' });
      return;
    }
    try {
      setConnecting(true);
      const res = await api.post('/api/evolution-instances', { api_key: apiKey.trim(), alias: aliasValue.trim() || undefined });
      toast({
        title: 'Instancia conectada',
        description: `${res.data.instance_name}${res.data.phone_number ? ` — ${res.data.phone_number}` : ''}`,
      });
      setDialogOpen(false);
      setApiKey('');
      fetchInstances();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast({
        title: 'No se pudo conectar',
        description: error.response?.data?.message ?? 'Verifica el API Key y la URL del servidor',
        variant: 'destructive',
      });
    } finally {
      setConnecting(false);
    }
  };

  // ─── Reconectar / actualizar estado ──────────────────────────────────
  const handleReconnect = async (instance: EvolutionInstance) => {
    setReconnectingId(instance.id);
    try {
      await api.post(`/api/evolution-instances/${instance.id}/reconnect`);
      toast({ title: 'Estado actualizado', description: instance.instance_name });
      fetchInstances();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast({
        title: 'Sin respuesta',
        description: error.response?.data?.message ?? 'No se pudo actualizar el estado',
        variant: 'destructive',
      });
    } finally {
      setReconnectingId(null);
    }
  };

  // ─── Editar alias ─────────────────────────────────────────────────────
  const openAliasDialog = (inst: EvolutionInstance) => {
    setEditingInstance(inst);
    setAliasValue(inst.alias ?? '');
    setAliasDialogOpen(true);
  };

  const handleSaveAlias = async () => {
    if (!editingInstance) return;
    try {
      setSavingAlias(true);
      await api.patch(`/api/evolution-instances/${editingInstance.id}/alias`, { alias: aliasValue.trim() });
      toast({ title: 'Alias actualizado' });
      setAliasDialogOpen(false);
      fetchInstances();
    } catch {
      toast({ title: 'Error al guardar el alias', variant: 'destructive' });
    } finally {
      setSavingAlias(false);
    }
  };

  // ─── Eliminar instancia ───────────────────────────────────────────────
  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`¿Desconectar la instancia "${name}"?`)) return;
    try {
      await api.delete(`/api/evolution-instances/${id}`);
      toast({ title: 'Instancia desconectada' });
      fetchInstances();
    } catch {
      toast({ title: 'Error al eliminar', variant: 'destructive' });
    }
  };

  const getStatusBadge = (status: string) => {
    const s = STATUS_MAP[status] ?? STATUS_MAP.unknown;
    return <Badge variant="outline" className={s.className}>{s.label}</Badge>;
  };

  return (
    <div className="space-y-6">

      {/* ─── Sección: Servidor ────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Servidor Evolution API</CardTitle>
          <CardDescription>
            URL base del servidor Evolution API. Esta URL se usará para todas las instancias.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingConfig ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
            </div>
          ) : (
            <div className="flex gap-3 items-end">
              <div className="flex-1 space-y-1">
                <Label htmlFor="evo-server-url">URL del servidor</Label>
                <Input
                  id="evo-server-url"
                  placeholder="https://evo.mi-servidor.com"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveUrl()}
                />
              </div>
              <Button onClick={handleSaveUrl} disabled={savingUrl}>
                {savingUrl
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <Save className="mr-2 h-4 w-4" />}
                Guardar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* ─── Sección: Instancias ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Instancias conectadas</CardTitle>
            <CardDescription>
              Agrega el API Key de cada instancia. El sistema obtendrá automáticamente el nombre e información.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => { setApiKey(''); setAliasValue(''); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Agregar API Key
          </Button>
        </CardHeader>
        <CardContent>
          {loadingList ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : instances.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No hay instancias conectadas. Agrega el API Key de tu primera instancia.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Instancia</TableHead>
                  <TableHead>Alias</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instances.map((inst) => (
                  <TableRow key={inst.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {inst.status === 'open'
                          ? <Wifi className="h-4 w-4 text-green-500 shrink-0" />
                          : <WifiOff className="h-4 w-4 text-muted-foreground shrink-0" />}
                        <div>
                          <div className="font-medium text-sm">{inst.instance_name || '—'}</div>
                          {inst.profile_name && (
                            <div className="text-xs text-muted-foreground">{inst.profile_name}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {inst.alias ? (
                        <span className="text-sm">{inst.alias}</span>
                      ) : (
                        <button
                          onClick={() => openAliasDialog(inst)}
                          className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                        >
                          + Agregar alias
                        </button>
                      )}
                    </TableCell>
                    <TableCell>
                      {inst.phone_number ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {inst.phone_number}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No disponible</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(inst.status)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">•••</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openAliasDialog(inst)}>
                            <Pencil className="mr-2 h-4 w-4" /> Editar alias
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleReconnect(inst)}
                            disabled={reconnectingId === inst.id}
                          >
                            {reconnectingId === inst.id
                              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              : <RefreshCw className="mr-2 h-4 w-4" />}
                            Actualizar estado
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDelete(inst.id, inst.instance_name)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Desconectar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ─── Dialog: Editar alias ────────────────────────────────────── */}
      <Dialog open={aliasDialogOpen} onOpenChange={setAliasDialogOpen}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Alias de la instancia</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-alias">Alias interno</Label>
              <Input
                id="edit-alias"
                placeholder="Ej: Ventas, Soporte, Cobranza..."
                value={aliasValue}
                onChange={(e) => setAliasValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveAlias()}
                autoFocus
              />
              {editingInstance && (
                <p className="text-xs text-muted-foreground">Instancia: {editingInstance.instance_name}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAliasDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveAlias} disabled={savingAlias}>
              {savingAlias ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog: Agregar API Key ──────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Conectar Instancia</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="evo-apikey">API Key de la instancia *</Label>
              <Input
                id="evo-apikey"
                type="password"
                placeholder="Pega aquí el API Key..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                El sistema se conectará a Evolution API y obtendrá automáticamente el nombre e información de la instancia.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="evo-alias">Alias interno <span className="text-muted-foreground">(opcional)</span></Label>
              <Input
                id="evo-alias"
                placeholder="Ej: Ventas, Soporte, Cobranza..."
                value={aliasValue}
                onChange={(e) => setAliasValue(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Nombre amigable para identificar esta instancia dentro del sistema.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleConnect} disabled={connecting}>
              {connecting
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Conectando...</>
                : <><Wifi className="mr-2 h-4 w-4" /> Conectar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
