"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Download } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import api from "@/lib/axios";
import { useToast } from "@/hooks/use-toast";

interface PaymentData {
  id: number;
  credit_id: number;
  monto: number;
  cuota?: number;
  saldo_anterior?: number;
  nuevo_saldo?: number;
  interes_corriente?: number;
  interes_moratorio?: number;
  amortizacion?: number;
  poliza?: number;
  fecha_pago?: string;
  source?: string;
  cedula?: string;
  linea?: string;
  proceso?: string;
  created_at?: string;
  credit?: {
    id: number;
    reference?: string;
    numero_operacion?: string;
    monto_credito?: number;
    tipo_credito?: string;
    category?: string;
    lead?: {
      name?: string;
      cedula?: string;
    };
    client?: {
      name?: string;
      cedula?: string;
    };
  };
  details?: Array<{
    id: number;
    numero_cuota: number;
    pago_mora: number;
    pago_int_vencido: number;
    pago_int_corriente: number;
    pago_poliza: number;
    pago_principal: number;
    pago_total: number;
  }>;
}

const formatCurrency = (amount?: number | null): string => {
  if (amount === null || amount === undefined) return "0.00";
  return new Intl.NumberFormat("es-CR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const formatDate = (dateStr?: string | null): string => {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("es-CR", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
};

const formatDateTime = (dateStr?: string | null): string => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-CR", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

// Map source to a display-friendly concept name
const sourceToConcepto = (source?: string): string => {
  const map: Record<string, string> = {
    Ventanilla: "Abono Ordinario",
    Planilla: "Abono por Planilla",
    "Adelanto Simple": "Adelanto Simple",
    "Adelanto de Cuotas": "Adelanto de Cuotas",
    Extraordinario: "Abono Extraordinario",
    "Cancelación Anticipada": "Cancelación Anticipada",
    Refundición: "Refundición",
  };
  return map[source || ""] || source || "Abono";
};

export default function ReciboPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [payment, setPayment] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const reciboRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get(`/api/credit-payments/${params.id}`);
        setPayment(res.data);
      } catch (error) {
        console.error("Error fetching payment:", error);
        toast({
          title: "Error",
          description: "No se pudo cargar el comprobante de pago.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [params.id]);

  if (loading) {
    return <div className="p-8">Cargando...</div>;
  }

  if (!payment) {
    return <div className="p-8">Pago no encontrado</div>;
  }

  const debtor = payment.credit?.lead || null;
  const debtorName = debtor?.name || "";
  const debtorCedula = payment.cedula || debtor?.cedula || "";
  const operacion = payment.credit?.reference || payment.credit?.numero_operacion || "";
  const descripcion = payment.credit?.category || payment.credit?.tipo_credito || "";
  const fechaPago = payment.fecha_pago || payment.created_at || "";

  const saldoAnterior = Number(payment.saldo_anterior ?? 0);
  const saldoActual = Number(payment.nuevo_saldo ?? 0);
  const interesCorriente = Number(payment.interes_corriente ?? 0);
  const interesAtrasado = Number(payment.interes_moratorio ?? 0);
  const amortizacion = Number(payment.amortizacion ?? 0);
  const polizas = Number(payment.poliza ?? 0);
  const montoTotal = Number(payment.monto ?? 0);

  const handlePrint = async () => {
    if (!reciboRef.current) return;

    setPrinting(true);
    try {
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "letter",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const canvas = await html2canvas(reciboRef.current, {
        scale: 1.5,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: "#ffffff",
        width: reciboRef.current.offsetWidth,
        height: reciboRef.current.offsetHeight,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.85);
      const ratio = Math.min(pdfWidth / canvas.width, pdfHeight / canvas.height);
      const finalWidth = canvas.width * ratio;
      const finalHeight = canvas.height * ratio;
      const x = (pdfWidth - finalWidth) / 2;
      const y = (pdfHeight - finalHeight) / 2;
      pdf.addImage(imgData, "JPEG", x, y, finalWidth, finalHeight);

      const pdfBlob = pdf.output("blob");
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const printWindow = window.open(pdfUrl);
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    } catch (error) {
      console.error("Error generando PDF:", error);
      toast({
        title: "Error",
        description: "Error al generar el documento.",
        variant: "destructive",
      });
    } finally {
      setPrinting(false);
    }
  };

  const handleDownload = async () => {
    if (!reciboRef.current) return;

    setPrinting(true);
    try {
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "letter",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const canvas = await html2canvas(reciboRef.current, {
        scale: 1.5,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: "#ffffff",
        width: reciboRef.current.offsetWidth,
        height: reciboRef.current.offsetHeight,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.85);
      const ratio = Math.min(pdfWidth / canvas.width, pdfHeight / canvas.height);
      const finalWidth = canvas.width * ratio;
      const finalHeight = canvas.height * ratio;
      const x = (pdfWidth - finalWidth) / 2;
      const y = (pdfHeight - finalHeight) / 2;
      pdf.addImage(imgData, "JPEG", x, y, finalWidth, finalHeight);

      pdf.save(`comprobante_${payment.id}.pdf`);
    } catch (error) {
      console.error("Error descargando PDF:", error);
      toast({
        title: "Error",
        description: "Error al descargar el documento.",
        variant: "destructive",
      });
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="mb-4 flex justify-between items-center max-w-[280mm] mx-auto">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
          <h1 className="text-xl font-bold">Comprobante de Pago</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleDownload} disabled={printing}>
            <Download className="mr-2 h-4 w-4" />
            Descargar PDF
          </Button>
          <Button onClick={handlePrint} disabled={printing}>
            <Printer className="mr-2 h-4 w-4" />
            {printing ? "Generando..." : "Imprimir"}
          </Button>
        </div>
      </div>

      {/* Documento del Recibo */}
      <div
        ref={reciboRef}
        className="bg-white mx-auto shadow-lg"
        style={{
          width: "280mm",
          minHeight: "180mm",
          padding: "10mm 15mm",
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: "9pt",
          lineHeight: "1.4",
        }}
      >
        {/* Encabezado */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5mm" }}>
          <div>
            <h1 style={{ fontSize: "16pt", fontWeight: "bold", margin: 0 }}>
              COMPROBANTES DE APLICACION
            </h1>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: "12pt", fontWeight: "bold", margin: 0 }}>*{payment.id}*</p>
            <p style={{ fontWeight: "bold", margin: 0 }}>{payment.id}</p>
            <p style={{ margin: 0 }}>Oficina Central</p>
          </div>
        </div>

        {/* Datos del cliente */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4mm" }}>
          <div style={{ display: "flex", gap: "5mm" }}>
            <span style={{ fontWeight: "bold" }}>CLIENTE:</span>
            <span style={{ fontWeight: "bold" }}>{debtorCedula}</span>
            <span>{debtorName.toUpperCase()}</span>
          </div>
          <div style={{ display: "flex", gap: "5mm" }}>
            <span style={{ fontWeight: "bold" }}>FECHA:</span>
            <span>{formatDateTime(fechaPago)}</span>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2mm" }}>
          <div style={{ display: "flex", gap: "5mm" }}>
            <span style={{ fontWeight: "bold" }}>CONCEPTO:</span>
            <span>{sourceToConcepto(payment.source)}</span>
          </div>
          <div style={{ display: "flex", gap: "5mm" }}>
            <span style={{ fontWeight: "bold" }}>MONTO:</span>
            <span>{formatCurrency(montoTotal)}</span>
          </div>
        </div>

        <div style={{ marginBottom: "5mm" }}>
          <div style={{ display: "flex", gap: "5mm" }}>
            <span />
            <span />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "5mm" }}>
            <span style={{ fontWeight: "bold" }}>DOC.ALT.:</span>
            <span>{operacion}</span>
          </div>
        </div>

        {/* DETALLE */}
        <p style={{ fontWeight: "bold", marginBottom: "3mm", textDecoration: "underline" }}>
          DETALLE:
        </p>

        <div style={{ display: "flex", gap: "10mm", marginBottom: "6mm" }}>
          {/* Columna izquierda - Saldos */}
          <div style={{ flex: 1, border: "1px solid #ccc", padding: "3mm" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
              <tbody>
                <tr>
                  <td style={{ paddingBottom: "1mm" }}>Saldo Anterior</td>
                  <td style={{ textAlign: "right", paddingBottom: "1mm" }}>
                    ...: ₡{formatCurrency(saldoAnterior)}
                  </td>
                </tr>
                <tr>
                  <td style={{ paddingBottom: "1mm" }}>Saldo Actual</td>
                  <td style={{ textAlign: "right", paddingBottom: "1mm" }}>
                    ...: ₡{formatCurrency(saldoActual)}
                  </td>
                </tr>
                <tr>
                  <td style={{ paddingBottom: "1mm" }}>Interes Corriente</td>
                  <td style={{ textAlign: "right", paddingBottom: "1mm" }}>
                    ...: ₡{formatCurrency(interesCorriente)}
                  </td>
                </tr>
                <tr>
                  <td style={{ paddingBottom: "1mm" }}>Interes Atrasado</td>
                  <td style={{ textAlign: "right", paddingBottom: "1mm" }}>
                    ...: ₡{formatCurrency(interesAtrasado)}
                  </td>
                </tr>
                <tr>
                  <td style={{ paddingBottom: "1mm" }}>Amortización</td>
                  <td style={{ textAlign: "right", paddingBottom: "1mm" }}>
                    ...: ₡{formatCurrency(amortizacion)}
                  </td>
                </tr>
                <tr>
                  <td style={{ paddingBottom: "1mm" }}>Cargos Totales</td>
                  <td style={{ textAlign: "right", paddingBottom: "1mm" }}>
                    ...: ₡{formatCurrency(0)}
                  </td>
                </tr>
                <tr>
                  <td style={{ paddingBottom: "1mm" }}>Pólizas</td>
                  <td style={{ textAlign: "right", paddingBottom: "1mm" }}>
                    ...: ₡{formatCurrency(polizas)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Columna derecha - Referencias */}
          <div style={{ flex: 1, border: "1px solid #ccc", padding: "3mm" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
              <tbody>
                <tr>
                  <td style={{ fontWeight: "bold", paddingBottom: "1mm" }}>Operacion/Linea</td>
                  <td style={{ paddingBottom: "1mm" }}>
                    ...: Op.:{payment.credit?.id} L.:
                    {operacion.split("-").pop() || ""} Ret.:NO
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: "bold", paddingBottom: "1mm" }}>Descripción</td>
                  <td style={{ paddingBottom: "1mm" }}>
                    ...: {descripcion.toUpperCase() || "CREDITO"}
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: "bold", paddingBottom: "1mm" }}>REFERENCIA 1</td>
                  <td style={{ paddingBottom: "1mm" }}>{payment.credit?.id || ""}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: "bold", paddingBottom: "1mm" }}>REFERENCIA 2</td>
                  <td style={{ paddingBottom: "1mm" }}>
                    {operacion.split("-").slice(0, -1).join("-") || ""}
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: "bold", paddingBottom: "1mm" }}>REFERENCIA 3</td>
                  <td style={{ paddingBottom: "1mm" }}>{debtorCedula}</td>
                </tr>
              </tbody>
            </table>
            <div
              style={{
                marginTop: "3mm",
                padding: "2mm",
                backgroundColor: "#f5f5f5",
                fontSize: "8pt",
              }}
            >
              <strong>Notas:</strong>{" "}
              {saldoActual > 0
                ? "Su Plan de Crédito Presenta Cuotas Pendientes al Corte"
                : "Crédito al día"}
            </div>
          </div>
        </div>

        {/* DETALLE DE LOS VALORES APLICADOS */}
        <p
          style={{
            fontWeight: "bold",
            marginBottom: "2mm",
            fontSize: "10pt",
          }}
        >
          DETALLE DE LOS VALORES APLICADOS
        </p>

        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "8pt",
            marginBottom: "3mm",
          }}
        >
          <thead>
            <tr style={{ borderTop: "1px solid #000", borderBottom: "1px solid #000" }}>
              <th style={{ padding: "2mm 1mm", textAlign: "left" }}>LN/</th>
              <th style={{ padding: "2mm 1mm", textAlign: "left" }}>CAJA / APERTURA</th>
              <th style={{ padding: "2mm 1mm", textAlign: "left" }}>FORMA DE PAGO</th>
              <th style={{ padding: "2mm 1mm", textAlign: "left" }}>DIVISA</th>
              <th style={{ padding: "2mm 1mm", textAlign: "center" }}>T.C.</th>
              <th style={{ padding: "2mm 1mm", textAlign: "right" }}>MONTO DOCUMENTO</th>
              <th style={{ padding: "2mm 1mm", textAlign: "right" }}>MONTO APLICADO</th>
              <th style={{ padding: "2mm 1mm", textAlign: "left" }}>REFERENCIAS</th>
              <th style={{ padding: "2mm 1mm", textAlign: "center" }}>S.F.</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: "1px solid #ccc" }}>
              <td style={{ padding: "1mm" }}>1</td>
              <td style={{ padding: "1mm" }}>CA_01</td>
              <td style={{ padding: "1mm" }}>
                {payment.source === "Planilla" ? "PLANILLA" : "DEPOSITOS"}
              </td>
              <td style={{ padding: "1mm" }}>COL</td>
              <td style={{ padding: "1mm", textAlign: "center" }}>1.00</td>
              <td style={{ padding: "1mm", textAlign: "right" }}>
                {formatCurrency(montoTotal)}
              </td>
              <td style={{ padding: "1mm", textAlign: "right" }}>
                {formatCurrency(montoTotal)}
              </td>
              <td style={{ padding: "1mm", fontSize: "7pt" }}>
                DP.: {debtorCedula} Cuenta.:00103399010 Fecha.:{formatDate(fechaPago)}
              </td>
              <td style={{ padding: "1mm", textAlign: "center" }}>0</td>
            </tr>
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "2px solid #000" }}>
              <td colSpan={6} style={{ textAlign: "right", padding: "2mm 1mm", fontWeight: "bold" }}>
                Total:
              </td>
              <td style={{ textAlign: "right", padding: "2mm 1mm", fontWeight: "bold" }}>
                {formatCurrency(montoTotal)}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
