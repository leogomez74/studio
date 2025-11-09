

export type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
};

export type Lead = {
  id: string;
  name: string;
  cedula: string;
  email: string;
  phone: string;
  registeredOn: string;
  avatarUrl: string;
  juicios: number;
  manchas: number;
  puesto: 'Interino' | 'En Propiedad';
  antiguedad: string;
  salarioBase: number;
  salarioNeto: number;
  assignedTo: string;
};

export type Client = {
    id: string;
    name: string;
    cedula: string;
    email: string;
    phone: string;
    clientStatus?: 'Activo' | 'Moroso' | 'En cobro' | 'Fallecido' | 'Inactivo';
    activeCredits: number;
    registeredOn: string;
    avatarUrl: string;
};

export type Investor = {
  id: string;
  name: string;
  cedula: string;
  email: string;
  phone: string;
  status: 'Activo' | 'Inactivo';
  activeInvestments: number;
  registeredOn: string;
  avatarUrl: string;
};

export type Opportunity = {
  id: string;
  leadCedula: string;
  creditType: 'Regular' | 'Micro-crédito';
  amount: number;
  status: 'En proceso' | 'Rechazada' | 'Aceptada' | 'Convertido';
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
  expediente?: string;
};

export type Investment = {
  investmentNumber: string;
  investorName: string;
  investorId: string;
  startDate: string;
  endDate: string;
  amount: number;
  currency: 'CRC' | 'USD';
  rate: number;
  interestFrequency: 'Mensual' | 'Trimestral' | 'Semestral' | 'Anual';
  isCapitalizable: boolean;
  status: 'Activa' | 'Finalizada' | 'Liquidada';
};


export type Courier = {
  id: string;
  name: string;
  phone: string;
  vehicle: 'Motocicleta' | 'Automóvil';
};

export type PendingPickup = {
  id: string;
  caseId: string;
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
    pickups: {
        caseId: string;
    }[];
  }[];
};

export type Conversation = {
  id: string;
  name: string;
  avatarUrl: string;
  caseId: string;
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
    | 'Prevención'
    | 'Con Lugar con Costas'
    | 'Con Lugar sin Costas';
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
  caseId: string;
  assignedTo: string;
  dueDate: string;
  priority: 'Alta' | 'Media' | 'Baja';
  status: 'Pendiente' | 'En Progreso' | 'Completada';
};

export type Case = {
    id: string;
    title: string;
    clientName: string;
    specialty: string;
    status: string;
    assignedTo: string;
    lastUpdate: string;
    category: 'Contenciosa' | 'No Contenciosa';
    opportunityLifecycle: number;
    amparoId?: string;
}

export type Payment = {
  id: string;
  operationNumber: string;
  debtorName: string;
  paymentDate: string;
  amount: number;
  difference?: number;
  source: 'Planilla' | 'Ventanilla' | 'Transferencia';
};

export type Patrono = {
  id: string;
  name: string;
  category: 'Ministerio' | 'Institución Autónoma' | 'Poder Judicial' | 'Municipalidad' | 'Otro';
  paymentDate: string;
};

export type Deductora = {
  id: string;
  name: string;
  paymentDate: string;
  commission: number;
};

export type SalesVisit = {
  id: string;
  institution: string;
  salesperson: string;
  date: string;
  status: 'Planificada' | 'Completada' | 'Cancelada';
};

export type SalesGoal = {
  id: string;
  salespersonId: string;
  salespersonName: string;
  salespersonAvatar: string;
  month: string;
  goalAmount: number;
  achievedAmount: number;
};

// --- Project Plan Data ---

export type ProjectTask = {
  id: string;
  title: string;
  dueDate: string;
  completed: boolean;
  details: string;
};

export type Milestone = {
  id: string;
  title: string;
  description: string;
  days: string;
  tasks: ProjectTask[];
};

