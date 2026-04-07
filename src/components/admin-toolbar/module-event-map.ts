export interface ModuleEventType {
  key: string;
  label: string;
  description: string;
  defaultTitle: string;
}

export interface ModuleConfig {
  name: string;
  eventTypes: ModuleEventType[];
}

// Mapa completo de event_types por módulo, con sus labels legibles para UI.
// Los keys deben coincidir exactamente con los event_type en la tabla task_automations.
const MODULE_MAP: Record<string, ModuleConfig> = {
  '/dashboard/leads': {
    name: 'Leads',
    eventTypes: [
      { key: 'lead_created', label: 'Nuevo Lead Creado', description: 'Al registrar un nuevo lead.', defaultTitle: 'Nuevo lead creado' },
      { key: 'lead_converted', label: 'Lead Convertido a Cliente', description: 'Al convertir exitosamente un lead en cliente.', defaultTitle: 'Onboarding de nuevo cliente' },
      { key: 'lead_inactivity_alert', label: 'Alerta de Inactividad', description: 'Leads/oportunidades inactivos detectados por el cron diario.', defaultTitle: 'Seguimiento de leads/oportunidades inactivos' },
    ],
  },
  '/dashboard/oportunidades': {
    name: 'Oportunidades',
    eventTypes: [
      { key: 'opportunity_created', label: 'Nueva Oportunidad', description: 'Al generar una oportunidad.', defaultTitle: 'Realizar análisis, solicitar colillas y verificarlas' },
      { key: 'opportunity_status_changed', label: 'Estado de Oportunidad Cambiado', description: 'Al cambiar el estado de una oportunidad (Ganada, Perdida, etc.).', defaultTitle: 'Seguimiento por cambio de oportunidad' },
      { key: 'opportunity_status_advanced', label: 'Estado Avanzado', description: 'Al avanzar el estado de una oportunidad.', defaultTitle: 'Seguimiento de oportunidad avanzada' },
      { key: 'opportunity_won', label: 'Oportunidad Ganada', description: 'Al marcar una oportunidad como ganada.', defaultTitle: 'Formalizar oportunidad ganada' },
    ],
  },
  '/dashboard/analisis': {
    name: 'Análisis',
    eventTypes: [
      { key: 'analisis_created', label: 'Análisis Creado', description: 'Al crear un análisis.', defaultTitle: 'Enviar propuesta al equipo PEP, dar seguimiento y verificar estado' },
      { key: 'pep_aceptado', label: 'PEP Acepta Análisis', description: 'Al aceptar el análisis o aprobar una propuesta.', defaultTitle: 'Informar al cliente la propuesta aceptada' },
      { key: 'pep_rechazado', label: 'PEP Rechaza Análisis', description: 'Al marcar estado PEP como "Rechazado".', defaultTitle: 'Informar al cliente que no califica para el crédito' },
    ],
  },
  '/dashboard/creditos': {
    name: 'Créditos',
    eventTypes: [
      { key: 'credit_created', label: 'Nuevo Crédito', description: 'Al crearse un nuevo crédito.', defaultTitle: 'Nuevo crédito creado' },
      { key: 'credit_status_changed', label: 'Estado de Crédito Cambiado', description: 'Al cambiar el estado de un crédito (Aprobado, Formalizado, Cerrado).', defaultTitle: 'Seguimiento por cambio de estado' },
      { key: 'credit_mora', label: 'Crédito en Mora', description: 'Cuando un crédito entra en mora por primera vez.', defaultTitle: 'Seguimiento de crédito en mora' },
      { key: 'credit_refundido', label: 'Crédito Refundido', description: 'Al refundir un crédito (cierre del anterior y apertura del nuevo).', defaultTitle: 'Gestionar documentación de refundición' },
      { key: 'abono_extraordinario', label: 'Abono Extraordinario', description: 'Al aplicar un abono extraordinario.', defaultTitle: 'Verificar plan de pagos y notificar cliente' },
      { key: 'cancelacion_anticipada', label: 'Cancelación Anticipada', description: 'Al procesar una cancelación anticipada.', defaultTitle: 'Adjuntar pagaré firmado' },
      { key: 'credit_cerrado', label: 'Crédito Cerrado', description: 'Cuando un crédito pasa a estado Cerrado o Finalizado.', defaultTitle: 'Archivar expediente de crédito cerrado' },
    ],
  },
  '/dashboard/cobros': {
    name: 'Cobros',
    eventTypes: [
      { key: 'payment_verification', label: 'Verificación de Abono', description: 'Al solicitar un abono manual.', defaultTitle: 'Verificar depósito bancario' },
      { key: 'payment_reversal_request', label: 'Anulación de Abono', description: 'Cuando se solicita anular un abono.', defaultTitle: 'Revisar solicitud de anulación de abono' },
      { key: 'saldo_reintegro_request', label: 'Reintegro de Saldo', description: 'Cuando se solicita reintegrar un saldo pendiente.', defaultTitle: 'Revisar solicitud de reintegro de saldo' },
      { key: 'planilla_uploaded', label: 'Planilla Cargada', description: 'Al cargar una planilla de pagos masivos exitosamente.', defaultTitle: 'Auditoría de planilla cargada' },
      { key: 'planilla_anulada', label: 'Planilla Anulada', description: 'Al anular una planilla.', defaultTitle: 'Verificar saldos post-anulación de planilla' },
    ],
  },
  '/dashboard/inversiones': {
    name: 'Inversiones',
    eventTypes: [
      { key: 'investment_created', label: 'Nueva Inversión', description: 'Al registrar una nueva inversión.', defaultTitle: 'Formalizar acuerdo de inversión' },
      { key: 'investment_renewed', label: 'Inversión Renovada', description: 'Al renovar una inversión.', defaultTitle: 'Verificar términos de inversión renovada' },
      { key: 'investment_liquidated', label: 'Liquidación Anticipada', description: 'Al liquidar una inversión anticipadamente.', defaultTitle: 'Procesar liquidación anticipada de inversión' },
      { key: 'investment_cancelacion_total', label: 'Cancelación Total', description: 'Al procesar la cancelación total.', defaultTitle: 'Completar cancelación total de inversión' },
      { key: 'investment_finalized', label: 'Inversión Finalizada', description: 'Cuando una inversión pasa a estado Finalizada.', defaultTitle: 'Archivar expediente de inversión finalizada' },
    ],
  },
  '/dashboard/rutas': {
    name: 'Rutas',
    eventTypes: [
      { key: 'ruta_confirmada', label: 'Ruta Confirmada', description: 'Al confirmar una ruta diaria (pasa de borrador a confirmada).', defaultTitle: 'Verificar ruta confirmada con mensajero' },
      { key: 'ruta_iniciada', label: 'Ruta Iniciada', description: 'Al iniciar una ruta confirmada (mensajero sale a campo).', defaultTitle: 'Seguimiento de ruta en progreso' },
      { key: 'visita_completada', label: 'Visita Completada', description: 'Al marcar una visita de campo como completada.', defaultTitle: 'Seguimiento post-visita' },
    ],
  },
  '/dashboard/rewards': {
    name: 'Recompensas',
    eventTypes: [
      { key: 'reward_redemption_request', label: 'Canje de Recompensa', description: 'Cuando un usuario canjea puntos por una recompensa.', defaultTitle: 'Aprobar canje de recompensa' },
    ],
  },
};

/**
 * Devuelve la configuración del módulo según el pathname actual.
 * Si la ruta no tiene módulo configurado o es /dashboard/tareas, retorna null.
 */
export function getModuleFromPathname(pathname: string): ModuleConfig | null {
  // Busca match por prefijo para que subrutas también funcionen
  // (/dashboard/creditos/123 → /dashboard/creditos)
  const matchedKey = Object.keys(MODULE_MAP).find((key) =>
    pathname === key || pathname.startsWith(key + '/')
  );
  return matchedKey ? MODULE_MAP[matchedKey] : null;
}

/**
 * Devuelve el label legible de un event_type dado.
 */
export function getEventLabel(eventKey: string): string {
  for (const module of Object.values(MODULE_MAP)) {
    const found = module.eventTypes.find((e) => e.key === eventKey);
    if (found) return found.label;
  }
  return eventKey;
}
