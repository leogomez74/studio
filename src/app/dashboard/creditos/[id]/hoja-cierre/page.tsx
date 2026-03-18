"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import api from "@/lib/axios";
import { useToast } from "@/hooks/use-toast";

interface CargosAdicionales {
  comision?: number;
  transporte?: number;
  respaldo_deudor?: number;
  cancelacion_manchas?: number;
  descuento_factura?: number;
  [key: string]: number | undefined;
}

interface CreditData {
  id: number;
  numero_operacion?: string;
  reference?: string;
  monto_credito?: number;
  cargos_adicionales?: CargosAdicionales | null;
  lead?: { name?: string; apellido1?: string; cedula?: string; };
}

const fmt = (v?: number | null) =>
  new Intl.NumberFormat('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v ?? 0);

const fmtDate = () => new Date().toLocaleDateString('es-CR');

const BLUE = '#12368c';
const F = 'Helvetica, Arial, sans-serif';

export default function HojaCierrePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [credit, setCredit] = useState<CreditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [bgBase64, setBgBase64] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get(`/api/credits/${params.id}`)
      .then(r => setCredit(r.data))
      .catch(() => toast({ title: "Error", description: "No se pudo cargar el crédito", variant: "destructive" }))
      .finally(() => setLoading(false));

    fetch('/pdf_background_hoja_cierre.jpg')
      .then(r => r.blob())
      .then(blob => {
        const reader = new FileReader();
        reader.onloadend = () => setBgBase64(reader.result as string);
        reader.readAsDataURL(blob);
      }).catch(() => {});
  }, [params.id, toast]);

  const handlePrint = async () => {
    if (!ref.current) return;
    setPrinting(true);
    try {
      const canvas = await html2canvas(ref.current, { scale: 2, useCORS: true, logging: false, allowTaint: true });
      const pdf = new jsPDF('p', 'mm', 'a4');
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, (canvas.height * 210) / canvas.width);
      pdf.save(`hoja-cierre-${credit?.reference || params.id}.pdf`);
      toast({ title: "PDF generado", description: "Descargado correctamente" });
    } catch {
      toast({ title: "Error", description: "No se pudo generar el PDF", variant: "destructive" });
    } finally {
      setPrinting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" /></div>;
  if (!credit) return <div className="flex items-center justify-center min-h-screen"><p>No se encontró el crédito</p></div>;

  const montoAprobado = credit.monto_credito ?? 0;
  const ca = credit.cargos_adicionales ?? {};
  const comision = ca.comision ?? 0;
  const transporte = ca.transporte ?? 0;
  const respaldo = ca.respaldo_deudor ?? 0;
  const manchas = ca.cancelacion_manchas ?? 0;
  const descuento = ca.descuento_factura ?? 0;
  const totalCargos = comision + transporte + respaldo + manchas + descuento;
  const montoNeto = montoAprobado - totalCargos;
  const clientName = credit.lead ? `${credit.lead.name ?? ''} ${credit.lead.apellido1 ?? ''}`.trim() : 'N/A';

  const cargos = [
    { label: 'Comisión', value: comision },
    { label: 'Transporte', value: transporte },
    { label: 'Respaldo Deudor', value: respaldo },
    { label: 'Cancelación de Manchas', value: manchas },
    { label: 'Descuento Factura', value: descuento },
  ].filter(c => c.value > 0);

  // Shared styles
  const base: React.CSSProperties = { fontFamily: F, color: BLUE };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      {/* Toolbar */}
      <div style={{ maxWidth: '210mm', margin: '0 auto 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Button variant="outline" onClick={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" />Volver</Button>
          <h1 style={{ fontSize: '18px', fontWeight: 'bold' }}>Vista previa de Hoja de Cierre</h1>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button onClick={handlePrint} disabled={printing}><Printer className="mr-2 h-4 w-4" />{printing ? 'Generando...' : 'Imprimir'}</Button>
          <Button onClick={() => router.push(`/dashboard/creditos/${params.id}`)}>Continuar<ArrowRight className="ml-2 h-4 w-4" /></Button>
        </div>
      </div>

      {/* Documento */}
      <div ref={ref} style={{ width: '210mm', height: '297mm', margin: '0 auto', position: 'relative', backgroundColor: '#fff', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}>

        {/* Background */}
        {bgBase64 && <img src={bgBase64} alt="" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }} />}

        <div style={{ position: 'relative', zIndex: 1, padding: '40mm 17mm 10mm' }}>

          {/* TÍTULO */}
          <div style={{ textAlign: 'center', marginBottom: '5mm' }}>
            <div style={{ ...base, fontSize: '19px', fontWeight: 'bold', textDecoration: 'underline', letterSpacing: '0.5px' }}>HOJA DE CIERRE</div>
          </div>

          {/* INFO BLOCK */}
          <div style={{ ...base, fontSize: '9px', lineHeight: '1.6', marginBottom: '5mm', fontWeight: 'bold' }}>
            <div>Fecha de Emisión: {fmtDate()}</div>
            <div>Nombre del Cliente: {clientName}</div>
            <div>Cédula: {credit.lead?.cedula ?? 'N/A'}</div>
            <div>ID del Crédito/Referencia: {credit.reference ?? credit.numero_operacion ?? 'N/A'}</div>
          </div>

          {/* RESUMEN DE APROBACIÓN */}
          <div style={{ backgroundColor: '#dce8f7', border: '1px solid #b8d0ef', marginBottom: '5mm' }}>
            <div style={{ ...base, fontSize: '11px', fontWeight: 'bold', padding: '5px 10px', borderBottom: '1px solid #b8d0ef' }}>
              RESUMEN DE APROBACIÓN
            </div>
            <div style={{ padding: '8px 10px', display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', gap: '6px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ ...base, fontSize: '18px', fontWeight: 'bold' }}>₡{fmt(montoAprobado)}</div>
                <div style={{ ...base, fontSize: '7.5px', opacity: 0.8 }}>Monto Total Aprobado</div>
              </div>
            </div>
          </div>

          {/* CARGOS ADICIONALES */}
          <div style={{ marginBottom: '5mm' }}>
            <div style={{ ...base, fontSize: '11px', fontWeight: 'bold', marginBottom: '3px' }}>CARGOS ADICIONALES</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: F }}>
              <thead>
                <tr>
                  <th style={{ ...base, backgroundColor: '#c4d6ee', textAlign: 'left', padding: '4px 8px', fontSize: '9px', fontWeight: 'normal', border: '1px solid #aac0de' }}>Descripción del Concepto</th>
                  <th style={{ ...base, backgroundColor: '#c4d6ee', textAlign: 'right', padding: '4px 8px', fontSize: '9px', fontWeight: 'bold', border: '1px solid #aac0de' }}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {cargos.map(c => (
                  <tr key={c.label}>
                    <td style={{ ...base, padding: '3px 8px', fontSize: '9px', border: '1px solid #ccc' }}>{c.label}</td>
                    <td style={{ ...base, textAlign: 'right', padding: '3px 8px', fontSize: '9px', border: '1px solid #ccc' }}>₡{fmt(c.value)}</td>
                  </tr>
                ))}
                {/* TOTAL CARGOS — fondo olive/verde */}
                <tr>
                  <td style={{ ...base, backgroundColor: '#c8d87a', padding: '4px 8px', fontSize: '10px', fontWeight: 'bold', border: '1px solid #b0be5c' }}>TOTAL CARGOS:</td>
                  <td style={{ ...base, backgroundColor: '#c8d87a', textAlign: 'right', padding: '4px 8px', fontSize: '10px', fontWeight: 'bold', border: '1px solid #b0be5c' }}>(₡{fmt(totalCargos)})</td>
                </tr>
              </tbody>
            </table>
            {cargos.length === 0 && (
              <div style={{ ...base, fontSize: '9px', textAlign: 'center', padding: '6px', opacity: 0.8 }}>
                No hay cargos adicionales registrados para este crédito
              </div>
            )}
          </div>

          {/* DESEMBOLSO FINAL */}
          <div style={{ marginBottom: '6mm', border: `1px solid ${BLUE}` }}>
            {/* Header oscuro */}
            <div style={{ backgroundColor: BLUE, padding: '5px 10px', textAlign: 'center' }}>
              <span style={{ fontFamily: F, fontSize: '11px', fontWeight: 'bold', color: '#ffffff', letterSpacing: '0.3px' }}>DESEMBOLSO FINAL</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: F }}>
              <tbody>
                <tr style={{ borderBottom: `1px solid ${BLUE}` }}>
                  <td style={{ ...base, padding: '5px 10px', fontSize: '10px', fontWeight: 'bold' }}>Monto Total Aprobado:</td>
                  <td style={{ ...base, textAlign: 'right', padding: '5px 10px', fontSize: '10px', fontWeight: 'bold' }}>₡{fmt(montoAprobado)}</td>
                </tr>
                <tr style={{ borderBottom: `1px solid ${BLUE}` }}>
                  <td style={{ ...base, padding: '5px 10px', fontSize: '10px', fontWeight: 'bold' }}>(-) Total Cargos:</td>
                  <td style={{ ...base, textAlign: 'right', padding: '5px 10px', fontSize: '10px', fontWeight: 'bold' }}>₡{fmt(totalCargos)}</td>
                </tr>
                {/* Fila neto — mismo fondo oscuro */}
                <tr>
                  <td style={{ backgroundColor: BLUE, padding: '5px 10px', fontSize: '10px', fontWeight: 'bold', color: '#ffffff', fontFamily: F }}>(=) MONTO NETO A RECIBIR:</td>
                  <td style={{ backgroundColor: BLUE, textAlign: 'right', padding: '5px 10px', fontSize: '11px', fontWeight: 'bold', color: '#ffffff', fontFamily: F }}>₡{fmt(montoNeto)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* FIRMAS DE CONFORMIDAD */}
          <div style={{ marginBottom: '4mm', textAlign: 'center' }}>
            <div style={{ ...base, fontSize: '11px', fontWeight: 'bold' }}>FIRMAS DE CONFORMIDAD</div>
          </div>
          <div style={{ ...base, fontSize: '9px', lineHeight: '1.5', marginBottom: '12mm', fontStyle: 'italic' }}>
            &ldquo;Yo, <strong>{clientName}</strong>, confirmo que he revisado los montos anteriores y estoy de acuerdo con el desembolso final presentado en este documento.&rdquo;
          </div>

          {/* Líneas de firma */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4mm' }}>
            <div style={{ width: '42%', textAlign: 'center' }}>
              <div style={{ borderTop: `2px solid ${BLUE}`, paddingTop: '4px' }}>
                <span style={{ ...base, fontSize: '10px' }}>Firma del Cliente</span>
              </div>
            </div>
            <div style={{ width: '42%', textAlign: 'center' }}>
              <div style={{ borderTop: `2px solid ${BLUE}`, paddingTop: '4px' }}>
                <span style={{ ...base, fontSize: '10px' }}>Fecha</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