export const projectPlan: Milestone[] = [
  {
    id: 'HITO1',
    title: 'Hito 1: Configuración, Autenticación y Modelos Base',
    description: 'Establecer la base del proyecto y asegurar la autenticación de usuarios.',
    days: 'Días 1-2',
    tasks: [
      { id: 'T1.1', title: 'Inicializar un nuevo proyecto de Laravel.', dueDate: 'lunes, 11 de nov', completed: false, details: 'Crear un nuevo repositorio y clonar el esqueleto de Laravel. Ejecutar `composer install`.' },
      { id: 'T1.2', title: 'Configurar la conexión a la base de datos MySQL.', dueDate: 'lunes, 11 de nov', completed: false, details: 'Actualizar el archivo `.env` con las credenciales de la base de datos de desarrollo (DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD).' },
      { id: 'T1.3', title: 'Implementar las migraciones de la base de datos para `users`, `clients`, `leads`, `investors`.', dueDate: 'lunes, 11 de nov', completed: false, details: 'Crear los archivos de migración para cada tabla, definiendo los campos y tipos de datos especificados en el script SQL proporcionado. Incluir claves foráneas y relaciones.' },
      { id: 'T1.4', title: 'Crear los modelos Eloquent correspondientes.', dueDate: 'lunes, 11 de nov', completed: false, details: 'Generar los modelos `User`, `Client`, `Lead`, e `Investor`. Definir las propiedades `fillable` y las relaciones (`hasMany`, `belongsTo`, etc.).' },
      { id: 'T2.1', title: 'Instalar y configurar Laravel Sanctum para la autenticación de SPA.', dueDate: 'martes, 12 de nov', completed: false, details: 'Seguir la guía de instalación de Sanctum. Publicar la migración de Sanctum y ejecutar `php artisan migrate`. Añadir el middleware a `app/Http/Kernel.php`.' },
      { id: 'T2.2', title: 'Crear los endpoints para registro, login (`/login`) y logout (`/logout`).', dueDate: 'martes, 12 de nov', completed: false, details: 'Implementar los controladores y rutas necesarios para manejar la autenticación. El login debe devolver un token de API o establecer una cookie de sesión.' },
      { id: 'T2.3', title: 'Crear un endpoint protegido para obtener los datos del usuario autenticado (`/api/user`).', dueDate: 'martes, 12 de nov', completed: false, details: 'Asegurar que la ruta esté protegida con el middleware `auth:sanctum`. Devolver los datos del usuario logueado.' },
    ]
  },
  {
    id: 'HITO2',
    title: 'Hito 2: Módulos de Clientes y Oportunidades',
    description: 'Enfocado en la gestión de clientes, leads y oportunidades de negocio.',
    days: 'Días 3-4',
    tasks: [
      { id: 'T3.1', title: 'Crear modelos y migraciones para `Opportunities`.', dueDate: 'miércoles, 13 de nov', completed: false, details: 'Definir la tabla de oportunidades con su relación con la tabla `leads`.' },
      { id: 'T3.2', title: 'Implementar los controladores y rutas de API (Resource Controllers) para el CRUD de `Leads` y `Clients`.', dueDate: 'miércoles, 13 de nov', completed: false, details: 'Crear API resources para `Lead` y `Client` para estandarizar la salida JSON. Implementar los métodos index, show, store, update y destroy.' },
      { id: 'T3.3', title: 'Implementar un endpoint para convertir un `Lead` en `Client` (`POST /api/leads/{id}/convert`).', dueDate: 'miércoles, 13 de nov', completed: false, details: 'La lógica debe crear un nuevo registro de `Client` con los datos del `Lead` y, opcionalmente, eliminar o marcar el lead como convertido.' },
      { id: 'T4.1', title: 'Implementar el CRUD para `Opportunities`.', dueDate: 'jueves, 14 de nov', completed: false, details: 'Crear el Resource Controller y las rutas de API para gestionar las oportunidades.' },
      { id: 'T4.2', title: 'Implementar endpoint para la página de "Análisis" (`GET /api/credit-analysis`).', dueDate: 'jueves, 14 de nov', completed: false, details: 'Este endpoint debe realizar un join entre `leads` y `opportunities` para devolver la información combinada que se muestra en la tabla de análisis.' },
    ]
  },
  {
    id: 'HITO3',
    title: 'Hito 3: Módulo Financiero - Créditos y Cobros',
    description: 'Desarrollo de la lógica principal del negocio: créditos y su seguimiento.',
    days: 'Días 5-6',
    tasks: [
        { id: 'T5.1', title: 'Crear modelo y migración para `Credits` y `CreditConfigs`.', dueDate: 'viernes, 15 de nov', completed: false, details: 'La tabla `credits` debe estar relacionada con `clients`. `credit_configs` puede ser una tabla simple o un archivo de configuración en Laravel.' },
        { id: 'T5.2', title: 'Implementar el CRUD para `Credits`.', dueDate: 'viernes, 15 de nov', completed: false, details: 'Crear el Resource Controller y las rutas para los créditos. Incluir lógica de validación para los montos y plazos basados en `CreditConfigs`.' },
        { id: 'T5.3', title: 'Crear endpoints para obtener y actualizar la configuración de los tipos de crédito (`GET /api/credit-configs`).', dueDate: 'viernes, 15 de nov', completed: false, details: 'Endpoint para que el frontend pueda leer y modificar las tasas de interés, montos mínimos/máximos, etc.' },
        { id: 'T6.1', title: 'Crear modelo y migración para `Payments` (Abonos).', dueDate: 'lunes, 18 de nov', completed: false, details: 'La tabla `payments` debe estar relacionada con `credits`.' },
        { id: 'T6.2', title: 'Implementar endpoint para la vista de "Gestión de Cobros" con filtro por días de mora.', dueDate: 'lunes, 18 de nov', completed: false, details: 'Crear un endpoint `GET /api/collections` que pueda recibir parámetros de consulta como `?arrears_start=31&arrears_end=60`.' },
        { id: 'T6.3', title: 'Implementar el CRUD para `Payments` (Abonos), incluyendo la carga masiva desde CSV.', dueDate: 'lunes, 18 de nov', completed: false, details: 'Crear un endpoint `POST /api/payments/bulk-upload` que procese un archivo CSV y cree los registros de pago correspondientes.' },
    ]
  },
  {
    id: 'HITO4',
    title: 'Hito 4: Módulos Legales e Inversiones',
    description: 'Implementación de la gestión de casos legales e inversiones.',
    days: 'Días 7-8',
    tasks: [
        { id: 'T7.1', title: 'Crear modelos y migraciones para `Cases`, `CaseTasks`, `JudicialNotifications`.', dueDate: 'martes, 19 de nov', completed: false, details: 'Definir las tablas y sus relaciones. `CaseTasks` debe relacionarse con `Cases` y `Users`.' },
        { id: 'T7.2', title: 'Implementar el CRUD para `Cases` filtrando por tipo.', dueDate: 'martes, 19 de nov', completed: false, details: 'El endpoint `GET /api/cases` debe permitir filtrar por `type` (Amparo CCSS, Amparo MEP, Ejecución).' },
        { id: 'T7.3', title: 'Implementar endpoints para las pestañas de "Cobro Judicial".', dueDate: 'martes, 19 de nov', completed: false, details: 'Crear endpoints separados para `GET /api/judicial-cases`, `GET /api/judicial-notifications` y `GET /api/undefined-notifications`.' },
        { id: 'T8.1', title: 'Crear modelo y migración para `Investments` y `InterestPayments`.', dueDate: 'miércoles, 20 de nov', completed: false, details: '`Investments` se relaciona con `Investors`. `InterestPayments` (cupones) se relaciona con `Investments`.' },
        { id: 'T8.2', title: 'Implementar el CRUD para `Investors` e `Investments`.', dueDate: 'miércoles, 20 de nov', completed: false, details: 'Crear los Resource Controllers y rutas de API correspondientes.' },
        { id: 'T8.3', title: 'Implementar endpoints para las pestañas de "Inversiones".', dueDate: 'miércoles, 20 de nov', completed: false, details: 'Crear endpoints que devuelvan la información necesaria para cada una de las 4 pestañas (Inversionistas, Inversiones, Pagos, Retenciones).' },
    ]
  },
  {
    id: 'HITO5',
    title: 'Hito 5: Módulos Operativos y Despliegue',
    description: 'Finalización de funcionalidades secundarias y preparación para producción.',
    days: 'Días 9-10',
    tasks: [
        { id: 'T9.1', title: 'Crear modelos y migraciones para `Conversations`, `ChatMessages`, `InternalNotes`, `Branches`, `Volunteers` y `Routes`.', dueDate: 'jueves, 21 de nov', completed: false, details: 'Definir las tablas finales para los módulos de soporte operativo.' },
        { id: 'T9.2', title: 'Implementar los endpoints para el CRUD de cada uno de estos módulos.', dueDate: 'jueves, 21 de nov', completed: false, details: 'Crear Resource Controllers para `Branches`, `Volunteers` y `Staff`.' },
        { id: 'T9.3', title: 'Implementar la lógica para el chat en el módulo de "Comunicaciones".', dueDate: 'jueves, 21 de nov', completed: false, details: 'Crear endpoints `GET /api/conversations/{id}/messages` y `POST /api/conversations/{id}/messages`. Considerar el uso de WebSockets con Laravel Reverb para chat en tiempo real.' },
        { id: 'T10.1', title: 'Realizar pruebas de integración de todos los endpoints.', dueDate: 'viernes, 22 de nov', completed: false, details: 'Utilizar Pest o PHPUnit para escribir pruebas de API que verifiquen el funcionamiento, la protección de rutas y los códigos de estado de respuesta de todos los endpoints.' },
        { id: 'T10.2', title: 'Finalizar la documentación de la API (Colección de Postman).', dueDate: 'viernes, 22 de nov', completed: false, details: 'Exportar una colección de Postman completa y actualizada con ejemplos para cada endpoint.' },
        { id: 'T10.3', title: 'Escribir un script de despliegue básico.', dueDate: 'viernes, 22 de nov', completed: false, details: 'Crear un script `deploy.sh` que automatice los pasos: `git pull`, `composer install --no-dev`, `php artisan migrate --force`, `php artisan optimize:clear`.' },
        { id: 'T10.4', title: 'Configurar el entorno del servidor y realizar el primer despliegue.', dueDate: 'viernes, 22 de nov', completed: false, details: 'Preparar el servidor de producción (DigitalOcean) e instalar dependencias (PHP, Composer, Nginx). Ejecutar el script de despliegue y verificar que la API responde correctamente.' },
    ]
  }
];


