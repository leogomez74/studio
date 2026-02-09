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
  plazo?: number;
  tasa_anual?: number;
  cuota?: number;
  formalized_at?: string;
  cargos_adicionales?: CargosAdicionales | null;
  lead?: {
    name?: string;
    apellido1?: string;
    cedula?: string;
  };
}

const formatCurrency = (amount?: number | null): string => {
  if (amount === null || amount === undefined) return "0.00";
  return new Intl.NumberFormat('es-CR', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const formatDate = (dateString?: string): string => {
  if (!dateString) return new Date().toLocaleDateString('es-CR');
  return new Date(dateString).toLocaleDateString('es-CR');
};

export default function HojaCierrePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [credit, setCredit] = useState<CreditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const hojaCierreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const creditRes = await api.get(`/api/credits/${params.id}`);
        setCredit(creditRes.data);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast({
          title: "Error",
          description: "No se pudo cargar la información del crédito",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [params.id, toast]);

  const handlePrint = async () => {
    if (!hojaCierreRef.current) return;

    try {
      setPrinting(true);
      const canvas = await html2canvas(hojaCierreRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgWidth = 210; // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');

      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`hoja-cierre-${credit?.reference || params.id}.pdf`);

      toast({
        title: "PDF generado",
        description: "La hoja de cierre se ha descargado correctamente"
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Error",
        description: "No se pudo generar el PDF",
        variant: "destructive"
      });
    } finally {
      setPrinting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!credit) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">No se encontró el crédito</p>
        </div>
      </div>
    );
  }

  // Calcular montos para la hoja de cierre usando cargos adicionales reales
  const montoAprobado = credit.monto_credito || 0;
  const cargosAdicionales = credit.cargos_adicionales || {};

  // Obtener cargos del crédito
  const comision = cargosAdicionales.comision || 0;
  const transporte = cargosAdicionales.transporte || 0;
  const respaldoDeudor = cargosAdicionales.respaldo_deudor || 0;
  const cancelacionManchas = cargosAdicionales.cancelacion_manchas || 0;
  const descuentoFactura = cargosAdicionales.descuento_factura || 0;

  const totalDeducciones = comision + transporte + respaldoDeudor + cancelacionManchas + descuentoFactura;
  const montoNetoRecibir = montoAprobado - totalDeducciones;

  const clientName = credit.lead
    ? `${credit.lead.name || ''} ${credit.lead.apellido1 || ''}`.trim()
    : 'N/A';

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mb-4 flex justify-between items-center max-w-[210mm] mx-auto">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
          <h1 className="text-xl font-bold">Vista previa de Hoja de Cierre</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handlePrint} disabled={printing}>
            <Printer className="mr-2 h-4 w-4" />
            {printing ? 'Generando...' : 'Imprimir'}
          </Button>
          <Button onClick={() => router.push(`/dashboard/creditos/${params.id}`)}>
            Continuar
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Documento Hoja de Cierre */}
      <div
        ref={hojaCierreRef}
        className="bg-white mx-auto shadow-lg"
        style={{
          width: '210mm',
          minHeight: '297mm',
          padding: '20mm',
        }}
      >
        {/* Encabezado */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-4">HOJA DE CIERRE</h1>
          <div className="text-sm text-gray-600">
            <p><strong>Fecha de Emisión:</strong> {formatDate()}</p>
            <p><strong>Nombre del Cliente:</strong> {clientName}</p>
            <p><strong>Cédula:</strong> {credit.lead?.cedula || 'N/A'}</p>
            <p><strong>ID del Crédito/Referencia:</strong> {credit.reference || credit.numero_operacion || 'N/A'}</p>
          </div>
        </div>

        {/* Resumen de Aprobación */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded">
          <h3 className="text-lg font-bold mb-2">RESUMEN DE APROBACIÓN</h3>
          <div className="text-right">
            <p className="text-2xl font-bold">₡{formatCurrency(montoAprobado)}</p>
            <p className="text-sm text-gray-600">Monto Total Aprobado</p>
          </div>
        </div>

        {/* Desglose de Cargos Adicionales */}
        <div className="mb-6">
          <h3 className="text-lg font-bold mb-4">CARGOS ADICIONALES</h3>

          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-2 px-3">Descripción del Concepto</th>
                <th className="text-right py-2 px-3">Monto</th>
              </tr>
            </thead>
            <tbody>
              {comision > 0 && (
                <tr className="border-b border-gray-200">
                  <td className="py-2 px-3">Comisión</td>
                  <td className="text-right py-2 px-3">₡{formatCurrency(comision)}</td>
                </tr>
              )}
              {transporte > 0 && (
                <tr className="border-b border-gray-200">
                  <td className="py-2 px-3">Transporte</td>
                  <td className="text-right py-2 px-3">₡{formatCurrency(transporte)}</td>
                </tr>
              )}
              {respaldoDeudor > 0 && (
                <tr className="border-b border-gray-200">
                  <td className="py-2 px-3">Respaldo Deudor</td>
                  <td className="text-right py-2 px-3">₡{formatCurrency(respaldoDeudor)}</td>
                </tr>
              )}
              {cancelacionManchas > 0 && (
                <tr className="border-b border-gray-200">
                  <td className="py-2 px-3">Cancelación de Manchas</td>
                  <td className="text-right py-2 px-3">₡{formatCurrency(cancelacionManchas)}</td>
                </tr>
              )}
              {descuentoFactura > 0 && (
                <tr className="border-b border-gray-200">
                  <td className="py-2 px-3">Descuento Factura</td>
                  <td className="text-right py-2 px-3">₡{formatCurrency(descuentoFactura)}</td>
                </tr>
              )}

              {/* Total Deducciones */}
              <tr className="bg-red-50 border-t-2 border-gray-300">
                <td className="py-3 px-3 font-bold">TOTAL CARGOS:</td>
                <td className="text-right py-3 px-3 font-bold text-red-700">(₡{formatCurrency(totalDeducciones)})</td>
              </tr>
            </tbody>
          </table>

          {totalDeducciones === 0 && (
            <div className="text-center py-4 text-gray-500 text-sm">
              No hay cargos adicionales registrados para este crédito
            </div>
          )}
        </div>

        {/* Desembolso Final */}
        <div className="mb-6 border border-gray-400">
          <div className="bg-gray-800 text-white py-3 px-4">
            <h3 className="text-lg font-bold text-center">DESEMBOLSO FINAL</h3>
          </div>
          <div className="p-6 bg-white">
            <table className="w-full text-base">
              <tbody>
                <tr className="border-b border-gray-300">
                  <td className="py-3 px-2 font-semibold">Monto Total Aprobado:</td>
                  <td className="text-right py-3 px-2 font-bold">₡{formatCurrency(montoAprobado)}</td>
                </tr>
                <tr className="border-b border-gray-300">
                  <td className="py-3 px-2 font-semibold">(-) Total Cargos:</td>
                  <td className="text-right py-3 px-2 font-bold">₡{formatCurrency(totalDeducciones)}</td>
                </tr>
                <tr className="bg-gray-100">
                  <td className="py-4 px-2 font-bold text-lg">(=) MONTO NETO A RECIBIR:</td>
                  <td className="text-right py-4 px-2 font-bold text-xl">₡{formatCurrency(montoNetoRecibir)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Firmas de Conformidad */}
        <div className="mt-12 border-t-2 border-gray-300 pt-6">
          <h3 className="text-base font-bold mb-4">FIRMAS DE CONFORMIDAD</h3>
          <p className="text-sm mb-8 italic">
            "Yo, <span className="font-semibold">{clientName}</span>, confirmo que he revisado los montos anteriores
            y estoy de acuerdo con el desembolso final presentado en este documento."
          </p>

          <div className="grid grid-cols-2 gap-8 mt-12">
            <div>
              <div className="border-t-2 border-black pt-2 text-center">
                <p className="font-semibold">Firma del Cliente</p>
              </div>
            </div>
            <div>
              <div className="border-t-2 border-black pt-2 text-center">
                <p className="font-semibold">Fecha</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-200 text-xs text-gray-500 text-center">
          <p>Este documento es un comprobante oficial de liquidación</p>
          <p>Generado el {formatDate()} - Referencia: {credit.reference || 'N/A'}</p>
        </div>
      </div>
    </div>
  );
}
