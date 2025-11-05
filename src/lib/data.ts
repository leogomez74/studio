// Este archivo contiene datos de ejemplo (mock data) para la aplicación.
// En una aplicación real, estos datos vendrían de una base de datos.

// Define la estructura (el "tipo") de un objeto Usuario.
export type User = {
  id: string; // Identificador único del usuario.
  name: string; // Nombre del usuario.
  email: string; // Correo electrónico del usuario.
  phone: string; // Teléfono del usuario.
  status: 'Nuevo' | 'Contactado' | 'Pendiente' | 'Caso Creado'; // El estado actual de la oportunidad.
  registeredOn: string; // Fecha de registro.
  avatarUrl: string; // URL de la imagen de perfil.
};

// Define la estructura de un objeto Voluntario.
export type Volunteer = {
  id: string;
  name: string;
  email: string;
  expertise: string; // Área de especialización del voluntario.
  availability: string; // Disponibilidad del voluntario.
  avatarUrl: string;
};

// Define la estructura de un objeto Punto Autorizado.
export type Branch = {
  id: string;
  name: string;
  address: string; // Dirección del punto autorizado.
  manager: string; // Nombre del gerente.
};

// Define la estructura de un objeto Caso.
export type Case = {
  id: string;
  title: string; // Título o nombre del caso.
  clientName: string; // Nombre del cliente asociado al caso.
  assignedTo: string; // A quién está asignado el caso.
  status: 'Abierto' | 'En Progreso' | 'En Espera' | 'Cerrado' | 'Sentencia'; // Estado actual del caso.
  lastUpdate: string; // Fecha de la última actualización.
  category: 'Contenciosa' | 'No Contenciosa'; // Categoría del caso.
  opportunityLifecycle: number; // Porcentaje de progreso del ciclo de vida.
};

// Estructura para mensajeros
export type Courier = {
  id: string;
  name: string;
  phone: string;
  vehicle: 'Motocicleta' | 'Automóvil';
};

// Estructura para recogidas pendientes
export type PendingPickup = {
  id: string;
  caseId: string;
  clientName: string;
  branchId: string;
  branchName: string;
  documentCount: number;
  status: 'Pendiente de Retiro';
};

// Estructura para las rutas
export type Route = {
  id: string;
  routeName: string;
  courierId: string;
  courierName: string;
  date: string;
  status: 'Planificada' | 'En Progreso' | 'Completada';
  stops: {
    branchId: string;
    branchName: string;
    address: string;
    pickups: PendingPickup[];
  }[];
};


// Lista de usuarios de ejemplo.
export const users: User[] = [
  { id: 'USR001', name: 'Ana Silva', email: 'ana.silva@example.com', phone: '(11) 98765-4321', status: 'Caso Creado', registeredOn: '2023-10-26', avatarUrl: 'https://picsum.photos/seed/avatar1/40/40' },
  { id: 'USR002', name: 'Bruno Costa', email: 'bruno.costa@example.com', phone: '(21) 91234-5678', status: 'Contactado', registeredOn: '2023-10-25', avatarUrl: 'https://picsum.photos/seed/avatar2/40/40' },
  { id: 'USR003', name: 'Carla Dias', email: 'carla.dias@example.com', phone: '(31) 95555-4444', status: 'Nuevo', registeredOn: '2023-10-27', avatarUrl: 'https://picsum.photos/seed/avatar3/40/40' },
  { id: 'USR004', name: 'Daniel Alves', email: 'daniel.alves@example.com', phone: '(41) 94321-8765', status: 'Pendiente', registeredOn: '2023-10-24', avatarUrl: 'https://picsum.photos/seed/avatar4/40/40' },
  { id: 'USR005', name: 'Beatriz Lima', email: 'beatriz.lima@example.com', phone: '(51) 98877-6655', status: 'Nuevo', registeredOn: '2023-10-28', avatarUrl: 'https://picsum.photos/seed/avatar5/40/40' },
];

// Lista de voluntarios de ejemplo.
export const volunteers: Volunteer[] = [
  { id: 'VOL001', name: 'Eduardo Martins', email: 'eduardo.m@example.com', expertise: 'Derecho Civil', availability: 'Fines de semana', avatarUrl: 'https://picsum.photos/seed/avatar6/40/40' },
  { id: 'VOL002', name: 'Fernanda Lima', email: 'fernanda.l@example.com', expertise: 'Derecho Penal', availability: 'Días de semana', avatarUrl: 'https://picsum.photos/seed/avatar7/40/40' },
  { id: 'VOL003', name: 'Gabriel Rocha', email: 'gabriel.r@example.com', expertise: 'Derecho de Familia', availability: 'Fines de semana', avatarUrl: 'https://picsum.photos/seed/avatar8/40/40' },
];

