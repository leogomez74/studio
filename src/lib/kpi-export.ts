'use client';

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type ExcelJS from 'exceljs';

// ============ TYPES ============
interface KPIData {
  value: number | string;
  change?: number;
  target?: number;
  unit?: string;
  count?: number;
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
  creditTypeComparison: { type: string; total: number; won: number; lost: number; winRate: number; pipeline: number }[];
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
    tasksAssigned: number;
    tasksCompleted: number;
    taskCompletionRate: number;
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

interface TrendDataPoint {
  month: string;
  fullMonth?: string;
  value: number;
}

interface TrendData {
  conversionRate: TrendDataPoint[];
  disbursementVolume: TrendDataPoint[];
  collectionRate: TrendDataPoint[];
  portfolioGrowth: TrendDataPoint[];
  delinquencyRate: TrendDataPoint[];
  leadsCount: TrendDataPoint[];
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

// ============ HELPERS ============
const formatCurrency = (value: number): string => {
  if (value >= 1000000000) return `₡${(value / 1000000000).toFixed(1)}B`;
  if (value >= 1000000) return `₡${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `₡${(value / 1000).toFixed(1)}K`;
  return `₡${value}`;
};

const formatKPIValue = (kpi: KPIData | undefined): string => {
  if (!kpi) return 'N/A';
  const value = kpi.value;
  const unit = kpi.unit || '';
  if (unit === '₡') return formatCurrency(Number(value));
  return `${value}${unit}`;
};

// ============ EXCEL THEME ============
const THEME = {
  colors: {
    primary:      'FF3B82F6',
    success:      'FF22C55E',
    danger:       'FFEF4444',
    warning:      'FFF59E0B',
    purple:       'FF8B5CF6',
    emerald:      'FF10B981',
    orange:       'FFF97316',
    cyan:         'FF06B6D4',
    headerBg:     'FF1E293B',
    subHeaderBg:  'FFF1F5F9',
    subHeaderText:'FF334155',
    tableBorder:  'FFE2E8F0',
    lightGray:    'FFF8FAFC',
    bodyText:     'FF1E293B',
    mutedText:    'FF94A3B8',
    white:        'FFFFFFFF',
    successLight: 'FFDCFCE7',
    dangerLight:  'FFFEE2E2',
    warningLight: 'FFFEF3C7',
    primaryLight: 'FFDBEAFE',
    purpleLight:  'FFEDE9FE',
    emeraldLight: 'FFD1FAE5',
  },
};

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: THEME.colors.tableBorder } },
  bottom: { style: 'thin', color: { argb: THEME.colors.tableBorder } },
  left: { style: 'thin', color: { argb: THEME.colors.tableBorder } },
  right: { style: 'thin', color: { argb: THEME.colors.tableBorder } },
};

// ============ EXCEL HELPERS ============
function applySheetDefaults(ws: ExcelJS.Worksheet): void {
  ws.getColumn(1).width = 3;
  ws.properties.defaultRowHeight = 20;
  ws.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
  };
}

function addSheetTitle(ws: ExcelJS.Worksheet, title: string, subtitle: string, colSpan: number): number {
  const S = 2; // start col B
  let row = 2;

  ws.mergeCells(row, S, row, S + colSpan - 1);
  const titleCell = ws.getCell(row, S);
  titleCell.value = title;
  titleCell.font = { name: 'Calibri', size: 18, bold: true, color: { argb: THEME.colors.bodyText } };
  titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
  ws.getRow(row).height = 40;

  row++;
  ws.mergeCells(row, S, row, S + colSpan - 1);
  const subCell = ws.getCell(row, S);
  subCell.value = subtitle;
  subCell.font = { name: 'Calibri', size: 11, color: { argb: THEME.colors.mutedText } };
  subCell.alignment = { horizontal: 'left', vertical: 'middle' };

  row++;
  ws.getRow(row).height = 8;
  return row + 1;
}

function addSectionBanner(ws: ExcelJS.Worksheet, title: string, colorArgb: string, row: number, colSpan: number): number {
  const S = 2;
  ws.mergeCells(row, S, row, S + colSpan - 1);
  const cell = ws.getCell(row, S);
  cell.value = title;
  cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: THEME.colors.white } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorArgb } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  cell.border = thinBorder;
  ws.getRow(row).height = 28;
  return row + 1;
}

function addTableHeaders(ws: ExcelJS.Worksheet, headers: string[], row: number): number {
  const S = 2;
  headers.forEach((header, i) => {
    const cell = ws.getCell(row, S + i);
    cell.value = header;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: THEME.colors.subHeaderText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.colors.subHeaderBg } };
    cell.alignment = { horizontal: i === 0 ? 'left' : 'center', vertical: 'middle' };
    cell.border = thinBorder;
  });
  ws.getRow(row).height = 22;
  return row + 1;
}

function addKPIRow(ws: ExcelJS.Worksheet, label: string, value: string, change: number | undefined, row: number, isAlt: boolean): number {
  const S = 2;
  const bg = isAlt ? THEME.colors.lightGray : THEME.colors.white;

  // Label
  const labelCell = ws.getCell(row, S);
  labelCell.value = label;
  labelCell.font = { name: 'Calibri', size: 10, color: { argb: THEME.colors.bodyText } };
  labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
  labelCell.alignment = { horizontal: 'left', vertical: 'middle' };
  labelCell.border = thinBorder;

  // Value
  const valueCell = ws.getCell(row, S + 1);
  valueCell.value = value;
  valueCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: THEME.colors.bodyText } };
  valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
  valueCell.alignment = { horizontal: 'center', vertical: 'middle' };
  valueCell.border = thinBorder;

  // Change
  const changeCell = ws.getCell(row, S + 2);
  if (change !== undefined && change !== 0) {
    const isPositive = change > 0;
    const arrow = isPositive ? '\u25B2' : '\u25BC';
    changeCell.value = `${arrow} ${Math.abs(change)}%`;
    changeCell.font = {
      name: 'Calibri', size: 10, bold: true,
      color: { argb: isPositive ? THEME.colors.success : THEME.colors.danger },
    };
  } else {
    changeCell.value = '--';
    changeCell.font = { name: 'Calibri', size: 10, color: { argb: THEME.colors.mutedText } };
  }
  changeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
  changeCell.alignment = { horizontal: 'center', vertical: 'middle' };
  changeCell.border = thinBorder;

  return row + 1;
}

function addDataRow(ws: ExcelJS.Worksheet, values: (string | number)[], row: number, isAlt: boolean): number {
  const S = 2;
  const bg = isAlt ? THEME.colors.lightGray : THEME.colors.white;
  values.forEach((val, i) => {
    const cell = ws.getCell(row, S + i);
    cell.value = val;
    cell.font = { name: 'Calibri', size: 10, color: { argb: THEME.colors.bodyText }, bold: i === 0 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    cell.alignment = { horizontal: i === 0 ? 'left' : 'center', vertical: 'middle' };
    cell.border = thinBorder;
  });
  return row + 1;
}

function addSpacer(ws: ExcelJS.Worksheet, row: number): number {
  ws.getRow(row).height = 12;
  return row + 1;
}

function getStatusBadge(value: number, thresholds: { good: number; warning: number }, invert: boolean = false): { text: string; bg: string; fg: string } {
  const isGood = invert ? value <= thresholds.good : value >= thresholds.good;
  const isWarning = invert ? value <= thresholds.warning : value >= thresholds.warning;
  if (isGood) return { text: 'Excelente', bg: THEME.colors.successLight, fg: THEME.colors.success };
  if (isWarning) return { text: 'Bueno', bg: THEME.colors.warningLight, fg: THEME.colors.warning };
  return { text: 'Mejorar', bg: THEME.colors.dangerLight, fg: THEME.colors.danger };
}

function addBarCells(ws: ExcelJS.Worksheet, row: number, startCol: number, percentage: number, colorArgb: string, segments: number = 10): void {
  const filled = Math.round((Math.max(0, Math.min(100, percentage)) / 100) * segments);
  for (let i = 0; i < segments; i++) {
    const cell = ws.getCell(row, startCol + i);
    cell.fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: i < filled ? colorArgb : THEME.colors.subHeaderBg },
    };
    cell.border = {
      top: { style: 'thin', color: { argb: THEME.colors.tableBorder } },
      bottom: { style: 'thin', color: { argb: THEME.colors.tableBorder } },
      ...(i === 0 ? { left: { style: 'thin', color: { argb: THEME.colors.tableBorder } } } : {}),
      ...(i === segments - 1 ? { right: { style: 'thin', color: { argb: THEME.colors.tableBorder } } } : {}),
    };
    ws.getColumn(startCol + i).width = 2;
  }
}

// ============ SHEET BUILDERS ============

function buildResumenSheet(workbook: ExcelJS.Workbook, data: AllKPIData, subtitle: string): void {
  const ws = workbook.addWorksheet('Resumen', { properties: { tabColor: { argb: THEME.colors.primary } } });
  applySheetDefaults(ws);
  ws.getColumn(2).width = 20;
  ws.getColumn(3).width = 26;
  ws.getColumn(4).width = 18;
  ws.getColumn(5).width = 14;
  ws.getColumn(6).width = 14;
  for (let i = 7; i <= 16; i++) ws.getColumn(i).width = 2;

  let row = addSheetTitle(ws, 'Reporte de KPIs', subtitle, 5);
  row = addSectionBanner(ws, 'RESUMEN EJECUTIVO', THEME.colors.headerBg, row, 5);
  row = addTableHeaders(ws, ['Categoría', 'KPI Principal', 'Valor', 'Cambio', 'Estado'], row);

  const summaryItems: { category: string; kpi: string; data: KPIData | undefined; pct?: number }[] = [
    { category: 'Leads', kpi: 'Tasa de Conversión', data: data.leads?.conversionRate, pct: Number(data.leads?.conversionRate?.value) || 0 },
    { category: 'Oportunidades', kpi: 'Win Rate', data: data.opportunities?.winRate, pct: Number(data.opportunities?.winRate?.value) || 0 },
    { category: 'Créditos', kpi: 'Volumen Desembolsado', data: data.credits?.disbursementVolume },
    { category: 'Cobros', kpi: 'Tasa de Cobro', data: data.collections?.collectionRate, pct: Number(data.collections?.collectionRate?.value) || 0 },
    { category: 'Agentes', kpi: 'Top Agentes', data: undefined },
    { category: 'Gamificación', kpi: 'Engagement', data: data.gamification?.engagementRate, pct: Number(data.gamification?.engagementRate?.value) || 0 },
    { category: 'Negocio', kpi: 'CLV', data: data.business?.clv },
  ];

  summaryItems.forEach((item, i) => {
    const isAlt = i % 2 === 1;
    const bg = isAlt ? THEME.colors.lightGray : THEME.colors.white;
    const S = 2;

    // Category
    const catCell = ws.getCell(row, S);
    catCell.value = item.category;
    catCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: THEME.colors.bodyText } };
    catCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    catCell.alignment = { horizontal: 'left', vertical: 'middle' };
    catCell.border = thinBorder;

    // KPI name
    const kpiCell = ws.getCell(row, S + 1);
    kpiCell.value = item.kpi;
    kpiCell.font = { name: 'Calibri', size: 10, color: { argb: THEME.colors.bodyText } };
    kpiCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    kpiCell.alignment = { horizontal: 'left', vertical: 'middle' };
    kpiCell.border = thinBorder;

    // Value
    const valCell = ws.getCell(row, S + 2);
    valCell.value = item.category === 'Agentes' ? `${data.agents?.topAgents?.length || 0} agentes` : formatKPIValue(item.data);
    valCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: THEME.colors.bodyText } };
    valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    valCell.alignment = { horizontal: 'center', vertical: 'middle' };
    valCell.border = thinBorder;

    // Change
    const changeCell = ws.getCell(row, S + 3);
    const change = item.data?.change;
    if (change !== undefined && change !== 0) {
      const arrow = change > 0 ? '\u25B2' : '\u25BC';
      changeCell.value = `${arrow} ${Math.abs(change)}%`;
      changeCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: change > 0 ? THEME.colors.success : THEME.colors.danger } };
    } else {
      changeCell.value = '--';
      changeCell.font = { name: 'Calibri', size: 10, color: { argb: THEME.colors.mutedText } };
    }
    changeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    changeCell.alignment = { horizontal: 'center', vertical: 'middle' };
    changeCell.border = thinBorder;

    // Status badge
    const statusCell = ws.getCell(row, S + 4);
    if (item.pct !== undefined) {
      const badge = getStatusBadge(item.pct, { good: 50, warning: 25 });
      statusCell.value = badge.text;
      statusCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: badge.fg } };
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: badge.bg } };
    } else {
      statusCell.value = '--';
      statusCell.font = { name: 'Calibri', size: 10, color: { argb: THEME.colors.mutedText } };
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    }
    statusCell.alignment = { horizontal: 'center', vertical: 'middle' };
    statusCell.border = thinBorder;

    // Visual bar
    if (item.pct !== undefined) {
      addBarCells(ws, row, 7, item.pct, THEME.colors.primary);
    }

    row++;
  });
}

function buildLeadsSheet(workbook: ExcelJS.Workbook, leads: LeadKPIs, subtitle: string): void {
  const ws = workbook.addWorksheet('Leads', { properties: { tabColor: { argb: THEME.colors.success } } });
  applySheetDefaults(ws);
  ws.getColumn(2).width = 32;
  ws.getColumn(3).width = 18;
  ws.getColumn(4).width = 14;

  let row = addSheetTitle(ws, 'Gestión de Leads', subtitle, 3);
  row = addSectionBanner(ws, 'MÉTRICAS PRINCIPALES', THEME.colors.success, row, 3);
  row = addTableHeaders(ws, ['Métrica', 'Valor', 'Cambio'], row);

  const metrics: [string, KPIData | undefined][] = [
    ['Tasa de Conversión', leads.conversionRate],
    ['Tiempo de Respuesta', leads.responseTime],
    ['Leads Envejecidos', leads.leadAging],
  ];
  metrics.forEach(([label, kpi], i) => {
    row = addKPIRow(ws, label, formatKPIValue(kpi), kpi?.change, row, i % 2 === 1);
  });

  // Totals
  const S = 2;
  [['Total Leads', String(leads.totalLeads || 0)], ['Total Clientes', String(leads.totalClients || 0)]].forEach(([label, val], i) => {
    const bg = (metrics.length + i) % 2 === 1 ? THEME.colors.lightGray : THEME.colors.white;
    const lc = ws.getCell(row, S); lc.value = label;
    lc.font = { name: 'Calibri', size: 10, color: { argb: THEME.colors.bodyText } };
    lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    lc.alignment = { horizontal: 'left', vertical: 'middle' }; lc.border = thinBorder;
    const vc = ws.getCell(row, S + 1); vc.value = val;
    vc.font = { name: 'Calibri', size: 11, bold: true, color: { argb: THEME.colors.bodyText } };
    vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    vc.alignment = { horizontal: 'center', vertical: 'middle' }; vc.border = thinBorder;
    const ec = ws.getCell(row, S + 2); ec.value = '';
    ec.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }; ec.border = thinBorder;
    row++;
  });

  // Leads per Agent
  if (leads.leadsPerAgent?.length) {
    row = addSpacer(ws, row);
    row = addSectionBanner(ws, 'LEADS POR AGENTE', THEME.colors.emeraldLight, row, 3);
    ws.getCell(row - 1, S).font = { name: 'Calibri', size: 12, bold: true, color: { argb: THEME.colors.bodyText } };
    row = addTableHeaders(ws, ['Agente', 'Cantidad', '% del Total'], row);
    const total = leads.leadsPerAgent.reduce((sum, a) => sum + a.count, 0) || 1;
    leads.leadsPerAgent.forEach((agent, i) => {
      const pct = ((agent.count / total) * 100).toFixed(1);
      row = addDataRow(ws, [agent.agentName, agent.count, `${pct}%`], row, i % 2 === 1);
    });
  }

  // Lead Source Performance
  if (leads.leadSourcePerformance?.length) {
    row = addSpacer(ws, row);
    row = addSectionBanner(ws, 'RENDIMIENTO POR FUENTE', THEME.colors.emeraldLight, row, 3);
    ws.getCell(row - 1, S).font = { name: 'Calibri', size: 12, bold: true, color: { argb: THEME.colors.bodyText } };
    row = addTableHeaders(ws, ['Fuente', 'Leads', 'Conversión'], row);
    leads.leadSourcePerformance.forEach((src, i) => {
      const bg = i % 2 === 1 ? THEME.colors.lightGray : THEME.colors.white;
      const lc = ws.getCell(row, S); lc.value = src.source;
      lc.font = { name: 'Calibri', size: 10, bold: true, color: { argb: THEME.colors.bodyText } };
      lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      lc.alignment = { horizontal: 'left', vertical: 'middle' }; lc.border = thinBorder;

      const cc = ws.getCell(row, S + 1); cc.value = src.count;
      cc.font = { name: 'Calibri', size: 10, color: { argb: THEME.colors.bodyText } };
      cc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cc.alignment = { horizontal: 'center', vertical: 'middle' }; cc.border = thinBorder;

      // Conversion with color
      const convCell = ws.getCell(row, S + 2);
      convCell.value = `${src.conversion}%`;
      const badge = getStatusBadge(src.conversion, { good: 30, warning: 15 });
      convCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: badge.fg } };
      convCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: badge.bg } };
      convCell.alignment = { horizontal: 'center', vertical: 'middle' }; convCell.border = thinBorder;
      row++;
    });
  }
}

function buildOpportunitiesSheet(workbook: ExcelJS.Workbook, opp: OpportunityKPIs, subtitle: string): void {
  const ws = workbook.addWorksheet('Oportunidades', { properties: { tabColor: { argb: THEME.colors.primary } } });
  applySheetDefaults(ws);
  ws.getColumn(2).width = 30;
  ws.getColumn(3).width = 18;
  ws.getColumn(4).width = 14;
  ws.getColumn(5).width = 14;
  ws.getColumn(6).width = 14;
  ws.getColumn(7).width = 18;

  let row = addSheetTitle(ws, 'Oportunidades', subtitle, 3);
  row = addSectionBanner(ws, 'MÉTRICAS PRINCIPALES', THEME.colors.primary, row, 3);
  row = addTableHeaders(ws, ['Métrica', 'Valor', 'Cambio'], row);

  const metrics: [string, KPIData][] = [
    ['Porcentaje de Créditos Ganados', opp.winRate],
    ['Valor de la Cartera', opp.pipelineValue],
    ['Ciclo de Venta Promedio', opp.avgSalesCycle],
    ['Velocidad de Pipeline', opp.velocity],
  ];
  metrics.forEach(([label, kpi], i) => {
    const val = label.includes('Cartera') ? formatCurrency(Number(kpi.value) || 0) : formatKPIValue(kpi);
    row = addKPIRow(ws, label, val, kpi.change, row, i % 2 === 1);
  });

  // Stage Conversion Funnel
  if (opp.stageConversion?.length) {
    row = addSpacer(ws, row);
    const S = 2;
    // Set up bar columns
    for (let i = 5; i <= 14; i++) ws.getColumn(i).width = 2.5;

    row = addSectionBanner(ws, 'FUNNEL DE CONVERSIÓN', THEME.colors.primaryLight, row, 3);
    ws.getCell(row - 1, S).font = { name: 'Calibri', size: 12, bold: true, color: { argb: THEME.colors.bodyText } };
    row = addTableHeaders(ws, ['Etapa', 'Conversión', 'Visual'], row);

    opp.stageConversion.forEach((stage, i) => {
      const bg = i % 2 === 1 ? THEME.colors.lightGray : THEME.colors.white;
      const lc = ws.getCell(row, S); lc.value = stage.stage;
      lc.font = { name: 'Calibri', size: 10, bold: true, color: { argb: THEME.colors.bodyText } };
      lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      lc.alignment = { horizontal: 'left', vertical: 'middle' }; lc.border = thinBorder;

      const vc = ws.getCell(row, S + 1); vc.value = `${stage.conversion}%`;
      const badge = getStatusBadge(stage.conversion, { good: 50, warning: 25 });
      vc.font = { name: 'Calibri', size: 10, bold: true, color: { argb: badge.fg } };
      vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: badge.bg } };
      vc.alignment = { horizontal: 'center', vertical: 'middle' }; vc.border = thinBorder;

      const emptyVisual = ws.getCell(row, S + 2); emptyVisual.value = '';
      emptyVisual.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }; emptyVisual.border = thinBorder;

      addBarCells(ws, row, 5, stage.conversion, THEME.colors.primary);
      row++;
    });
  }

  // Credit Type Comparison
  if (opp.creditTypeComparison?.length) {
    row = addSpacer(ws, row);
    row = addSectionBanner(ws, 'COMPARATIVA POR TIPO DE CRÉDITO', THEME.colors.primaryLight, row, 6);
    ws.getCell(row - 1, 2).font = { name: 'Calibri', size: 12, bold: true, color: { argb: THEME.colors.bodyText } };
    row = addTableHeaders(ws, ['Tipo', 'Total', 'Ganadas', 'Perdidas', 'Win Rate', 'Pipeline'], row);

    opp.creditTypeComparison.forEach((ct, i) => {
      const bg = i % 2 === 1 ? THEME.colors.lightGray : THEME.colors.white;
      const S = 2;
      const vals: (string | number)[] = [ct.type, ct.total, ct.won, ct.lost, '', formatCurrency(ct.pipeline)];
      vals.forEach((val, j) => {
        const cell = ws.getCell(row, S + j);
        cell.value = val;
        cell.font = { name: 'Calibri', size: 10, color: { argb: THEME.colors.bodyText }, bold: j === 0 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.alignment = { horizontal: j === 0 ? 'left' : 'center', vertical: 'middle' };
        cell.border = thinBorder;
      });

      // Win Rate with color
      const wrCell = ws.getCell(row, S + 4);
      wrCell.value = `${ct.winRate}%`;
      const badge = getStatusBadge(ct.winRate, { good: 50, warning: 30 });
      wrCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: badge.fg } };
      wrCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: badge.bg } };
      wrCell.alignment = { horizontal: 'center', vertical: 'middle' }; wrCell.border = thinBorder;
      row++;
    });
  }
}

function buildCreditsSheet(workbook: ExcelJS.Workbook, credits: CreditKPIs, subtitle: string): void {
  const ws = workbook.addWorksheet('Créditos', { properties: { tabColor: { argb: THEME.colors.primary } } });
  applySheetDefaults(ws);
  ws.getColumn(2).width = 34;
  ws.getColumn(3).width = 20;
  ws.getColumn(4).width = 14;

  let row = addSheetTitle(ws, 'Créditos', subtitle, 3);

  // Volumetrics
  row = addSectionBanner(ws, 'VOLUMETRÍA', THEME.colors.primary, row, 3);
  row = addTableHeaders(ws, ['Métrica', 'Valor', 'Cambio'], row);
  const volMetrics: [string, string, number | undefined][] = [
    ['Volumen de Desembolso', formatCurrency(Number(credits.disbursementVolume.value) || 0), credits.disbursementVolume.change],
    ['Tamaño Promedio de Crédito', formatCurrency(Number(credits.avgLoanSize.value) || 0), credits.avgLoanSize.change],
    ['Total Créditos', String(credits.totalCredits || 0), undefined],
    ['Total Cartera', formatCurrency(credits.totalPortfolio || 0), undefined],
  ];
  volMetrics.forEach(([label, val, change], i) => {
    row = addKPIRow(ws, label, val, change, row, i % 2 === 1);
  });

  // Portfolio Quality
  row = addSpacer(ws, row);
  row = addSectionBanner(ws, 'CALIDAD DE CARTERA', THEME.colors.warning, row, 3);
  row = addTableHeaders(ws, ['Métrica', 'Valor', 'Cambio'], row);

  const qualityMetrics: [string, KPIData][] = [
    ['Cartera en Riesgo (PAR)', credits.portfolioAtRisk],
    ['Créditos Morosos (NPL)', credits.nonPerformingLoans],
    ['Tasa de Aprobación', credits.approvalRate],
  ];
  qualityMetrics.forEach(([label, kpi], i) => {
    const S = 2;
    const isAlt = i % 2 === 1;
    const bg = isAlt ? THEME.colors.lightGray : THEME.colors.white;

    const lc = ws.getCell(row, S); lc.value = label;
    lc.font = { name: 'Calibri', size: 10, color: { argb: THEME.colors.bodyText } };
    lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    lc.alignment = { horizontal: 'left', vertical: 'middle' }; lc.border = thinBorder;

    const vc = ws.getCell(row, S + 1);
    const val = formatKPIValue(kpi);
    vc.value = val;

    // Color code PAR and NPL (lower is better)
    if (label.includes('PAR') || label.includes('NPL')) {
      const numVal = Number(kpi.value) || 0;
      const badge = getStatusBadge(numVal, { good: 2, warning: 5 }, true);
      vc.font = { name: 'Calibri', size: 11, bold: true, color: { argb: badge.fg } };
      vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: badge.bg } };
    } else {
      const badge = getStatusBadge(Number(kpi.value) || 0, { good: 80, warning: 50 });
      vc.font = { name: 'Calibri', size: 11, bold: true, color: { argb: badge.fg } };
      vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: badge.bg } };
    }
    vc.alignment = { horizontal: 'center', vertical: 'middle' }; vc.border = thinBorder;

    const cc = ws.getCell(row, S + 2);
    const change = kpi.change;
    if (change !== undefined && change !== 0) {
      const arrow = change > 0 ? '\u25B2' : '\u25BC';
      cc.value = `${arrow} ${Math.abs(change)}%`;
      // Inverted for PAR/NPL
      const isGood = label.includes('PAR') || label.includes('NPL') ? change < 0 : change > 0;
      cc.font = { name: 'Calibri', size: 10, bold: true, color: { argb: isGood ? THEME.colors.success : THEME.colors.danger } };
    } else {
      cc.value = '--';
      cc.font = { name: 'Calibri', size: 10, color: { argb: THEME.colors.mutedText } };
    }
    cc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    cc.alignment = { horizontal: 'center', vertical: 'middle' }; cc.border = thinBorder;
    row++;
  });

  // Process Times
  row = addSpacer(ws, row);
  row = addSectionBanner(ws, 'TIEMPOS DE PROCESO', THEME.colors.primaryLight, row, 3);
  ws.getCell(row - 1, 2).font = { name: 'Calibri', size: 12, bold: true, color: { argb: THEME.colors.bodyText } };
  row = addTableHeaders(ws, ['Métrica', 'Valor', 'Cambio'], row);

  const timeMetrics: [string, KPIData][] = [
    ['Tiempo de Desembolso', credits.timeToDisbursement],
    ['Tiempo a Formalización', credits.timeToFormalization],
    ['Ciclo Completo', credits.fullCycleTime],
  ];
  timeMetrics.forEach(([label, kpi], i) => {
    row = addKPIRow(ws, label, formatKPIValue(kpi), kpi?.change, row, i % 2 === 1);
  });

  // Behavior
  row = addSpacer(ws, row);
  row = addSectionBanner(ws, 'COMPORTAMIENTO', THEME.colors.orange, row, 3);
  row = addTableHeaders(ws, ['Métrica', 'Valor', 'Cambio'], row);

  const behaviorMetrics: [string, KPIData][] = [
    ['Cancelación Anticipada', credits.earlyCancellationRate],
    ['Abonos Extraordinarios', credits.extraordinaryPayments],
    ['Ingresos por Penalización', credits.penaltyRevenue],
  ];
  behaviorMetrics.forEach(([label, kpi], i) => {
    const val = label.includes('Abonos') || label.includes('Penalización')
      ? formatCurrency(Number(kpi.value) || 0)
      : formatKPIValue(kpi);
    row = addKPIRow(ws, label, val, kpi?.change, row, i % 2 === 1);
  });
}

function buildCollectionsSheet(workbook: ExcelJS.Workbook, collections: CollectionKPIs, subtitle: string): void {
  const ws = workbook.addWorksheet('Cobros', { properties: { tabColor: { argb: THEME.colors.purple } } });
  applySheetDefaults(ws);
  ws.getColumn(2).width = 32;
  ws.getColumn(3).width = 18;
  ws.getColumn(4).width = 14;

  let row = addSheetTitle(ws, 'Cobros', subtitle, 3);
  row = addSectionBanner(ws, 'MÉTRICAS PRINCIPALES', THEME.colors.purple, row, 3);
  row = addTableHeaders(ws, ['Métrica', 'Valor', 'Cambio'], row);

  const metrics: [string, KPIData, boolean][] = [
    ['Tasa de Cobro', collections.collectionRate, false],
    ['PMP (Periodo Medio de Pago)', collections.dso, true],
    ['Tasa de Morosidad', collections.delinquencyRate, true],
    ['Tasa de Recuperación', collections.recoveryRate, false],
    ['Puntualidad de Pagos', collections.paymentTimeliness, false],
    ['Tasa de Reversiones', collections.reversalRate, true],
    ['Saldos Pendientes', collections.pendingBalances, false],
  ];

  metrics.forEach(([label, kpi, invertChange], i) => {
    const S = 2;
    const isAlt = i % 2 === 1;
    const bg = isAlt ? THEME.colors.lightGray : THEME.colors.white;
    const val = label.includes('Saldos') ? formatCurrency(Number(kpi.value) || 0) : formatKPIValue(kpi);

    const lc = ws.getCell(row, S); lc.value = label;
    lc.font = { name: 'Calibri', size: 10, color: { argb: THEME.colors.bodyText } };
    lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    lc.alignment = { horizontal: 'left', vertical: 'middle' }; lc.border = thinBorder;

    const vc = ws.getCell(row, S + 1); vc.value = val;
    vc.font = { name: 'Calibri', size: 11, bold: true, color: { argb: THEME.colors.bodyText } };
    vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    vc.alignment = { horizontal: 'center', vertical: 'middle' }; vc.border = thinBorder;

    const cc = ws.getCell(row, S + 2);
    const change = kpi.change;
    if (change !== undefined && change !== 0) {
      const arrow = change > 0 ? '\u25B2' : '\u25BC';
      cc.value = `${arrow} ${Math.abs(change)}%`;
      const isGood = invertChange ? change < 0 : change > 0;
      cc.font = { name: 'Calibri', size: 10, bold: true, color: { argb: isGood ? THEME.colors.success : THEME.colors.danger } };
    } else {
      cc.value = '--';
      cc.font = { name: 'Calibri', size: 10, color: { argb: THEME.colors.mutedText } };
    }
    cc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    cc.alignment = { horizontal: 'center', vertical: 'middle' }; cc.border = thinBorder;
    row++;
  });

  // Payment Source Distribution
  if (collections.paymentSourceDistribution?.length) {
    row = addSpacer(ws, row);
    row = addSectionBanner(ws, 'DISTRIBUCIÓN POR FUENTE DE PAGO', THEME.colors.purpleLight, row, 3);
    ws.getCell(row - 1, 2).font = { name: 'Calibri', size: 12, bold: true, color: { argb: THEME.colors.bodyText } };
    row = addTableHeaders(ws, ['Fuente', 'Cantidad', 'Monto Total'], row);
    collections.paymentSourceDistribution.forEach((src, i) => {
      row = addDataRow(ws, [src.source, src.count, formatCurrency(src.total)], row, i % 2 === 1);
    });
  }

  // Deductora Efficiency
  if (collections.deductoraEfficiency?.length) {
    row = addSpacer(ws, row);
    row = addSectionBanner(ws, 'EFICIENCIA POR DEDUCTORA', THEME.colors.purpleLight, row, 3);
    ws.getCell(row - 1, 2).font = { name: 'Calibri', size: 12, bold: true, color: { argb: THEME.colors.bodyText } };
    row = addTableHeaders(ws, ['Deductora', 'Tasa de Cobro', 'Estado'], row);

    collections.deductoraEfficiency.forEach((d, i) => {
      const bg = i % 2 === 1 ? THEME.colors.lightGray : THEME.colors.white;
      const S = 2;

      const lc = ws.getCell(row, S); lc.value = d.name;
      lc.font = { name: 'Calibri', size: 10, bold: true, color: { argb: THEME.colors.bodyText } };
      lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      lc.alignment = { horizontal: 'left', vertical: 'middle' }; lc.border = thinBorder;

      const rc = ws.getCell(row, S + 1); rc.value = `${d.rate}%`;
      rc.font = { name: 'Calibri', size: 10, color: { argb: THEME.colors.bodyText } };
      rc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      rc.alignment = { horizontal: 'center', vertical: 'middle' }; rc.border = thinBorder;

      const badge = getStatusBadge(d.rate, { good: 95, warning: 90 });
      const sc = ws.getCell(row, S + 2); sc.value = badge.text;
      sc.font = { name: 'Calibri', size: 9, bold: true, color: { argb: badge.fg } };
      sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: badge.bg } };
      sc.alignment = { horizontal: 'center', vertical: 'middle' }; sc.border = thinBorder;
      row++;
    });
  }
}

function buildAgentsSheet(workbook: ExcelJS.Workbook, agents: AgentKPIs, subtitle: string): void {
  const ws = workbook.addWorksheet('Agentes', { properties: { tabColor: { argb: THEME.colors.warning } } });
  applySheetDefaults(ws);
  ws.getColumn(2).width = 8;
  ws.getColumn(3).width = 24;
  ws.getColumn(4).width = 12;
  ws.getColumn(5).width = 14;
  ws.getColumn(6).width = 12;
  ws.getColumn(7).width = 18;
  ws.getColumn(8).width = 14;
  ws.getColumn(9).width = 14;
  ws.getColumn(10).width = 14;
  ws.getColumn(11).width = 14;

  let row = addSheetTitle(ws, 'Rendimiento de Agentes', subtitle, 10);
  row = addSectionBanner(ws, 'TOP AGENTES', THEME.colors.warning, row, 10);
  row = addTableHeaders(ws, ['#', 'Agente', 'Leads', 'Conversión', 'Créditos', 'Monto Prom.', 'Actividad/día', 'Tareas Asig.', 'Completadas', 'Cumplim.'], row);

  const S = 2;
  agents.topAgents.forEach((agent, i) => {
    const bg = i % 2 === 1 ? THEME.colors.lightGray : THEME.colors.white;
    const medals = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49']; // 🥇🥈🥉
    const rank = i < 3 ? `${medals[i]} ${i + 1}` : String(i + 1);

    // Rank
    const rc = ws.getCell(row, S); rc.value = rank;
    rc.font = { name: 'Calibri', size: 10, bold: i < 3, color: { argb: THEME.colors.bodyText } };
    rc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i === 0 ? THEME.colors.successLight : bg } };
    rc.alignment = { horizontal: 'center', vertical: 'middle' }; rc.border = thinBorder;

    // Name
    const nc = ws.getCell(row, S + 1); nc.value = agent.name;
    nc.font = { name: 'Calibri', size: 10, bold: true, color: { argb: THEME.colors.bodyText } };
    nc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i === 0 ? THEME.colors.successLight : bg } };
    nc.alignment = { horizontal: 'left', vertical: 'middle' }; nc.border = thinBorder;

    // Leads
    const lc = ws.getCell(row, S + 2); lc.value = agent.leadsHandled;
    lc.font = { name: 'Calibri', size: 10, color: { argb: THEME.colors.bodyText } };
    lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    lc.alignment = { horizontal: 'center', vertical: 'middle' }; lc.border = thinBorder;

    // Conversion with color
    const convCell = ws.getCell(row, S + 3);
    convCell.value = `${agent.conversionRate}%`;
    const badge = getStatusBadge(agent.conversionRate, { good: 30, warning: 15 });
    convCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: badge.fg } };
    convCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: badge.bg } };
    convCell.alignment = { horizontal: 'center', vertical: 'middle' }; convCell.border = thinBorder;

    // Credits
    const crc = ws.getCell(row, S + 4); crc.value = agent.creditsOriginated;
    crc.font = { name: 'Calibri', size: 10, color: { argb: THEME.colors.bodyText } };
    crc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    crc.alignment = { horizontal: 'center', vertical: 'middle' }; crc.border = thinBorder;

    // Avg Deal
    const dc = ws.getCell(row, S + 5); dc.value = formatCurrency(agent.avgDealSize);
    dc.font = { name: 'Calibri', size: 10, color: { argb: THEME.colors.bodyText } };
    dc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    dc.alignment = { horizontal: 'center', vertical: 'middle' }; dc.border = thinBorder;

    // Activity
    const ac = ws.getCell(row, S + 6); ac.value = `${agent.activityRate || 0}/día`;
    ac.font = { name: 'Calibri', size: 10, color: { argb: THEME.colors.bodyText } };
    ac.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    ac.alignment = { horizontal: 'center', vertical: 'middle' }; ac.border = thinBorder;

    // Tasks Assigned
    const taCell = ws.getCell(row, S + 7); taCell.value = agent.tasksAssigned || 0;
    taCell.font = { name: 'Calibri', size: 10, color: { argb: THEME.colors.bodyText } };
    taCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    taCell.alignment = { horizontal: 'center', vertical: 'middle' }; taCell.border = thinBorder;

    // Tasks Completed
    const tcCell = ws.getCell(row, S + 8); tcCell.value = agent.tasksCompleted || 0;
    tcCell.font = { name: 'Calibri', size: 10, color: { argb: THEME.colors.bodyText } };
    tcCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    tcCell.alignment = { horizontal: 'center', vertical: 'middle' }; tcCell.border = thinBorder;

    // Task Completion Rate
    const trCell = ws.getCell(row, S + 9);
    const taskRate = agent.taskCompletionRate || 0;
    trCell.value = `${taskRate}%`;
    const taskBadge = getStatusBadge(taskRate, { good: 80, warning: 50 });
    trCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: taskBadge.fg } };
    trCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: taskBadge.bg } };
    trCell.alignment = { horizontal: 'center', vertical: 'middle' }; trCell.border = thinBorder;

    row++;
  });
}

function buildGamificationSheet(workbook: ExcelJS.Workbook, gam: GamificationKPIs, subtitle: string): void {
  const ws = workbook.addWorksheet('Gamificación', { properties: { tabColor: { argb: THEME.colors.purple } } });
  applySheetDefaults(ws);
  ws.getColumn(2).width = 32;
  ws.getColumn(3).width = 18;
  ws.getColumn(4).width = 14;

  let row = addSheetTitle(ws, 'Gamificación', subtitle, 3);
  row = addSectionBanner(ws, 'MÉTRICAS DE ENGAGEMENT', THEME.colors.purple, row, 3);
  row = addTableHeaders(ws, ['Métrica', 'Valor', 'Cambio'], row);

  const metrics: [string, KPIData][] = [
    ['Tasa de Engagement', gam.engagementRate],
    ['Velocidad de Puntos', gam.pointsVelocity],
    ['Badges Completados', gam.badgeCompletion],
    ['Participación en Challenges', gam.challengeParticipation],
    ['Tasa de Canje', gam.redemptionRate],
    ['Retención de Rachas', gam.streakRetention],
    ['Movimiento en Leaderboard', gam.leaderboardMovement],
  ];
  metrics.forEach(([label, kpi], i) => {
    row = addKPIRow(ws, label, formatKPIValue(kpi), kpi?.change, row, i % 2 === 1);
  });

  // Level Distribution with visual bars
  if (gam.levelDistribution?.length) {
    row = addSpacer(ws, row);
    const S = 2;
    // Set bar columns
    for (let i = 5; i <= 19; i++) ws.getColumn(i).width = 2.5;
    ws.getColumn(20).width = 14;

    row = addSectionBanner(ws, 'DISTRIBUCIÓN POR NIVEL', THEME.colors.purpleLight, row, 3);
    ws.getCell(row - 1, S).font = { name: 'Calibri', size: 12, bold: true, color: { argb: THEME.colors.bodyText } };
    row = addTableHeaders(ws, ['Nivel', 'Usuarios', 'Gráfico'], row);

    const maxCount = Math.max(...gam.levelDistribution.map(l => l.count), 1);

    gam.levelDistribution.forEach((level, i) => {
      const bg = i % 2 === 1 ? THEME.colors.lightGray : THEME.colors.white;

      // Level label
      const lc = ws.getCell(row, S); lc.value = `Nivel ${level.level}`;
      lc.font = { name: 'Calibri', size: 10, bold: true, color: { argb: THEME.colors.bodyText } };
      lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      lc.alignment = { horizontal: 'left', vertical: 'middle' }; lc.border = thinBorder;

      // Count
      const cc = ws.getCell(row, S + 1); cc.value = level.count;
      cc.font = { name: 'Calibri', size: 10, color: { argb: THEME.colors.bodyText } };
      cc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cc.alignment = { horizontal: 'center', vertical: 'middle' }; cc.border = thinBorder;

      // Visual placeholder
      const vc = ws.getCell(row, S + 2); vc.value = '';
      vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }; vc.border = thinBorder;

      // Bar
      const pct = (level.count / maxCount) * 100;
      addBarCells(ws, row, 5, pct, THEME.colors.purple, 15);

      // Count label after bar
      const countLabel = ws.getCell(row, 20);
      countLabel.value = `${level.count} usuarios`;
      countLabel.font = { name: 'Calibri', size: 9, color: { argb: THEME.colors.mutedText } };
      countLabel.alignment = { horizontal: 'left', vertical: 'middle' };

      row++;
    });
  }
}

function buildBusinessSheet(workbook: ExcelJS.Workbook, business: BusinessHealthKPIs, subtitle: string): void {
  const ws = workbook.addWorksheet('Negocio', { properties: { tabColor: { argb: THEME.colors.emerald } } });
  applySheetDefaults(ws);
  ws.getColumn(2).width = 34;
  ws.getColumn(3).width = 20;
  ws.getColumn(4).width = 14;
  ws.getColumn(5).width = 20;
  ws.getColumn(6).width = 20;

  let row = addSheetTitle(ws, 'Salud del Negocio', subtitle, 3);
  row = addSectionBanner(ws, 'INDICADORES CLAVE', THEME.colors.emerald, row, 3);
  row = addTableHeaders(ws, ['Métrica', 'Valor', 'Cambio'], row);

  const metrics: [string, KPIData, boolean][] = [
    ['Customer Lifetime Value (CLV)', business.clv, false],
    ['Customer Acquisition Cost (CAC)', business.cac, true],
    ['Crecimiento de Cartera', business.portfolioGrowth, false],
    ['Net Promoter Score (NPS)', business.nps, false],
    ['Ingreso por Empleado', business.revenuePerEmployee, false],
  ];

  metrics.forEach(([label, kpi, isCurrency], i) => {
    const val = label.includes('CLV') || label.includes('CAC') || label.includes('Ingreso')
      ? formatCurrency(Number(kpi.value) || 0)
      : formatKPIValue(kpi);
    row = addKPIRow(ws, label, val, kpi?.change, row, i % 2 === 1);
  });

  // CLV:CAC Ratio highlight
  row = addSpacer(ws, row);
  const S = 2;
  const ratio = ((Number(business.clv.value) || 1) / (Number(business.cac.value) || 1));

  ws.mergeCells(row, S, row + 1, S + 1);
  const ratioCell = ws.getCell(row, S);
  ratioCell.value = `${ratio.toFixed(1)}:1`;
  ratioCell.font = { name: 'Calibri', size: 28, bold: true, color: { argb: ratio >= 3 ? THEME.colors.success : ratio >= 2 ? THEME.colors.warning : THEME.colors.danger } };
  ratioCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ratio >= 3 ? THEME.colors.successLight : ratio >= 2 ? THEME.colors.warningLight : THEME.colors.dangerLight } };
  ratioCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ratioCell.border = thinBorder;
  ws.getRow(row).height = 30;
  ws.getRow(row + 1).height = 30;

  ws.mergeCells(row, S + 2, row + 1, S + 3);
  const descCell = ws.getCell(row, S + 2);
  descCell.value = `Ratio CLV:CAC\nPor cada ₡1 invertido en adquisición, se genera ₡${ratio.toFixed(0)} en valor de cliente.\nMeta: >3:1`;
  descCell.font = { name: 'Calibri', size: 10, color: { argb: THEME.colors.bodyText } };
  descCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
  descCell.border = thinBorder;
}

function buildTrendsSheet(workbook: ExcelJS.Workbook, trends: TrendData, subtitle: string): void {
  const ws = workbook.addWorksheet('Tendencias', { properties: { tabColor: { argb: THEME.colors.primary } } });
  applySheetDefaults(ws);
  ws.getColumn(2).width = 28;
  ws.getColumn(3).width = 16;
  ws.getColumn(4).width = 12;
  ws.getColumn(5).width = 12;
  ws.getColumn(6).width = 14;
  ws.getColumn(7).width = 14;

  let row = addSheetTitle(ws, 'Tendencias', subtitle, 6);

  // Summary table
  row = addSectionBanner(ws, 'RESUMEN DE TENDENCIAS', THEME.colors.headerBg, row, 6);
  row = addTableHeaders(ws, ['Indicador', 'Actual', 'Mín', 'Máx', 'Promedio', 'Tendencia'], row);

  const trendConfigs: { label: string; data: TrendDataPoint[]; color: string; isCurrency?: boolean }[] = [
    { label: 'Tasa de Conversión', data: trends.conversionRate || [], color: THEME.colors.success },
    { label: 'Volumen de Desembolso', data: trends.disbursementVolume || [], color: THEME.colors.primary, isCurrency: true },
    { label: 'Tasa de Cobro', data: trends.collectionRate || [], color: THEME.colors.purple },
    { label: 'Crecimiento de Cartera', data: trends.portfolioGrowth || [], color: THEME.colors.emerald, isCurrency: true },
    { label: 'Tasa de Morosidad', data: trends.delinquencyRate || [], color: THEME.colors.danger },
    { label: 'Nuevos Leads', data: trends.leadsCount || [], color: THEME.colors.warning },
  ];

  const S = 2;
  trendConfigs.forEach((cfg, i) => {
    if (!cfg.data.length) return;
    const bg = i % 2 === 1 ? THEME.colors.lightGray : THEME.colors.white;
    const values = cfg.data.map(d => d.value);
    const current = values[values.length - 1] || 0;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const first = values[0] || 0;
    const isRising = current > first;
    const fmt = (v: number) => cfg.isCurrency ? formatCurrency(v) : `${v.toFixed(1)}%`;

    const rowCells: { val: string; special?: boolean }[] = [
      { val: cfg.label },
      { val: fmt(current) },
      { val: fmt(min) },
      { val: fmt(max) },
      { val: fmt(avg) },
      { val: '', special: true },
    ];

    rowCells.forEach((item, j) => {
      const cell = ws.getCell(row, S + j);
      if (item.special) {
        const arrow = isRising ? '\u25B2 Subiendo' : '\u25BC Bajando';
        cell.value = arrow;
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: isRising ? THEME.colors.success : THEME.colors.danger } };
      } else {
        cell.value = item.val;
        cell.font = { name: 'Calibri', size: 10, color: { argb: THEME.colors.bodyText }, bold: j === 0 || j === 1 };
      }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.alignment = { horizontal: j === 0 ? 'left' : 'center', vertical: 'middle' };
      cell.border = thinBorder;
    });
    row++;
  });

  // Individual trend sections with data bars
  trendConfigs.forEach((cfg) => {
    if (!cfg.data.length) return;
    row = addSpacer(ws, row);
    row = addSectionBanner(ws, cfg.label.toUpperCase(), cfg.color, row, 3);

    // Reuse columns 2-4 for trend details
    row = addTableHeaders(ws, ['Mes', 'Valor', 'Barra'], row);

    const fmt = (v: number) => cfg.isCurrency ? formatCurrency(v) : `${v.toFixed(1)}%`;
    const maxVal = Math.max(...cfg.data.map(d => d.value), 1);

    // Set bar columns
    for (let c = 5; c <= 14; c++) ws.getColumn(c).width = 2.5;

    cfg.data.forEach((point, i) => {
      const bg = i % 2 === 1 ? THEME.colors.lightGray : THEME.colors.white;

      // Month
      const mc = ws.getCell(row, S); mc.value = point.fullMonth || point.month;
      mc.font = { name: 'Calibri', size: 10, color: { argb: THEME.colors.bodyText } };
      mc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      mc.alignment = { horizontal: 'left', vertical: 'middle' }; mc.border = thinBorder;

      // Value
      const vc = ws.getCell(row, S + 1); vc.value = fmt(point.value);
      vc.font = { name: 'Calibri', size: 10, bold: true, color: { argb: THEME.colors.bodyText } };
      vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      vc.alignment = { horizontal: 'center', vertical: 'middle' }; vc.border = thinBorder;

      // Visual placeholder
      const pc = ws.getCell(row, S + 2); pc.value = '';
      pc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }; pc.border = thinBorder;

      // Bar
      const pct = (point.value / maxVal) * 100;
      addBarCells(ws, row, 5, pct, cfg.color);

      row++;
    });
  });
}

// ============ EXPORT TO EXCEL ============
export const exportToExcel = async (data: AllKPIData, period: string, trendData?: TrendData | null): Promise<void> => {
  const ExcelJSModule = await import('exceljs');
  const workbook = new ExcelJSModule.Workbook();

  workbook.creator = 'Studio KPI Dashboard';
  workbook.created = new Date();
  workbook.modified = new Date();

  const dateStr = new Date().toLocaleDateString('es-CR');
  const subtitle = `Generado: ${dateStr} | Período: ${period}`;

  // Build sheets
  buildResumenSheet(workbook, data, subtitle);
  if (data.leads) buildLeadsSheet(workbook, data.leads, subtitle);
  if (data.opportunities) buildOpportunitiesSheet(workbook, data.opportunities, subtitle);
  if (data.credits) buildCreditsSheet(workbook, data.credits, subtitle);
  if (data.collections) buildCollectionsSheet(workbook, data.collections, subtitle);
  if (data.agents?.topAgents) buildAgentsSheet(workbook, data.agents, subtitle);
  if (data.gamification) buildGamificationSheet(workbook, data.gamification, subtitle);
  if (data.business) buildBusinessSheet(workbook, data.business, subtitle);
  if (trendData) buildTrendsSheet(workbook, trendData, subtitle);

  // Download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `KPIs_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// ============ PDF HELPERS ============
// With custom font (Noto Sans), we can use ₡ and ▲/▼ symbols directly.
// pdfCurrency and pdfFormatKPIValue use ₡ since we load NotoSans which supports it.
const pdfCurrency = (value: number): string => {
  if (value >= 1000000000) return `₡${(value / 1000000000).toFixed(1)}B`;
  if (value >= 1000000) return `₡${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `₡${(value / 1000).toFixed(1)}K`;
  return `₡${value}`;
};

const pdfFormatKPIValue = (kpi: KPIData | undefined): string => {
  if (!kpi) return 'N/A';
  const value = kpi.value;
  const unit = kpi.unit || '';
  if (unit === '₡') return pdfCurrency(Number(value));
  return `${value}${unit}`;
};

async function loadPdfFonts(doc: jsPDF): Promise<void> {
  try {
    const [regularResp, boldResp] = await Promise.all([
      fetch('/fonts/NotoSans-Regular.ttf'),
      fetch('/fonts/NotoSans-Bold.ttf'),
    ]);
    if (regularResp.ok && boldResp.ok) {
      const [regularBuf, boldBuf] = await Promise.all([
        regularResp.arrayBuffer(),
        boldResp.arrayBuffer(),
      ]);
      // Convert to base64 for jsPDF
      const toBase64 = (buf: ArrayBuffer) => {
        const bytes = new Uint8Array(buf);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
      };
      doc.addFileToVFS('NotoSans-Regular.ttf', toBase64(regularBuf));
      doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
      doc.addFileToVFS('NotoSans-Bold.ttf', toBase64(boldBuf));
      doc.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold');
      doc.setFont('NotoSans');
    }
  } catch {
    // Fallback: default Helvetica (₡ will render as ¡)
  }
}

// ============ EXPORT TO PDF (Professional Design) ============

const PDF_COLORS = {
  primary: [59, 130, 246] as [number, number, number],
  success: [34, 197, 94] as [number, number, number],
  danger: [239, 68, 68] as [number, number, number],
  warning: [245, 158, 11] as [number, number, number],
  purple: [139, 92, 246] as [number, number, number],
  emerald: [16, 185, 129] as [number, number, number],
  slate800: [30, 41, 59] as [number, number, number],
  slate500: [100, 116, 139] as [number, number, number],
  slate200: [226, 232, 240] as [number, number, number],
  slate50: [248, 250, 252] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  successLight: [220, 252, 231] as [number, number, number],
  dangerLight: [254, 226, 226] as [number, number, number],
  warningLight: [254, 243, 199] as [number, number, number],
  primaryLight: [219, 234, 254] as [number, number, number],
};

// Inverted KPIs — lower is better
const INVERTED_KPIS = ['Cartera en Riesgo', 'Créditos Morosos', 'DSO', 'Tasa de Morosidad', 'Leads Envejecidos', 'Tasa de Reversiones', 'PAR', 'NPL'];

function pdfChangeText(change: number | undefined, label: string): string {
  if (change === undefined || change === null) return '-';
  const arrow = change > 0 ? '▲' : change < 0 ? '▼' : '–';
  return `${arrow} ${Math.abs(change).toFixed(1)}%`;
}

function pdfChangeColor(change: number | undefined, label: string): [number, number, number] {
  if (change === undefined || change === null || change === 0) return PDF_COLORS.slate500;
  const isInverted = INVERTED_KPIS.some(k => label.includes(k));
  const isPositive = isInverted ? change < 0 : change > 0;
  return isPositive ? PDF_COLORS.success : PDF_COLORS.danger;
}

function pdfStatusBadge(value: number, thresholds: { good: number; ok: number }, isInverted = false): { text: string; color: [number, number, number]; bg: [number, number, number] } {
  const isGood = isInverted ? value <= thresholds.good : value >= thresholds.good;
  const isOk = isInverted ? value <= thresholds.ok : value >= thresholds.ok;
  if (isGood) return { text: 'Excelente', color: [22, 101, 52], bg: PDF_COLORS.successLight };
  if (isOk) return { text: 'Bueno', color: [133, 77, 14], bg: PDF_COLORS.warningLight };
  return { text: 'Mejorar', color: [153, 27, 27], bg: PDF_COLORS.dangerLight };
}

function pdfEnsureSpace(doc: jsPDF, yPos: number, needed: number): number {
  if (yPos + needed > doc.internal.pageSize.getHeight() - 25) {
    doc.addPage();
    return 20;
  }
  return yPos;
}

function pdfSectionBar(doc: jsPDF, title: string, color: [number, number, number], yPos: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  yPos = pdfEnsureSpace(doc, yPos, 20);
  doc.setFillColor(color[0], color[1], color[2]);
  doc.roundedRect(14, yPos, pageWidth - 28, 10, 2, 2, 'F');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(title.toUpperCase(), pageWidth / 2, yPos + 7, { align: 'center' });
  return yPos + 15;
}

function pdfProgressBar(doc: jsPDF, x: number, y: number, width: number, percentage: number, color: [number, number, number]) {
  const pct = Math.min(Math.max(percentage, 0), 100);
  // Background
  doc.setFillColor(226, 232, 240);
  doc.roundedRect(x, y, width, 4, 1, 1, 'F');
  // Fill
  if (pct > 0) {
    doc.setFillColor(color[0], color[1], color[2]);
    doc.roundedRect(x, y, width * (pct / 100), 4, 1, 1, 'F');
  }
}

const pdfTableStyles = {
  theme: 'plain' as const,
  styles: {
    fontSize: 9,
    font: 'NotoSans',
    cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
    lineColor: [226, 232, 240] as [number, number, number],
    lineWidth: 0.3,
    textColor: [30, 41, 59] as [number, number, number],
  },
  headStyles: {
    fillColor: [241, 245, 249] as [number, number, number],
    textColor: [30, 41, 59] as [number, number, number],
    fontStyle: 'bold' as const,
    font: 'NotoSans',
    fontSize: 9,
  },
  alternateRowStyles: {
    fillColor: [248, 250, 252] as [number, number, number],
  },
};

export const exportToPDF = async (data: AllKPIData, period: string, trendData?: TrendData | null): Promise<void> => {
  const doc = new jsPDF();

  // Load Noto Sans font for ₡, ▲, ▼ and accented character support
  await loadPdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 15;

  // ── Title Bar ──
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, 35, 'F');
  // Accent line
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 35, pageWidth, 2, 'F');

  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text('Reporte de KPIs', pageWidth / 2, 18, { align: 'center' });
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generado: ${new Date().toLocaleDateString('es-CR')} | Período: ${period}`, pageWidth / 2, 28, { align: 'center' });
  yPos = 45;

  // ── RESUMEN EJECUTIVO ──
  yPos = pdfSectionBar(doc, 'Resumen Ejecutivo', PDF_COLORS.slate800, yPos);

  const summaryData: [string, string, string, number | undefined, string, [number, number, number]][] = [
    ['Leads', 'Tasa de Conversión', pdfFormatKPIValue(data.leads?.conversionRate), data.leads?.conversionRate?.change, 'Conversión', PDF_COLORS.success],
    ['Oportunidades', 'Win Rate', pdfFormatKPIValue(data.opportunities?.winRate), data.opportunities?.winRate?.change, 'Win Rate', PDF_COLORS.primary],
    ['Créditos', 'Volumen Desembolsado', pdfFormatKPIValue(data.credits?.disbursementVolume), data.credits?.disbursementVolume?.change, 'Desembolso', PDF_COLORS.primary],
    ['Cobros', 'Tasa de Cobro', pdfFormatKPIValue(data.collections?.collectionRate), data.collections?.collectionRate?.change, 'Cobro', PDF_COLORS.purple],
    ['Gamificación', 'Engagement', pdfFormatKPIValue(data.gamification?.engagementRate), data.gamification?.engagementRate?.change, 'Engagement', PDF_COLORS.warning],
    ['Negocio', 'CLV', pdfFormatKPIValue(data.business?.clv), data.business?.clv?.change, 'CLV', PDF_COLORS.emerald],
  ];

  const summaryRows = summaryData.map(([cat, kpi, val, change, label]) => [
    cat, kpi, val, pdfChangeText(change, label), '',
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Categoría', 'KPI Principal', 'Valor', 'Cambio', 'Estado']],
    body: summaryRows,
    ...pdfTableStyles,
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 32 },
      2: { fontStyle: 'bold', halign: 'right', cellWidth: 35 },
      3: { halign: 'center', cellWidth: 25 },
      4: { cellWidth: 45 },
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && hookData.column.index === 3) {
        const rowIdx = hookData.row.index;
        const change = summaryData[rowIdx]?.[3];
        const label = summaryData[rowIdx]?.[4] || '';
        const color = pdfChangeColor(change, label);
        hookData.cell.styles.textColor = color;
        hookData.cell.styles.fontStyle = 'bold';
      }
    },
    didDrawCell: (hookData) => {
      if (hookData.section === 'body' && hookData.column.index === 4) {
        const rowIdx = hookData.row.index;
        const color = summaryData[rowIdx]?.[5] || PDF_COLORS.primary;
        const val = summaryData[rowIdx]?.[2] || '0';
        const numVal = parseFloat(val.replace(/[^0-9.-]/g, '')) || 0;
        const pct = Math.min(numVal, 100);
        pdfProgressBar(doc, hookData.cell.x + 2, hookData.cell.y + hookData.cell.height / 2 - 2, hookData.cell.width - 4, pct, color);
      }
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 12;

  // ── LEADS ──
  if (data.leads) {
    yPos = pdfSectionBar(doc, 'Gestión de Leads', PDF_COLORS.success, yPos);

    const leadsMetrics: [string, string, number | undefined][] = [
      ['Tasa de Conversión', pdfFormatKPIValue(data.leads.conversionRate), data.leads.conversionRate?.change],
      ['Tiempo de Respuesta', pdfFormatKPIValue(data.leads.responseTime), data.leads.responseTime?.change],
      ['Leads Envejecidos', pdfFormatKPIValue(data.leads.leadAging), undefined],
      ['Total Leads', String(data.leads.totalLeads || 0), undefined],
      ['Total Clientes', String(data.leads.totalClients || 0), undefined],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [['Métrica', 'Valor', 'Cambio']],
      body: leadsMetrics.map(([label, val, change]) => [label, val, pdfChangeText(change, label)]),
      ...pdfTableStyles,
      columnStyles: {
        1: { halign: 'right', fontStyle: 'bold' },
        2: { halign: 'center' },
      },
      didParseCell: (hookData) => {
        if (hookData.section === 'body' && hookData.column.index === 2) {
          const [label, , change] = leadsMetrics[hookData.row.index] || [];
          hookData.cell.styles.textColor = pdfChangeColor(change, label || '');
          hookData.cell.styles.fontStyle = 'bold';
        }
      },
    });
    yPos = (doc as any).lastAutoTable.finalY + 8;

    // Agent sub-table
    if (data.leads.leadsPerAgent?.length > 0) {
      yPos = pdfEnsureSpace(doc, yPos, 30);
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text('Leads por Agente', 14, yPos);
      yPos += 4;

      const maxLeads = Math.max(...data.leads.leadsPerAgent.map(a => a.count), 1);
      const agentRows = data.leads.leadsPerAgent.map(a => [a.agentName, String(a.count), '']);

      autoTable(doc, {
        startY: yPos,
        head: [['Agente', 'Leads', 'Distribución']],
        body: agentRows,
        ...pdfTableStyles,
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' }, 2: { cellWidth: 55 } },
        didDrawCell: (hookData) => {
          if (hookData.section === 'body' && hookData.column.index === 2) {
            const agent = data.leads!.leadsPerAgent[hookData.row.index];
            if (agent) {
              pdfProgressBar(doc, hookData.cell.x + 2, hookData.cell.y + hookData.cell.height / 2 - 2, hookData.cell.width - 4, (agent.count / maxLeads) * 100, PDF_COLORS.success);
            }
          }
        },
      });
      yPos = (doc as any).lastAutoTable.finalY + 8;
    }

    // Source sub-table
    if (data.leads.leadSourcePerformance?.length > 0) {
      yPos = pdfEnsureSpace(doc, yPos, 30);
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text('Rendimiento por Fuente', 14, yPos);
      yPos += 4;

      autoTable(doc, {
        startY: yPos,
        head: [['Fuente', 'Leads', 'Conversión', '']],
        body: data.leads.leadSourcePerformance.map(s => [s.source, String(s.count), `${s.conversion}%`, '']),
        ...pdfTableStyles,
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right', fontStyle: 'bold' }, 3: { cellWidth: 45 } },
        didDrawCell: (hookData) => {
          if (hookData.section === 'body' && hookData.column.index === 3) {
            const src = data.leads!.leadSourcePerformance[hookData.row.index];
            if (src) {
              const color: [number, number, number] = src.conversion >= 30 ? PDF_COLORS.success : src.conversion >= 15 ? PDF_COLORS.warning : PDF_COLORS.danger;
              pdfProgressBar(doc, hookData.cell.x + 2, hookData.cell.y + hookData.cell.height / 2 - 2, hookData.cell.width - 4, src.conversion, color);
            }
          }
        },
      });
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }
  }

