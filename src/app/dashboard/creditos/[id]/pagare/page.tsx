"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Download, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import api from "@/lib/axios";

interface CreditData {
  id: number;
  numero_operacion?: string;
  reference?: string;
  monto_credito?: number;
  plazo?: number;
  tasa_anual?: number;
  divisa?: string;
  client?: {
    name?: string;
    cedula?: string;
    estado_civil?: string;
    ocupacion?: string;
    direccion1?: string;
    direccion2?: string;
  };
  lead?: {
    name?: string;
    cedula?: string;
    estado_civil?: string;
    ocupacion?: string;
    direccion1?: string;
    direccion2?: string;
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

export default function PagarePage() {
  const params = useParams();
  const router = useRouter();
  const [credit, setCredit] = useState<CreditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const pagareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchCredit = async () => {
      try {
        const res = await api.get(`/api/credits/${params.id}`);
        setCredit(res.data);
      } catch (error) {
        console.error("Error fetching credit:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCredit();
  }, [params.id]);

  if (loading) {
    return <div className="p-8">Cargando...</div>;
  }

  if (!credit) {
    return <div className="p-8">Crédito no encontrado</div>;
  }

  const debtor = credit.client || credit.lead || null;
  const nombre = (debtor?.name || '').toUpperCase();
  const cedula = (debtor as any)?.cedula || '';
  const estadoCivil = ((debtor as any)?.estado_civil || '').toUpperCase();
  const profesion = (debtor?.ocupacion || '').toUpperCase();
  const direccion = [
    (debtor as any)?.direccion1,
    (debtor as any)?.direccion2,
  ].filter(Boolean).join(', ').toUpperCase();

  const monto = Number(credit.monto_credito ?? 0);
  const tasaNumber = Number(credit.tasa_anual ?? 0);
  const tasaMensual = (tasaNumber / 12).toFixed(2);
  const tasaMoratoria = ((tasaNumber / 12) * 1.3).toFixed(2);
  const divisaCode = credit.divisa || 'CRC';

  const today = new Date().toLocaleDateString('es-CR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).toUpperCase();

  const handleExportPDF = async () => {
    if (!pagareRef.current || !credit) return;

    setExporting(true);
    try {
      const element = pagareRef.current;

      // Capturar el HTML como canvas
      const canvas = await html2canvas(element, {
        scale: 2, // Mayor calidad
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');

      // Crear PDF con tamaño A4
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // Calcular dimensiones manteniendo proporción
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);

      const finalWidth = imgWidth * ratio;
      const finalHeight = imgHeight * ratio;

      // Centrar la imagen
      const x = (pdfWidth - finalWidth) / 2;
      const y = 0;

      pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
      pdf.save(`pagare_${credit.numero_operacion || credit.reference || credit.id}.pdf`);
    } catch (error) {
      console.error('Error exportando PDF:', error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="mb-4 flex justify-between items-center max-w-[210mm] mx-auto">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
          <h1 className="text-xl font-bold">Vista previa del Pagaré</h1>
        </div>
        <Button onClick={handleExportPDF} disabled={exporting}>
          <Download className="mr-2 h-4 w-4" />
          {exporting ? 'Exportando...' : 'Exportar PDF'}
        </Button>
      </div>

      {/* Documento Pagaré - Simula una hoja A4 */}
      <div
        ref={pagareRef}
        className="bg-white mx-auto shadow-lg"
        style={{
          width: '210mm',
          minHeight: '297mm',
          padding: '15mm 20mm',
          fontFamily: 'Helvetica, Arial, sans-serif',
          fontSize: '9pt',
          lineHeight: '1.4'
        }}
      >
        {/* Encabezado */}
        <div style={{ textAlign: 'right', marginBottom: '5mm' }}>
          <span>OPERACIÓN N° </span>
          <span style={{ marginLeft: '10px' }}>{credit.numero_operacion || credit.reference || 'x123'}</span>
        </div>

        {/* Título */}
        <h1 style={{
          textAlign: 'center',
          fontSize: '24pt',
          fontWeight: 'bold',
          marginBottom: '5mm'
        }}>
          PAGARE
        </h1>

        {/* Lugar y fecha */}
        <p style={{ marginBottom: '5mm' }}>
          San José, Costa Rica, el día {today}
        </p>

        {/* Sección DEUDOR */}
        <div style={{ marginBottom: '5mm' }}>
          <p style={{ fontWeight: 'bold', marginBottom: '3mm' }}>DEUDOR</p>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ width: '35%', paddingLeft: '10mm', paddingBottom: '2mm' }}>Nombre y apellidos del deudor:</td>
                <td style={{ paddingBottom: '2mm' }}>{nombre}</td>
              </tr>
              <tr>
                <td style={{ paddingLeft: '10mm', paddingBottom: '2mm' }}>Número de cédula de identidad:</td>
                <td style={{ paddingBottom: '2mm' }}>{cedula}</td>
              </tr>
              <tr>
                <td style={{ paddingLeft: '10mm', paddingBottom: '2mm' }}>Estado civil:</td>
                <td style={{ paddingBottom: '2mm' }}>{estadoCivil}</td>
              </tr>
              <tr>
                <td style={{ paddingLeft: '10mm', paddingBottom: '2mm' }}>Profesión/Oficio:</td>
                <td style={{ paddingBottom: '2mm' }}>{profesion}</td>
              </tr>
              <tr>
                <td style={{ paddingLeft: '10mm', paddingBottom: '2mm' }}>Dirección de domicilio:</td>
                <td style={{ paddingBottom: '2mm' }}>{direccion}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Montos */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '3mm' }}>
          <tbody>
            <tr>
              <td style={{ width: '35%', fontWeight: 'bold', paddingBottom: '2mm' }}>Monto en números:</td>
              <td style={{ paddingBottom: '2mm' }}>{divisaCode}  {formatCurrency(monto)}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 'bold', paddingBottom: '2mm' }}>Monto en letras:</td>
              <td style={{ paddingBottom: '2mm' }}>____________________________________________ DE COLONES EXACTOS</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 'bold', paddingBottom: '2mm' }}>Tasa de interés corriente:</td>
              <td style={{ paddingBottom: '2mm' }}>Tasa fija mensual del {tasaMensual}%</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 'bold', paddingBottom: '2mm' }}>Tasa de interés moratoria:</td>
              <td style={{ paddingBottom: '2mm' }}>Tasa mensual del {tasaMoratoria}%</td>
            </tr>
          </tbody>
        </table>

        {/* Forma de pago */}
        <div style={{ marginBottom: '5mm' }}>
          <p style={{ fontWeight: 'bold', marginBottom: '2mm' }}>Forma de pago:</p>
          <p style={{ textAlign: 'justify', fontSize: '8pt' }}>
            Cuotas mensuales, en número igual al número de meses indicados como "plazo en variables y meses".
            Yo, la persona indicada como "deudor" en este documento, PROMETO pagar INCONDICIONALMENTE este
            PAGARE a la orden de CREDIPEP, S.A. cédula jurídica 3-101-515511 entidad domiciliada en San José,
            San José, Sabana Norte, del ICE, 100 m oeste, 400 m norte y 50 oeste, mano izquierda casa blanca
            de dos pisos, # 5635. El monto de la deuda es la suma indicada como "Monto en Letras" y "Monto en
            Números". La tasa de interés corriente es la indicada como "tasa de interés corriente". El pago
            se llevará a cabo en San José, en el domicilio de la acreedora, en dinero corriente y en colones
            costarricenses. Los intereses se calcularán sobre la base del saldo de principal en un momento
            determinado y en porcentajes señalados como "tasa de interés corriente" Los pagos incluyen el
            capital más intereses y pagaré con la periodicidad de pago indicada. Renuncio a mi domicilio y
            requerimientos de pago y acepto la concesión de prórrogas sin que se me consulte ni notifique.
            Asimismo la falta de pago de una sola de las cuotas de capital e intereses indicadas dará derecho
            al acreedor a tener por vencida y exigible ejecutiva y judicialmente toda la deuda. Este título
            se rige por las normas del Código de Comercio vigentes acerca del "Pagaré" como título a la orden
            para representación de un compromiso incondicional de pago de sumas de dinero.
          </p>
        </div>

        {/* Abonos extraordinarios */}
        <div style={{ marginBottom: '10mm' }}>
          <p style={{ fontWeight: 'bold', marginBottom: '2mm' }}>
            SOBRE LOS ABONOS EXTRAORDINARIOS Y CANCELACIÓN ANTICIPADA:
          </p>
          <p style={{ textAlign: 'justify', fontSize: '8pt' }}>
            Se indica y aclara al deudor de este pagaré, que, por los abonos extraordinarios y cancelación
            anticipada antes de los primeros doce meses naturales a partir del primer día siguiente a la
            firma de este crédito se penalizará con tres meses de intereses corrientes, (los cuales tendrá
            como base de cálculo el mes en el que se realizará la cancelación y los dos meses siguientes a este).
          </p>
        </div>

        {/* Firmas */}
        <div style={{ marginTop: '15mm' }}>
          <p style={{ marginBottom: '8mm' }}>Nombre: _________________________________________________</p>
          <p style={{ marginBottom: '8mm' }}>Cédula: _________________________________________________</p>
          <p style={{ marginBottom: '8mm' }}>Firma: _________________________________________________</p>
        </div>
      </div>
    </div>
  );
}
