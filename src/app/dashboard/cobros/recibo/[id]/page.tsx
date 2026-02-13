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
          padding: "12mm 18mm",
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: "9.5pt",
          lineHeight: "1.5",
          color: "#1a1a1a",
        }}
      >
        {/* Header con línea decorativa */}
        <div style={{ borderBottom: "3px solid #1e3a5f", paddingBottom: "4mm", marginBottom: "6mm", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <h1 style={{ fontSize: "18pt", fontWeight: "700", margin: 0, color: "#1e3a5f", letterSpacing: "0.5px" }}>
              Comprobante de Aplicación
            </h1>
            <p style={{ margin: "1mm 0 0 0", fontSize: "8.5pt", color: "#666" }}>Oficina Central</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: "22pt", fontWeight: "700", margin: 0, color: "#1e3a5f" }}>N° {payment.id}</p>
          </div>
        </div>

        {/* Datos del cliente y operación */}
        <div style={{ display: "flex", gap: "8mm", marginBottom: "6mm" }}>
          <div style={{ flex: 2, backgroundColor: "#f8f9fb", borderRadius: "2mm", padding: "4mm 5mm", border: "1px solid #e2e6ea" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2mm" }}>
              <div>
                <span style={{ fontSize: "7.5pt", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px" }}>Cliente</span>
                <p style={{ margin: "0.5mm 0 0 0", fontWeight: "600", fontSize: "11pt" }}>{debtorName.toUpperCase()}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: "7.5pt", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px" }}>Cédula</span>
                <p style={{ margin: "0.5mm 0 0 0", fontWeight: "600", fontSize: "11pt" }}>{debtorCedula}</p>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <span style={{ fontSize: "7.5pt", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px" }}>Concepto</span>
                <p style={{ margin: "0.5mm 0 0 0", fontWeight: "500" }}>{sourceToConcepto(payment.source)}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: "7.5pt", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px" }}>Operación</span>
                <p style={{ margin: "0.5mm 0 0 0", fontWeight: "500" }}>{operacion}</p>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, backgroundColor: "#1e3a5f", borderRadius: "2mm", padding: "4mm 5mm", color: "#fff", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
            <span style={{ fontSize: "7.5pt", textTransform: "uppercase", letterSpacing: "0.5px", opacity: 0.8 }}>Monto Total</span>
            <p style={{ margin: "1mm 0 0 0", fontWeight: "700", fontSize: "16pt" }}>₡{formatCurrency(montoTotal)}</p>
            <span style={{ fontSize: "7.5pt", opacity: 0.7, marginTop: "1mm" }}>{formatDateTime(fechaPago)}</span>
          </div>
        </div>

        {/* Detalle financiero */}
        <div style={{ display: "flex", gap: "8mm", marginBottom: "6mm" }}>
          {/* Columna izquierda - Desglose */}
          <div style={{ flex: 1, border: "1px solid #dde1e6", borderRadius: "2mm", overflow: "hidden" }}>
            <div style={{ backgroundColor: "#f0f3f6", padding: "2.5mm 4mm", fontWeight: "600", fontSize: "9pt", color: "#1e3a5f", borderBottom: "1px solid #dde1e6" }}>
              Desglose del Pago
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {[
                  { label: "Saldo Anterior", value: saldoAnterior },
                  { label: "Saldo Actual", value: saldoActual },
                  { label: "Interés Corriente", value: interesCorriente },
                  { label: "Interés Moratorio", value: interesAtrasado },
                  { label: "Amortización", value: amortizacion },
                  { label: "Cargos Totales", value: 0 },
                  { label: "Pólizas", value: polizas },
                ].map((row, i) => (
                  <tr key={i} style={{ borderBottom: i < 6 ? "1px solid #eef0f3" : "none" }}>
                    <td style={{ padding: "2mm 4mm", color: "#555" }}>{row.label}</td>
                    <td style={{ padding: "2mm 4mm", textAlign: "right", fontWeight: "500", fontVariantNumeric: "tabular-nums" }}>
                      ₡{formatCurrency(row.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Columna derecha - Referencias */}
          <div style={{ flex: 1, border: "1px solid #dde1e6", borderRadius: "2mm", overflow: "hidden" }}>
            <div style={{ backgroundColor: "#f0f3f6", padding: "2.5mm 4mm", fontWeight: "600", fontSize: "9pt", color: "#1e3a5f", borderBottom: "1px solid #dde1e6" }}>
              Referencias de la Operación
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {[
                  { label: "Operación / Línea", value: `Op.:${payment.credit?.id} L.:${operacion.split("-").pop() || ""}` },
                  { label: "Descripción", value: descripcion.toUpperCase() || "CRÉDITO" },
                  { label: "Referencia 1", value: String(payment.credit?.id || "") },
                  { label: "Referencia 2", value: operacion.split("-").slice(0, -1).join("-") || "" },
                  { label: "Referencia 3", value: debtorCedula },
                ].map((row, i) => (
                  <tr key={i} style={{ borderBottom: i < 4 ? "1px solid #eef0f3" : "none" }}>
                    <td style={{ padding: "2mm 4mm", color: "#555", whiteSpace: "nowrap" }}>{row.label}</td>
                    <td style={{ padding: "2mm 4mm", fontWeight: "500" }}>{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ margin: "0 3mm 3mm 3mm", padding: "2.5mm 3mm", backgroundColor: saldoActual > 0 ? "#fff8e6" : "#e8f5e9", borderRadius: "1.5mm", fontSize: "8pt", color: saldoActual > 0 ? "#8a6d00" : "#2e7d32" }}>
              <strong>Nota:</strong>{" "}
              {saldoActual > 0
                ? "Su plan de crédito presenta cuotas pendientes al corte"
                : "Crédito al día"}
            </div>
          </div>
        </div>

        {/* Tabla de valores aplicados */}
        <div style={{ border: "1px solid #dde1e6", borderRadius: "2mm", overflow: "hidden" }}>
          <div style={{ backgroundColor: "#f0f3f6", padding: "2.5mm 4mm", fontWeight: "600", fontSize: "9pt", color: "#1e3a5f", borderBottom: "1px solid #dde1e6" }}>
            Detalle de Valores Aplicados
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8.5pt" }}>
            <thead>
              <tr style={{ backgroundColor: "#f8f9fb" }}>
                <th style={{ padding: "2.5mm 3mm", textAlign: "left", fontWeight: "600", color: "#555", borderBottom: "1px solid #dde1e6" }}>LN</th>
                <th style={{ padding: "2.5mm 3mm", textAlign: "left", fontWeight: "600", color: "#555", borderBottom: "1px solid #dde1e6" }}>Caja</th>
                <th style={{ padding: "2.5mm 3mm", textAlign: "left", fontWeight: "600", color: "#555", borderBottom: "1px solid #dde1e6" }}>Forma de Pago</th>
                <th style={{ padding: "2.5mm 3mm", textAlign: "left", fontWeight: "600", color: "#555", borderBottom: "1px solid #dde1e6" }}>Divisa</th>
                <th style={{ padding: "2.5mm 3mm", textAlign: "center", fontWeight: "600", color: "#555", borderBottom: "1px solid #dde1e6" }}>T.C.</th>
                <th style={{ padding: "2.5mm 3mm", textAlign: "right", fontWeight: "600", color: "#555", borderBottom: "1px solid #dde1e6" }}>Monto Documento</th>
                <th style={{ padding: "2.5mm 3mm", textAlign: "right", fontWeight: "600", color: "#555", borderBottom: "1px solid #dde1e6" }}>Monto Aplicado</th>
                <th style={{ padding: "2.5mm 3mm", textAlign: "left", fontWeight: "600", color: "#555", borderBottom: "1px solid #dde1e6" }}>Referencias</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: "2.5mm 3mm" }}>1</td>
                <td style={{ padding: "2.5mm 3mm" }}>CA_01</td>
                <td style={{ padding: "2.5mm 3mm" }}>
                  {payment.source === "Planilla" ? "Planilla" : "Depósito"}
                </td>
                <td style={{ padding: "2.5mm 3mm" }}>CRC</td>
                <td style={{ padding: "2.5mm 3mm", textAlign: "center" }}>1.00</td>
                <td style={{ padding: "2.5mm 3mm", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  ₡{formatCurrency(montoTotal)}
                </td>
                <td style={{ padding: "2.5mm 3mm", textAlign: "right", fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>
                  ₡{formatCurrency(montoTotal)}
                </td>
                <td style={{ padding: "2.5mm 3mm", fontSize: "7.5pt", color: "#666" }}>
                  DP: {debtorCedula} &middot; Cuenta: 00103399010 &middot; Fecha: {formatDate(fechaPago)}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid #1e3a5f" }}>
                <td colSpan={6} style={{ textAlign: "right", padding: "3mm 3mm", fontWeight: "700", color: "#1e3a5f" }}>
                  Total Aplicado:
                </td>
                <td style={{ textAlign: "right", padding: "3mm 3mm", fontWeight: "700", fontSize: "10pt", color: "#1e3a5f", fontVariantNumeric: "tabular-nums" }}>
                  ₡{formatCurrency(montoTotal)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