  // ── OPORTUNIDADES ──
  if (data.opportunities) {
    yPos = pdfSectionBar(doc, 'Oportunidades', PDF_COLORS.primary, yPos);

    const oppMetrics: [string, string, number | undefined][] = [
      ['Win Rate', pdfFormatKPIValue(data.opportunities.winRate), data.opportunities.winRate?.change],
      ['Valor del Pipeline', pdfFormatKPIValue(data.opportunities.pipelineValue), data.opportunities.pipelineValue?.change],
      ['Ciclo de Venta Promedio', pdfFormatKPIValue(data.opportunities.avgSalesCycle), data.opportunities.avgSalesCycle?.change],
      ['Velocidad', pdfFormatKPIValue(data.opportunities.velocity), data.opportunities.velocity?.change],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [['Métrica', 'Valor', 'Cambio']],
      body: oppMetrics.map(([l, v, c]) => [l, v, pdfChangeText(c, l)]),
      ...pdfTableStyles,
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' }, 2: { halign: 'center' } },
      didParseCell: (hookData) => {
        if (hookData.section === 'body' && hookData.column.index === 2) {
          const [label, , change] = oppMetrics[hookData.row.index] || [];
          hookData.cell.styles.textColor = pdfChangeColor(change, label || '');
          hookData.cell.styles.fontStyle = 'bold';
        }
      },
    });
    yPos = (doc as any).lastAutoTable.finalY + 8;

