// Este archivo contiene datos de ejemplo (mock data) para la aplicación.
// En una aplicación real, estos datos vendrían de una base de datos.

// Define la estructura (el "tipo") de un objeto Usuario.
export type User = {
  id: string; // Identificador único del usuario.
  name: string; // Nombre del usuario.
  cedula: string; // Cédula de identidad.
  email: string; // Correo electrónico del usuario.
  phone: string; // Teléfono del usuario.
  status: 'Nuevo' | 'Contactado' | 'Pendiente' | 'Caso Creado'; // El estado actual de la oportunidad.
  registeredOn: string; // Fecha de registro.
  avatarUrl: string; // URL de la imagen de perfil.
};

// Estructura para el personal interno
export type Staff = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
}

// Estructura para una Oportunidad
export type Opportunity = {
  id: string;
  leadCedula: string;
  against: 'CCSS' | 'MEP' | 'Municipalidad' | 'Migración' | 'Otro';
  opportunityType: string;
  status: 'Nuevo' | 'Contactado' | 'Pendiente' | 'Caso Creado';
  startDate: string;
  assignedTo: string;
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
  title?: string; // Título o nombre del caso (opcional para ejecuciones).
  amparoId?: string; // ID del amparo original (para ejecuciones).
  clientName: string; // Nombre del cliente asociado al caso.
  assignedTo: string; // A quién está asignado el caso.
  status: 'Abierto' | 'En Progreso' | 'En Espera' | 'Cerrado' | 'Sentencia'; // Estado actual del caso.
  lastUpdate: string; // Fecha de la última actualización.
  category: 'Contenciosa' | 'No Contenciosa'; // Categoría del caso.
  specialty: string; // Especialidad médica del amparo.
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


// Lista de usuarios de ejemplo (Leads).
export const users: User[] = [
  { id: 'USR001', name: 'Ana Silva Rojas', cedula: '1-1234-5678', email: 'ana.silva@example.com', phone: '8765-4321', status: 'Caso Creado', registeredOn: '2023-10-26', avatarUrl: 'https://picsum.photos/seed/avatar1/40/40' },
  { id: 'USR002', name: 'Bruno Costa Marin', cedula: '2-0987-6543', email: 'bruno.costa@example.com', phone: '6123-4567', status: 'Contactado', registeredOn: '2023-10-25', avatarUrl: 'https://picsum.photos/seed/avatar2/40/40' },
  { id: 'USR003', name: 'Carla Díaz Solano', cedula: '3-1111-2222', email: 'carla.dias@example.com', phone: '7555-4444', status: 'Nuevo', registeredOn: '2023-10-27', avatarUrl: 'https://picsum.photos/seed/avatar3/40/40' },
  { id: 'USR004', name: 'Daniel Alves Mora', cedula: '4-2222-3333', email: 'daniel.alves@example.com', phone: '5432-1876', status: 'Pendiente', registeredOn: '2023-10-24', avatarUrl: 'https://picsum.photos/seed/avatar4/40/40' },
  { id: 'USR005', name: 'Beatriz Lima Fernández', cedula: '5-3333-4444', email: 'beatriz.lima@example.com', phone: '8877-6655', status: 'Nuevo', registeredOn: '2023-10-28', avatarUrl: 'https://picsum.photos/seed/avatar5/40/40' },
];

// Lista de personal interno
export const staff: Staff[] = [
  { id: 'STF001', name: 'Jorge Ortiz', email: 'jorge@dsf.cr', avatarUrl: 'https://picsum.photos/seed/staff1/40/40' },
  { id: 'STF002', name: 'Raizza Mildrey', email: 'raizza@dsf.cr', avatarUrl: 'https://picsum.photos/seed/staff2/40/40' },
  { id: 'STF003', name: 'Freddy Bravo', email: 'freddy@dsf.cr', avatarUrl: 'https://picsum.photos/seed/staff3/40/40' },
  { id: 'STF004', name: 'Richard Milán', email: 'richard@dsf.cr', avatarUrl: 'https://picsum.photos/seed/staff4/40/40' },
  { id: 'STF005', name: 'Carolina Chavarría', email: 'carolina@dsf.cr', avatarUrl: 'https://picsum.photos/seed/staff5/40/40' },
  { id: 'STF006', name: 'María Vargas', email: 'maria@dsf.cr', avatarUrl: 'https://picsum.photos/seed/staff6/40/40' },
  { id: 'STF007', name: 'Leonardo Gómez', email: 'leonardo@dsf.cr', avatarUrl: 'https://picsum.photos/seed/staff7/40/40' },
];

// Lista de oportunidades de ejemplo
export const opportunities: Opportunity[] = [
    { id: 'OPP001', leadCedula: '1-1234-5678', against: 'CCSS', opportunityType: 'Lista de Espera', status: 'Nuevo', startDate: '2023-11-01', assignedTo: 'Raizza Mildrey' },
    { id: 'OPP002', leadCedula: '2-0987-6543', against: 'MEP', opportunityType: 'Salarios', status: 'Contactado', startDate: '2023-11-02', assignedTo: 'Jorge Ortiz' },
    { id: 'OPP003', leadCedula: '3-1111-2222', against: 'Municipalidad', opportunityType: 'Falta de Respuesta', status: 'Pendiente', startDate: '2023-11-03', assignedTo: 'Freddy Bravo' },
    { id: 'OPP004', leadCedula: '4-2222-3333', against: 'CCSS', opportunityType: 'Cirugía', status: 'Nuevo', startDate: '2023-11-04', assignedTo: 'Raizza Mildrey' },
    { id: 'OPP005', leadCedula: '5-3333-4444', against: 'MEP', opportunityType: 'Carrera Profesional', status: 'Caso Creado', startDate: '2023-11-05', assignedTo: 'Richard Milán' },
];


// Lista de voluntarios de ejemplo.
export const volunteers: Volunteer[] = [
    { id: 'VOL001', name: 'Eduardo Martins', email: 'eduardo.m@example.com', expertise: 'Mensajería', availability: 'Días de semana', avatarUrl: 'https://picsum.photos/seed/avatar6/40/40' },
    { id: 'VOL002', name: 'Fernanda Lima', email: 'fernanda.l@example.com', expertise: 'Diseño Gráfico', availability: 'Fines de semana', avatarUrl: 'https://picsum.photos/seed/avatar7/40/40' },
    { id: 'VOL003', name: 'Gabriel Rocha', email: 'gabriel.r@example.com', expertise: 'Soporte Técnico', availability: 'Tardes', avatarUrl: 'https://picsum.photos/seed/avatar8/40/40' },
];

// Lista de puntos autorizados de ejemplo.
export const branches: Branch[] = [
  { id: 'BRH001', name: 'Oficina Central', address: 'San José, San José', manager: 'Ricardo Gomes' },
  { id: 'BRH002', name: 'Punto Autorizado Heredia', address: 'Heredia, Santo Domingo', manager: 'Helena Souza' },
  { id: 'BRH003', name: 'Punto Autorizado Cartago', address: 'Cartago, La Unión', manager: 'Mario Vega' },
  { id: 'BRH004', name: 'Punto Autorizado Alajuela', address: 'Alajuela, San Ramón', manager: 'Lucía Montero' },
  { id: 'BRH005', name: 'Punto Autorizado Guanacaste', address: 'Guanacaste, Liberia', manager: 'Jorge Solís' },
];

// Lista de casos de ejemplo.
export const cases: Case[] = [
  { id: 'CAS001', title: 'Lista de espera por cirugía vs. CCSS', clientName: 'Ana Silva Rojas', assignedTo: 'Eduardo Martins', status: 'Sentencia', lastUpdate: '2023-11-01', category: 'Contenciosa', specialty: 'Cirugía General', opportunityLifecycle: 90 },
  { id: 'CAS002', title: 'Cita a largo plazo para radiología vs. CCSS', clientName: 'John Doe', assignedTo: 'Fernanda Lima', status: 'Abierto', lastUpdate: '2023-10-30', category: 'No Contenciosa', specialty: 'Radiología', opportunityLifecycle: 25 },
  { id: 'CAS003', title: 'Atraso en pago de salarios vs. MEP', clientName: 'Jane Smith', assignedTo: 'Eduardo Martins', status: 'En Progreso', lastUpdate: '2023-09-15', category: 'Contenciosa', specialty: 'Recursos Humanos', opportunityLifecycle: 50 },
  { id: 'CAS004', title: 'Falta de pago por carrera profesional vs. MEP', clientName: 'Bruno Costa Marin', assignedTo: 'Gabriel Rocha', status: 'Sentencia', lastUpdate: '2023-11-05', category: 'No Contenciosa', specialty: 'Pagos', opportunityLifecycle: 95 },
  { id: 'EJC001', amparoId: 'CAS001', clientName: 'Ana Silva Rojas', assignedTo: 'Eduardo Martins', status: 'En Progreso', lastUpdate: '2023-11-10', category: 'Contenciosa', specialty: 'Cobro Judicial', opportunityLifecycle: 40 },
];

// Lista de notificaciones de ejemplo.
export const notifications = [
    { id: 1, text: 'Nueva oportunidad "Carla Díaz Solano" registrada.', time: 'hace 10 min', read: false },
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
  { id: 'PICK01', caseId: 'CAS001', clientName: 'Ana Silva Rojas', branchId: 'BRH002', branchName: 'Punto Autorizado Heredia', documentCount: 3, status: 'Pendiente de Retiro' },
  { id: 'PICK02', caseId: 'CAS004', clientName: 'Bruno Costa Marin', branchId: 'BRH003', branchName: 'Punto Autorizado Cartago', documentCount: 2, status: 'Pendiente de Retiro' },
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
        address: 'Heredia, Santo Domingo',
        pickups: pendingPickups.filter(p => p.branchId === 'BRH002')
      },
      {
        branchId: 'BRH003',
        branchName: 'Punto Autorizado Cartago',
        address: 'Cartago, La Unión',
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