// Lista de puntos autorizados de ejemplo.
export const branches: Branch[] = [
    { id: 'BRH001', name: 'Oficina Central', address: 'San José, San José', manager: 'Ricardo Gomes' },
    { id: 'BRH002', name: 'Punto Autorizado Heredia', address: 'Heredia, Heredia', manager: 'Helena Souza' },
    { id: 'BRH003', name: 'Punto Autorizado Cartago', address: 'Cartago, El Tejar', manager: 'Mario Vega' },
];

// Lista de casos de ejemplo.
export const cases: Case[] = [
  { id: 'CAS001', title: 'Amparo Constitucional vs. Estado', clientName: 'Ana Silva', assignedTo: 'Eduardo Martins', status: 'Sentencia', lastUpdate: '2023-11-01', category: 'Contenciosa', opportunityLifecycle: 90 },
  { id: 'CAS002', title: 'Resolución de Disputa de Propiedad', clientName: 'John Doe', assignedTo: 'Fernanda Lima', status: 'Abierto', lastUpdate: '2023-10-30', category: 'No Contenciosa', opportunityLifecycle: 25 },
  { id: 'CAS003', title: 'Reclamo de Derechos Laborales', clientName: 'Jane Smith', assignedTo: 'Eduardo Martins', status: 'Cerrado', lastUpdate: '2023-09-15', category: 'Contenciosa', opportunityLifecycle: 100 },
  { id: 'CAS004', title: 'Procedimiento de Divorcio', clientName: 'Bruno Costa', assignedTo: 'Gabriel Rocha', status: 'Sentencia', lastUpdate: '2023-11-05', category: 'No Contenciosa', opportunityLifecycle: 95 },
];

// Lista de notificaciones de ejemplo.
export const notifications = [
    { id: 1, text: 'Nueva oportunidad "Carla Dias" registrada.', time: 'hace 10 min', read: false },
    { id: 2, text: 'El estado del caso #CAS001 se actualizó a "Sentencia".', time: 'hace 1 hora', read: false },
    { id: 3, text: 'La voluntaria "Fernanda Lima" acaba de registrarse.', time: 'hace 3 horas', read: true },
    { id: 4, text: 'Se ha subido un documento para el caso #CAS002.', time: 'hace 1 día', read: true },
    { id: 5, text: 'Documentos para caso #CAS004 listos para retirar en Punto Autorizado Heredia.', time: 'hace 2 días', read: true },
];

// Lista de mensajeros
export const couriers: Courier[] = [
  { id: 'COUR01', name: 'Carlos Jimenez', phone: '8888-1111', vehicle: 'Motocicleta' },
  { id: 'COUR02', name: 'Luisa Fernandez', phone: '8888-2222', vehicle: 'Automóvil' },
];

// Lista de recogidas pendientes
export const pendingPickups: PendingPickup[] = [
  { id: 'PICK01', caseId: 'CAS001', clientName: 'Ana Silva', branchId: 'BRH002', branchName: 'Punto Autorizado Heredia', documentCount: 3, status: 'Pendiente de Retiro' },
  { id: 'PICK02', caseId: 'CAS004', clientName: 'Bruno Costa', branchId: 'BRH003', branchName: 'Punto Autorizado Cartago', documentCount: 2, status: 'Pendiente de Retiro' },
  { id: 'PICK03', caseId: 'CAS005', clientName: 'Otro Cliente', branchId: 'BRH002', branchName: 'Punto Autorizado Heredia', documentCount: 1, status: 'Pendiente de Retiro' },
];

// Lista de rutas planificadas
export const routes: Route[] = [
  {
    id: 'RUTA-20231110-01',
    routeName: 'Ruta Matutina GAM',
    courierId: 'COUR01',
    courierName: 'Carlos Jimenez',
    date: '2023-11-10',
    status: 'Planificada',
    stops: [
      {
        branchId: 'BRH002',
        branchName: 'Punto Autorizado Heredia',
        address: 'Heredia, Heredia',
        pickups: pendingPickups.filter(p => p.branchId === 'BRH002')
      },
      {
        branchId: 'BRH003',
        branchName: 'Punto Autorizado Cartago',
        address: 'Cartago, El Tejar',
        pickups: pendingPickups.filter(p => p.branchId === 'BRH003')
      }
    ]
  },
  {
    id: 'RUTA-20231109-02',
    routeName: 'Ruta Vespertina Central',
    courierId: 'COUR02',
    courierName: 'Luisa Fernandez',
    date: '2023-11-09',
    status: 'Completada',
    stops: [
        {
            branchId: 'BRH001',
            branchName: 'Oficina Central',
            address: 'San José, San José',
            pickups: []
        }
    ]
  }
];