    // Stage funnel
    if (data.opportunities.stageConversion?.length > 0) {
      yPos = pdfEnsureSpace(doc, yPos, 30);
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text('Embudo de Conversión', 14, yPos);
      yPos += 4;

      const maxConversion = Math.max(...data.opportunities.stageConversion.map(s => s.conversion), 1);

      autoTable(doc, {
        startY: yPos,
        head: [['Etapa', 'Conversión', '']],
        body: data.opportunities.stageConversion.map(s => [s.stage, `${s.conversion}%`, '']),
        ...pdfTableStyles,
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' }, 2: { cellWidth: 50 } },
        didDrawCell: (hookData) => {
          if (hookData.section === 'body' && hookData.column.index === 2) {
            const stage = data.opportunities!.stageConversion[hookData.row.index];
            if (stage) {
              pdfProgressBar(doc, hookData.cell.x + 2, hookData.cell.y + hookData.cell.height / 2 - 2, hookData.cell.width - 4, (stage.conversion / maxConversion) * 100, PDF_COLORS.primary);
            }
          }
        },
      });
      yPos = (doc as any).lastAutoTable.finalY + 8;
    }

    // Credit type comparison
    if (data.opportunities.creditTypeComparison?.length > 0) {
      yPos = pdfEnsureSpace(doc, yPos, 30);
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text('Comparación por Tipo de Crédito', 14, yPos);
      yPos += 4;

      autoTable(doc, {
        startY: yPos,
        head: [['Tipo', 'Total', 'Ganadas', 'Perdidas', 'Win Rate', 'Pipeline']],
        body: data.opportunities.creditTypeComparison.map(ct => [
          ct.type,
          String(ct.total),
          String(ct.won),
          String(ct.lost),
          `${ct.winRate}%`,
          pdfCurrency(ct.pipeline),
        ]),
        ...pdfTableStyles,
        columnStyles: {
          1: { halign: 'right' },
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right', fontStyle: 'bold' },
          5: { halign: 'right' },
        },
        didParseCell: (hookData) => {
          if (hookData.section === 'body' && hookData.column.index === 4) {
            const ct = data.opportunities!.creditTypeComparison![hookData.row.index];
            if (ct) {
              hookData.cell.styles.textColor = ct.winRate >= 50 ? PDF_COLORS.success : ct.winRate >= 30 ? PDF_COLORS.warning : PDF_COLORS.danger;
              hookData.cell.styles.fontStyle = 'bold';
            }
          }
        },
      });
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }
  }

