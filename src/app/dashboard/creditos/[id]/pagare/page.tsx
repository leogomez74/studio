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

interface CreditData {
  id: number;
  numero_operacion?: string;
  reference?: string;
  monto_credito?: number;
  monto_letras?: string;
  plazo?: number;
  tasa_anual?: number;
  divisa?: string;
  cuota?: number;
  plan_de_pagos?: Array<{
    numero_cuota: number;
    cuota: number;
  }>;
  client?: {
    name?: string;
    cedula?: string;
    estado_civil?: string;
    ocupacion?: string;
    direccion1?: string;
    direccion2?: string;
    deductora_id?: number;
  };
  lead?: {
    name?: string;
    cedula?: string;
    estado_civil?: string;
    ocupacion?: string;
    direccion1?: string;
    direccion2?: string;
    deductora_id?: number;
  };
}

interface Deductora {
  id: number;
  nombre: string;
  codigo: string;
}

const formatCurrency = (amount?: number | null): string => {
  if (amount === null || amount === undefined) return "0.00";
  return new Intl.NumberFormat('es-CR', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

// Calcular cuota mensual usando fórmula de amortización
const calcularCuotaMensual = (monto: number, plazo: number, tasaAnual: number): number => {
  const tasaMensual = (tasaAnual / 100) / 12;
  if (tasaMensual === 0) return monto / plazo;
  const cuota = monto * (tasaMensual * Math.pow(1 + tasaMensual, plazo)) / (Math.pow(1 + tasaMensual, plazo) - 1);
  return cuota;
};

// Convertir número decimal a formato de texto con centavos (ej: 5.50 -> "CINCO 50/100")
const numeroATasaTexto = (numero: number): string => {
  const unidades = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const decenas = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];

  const parteEntera = Math.floor(numero);
  const centavos = Math.round((numero - parteEntera) * 100);

  let texto = '';

  if (parteEntera >= 10 && parteEntera <= 19) {
    texto = especiales[parteEntera - 10];
  } else {
    const dec = Math.floor(parteEntera / 10);
    const uni = parteEntera % 10;

    if (dec > 0) {
      texto = decenas[dec];
      if (uni > 0) {
        texto += ' Y ' + unidades[uni];
      }
    } else {
      texto = unidades[uni];
    }
  }

  return `${texto} ${centavos.toString().padStart(2, '0')}/100`.trim();
};

export default function PagarePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [credit, setCredit] = useState<CreditData | null>(null);
  const [deductoras, setDeductoras] = useState<Deductora[]>([]);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const pagareRef = useRef<HTMLDivElement>(null);
  const autorizacionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [creditRes, deductorasRes] = await Promise.all([
          api.get(`/api/credits/${params.id}`),
          api.get('/api/deductoras')
        ]);
        setCredit(creditRes.data);
        setDeductoras(Array.isArray(deductorasRes.data) ? deductorasRes.data : []);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
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
  const plazo = Number(credit.plazo ?? 0);
  const tasaNumber = Number(credit.tasa_anual ?? 0);
  const tasaMensualNum = tasaNumber / 12;
  const tasaMensual = tasaMensualNum.toFixed(2);
  const tasaMoratoriaNum = tasaMensualNum * 1.3;
  const tasaMoratoria = tasaMoratoriaNum.toFixed(2);
  const divisaSymbol = credit.divisa === 'CRC' || !credit.divisa ? '₡' : credit.divisa;

  // Convertir tasas a texto
  const tasaMensualTexto = numeroATasaTexto(parseFloat(tasaMensual));
  const tasaMoratoriaTexto = numeroATasaTexto(parseFloat(tasaMoratoria));

  // Obtener la cuota mensual desde plan_de_pagos o calcularla
  const cuotaMensual = credit.plan_de_pagos?.find(p => p.numero_cuota === 1)?.cuota
    || credit.cuota
    || calcularCuotaMensual(monto, plazo, tasaNumber);

  // Obtener deductora del cliente
  const deductoraId = debtor?.deductora_id;
  const deductora = deductoras.find(d => d.id === deductoraId);
  const deductoraNombre = deductora?.nombre || '';

  // Mostrar autorización si hay deductora asignada
  const showAutorizacion = !!deductoraId;

  // Variables de fecha
  const now = new Date();
  const dia = now.getDate();
  const mes = now.toLocaleDateString('es-CR', { month: 'long' });
  const anio = now.getFullYear();
  const today = `${dia} ${mes}, ${anio}`;

  // Fecha con día de la semana para autorización
  // Fecha con día de la semana para autorización (ej: "lunes, 9 de febrero de 2026")
  const todayWithDay = now.toLocaleDateString('es-CR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const handlePrint = async () => {
    if (!pagareRef.current || !credit) return;

    setPrinting(true);
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // Helper function to capture element as canvas
      const captureElement = async (element: HTMLElement): Promise<HTMLCanvasElement> => {
        const width = element.offsetWidth;
        const height = element.offsetHeight;

        return html2canvas(element, {
          scale: 1.5,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: width,
          height: height,
          windowWidth: width,
          windowHeight: height,
          imageTimeout: 0,
          ignoreElements: (el) => {
            return el.tagName === 'IMG';
          }
        });
      };

      // Página 1: Pagaré
      const canvas1 = await captureElement(pagareRef.current);
      const imgData1 = canvas1.toDataURL('image/png');
      const ratio1 = Math.min(pdfWidth / canvas1.width, pdfHeight / canvas1.height);
      const finalWidth1 = canvas1.width * ratio1;
      const finalHeight1 = canvas1.height * ratio1;
      const x1 = (pdfWidth - finalWidth1) / 2;
      pdf.addImage(imgData1, 'PNG', x1, 0, finalWidth1, finalHeight1);

      // Página 2: Autorización de Deducción
      if (showAutorizacion && autorizacionRef.current) {
        pdf.addPage();
        const canvas2 = await captureElement(autorizacionRef.current);
        const imgData2 = canvas2.toDataURL('image/png');
        const ratio2 = Math.min(pdfWidth / canvas2.width, pdfHeight / canvas2.height);
        const finalWidth2 = canvas2.width * ratio2;
        const finalHeight2 = canvas2.height * ratio2;
        const x2 = (pdfWidth - finalWidth2) / 2;
        pdf.addImage(imgData2, 'PNG', x2, 0, finalWidth2, finalHeight2);
      }

      // Abrir PDF en nueva ventana para imprimir
      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const printWindow = window.open(pdfUrl);
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    } catch (error) {
      console.error('Error generando PDF:', error);
      toast({ title: 'Error', description: 'Error al generar el documento. Por favor intente de nuevo.', variant: 'destructive' });
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="mb-4 flex justify-between items-center max-w-[216mm] mx-auto">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
          <h1 className="text-xl font-bold">Vista previa del Pagaré</h1>
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

      {/* Documento Pagaré - Página 1 */}
      <div
        ref={pagareRef}
        className="bg-white mx-auto shadow-lg mb-8"
        style={{
          width: '216mm',
          minHeight: '279mm',
          padding: '8mm 12mm',
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '9pt',
          lineHeight: '1.3'
        }}
      >
        {/* Encabezado */}
        <div style={{ marginBottom: '6mm' }}>
          <span style={{ fontWeight: 'bold', fontSize: '9pt' }}>OPERACIÓN Nº</span>
          {'    '}
          <span style={{ fontSize: '9pt' }}>{credit.numero_operacion || credit.reference || ''}</span>
        </div>

        {/* Título */}
        <h1 style={{
          textAlign: 'center',
          fontSize: '26pt',
          fontWeight: 'bold',
          marginBottom: '4mm',
          marginTop: '2mm'
        }}>
          PAGARE
        </h1>

        {/* Lugar y fecha */}
        <p style={{ marginBottom: '3mm' }}>
          San Jose, Costa Rica, el día {today}
        </p>

        {/* Sección DEUDOR */}
        <div style={{ marginBottom: '3mm' }}>
          <p style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '2mm' }}>DEUDOR</p>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ width: '35%', paddingBottom: '1mm', fontWeight: 'bold' }}>Nombre y apellidos del deudor:</td>
                <td style={{ paddingBottom: '1mm' }}>{nombre}</td>
              </tr>
              <tr>
                <td style={{ paddingBottom: '1mm', fontWeight: 'bold' }}>Numero de cedula de identidad:</td>
                <td style={{ paddingBottom: '1mm' }}>{cedula}</td>
              </tr>
              <tr>
                <td style={{ paddingBottom: '1mm', fontWeight: 'bold' }}>Estado civil:</td>
                <td style={{ paddingBottom: '1mm' }}>{estadoCivil}</td>
              </tr>
              <tr>
                <td style={{ paddingBottom: '1mm', fontWeight: 'bold' }}>Profesion/Oficio:</td>
                <td style={{ paddingBottom: '1mm' }}>{profesion}</td>
              </tr>
              <tr>
                <td style={{ paddingBottom: '1mm', fontWeight: 'bold', verticalAlign: 'top' }}>Direccion de domicilio:</td>
                <td style={{ paddingBottom: '1mm' }}>{direccion}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Montos y condiciones */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2mm' }}>
          <tbody>
            <tr>
              <td style={{ width: '30%', fontWeight: 'bold', paddingBottom: '1mm' }}>Monto en numeros:</td>
              <td style={{ fontWeight: 'bold', paddingBottom: '1mm' }}>{divisaSymbol} {formatCurrency(monto)}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 'bold', paddingBottom: '1mm' }}>Monto en letras:</td>
              <td colSpan={2} style={{ fontWeight: 'bold', paddingBottom: '1mm' }}>
                {credit.monto_letras || 'CUATROCIENTOS MIL 00/100 DE COLONES EXACTOS'}
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: 'bold', paddingBottom: '1mm' }}>Tasa de interes Corriente:</td>
              <td colSpan={2} style={{ paddingBottom: '1mm' }}>
                Tasa fija mensual del {tasaMensual}%
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: 'bold', paddingBottom: '1mm', verticalAlign: 'top' }}>Tasa de interes moratoria:</td>
              <td colSpan={2} style={{ paddingBottom: '1mm', textAlign: 'justify' }}>
                Tasa mensual del {tasaMoratoria}% ( {tasaMoratoriaTexto} por ciento). (Tasa de interes corriente aumentada en un 30% según lo estipulado en el artículo 498 del codigo de comercio de Costa Rica)
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: 'bold', paddingBottom: '1mm', verticalAlign: 'top' }}>plazo en numero de meses:</td>
              <td colSpan={2} style={{ paddingBottom: '1mm', textAlign: 'justify' }}>
                {credit.plazo || 0} meses a partir del día primero del mes inmediato siguiente a la fecha del presente Pagaré.
              </td>
            </tr>
          </tbody>
        </table>

        {/* Forma de pago + Abonos extraordinarios (bloque continuo) */}
        <div style={{ marginBottom: '3mm' }}>
          <p style={{ textAlign: 'justify', fontSize: '8.5pt', lineHeight: '1.5' }}>
            <strong>Forma de pago:</strong>{'   '}Cuotas mensuales, en número igual al número de meses indicados como "plazo en variables meses", variables y consecutivas de principal e intereses de <strong>{divisaSymbol} {formatCurrency(cuotaMensual)}</strong> cada una pagaderas los días primero de cada mes. Yo, la persona indicada como "deudor" en este documento, <strong>PROMETO pagar INCONDICIONALMENTE</strong> este PAGARE a la orden de CREDIPEP, S.A. cédula jurídica 3-101-515511 entidad domiciliada en San José, San José, Sabana Norte, del ICE, 100 m oeste, 400 m norte y 50 oeste, mano izquierda casa blanca de dos pisos, # 5635. El monto de la deuda es la suma indicada como "Monto en Letras" y "Monto en Números". La tasa de interés corriente es la indicada como "tasa de interés corriente". El pago se llevará a cabo en San José, en el domicilio de la acreedora, en dinero corriente y en colones costarricenses. Los intereses se calcularán sobre la base del saldo de principal en un momento determinado y en los porcentajes señalados como "tasa de interés corriente" Los pagos mensuales de capital más intereses se pagarán con la periodicidad de pago indicada. Renuncio a mi domicilio y requerimientos de pago y acepto la concesión de prórrogas sin que se me consulte ni notifique. Asimismo la falta de pago de una sola de las cuotas de capital e intereses indicadas dará derecho al acreedor a tener por vencida y exigible ejecutiva y judicialmente toda la deuda. Este título se rige por las normas del Código de Comercio vigentes acerca del "Pagaré" como título a la orden para representación de un compromiso incondicional de pago de sumas de dinero.
          </p>
          <p style={{ textAlign: 'justify', fontSize: '8.5pt', lineHeight: '1.5', marginTop: '1mm' }}>
            <strong>SOBRE LOS ABONOS EXTRAORDINARIOS Y CANCELACIÓN ANTICIPADA:</strong>{'  '}Se indica y aclara al deudor de este pagaré, que, por los <strong>abonos extraordinarios</strong> y <strong>cancelación anticipada</strong> antes de los primeros doce meses naturales a partir del primer dia siguiente a la firma de este crédito se penalizará con tres meses de interéses corrientes, (los cuales tendrá como base de cálculo el mes en el que se realizará la cancelación y los dos meses siguientes a este).
          </p>
        </div>

        {/* Firmas */}
        <div style={{ marginTop: '12mm' }}>
          <p style={{ marginBottom: '10mm', fontSize: '9pt' }}>
            <strong>Nombre:</strong> _____________________________________
          </p>
          <p style={{ marginBottom: '10mm', fontSize: '9pt' }}>
            <strong>Cédula:</strong> ______________________________________
          </p>
          <p style={{ marginBottom: '10mm', fontSize: '9pt' }}>
            <strong>Firma:</strong> _______________________________________
          </p>
        </div>
      </div>

      {/* Página 2: Autorización de Deducción (formato unificado) */}
      {showAutorizacion && (
        <div
          ref={autorizacionRef}
          className="bg-white mx-auto shadow-lg mb-8"
          style={{
            width: '216mm',
            minHeight: '279mm',
            padding: '20mm 25mm',
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: '11pt',
            lineHeight: '1.6'
          }}
        >
          {/* Título */}
          <h1 style={{
            textAlign: 'center',
            fontSize: '18pt',
            fontWeight: 'bold',
            marginBottom: '3mm',
            textDecoration: 'underline'
          }}>
            AUTORIZACION DE DEDUCCION
          </h1>

          {/* Contenido */}
          <div style={{ textAlign: 'justify' }}>
            <p style={{ lineHeight: '2' }}>
              Yo <strong>{nombre}</strong> Cedula <strong>{cedula.replace(/-/g, '')}</strong> autorizo irrevocablemente a <strong>COOPENACIONAL, COOPESERVICIOS Y COOPESANGABRIEL</strong> o a cualquier tercero con el que la cooperativa tenga un convenio de cooperación, que deduzca de mi salario o pensión, la suma de <strong>₡ {formatCurrency(cuotaMensual)}</strong> que incluye intereses y principal durante un plazo de <strong>{plazo}</strong> meses para cancelar la suma de <strong>₡ {formatCurrency(monto)}</strong> y que corresponden al financiamiento de la operación crediticia <strong>{credit.numero_operacion || credit.reference || ''}</strong> . Si por alguna razón no se aplica la deducción de mi salario o pensión, me comprometo a realizar el pago de la misma por el medio o los medios que se informen oportunamente o en su efecto autorizo a modificar el plazo o la cuota por falta de pago.
            </p>
          </div>

          {/* Fecha */}
          <div style={{
            borderTop: '1px solid #000',
            borderBottom: '1px solid #000',
            width: '50%',
            margin: '30mm auto 3mm auto',
            padding: '3mm 0'
          }}>
            <p style={{ textAlign: 'center', fontSize: '11pt' }}>
              {todayWithDay}
            </p>
          </div>

          {/* Firma */}
          <div style={{
            borderTop: '1px solid #000',
            width: '50%',
            margin: '25mm auto 3mm auto',
            paddingTop: '3mm'
          }}>
            <p style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '11pt' }}>
              FIRMA
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
