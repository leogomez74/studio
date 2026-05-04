import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '@/lib/axios';

export const generateEstadoCuenta = async (creditId: number) => {
  let credit: any;
  try {
    const res = await api.get(`/api/credits/${creditId}`);
    credit = res.data;
  } catch (e) {
    console.error('Error fetching credit for estado de cuenta', e);
    return;
  }

  const doc = new jsPDF({ orientation: 'landscape' });
  const currentDate = new Date().toLocaleDateString('es-CR');
  const pageW = 297;
  const pageH = 210;
  const margin = 14;
  const lineEnd = pageW - margin;
  const HEADER_H = 38;
  const FOOTER_H = 22;
  const CONTENT_BOTTOM = pageH - FOOTER_H - 4;

  const BLUE: [number, number, number] = [25, 75, 148];
  const GREEN: [number, number, number] = [147, 186, 57];

  const formatDatePDF = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('es-CR');
  };
  const fmtNum = (v: number) =>
    new Intl.NumberFormat('es-CR', { style: 'decimal', minimumFractionDigits: 2 }).format(v || 0);

  const loadImg = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  let headerImg: HTMLImageElement | null = null;
  let footerImg: HTMLImageElement | null = null;
  try {
    [headerImg, footerImg] = await Promise.all([
      loadImg('/header_pep.jpg'),
      loadImg('/footer_pep.png'),
    ]);
  } catch { /* usa diseño simple si no cargan */ }

  // ── HEADER ──
  if (headerImg) {
    doc.addImage(headerImg, 'JPEG', 0, 0, pageW, HEADER_H);
  } else {
    doc.setFillColor(...BLUE);
    doc.rect(0, 0, pageW, HEADER_H, 'F');
  }
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('ESTADO DE CUENTA', margin + 4, 18);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(210, 230, 255);
  doc.text(`REPORTE AL ${currentDate}`, margin + 4, 26);
  doc.setTextColor(0, 0, 0);

  // ── FOOTER ──
  if (footerImg) {
    doc.addImage(footerImg, 'PNG', 0, pageH - FOOTER_H, pageW, FOOTER_H);
  } else {
    doc.setFillColor(...BLUE);
    doc.rect(0, pageH - FOOTER_H, pageW, FOOTER_H, 'F');
  }

  // ── INFO DEL CLIENTE ──
  const infoY = HEADER_H + 8;
  const lead = credit.lead || {};
  const clientName =
    [lead.name, lead.apellido1, lead.apellido2].filter(Boolean).join(' ') || 'CLIENTE';

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BLUE);
  doc.text('N° Cuenta:', margin, infoY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(`${credit.lead_id || '-'}`, margin + 22, infoY);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BLUE);
  doc.text('Cliente:', margin, infoY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(clientName.toUpperCase(), margin + 22, infoY + 6);

  const rightCol = 155;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BLUE);
  doc.text('Inst./Empresa:', rightCol, infoY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(`${lead.institucion_labora || lead.ocupacion || '-'}`, rightCol + 32, infoY);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BLUE);
  doc.text('Sección:', rightCol, infoY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(`${lead.puesto || '-'}`, rightCol + 32, infoY + 6);

  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.3);
  doc.line(margin, infoY + 10, lineEnd, infoY + 10);

  // ── CRÉDITOS ──
  let finalY = infoY + 16;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BLUE);
  doc.text('Créditos / Otras deducciones', margin, finalY);
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.3);
  doc.line(margin, finalY + 2, lineEnd, finalY + 2);
  doc.setTextColor(0, 0, 0);

  const tasaValue = credit.tasa_anual ?? credit.tasa?.tasa ?? '0.00';

  // Morosidad = suma de intereses moratorios + corrientes vencidos de cuotas no pagadas
  const montoMora = (credit.plan_de_pagos || [])
    .filter((p: any) => !['Pagado', 'Pagada'].includes(p.estado || '') && p.numero_cuota > 0)
    .reduce((s: number, p: any) =>
      s + Number(p.interes_moratorio || 0) + Number(p.int_corriente_vencido || 0), 0);

  // Días de atraso: siempre calculado desde fecha_corte hasta HOY (preciso al día)
  const cuotaVencida: any = (credit.plan_de_pagos || []).find(
    (p: any) => (p.estado === 'Mora' || p.estado === 'Parcial') && p.numero_cuota > 0
  );
  let diasAtraso = 0;
  if (cuotaVencida?.fecha_corte) {
    const fc = new Date(cuotaVencida.fecha_corte);
    const hoy = new Date();
    if (fc < hoy) diasAtraso = Math.floor((hoy.getTime() - fc.getTime()) / 86400000);
  }

  autoTable(doc, {
    startY: finalY + 4,
    head: [['OPERACIÓN', 'LINEA', 'MONTO', 'PLAZO', 'CUOTA', 'SALDO', 'TASA', 'MOROSIDAD', 'PRI.DED', 'ULT.MOV', 'TERMINA', 'PROCESO', 'DÍAS ATRASO']],
    body: [[
      credit.numero_operacion || credit.reference,
      credit.linea || credit.category || 'Crédito',
      fmtNum(credit.monto_credito),
      credit.plazo || 120,
      fmtNum(credit.cuota),
      fmtNum(credit.saldo),
      `${Number(tasaValue).toFixed(2)}%`,
      montoMora > 0 ? fmtNum(montoMora) : '0.00',
      credit.primera_deduccion || '-',
      new Date().toISOString().split('T')[0],
      (credit.fecha_culminacion_credito || '-').split('T')[0].split(' ')[0],
      credit.status || 'Formalizado',
      diasAtraso > 0 ? `${diasAtraso}` : '-',
    ]],
    theme: 'plain',
    styles: { fontSize: 7.5, cellPadding: 1.5 },
    headStyles: { fontStyle: 'bold', textColor: [255, 255, 255], fillColor: GREEN, fontSize: 6.5, cellPadding: 1.2 },
    alternateRowStyles: { fillColor: [240, 247, 220] },
    columnStyles: {
      0: { cellWidth: 27 }, 1: { cellWidth: 22 }, 2: { cellWidth: 21 }, 3: { cellWidth: 11 },
      4: { cellWidth: 19 }, 5: { cellWidth: 21 }, 6: { cellWidth: 13 }, 7: { cellWidth: 21 },
      8: { cellWidth: 17 }, 9: { cellWidth: 19 }, 10: { cellWidth: 19 }, 11: { cellWidth: 18 },
      12: { cellWidth: 19 },
    },
  });

  // ── FIANZAS ──
  finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  if (finalY + 14 < CONTENT_BOTTOM) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BLUE);
    doc.text('Fianzas', margin, finalY);
    doc.setDrawColor(...BLUE);
    doc.setLineWidth(0.3);
    doc.line(margin, finalY + 2, lineEnd, finalY + 2);
    doc.setTextColor(0, 0, 0);
  }

  // ── PLAN DE PAGOS ──
  const plan = credit.plan_de_pagos || [];
  const creditEnMora = credit.status === 'En Mora';
  // Solo mostrar cuotas Pagado, Mora y Parcial — NO Pendiente
  const cuotasPagadas = plan.filter((p: any) =>
    p.numero_cuota > 0 &&
    ['Pagado', 'Pagada', 'Parcial', 'Mora'].includes(p.estado || '')
  );
  finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY
    ? (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14
    : finalY + 14;

  if (finalY + 20 < CONTENT_BOTTOM) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BLUE);
    doc.text('Plan de Pagos', margin, finalY);
    doc.setDrawColor(...BLUE);
    doc.setLineWidth(0.3);
    doc.line(margin, finalY + 2, lineEnd, finalY + 2);
    doc.setTextColor(0, 0, 0);

    if (cuotasPagadas.length > 0) {
      const paymentRows = cuotasPagadas.map((p: any) => {
        const saldo = Number(p.saldo_nuevo || 0) > 0
          ? Number(p.saldo_nuevo)
          : Math.max(0, Number(p.saldo_anterior || 0) - Number(p.amortizacion || 0));
        // Interés total = corriente + vencido + moratorio
        const intTotal = Number(p.interes_corriente || 0)
          + Number(p.int_corriente_vencido || 0)
          + Number(p.interes_moratorio || 0);
        // Saldo = limpio sin mora ni interés vencido acumulado
        const saldoLimpio = Math.max(0, Number(p.saldo_anterior || 0) - Math.max(0, Number(p.amortizacion || 0)));
        return [
          p.numero_cuota,
          formatDatePDF(p.fecha_corte),
          formatDatePDF(p.fecha_pago),
          fmtNum(p.cuota),
          fmtNum(intTotal),
          fmtNum(p.amortizacion),
          fmtNum(saldoLimpio),
          p.estado,
        ];
      });
      autoTable(doc, {
        startY: finalY + 4,
        margin: { bottom: FOOTER_H + 4 },
        head: [['#', 'FECHA CUOTA', 'FECHA PAGO', 'CUOTA', 'CUOTA INTERÉS', 'AMORTIZACIÓN', 'SALDO', 'ESTADO']],
        body: paymentRows,
        theme: 'striped',
        styles: { fontSize: 7.5, cellPadding: 1.5 },
        headStyles: { fontStyle: 'bold', textColor: [255, 255, 255], fillColor: GREEN },
        alternateRowStyles: { fillColor: [240, 247, 220] },
      });
    } else {
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 100, 100);
      doc.text('*** NO HAY CUOTAS CANCELADAS A LA FECHA ***', margin, finalY + 10);
      doc.setTextColor(0, 0, 0);
    }
  }

  // Texto informativo al pie
  const textoFinalY = (doc as any).lastAutoTable?.finalY
    ? Math.min((doc as any).lastAutoTable.finalY + 10, CONTENT_BOTTOM)
    : CONTENT_BOTTOM - 10;
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(80, 80, 80);
  doc.text(
    'El saldo reflejado en el presente documento es solo informativo y no debe ser utilizado para fines de cancelación.',
    margin, textoFinalY
  );
  doc.setTextColor(0, 0, 0);

  doc.save(`estado_cuenta_${credit.reference || credit.id}.pdf`);
};