  // ── CRÉDITOS ──
  if (data.credits) {
    yPos = pdfSectionBar(doc, 'Créditos', PDF_COLORS.primary, yPos);

    // Volumetrics
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Volumetría', 14, yPos);
    yPos += 4;

    const creditVol: [string, string, number | undefined][] = [
      ['Volumen de Desembolso', pdfFormatKPIValue(data.credits.disbursementVolume), data.credits.disbursementVolume?.change],
      ['Tamaño Promedio', pdfFormatKPIValue(data.credits.avgLoanSize), data.credits.avgLoanSize?.change],
      ['Tasa de Aprobación', pdfFormatKPIValue(data.credits.approvalRate), data.credits.approvalRate?.change],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [['Métrica', 'Valor', 'Cambio']],
      body: creditVol.map(([l, v, c]) => [l, v, pdfChangeText(c, l)]),
      ...pdfTableStyles,
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' }, 2: { halign: 'center' } },
      didParseCell: (hookData) => {
        if (hookData.section === 'body' && hookData.column.index === 2) {
          const [label, , change] = creditVol[hookData.row.index] || [];
          hookData.cell.styles.textColor = pdfChangeColor(change, label || '');
          hookData.cell.styles.fontStyle = 'bold';
        }
      },
    });
    yPos = (doc as any).lastAutoTable.finalY + 6;

