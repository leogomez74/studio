export type TareaTipo = 'entrega' | 'recoleccion' | 'tramite' | 'deposito' | 'otro';
export type TareaPrioridad = 'normal' | 'urgente' | 'critica';
export type TareaStatus = 'pendiente' | 'asignada' | 'en_transito' | 'completada' | 'fallida' | 'cancelada';
export type RutaStatus = 'borrador' | 'confirmada' | 'en_progreso' | 'completada';

export interface TareaRuta {
  id: number;
  titulo: string;
  descripcion: string | null;
  tipo: TareaTipo;
  prioridad: TareaPrioridad;
  status: TareaStatus;
  solicitado_por: number;
  solicitante?: { id: number; name: string } | null;
  asignado_a: number | null;
  asignado?: { id: number; name: string } | null;
  ruta_diaria_id: number | null;
  ruta_diaria?: { id: number; fecha: string; status: RutaStatus } | null;
  empresa_destino: string | null;
  direccion_destino: string | null;
  provincia: string | null;
  canton: string | null;
  contacto_nombre: string | null;
  contacto_telefono: string | null;
  fecha_limite: string | null;
  fecha_asignada: string | null;
  posicion: number | null;
  prioridad_override: boolean;
  prioridad_por: number | null;
  completada_at: string | null;
  notas_completado: string | null;
  motivo_fallo: string | null;
  referencia_tipo: string | null;
  referencia_id: number | null;
  created_at: string;
}

export interface RutaDiaria {
  id: number;
  fecha: string;
  mensajero_id: number;
  mensajero?: { id: number; name: string } | null;
  status: RutaStatus;
  total_tareas: number;
  completadas: number;
  notas: string | null;
  confirmada_por: number | null;
  confirmada_por_rel?: { id: number; name: string } | null;
  confirmada_at: string | null;
  tareas?: TareaRuta[];
  tareas_count?: number;
  completadas_count?: number;
}

export interface UserOption {
  id: number;
  name: string;
  email: string;
}

export interface ExternalStop {
  id: number;
  sequence: number;
  branch_name: string;
  address?: string;
  status: string;
  pickups?: { id: number; reference: string; client_name: string; document_count?: number; status: string }[];
}

export interface ExternalRoute {
  id: number;
  reference: string;
  name: string;
  status: string;
  scheduled_date?: string;
  started_at?: string;
  completed_at?: string;
  courier?: { id: number; name: string; phone?: string; vehicle_type?: string };
  stops?: ExternalStop[];
}

export interface ExternalIntegrationResult {
  integration_id: number;
  integration_name: string;
  integration_slug: string;
  success: boolean;
  error?: string;
  routes: ExternalRoute[];
  count: number;
}
