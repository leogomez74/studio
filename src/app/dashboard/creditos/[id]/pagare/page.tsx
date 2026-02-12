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
  const autorizacionCSGRef = useRef<HTMLDivElement>(null);

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

  // Determinar qué autorización mostrar
  const showAutorizacionCoope = deductoraId === 1 || deductoraId === 2; // COOPENACIONAL o COOPESERVICIOS
  const showAutorizacionCSG = deductoraId === 3; // Coope San Gabriel

  // Variables de fecha
  const now = new Date();
  const dia = now.getDate();
  const mes = now.toLocaleDateString('es-CR', { month: 'long' });
  const anio = now.getFullYear();
  const today = `${dia} ${mes}, ${anio}`;

  // Fecha con día de la semana para autorización
  const todayWithDay = new Date().toLocaleDateString('es-CR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).toUpperCase();

  // Componentes de fecha para Coope San Gabriel
  const diaNumero = dia;
  const diaSemana = now.toLocaleDateString('es-CR', { weekday: 'long' }).toUpperCase();
  const mesNombre = now.toLocaleDateString('es-CR', { month: 'long' }).toUpperCase();

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

      // Página 2: Autorización de Deducción (COOPENACIONAL o COOPESERVICIOS)
      if (showAutorizacionCoope && autorizacionRef.current) {
        pdf.addPage();
        const canvas2 = await captureElement(autorizacionRef.current);
        const imgData2 = canvas2.toDataURL('image/png');
        const ratio2 = Math.min(pdfWidth / canvas2.width, pdfHeight / canvas2.height);
        const finalWidth2 = canvas2.width * ratio2;
        const finalHeight2 = canvas2.height * ratio2;
        const x2 = (pdfWidth - finalWidth2) / 2;
        pdf.addImage(imgData2, 'PNG', x2, 0, finalWidth2, finalHeight2);
      }

      // Página 2: Autorización de Deducción (Coope San Gabriel)
      if (showAutorizacionCSG && autorizacionCSGRef.current) {
        pdf.addPage();
        const canvas3 = await captureElement(autorizacionCSGRef.current);
        const imgData3 = canvas3.toDataURL('image/png');
        const ratio3 = Math.min(pdfWidth / canvas3.width, pdfHeight / canvas3.height);
        const finalWidth3 = canvas3.width * ratio3;
        const finalHeight3 = canvas3.height * ratio3;
        const x3 = (pdfWidth - finalWidth3) / 2;
        pdf.addImage(imgData3, 'PNG', x3, 0, finalWidth3, finalHeight3);
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

      {/* Página 2: Autorización de Deducción - COOPENACIONAL o COOPESERVICIOS */}
      {showAutorizacionCoope && (
        <div
          ref={autorizacionRef}
          className="bg-white mx-auto shadow-lg mb-8"
          style={{
            width: '210mm',
            minHeight: '297mm',
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
            marginBottom: '15mm',
            borderBottom: '2px solid #000',
            paddingBottom: '5mm'
          }}>
            AUTORIZACION DE DEDUCCION
          </h1>

          {/* Contenido */}
          <div style={{ textAlign: 'justify', marginBottom: '20mm' }}>
            <p style={{ marginBottom: '10mm', lineHeight: '2' }}>
              Yo <span style={{ fontWeight: 'bold', textDecoration: 'underline', padding: '0 5mm' }}>{nombre}</span> Cedula <span style={{ fontWeight: 'bold', textDecoration: 'underline', padding: '0 5mm' }}>{cedula.replace(/-/g, '')}</span> autorizo irrevocablemente a <span style={{ fontWeight: 'bold', backgroundColor: '#e0f7fa', padding: '0 2mm' }}>{deductoraNombre.toUpperCase()}</span> o a cualquier tercero con el que la cooperativa tenga un convenio de cooperación, que deduzca de mi salario o pensión, la suma de <span style={{ fontWeight: 'bold' }}>₡ {formatCurrency(cuotaMensual)}</span> que incluye intereses y principal durante un plazo de <span style={{ fontWeight: 'bold', textDecoration: 'underline', padding: '0 3mm' }}>{plazo}</span> meses para cancelar la suma de <span style={{ fontWeight: 'bold' }}>₡ {formatCurrency(monto)}</span> y que corresponden al financiamiento de la operación crediticia <span style={{ fontWeight: 'bold' }}>{credit.numero_operacion || credit.reference || ''}</span> . Si por alguna razón no se aplica la deducción de mi salario o pensión, me comprometo a realizar el pago de la misma por el medio o los medios que se informen oportunamente o en su efecto autorizo a modificar el plazo o la cuota por falta de pago.
            </p>
          </div>

          {/* Línea de firma */}
          <div style={{
            borderTop: '1px solid #000',
            width: '60%',
            margin: '30mm auto 5mm auto'
          }} />

          {/* Fecha */}
          <p style={{
            textAlign: 'center',
            fontWeight: 'bold',
            fontSize: '11pt'
          }}>
            {todayWithDay}
          </p>
        </div>
      )}

      {/* Página 2: Autorización de Deducción - Coope San Gabriel */}
      {showAutorizacionCSG && (
        <div
          ref={autorizacionCSGRef}
          className="bg-white mx-auto shadow-lg mb-8"
          style={{
            width: '210mm',
            minHeight: '297mm',
            padding: '15mm 20mm',
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: '10pt',
            lineHeight: '1.5'
          }}
        >
          {/* Título con borde redondeado */}
          <div style={{
            border: '2px solid #000',
            borderRadius: '15px',
            padding: '8mm 15mm',
            marginBottom: '10mm'
          }}>
            <h1 style={{
              textAlign: 'center',
              fontSize: '16pt',
              fontWeight: 'bold',
              margin: 0
            }}>
              AUTORIZACION DE DEDUCCION
            </h1>
          </div>

          {/* Contenido principal con borde redondeado */}
          <div style={{
            border: '2px solid #000',
            borderRadius: '15px',
            padding: '8mm 10mm',
            marginBottom: '10mm'
          }}>
            <p style={{ textAlign: 'justify', marginBottom: '8mm', lineHeight: '1.8' }}>
              Autorizo a <span style={{ fontWeight: 'bold', backgroundColor: '#e0f7fa', padding: '0 2mm' }}>Coope San Gabriel R.L.(CSG)</span> para que deduzca de mi salario, pensión o la respectiva cuenta bancaria domiciliada, la suma de <span style={{ fontWeight: 'bold' }}>₡ {formatCurrency(cuotaMensual)}</span> correspondiente a las cuotas mensuales, ajustables y consecutivas las cuales incluyen intereses, principal y Fondo de Ayuda Cooperativa (FAC) no reembolsable. Además, consiento en que de la primera cuota se rebaje un Certificado de Aportación a Coope San Gabriel R.L. por la suma de ₡100, esto en cumplimiento con el estatuto de la Cooperativa en materia de asociados y según normativa vigente que rige a las cooperativas. El plazo del crédito <span style={{ fontWeight: 'bold', textDecoration: 'underline', padding: '0 3mm' }}>{plazo}</span> meses para cancelar la suma de <span style={{ fontWeight: 'bold' }}>₡ {formatCurrency(monto)}</span> de principal más intereses sobre correspondiente al financiamiento de la operación <span style={{ fontWeight: 'bold' }}>{credit.numero_operacion || credit.reference || ''}</span> . Si por alguna razón, NO SE REALIZA LA DEDUCCION, del mes o meses al cobro de mi salario o pensión, me comprometo a realizar el pago de la misma en las cuentas bancarias que Credipep S.A designe para tal fin, incluyendo los cargos administrativos correspondientes o en su defecto, autorizo a la Credipep S.A a aumentar el plazo de la operación en el número de meses equivalentes al número de cuotas pendientes o gestione el cobro a mi patrono, conforme a lo establecido en el artículo 69, inciso K, del código de trabajo.
            </p>

            <p style={{ textAlign: 'justify', marginBottom: '8mm', lineHeight: '1.8' }}>
              Adicionalmente, me responsabilizo a actualizar los datos correspondientes a domicilio y telefonía en caso de presentar alguna modificación, de acuerdo a la ley 8204 y a la Ley de Notificaciones.
            </p>

            <p style={{ textAlign: 'justify', marginBottom: '8mm', lineHeight: '1.8' }}>
              El firmante declara bajo la fe de juramento que consiente, conoce, acepta y leyó las cláusulas aquí pactadas en la fecha del anverso en esta solicitud y que cuenta para este acto con la capacidad jurídica suficiente para suscribir el presente acuerdo.
            </p>

            {/* Fecha */}
            <div style={{ marginTop: '10mm' }}>
              <p>
                <span>Fecha: </span>
                <span style={{ fontWeight: 'bold' }}>{diaNumero} DE {mesNombre} DEL {anio}</span>
              </p>
            </div>
          </div>

          {/* Firmas */}
          <div style={{ marginTop: '15mm' }}>
            <table style={{ width: '100%' }}>
              <tbody>
                <tr>
                  <td style={{ width: '45%', borderTop: '1px solid #000', paddingTop: '3mm', textAlign: 'center' }}>
                    FIRMA DEUDOR
                  </td>
                  <td style={{ width: '10%' }}></td>
                  <td style={{ width: '45%', borderTop: '1px solid #000', paddingTop: '3mm', textAlign: 'center' }}>
                    CEDULA O NUMERO DE IDENTIFICACION
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
