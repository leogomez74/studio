'use client';

import { useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Loader2, Upload, FileText, CheckCircle2, AlertTriangle, XCircle,
  Users, Landmark, Eye, X,
} from 'lucide-react';
import api from '@/lib/axios';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/contexts/PermissionsContext';

interface PreviewField {
  field: string;
  label: string;
  value: string | null;
}

interface ExistingPerson {
  id: number;
  cedula: string | null;
  nombre_completo: string;
  person_type_id: number;
  tipo: 'Cliente' | 'Lead';
  email: string | null;
  phone: string | null;
  is_active: boolean;
}

interface RecordPreview {
  source_file: string;
  row_number?: number;
  extracted: Record<string, string | null>;
  filled: PreviewField[];
  missing: PreviewField[];
  filled_count: number;
  missing_count: number;
  already_exists: boolean;
  existing: ExistingPerson | null;
  error: string | null;
}

interface PreviewSummary {
  total: number;
  new: number;
  already_exists: number;
  no_cedula: number;
  parse_errors: number;
}

interface PreviewResponse {
  success: boolean;
  summary: PreviewSummary;
  records: RecordPreview[];
}

export default function ImportacionPage() {
  const { toast } = useToast();
  const { hasPermission } = usePermissions();

  const [activeTab, setActiveTab] = useState<'clientes' | 'creditos'>('clientes');

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Importación</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Sube archivos Excel, CSV o PDF para previsualizar y crear registros en lote.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'clientes' | 'creditos')}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="clientes" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Clientes
          </TabsTrigger>
          <TabsTrigger value="creditos" className="flex items-center gap-2">
            <Landmark className="h-4 w-4" />
            Créditos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clientes" className="space-y-6 mt-4">
          <ImportarClientesTab hasPermission={hasPermission} toast={toast} />
        </TabsContent>

        <TabsContent value="creditos" className="space-y-6 mt-4">
          <ImportarCreditosTab hasPermission={hasPermission} toast={toast} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Clientes
// ---------------------------------------------------------------------------
type HasPermissionFn = ReturnType<typeof usePermissions>['hasPermission'];
type ToastFn = ReturnType<typeof useToast>['toast'];

interface ClienteCreateResult {
  index: number;
  cedula: string | null;
  success: boolean;
  omitido?: boolean;
  id?: number;
  nombre?: string;
  error?: string;
}

interface ClienteCreateResponse {
  success: boolean;
  stats: { creados: number; omitidos: number; fallidos: number };
  results: ClienteCreateResult[];
}

