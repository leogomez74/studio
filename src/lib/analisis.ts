import { Lead } from './data';

// Tipos de deducciones disponibles
export const DEDUCCIONES_TIPOS = [
  "Comisión",
  "Intereses",
  "Respaldo deudor",
  "Transporte",
  "Comisión de Formalización Elastic 1",
  "Descuento por factura",
  "Intereses por adelantado",
] as const;

export type DeduccionTipo = typeof DEDUCCIONES_TIPOS[number];

// Interfaces
export interface DeduccionItem {
  nombre: string;
  monto: number;
}

export interface DeduccionMensual {
  mes: number;
  monto: number;
}

export interface ManchaDetalle {
  descripcion: string;
  monto: number;
}

export interface JuicioDetalle {
  fecha: string;
  estado: 'activo' | 'cerrado';
  expediente: string;
  monto: number;
}

export interface EmbargoDetalle {
  fecha: string;
  motivo: string;
  monto: number;
}

export interface EditableDeduccion {
  nombre: string;
  monto: number;
  activo: boolean;
}

export interface Propuesta {
  id: number;
  analisis_reference: string;
  monto: number;
  plazo: number;
  cuota: number;
  interes: number;
  categoria: string | null;
  estado: 'Pendiente' | 'Aceptada' | 'Denegada';
  aceptada_por: number | null;
  aceptada_at: string | null;
  aceptada_por_user?: { id: number; name: string } | null;
  created_at: string;
  updated_at: string;
}

export interface AnalisisItem {
  id: number;
  reference: string;
  monto_credito: number;
  monto_solicitado?: number;
  monto_sugerido?: number;
  cuota?: number;
  created_at: string;
  opportunity_id?: string;
  lead_id?: string;
  lead?: Lead;
  ingreso_bruto?: number;
  ingreso_neto?: number;
  ingreso_bruto_2?: number;
  ingreso_neto_2?: number;
  ingreso_bruto_3?: number;
  ingreso_neto_3?: number;
  ingreso_bruto_4?: number;
  ingreso_neto_4?: number;
  ingreso_bruto_5?: number;
  ingreso_neto_5?: number;
  ingreso_bruto_6?: number;
  ingreso_neto_6?: number;
  numero_manchas?: number;
  numero_juicios?: number;
  numero_embargos?: number;
  plazo?: number;
  cargo?: string;
  nombramiento?: string;
  deducciones?: DeduccionItem[];
  deducciones_mensuales?: DeduccionMensual[];
  manchas_detalle?: ManchaDetalle[];
  juicios_detalle?: JuicioDetalle[];
  embargos_detalle?: EmbargoDetalle[];
  propuestas?: Propuesta[];
  estado_pep?: string;
  estado_cliente?: string | null;
  has_credit?: boolean;
  credit_id?: number;
}

export interface AnalisisFile {
  name: string;
  path: string;
  url: string;
  size: number;
  last_modified: number;
}

// Formateadores
export function formatCurrency(amount: number, currency: string = 'CRC'): string {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Helpers para deducciones
export function initializeEditableDeducciones(existingDeducciones?: DeduccionItem[]): EditableDeduccion[] {
  const deduccionesMap = new Map((existingDeducciones || []).map(d => [d.nombre, d.monto]));
  return DEDUCCIONES_TIPOS.map(nombre => ({
    nombre,
    monto: deduccionesMap.get(nombre) || 0,
    activo: deduccionesMap.has(nombre) && (deduccionesMap.get(nombre) || 0) > 0,
  }));
}

export function getActiveDeduccionesTotal(deducciones: EditableDeduccion[]): number {
  return deducciones
    .filter(d => d.activo)
    .reduce((sum, d) => sum + d.monto, 0);
}

export function filterActiveDeduccionesForSave(deducciones: EditableDeduccion[]): DeduccionItem[] {
  return deducciones
    .filter(d => d.activo && d.monto > 0)
    .map(d => ({ nombre: d.nombre, monto: d.monto }));
}
