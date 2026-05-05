'use client';

import { useState } from 'react';
import { Shield, FileText, CheckCircle, AlertTriangle, Loader2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/axios';
import { AnalisisFile } from '@/lib/analisis';

interface CertificarConstanciaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analisisId: number;
  archivos: AnalisisFile[];
  onCertificado: () => void;
}

type Step = 'seleccion' | 'metodo' | 'verificando' | 'resultado_auto' | 'manual' | 'exito';

export function CertificarConstanciaModal({
  open,
  onOpenChange,
  analisisId,
  archivos,
  onCertificado,
}: CertificarConstanciaModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('seleccion');
  const [archivoSeleccionado, setArchivoSeleccionado] = useState<string | null>(null);
  const [resultadoBccr, setResultadoBccr] = useState<Record<string, unknown> | null>(null);
  const [bccrError, setBccrError] = useState<string | null>(null);
  const [notasManual, setNotasManual] = useState('');
  const [guardando, setGuardando] = useState(false);

  const ALLOWED_EXT = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif'];
  const pdfArchivos = archivos.filter(f =>
    ALLOWED_EXT.some(ext => f.name.toLowerCase().endsWith(ext))
  );

  const resetModal = () => {
    setStep('seleccion');
    setArchivoSeleccionado(null);
    setResultadoBccr(null);
    setBccrError(null);
    setNotasManual('');
    setGuardando(false);
  };

  const handleClose = (open: boolean) => {
    if (!open) resetModal();
    onOpenChange(open);
  };

  const handleSeleccionar = (nombre: string) => {
    setArchivoSeleccionado(nombre);
    setStep('metodo');
  };

  const handleVerificacionAutomatica = async () => {
    if (!archivoSeleccionado) return;
    setStep('verificando');
    setBccrError(null);

    try {
      const res = await api.post(`/api/analisis/${analisisId}/verificar-constancia`, {
        archivo: archivoSeleccionado,
      });
      setResultadoBccr(res.data.resultado as Record<string, unknown>);
      setStep('resultado_auto');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'No se pudo conectar con el servicio BCCR.';
      setBccrError(msg);
      setStep('resultado_auto');
    }
  };

  const handleCertificar = async (metodo: 'automatico' | 'manual') => {
    if (!archivoSeleccionado) return;
    setGuardando(true);
    try {
      await api.post(`/api/analisis/${analisisId}/certificar`, {
        metodo,
        archivo: archivoSeleccionado,
        notas: notasManual || null,
        resultado_bccr: resultadoBccr ?? null,
      });
      setStep('exito');
      onCertificado();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error al certificar',
        description: err?.response?.data?.message || 'Ocurrió un error inesperado.',
      });
    } finally {
      setGuardando(false);
    }
  };

  const stripHtml = (html: string): string =>
    html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  const renderBccrResultado = () => {
    if (!resultadoBccr) return null;
    const r = resultadoBccr as any;

    const fueExitosa: boolean = r.fueExitosa ?? r.FueExitosa;
    const firmas: any[] = r.firmas ?? r.Firmas ?? [];
    const detalleDocHtml: string = r.detalleDelDocumento ?? '';
    const errorMsg: string | null = r.mensajeDeError ?? null;

    // Formato y tamaño del documento
    const docPairs: { key: string; value: string }[] = [];
    [...detalleDocHtml.matchAll(/<strong>([^<]+):<\/strong>\s*([^<]+)/g)]
      .forEach(m => docPairs.push({ key: m[1].trim(), value: m[2].trim() }));

    return (
      <div className="space-y-4 text-sm">
        {/* Badge resultado global */}
        <div className={`flex items-center gap-2 rounded-lg px-4 py-3 font-medium border ${
          fueExitosa
            ? 'bg-green-50 text-green-800 border-green-200'
            : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          {fueExitosa
            ? <CheckCircle className="h-5 w-5 shrink-0" />
            : <AlertTriangle className="h-5 w-5 shrink-0" />}
          <span>{fueExitosa ? 'Documento válido — firma digital verificada' : 'Documento no válido'}</span>
        </div>

        {errorMsg && <p className="text-xs text-red-600">{errorMsg}</p>}

        {/* Info del documento */}
        {docPairs.length > 0 && (
          <div className="flex flex-wrap gap-4 rounded-md bg-slate-50 px-3 py-2 text-xs">
            {docPairs.map(p => (
              <span key={p.key}>
                <span className="font-medium text-foreground">{p.key}:</span>{' '}
                <span className="text-muted-foreground">{p.value}</span>
              </span>
            ))}
          </div>
        )}

        {/* Firmantes */}
        {firmas.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Firmante{firmas.length > 1 ? 's' : ''} ({firmas.length})
            </p>
            {firmas.map((f: any, i: number) => {
              // Autoría
              const autoriaHtml: string = f.autoriaDelFirmante ?? '';
              const camposAutoria: Record<string, string> = {};
              [...autoriaHtml.matchAll(/<p[^>]*>([^<]+)<\/p>/g)].forEach(m => {
                const [k, ...v] = m[1].split(':');
                if (v.length) camposAutoria[k.trim()] = v.join(':').trim();
              });
              const nombre = camposAutoria['Nombre'] ?? '';
              const cedula = camposAutoria['Identificación'];

              // Fecha de validez
              const resultadoHtml: string = f.resultadoDeFirma ?? '';
              const fechaMatch = resultadoHtml.match(/La firma es válida[^<]*/i);
              const validezTexto = fechaMatch?.[0]?.trim() ?? '';

              // Garantías del resumen
              const resumenHtml: string = f.resumen ?? '';
              const garantias: string[] = [...resumenHtml.matchAll(/<strong>([^<]+)<\/strong>/g)]
                .map(m => m[1].trim());

              // Detalles técnicos
              const detalleHtml: string = f.detalle ?? '';
              const detalles: { titulo: string; descripcion: string }[] = [];
              [...detalleHtml.matchAll(/<strong>([^<]+?):<\/strong>\s*(.*?)(?=<\/p>)/g)].forEach(m => {
                detalles.push({ titulo: m[1].trim(), descripcion: stripHtml(m[2]).trim() });
              });
              // Fecha estampa de tiempo
              const estampaMatch = detalleHtml.match(/Fecha de la estampa de tiempo:<\/strong>\s*([^<]+)/);
              const fechaEstampa = estampaMatch?.[1]?.trim();

              const valido = !f.ocurrioUnError;

              return (
                <div key={i} className="rounded-lg border overflow-hidden">
                  {/* Cabecera firmante */}
                  <div className={`flex items-start gap-3 px-4 py-3 ${valido ? 'bg-green-50' : 'bg-red-50'}`}>
                    {valido
                      ? <CheckCircle className="h-5 w-5 shrink-0 mt-0.5 text-green-600" />
                      : <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-red-500" />}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{nombre || `Firmante ${i + 1}`}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                        {cedula && <span>Cédula: {cedula}</span>}
                        {validezTexto && <span>{validezTexto}</span>}
                        {fechaEstampa && <span>Fecha oficial: {fechaEstampa}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Garantías */}
                  {garantias.length > 0 && (
                    <div className="px-4 py-2.5 border-t bg-white">
                      <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">Garantías</p>
                      <div className="space-y-1">
                        {garantias.map((g, gi) => (
                          <div key={gi} className="flex items-center gap-2 text-xs text-green-700">
                            <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                            {g}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Detalles técnicos (colapsable) */}
                  {detalles.length > 0 && (
                    <details className="border-t">
                      <summary className="cursor-pointer px-4 py-2 text-xs text-muted-foreground hover:bg-slate-50 select-none">
                        Ver detalles técnicos ({detalles.length} verificaciones)
                      </summary>
                      <div className="px-4 pb-3 pt-1 space-y-1.5 bg-slate-50/50">
                        {detalles.map((d, di) => (
                          <div key={di} className="flex items-start gap-2 text-xs">
                            <CheckCircle className="h-3 w-3 shrink-0 mt-0.5 text-green-600" />
                            <span>
                              <span className="font-medium">{d.titulo}:</span>{' '}
                              <span className="text-muted-foreground">{d.descripcion}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}

                  {f.mensajeDeErrorAlValidar && (
                    <p className="px-4 py-2 text-xs text-red-600 border-t">{f.mensajeDeErrorAlValidar}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Certificar Constancia
          </DialogTitle>
          <DialogDescription>
            Verifique la autenticidad de la constancia de trabajo antes de generar el crédito.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 pr-1">

        {/* PASO 1: Seleccionar archivo */}
        {step === 'seleccion' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Seleccione cuál de los archivos PDF del análisis es la constancia de trabajo:
            </p>
            {pdfArchivos.length === 0 ? (
              <div className="flex items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                No hay archivos PDF adjuntos a este análisis. Suba la constancia primero.
              </div>
            ) : (
              <div className="space-y-2">
                {pdfArchivos.map(f => (
                  <button
                    key={f.name}
                    onClick={() => handleSeleccionar(f.name)}
                    className="flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm hover:border-blue-500 hover:bg-blue-50 transition-colors"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{f.name}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PASO 2: Elegir método */}
        {step === 'metodo' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Archivo seleccionado:{' '}
              <span className="font-medium text-foreground">{archivoSeleccionado}</span>
            </p>
            <p className="text-sm font-medium">¿Cómo desea verificar la constancia?</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={handleVerificacionAutomatica}
                className="flex flex-col items-start gap-1 rounded-lg border p-4 text-left hover:border-blue-500 hover:bg-blue-50 transition-colors"
              >
                <div className="flex items-center gap-2 font-medium text-sm">
                  <Shield className="h-4 w-4 text-blue-600" />
                  Automático (BCCR)
                </div>
                <p className="text-xs text-muted-foreground">
                  Valida la firma digital con el servicio del Banco Central de Costa Rica.
                </p>
              </button>
              <button
                onClick={() => setStep('manual')}
                className="flex flex-col items-start gap-1 rounded-lg border p-4 text-left hover:border-slate-400 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2 font-medium text-sm">
                  <FileText className="h-4 w-4 text-slate-600" />
                  Manual
                </div>
                <p className="text-xs text-muted-foreground">
                  Verifique la constancia manualmente y agregue notas de respaldo.
                </p>
              </button>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setStep('seleccion')}>
              ← Cambiar archivo
            </Button>
          </div>
        )}

        {/* PASO 3: Verificando con BCCR */}
        {step === 'verificando' && (
          <div className="flex flex-col items-center gap-4 py-6">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-sm text-muted-foreground">Consultando al Banco Central de Costa Rica…</p>
          </div>
        )}

        {/* PASO 4: Resultado automático */}
        {step === 'resultado_auto' && (
          <div className="space-y-4">
            {bccrError ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4" />
                  Error al consultar BCCR
                </div>
                <p className="text-xs">{bccrError}</p>
                <p className="text-xs">Puede continuar con verificación manual.</p>
              </div>
            ) : (
              <div className="rounded-md border p-3">
                {renderBccrResultado()}
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              {!bccrError && (
                <Button onClick={() => handleCertificar('automatico')} disabled={guardando}>
                  {guardando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Certificar con resultado BCCR
                </Button>
              )}
              <Button variant="outline" onClick={() => setStep('manual')}>
                Continuar con verificación manual
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setStep('metodo')}>
                ← Volver
              </Button>
            </div>
          </div>
        )}

        {/* PASO 5: Manual */}
        {step === 'manual' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Archivo: <span className="font-medium text-foreground">{archivoSeleccionado}</span>
            </p>
            <div className="space-y-2">
              <Label htmlFor="notas-manual">Notas de verificación</Label>
              <Textarea
                id="notas-manual"
                placeholder="Describa cómo verificó la constancia (sellos, firmas, fuente, fecha, etc.)"
                rows={4}
                value={notasManual}
                onChange={e => setNotasManual(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Estas notas quedan registradas como respaldo de la certificación manual.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <Button
                onClick={() => handleCertificar('manual')}
                disabled={guardando || !notasManual.trim()}
              >
                {guardando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <CheckCircle className="h-4 w-4 mr-1" />
                Certificar manualmente
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setStep('metodo')}>
                ← Volver
              </Button>
            </div>
          </div>
        )}

        {/* PASO 6: Éxito */}
        {step === 'exito' && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <CheckCircle className="h-12 w-12 text-green-600" />
            <div>
              <p className="font-semibold text-lg">Constancia certificada</p>
              <p className="text-sm text-muted-foreground mt-1">
                La constancia ha sido verificada y registrada. Ya puede generar el crédito.
              </p>
            </div>
            <Button onClick={() => handleClose(false)}>Cerrar</Button>
          </div>
        )}

        </div>{/* fin scroll wrapper */}
      </DialogContent>
    </Dialog>
  );
}