// --- Mock Data ---

export const creditConfigs = {
  regular: {
    interestRate: 24,
    minAmount: 500000,
    maxAmount: 10000000,
    minTerm: 12,
    maxTerm: 72,
  },
  micro: {
    interestRate: 36,
    minAmount: 100000,
    maxAmount: 1000000,
    minTerm: 6,
    maxTerm: 24,
  },
};


export const users: User[] = [
    { id: 'STF001', name: 'Jorge Ortiz Solís', email: 'jorge@crepipep.com', avatarUrl: 'https://picsum.photos/seed/staff1/40/40' },
    { id: 'STF002', name: 'Raizza Mildrey Arocena', email: 'raizza@crepipep.com', avatarUrl: 'https://picsum.photos/seed/staff2/40/40' },
    { id: 'STF003', name: 'Freddy Bravo Chacón', email: 'freddy@crepipep.com', avatarUrl: 'https://picsum.photos/seed/staff3/40/40' },
    { id: 'STF004', name: 'Richard Milán Vargas', email: 'richard@crepipep.com', avatarUrl: 'https://picsum.photos/seed/staff4/40/40' },
    { id: 'STF005', name: 'Carolina Chavarría Arley', email: 'carolina@crepipep.com', avatarUrl: 'https://picsum.photos/seed/staff5/40/40' },
];

export const staff = users;

export const leads: Lead[] = [
    { id: 'LEAD001', name: 'Carla Díaz Solano', cedula: '3-1111-2222', email: 'carla.dias@example.com', phone: '7555-4444', registeredOn: '2023-10-27', avatarUrl: 'https://picsum.photos/seed/avatar3/40/40', juicios: 1, manchas: 2, puesto: 'Interino', antiguedad: '2 años', salarioBase: 650000, salarioNeto: 520000, assignedTo: 'Oficina' },
    { id: 'LEAD002', name: 'Daniel Alves Mora', cedula: '4-2222-3333', email: 'daniel.alves@example.com', phone: '5432-1876', registeredOn: '2023-10-24', avatarUrl: 'https://picsum.photos/seed/avatar4/40/40', juicios: 0, manchas: 0, puesto: 'En Propiedad', antiguedad: '10 años', salarioBase: 1200000, salarioNeto: 950000, assignedTo: 'Jorge Ortiz Solís' },
    { id: 'LEAD003', name: 'Eduardo Pereira', cedula: '9-0123-4567', email: 'eduardo.p@example.com', phone: '8123-9876', registeredOn: '2023-11-05', avatarUrl: 'https://picsum.photos/seed/avatar6/40/40', juicios: 0, manchas: 1, puesto: 'En Propiedad', antiguedad: '8 años', salarioBase: 980000, salarioNeto: 780000, assignedTo: 'Oficina' },
    { id: 'LEAD004', name: 'Fernanda Núñez', cedula: '1-2345-6789', email: 'fernanda.n@example.com', phone: '7890-1234', registeredOn: '2023-11-06', avatarUrl: 'https://picsum.photos/seed/avatar7/40/40', juicios: 2, manchas: 3, puesto: 'Interino', antiguedad: '6 meses', salarioBase: 450000, salarioNeto: 380000, assignedTo: 'Raizza Mildrey Arocena' },
];

