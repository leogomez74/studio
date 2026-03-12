'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Trash2, Copy, Key, Loader2, Eye, EyeOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import api from '@/lib/axios';
import { toastSuccess, toastError } from '@/hooks/use-toast';
import Swal from 'sweetalert2';

type ApiToken = {
  id: number;
  name: string;
  abilities: string[];
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
};

const ITEMS_PER_PAGE = 10;

export default function ApiTokensTab() {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [tokenName, setTokenName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(tokens.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paginatedTokens = useMemo(() =>
    tokens.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE),
    [tokens, safePage]
  );

  const fetchTokens = useCallback(async () => {
    try {
      const res = await api.get('/api/api-tokens');
      setTokens(res.data);
    } catch {
      toastError('Error al cargar tokens.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTokens(); }, [fetchTokens]);

  const handleCreate = async () => {
    if (!tokenName.trim()) return;
    setCreating(true);
    try {
      const res = await api.post('/api/api-tokens', { name: tokenName.trim() });
      setNewToken(res.data.token);
      setShowToken(true);
      setTokenName('');
      setShowCreate(false);
      fetchTokens();
      toastSuccess('Token creado correctamente.');
    } catch (err: any) {
      toastError(err?.response?.data?.message || 'Error al crear token.');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: number, name: string) => {
    const { isConfirmed } = await Swal.fire({
      title: '¿Revocar token?',
      text: `El token "${name}" dejará de funcionar inmediatamente.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Revocar',
      cancelButtonText: 'Cancelar',
    });
    if (!isConfirmed) return;
    try {
      await api.delete(`/api/api-tokens/${id}`);
      toastSuccess('Token revocado.');
      fetchTokens();
    } catch {
      toastError('Error al revocar token.');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toastSuccess('Token copiado al portapapeles.');
  };

  const baseUrl = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : '';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" /> API Tokens
              </CardTitle>
              <CardDescription>
                Genera tokens para integrar con servicios externos como n8n, Zapier, etc.
              </CardDescription>
            </div>
            <Button size="sm" className="gap-1" onClick={() => setShowCreate(true)}>
              <PlusCircle className="h-4 w-4" /> Nuevo Token
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : tokens.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No hay tokens creados.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Último uso</TableHead>
                  <TableHead>Creado</TableHead>
                  <TableHead><span className="sr-only">Acciones</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTokens.map(token => (
                  <TableRow key={token.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{token.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {token.last_used_at
                        ? new Date(token.last_used_at).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : <Badge variant="secondary">Nunca</Badge>
                      }
                    </TableCell>
                    <TableCell>
                      {new Date(token.created_at).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => handleRevoke(token.id, token.name)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">{tokens.length} tokens</p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" disabled={safePage === 1} onClick={() => setPage(1)}>Primera</Button>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage === 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) { pageNum = i + 1; }
                  else if (safePage <= 3) { pageNum = i + 1; }
                  else if (safePage >= totalPages - 2) { pageNum = totalPages - 4 + i; }
                  else { pageNum = safePage - 2 + i; }
                  return (
                    <Button key={pageNum} variant={pageNum === safePage ? 'default' : 'outline'} size="icon" className="h-8 w-8" onClick={() => setPage(pageNum)}>
                      {pageNum}
                    </Button>
                  );
                })}
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage === totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={safePage === totalPages} onClick={() => setPage(totalPages)}>Última</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Endpoint reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Referencia de Endpoints</CardTitle>
          <CardDescription>
            Todos los endpoints disponibles para integración externa. Header requerido en todos:{' '}
            <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">Authorization: Bearer &lt;tu-token&gt;</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* --- Pago masivo por desembolso --- */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded">POST</span>
              <span className="text-sm font-semibold">Registrar pago de intereses por desembolso</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono break-all">
                /api/investment-coupons/bulk-pay-by-desembolso
              </code>
              <Button variant="outline" size="sm" onClick={() => copyToClipboard(`${baseUrl}/api/investment-coupons/bulk-pay-by-desembolso`)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <pre className="bg-muted px-3 py-2 rounded text-sm font-mono overflow-x-auto">{`{
  "desembolsos": ["18-C", "48-D"],
  "fecha_pago": "2026-03-11",
  "monto": 191460.62,
  "moneda": "CRC",
  "comentarios": "Pago de interés",
  "comprobante_url": "https://drive.google.com/...",
  "registered_by": 1
}`}</pre>
          </div>

          <hr />

          {/* --- Tabla general --- */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded">GET</span>
              <span className="text-sm font-semibold">Tabla general de inversiones</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono break-all">
                /api/investments/tabla-general
              </code>
              <Button variant="outline" size="sm" onClick={() => copyToClipboard(`${baseUrl}/api/investments/tabla-general`)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <hr />

          {/* --- Pagos próximos --- */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded">GET</span>
              <span className="text-sm font-semibold">Pagos próximos (cupones pendientes)</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono break-all">
                /api/investments/pagos-proximos
              </code>
              <Button variant="outline" size="sm" onClick={() => copyToClipboard(`${baseUrl}/api/investments/pagos-proximos`)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <hr />

          {/* --- Vencimientos --- */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded">GET</span>
              <span className="text-sm font-semibold">Inversiones próximas a vencer</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono break-all">
                /api/investments/vencimientos
              </code>
              <Button variant="outline" size="sm" onClick={() => copyToClipboard(`${baseUrl}/api/investments/vencimientos`)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <hr />

          {/* --- Cupones de inversión --- */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded">GET</span>
              <span className="text-sm font-semibold">Cupones de una inversión</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono break-all">
                /api/investments/{'{id}'}/coupons
              </code>
              <Button variant="outline" size="sm" onClick={() => copyToClipboard(`${baseUrl}/api/investments/{id}/coupons`)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <hr />

          {/* --- Pago individual --- */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">PATCH</span>
              <span className="text-sm font-semibold">Marcar cupón individual como pagado</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono break-all">
                /api/investment-coupons/{'{id}'}/pay
              </code>
              <Button variant="outline" size="sm" onClick={() => copyToClipboard(`${baseUrl}/api/investment-coupons/{id}/pay`)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Crear Token API</DialogTitle>
            <DialogDescription>Dale un nombre descriptivo para identificar dónde se usa.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Nombre del token</Label>
              <Input
                placeholder="ej: n8n-inversiones"
                value={tokenName}
                onChange={e => setTokenName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating || !tokenName.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Key className="h-4 w-4 mr-1" />}
              Crear Token
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show New Token Dialog */}
      <Dialog open={showToken} onOpenChange={(open) => { if (!open) { setNewToken(null); setShowToken(false); } }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Token Creado</DialogTitle>
            <DialogDescription>
              Copia este token ahora. No podrás verlo de nuevo.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-2 bg-muted p-3 rounded">
              <code className="flex-1 text-sm font-mono break-all select-all">{newToken}</code>
              <Button variant="outline" size="sm" onClick={() => newToken && copyToClipboard(newToken)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-destructive mt-2 font-medium">
              Este token solo se muestra una vez. Si lo pierdes, deberás crear uno nuevo.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => { setNewToken(null); setShowToken(false); }}>Entendido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
