'use client';

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Types
interface KPIData {
  value: number | string;
  change?: number;
  target?: number;
  unit?: string;
}

interface LeadKPIs {
  conversionRate: KPIData;
  responseTime: KPIData;
  leadAging: KPIData;
  leadsPerAgent: { agentName: string; count: number }[];
  leadSourcePerformance: { source: string; conversion: number; count: number }[];
  totalLeads?: number;
  totalClients?: number;
}

interface OpportunityKPIs {
  winRate: KPIData;
  pipelineValue: KPIData;
  avgSalesCycle: KPIData;
  velocity: KPIData;
  stageConversion: { stage: string; conversion: number }[];
}

interface CreditKPIs {
  disbursementVolume: KPIData;
  avgLoanSize: KPIData;
  portfolioAtRisk: KPIData;
  nonPerformingLoans: KPIData;
  approvalRate: KPIData;
  timeToDisbursement: KPIData;
  timeToFormalization: KPIData;
  fullCycleTime: KPIData;
  earlyCancellationRate: KPIData;
  extraordinaryPayments: KPIData;
  penaltyRevenue: KPIData;
  totalCredits?: number;
  totalPortfolio?: number;
}

interface CollectionKPIs {
  collectionRate: KPIData;
  dso: KPIData;
  delinquencyRate: KPIData;
  recoveryRate: KPIData;
  paymentTimeliness: KPIData;
  reversalRate: KPIData;
  pendingBalances: KPIData;
  paymentSourceDistribution: { source: string; count: number; total: number }[];
  deductoraEfficiency: { name: string; rate: number }[];
}

interface AgentKPIs {
  topAgents: {
    name: string;
    leadsHandled: number;
    conversionRate: number;
    creditsOriginated: number;
    avgDealSize: number;
    activityRate: number;
  }[];
}

interface GamificationKPIs {
  engagementRate: KPIData;
  pointsVelocity: KPIData;
  badgeCompletion: KPIData;
  challengeParticipation: KPIData;
  redemptionRate: KPIData;
  streakRetention: KPIData;
  leaderboardMovement: KPIData;
  levelDistribution: { level: number; count: number }[];
}

interface BusinessHealthKPIs {
  clv: KPIData;
  cac: KPIData;
  portfolioGrowth: KPIData;
  nps: KPIData;
  revenuePerEmployee: KPIData;
}

interface AllKPIData {
  leads: LeadKPIs | null;
  opportunities: OpportunityKPIs | null;
  credits: CreditKPIs | null;
  collections: CollectionKPIs | null;
  agents: AgentKPIs | null;
  gamification: GamificationKPIs | null;
  business: BusinessHealthKPIs | null;
}