export const clients: Client[] = [
    { id: 'USR001', name: 'Ana Silva Rojas', cedula: '1-1234-5678', email: 'ana.silva@example.com', phone: '8765-4321', clientStatus: 'Moroso', activeCredits: 2, registeredOn: '2023-01-26', avatarUrl: 'https://picsum.photos/seed/avatar1/40/40' },
    { id: 'USR006', name: 'John Doe', cedula: '6-4444-5555', email: 'john.doe@example.com', phone: '1122-3344', clientStatus: 'Activo', activeCredits: 1, registeredOn: '2022-10-29', avatarUrl: 'https://picsum.photos/seed/avatarJD/40/40' },
    { id: 'USR007', name: 'Jane Smith', cedula: '7-5555-6666', email: 'jane.smith@example.com', phone: '9988-7766', clientStatus: 'En cobro', activeCredits: 1, registeredOn: '2022-09-15', avatarUrl: 'https://picsum.photos/seed/avatarJS/40/40' },
    { id: 'USR008', name: 'Peter Jones', cedula: '8-6666-7777', email: 'peter.jones@example.com', phone: '6677-8899', clientStatus: 'Inactivo', activeCredits: 0, registeredOn: '2021-08-20', avatarUrl: 'https://picsum.photos/seed/avatarPJ/40/40' },
    { id: 'USR009', name: 'Lucía Méndez', cedula: '9-7777-8888', email: 'lucia.mendez@example.com', phone: '5566-7788', clientStatus: 'Activo', activeCredits: 1, registeredOn: '2023-02-11', avatarUrl: 'https://picsum.photos/seed/avatarLM/40/40'},
    { id: 'USR010', name: 'Carlos Fernández', cedula: '1-8888-9999', email: 'carlos.f@example.com', phone: '4455-6677', clientStatus: 'Activo', activeCredits: 1, registeredOn: '2023-03-12', avatarUrl: 'https://picsum.photos/seed/avatarCF/40/40'},
    { id: 'USR011', name: 'Sofía Hernández', cedula: '2-9999-0000', email: 'sofia.h@example.com', phone: '3344-5566', clientStatus: 'Moroso', activeCredits: 1, registeredOn: '2023-04-13', avatarUrl: 'https://picsum.photos/seed/avatarSH/40/40'},
    { id: 'USR012', name: 'Miguel González', cedula: '3-0000-1111', email: 'miguel.g@example.com', phone: '2233-4455', clientStatus: 'Activo', activeCredits: 1, registeredOn: '2023-05-14', avatarUrl: 'https://picsum.photos/seed/avatarMG/40/40'},
    { id: 'USR013', name: 'Valentina Rossi', cedula: '4-1111-2222', email: 'valentina.r@example.com', phone: '1122-3344', clientStatus: 'Activo', activeCredits: 1, registeredOn: '2023-06-15', avatarUrl: 'https://picsum.photos/seed/avatarVR/40/40'},
    { id: 'USR014', name: 'Javier Rodríguez', cedula: '5-2222-3333', email: 'javier.r@example.com', phone: '9988-7766', clientStatus: 'Activo', activeCredits: 1, registeredOn: '2023-07-16', avatarUrl: 'https://picsum.photos/seed/avatarJR/40/40'},
    { id: 'USR015', name: 'Camila Gómez', cedula: '6-3333-4444', email: 'camila.g@example.com', phone: '8877-6655', clientStatus: 'Activo', activeCredits: 1, registeredOn: '2023-08-17', avatarUrl: 'https://picsum.photos/seed/avatarCG/40/40'},
    { id: 'USR016', name: 'Mateo Díaz', cedula: '7-4444-5555', email: 'mateo.d@example.com', phone: '7766-5544', clientStatus: 'Activo', activeCredits: 1, registeredOn: '2023-09-18', avatarUrl: 'https://picsum.photos/seed/avatarMD/40/40'},
    { id: 'USR017', name: 'Isabella Castillo', cedula: '8-5555-6666', email: 'isabella.c@example.com', phone: '6655-4433', clientStatus: 'Fallecido', activeCredits: 0, registeredOn: '2022-01-19', avatarUrl: 'https://picsum.photos/seed/avatarIC/40/40'},
    { id: 'USR018', name: 'Sebastián Soto', cedula: '9-6666-7777', email: 'sebastian.s@example.com', phone: '5544-3322', clientStatus: 'Activo', activeCredits: 1, registeredOn: '2023-10-20', avatarUrl: 'https://picsum.photos/seed/avatarSS/40/40'},
    { id: 'USR019', name: 'Gabriela Vargas', cedula: '1-7777-8888', email: 'gabriela.v@example.com', phone: '4433-2211', clientStatus: 'En cobro', activeCredits: 1, registeredOn: '2022-05-21', avatarUrl: 'https://picsum.photos/seed/avatarGV/40/40'},
    { id: 'USR020', name: 'Bruno Costa Marin', cedula: '2-0987-6543', email: 'bruno.costa@example.com', phone: '6123-4567', clientStatus: 'Activo', activeCredits: 1, registeredOn: '2023-10-25', avatarUrl: 'https://picsum.photos/seed/avatar2/40/40' },
];

