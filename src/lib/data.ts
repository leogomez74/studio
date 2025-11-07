export type User = {
  id: string;
  name: string;
  cedula: string;
  email: string;
  phone: string;
  status: 'Lead' | 'Oportunidad' | 'Cliente';
  clientStatus?: 'Activo' | 'Suspendido';
  unsignedCreditId?: string;
  activeCredits?: number;
  registeredOn: string;
  avatarUrl: string;
};

export type Staff = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
};

export type Opportunity = {
  id: string;
  leadCedula: string;
  creditType: 'Regular' | 'Micro-crédito';
  amount: number;
  status: 'Nuevo' | 'Contactado' | 'Análisis' | 'Aprobado' | 'Rechazado' | 'Convertido';
  startDate: string;
  assignedTo: string;
};

export type Credit = {
  operationNumber: string;
  debtorName: string;
  debtorId: string;
  employer: string;
  type: 'Regular' | 'Micro-crédito';
  amount: number;
  balance: number;
  fee: number;
  rate: number;
  term: number;
  status: 'Al día' | 'En mora' | 'Cancelado' | 'En cobro judicial';
  overdueFees: number;
  daysInArrears?: number;
  deductingEntity: string;
  creationDate: string;
  dueDate: string;
};


export type Courier = {
  id: string;
  name: string;
  phone: string;
  vehicle: 'Motocicleta' | 'Automóvil';
};

export type PendingPickup = {
  id: string;
  creditId: string;
  clientName: string;
  branchId: string;
  branchName: string;
  documentCount: number;
  status: 'Pendiente de Retiro';
};

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

export type Conversation = {
  id: string;
  name: string;
  avatarUrl: string;
  caseId: string; // Corresponds to operationNumber
  lastMessage: string;
  time: string;
  status: 'Abierto' | 'Resuelto';
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderType: 'client' | 'agent';
  senderName: string;
  avatarUrl: string;
  text: string;
  time: string;
};

export type InternalNote = {
  id: string;
  conversationId: string;
  senderName: string;
  avatarUrl: string;
  text: string;
  time: string;
};

export type JudicialNotification = {
  id: string;
  expediente: string;
  acto:
    | 'Notificación de demanda'
    | 'Resolución'
    | 'Sentencia'
    | 'Prevención';
  fecha: string;
  status: 'Leída' | 'Pendiente';
  asignadaA: string;
};

export type UndefinedNotification = {
  id: string;
  subject: string;
  receivedDate: string;
  assignedTo: string;
};

export type Task = {
  id: string;
  title: string;
  caseId: string; // Corresponds to operationNumber
  assignedTo: string;
  dueDate: string;
  priority: 'Alta' | 'Media' | 'Baja';
  status: 'Pendiente' | 'En Progreso' | 'Completada';
};


export const users: User[] = [
    { id: 'USR001', name: 'Ana Silva Rojas', cedula: '1-1234-5678', email: 'ana.silva@example.com', phone: '8765-4321', status: 'Cliente', clientStatus: 'Suspendido', unsignedCreditId: 'CR-002', activeCredits: 1, registeredOn: '2023-10-26', avatarUrl: 'https://picsum.photos/seed/avatar1/40/40' },
    { id: 'USR002', name: 'Bruno Costa Marin', cedula: '2-0987-6543', email: 'bruno.costa@example.com', phone: '6123-4567', status: 'Oportunidad', registeredOn: '2023-10-25', avatarUrl: 'https://picsum.photos/seed/avatar2/40/40' },
    { id: 'USR003', name: 'Carla Díaz Solano', cedula: '3-1111-2222', email: 'carla.dias@example.com', phone: '7555-4444', status: 'Lead', registeredOn: '2023-10-27', avatarUrl: 'https://picsum.photos/seed/avatar3/40/40' },
    { id: 'USR004', name: 'Daniel Alves Mora', cedula: '4-2222-3333', email: 'daniel.alves@example.com', phone: '5432-1876', status: 'Lead', registeredOn: '2023-10-24', avatarUrl: 'https://picsum.photos/seed/avatar4/40/40' },
    { id: 'USR005', name: 'Beatriz Lima Fernández', cedula: '5-3333-4444', email: 'beatriz.lima@example.com', phone: '8877-6655', status: 'Oportunidad', registeredOn: '2023-10-28', avatarUrl: 'https://picsum.photos/seed/avatar5/40/40' },
    { id: 'USR006', name: 'John Doe', cedula: '6-4444-5555', email: 'john.doe@example.com', phone: '1122-3344', status: 'Cliente', clientStatus: 'Activo', activeCredits: 1, registeredOn: '2023-10-29', avatarUrl: 'https://picsum.photos/seed/avatarJD/40/40' },
  ];
  