// Helper to format currency
const formatCurrency = (value: number): string => {
  if (value >= 1000000000) return `₡${(value / 1000000000).toFixed(1)}B`;
  if (value >= 1000000) return `₡${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `₡${(value / 1000).toFixed(1)}K`;
  return `₡${value}`;
};

// Helper to format KPI value
const formatKPIValue = (kpi: KPIData | undefined): string => {
  if (!kpi) return 'N/A';
  const value = kpi.value;
  const unit = kpi.unit || '';
  if (unit === '₡') return formatCurrency(Number(value));
  return `${value}${unit}`;
};

// Export to Excel
export const exportToExcel = async (data: AllKPIData, period: string): Promise<void> => {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  const dateStr = new Date().toLocaleDateString('es-CR');

  // Summary Sheet
  const summaryData = [
    ['Reporte de KPIs', '', ''],
    ['Fecha de Generación', dateStr, ''],
    ['Período', period, ''],
    ['', '', ''],
    ['RESUMEN EJECUTIVO', '', ''],
    ['', '', ''],
    ['Categoría', 'KPI Principal', 'Valor'],
    ['Leads', 'Tasa de Conversión', formatKPIValue(data.leads?.conversionRate)],
    ['Oportunidades', 'Win Rate', formatKPIValue(data.opportunities?.winRate)],
    ['Créditos', 'Volumen Desembolsado', formatKPIValue(data.credits?.disbursementVolume)],
    ['Cobros', 'Tasa de Cobro', formatKPIValue(data.collections?.collectionRate)],
    ['Gamificación', 'Engagement', formatKPIValue(data.gamification?.engagementRate)],
    ['Negocio', 'CLV', formatKPIValue(data.business?.clv)],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');

  // Leads Sheet
  if (data.leads) {
    const leadsData = [
      ['GESTIÓN DE LEADS', '', ''],
      ['', '', ''],
      ['Métrica', 'Valor', 'Cambio vs Período Anterior'],
      ['Tasa de Conversión', formatKPIValue(data.leads.conversionRate), `${data.leads.conversionRate.change || 0}%`],
      ['Tiempo de Respuesta', formatKPIValue(data.leads.responseTime), `${data.leads.responseTime.change || 0}%`],
      ['Leads Envejecidos', formatKPIValue(data.leads.leadAging), ''],
      ['Total Leads', data.leads.totalLeads || 0, ''],
      ['Total Clientes', data.leads.totalClients || 0, ''],
      ['', '', ''],
      ['LEADS POR AGENTE', '', ''],
      ['Agente', 'Leads', ''],
      ...(data.leads.leadsPerAgent?.map(a => [a.agentName, a.count, '']) || []),
      ['', '', ''],
      ['RENDIMIENTO POR FUENTE', '', ''],
      ['Fuente', 'Leads', 'Conversión'],
      ...(data.leads.leadSourcePerformance?.map(s => [s.source, s.count, `${s.conversion}%`]) || []),
    ];
    const leadsSheet = XLSX.utils.aoa_to_sheet(leadsData);
    XLSX.utils.book_append_sheet(workbook, leadsSheet, 'Leads');
  }

  // Opportunities Sheet
  if (data.opportunities) {
    const oppData = [
      ['OPORTUNIDADES', '', ''],
      ['', '', ''],
      ['Métrica', 'Valor', 'Cambio vs Período Anterior'],
      ['Win Rate', formatKPIValue(data.opportunities.winRate), `${data.opportunities.winRate.change || 0}%`],
      ['Pipeline Value', formatKPIValue(data.opportunities.pipelineValue), `${data.opportunities.pipelineValue.change || 0}%`],
      ['Ciclo de Venta Promedio', formatKPIValue(data.opportunities.avgSalesCycle), `${data.opportunities.avgSalesCycle.change || 0}%`],
      ['Velocidad de Pipeline', data.opportunities.velocity.value, `${data.opportunities.velocity.change || 0}%`],
      ['', '', ''],
      ['CONVERSIÓN POR ETAPA', '', ''],
      ['Etapa', 'Conversión', ''],
      ...(data.opportunities.stageConversion?.map(s => [s.stage, `${s.conversion}%`, '']) || []),
    ];
    const oppSheet = XLSX.utils.aoa_to_sheet(oppData);
    XLSX.utils.book_append_sheet(workbook, oppSheet, 'Oportunidades');
  }

  // Credits Sheet
  if (data.credits) {
    const creditsData = [
      ['CRÉDITOS', '', ''],
      ['', '', ''],
      ['Métrica', 'Valor', 'Cambio vs Período Anterior'],
      ['Volumen de Desembolso', formatKPIValue(data.credits.disbursementVolume), `${data.credits.disbursementVolume.change || 0}%`],
      ['Tamaño Promedio de Crédito', formatKPIValue(data.credits.avgLoanSize), `${data.credits.avgLoanSize.change || 0}%`],
      ['Cartera en Riesgo (PAR)', formatKPIValue(data.credits.portfolioAtRisk), `${data.credits.portfolioAtRisk.change || 0}%`],
      ['Créditos Morosos (NPL)', data.credits.nonPerformingLoans.value, `${data.credits.nonPerformingLoans.change || 0}%`],
      ['Tasa de Aprobación', formatKPIValue(data.credits.approvalRate), `${data.credits.approvalRate.change || 0}%`],
      ['Tiempo de Desembolso', formatKPIValue(data.credits.timeToDisbursement), `${data.credits.timeToDisbursement.change || 0}%`],
      ['Tiempo a Formalización', formatKPIValue(data.credits.timeToFormalization), `${data.credits.timeToFormalization?.change || 0}%`],
      ['Ciclo Completo', formatKPIValue(data.credits.fullCycleTime), `${data.credits.fullCycleTime?.change || 0}%`],
      ['Cancelación Anticipada', formatKPIValue(data.credits.earlyCancellationRate), `${data.credits.earlyCancellationRate?.change || 0}%`],
      ['Abonos Extraordinarios', formatKPIValue(data.credits.extraordinaryPayments), `${data.credits.extraordinaryPayments?.change || 0}%`],
      ['Ingresos por Penalización', formatKPIValue(data.credits.penaltyRevenue), `${data.credits.penaltyRevenue?.change || 0}%`],
      ['Total Créditos', data.credits.totalCredits || 0, ''],
      ['Total Cartera', formatCurrency(data.credits.totalPortfolio || 0), ''],
    ];
    const creditsSheet = XLSX.utils.aoa_to_sheet(creditsData);
    XLSX.utils.book_append_sheet(workbook, creditsSheet, 'Créditos');
  }

  // Collections Sheet
  if (data.collections) {
    const collectionsData = [
      ['COBROS', '', ''],
      ['', '', ''],
      ['Métrica', 'Valor', 'Cambio vs Período Anterior'],
      ['Tasa de Cobro', formatKPIValue(data.collections.collectionRate), `${data.collections.collectionRate.change || 0}%`],
      ['DSO', formatKPIValue(data.collections.dso), `${data.collections.dso.change || 0}%`],
      ['Tasa de Morosidad', formatKPIValue(data.collections.delinquencyRate), `${data.collections.delinquencyRate.change || 0}%`],
      ['Tasa de Recuperación', formatKPIValue(data.collections.recoveryRate), `${data.collections.recoveryRate.change || 0}%`],
      ['Puntualidad de Pagos', formatKPIValue(data.collections.paymentTimeliness), `${data.collections.paymentTimeliness.change || 0}%`],
      ['Tasa de Reversiones', formatKPIValue(data.collections.reversalRate), `${data.collections.reversalRate?.change || 0}%`],
      ['Saldos Pendientes', formatKPIValue(data.collections.pendingBalances), `${data.collections.pendingBalances?.change || 0}%`],
      ['', '', ''],
      ['DISTRIBUCIÓN POR FUENTE DE PAGO', '', ''],
      ['Fuente', 'Cantidad', 'Monto Total'],
      ...(data.collections.paymentSourceDistribution?.map(s => [s.source, s.count, formatCurrency(s.total)]) || []),
      ['', '', ''],
      ['EFICIENCIA POR DEDUCTORA', '', ''],
      ['Deductora', 'Tasa de Cobro', ''],
      ...(data.collections.deductoraEfficiency?.map(d => [d.name, `${d.rate}%`, '']) || []),
    ];
    const collectionsSheet = XLSX.utils.aoa_to_sheet(collectionsData);
    XLSX.utils.book_append_sheet(workbook, collectionsSheet, 'Cobros');
  }

  // Agents Sheet
  if (data.agents?.topAgents) {
    const agentsData = [
      ['RENDIMIENTO DE AGENTES', '', '', '', '', ''],
      ['', '', '', '', '', ''],
      ['Agente', 'Leads', 'Conversión', 'Créditos', 'Monto Promedio', 'Actividad/día'],
      ...data.agents.topAgents.map(a => [
        a.name,
        a.leadsHandled,
        `${a.conversionRate}%`,
        a.creditsOriginated,
        formatCurrency(a.avgDealSize),
        a.activityRate || 0,
      ]),
    ];
    const agentsSheet = XLSX.utils.aoa_to_sheet(agentsData);
    XLSX.utils.book_append_sheet(workbook, agentsSheet, 'Agentes');
  }

  // Gamification Sheet
  if (data.gamification) {
    const gamificationData = [
      ['GAMIFICACIÓN', '', ''],
      ['', '', ''],
      ['Métrica', 'Valor', 'Cambio vs Período Anterior'],
      ['Tasa de Engagement', formatKPIValue(data.gamification.engagementRate), `${data.gamification.engagementRate.change || 0}%`],
      ['Velocidad de Puntos', formatKPIValue(data.gamification.pointsVelocity), `${data.gamification.pointsVelocity.change || 0}%`],
      ['Badges Completados', formatKPIValue(data.gamification.badgeCompletion), `${data.gamification.badgeCompletion.change || 0}%`],
      ['Participación en Challenges', data.gamification.challengeParticipation.value, `${data.gamification.challengeParticipation.change || 0}%`],
      ['Tasa de Canje', formatKPIValue(data.gamification.redemptionRate), `${data.gamification.redemptionRate.change || 0}%`],
      ['Retención de Rachas', formatKPIValue(data.gamification.streakRetention), `${data.gamification.streakRetention.change || 0}%`],
      ['Movimiento en Leaderboard', formatKPIValue(data.gamification.leaderboardMovement), `${data.gamification.leaderboardMovement?.change || 0}%`],
      ['', '', ''],
      ['DISTRIBUCIÓN POR NIVEL', '', ''],
      ['Nivel', 'Usuarios', ''],
      ...(data.gamification.levelDistribution?.map(l => [`Nivel ${l.level}`, l.count, '']) || []),
    ];
    const gamificationSheet = XLSX.utils.aoa_to_sheet(gamificationData);
    XLSX.utils.book_append_sheet(workbook, gamificationSheet, 'Gamificación');
  }

  // Business Health Sheet
  if (data.business) {
    const businessData = [
      ['SALUD DEL NEGOCIO', '', ''],
      ['', '', ''],
      ['Métrica', 'Valor', 'Cambio vs Período Anterior'],
      ['Customer Lifetime Value (CLV)', formatKPIValue(data.business.clv), `${data.business.clv.change || 0}%`],
      ['Customer Acquisition Cost (CAC)', formatKPIValue(data.business.cac), `${data.business.cac.change || 0}%`],
      ['Crecimiento de Cartera', formatKPIValue(data.business.portfolioGrowth), `${data.business.portfolioGrowth.change || 0}%`],
      ['Net Promoter Score (NPS)', data.business.nps?.value || 0, `${data.business.nps?.change || 0}%`],
      ['Ingreso por Empleado', formatCurrency(Number(data.business.revenuePerEmployee?.value) || 0), `${data.business.revenuePerEmployee?.change || 0}%`],
      ['', '', ''],
      ['Ratio CLV:CAC', `${((Number(data.business.clv.value) || 1) / (Number(data.business.cac.value) || 1)).toFixed(1)}:1`, ''],
    ];
    const businessSheet = XLSX.utils.aoa_to_sheet(businessData);
    XLSX.utils.book_append_sheet(workbook, businessSheet, 'Negocio');
  }

  // Download
  const fileName = `KPIs_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};