export const investors: Investor[] = [
    { id: 'INV001', name: 'Laura Montes', cedula: '1-0987-6543', email: 'laura.montes@inversion.com', phone: '8888-9999', status: 'Activo', activeInvestments: 1, registeredOn: '2022-08-15', avatarUrl: 'https://picsum.photos/seed/investor1/40/40' },
    { id: 'INV002', name: 'Ricardo Vega', cedula: '2-0876-5432', email: 'ricardo.vega@inversion.com', phone: '7777-6666', status: 'Activo', activeInvestments: 2, registeredOn: '2023-01-20', avatarUrl: 'https://picsum.photos/seed/investor2/40/40' },
    { id: 'INV003', name: 'Elena Solis', cedula: '3-0765-4321', email: 'elena.solis@inversion.com', phone: '6666-5555', status: 'Inactivo', activeInvestments: 0, registeredOn: '2021-11-30', avatarUrl: 'https://picsum.photos/seed/investor3/40/40' },
];

export const opportunities: Opportunity[] = [
    { id: 'OPP001', leadCedula: '2-0987-6543', creditType: 'Regular', amount: 5000000, status: 'En proceso', startDate: '2023-11-01', assignedTo: 'Raizza Mildrey Arocena' },
    { id: 'OPP002', leadCedula: '5-3333-4444', creditType: 'Micro-crédito', amount: 500000, status: 'Convertido', startDate: '2023-11-02', assignedTo: 'Jorge Ortiz Solís' },
    { id: 'OPP003', leadCedula: '3-1111-2222', creditType: 'Regular', amount: 2000000, status: 'Rechazada', startDate: '2023-11-03', assignedTo: 'Raizza Mildrey Arocena' },
    { id: 'OPP004', leadCedula: '4-2222-3333', creditType: 'Regular', amount: 7000000, status: 'Aceptada', startDate: '2023-11-04', assignedTo: 'Jorge Ortiz Solís' },
];