function ImportarClientesTab({ hasPermission, toast }: { hasPermission: HasPermissionFn; toast: ToastFn }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [detailRecord, setDetailRecord] = useState<RecordPreview | null>(null);
  const [createResult, setCreateResult] = useState<ClienteCreateResponse | null>(null);

  const canCreate = hasPermission('importacion', 'create');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;

    // Si hay un Excel/CSV no se pueden mezclar con otros archivos
    const exts = selected.map(f => f.name.split('.').pop()?.toLowerCase() ?? '');
    const hasSheet = exts.some(x => ['xlsx', 'xls', 'csv'].includes(x));
    if (hasSheet && selected.length > 1) {
      toast({
        title: 'Solo un archivo Excel/CSV',
        description: 'Para Excel/CSV usa un solo archivo. Las filas adicionales se procesan como records distintos.',
        variant: 'destructive',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setFiles(selected);
    setPreview(null);
  };

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    const formData = new FormData();
    files.forEach(f => formData.append('files[]', f));

    try {
      setUploading(true);
      setPreview(null);
      const res = await api.post<PreviewResponse>('/api/importacion/preview-cliente', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreview(res.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || 'No se pudo procesar los archivos.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setFiles([]);
    setPreview(null);
    setCreateResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreate = async () => {
    if (!preview) return;
    const payload = {
      clientes: preview.records
        .filter(r => !r.error && !r.already_exists && r.extracted.cedula)
        .map(r => r.extracted),
    };
    if (payload.clientes.length === 0) {
      toast({ title: 'Sin clientes nuevos', description: 'No hay registros válidos para crear.' });
      return;
    }
    try {
      setCreating(true);
      const res = await api.post<ClienteCreateResponse>('/api/importacion/crear-cliente', payload);
      setCreateResult(res.data);
      toast({
        title: 'Importación completada',
        description: `${res.data.stats.creados} cliente(s) creado(s), ${res.data.stats.omitidos} omitido(s), ${res.data.stats.fallidos} con error.`,
      });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || 'No se pudo crear los clientes.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      {/* Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Subir archivos
          </CardTitle>
          <CardDescription>
            <strong>Excel/CSV</strong>: un solo archivo con todas las filas (cada fila = 1 cliente).{' '}
            <strong>PDF</strong>: uno o varios archivos (cada PDF = 1 cliente). Máx. 10 MB por archivo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept=".xlsx,.xls,.csv,.pdf"
            onChange={handleFileSelect}
            disabled={uploading}
          />

          {files.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-10 text-center">
              <FileText className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                Aún no has seleccionado archivos
              </p>
              <Button
                size="sm"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Seleccionar archivos
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {files.map((f, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-md border p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{f.name}</p>
                        <p className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(idx)}
                      disabled={uploading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Agregar más
                </Button>
                <Button
                  size="sm"
                  onClick={handleUpload}
                  disabled={uploading || files.length === 0}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Eye className="h-4 w-4 mr-2" />
                  )}
                  {uploading ? 'Procesando...' : `Previsualizar (${files.length})`}
                </Button>
                {preview && (
                  <Button variant="ghost" size="sm" onClick={handleReset}>
                    Limpiar
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Resultados del preview */}
      {preview && (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{preview.summary.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Nuevos</p>
                <p className="text-2xl font-bold text-green-600">{preview.summary.new}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Ya existen</p>
                <p className="text-2xl font-bold text-red-600">{preview.summary.already_exists}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Sin cédula / Errores</p>
                <p className="text-2xl font-bold text-amber-600">
                  {preview.summary.no_cedula + preview.summary.parse_errors}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabla */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Registros detectados</CardTitle>
              <CardDescription>
                Haz clic en cualquier registro para ver el detalle de campos extraídos.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">#</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead>Cédula</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="text-center">Campos</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.records.map((r, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium truncate max-w-[200px]" title={r.source_file}>
                          {r.source_file}
                        </div>
                        {r.row_number && r.row_number > 1 && (
                          <div className="text-muted-foreground">Fila {r.row_number}</div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.extracted.cedula || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-xs">
                        {[r.extracted.name, r.extracted.apellido1, r.extracted.apellido2]
                          .filter(Boolean).join(' ') || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        <span className="text-green-600 font-medium">{r.filled_count}</span>
                        <span className="text-muted-foreground"> / {r.filled_count + r.missing_count}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <RecordStatusBadge record={r} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDetailRecord(r)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Acción bulk */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleReset} disabled={creating}>
              Cancelar
            </Button>
            <Button
              disabled={!canCreate || preview.summary.new === 0 || creating}
              onClick={handleCreate}
              title={
                !canCreate ? 'No tienes permiso para crear clientes' :
                preview.summary.new === 0 ? 'No hay registros nuevos para crear' : ''
              }
            >
              {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {creating ? 'Creando...' : `Crear ${preview.summary.new} cliente${preview.summary.new !== 1 ? 's' : ''}`}
            </Button>
          </div>

          {/* Overlay de loading durante creación */}
          {creating && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <Card className="w-[400px]">
                <CardContent className="pt-6 flex flex-col items-center gap-3 text-center">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="font-medium">Creando clientes...</p>
                  <p className="text-sm text-muted-foreground">
                    Procesando {preview.summary.new} registro{preview.summary.new !== 1 ? 's' : ''}. Por favor espera, no cierres esta ventana.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Resultado de la creación */}
          {createResult && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Resultado de la importación
                </CardTitle>
                <CardDescription>
                  {createResult.stats.creados} cliente(s) creado(s) ·{' '}
                  {createResult.stats.omitidos} omitido(s) por duplicado ·{' '}
                  {createResult.stats.fallidos} con error
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">#</TableHead>
                      <TableHead>Cédula</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead className="text-center">Estado</TableHead>
                      <TableHead>Detalle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {createResult.results.map((r) => (
                      <TableRow key={r.index}>
                        <TableCell className="text-xs text-muted-foreground">{r.index + 1}</TableCell>
                        <TableCell className="font-mono text-xs">{r.cedula || '—'}</TableCell>
                        <TableCell className="text-xs">{r.nombre || '—'}</TableCell>
                        <TableCell className="text-center">
                          {r.success
                            ? <Badge className="text-xs bg-green-100 text-green-800 border-green-300 hover:bg-green-100">Creado</Badge>
                            : r.omitido
                              ? <Badge variant="outline" className="text-xs">Omitido</Badge>
                              : <Badge variant="destructive" className="text-xs">Falló</Badge>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.error || (r.success ? `Cliente #${r.id}` : '')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Modal de detalle */}
      <Dialog open={!!detailRecord} onOpenChange={() => setDetailRecord(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle del registro</DialogTitle>
            <DialogDescription>
              {detailRecord?.source_file}
              {detailRecord?.row_number && detailRecord.row_number > 1 && ` · Fila ${detailRecord.row_number}`}
            </DialogDescription>
          </DialogHeader>

          {detailRecord && (
            <div className="space-y-4">
              {/* Alerta */}
              {detailRecord.error ? (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Error al leer el archivo</AlertTitle>
                  <AlertDescription>{detailRecord.error}</AlertDescription>
                </Alert>
              ) : detailRecord.already_exists && detailRecord.existing ? (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Ya existe una persona con esta cédula</AlertTitle>
                  <AlertDescription className="text-sm space-y-1 mt-2">
                    <div><strong>Cédula:</strong> {detailRecord.existing.cedula}</div>
                    <div><strong>Nombre:</strong> {detailRecord.existing.nombre_completo}</div>
                    <div><strong>Tipo:</strong> {detailRecord.existing.tipo}</div>
                    {detailRecord.existing.email && <div><strong>Email:</strong> {detailRecord.existing.email}</div>}
                    {detailRecord.existing.phone && <div><strong>Teléfono:</strong> {detailRecord.existing.phone}</div>}
                  </AlertDescription>
                </Alert>
              ) : detailRecord.extracted.cedula ? (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Cédula disponible</AlertTitle>
                  <AlertDescription>
                    No se encontró ninguna persona con la cédula <strong>{detailRecord.extracted.cedula}</strong>.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>No se detectó cédula</AlertTitle>
                  <AlertDescription>El archivo no contiene un campo de cédula reconocible.</AlertDescription>
                </Alert>
              )}

              {/* Encontrados / faltantes */}
              {!detailRecord.error && (
                <div className="grid md:grid-cols-2 gap-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Encontrados
                        <Badge variant="secondary">{detailRecord.filled_count}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {detailRecord.filled.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">Sin datos</p>
                      ) : (
                        <div className="space-y-2">
                          {detailRecord.filled.map(f => (
                            <div key={f.field} className="flex justify-between text-sm border-b pb-2 last:border-0 last:pb-0 gap-3">
                              <span className="text-muted-foreground">{f.label}</span>
                              <span className="font-medium text-right max-w-[60%] break-words">{f.value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        Faltantes
                        <Badge variant="secondary">{detailRecord.missing_count}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {detailRecord.missing.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">Todos los campos están completos</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {detailRecord.missing.map(f => (
                            <Badge key={f.field} variant="outline" className="text-xs">{f.label}</Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function RecordStatusBadge({ record }: { record: RecordPreview }) {
  if (record.error) {
    return <Badge variant="destructive" className="text-xs">Error</Badge>;
  }
  if (record.already_exists) {
    return <Badge variant="destructive" className="text-xs">Ya existe</Badge>;
  }
  if (!record.extracted.cedula) {
    return <Badge variant="outline" className="text-xs border-amber-500 text-amber-700">Sin cédula</Badge>;
  }
  return <Badge className="text-xs bg-green-100 text-green-800 border-green-300 hover:bg-green-100">Nuevo</Badge>;
}

// ---------------------------------------------------------------------------
// Tab: Créditos
// ---------------------------------------------------------------------------
interface CreditoCliente {
  id: number;
  cedula: string;
  nombre_completo: string;
  person_type_id: number;
  tipo: 'Cliente' | 'Lead';
  is_active: boolean;
}

interface CreditoExistente {
  id: number;
  numero_operacion: string;
  monto_credito: number;
  fecha_formalizacion: string | null;
}

interface PagoPreview {
  cedula: string | null;
  numero_operacion: string | null;
  fecha_pago: string | null;
  monto_total: number | null;
  capital: number;
  interes_corriente: number;
  interes_moratorio: number;
  otros: number;
  tipo_pago: string;
  numero_cuota: number | null;
  referencia_pago: string | null;
  nota: string | null;
  row_number: number | null;
}

interface CreditoRecord {
  source_file: string;
  row_number: number | null;
  extracted: {
    cedula: string | null;
    numero_operacion: string | null;
    monto_credito: number | null;
    plazo_meses: number | null;
    tasa_anual: number | null;
    cuota: number | null;
    fecha_formalizacion: string | null;
    deductora_nombre: string | null;
    divisa: string | null;
    categoria: string | null;
    descripcion: string | null;
  };
  cliente: CreditoCliente | null;
  cliente_existe: boolean;
  credito_ya_existe: boolean;
  credito_existente: CreditoExistente | null;
  pagos: PagoPreview[];
  pagos_count: number;
  pagos_duplicados: string[];
  pagos_a_importar: number;
  pago_errors: Record<number, string[]>;
  errors: string[];
  ready_to_import: boolean;
}

interface CreditoPreviewResponse {
  success: boolean;
  summary: {
    total: number;
    ready: number;
    cliente_faltante: number;
    credito_existente: number;
    con_errores: number;
    pagos_total: number;
    pagos_duplicados: number;
    pagos_a_importar: number;
    file_errors: number;
  };
  creditos: CreditoRecord[];
  file_errors: Array<{ file: string; error: string }>;
}

interface CreateResult {
  index: number;
  cedula: string | null;
  success: boolean;
  credit_id?: number;
  numero_operacion?: string;
  pagos_creados?: number;
  pagos_saltados?: number;
  accounting?: Array<{ type: string; success: boolean; reference: string; error?: string | null }>;
  error?: string;
}

interface CreateResponse {
  success: boolean;
  stats: { creados: number; fallidos: number; pagos_creados: number; pagos_saltados: number };
  results: CreateResult[];
}

function ImportarCreditosTab({ hasPermission, toast }: { hasPermission: HasPermissionFn; toast: ToastFn }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [preview, setPreview] = useState<CreditoPreviewResponse | null>(null);
  const [detailCredito, setDetailCredito] = useState<CreditoRecord | null>(null);
  const [createResult, setCreateResult] = useState<CreateResponse | null>(null);

  const canCreate = hasPermission('importacion', 'create');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;
    setFiles(selected);
    setPreview(null);
  };

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    const formData = new FormData();
    files.forEach(f => formData.append('files[]', f));
    try {
      setUploading(true);
      setPreview(null);
      const res = await api.post<CreditoPreviewResponse>('/api/importacion/preview-creditos', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreview(res.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || 'No se pudo procesar los archivos.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setFiles([]);
    setPreview(null);
    setCreateResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreate = async () => {
    if (!preview) return;
    const payload = {
      creditos: preview.creditos
        .filter(c => c.ready_to_import)
        .map(c => ({
          credito: c.extracted,
          pagos: c.pagos,
        })),
    };
    if (payload.creditos.length === 0) {
      toast({ title: 'Sin créditos listos', description: 'No hay créditos válidos para crear.' });
      return;
    }
    try {
      setCreating(true);
      const res = await api.post<CreateResponse>('/api/importacion/crear-creditos', payload);
      setCreateResult(res.data);
      toast({
        title: 'Importación completada',
        description: `${res.data.stats.creados} crédito(s) creado(s), ${res.data.stats.pagos_creados} pago(s) registrado(s).`,
      });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || 'No se pudo crear los créditos.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const fmtMoney = (v: number | null) => v === null
    ? '—'
    : new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', minimumFractionDigits: 2 }).format(v);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Subir archivos
          </CardTitle>
          <CardDescription>
            Excel con 2 hojas: <strong>Creditos</strong> (1 fila = 1 crédito) y <strong>Pagos</strong> (N filas = pagos vinculados por cédula o número de operación). Máx. 20 MB por archivo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileSelect}
            disabled={uploading}
          />

          {files.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-10 text-center">
              <FileText className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-4">Aún no has seleccionado archivos</p>
              <Button size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Seleccionar archivos
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {files.map((f, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-md border p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{f.name}</p>
                        <p className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeFile(idx)} disabled={uploading}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  <Upload className="h-4 w-4 mr-2" />
                  Agregar más
                </Button>
                <Button size="sm" onClick={handleUpload} disabled={uploading || files.length === 0}>
                  {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
                  {uploading ? 'Procesando...' : `Previsualizar (${files.length})`}
                </Button>
                {preview && (
                  <Button variant="ghost" size="sm" onClick={handleReset}>Limpiar</Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Errores de lectura de archivo */}
      {preview && preview.file_errors.length > 0 && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Algunos archivos no pudieron leerse</AlertTitle>
          <AlertDescription className="text-sm space-y-1 mt-2">
            {preview.file_errors.map((e, i) => (
              <div key={i}><strong>{e.file}:</strong> {e.error}</div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {preview && preview.creditos.length > 0 && (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Créditos detectados</p>
                <p className="text-2xl font-bold">{preview.summary.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Listos para crear</p>
                <p className="text-2xl font-bold text-green-600">{preview.summary.ready}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Sin cliente</p>
                <p className="text-2xl font-bold text-red-600">{preview.summary.cliente_faltante}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Pagos a importar</p>
                <p className="text-2xl font-bold text-blue-600">
                  {preview.summary.pagos_a_importar} <span className="text-xs text-muted-foreground">/ {preview.summary.pagos_total}</span>
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabla de créditos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Créditos detectados</CardTitle>
              <CardDescription>Haz clic en cualquier fila para ver el detalle de pagos vinculados.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">#</TableHead>
                    <TableHead>Cédula</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Op.</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-center">Plazo</TableHead>
                    <TableHead className="text-right">Cuota</TableHead>
                    <TableHead>Fecha form.</TableHead>
                    <TableHead className="text-center">Pagos</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-right">Acc.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.creditos.map((c, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {c.extracted.cedula || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-xs">
                        {c.cliente
                          ? <span className="font-medium">{c.cliente.nombre_completo}</span>
                          : <span className="text-red-600">No existe</span>}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {c.extracted.numero_operacion || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {fmtMoney(c.extracted.monto_credito)}
                      </TableCell>
                      <TableCell className="text-center text-xs">{c.extracted.plazo_meses ?? '—'}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {fmtMoney(c.extracted.cuota)}
                      </TableCell>
                      <TableCell className="text-xs">{c.extracted.fecha_formalizacion || '—'}</TableCell>
                      <TableCell className="text-center text-xs">
                        <span className="font-medium">{c.pagos_a_importar}</span>
                        <span className="text-muted-foreground"> / {c.pagos_count}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <CreditoStatusBadge credito={c} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setDetailCredito(c)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleReset} disabled={creating}>Cancelar</Button>
            <Button
              disabled={!canCreate || preview.summary.ready === 0 || creating}
              onClick={handleCreate}
              title={
                !canCreate ? 'No tienes permiso para crear créditos' :
                preview.summary.ready === 0 ? 'No hay créditos listos para crear' : ''
              }
            >
              {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Crear {preview.summary.ready} crédito{preview.summary.ready !== 1 ? 's' : ''}
            </Button>
          </div>

          {/* Overlay de loading durante creación */}
          {creating && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <Card className="w-[420px]">
                <CardContent className="pt-6 flex flex-col items-center gap-3 text-center">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="font-medium">Creando créditos...</p>
                  <p className="text-sm text-muted-foreground">
                    Procesando {preview.summary.ready} crédito{preview.summary.ready !== 1 ? 's' : ''} con sus pagos y asientos contables. Esto puede tomar varios segundos.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Resultado de la creación */}
          {createResult && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Resultado de la importación
                </CardTitle>
                <CardDescription>
                  {createResult.stats.creados} crédito(s) creado(s) ·{' '}
                  {createResult.stats.fallidos} fallido(s) ·{' '}
                  {createResult.stats.pagos_creados} pago(s) registrado(s) ·{' '}
                  {createResult.stats.pagos_saltados} pago(s) duplicado(s) saltado(s)
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">#</TableHead>
                      <TableHead>Cédula</TableHead>
                      <TableHead>Nº Operación</TableHead>
                      <TableHead className="text-center">Estado</TableHead>
                      <TableHead className="text-center">Pagos creados</TableHead>
                      <TableHead className="text-center">Asientos</TableHead>
                      <TableHead>Detalle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {createResult.results.map((r) => {
                      const asientosOk = r.accounting?.filter(a => a.success).length ?? 0;
                      const asientosFail = r.accounting?.filter(a => !a.success).length ?? 0;
                      return (
                        <TableRow key={r.index}>
                          <TableCell className="text-xs text-muted-foreground">{r.index + 1}</TableCell>
                          <TableCell className="font-mono text-xs">{r.cedula}</TableCell>
                          <TableCell className="font-mono text-xs">{r.numero_operacion || '—'}</TableCell>
                          <TableCell className="text-center">
                            {r.success
                              ? <Badge className="text-xs bg-green-100 text-green-800 border-green-300 hover:bg-green-100">Creado</Badge>
                              : <Badge variant="destructive" className="text-xs">Falló</Badge>}
                          </TableCell>
                          <TableCell className="text-center text-xs">
                            {r.success ? `${r.pagos_creados ?? 0}${r.pagos_saltados ? ` (${r.pagos_saltados} dup)` : ''}` : '—'}
                          </TableCell>
                          <TableCell className="text-center text-xs">
                            <span className="text-green-600">{asientosOk}</span>
                            {asientosFail > 0 && (
                              <> / <span className="text-red-600">{asientosFail} con error</span></>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {r.error || (r.success ? `Crédito #${r.credit_id}` : '')}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Modal de detalle */}
      <Dialog open={!!detailCredito} onOpenChange={() => setDetailCredito(null)}>
        <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle del crédito</DialogTitle>
            <DialogDescription>
              {detailCredito?.source_file}
              {detailCredito?.row_number && ` · Fila ${detailCredito.row_number}`}
            </DialogDescription>
          </DialogHeader>

          {detailCredito && (
            <div className="space-y-4">
              {/* Estado */}
              {detailCredito.errors.length > 0 && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>No se puede importar</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside text-sm mt-1">
                      {detailCredito.errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Info del cliente */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Cliente</CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  {detailCredito.cliente ? (
                    <div className="space-y-1">
                      <div><strong>Cédula:</strong> {detailCredito.cliente.cedula}</div>
                      <div><strong>Nombre:</strong> {detailCredito.cliente.nombre_completo}</div>
                      <div><strong>Tipo:</strong> {detailCredito.cliente.tipo}</div>
                    </div>
                  ) : (
                    <div className="text-red-600">
                      No existe ningún cliente con cédula <strong>{detailCredito.extracted.cedula}</strong>.
                      Créalo primero en CRM o usa el tab de "Clientes" para importarlo.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Datos del crédito */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Datos del crédito</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <Detail label="Número de operación" value={detailCredito.extracted.numero_operacion} />
                  <Detail label="Monto" value={fmtMoney(detailCredito.extracted.monto_credito)} />
                  <Detail label="Plazo (meses)" value={detailCredito.extracted.plazo_meses?.toString()} />
                  <Detail label="Tasa anual" value={detailCredito.extracted.tasa_anual ? `${detailCredito.extracted.tasa_anual}%` : null} />
                  <Detail label="Cuota" value={fmtMoney(detailCredito.extracted.cuota)} />
                  <Detail label="Fecha formalización" value={detailCredito.extracted.fecha_formalizacion} />
                  <Detail label="Deductora" value={detailCredito.extracted.deductora_nombre} />
                  <Detail label="Divisa" value={detailCredito.extracted.divisa} />
                </CardContent>
              </Card>

              {/* Pagos */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    Historial de pagos
                    <Badge variant="secondary">{detailCredito.pagos_count}</Badge>
                    {detailCredito.pagos_duplicados.length > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {detailCredito.pagos_duplicados.length} duplicado{detailCredito.pagos_duplicados.length !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {detailCredito.pagos.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Sin pagos vinculados</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Fecha</TableHead>
                          <TableHead className="text-xs">Tipo</TableHead>
                          <TableHead className="text-xs text-right">Total</TableHead>
                          <TableHead className="text-xs text-right">Capital</TableHead>
                          <TableHead className="text-xs text-right">Interés</TableHead>
                          <TableHead className="text-xs text-right">Mora</TableHead>
                          <TableHead className="text-xs">Ref.</TableHead>
                          <TableHead className="text-xs text-center">Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailCredito.pagos.map((p, i) => {
                          const isDup = p.referencia_pago && detailCredito.pagos_duplicados.includes(p.referencia_pago);
                          return (
                            <TableRow key={i}>
                              <TableCell className="text-xs">{p.fecha_pago}</TableCell>
                              <TableCell className="text-xs">{p.tipo_pago}</TableCell>
                              <TableCell className="text-xs text-right font-mono">{fmtMoney(p.monto_total)}</TableCell>
                              <TableCell className="text-xs text-right font-mono">{fmtMoney(p.capital)}</TableCell>
                              <TableCell className="text-xs text-right font-mono">{fmtMoney(p.interes_corriente)}</TableCell>
                              <TableCell className="text-xs text-right font-mono">{fmtMoney(p.interes_moratorio)}</TableCell>
                              <TableCell className="text-xs font-mono">{p.referencia_pago || '—'}</TableCell>
                              <TableCell className="text-xs text-center">
                                {isDup
                                  ? <Badge variant="destructive" className="text-xs">Duplicado</Badge>
                                  : <Badge className="text-xs bg-green-100 text-green-800 border-green-300 hover:bg-green-100">Nuevo</Badge>}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function CreditoStatusBadge({ credito }: { credito: CreditoRecord }) {
  if (credito.errors.length > 0) {
    if (!credito.cliente_existe) {
      return <Badge variant="destructive" className="text-xs">Sin cliente</Badge>;
    }
    if (credito.credito_ya_existe) {
      return <Badge variant="destructive" className="text-xs">Ya existe</Badge>;
    }
    return <Badge variant="outline" className="text-xs border-amber-500 text-amber-700">Errores</Badge>;
  }
  return <Badge className="text-xs bg-green-100 text-green-800 border-green-300 hover:bg-green-100">Listo</Badge>;
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value || '—'}</p>
    </div>
  );
}