    // Quality (inverted colors for PAR/NPL)
    yPos = pdfEnsureSpace(doc, yPos, 25);
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Calidad de Cartera', 14, yPos);
    yPos += 4;

    const creditQuality: [string, string, number | undefined][] = [
      ['Cartera en Riesgo (PAR)', pdfFormatKPIValue(data.credits.portfolioAtRisk), data.credits.portfolioAtRisk?.change],
      ['Créditos Morosos (NPL)', String(data.credits.nonPerformingLoans?.value ?? 0), data.credits.nonPerformingLoans?.change],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [['Métrica', 'Valor', 'Cambio', 'Estado']],
      body: creditQuality.map(([l, v, c]) => {
        const numVal = parseFloat(String(v).replace(/[^0-9.-]/g, '')) || 0;
        const badge = pdfStatusBadge(numVal, { good: 2, ok: 5 }, true);
        return [l, v, pdfChangeText(c, l), badge.text];
      }),
      ...pdfTableStyles,
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' }, 2: { halign: 'center' }, 3: { halign: 'center' } },
      didParseCell: (hookData) => {
        if (hookData.section === 'body') {
          if (hookData.column.index === 2) {
            const [label, , change] = creditQuality[hookData.row.index] || [];
            hookData.cell.styles.textColor = pdfChangeColor(change, label || '');
            hookData.cell.styles.fontStyle = 'bold';
          }
          if (hookData.column.index === 3) {
            const val = parseFloat(String(creditQuality[hookData.row.index]?.[1]).replace(/[^0-9.-]/g, '')) || 0;
            const badge = pdfStatusBadge(val, { good: 2, ok: 5 }, true);
            hookData.cell.styles.textColor = badge.color;
            hookData.cell.styles.fillColor = badge.bg;
            hookData.cell.styles.fontStyle = 'bold';
          }
        }
      },
    });
    yPos = (doc as any).lastAutoTable.finalY + 6;

    // Tiempos
    yPos = pdfEnsureSpace(doc, yPos, 25);
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Tiempos', 14, yPos);
    yPos += 4;

    const creditTimes: [string, string, number | undefined][] = [
      ['Tiempo a Formalización', pdfFormatKPIValue(data.credits.timeToFormalization), data.credits.timeToFormalization?.change],
      ['Ciclo Completo', pdfFormatKPIValue(data.credits.fullCycleTime), data.credits.fullCycleTime?.change],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [['Métrica', 'Valor', 'Cambio']],
      body: creditTimes.map(([l, v, c]) => [l, v, pdfChangeText(c, l)]),
      ...pdfTableStyles,
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' }, 2: { halign: 'center' } },
      didParseCell: (hookData) => {
        if (hookData.section === 'body' && hookData.column.index === 2) {
          const [label, , change] = creditTimes[hookData.row.index] || [];
          hookData.cell.styles.textColor = pdfChangeColor(change, label || '');
          hookData.cell.styles.fontStyle = 'bold';
        }
      },
    });
    yPos = (doc as any).lastAutoTable.finalY + 6;

    // Comportamiento
    yPos = pdfEnsureSpace(doc, yPos, 25);
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Comportamiento', 14, yPos);
    yPos += 4;

    const creditBehavior: [string, string, number | undefined][] = [
      ['Cancelación Anticipada', pdfFormatKPIValue(data.credits.earlyCancellationRate), data.credits.earlyCancellationRate?.change],
      ['Abonos Extraordinarios', pdfFormatKPIValue(data.credits.extraordinaryPayments), data.credits.extraordinaryPayments?.change],
      ['Ingresos por Penalización', pdfFormatKPIValue(data.credits.penaltyRevenue), data.credits.penaltyRevenue?.change],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [['Métrica', 'Valor', 'Cambio']],
      body: creditBehavior.map(([l, v, c]) => [l, v, pdfChangeText(c, l)]),
      ...pdfTableStyles,
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' }, 2: { halign: 'center' } },
      didParseCell: (hookData) => {
        if (hookData.section === 'body' && hookData.column.index === 2) {
          const [label, , change] = creditBehavior[hookData.row.index] || [];
          hookData.cell.styles.textColor = pdfChangeColor(change, label || '');
          hookData.cell.styles.fontStyle = 'bold';
        }
      },
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // ── COBROS ──
  if (data.collections) {
    yPos = pdfSectionBar(doc, 'Cobros', PDF_COLORS.purple, yPos);

    const collectMetrics: [string, string, number | undefined][] = [
      ['Tasa de Cobro', pdfFormatKPIValue(data.collections.collectionRate), data.collections.collectionRate?.change],
      ['DSO', pdfFormatKPIValue(data.collections.dso), data.collections.dso?.change],
      ['Tasa de Morosidad', pdfFormatKPIValue(data.collections.delinquencyRate), data.collections.delinquencyRate?.change],
      ['Tasa de Recuperación', pdfFormatKPIValue(data.collections.recoveryRate), data.collections.recoveryRate?.change],
      ['Tasa de Reversiones', pdfFormatKPIValue(data.collections.reversalRate), data.collections.reversalRate?.change],
      ['Saldos Pendientes', pdfFormatKPIValue(data.collections.pendingBalances), data.collections.pendingBalances?.change],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [['Métrica', 'Valor', 'Cambio']],
      body: collectMetrics.map(([l, v, c]) => [l, v, pdfChangeText(c, l)]),
      ...pdfTableStyles,
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' }, 2: { halign: 'center' } },
      didParseCell: (hookData) => {
        if (hookData.section === 'body' && hookData.column.index === 2) {
          const [label, , change] = collectMetrics[hookData.row.index] || [];
          hookData.cell.styles.textColor = pdfChangeColor(change, label || '');
          hookData.cell.styles.fontStyle = 'bold';
        }
      },
    });
    yPos = (doc as any).lastAutoTable.finalY + 8;

    // Payment sources
    if (data.collections.paymentSourceDistribution?.length > 0) {
      yPos = pdfEnsureSpace(doc, yPos, 30);
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text('Fuentes de Pago', 14, yPos);
      yPos += 4;

      const maxAmount = Math.max(...data.collections.paymentSourceDistribution.map(s => s.total), 1);

      autoTable(doc, {
        startY: yPos,
        head: [['Fuente', 'Pagos', 'Monto', '']],
        body: data.collections.paymentSourceDistribution.map(s => [s.source, String(s.count), pdfCurrency(s.total), '']),
        ...pdfTableStyles,
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right', fontStyle: 'bold' }, 3: { cellWidth: 50 } },
        didDrawCell: (hookData) => {
          if (hookData.section === 'body' && hookData.column.index === 3) {
            const src = data.collections!.paymentSourceDistribution![hookData.row.index];
            if (src) {
              pdfProgressBar(doc, hookData.cell.x + 2, hookData.cell.y + hookData.cell.height / 2 - 2, hookData.cell.width - 4, (src.total / maxAmount) * 100, PDF_COLORS.purple);
            }
          }
        },
      });
      yPos = (doc as any).lastAutoTable.finalY + 8;
    }

    // Deductora efficiency
    if (data.collections.deductoraEfficiency?.length > 0) {
      yPos = pdfEnsureSpace(doc, yPos, 30);
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text('Eficiencia por Deductora', 14, yPos);
      yPos += 4;

      autoTable(doc, {
        startY: yPos,
        head: [['Deductora', 'Tasa Cobro', 'Estado']],
        body: data.collections.deductoraEfficiency.map(d => {
          const badge = pdfStatusBadge(d.rate, { good: 90, ok: 75 });
          return [d.name, `${d.rate}%`, badge.text];
        }),
        ...pdfTableStyles,
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' }, 2: { halign: 'center' } },
        didParseCell: (hookData) => {
          if (hookData.section === 'body' && hookData.column.index === 2) {
            const d = data.collections!.deductoraEfficiency![hookData.row.index];
            if (d) {
              const badge = pdfStatusBadge(d.rate, { good: 90, ok: 75 });
              hookData.cell.styles.textColor = badge.color;
              hookData.cell.styles.fillColor = badge.bg;
              hookData.cell.styles.fontStyle = 'bold';
            }
          }
        },
      });
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }
  }

  // ── AGENTES ──
  if (data.agents?.topAgents && data.agents.topAgents.length > 0) {
    yPos = pdfSectionBar(doc, 'Agentes', PDF_COLORS.warning, yPos);

    const agentRows = data.agents.topAgents.slice(0, 10).map((a, i) => [
      String(i + 1),
      a.name,
      String(a.leadsHandled),
      `${a.conversionRate}%`,
      String(a.creditsOriginated),
      pdfCurrency(a.avgDealSize),
      `${a.tasksCompleted || 0}/${a.tasksAssigned || 0}`,
      `${a.taskCompletionRate || 0}%`,
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['#', 'Agente', 'Leads', 'Conv.', 'Créd.', 'Monto Prom.', 'Tareas', 'Cumplim.']],
      body: agentRows,
      ...pdfTableStyles,
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        2: { halign: 'right' },
        3: { halign: 'right', fontStyle: 'bold' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'center' },
        7: { halign: 'center', fontStyle: 'bold' },
      },
      didParseCell: (hookData) => {
        if (hookData.section === 'body') {
          // Highlight top performer row
          if (hookData.row.index === 0) {
            hookData.cell.styles.fillColor = PDF_COLORS.warningLight;
            hookData.cell.styles.fontStyle = 'bold';
          }
          // Color conversion column
          if (hookData.column.index === 3) {
            const rate = data.agents!.topAgents[hookData.row.index]?.conversionRate || 0;
            hookData.cell.styles.textColor = rate >= 30 ? PDF_COLORS.success : rate >= 15 ? PDF_COLORS.warning : PDF_COLORS.danger;
          }
          // Color task completion column
          if (hookData.column.index === 7) {
            const taskRate = data.agents!.topAgents[hookData.row.index]?.taskCompletionRate || 0;
            hookData.cell.styles.textColor = taskRate >= 80 ? PDF_COLORS.success : taskRate >= 50 ? PDF_COLORS.warning : PDF_COLORS.danger;
          }
        }
      },
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // ── GAMIFICACIÓN ──
  if (data.gamification) {
    yPos = pdfSectionBar(doc, 'Gamificación', PDF_COLORS.warning, yPos);

    const gamMetrics: [string, string, number | undefined][] = [
      ['Tasa de Engagement', pdfFormatKPIValue(data.gamification.engagementRate), data.gamification.engagementRate?.change],
      ['Puntos Promedio', pdfFormatKPIValue(data.gamification.avgPoints), data.gamification.avgPoints?.change],
      ['Desafíos Completados', pdfFormatKPIValue(data.gamification.challengeCompletion), data.gamification.challengeCompletion?.change],
      ['Racha Promedio', pdfFormatKPIValue(data.gamification.avgStreak), data.gamification.avgStreak?.change],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [['Métrica', 'Valor', 'Cambio']],
      body: gamMetrics.map(([l, v, c]) => [l, v, pdfChangeText(c, l)]),
      ...pdfTableStyles,
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' }, 2: { halign: 'center' } },
      didParseCell: (hookData) => {
        if (hookData.section === 'body' && hookData.column.index === 2) {
          const [label, , change] = gamMetrics[hookData.row.index] || [];
          hookData.cell.styles.textColor = pdfChangeColor(change, label || '');
          hookData.cell.styles.fontStyle = 'bold';
        }
      },
    });
    yPos = (doc as any).lastAutoTable.finalY + 8;

    // Level distribution
    if (data.gamification.levelDistribution?.length > 0) {
      yPos = pdfEnsureSpace(doc, yPos, 30);
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text('Distribución por Nivel', 14, yPos);
      yPos += 4;

      const totalUsers = data.gamification.levelDistribution.reduce((s, l) => s + l.count, 0) || 1;
      const levelColors: [number, number, number][] = [PDF_COLORS.slate200, PDF_COLORS.primary, PDF_COLORS.purple, PDF_COLORS.warning, PDF_COLORS.danger];

      autoTable(doc, {
        startY: yPos,
        head: [['Nivel', 'Usuarios', '%', '']],
        body: data.gamification.levelDistribution.map(l => [
          l.level, String(l.count), `${((l.count / totalUsers) * 100).toFixed(1)}%`, '',
        ]),
        ...pdfTableStyles,
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right', fontStyle: 'bold' }, 3: { cellWidth: 50 } },
        didDrawCell: (hookData) => {
          if (hookData.section === 'body' && hookData.column.index === 3) {
            const lvl = data.gamification!.levelDistribution![hookData.row.index];
            if (lvl) {
              const color = levelColors[hookData.row.index % levelColors.length];
              pdfProgressBar(doc, hookData.cell.x + 2, hookData.cell.y + hookData.cell.height / 2 - 2, hookData.cell.width - 4, (lvl.count / totalUsers) * 100, color);
            }
          }
        },
      });
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }
  }

  // ── SALUD DEL NEGOCIO ──
  if (data.business) {
    yPos = pdfSectionBar(doc, 'Salud del Negocio', PDF_COLORS.emerald, yPos);

    const clvVal = Number(data.business.clv.value) || 1;
    const cacVal = Number(data.business.cac.value) || 1;
    const clvCacRatio = (clvVal / cacVal).toFixed(1);

    // CLV:CAC highlight box
    yPos = pdfEnsureSpace(doc, yPos, 25);
    const boxWidth = 70;
    const boxX = (pageWidth - boxWidth) / 2;
    const ratioColor: [number, number, number] = parseFloat(clvCacRatio) >= 3 ? PDF_COLORS.success : parseFloat(clvCacRatio) >= 2 ? PDF_COLORS.warning : PDF_COLORS.danger;
    doc.setFillColor(ratioColor[0], ratioColor[1], ratioColor[2]);
    doc.roundedRect(boxX, yPos, boxWidth, 18, 3, 3, 'F');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text('RATIO CLV:CAC', pageWidth / 2, yPos + 6, { align: 'center' });
    doc.setFontSize(16);
    doc.text(`${clvCacRatio}:1`, pageWidth / 2, yPos + 15, { align: 'center' });
    yPos += 24;

    const bizMetrics: [string, string, number | undefined][] = [
      ['Customer Lifetime Value', pdfFormatKPIValue(data.business.clv), data.business.clv?.change],
      ['Customer Acquisition Cost', pdfFormatKPIValue(data.business.cac), data.business.cac?.change],
      ['Crecimiento de Cartera', pdfFormatKPIValue(data.business.portfolioGrowth), data.business.portfolioGrowth?.change],
      ['Net Promoter Score', String(data.business.nps?.value || 0), data.business.nps?.change],
      ['Ingreso por Empleado', pdfCurrency(Number(data.business.revenuePerEmployee?.value) || 0), data.business.revenuePerEmployee?.change],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [['Métrica', 'Valor', 'Cambio']],
      body: bizMetrics.map(([l, v, c]) => [l, v, pdfChangeText(c, l)]),
      ...pdfTableStyles,
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' }, 2: { halign: 'center' } },
      didParseCell: (hookData) => {
        if (hookData.section === 'body' && hookData.column.index === 2) {
          const [label, , change] = bizMetrics[hookData.row.index] || [];
          hookData.cell.styles.textColor = pdfChangeColor(change, label || '');
          hookData.cell.styles.fontStyle = 'bold';
        }
      },
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // ── TENDENCIAS ──
  if (trendData) {
    yPos = pdfSectionBar(doc, 'Tendencias', PDF_COLORS.slate800, yPos);

    const trendConfigs: { key: keyof TrendData; label: string; color: [number, number, number]; format: (v: number) => string }[] = [
      { key: 'conversionRate', label: 'Tasa de Conversión', color: PDF_COLORS.success, format: v => `${Number(v || 0).toFixed(1)}%` },
      { key: 'disbursementVolume', label: 'Volumen de Desembolso', color: PDF_COLORS.primary, format: v => pdfCurrency(Number(v) || 0) },
      { key: 'collectionRate', label: 'Tasa de Cobro', color: PDF_COLORS.purple, format: v => `${Number(v || 0).toFixed(1)}%` },
      { key: 'portfolioGrowth', label: 'Crecimiento de Cartera', color: PDF_COLORS.emerald, format: v => pdfCurrency(Number(v) || 0) },
      { key: 'delinquencyRate', label: 'Tasa de Morosidad', color: PDF_COLORS.danger, format: v => `${Number(v || 0).toFixed(1)}%` },
      { key: 'leadsCount', label: 'Nuevos Leads', color: PDF_COLORS.warning, format: v => String(Math.round(Number(v) || 0)) },
    ];

    // Summary table
    const trendSummary = trendConfigs.map(cfg => {
      const points = trendData[cfg.key] || [];
      if (points.length === 0) return [cfg.label, '-', '-', '-', '-', '-'];
      const values = points.map(p => Number(p.value) || 0);
      const current = values[values.length - 1];
      const min = Math.min(...values);
      const max = Math.max(...values);
      const avg = values.reduce((s, v) => s + v, 0) / values.length;
      const trend = current > values[0] ? '▲ Subiendo' : current < values[0] ? '▼ Bajando' : '– Estable';
      return [cfg.label, cfg.format(current), cfg.format(min), cfg.format(max), cfg.format(avg), trend];
    });

    autoTable(doc, {
      startY: yPos,
      head: [['Indicador', 'Actual', 'Mín', 'Máx', 'Promedio', 'Tendencia']],
      body: trendSummary,
      ...pdfTableStyles,
      columnStyles: {
        1: { halign: 'right', fontStyle: 'bold' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'center' },
      },
      didParseCell: (hookData) => {
        if (hookData.section === 'body' && hookData.column.index === 5) {
          const text = String(hookData.cell.raw || '');
          if (text.includes('▲')) hookData.cell.styles.textColor = PDF_COLORS.success;
          else if (text.includes('▼')) hookData.cell.styles.textColor = PDF_COLORS.danger;
          else hookData.cell.styles.textColor = PDF_COLORS.slate500;
          hookData.cell.styles.fontStyle = 'bold';
        }
      },
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Individual trend sections with data bars
    for (const cfg of trendConfigs) {
      const points = trendData[cfg.key] || [];
      if (points.length === 0) continue;

      yPos = pdfEnsureSpace(doc, yPos, 30);
      doc.setFillColor(cfg.color[0], cfg.color[1], cfg.color[2]);
      doc.roundedRect(14, yPos, pageWidth - 28, 8, 1.5, 1.5, 'F');
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text(cfg.label.toUpperCase(), pageWidth / 2, yPos + 5.5, { align: 'center' });
      yPos += 12;

      const numericPoints = points.map(p => ({ ...p, numValue: Number(p.value) || 0 }));
      const maxVal = Math.max(...numericPoints.map(p => p.numValue), 1);

      autoTable(doc, {
        startY: yPos,
        head: [['Mes', 'Valor', '']],
        body: numericPoints.map(p => [p.label, cfg.format(p.numValue), '']),
        ...pdfTableStyles,
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' }, 2: { cellWidth: 60 } },
        didDrawCell: (hookData) => {
          if (hookData.section === 'body' && hookData.column.index === 2) {
            const pt = numericPoints[hookData.row.index];
            if (pt) {
              pdfProgressBar(doc, hookData.cell.x + 2, hookData.cell.y + hookData.cell.height / 2 - 2, hookData.cell.width - 4, (pt.numValue / maxVal) * 100, cfg.color);
            }
          }
        },
      });
      yPos = (doc as any).lastAutoTable.finalY + 8;
    }
  }

  // ── Footer with accent bars ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    // Bottom accent bar
    doc.setFillColor(59, 130, 246);
    doc.rect(0, pageHeight - 8, pageWidth, 2, 'F');
    // Page number
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Página ${i} de ${pageCount} | Generado automáticamente | ${new Date().toLocaleDateString('es-CR')}`,
      pageWidth / 2,
      pageHeight - 12,
      { align: 'center' }
    );
  }

  // Download
  const fileName = `KPIs_Report_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};