export const credits: Credit[] = [
    { operationNumber: 'CR-001', debtorName: 'John Doe', debtorId: '6-4444-5555', employer: 'Ministerio de Educación Pública', type: 'Regular', amount: 3000000, balance: 2500000, fee: 150000, rate: 18, term: 24, status: 'Al día', overdueFees: 0, creationDate: '2023-01-15', dueDate: '2025-01-15', deductingEntity: 'CoopeAnde' },
    { operationNumber: 'CR-002', debtorName: 'Ana Silva Rojas', debtorId: '1-1234-5678', employer: 'Caja Costarricense de Seguro Social', type: 'Regular', amount: 800000, balance: 450000, fee: 75000, rate: 24, term: 12, status: 'En mora', overdueFees: 1, daysInArrears: 25, creationDate: '2023-06-20', dueDate: '2024-06-20', deductingEntity: 'CS Magisterio' },
    { operationNumber: 'CR-003', debtorName: 'Jane Smith', debtorId: '7-5555-6666', employer: 'Poder Judicial', type: 'Regular', amount: 7000000, balance: 0, fee: 350000, rate: 20, term: 36, status: 'Cancelado', overdueFees: 0, creationDate: '2021-02-10', dueDate: '2024-02-10', deductingEntity: 'CoopeJudicial' },
    { operationNumber: 'CR-004', debtorName: 'Ana Silva Rojas', debtorId: '1-1234-5678', employer: 'Instituto Costarricense de Electricidad', type: 'Regular', amount: 1000000, balance: 100000, fee: 100000, rate: 22, term: 12, status: 'En cobro judicial', overdueFees: 3, daysInArrears: 85, expediente: '21-001234-1027-CA', creationDate: '2023-03-01', dueDate: '2024-03-01', deductingEntity: 'CoopeAnde' },
    { operationNumber: 'CR-005', debtorName: 'Lucía Méndez', debtorId: '9-7777-8888', employer: 'Ministerio de Hacienda', type: 'Regular', amount: 4500000, balance: 4000000, fee: 200000, rate: 19, term: 36, status: 'Al día', overdueFees: 0, daysInArrears: 0, creationDate: '2023-02-11', dueDate: '2026-02-11', deductingEntity: 'CoopeJudicial' },
    { operationNumber: 'CR-006', debtorName: 'Carlos Fernández', debtorId: '1-8888-9999', employer: 'Ministerio de Educación Pública', type: 'Regular', amount: 1200000, balance: 800000, fee: 60000, rate: 20, term: 24, status: 'Al día', overdueFees: 0, daysInArrears: 0, creationDate: '2023-03-12', dueDate: '2025-03-12', deductingEntity: 'CoopeAnde' },
    { operationNumber: 'CR-007', debtorName: 'Sofía Hernández', debtorId: '2-9999-0000', employer: 'Caja Costarricense de Seguro Social', type: 'Regular', amount: 2500000, balance: 2400000, fee: 125000, rate: 21, term: 24, status: 'En mora', overdueFees: 2, daysInArrears: 45, creationDate: '2023-04-13', dueDate: '2025-04-13', deductingEntity: 'CS Magisterio' },
    { operationNumber: 'CR-008', debtorName: 'Miguel González', debtorId: '3-0000-1111', employer: 'Poder Judicial', type: 'Regular', amount: 3800000, balance: 3500000, fee: 180000, rate: 18.5, term: 36, status: 'Al día', overdueFees: 0, daysInArrears: 0, creationDate: '2023-05-14', dueDate: '2026-05-14', deductingEntity: 'CoopeJudicial' },
    { operationNumber: 'CR-009', debtorName: 'Valentina Rossi', debtorId: '4-1111-2222', employer: 'Ministerio de Educación Pública', type: 'Regular', amount: 5000000, balance: 4800000, fee: 250000, rate: 22, term: 48, status: 'Al día', overdueFees: 0, daysInArrears: 0, creationDate: '2023-06-15', dueDate: '2027-06-15', deductingEntity: 'CoopeAnde' },
    { operationNumber: 'CR-010', debtorName: 'Javier Rodríguez', debtorId: '5-2222-3333', employer: 'Caja Costarricense de Seguro Social', type: 'Regular', amount: 1800000, balance: 1500000, fee: 90000, rate: 20, term: 24, status: 'Al día', overdueFees: 0, daysInArrears: 0, creationDate: '2023-07-16', dueDate: '2025-07-16', deductingEntity: 'CS Magisterio' },
    { operationNumber: 'CR-011', debtorName: 'Gabriela Vargas', debtorId: '1-7777-8888', employer: 'Poder Judicial', type: 'Regular', amount: 2000000, balance: 1500000, fee: 120000, rate: 23, term: 24, status: 'En cobro judicial', overdueFees: 5, daysInArrears: 130, expediente: '22-004567-1027-CA', creationDate: '2022-05-21', dueDate: '2024-05-21', deductingEntity: 'CoopeJudicial' },
    { operationNumber: 'CR-012', debtorName: 'Sebastián Soto', debtorId: '9-6666-7777', employer: 'Poder Judicial', type: 'Regular', amount: 2500000, balance: 2000000, fee: 150000, rate: 25, term: 24, status: 'En cobro judicial', overdueFees: 6, daysInArrears: 190, expediente: '22-008899-1027-CA', creationDate: '2022-04-01', dueDate: '2024-04-01', deductingEntity: 'CoopeJudicial' },
    { operationNumber: 'CR-013', debtorName: 'Valentina Rossi', debtorId: '4-1111-2222', employer: 'Ministerio de Hacienda', type: 'Regular', amount: 3000000, balance: 2800000, fee: 180000, rate: 26, term: 36, status: 'En cobro judicial', overdueFees: 7, daysInArrears: 220, expediente: '22-009911-1027-CA', creationDate: '2022-02-15', dueDate: '2025-02-15', deductingEntity: 'CoopeJudicial' },
    { operationNumber: 'CR-014', debtorName: 'John Doe', debtorId: '6-4444-5555', employer: 'Ministerio de Hacienda', type: 'Regular', amount: 4000000, balance: 3500000, fee: 200000, rate: 21, term: 36, status: 'En cobro judicial', overdueFees: 4, daysInArrears: 110, expediente: '23-001122-1027-CA', creationDate: '2023-01-05', dueDate: '2026-01-05', deductingEntity: 'CoopeJudicial' },
    { operationNumber: 'CR-015', debtorName: 'Jane Smith', debtorId: '7-5555-6666', employer: 'Ministerio de Educación Pública', type: 'Regular', amount: 1500000, balance: 1300000, fee: 80000, rate: 22, term: 24, status: 'En cobro judicial', overdueFees: 5, daysInArrears: 140, expediente: '23-003344-1027-CA', creationDate: '2022-11-20', dueDate: '2024-11-20', deductingEntity: 'CoopeAnde' },
    { operationNumber: 'MC-001', debtorName: 'Camila Gómez', debtorId: '6-3333-4444', employer: 'Ministerio de Educación Pública', type: 'Micro-crédito', amount: 500000, balance: 300000, fee: 50000, rate: 24, term: 12, status: 'Al día', overdueFees: 0, daysInArrears: 0, creationDate: '2023-08-17', dueDate: '2024-08-17', deductingEntity: 'CoopeAnde' },
    { operationNumber: 'MC-002', debtorName: 'Mateo Díaz', debtorId: '7-4444-5555', employer: 'Caja Costarricense de Seguro Social', type: 'Micro-crédito', amount: 650000, balance: 200000, fee: 65000, rate: 25, term: 12, status: 'Al día', overdueFees: 0, daysInArrears: 0, creationDate: '2023-09-18', dueDate: '2024-09-18', deductingEntity: 'CS Magisterio' },
    { operationNumber: 'MC-003', debtorName: 'Sebastián Soto', debtorId: '9-6666-7777', employer: 'Poder Judicial', type: 'Micro-crédito', amount: 400000, balance: 400000, fee: 45000, rate: 26, term: 12, status: 'En mora', overdueFees: 1, daysInArrears: 30, creationDate: '2023-10-20', dueDate: '2024-10-20', deductingEntity: 'CoopeJudicial' },
    { operationNumber: 'MC-004', debtorName: 'Bruno Costa Marin', debtorId: '2-0987-6543', employer: 'Ministerio de Educación Pública', type: 'Micro-crédito', amount: 690000, balance: 690000, fee: 70000, rate: 24, term: 12, status: 'Al día', overdueFees: 0, daysInArrears: 0, creationDate: '2023-11-02', dueDate: '2024-11-02', deductingEntity: 'CoopeAnde' },
    { operationNumber: 'MC-005', debtorName: 'Peter Jones', debtorId: '8-6666-7777', employer: 'Ministerio de Educación Pública', type: 'Micro-crédito', amount: 300000, balance: 0, fee: 30000, rate: 24, term: 12, status: 'Cancelado', overdueFees: 0, creationDate: '2021-05-10', dueDate: '2022-05-10', deductingEntity: 'CoopeAnde' },
    { operationNumber: 'MC-006', debtorName: 'Ana Silva Rojas', debtorId: '1-1234-5678', employer: 'Caja Costarricense de Seguro Social', type: 'Micro-crédito', amount: 550000, balance: 50000, fee: 55000, rate: 25, term: 12, status: 'En mora', overdueFees: 3, daysInArrears: 70, creationDate: '2023-02-01', dueDate: '2024-02-01', deductingEntity: 'CS Magisterio' },
];