export const staff: Staff[] = [
  { id: 'STF001', name: 'Jorge Ortiz Solís', email: 'jorge@crepipep.com', avatarUrl: 'https://picsum.photos/seed/staff1/40/40' },
  { id: 'STF002', name: 'Raizza Mildrey Arocena', email: 'raizza@crepipep.com', avatarUrl: 'https://picsum.photos/seed/staff2/40/40' },
  { id: 'STF003', name: 'Freddy Bravo Chacón', email: 'freddy@crepipep.com', avatarUrl: 'https://picsum.photos/seed/staff3/40/40' },
  { id: 'STF004', name: 'Richard Milán Vargas', email: 'richard@crepipep.com', avatarUrl: 'https://picsum.photos/seed/staff4/40/40' },
  { id: 'STF005', name: 'Carolina Chavarría Arley', email: 'carolina@crepipep.com', avatarUrl: 'https://picsum.photos/seed/staff5/40/40' },
];

export const opportunities: Opportunity[] = [
    { id: 'OPP001', leadCedula: '2-0987-6543', creditType: 'Regular', amount: 5000000, status: 'Análisis', startDate: '2023-11-01', assignedTo: 'Raizza Mildrey Arocena' },
    { id: 'OPP002', leadCedula: '5-3333-4444', creditType: 'Micro-crédito', amount: 500000, status: 'Contactado', startDate: '2023-11-02', assignedTo: 'Jorge Ortiz Solís' },
];
  
export const credits: Credit[] = [
    { operationNumber: 'CR-001', debtorName: 'John Doe', debtorId: '6-4444-5555', employer: 'Ministerio de Educación Pública', type: 'Regular', amount: 3000000, balance: 2500000, fee: 150000, rate: 18, term: 24, status: 'Al día', overdueFees: 0, creationDate: '2023-01-15', dueDate: '2025-01-15', deductingEntity: 'CoopeAnde' },
    { operationNumber: 'CR-002', debtorName: 'Ana Silva Rojas', debtorId: '1-1234-5678', employer: 'Caja Costarricense de Seguro Social', type: 'Micro-crédito', amount: 800000, balance: 450000, fee: 75000, rate: 24, term: 12, status: 'En mora', overdueFees: 1, daysInArrears: 25, creationDate: '2023-06-20', dueDate: '2024-06-20', deductingEntity: 'CS Magisterio' },
    { operationNumber: 'CR-003', debtorName: 'Some One', debtorId: '9-0123-0456', employer: 'Poder Judicial', type: 'Regular', amount: 7000000, balance: 0, fee: 350000, rate: 20, term: 36, status: 'Cancelado', overdueFees: 0, creationDate: '2021-02-10', dueDate: '2024-02-10', deductingEntity: 'CoopeJudicial' },
    { operationNumber: 'CR-004', debtorName: 'Another Person', debtorId: '8-0987-0654', employer: 'Instituto Costarricense de Electricidad', type: 'Regular', amount: 1000000, balance: 100000, fee: 100000, rate: 22, term: 12, status: 'En mora', overdueFees: 3, daysInArrears: 85, creationDate: '2023-03-01', dueDate: '2024-03-01', deductingEntity: 'CoopeAnde' },
];

export const notifications = [
  { id: 1, text: 'Nueva oportunidad para "Carla Díaz Solano" registrada.', time: 'hace 10 min', read: false },
  { id: 2, text: 'El crédito CR-002 de Ana Silva Rojas ahora está "En mora".', time: 'hace 1 hora', read: false },
  { id: 3, text: 'Se ha aprobado la oportunidad OPP001 para Bruno Costa Marin.', time: 'hace 3 horas', read: true },
  { id: 4, text: 'Se ha subido el pagaré para el crédito CR-001.', time: 'hace 1 día', read: true },
];

export const couriers: Courier[] = [
  { id: 'COUR01', name: 'Carlos Jimenez', phone: '8888-1111', vehicle: 'Motocicleta' },
  { id: 'COUR02', name: 'Luisa Fernandez', phone: '8888-2222', vehicle: 'Automóvil' },
];