// Export to PDF
export const exportToPDF = (data: AllKPIData, period: string): void => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Title
  doc.setFontSize(20);
  doc.setTextColor(30, 41, 59);
  doc.text('Reporte de KPIs', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  // Subtitle
  doc.setFontSize(12);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generado: ${new Date().toLocaleDateString('es-CR')} | Período: ${period}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  // Summary Section
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text('Resumen Ejecutivo', 14, yPos);
  yPos += 5;

  const summaryRows = [
    ['Leads', 'Tasa de Conversión', formatKPIValue(data.leads?.conversionRate)],
    ['Oportunidades', 'Win Rate', formatKPIValue(data.opportunities?.winRate)],
    ['Créditos', 'Volumen Desembolsado', formatKPIValue(data.credits?.disbursementVolume)],
    ['Cobros', 'Tasa de Cobro', formatKPIValue(data.collections?.collectionRate)],
    ['Gamificación', 'Engagement', formatKPIValue(data.gamification?.engagementRate)],
    ['Negocio', 'CLV', formatKPIValue(data.business?.clv)],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [['Categoría', 'KPI Principal', 'Valor']],
    body: summaryRows,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246], textColor: 255 },
    styles: { fontSize: 10 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Leads Section
  if (data.leads) {
    doc.setFontSize(14);
    doc.text('Gestión de Leads', 14, yPos);
    yPos += 5;

    const leadsRows = [
      ['Tasa de Conversión', formatKPIValue(data.leads.conversionRate), `${data.leads.conversionRate.change || 0}%`],
      ['Tiempo de Respuesta', formatKPIValue(data.leads.responseTime), `${data.leads.responseTime.change || 0}%`],
      ['Leads Envejecidos', formatKPIValue(data.leads.leadAging), '-'],
      ['Total Leads', String(data.leads.totalLeads || 0), '-'],
      ['Total Clientes', String(data.leads.totalClients || 0), '-'],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [['Métrica', 'Valor', 'Cambio']],
      body: leadsRows,
      theme: 'striped',
      headStyles: { fillColor: [34, 197, 94], textColor: 255 },
      styles: { fontSize: 9 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Credits Section
  if (data.credits) {
    // Check if we need a new page
    if (yPos > 220) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.text('Créditos', 14, yPos);
    yPos += 5;

    const creditsRows = [
      ['Volumen de Desembolso', formatKPIValue(data.credits.disbursementVolume), `${data.credits.disbursementVolume.change || 0}%`],
      ['Tamaño Promedio', formatKPIValue(data.credits.avgLoanSize), `${data.credits.avgLoanSize.change || 0}%`],
      ['Cartera en Riesgo', formatKPIValue(data.credits.portfolioAtRisk), `${data.credits.portfolioAtRisk.change || 0}%`],
      ['Créditos Morosos', String(data.credits.nonPerformingLoans.value), `${data.credits.nonPerformingLoans.change || 0}%`],
      ['Tasa de Aprobación', formatKPIValue(data.credits.approvalRate), `${data.credits.approvalRate.change || 0}%`],
      ['Tiempo a Formalización', formatKPIValue(data.credits.timeToFormalization), `${data.credits.timeToFormalization?.change || 0}%`],
      ['Ciclo Completo', formatKPIValue(data.credits.fullCycleTime), `${data.credits.fullCycleTime?.change || 0}%`],
      ['Cancelación Anticipada', formatKPIValue(data.credits.earlyCancellationRate), `${data.credits.earlyCancellationRate?.change || 0}%`],
      ['Abonos Extraordinarios', formatKPIValue(data.credits.extraordinaryPayments), `${data.credits.extraordinaryPayments?.change || 0}%`],
      ['Ingresos por Penalización', formatKPIValue(data.credits.penaltyRevenue), `${data.credits.penaltyRevenue?.change || 0}%`],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [['Métrica', 'Valor', 'Cambio']],
      body: creditsRows,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      styles: { fontSize: 9 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Collections Section
  if (data.collections) {
    if (yPos > 220) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.text('Cobros', 14, yPos);
    yPos += 5;

    const collectionsRows = [
      ['Tasa de Cobro', formatKPIValue(data.collections.collectionRate), `${data.collections.collectionRate.change || 0}%`],
      ['DSO', formatKPIValue(data.collections.dso), `${data.collections.dso.change || 0}%`],
      ['Tasa de Morosidad', formatKPIValue(data.collections.delinquencyRate), `${data.collections.delinquencyRate.change || 0}%`],
      ['Tasa de Recuperación', formatKPIValue(data.collections.recoveryRate), `${data.collections.recoveryRate.change || 0}%`],
      ['Tasa de Reversiones', formatKPIValue(data.collections.reversalRate), `${data.collections.reversalRate?.change || 0}%`],
      ['Saldos Pendientes', formatKPIValue(data.collections.pendingBalances), `${data.collections.pendingBalances?.change || 0}%`],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [['Métrica', 'Valor', 'Cambio']],
      body: collectionsRows,
      theme: 'striped',
      headStyles: { fillColor: [139, 92, 246], textColor: 255 },
      styles: { fontSize: 9 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Agents Section
  if (data.agents?.topAgents && data.agents.topAgents.length > 0) {
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.text('Top Agentes', 14, yPos);
    yPos += 5;

    const agentsRows = data.agents.topAgents.slice(0, 5).map(a => [
      a.name,
      String(a.leadsHandled),
      `${a.conversionRate}%`,
      String(a.creditsOriginated),
      formatCurrency(a.avgDealSize),
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Agente', 'Leads', 'Conv.', 'Créditos', 'Monto Prom.']],
      body: agentsRows,
      theme: 'striped',
      headStyles: { fillColor: [245, 158, 11], textColor: 255 },
      styles: { fontSize: 8 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Business Health Section
  if (data.business) {
    if (yPos > 220) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.text('Salud del Negocio', 14, yPos);
    yPos += 5;

    const clvCacRatio = ((Number(data.business.clv.value) || 1) / (Number(data.business.cac.value) || 1)).toFixed(1);

    const businessRows = [
      ['Customer Lifetime Value (CLV)', formatKPIValue(data.business.clv), `${data.business.clv.change || 0}%`],
      ['Customer Acquisition Cost (CAC)', formatKPIValue(data.business.cac), `${data.business.cac.change || 0}%`],
      ['Crecimiento de Cartera', formatKPIValue(data.business.portfolioGrowth), `${data.business.portfolioGrowth.change || 0}%`],
      ['Net Promoter Score (NPS)', String(data.business.nps?.value || 0), `${data.business.nps?.change || 0}%`],
      ['Ingreso por Empleado', formatCurrency(Number(data.business.revenuePerEmployee?.value) || 0), `${data.business.revenuePerEmployee?.change || 0}%`],
      ['Ratio CLV:CAC', `${clvCacRatio}:1`, '-'],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [['Métrica', 'Valor', 'Cambio']],
      body: businessRows,
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129], textColor: 255 },
      styles: { fontSize: 9 },
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Página ${i} de ${pageCount} | Generado automáticamente`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  // Download
  const fileName = `KPIs_Report_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};
