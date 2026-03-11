import React from 'react';
import {
  PackageCheck,
  RotateCcw,
  Building2,
  MapPin,
  Clock,
} from 'lucide-react';
import type { TareaTipo, TareaPrioridad, TareaStatus, RutaStatus } from './types';

export const tipoLabels: Record<TareaTipo, string> = {
  entrega: 'Entrega',
  recoleccion: 'Recolección',
  tramite: 'Trámite',
  deposito: 'Depósito',
  otro: 'Otro',
};

export const tipoIcons: Record<TareaTipo, React.ReactNode> = {
  entrega: <PackageCheck className="h-4 w-4" />,
  recoleccion: <RotateCcw className="h-4 w-4" />,
  tramite: <Building2 className="h-4 w-4" />,
  deposito: <MapPin className="h-4 w-4" />,
  otro: <Clock className="h-4 w-4" />,
};

export const prioridadLabels: Record<TareaPrioridad, string> = {
  normal: 'Normal',
  urgente: 'Urgente',
  critica: 'Crítica',
};

export const prioridadColors: Record<TareaPrioridad, string> = {
  normal: 'bg-slate-100 text-slate-700',
  urgente: 'bg-amber-100 text-amber-800',
  critica: 'bg-red-100 text-red-800',
};

export const statusLabels: Record<TareaStatus, string> = {
  pendiente: 'Pendiente',
  asignada: 'Asignada',
  en_transito: 'En Tránsito',
  completada: 'Completada',
  fallida: 'Fallida',
  cancelada: 'Cancelada',
};

export const statusColors: Record<TareaStatus, string> = {
  pendiente: 'bg-slate-100 text-slate-700',
  asignada: 'bg-blue-100 text-blue-800',
  en_transito: 'bg-purple-100 text-purple-800',
  completada: 'bg-green-100 text-green-800',
  fallida: 'bg-red-100 text-red-800',
  cancelada: 'bg-gray-100 text-gray-500',
};

export const rutaStatusLabels: Record<RutaStatus, string> = {
  borrador: 'Borrador',
  confirmada: 'Confirmada',
  en_progreso: 'En Progreso',
  completada: 'Completada',
};

export const rutaStatusColors: Record<RutaStatus, string> = {
  borrador: 'bg-slate-100 text-slate-700',
  confirmada: 'bg-blue-100 text-blue-800',
  en_progreso: 'bg-purple-100 text-purple-800',
  completada: 'bg-green-100 text-green-800',
};

export const extStatusColors: Record<string, string> = {
  'Planificada': 'bg-blue-100 text-blue-800',
  'En Progreso': 'bg-purple-100 text-purple-800',
  'Completada': 'bg-green-100 text-green-800',
  'Pendiente': 'bg-slate-100 text-slate-700',
};