export const pendingPickups: PendingPickup[] = [
  { id: 'PICK01', creditId: 'CR-001', clientName: 'John Doe', branchId: 'BRH001', branchName: 'Oficina Central', documentCount: 2, status: 'Pendiente de Retiro' },
];

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
        branchId: 'BRH001',
        branchName: 'Oficina Central',
        address: 'San José, San José',
        pickups: pendingPickups.filter(p => p.branchId === 'BRH001')
      },
    ]
  },
];

export const conversations: Conversation[] = [
  { id: 'CONV01', name: 'Ana Silva Rojas', avatarUrl: 'https://picsum.photos/seed/avatar1/40/40', caseId: 'CR-002', lastMessage: 'Entendido, ¿qué necesito para ponerme al día?', time: '10:15 AM', status: 'Abierto' },
  { id: 'CONV02', name: 'John Doe', avatarUrl: 'https://picsum.photos/seed/avatarJD/40/40', caseId: 'CR-001', lastMessage: 'Gracias por la información.', time: 'Ayer', status: 'Resuelto' },
];

export const chatMessages: ChatMessage[] = [
  { id: 'MSG01', conversationId: 'CR-002', senderType: 'agent', senderName: 'Raizza Mildrey Arocena', avatarUrl: 'https://picsum.photos/seed/staff2/40/40', text: 'Buenos días Sra. Ana, le escribimos para recordarle que su crédito presenta una mora de 25 días.', time: '10:05 AM' },
  { id: 'MSG02', conversationId: 'CR-002', senderType: 'client', senderName: 'Ana Silva Rojas', avatarUrl: 'https://picsum.photos/seed/avatar1/40/40', text: 'Hola, no estaba enterada. Pensé que el pago era automático.', time: '10:10 AM' },
  { id: 'MSG03', conversationId: 'CR-002', senderType: 'client', senderName: 'Ana Silva Rojas', avatarUrl: 'https://picsum.photos/seed/avatar1/40/40', text: 'Entendido, ¿qué necesito para ponerme al día?', time: '10:15 AM' },
];

export const internalNotes: InternalNote[] = [
  { id: 'NOTE01', conversationId: 'CR-002', senderName: 'Raizza Mildrey Arocena', avatarUrl: 'https://picsum.photos/seed/staff2/40/40', text: 'Cliente parece anuente a pagar. Ofrecerle un arreglo de pago si lo solicita.', time: '10:12 AM' },
  { id: 'NOTE02', conversationId: 'CR-001', senderName: 'Jorge Ortiz Solís', avatarUrl: 'https://picsum.photos/seed/staff1/40/40', text: 'Cliente consultó sobre adelanto de cuotas. Se le envió la información por correo.', time: 'Ayer' },
];

export const judicialNotifications: JudicialNotification[] = [
    { id: 'NOT001', expediente: 'SJ-2023-12345', acto: 'Notificación de demanda', fecha: '2023-11-20', status: 'Leída', asignadaA: 'Sistema' },
    { id: 'NOT002', expediente: 'CA-2023-54321', acto: 'Prevención', fecha: '2023-11-21', status: 'Pendiente', asignadaA: 'Freddy Bravo Chacón' },
    { id: 'NOT003', expediente: 'AL-2023-98765', acto: 'Resolución', fecha: '2023-11-19', status: 'Leída', asignadaA: 'Sistema' },
];
  
export const undefinedNotifications: UndefinedNotification[] = [
  { id: 'UNDEF001', subject: 'FW: Actualización de estado', receivedDate: '2023-11-22 14:30', assignedTo: 'Richard Milán Vargas' },
  { id: 'UNDEF002', subject: 'Consulta Urgente', receivedDate: '2023-11-22 15:00', assignedTo: 'Richard Milán Vargas' },
];

export const tasks: Task[] = [
  { id: 'TSK001', title: 'Resolver prevención en expediente CA-2023-54321', caseId: 'CR-004', assignedTo: 'Freddy Bravo Chacón', dueDate: '2023-11-23', priority: 'Alta', status: 'Pendiente' },
  { id: 'TSK002', title: 'Contactar a Ana Silva para arreglo de pago', caseId: 'CR-002', assignedTo: 'Carolina Chavarría Arley', dueDate: '2023-11-25', priority: 'Media', status: 'En Progreso' },
  { id: 'TSK003', title: 'Preparar documentos para nuevo crédito de Bruno Costa', caseId: 'OPP001', assignedTo: 'Richard Milán Vargas', dueDate: '2023-11-28', priority: 'Media', status: 'Pendiente' },
];