export const investments: Investment[] = [
    { investmentNumber: 'INV-001', investorName: 'Ricardo Vega', investorId: '2-0876-5432', startDate: '2023-01-15', endDate: '2025-01-15', amount: 10000000, currency: 'CRC', rate: 7.05, interestFrequency: 'Mensual', isCapitalizable: false, status: 'Activa' },
    { investmentNumber: 'INV-002', investorName: 'Laura Montes', investorId: '1-0987-6543', startDate: '2023-03-01', endDate: '2024-03-01', amount: 50000, currency: 'USD', rate: 7.05, interestFrequency: 'Trimestral', isCapitalizable: true, status: 'Activa' },
    { investmentNumber: 'INV-003', investorName: 'Ricardo Vega', investorId: '2-0876-5432', startDate: '2022-05-20', endDate: '2023-05-20', amount: 5000000, currency: 'CRC', rate: 7.05, interestFrequency: 'Anual', isCapitalizable: false, status: 'Finalizada' },
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
  { id: 'PICK01', caseId: 'CR-001', clientName: 'John Doe', branchId: 'BRH001', branchName: 'Oficina Central', documentCount: 2, status: 'Pendiente de Retiro' },
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
        pickups: [{ caseId: 'CR-001' }]
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
    { id: 'NOT001', expediente: '23-012345-1027-CA', acto: 'Notificación de demanda', fecha: '2023-11-20', status: 'Leída', asignadaA: 'Sistema' },
    { id: 'NOT002', expediente: '21-001234-1027-CA', acto: 'Prevención', fecha: '2023-11-21', status: 'Pendiente', asignadaA: 'Freddy Bravo Chacón' },
    { id: 'NOT003', expediente: '22-004567-1027-CA', acto: 'Resolución', fecha: '2023-11-19', status: 'Leída', asignadaA: 'Sistema' },
];
  
export const undefinedNotifications: UndefinedNotification[] = [
  { id: 'UNDEF001', subject: 'FW: Actualización de estado', receivedDate: '2023-11-22 14:30', assignedTo: 'Richard Milán Vargas' },
  { id: 'UNDEF002', subject: 'Consulta Urgente', receivedDate: '2023-11-22 15:00', assignedTo: 'Richard Milán Vargas' },
];

export const tasks: Task[] = [
  { id: 'TSK001', title: 'Resolver prevención en expediente 21-001234-1027-CA', caseId: 'CR-004', assignedTo: 'Freddy Bravo Chacón', dueDate: '2023-11-23', priority: 'Alta', status: 'Pendiente' },
  { id: 'TSK002', title: 'Contactar a Ana Silva para arreglo de pago', caseId: 'CR-002', assignedTo: 'Carolina Chavarría Arley', dueDate: '2023-11-25', priority: 'Media', status: 'En Progreso' },
  { id: 'TSK003', title: 'Preparar documentos para nuevo crédito de Bruno Costa', caseId: 'OPP001', assignedTo: 'Richard Milán Vargas', dueDate: '2023-11-28', priority: 'Media', status: 'Pendiente' },
];

export const branches = [
    { id: 'BRH001', name: 'Oficina Central', address: 'San José, Mata Redonda', manager: 'Jorge Ortiz Solís' },
    { id: 'BRH002', name: 'Punto Autorizado #2', address: 'Heredia, Centro', manager: 'Richard Milán Vargas' },
];

export const volunteers = [
  { id: 'VOL001', name: 'Elena Ramírez', email: 'elena.r@email.com', expertise: 'Derecho Administrativo', availability: 'Lunes y Miércoles (tardes)', avatarUrl: 'https://picsum.photos/seed/volunteer1/40/40' },
  { id: 'VOL002', name: 'Roberto Chen', email: 'roberto.c@email.com', expertise: 'Derecho Constitucional', availability: 'Fines de semana', avatarUrl: 'https://picsum.photos/seed/volunteer2/40/40' },
];

export const cases: Case[] = [
    {id: "23-015896-1027-CA", title: "Amparo de Legalidad vs. CCSS", clientName: "Juan Pérez", specialty: "Derecho Administrativo", status: "Presentado", assignedTo: "Lic. Freddy Bravo Chacón", lastUpdate: "2023-11-15", category: 'Contenciosa', opportunityLifecycle: 20},
    {id: "23-015897-1027-CA", title: "Amparo de Legalidad vs. MEP", clientName: "Maria Rodriguez", specialty: "Derecho Administrativo", status: "Con curso", assignedTo: "Lic. Raizza Mildrey Arocena", lastUpdate: "2023-11-14", category: 'Contenciosa', opportunityLifecycle: 40},
    {id: "23-015898-1027-CA", title: "Recurso de Amparo vs. CCSS", clientName: "Carlos Gómez", specialty: "Derecho Constitucional", status: "Rechazo de plano", assignedTo: "Lic. Jorge Ortiz Solís", lastUpdate: "2023-11-13", category: 'No Contenciosa', opportunityLifecycle: 10},
    {id: "23-015899-1027-CA", title: "Ejecución de Sentencia", clientName: "Ana Fernandez", specialty: "Derecho Administrativo", status: "Con lugar con costas", assignedTo: "Lic. Richard Milán Vargas", lastUpdate: "2023-11-12", category: 'Contenciosa', opportunityLifecycle: 80, amparoId: '21-001234-1027-CA'},
    {id: "23-015900-1027-CA", title: "Amparo por Silencio Positivo vs. MEP", clientName: "Luis Hernández", specialty: "Derecho Administrativo", status: "Sentencia", assignedTo: "Lic. Freddy Bravo Chacón", lastUpdate: "2023-11-10", category: 'Contenciosa', opportunityLifecycle: 100},
    {id: "23-015901-1027-CA", title: "Ejecución de Sentencia", clientName: "Sofía Torres", specialty: "Derecho Constitucional", status: "Con lugar sin costas", assignedTo: "Lic. Raizza Mildrey Arocena", lastUpdate: "2023-11-09", category: 'No Contenciosa', opportunityLifecycle: 90, amparoId: '20-005678-1027-CA'}
];

export const payments: Payment[] = [
    { id: 'PAY001', operationNumber: 'CR-001', debtorName: 'John Doe', paymentDate: '2023-11-01', amount: 150000, source: 'Planilla' },
    { id: 'PAY002', operationNumber: 'CR-005', debtorName: 'Lucía Méndez', paymentDate: '2023-11-01', amount: 195000, difference: 5000, source: 'Planilla' },
    { id: 'PAY003', operationNumber: 'CR-006', debtorName: 'Carlos Fernández', paymentDate: '2023-11-02', amount: 60000, source: 'Planilla' },
    { id: 'PAY004', operationNumber: 'MC-001', debtorName: 'Camila Gómez', paymentDate: '2023-11-05', amount: 50000, source: 'Ventanilla' },
    { id: 'PAY005', operationNumber: 'CR-002', debtorName: 'Ana Silva Rojas', paymentDate: '2023-11-06', amount: 70000, difference: 5000, source: 'Transferencia' },
];

export const patronos: Patrono[] = [
  { id: 'PAT001', name: 'Ministerio de Educación Pública', category: 'Ministerio', paymentDate: 'Quincenal (10 y 25)' },
  { id: 'PAT002', name: 'Caja Costarricense de Seguro Social', category: 'Institución Autónoma', paymentDate: 'Quincenal (12 y 27)' },
  { id: 'PAT003', name: 'Poder Judicial', category: 'Poder Judicial', paymentDate: 'Mensual (22)' },
  { id: 'PAT004', name: 'Ministerio de Hacienda', category: 'Ministerio', paymentDate: 'Quincenal (13 y 28)' },
  { id: 'PAT005', name: 'Ministerio de Salud', category: 'Ministerio', paymentDate: 'Quincenal (13 y 28)' },
  { id: 'PAT006', name: 'Ministerio de Obras Públicas y Transportes', category: 'Ministerio', paymentDate: 'Quincenal (13 y 28)' },
  { id: 'PAT007', name: 'Instituto Costarricense de Electricidad', category: 'Institución Autónoma', paymentDate: 'Quincenal (14 y 29)' },
  { id: 'PAT008', name: 'Instituto Nacional de Seguros', category: 'Institución Autónoma', paymentDate: 'Mensual (25)' },
  { id: 'PAT009', name: 'Acueductos y Alcantarillados', category: 'Institución Autónoma', paymentDate: 'Quincenal (11 y 26)' },
  { id: 'PAT010', name: 'Refinadora Costarricense de Petróleo', category: 'Institución Autónoma', paymentDate: 'Quincenal (10 y 25)' },
  { id: 'PAT011', name: 'Municipalidad de San José', category: 'Municipalidad', paymentDate: 'Mensual (30)' },
  { id: 'PAT012', name: 'Municipalidad de Alajuela', category: 'Municipalidad', paymentDate: 'Mensual (30)' },
  { id: 'PAT013', name: 'Municipalidad de Cartago', category: 'Municipalidad', paymentDate: 'Mensual (30)' },
  { id: 'PAT014', name: 'Municipalidad de Heredia', category: 'Municipalidad', paymentDate: 'Mensual (30)' },
  { id: 'PAT015', name: 'Universidad de Costa Rica', category: 'Institución Autónoma', paymentDate: 'Mensual (28)' },
  { id: 'PAT016', name: 'Instituto Tecnológico de Costa Rica', category: 'Institución Autónoma', paymentDate: 'Mensual (28)' },
  { id: 'PAT017', name: 'Universidad Nacional', category: 'Institución Autónoma', paymentDate: 'Mensual (28)' },
  { id: 'PAT018', name: 'Ministerio de Trabajo y Seguridad Social', category: 'Ministerio', paymentDate: 'Quincenal (13 y 28)' },
  { id: 'PAT019', name: 'Ministerio de Seguridad Pública', category: 'Ministerio', paymentDate: 'Quincenal (13 y 28)' },
  { id: 'PAT020', name: 'Junta de Protección Social', category: 'Institución Autónoma', paymentDate: 'Quincenal (10 y 25)' },
];

export const deductoras: Deductora[] = [
  { id: 'DED001', name: 'CoopeNacional', paymentDate: 'Mensual (día 20)', commission: 1.5 },
  { id: 'DED002', name: 'Coope San Gabriel', paymentDate: 'Quincenal (10 y 25)', commission: 1.75 },
  { id: 'DED003', name: 'Coope Ande #5', paymentDate: 'Quincenal (14 y 29)', commission: 1.25 },
  { id: 'DED004', name: 'CS Magisterio', paymentDate: 'Quincenal (12 y 27)', commission: 2.0 },
  { id: 'DED005', name: 'CoopeJudicial', paymentDate: 'Mensual (día 22)', commission: 1.0 },
];

export const salesVisits: SalesVisit[] = [
  { id: 'VIS001', institution: 'Ministerio de Educación Pública', salesperson: 'Jorge Ortiz Solís', date: '2023-11-20', status: 'Planificada' },
  { id: 'VIS002', institution: 'Caja Costarricense de Seguro Social', salesperson: 'Raizza Mildrey Arocena', date: '2023-11-22', status: 'Planificada' },
  { id: 'VIS003', institution: 'Poder Judicial', salesperson: 'Jorge Ortiz Solís', date: '2023-11-24', status: 'Planificada' },
];

export const salesGoals: SalesGoal[] = [
  { id: 'GOAL01', salespersonId: 'STF001', salespersonName: 'Jorge Ortiz Solís', salespersonAvatar: 'https://picsum.photos/seed/staff1/40/40', month: 'Noviembre 2023', goalAmount: 50000000, achievedAmount: 22000000 },
  { id: 'GOAL02', salespersonId: 'STF002', salespersonName: 'Raizza Mildrey Arocena', salespersonAvatar: 'https://picsum.photos/seed/staff2/40/40', month: 'Noviembre 2023', goalAmount: 40000000, achievedAmount: 31000000 },
];


    
