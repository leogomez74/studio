







export type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
};

export type Lead = {
  // Identificadores y Sistema (No fillable, pero necesarios)
  id: string; // O number, dependiendo de tu DB
  created_at?: string;
  updated_at?: string;
  avatarUrl?: string; // Para la UI
  registeredOn?: string; // Para la UI (fecha formateada)

  // --- Campos del Fillable ---
  
  // Información Personal Básica
  name: string;
  apellido1?: string;
  apellido2?: string;
  cedula: string;
  cedula_vencimiento?: string;
  fecha_nacimiento?: string;
  genero?: string;
  nacionalidad?: string;
  estado_civil?: string;
  person_type_id?: number; // ID del tipo de persona

  // Información de Contacto
  email: string;
  phone: string;
  telefono2?: string;
  telefono3?: string;
  whatsapp?: string;
  tel_casa?: string;
  tel_amigo?: string;
  redes_sociales?: string; // Puede ser un string JSON o un objeto dependiendo de cómo lo envíe el API

  // Ubicación Personal
  province?: string;
  canton?: string;
  distrito?: string;
  direccion1?: string;
  direccion2?: string;

  // Información Laboral / Profesional
  ocupacion?: string;
  profesion?: string;
  nivel_academico?: string;
  sector?: string;
  actividad_economica?: string;
  tipo_sociedad?: string; // Si aplica a persona jurídica
  nombramientos?: string; // Si aplica a persona jurídica

  // Detalles del Empleo Actual
  institucion_labora?: string;
  departamento_cargo?: string;
  institucion_direccion?: string;
  puesto?: 'Interino' | 'En Propiedad' | string; // Permitimos string por si vienen otros valores
  estado_puesto?: string;
  
  // Ubicación del Trabajo
  trabajo_provincia?: string;
  trabajo_canton?: string;
  trabajo_distrito?: string;
  trabajo_direccion?: string;

  // Estado y Gestión del Lead
  status?: string; // Estado general (texto)
  lead_status_id?: number; // ID del estado específico
  is_active?: boolean;
  notes?: string;
  responsable?: string; // Nuevo campo del fillable (nombre o ID del usuario asignado)
  deductora_id?: string | number;

  // Relaciones y Referencias
  relacionado_a?: string;
  tipo_relacion?: string;

  // Referencia 2
  tel_amigo_2?: string;
  relacionado_a_2?: string;
  tipo_relacion_2?: string;

  // --- Campos Calculados / Relaciones (No fillable directo, pero retornados por API) ---
  lead_status?: { id: number; name: string; color?: string } | string;
  assigned_to_id?: number; // A veces se usa distinto a 'responsable'
  assignedTo?: string; // Nombre del responsable para mostrar en UI
  source?: string;
  opportunities?: Opportunity[];
  documents?: PersonDocument[];
};

export type PersonDocument = {
      id: number;
      person_id: number;
      name: string;
      notes?: string;
      path: string;
      url?: string;
      mime_type?: string;
      size?: number;
      file_created_at?: string;
};

export type CreditPayment = {
      id: number;
      credit_id: number;
      numero_cuota?: number;
      proceso?: string;
      fecha_cuota?: string;
      fecha_pago?: string;
      cuota?: number;
      monto?: number;
      poliza?: number;
      interes_corriente?: number;
      interes_moratorio?: number;
      amortizacion?: number;
      saldo_anterior?: number;
      nuevo_saldo?: number;
      estado?: string;
      fecha_movimiento?: string;
      movimiento_total?: number;
      movimiento_amortizacion?: number;
      linea?: string;
      fecha_inicio?: string;
      fecha_corte?: string;
      tasa_actual?: number;
      plazo_actual?: number;
      dias?: number;
      dias_mora?: number;
      source?: string;
      cedula?: string;
      origen?: string;
      capital_aplicado?: number;
      interes_aplicado?: number;
      mora_aplicada?: number;
      fecha?: string;
      created_at?: string;
      credit?: { id: number; reference?: string };
};

export type Client = {
      id: string;
      name: string;
      cedula: string;
      email: string;
      phone: string;
      clientStatus?: 'Activo' | 'Moroso' | 'En cobro' | 'Fallecido' | 'Inactivo';
      activeCredits?: number;
      registeredOn?: string;
      avatarUrl?: string;
      status?: string;
      is_active?: boolean;
      created_at?: string;
      apellido1?: string;
      apellido2?: string;
      whatsapp?: string;
      tel_casa?: string;
      tel_amigo?: string;
      province?: string;
      canton?: string;
      distrito?: string;
      direccion1?: string;
      direccion2?: string;
      ocupacion?: string;
      estado_civil?: string;
      fecha_nacimiento?: string;
      relacionado_a?: string;
      tipo_relacion?: string;
      tel_amigo_2?: string;
      relacionado_a_2?: string;
      tipo_relacion_2?: string;
      notes?: string;
      source?: string;
      genero?: string;
      nacionalidad?: string;
      telefono2?: string;
      telefono3?: string;
      institucion_labora?: string;
      departamento_cargo?: string;
      deductora_id?: string | number;
      lead_status_id?: number;
      assigned_to_id?: number;
      person_type_id?: number;
      opportunities?: Opportunity[];
      cedula_vencimiento?: string;
      nivel_academico?: string;
      puesto?: string;
      profesion?: string;
      sector?: string;
      trabajo_provincia?: string;
      trabajo_canton?: string;
      trabajo_distrito?: string;
      trabajo_direccion?: string;
      institucion_direccion?: string;
      actividad_economica?: string;
      tipo_sociedad?: string;
      nombramientos?: string;
      estado_puesto?: string;
      lead_id?: number;
      documents?: PersonDocument[];
};

export type Investor = {
  id: string;
  name: string;
  cedula: string;
  email: string;
  phone: string;
  status: 'Activo' | 'Inactivo';
  activeInvestments?: number;
  registeredOn?: string;
  avatarUrl?: string;
  investment_balance?: number;
  joined_at?: string;
};

export type Opportunity = {
  id: string;
  lead_cedula?: string;
  opportunity_type?: string;
  vertical?: string;
  amount: number;
  status: string;
  expected_close_date?: string;
  comments?: string;
  assigned_to_id?: number;
  lost_reason?: string | null;
  created_at?: string;
  updated_at?: string;
  lead?: Lead;
  amparo_id?: string;
  tags?: string[];
  missing_documents?: string[];

  // Legacy / UI fields
  leadCedula?: string;
  creditType?: 'Regular' | 'Micro-crédito';
  startDate?: string;
  assignedTo?: string;
};

export type Credit = {
  id?: number;
  reference?: string;
  title?: string;
  status: string;
  category?: string;
  progress?: number;
  lead_id?: number;
  opportunity_id?: string;
  assigned_to?: number | string | null;
  opened_at?: string;
  description?: string;
  numero_cuota : number;
  // New fields
  tipo_credito?: string | null;
  numero_operacion?: string | null;
  monto_credito?: number | null;
  cuota?: number | null;
  fecha_ultimo_pago?: string | null;
  garantia?: string | null;
  fecha_culminacion_credito?: string | null;
  tasa_anual?: number | null;
  plazo?: number | null;
  cuotas_atrasadas?: number | null;
  deductora?: { id: number; nombre: string } | null;
  deductora_id?: number;
  divisa?: string | null;
  linea?: string | null;
  primera_deduccion?: string | null;
  saldo?: number | null;
  proceso?: string | null;
  documento_id?: string | null;
  lead?: { id: number; name: string; email: string | null  ; cedula?: number} | null;
  opportunity?: { id: string; title: string | null } | null;
  plan_de_pagos?: Array<{
    id: number;
    credit_id: number;
    numero_cuota: number;
    cuota: number;
    saldo_anterior: number;
    interes_corriente: number;
    amortizacion: number;
    saldo_nuevo: number;
    fecha_pago: string | null;
    estado: string;
    dias_mora?: number;
  }> | null;

  // Refundición
  refundicion_parent_id?: number | null;
  refundicion_child_id?: number | null;
  refundicion_saldo_absorbido?: number | null;
  refundicion_monto_entregado?: number | null;
  refundicion_at?: string | null;
  cierre_motivo?: string | null;
  refundicion_parent?: { id: number; reference: string; monto_credito: number; saldo: number } | null;
  refundicion_child?: { id: number; reference: string; monto_credito: number; saldo: number } | null;

  // Legacy / UI fields for cobro-judicial
  operationNumber?: string;
  expediente?: string;
  debtorName?: string;
  balance?: number;
  daysInArrears?: number;
  employer?: string;
};

export type Deductora = {
    id?: number | string;
    nombre?: string;
    fecha_reporte_pago?: string;
    comision?: number;

    // Legacy / Mock
    name?: string;
    paymentDate?: string;
    commission?: number;
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
  vehicle: 'Motocicleta' | 'Automóvil';
  phone?: string;
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
  cedula: number;
  monto: number;
  source: string;
  credit?: Credit;
  created_at?: string;

};

export type Patrono = {
  id: string;
  name: string;
  category: 'Ministerio' | 'Institución Autónoma' | 'Poder Judicial' | 'Municipalidad' | 'Otro';
  paymentDate: string;
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

// --- Project Management Data ---

export type Attachment = {
  id: string;
  name: string;
  type: 'image' | 'pdf' | 'zip' | 'file';
  size: string;
  url: string;
};

export type Comment = {
  id: string;
  author: string;
  avatarUrl: string;
  text: string;
  timestamp: string;
};

export type ProjectTask = {
  id: string;
  title: string;
  startDate: string;
  dueDate: string;
  completed: boolean;
  details: string;
  priority: 'Alta' | 'Media' | 'Baja';
  comments: Comment[];
  assignedTo: string;
  attachments?: Attachment[];
  estimatedHours?: number;
  milestoneId: string;
};


export type Milestone = {
  id: string;
  title: string;
  description: string;
  days: string;
  tasks: ProjectTask[];
};

export type Project = {
    id: string;
    name: string;
    leader: string;
    leaderAvatar: string;
    budget: number;
    startDate: string;
    endDate: string;
    status: 'Planificado' | 'En Progreso' | 'Completado' | 'En Riesgo';
    milestones: Milestone[];
}

export const projects: Project[] = [
    {
        id: 'PROJ-001',
        name: 'Backend en Laravel',
        leader: 'Leonardo Gómez',
        leaderAvatar: 'https://picsum.photos/seed/staff5/40/40',
        budget: 15000,
        startDate: '2024-11-11',
        endDate: '2024-11-30',
        status: 'En Progreso',
        milestones: [
          {
            id: 'HITO1',
            title: 'Hito 1: Configuración, Base de Datos y Autenticación',
            description: 'Establecer la infraestructura del proyecto, definir la base de datos y asegurar un sistema de autenticación robusto.',
            days: 'Días 1-3',
            tasks: [
              { id: 'T1.1', milestoneId: 'HITO1', title: 'Inicializar y configurar el proyecto Laravel', startDate: '2024-11-11', dueDate: '2024-11-11', completed: false, details: 'Crear un nuevo proyecto Laravel 11. Configurar el archivo .env con las variables de entorno para desarrollo local (APP_NAME, APP_ENV, APP_KEY, DB_CONNECTION).', priority: 'Alta', comments: [], assignedTo: 'Ahixel Rojas' },
              { id: 'T1.2', milestoneId: 'HITO1', title: 'Diseñar y ejecutar migraciones de la base de datos', startDate: '2024-11-11', dueDate: '2024-11-12', completed: false, details: 'Crear los archivos de migración para las tablas principales: `users`, `clients`, `leads`, `investors`, `credits` y `opportunities`. Definir todos los campos, tipos de datos, índices y claves foráneas. Ejecutar `php artisan migrate`.', priority: 'Alta', comments: [], assignedTo: 'Ahixel Rojas' },
              { id: 'T1.3', milestoneId: 'HITO1', title: 'Crear los modelos Eloquent con sus relaciones', startDate: '2024-11-12', dueDate: '2024-11-12', completed: false, details: 'Generar los modelos Eloquent para cada tabla creada. Definir las relaciones (`hasMany`, `belongsTo`, etc.) entre los modelos para reflejar la lógica del negocio.', priority: 'Alta', comments: [], assignedTo: 'Ahixel Rojas' },
              { id: 'T1.4', milestoneId: 'HITO1', title: 'Implementar autenticación con Laravel Sanctum', startDate: '2024-11-13', dueDate: '2024-11-13', completed: false, details: 'Instalar y configurar Laravel Sanctum. Implementar los endpoints de API para registro, login (`/login`) y logout (`/logout`). El login debe retornar un token para ser usado por el frontend.', priority: 'Alta', comments: [], assignedTo: 'Ahixel Rojas' },
            ]
          },
          {
            id: 'HITO2',
            title: 'Hito 2: Endpoints Core y Lógica de Negocio',
            description: 'Desarrollar los endpoints CRUD para las entidades principales y la lógica de conversión.',
            days: 'Días 4-6',
            tasks: [
              { id: 'T2.1', milestoneId: 'HITO2', title: 'Implementar API Resource Controllers para Leads y Clientes', startDate: '2024-11-14', dueDate: '2024-11-15', completed: false, details: 'Crear controladores de recursos de API para `Leads` y `Clients` que manejen las operaciones CRUD (index, show, store, update, destroy). Utilizar API Resources de Laravel para estandarizar las respuestas JSON.', priority: 'Alta', comments: [], assignedTo: 'Ahixel Rojas' },
              { id: 'T2.2', milestoneId: 'HITO2', title: 'Desarrollar endpoint de conversión de Lead a Cliente', startDate: '2024-11-15', dueDate: '2024-11-15', completed: false, details: 'Crear el endpoint `POST /api/leads/{id}/convert`. Este debe crear un nuevo `Client` a partir de los datos del `Lead` y marcar el `Lead` como "Convertido".', priority: 'Media', comments: [], assignedTo: 'Ahixel Rojas' },
              { id: 'T2.3', milestoneId: 'HITO2', title: 'Implementar API Resource Controllers para Créditos y Oportunidades', startDate: '2024-11-16', dueDate: '2024-11-18', completed: false, details: 'Crear controladores de recursos de API para `Credits` y `Opportunities`, manejando su ciclo de vida completo a través de los endpoints CRUD correspondientes.', priority: 'Alta', comments: [], assignedTo: 'Ahixel Rojas' },
            ]
          },
          {
            id: 'HITO3',
            title: 'Hito 3: Integración con ERP y Contenerización',
            description: 'Conectar con el ERP externo para sincronizar datos y preparar la aplicación para despliegue con Docker.',
            days: 'Días 7-8',
            tasks: [
              { id: 'T3.1', milestoneId: 'HITO3', title: 'Desarrollar capa de servicio para API de erp.pep.cr', startDate: '2024-11-19', dueDate: '2024-11-19', completed: false, details: 'Crear una clase de servicio en Laravel para manejar la comunicación con `erp.pep.cr`. Implementar métodos para Contabilidad, RRHH y Tesorería. Usar el cliente HTTP de Laravel y manejar la autenticación y errores de la API externa.', priority: 'Alta', comments: [], assignedTo: 'Ahixel Rojas' },
              { id: 'T3.2', milestoneId: 'HITO3', title: 'Crear `Dockerfile` para producción', startDate: '2024-11-20', dueDate: '2024-11-20', completed: false, details: 'Configurar un `Dockerfile` multi-etapa que compile los assets, instale dependencias de PHP y configure un servidor web (Nginx + PHP-FPM) para servir la aplicación Laravel de forma eficiente y segura.', priority: 'Alta', comments: [], assignedTo: 'Ahixel Rojas' },
              { id: 'T3.3', milestoneId: 'HITO3', title: 'Configurar `docker-compose.yml` para desarrollo local', startDate: '2024-11-20', dueDate: '2024-11-20', completed: false, details: 'Crear un archivo `docker-compose.yml` que levante los servicios necesarios para el desarrollo: la aplicación Laravel, una base de datos MySQL y Redis para caché/colas.', priority: 'Media', comments: [], assignedTo: 'Ahixel Rojas' },
            ]
          },
          {
            id: 'HITO4',
            title: 'Hito 4: Pruebas, Despliegue y Empaquetado',
            description: 'Asegurar la calidad del código, preparar el despliegue y generar la versión de escritorio.',
            days: 'Días 9-12',
            tasks: [
              { id: 'T4.1', milestoneId: 'HITO4', title: 'Configurar GitHub Actions para CI/CD', startDate: '2024-11-21', dueDate: '2024-11-22', completed: false, details: 'Crear un workflow de GitHub Actions que se active en cada push a la rama `main`. El workflow debe ejecutar tests (PHPUnit) y, si pasan, construir y pushear la imagen Docker a un registro como Docker Hub o GitHub Container Registry.', priority: 'Alta', comments: [], assignedTo: 'Ahixel Rojas' },
              { id: 'T4.2', milestoneId: 'HITO4', title: 'Generar Seeders para datos de prueba', startDate: '2024-11-23', dueDate: '2024-11-25', completed: false, details: 'Crear `seeders` de Laravel para poblar la base de datos con datos de prueba realistas para todas las entidades (clientes, créditos, etc.). Esto es crucial para realizar pruebas manuales y automáticas.', priority: 'Media', comments: [], assignedTo: 'Ahixel Rojas' },
              { id: 'T4.3', milestoneId: 'HITO4', title: 'Realizar pruebas de integración y entre navegadores', startDate: '2024-11-26', dueDate: '2024-11-27', completed: false, details: 'Probar el flujo completo de la aplicación (frontend + backend) en los principales navegadores (Chrome, Firefox, Safari) para asegurar la compatibilidad y una experiencia de usuario consistente.', priority: 'Media', comments: [], assignedTo: 'Ahixel Rojas' },
              { id: 'T4.4', milestoneId: 'HITO4', title: 'Investigar y prototipar empaquetado con Tauri', startDate: '2024-11-28', dueDate: '2024-11-29', completed: false, details: 'Dado que el frontend es Next.js, usar Tauri es una opción moderna y de alto rendimiento para empaquetar la aplicación web como un ejecutable de escritorio. Investigar la integración, configurar el `tauri.conf.json` y generar una compilación de prueba para macOS, Windows y Linux.', priority: 'Baja', comments: [], assignedTo: 'Ahixel Rojas' },
              { id: 'T4.5', milestoneId: 'HITO4', title: 'Preparar documentación final y entregar proyecto', startDate: '2024-11-30', dueDate: '2024-11-30', completed: false, details: 'Documentar la configuración de la API, el proceso de despliegue con Docker y cualquier otra instrucción relevante para el mantenimiento del proyecto. Archivar y entregar el código fuente final.', priority: 'Alta', comments: [], assignedTo: 'Ahixel Rojas' },
            ]
          }
        ]
    },
    {
        id: 'PROJ-002',
        name: 'App Móvil para Clientes',
        leader: 'Raizza Mildrey Arocena',
        leaderAvatar: 'https://picsum.photos/seed/staff2/40/40',
        budget: 25000,
        startDate: '2024-12-01',
        endDate: '2025-02-15',
        status: 'Planificado',
        milestones: []
    }
]

// --- Mock Data ---

export const creditConfigs = {
  regular: {
    interestRate: 36,
    minAmount: 500000,
    maxAmount: 10000000,
    minTerm: 12,
    maxTerm: 72,
  },
  micro: {
    interestRate: 54,
    minAmount: 100000,
    maxAmount: 1000000,
    minTerm: 6,
    maxTerm: 24,
  },
};


export const users: User[] = [
    { id: 'STF001', name: 'Carlos Mendez', email: 'carlosm@pep.cr', avatarUrl: 'https://picsum.photos/seed/staff1/40/40' },
    { id: 'STF002', name: 'Wilmer Marquez', email: 'coder@gomez.cr', avatarUrl: 'https://picsum.photos/seed/staff2/40/40' },
    { id: 'STF003', name: 'Ahixel Rojas', email: 'ahixel@pep.cr', avatarUrl: 'https://picsum.photos/seed/staff3/40/40' },
    { id: 'STF004', name: 'Daniel Gómez', email: 'daniel@gomez.cr', avatarUrl: 'https://picsum.photos/seed/staff4/40/40' },
    { id: 'STF005', name: 'Leonardo Gómez', email: 'leonardo@gomez.cr', avatarUrl: 'https://picsum.photos/seed/staff5/40/40' },
];

export const staff = users;

export type Volunteer = {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  expertise?: string;
  availability?: string;
};

export const volunteers: Volunteer[] = [
  { id: 'VOL001', name: 'María Pérez', email: 'maria.perez@example.com', avatarUrl: 'https://picsum.photos/seed/vol1/40/40', expertise: 'Asesoría legal', availability: 'Lun a Vie' },
  { id: 'VOL002', name: 'Carlos Mora', email: 'carlos.mora@example.com', avatarUrl: 'https://picsum.photos/seed/vol2/40/40', expertise: 'Trámites', availability: 'Sábados' },
  { id: 'VOL003', name: 'Ana López', email: 'ana.lopez@example.com', avatarUrl: 'https://picsum.photos/seed/vol3/40/40', expertise: 'Atención al cliente', availability: 'Miércoles y Viernes' },
];

export type Branch = {
  id: string;
  name: string;
  address?: string;
  manager?: string;
};

export const branches: Branch[] = [
  { id: 'BRH001', name: 'Oficina Central', address: 'San José, San José', manager: 'Jorge Ortiz Solís' },
  { id: 'BRH002', name: 'Sucursal Alajuela', address: 'Alajuela, Alajuela', manager: 'Raizza Mildrey Arocena' },
  { id: 'BRH003', name: 'Sucursal Cartago', address: 'Cartago, Cartago', manager: 'Freddy Bravo Chacón' },
];

export const leads: Lead[] = [
    {
      id: 'LEAD001', name: 'Carla Díaz Solano', cedula: '3-1111-2222', email: 'carla.dias@example.com', phone: '7555-4444', registeredOn: '2023-10-27', avatarUrl: 'https://picsum.photos/seed/avatar3/40/40', puesto: 'Interino',  assignedTo: 'Oficina',
      lead_status_id: 0,
      apellido1: 'Díaz', apellido2: 'Solano', fecha_nacimiento: '1990-05-15', estado_civil: 'Soltero', whatsapp: '7555-4444', tel_casa: '2222-3333', province: 'San José', canton: 'San José', distrito: 'Pavas', direccion1: 'De la embajada americana 200m norte', ocupacion: 'Administrativa', status: 'Nuevo', source: 'Facebook', is_active: true
    },
    {
      id: 'LEAD002', name: 'Daniel Alves Mora', cedula: '4-2222-3333', email: 'daniel.alves@example.com', phone: '5432-1876', registeredOn: '2023-10-24', avatarUrl: 'https://picsum.photos/seed/avatar4/40/40', puesto: 'En Propiedad',     assignedTo: 'Carlos Mendez',
      lead_status_id: 0,
      apellido1: 'Alves', apellido2: 'Mora', fecha_nacimiento: '1985-08-20', estado_civil: 'Casado', whatsapp: '5432-1876', tel_casa: '2233-4455', province: 'Alajuela', canton: 'Alajuela', distrito: 'San José', direccion1: 'Barrio San José, casa 25', ocupacion: 'Ingeniero', status: 'Contactado', source: 'Referido', is_active: true
    },
    {
      id: 'LEAD003', name: 'Eduardo Pereira', cedula: '9-0123-4567', email: 'eduardo.p@example.com', phone: '8123-9876', registeredOn: '2023-11-05', avatarUrl: 'https://picsum.photos/seed/avatar6/40/40', puesto: 'En Propiedad',  assignedTo: 'Oficina',
      lead_status_id: 0,
      apellido1: 'Pereira', apellido2: 'Gómez', fecha_nacimiento: '1988-03-10', estado_civil: 'Divorciado', whatsapp: '8123-9876', province: 'Heredia', canton: 'Heredia', distrito: 'San Francisco', direccion1: 'Condominio Las Flores', ocupacion: 'Contador', status: 'Nuevo', source: 'Web', is_active: true
    },
    {
      id: 'LEAD004', name: 'Fernanda Núñez', cedula: '1-2345-6789', email: 'fernanda.n@example.com', phone: '7890-1234', registeredOn: '2023-11-06', avatarUrl: 'https://picsum.photos/seed/avatar7/40/40', puesto: 'Interino',  assignedTo: 'Wilmer Marquez',
      lead_status_id: 0,
      apellido1: 'Núñez', apellido2: 'Rojas', fecha_nacimiento: '1995-12-01', estado_civil: 'Soltero', whatsapp: '7890-1234', province: 'Cartago', canton: 'Cartago', distrito: 'Oriental', direccion1: 'Frente al colegio San Luis', ocupacion: 'Recepcionista', status: 'En Proceso', source: 'Instagram', is_active: true
    },
];

export const clients: Client[] = [
    { id: 'USR001', name: 'Ana Silva Rojas', cedula: '1-1234-5678', email: 'ana.silva@example.com', phone: '8765-4321', clientStatus: 'Moroso', activeCredits: 2, registeredOn: '2023-01-26', avatarUrl: 'https://picsum.photos/seed/avatar1/40/40',
      apellido1: 'Silva', apellido2: 'Rojas', whatsapp: '8765-4321', province: 'San José', canton: 'Escazú', distrito: 'San Rafael', direccion1: 'Residencial Los Laureles', ocupacion: 'Gerente', estado_civil: 'Casado', fecha_nacimiento: '1980-01-15', genero: 'Femenino', nacionalidad: 'Costarricense', is_active: true
    },
    { id: 'USR006', name: 'John Doe', cedula: '6-4444-5555', email: 'john.doe@example.com', phone: '1122-3344', clientStatus: 'Activo', activeCredits: 1, registeredOn: '2022-10-29', avatarUrl: 'https://picsum.photos/seed/avatarJD/40/40',
      apellido1: 'Doe', apellido2: '', whatsapp: '1122-3344', province: 'Guanacaste', canton: 'Liberia', distrito: 'Liberia', direccion1: 'Barrio La Victoria', ocupacion: 'Turismo', estado_civil: 'Soltero', fecha_nacimiento: '1992-06-20', genero: 'Masculino', nacionalidad: 'Estadounidense', is_active: true
    },
    { id: 'USR007', name: 'Jane Smith', cedula: '7-5555-6666', email: 'jane.smith@example.com', phone: '9988-7766', clientStatus: 'En cobro', activeCredits: 1, registeredOn: '2022-09-15', avatarUrl: 'https://picsum.photos/seed/avatarJS/40/40',
      apellido1: 'Smith', apellido2: '', whatsapp: '9988-7766', province: 'Puntarenas', canton: 'Puntarenas', distrito: 'Chacarita', direccion1: 'Frente al mar', ocupacion: 'Pensionada', estado_civil: 'Viudo', fecha_nacimiento: '1955-04-10', genero: 'Femenino', nacionalidad: 'Canadiense', is_active: true
    },
    { id: 'USR008', name: 'Peter Jones', cedula: '8-6666-7777', email: 'peter.jones@example.com', phone: '6677-8899', clientStatus: 'Inactivo', activeCredits: 0, registeredOn: '2021-08-20', avatarUrl: 'https://picsum.photos/seed/avatarPJ/40/40',
      apellido1: 'Jones', apellido2: '', whatsapp: '6677-8899', province: 'Limón', canton: 'Limón', distrito: 'Limón', direccion1: 'Barrio Roosevelt', ocupacion: 'Estibador', estado_civil: 'Unión Libre', fecha_nacimiento: '1985-09-05', genero: 'Masculino', nacionalidad: 'Jamaiquino', is_active: false
    },
    { id: 'USR009', name: 'Lucía Méndez', cedula: '9-7777-8888', email: 'lucia.mendez@example.com', phone: '5566-7788', clientStatus: 'Activo', activeCredits: 1, registeredOn: '2023-02-11', avatarUrl: 'https://picsum.photos/seed/avatarLM/40/40',
      apellido1: 'Méndez', apellido2: 'Soto', whatsapp: '5566-7788', province: 'San José', canton: 'Desamparados', distrito: 'San Miguel', direccion1: 'Urbanización La Paz', ocupacion: 'Enfermera', estado_civil: 'Soltero', fecha_nacimiento: '1998-02-28', genero: 'Femenino', nacionalidad: 'Costarricense', is_active: true
    },
    { id: 'USR010', name: 'Carlos Fernández', cedula: '1-8888-9999', email: 'carlos.f@example.com', phone: '4455-6677', clientStatus: 'Activo', activeCredits: 1, registeredOn: '2023-03-12', avatarUrl: 'https://picsum.photos/seed/avatarCF/40/40',
      apellido1: 'Fernández', apellido2: 'López', whatsapp: '4455-6677', province: 'Alajuela', canton: 'San Carlos', distrito: 'Quesada', direccion1: 'Barrio El Carmen', ocupacion: 'Agricultor', estado_civil: 'Casado', fecha_nacimiento: '1975-11-15', genero: 'Masculino', nacionalidad: 'Costarricense', is_active: true
    },
    { id: 'USR011', name: 'Sofía Hernández', cedula: '2-9999-0000', email: 'sofia.h@example.com', phone: '3344-5566', clientStatus: 'Moroso', activeCredits: 1, registeredOn: '2023-04-13', avatarUrl: 'https://picsum.photos/seed/avatarSH/40/40',
      apellido1: 'Hernández', apellido2: 'Mora', whatsapp: '3344-5566', province: 'Heredia', canton: 'Belén', distrito: 'San Antonio', direccion1: 'Condominio La Ribera', ocupacion: 'Arquitecta', estado_civil: 'Soltero', fecha_nacimiento: '1991-07-22', genero: 'Femenino', nacionalidad: 'Costarricense', is_active: true
    },
    { id: 'USR012', name: 'Miguel González', cedula: '3-0000-1111', email: 'miguel.g@example.com', phone: '2233-4455', clientStatus: 'Activo', activeCredits: 1, registeredOn: '2023-05-14', avatarUrl: 'https://picsum.photos/seed/avatarMG/40/40',
      apellido1: 'González', apellido2: 'Pérez', whatsapp: '2233-4455', province: 'Cartago', canton: 'Paraíso', distrito: 'Paraíso', direccion1: 'Barrio El Salvador', ocupacion: 'Profesor', estado_civil: 'Casado', fecha_nacimiento: '1982-05-30', genero: 'Masculino', nacionalidad: 'Costarricense', is_active: true
    },
    { id: 'USR013', name: 'Valentina Rossi', cedula: '4-1111-2222', email: 'valentina.r@example.com', phone: '1122-3344', clientStatus: 'Activo', activeCredits: 1, registeredOn: '2023-06-15', avatarUrl: 'https://picsum.photos/seed/avatarVR/40/40',
      apellido1: 'Rossi', apellido2: 'Bianchi', whatsapp: '1122-3344', province: 'San José', canton: 'Santa Ana', distrito: 'Pozos', direccion1: 'Lindora', ocupacion: 'Diseñadora', estado_civil: 'Soltero', fecha_nacimiento: '1996-10-10', genero: 'Femenino', nacionalidad: 'Italiana', is_active: true
    },
    { id: 'USR014', name: 'Javier Rodríguez', cedula: '5-2222-3333', email: 'javier.r@example.com', phone: '9988-7766', clientStatus: 'Activo', activeCredits: 1, registeredOn: '2023-07-16', avatarUrl: 'https://picsum.photos/seed/avatarJR/40/40',
      apellido1: 'Rodríguez', apellido2: 'Sánchez', whatsapp: '9988-7766', province: 'Alajuela', canton: 'Grecia', distrito: 'Grecia', direccion1: 'Barrio San Roque', ocupacion: 'Mecánico', estado_civil: 'Divorciado', fecha_nacimiento: '1978-03-25', genero: 'Masculino', nacionalidad: 'Costarricense', is_active: true
    },
    { id: 'USR015', name: 'Camila Gómez', cedula: '6-3333-4444', email: 'camila.g@example.com', phone: '8877-6655', clientStatus: 'Activo', activeCredits: 1, registeredOn: '2023-08-17', avatarUrl: 'https://picsum.photos/seed/avatarCG/40/40',
      apellido1: 'Gómez', apellido2: 'Vargas', whatsapp: '8877-6655', province: 'Heredia', canton: 'San Rafael', distrito: 'San Rafael', direccion1: 'Calle La Joya', ocupacion: 'Estudiante', estado_civil: 'Soltero', fecha_nacimiento: '2001-08-12', genero: 'Femenino', nacionalidad: 'Costarricense', is_active: true
    },
    { id: 'USR016', name: 'Mateo Díaz', cedula: '7-4444-5555', email: 'mateo.d@example.com', phone: '7766-5544', clientStatus: 'Activo', activeCredits: 1, registeredOn: '2023-09-18', avatarUrl: 'https://picsum.photos/seed/avatarMD/40/40',
      apellido1: 'Díaz', apellido2: 'Castro', whatsapp: '7766-5544', province: 'Puntarenas', canton: 'Garabito', distrito: 'Jaco', direccion1: 'Condominio Vista Mar', ocupacion: 'Empresario', estado_civil: 'Casado', fecha_nacimiento: '1989-12-05', genero: 'Masculino', nacionalidad: 'Costarricense', is_active: true
    },
    { id: 'USR017', name: 'Isabella Castillo', cedula: '8-5555-6666', email: 'isabella.c@example.com', phone: '6655-4433', clientStatus: 'Fallecido', activeCredits: 0, registeredOn: '2022-01-19', avatarUrl: 'https://picsum.photos/seed/avatarIC/40/40',
      apellido1: 'Castillo', apellido2: 'Mora', whatsapp: '6655-4433', province: 'San José', canton: 'Curridabat', distrito: 'Granadilla', direccion1: 'Urbanización Altamonte', ocupacion: 'Abogada', estado_civil: 'Casado', fecha_nacimiento: '1960-02-18', genero: 'Femenino', nacionalidad: 'Costarricense', is_active: false
    },
    { id: 'USR018', name: 'Sebastián Soto', cedula: '9-6666-7777', email: 'sebastian.s@example.com', phone: '5544-3322', clientStatus: 'Activo', activeCredits: 1, registeredOn: '2023-10-20', avatarUrl: 'https://picsum.photos/seed/avatarSS/40/40',
      apellido1: 'Soto', apellido2: 'Ramírez', whatsapp: '5544-3322', province: 'Guanacaste', canton: 'Nicoya', distrito: 'Nicoya', direccion1: 'Barrio La Cananga', ocupacion: 'Ganadero', estado_civil: 'Soltero', fecha_nacimiento: '1993-06-14', genero: 'Masculino', nacionalidad: 'Costarricense', is_active: true
    },
    { id: 'USR019', name: 'Gabriela Vargas', cedula: '1-7777-8888', email: 'gabriela.v@example.com', phone: '4433-2211', clientStatus: 'En cobro', activeCredits: 1, registeredOn: '2022-05-21', avatarUrl: 'https://picsum.photos/seed/avatarGV/40/40',
      apellido1: 'Vargas', apellido2: 'Jiménez', whatsapp: '4433-2211', province: 'Alajuela', canton: 'Palmares', distrito: 'Palmares', direccion1: 'Barrio La Granja', ocupacion: 'Secretaria', estado_civil: 'Divorciado', fecha_nacimiento: '1984-09-22', genero: 'Femenino', nacionalidad: 'Costarricense', is_active: true
    },
    { id: 'USR020', name: 'Bruno Costa Marin', cedula: '2-0987-6543', email: 'bruno.costa@example.com', phone: '6123-4567', clientStatus: 'Activo', activeCredits: 1, registeredOn: '2023-10-25', avatarUrl: 'https://picsum.photos/seed/avatar2/40/40',
      apellido1: 'Costa', apellido2: 'Marin', whatsapp: '6123-4567', province: 'San José', canton: 'San José', distrito: 'Mata Redonda', direccion1: 'Sabana Norte', ocupacion: 'Consultor', estado_civil: 'Soltero', fecha_nacimiento: '1990-01-01', genero: 'Masculino', nacionalidad: 'Brasileño', is_active: true
    },
];

export const investors: Investor[] = [
    { id: 'INV001', name: 'Laura Montes', cedula: '1-0987-6543', email: 'laura.montes@inversion.com', phone: '8888-9999', status: 'Activo', activeInvestments: 1, registeredOn: '2022-08-15', avatarUrl: 'https://picsum.photos/seed/investor1/40/40' },
    { id: 'INV002', name: 'Ricardo Vega', cedula: '2-0876-5432', email: 'ricardo.vega@inversion.com', phone: '7777-6666', status: 'Activo', activeInvestments: 2, registeredOn: '2023-01-20', avatarUrl: 'https://picsum.photos/seed/investor2/40/40' },
    { id: 'INV003', name: 'Elena Solis', cedula: '3-0765-4321', email: 'elena.solis@inversion.com', phone: '6666-5555', status: 'Inactivo', activeInvestments: 0, registeredOn: '2021-11-30', avatarUrl: 'https://picsum.photos/seed/investor3/40/40' },
];

export const opportunities: Opportunity[] = [
    { id: 'OPP001', leadCedula: '2-0987-6543', creditType: 'Regular', amount: 5000000, status: 'En proceso', startDate: '2023-11-01', assignedTo: 'Wilmer Marquez' },
    { id: 'OPP002', leadCedula: '5-3333-4444', creditType: 'Micro-crédito', amount: 500000, status: 'Convertido', startDate: '2023-11-02', assignedTo: 'Carlos Mendez' },
    { id: 'OPP003', leadCedula: '3-1111-2222', creditType: 'Regular', amount: 2000000, status: 'Rechazada', startDate: '2023-11-03', assignedTo: 'Wilmer Marquez' },
    { id: 'OPP004', leadCedula: '4-2222-3333', creditType: 'Regular', amount: 7000000, status: 'Aceptada', startDate: '2023-11-04', assignedTo: 'Carlos Mendez' },
];

export const credits: Credit[] = [
    {
        id: 1,
        numero_operacion: 'CR-2024-001',
        tipo_credito: 'personal',
        numero_cuota:1,
        status: 'activo',
        monto_credito: 5000000,
        saldo: 4500000,
        cuota: 150000,
        plazo: 48,
        tasa_anual: 18.5,
        divisa: 'CRC',
        fecha_ultimo_pago: '2024-01-15',
        primera_deduccion: '2024-02-15',
        garantia: 'Fiduciaria',
        fecha_culminacion_credito: '2028-01-15',
        cuotas_atrasadas: 0,
        deductora: { id: 1, nombre: 'CoopeAnde' },
        lead: { id: 1, name: 'Juan Perez', email: 'juan.perez@example.com' },
        reference: 'CR-2024-001', title: 'Préstamo Personal Juan', category: 'Personal', progress: 10, lead_id: 1, assigned_to: 'Carlos Mendez', opened_at: '2024-01-10', description: 'Préstamo para consolidación de deudas', deductora_id: 1, linea: 'Personal', proceso: 'Normal', documento_id: 'DOC-001'
    },
    {
        id: 2,
        numero_operacion: 'CR-2023-055',
        tipo_credito: 'hipotecario',
        numero_cuota:10,
        status: 'mora',
        monto_credito: 150000,
        saldo: 145000,
        cuota: 1200,
        plazo: 240,
        tasa_anual: 7.5,
        divisa: 'USD',
        fecha_ultimo_pago: '2023-11-01',
        primera_deduccion: '2023-06-01',
        garantia: 'Hipoteca 1er Grado',
        fecha_culminacion_credito: '2043-06-01',
        cuotas_atrasadas: 2,
        deductora: { id: 2, nombre: 'Banco Nacional' },
        lead: { id: 2, name: 'Maria Rodriguez', email: 'maria.rod@example.com' },
        reference: 'CR-2023-055', title: 'Hipoteca Casa Maria', category: 'Hipotecario', progress: 5, lead_id: 2, assigned_to: 'Wilmer Marquez', opened_at: '2023-05-15', description: 'Compra de vivienda principal', deductora_id: 2, linea: 'Vivienda', proceso: 'Cobro Administrativo', documento_id: 'DOC-002'
    },
    {
      id: 3,
      numero_operacion: 'CR-2022-102',
      tipo_credito: 'prendario',
      status: 'cerrado',
      monto_credito: 8000000,
      saldo: 0,
      cuota: 250000,
      plazo: 36,
      tasa_anual: 15.0,
      divisa: 'CRC',
      fecha_ultimo_pago: '2024-02-28',
      primera_deduccion: '2022-11-01',
      garantia: 'Vehículo 2020',
      fecha_culminacion_credito: '2025-10-01',
      cuotas_atrasadas: 0,
      deductora: { id: 3, nombre: 'BAC Credomatic' },
      lead: { id: 3, name: 'Carlos Sanchez', email: 'carlos.s@example.com' },
      reference: 'CR-2022-102', title: 'Prendario Vehículo', category: 'Prendario', progress: 100, lead_id: 3, assigned_to: 'Oficina', opened_at: '2022-10-15', description: 'Compra de vehículo usado', deductora_id: 3, linea: 'Vehículos', proceso: 'Cerrado', documento_id: 'DOC-003',
      numero_cuota: 0
    },
    {
      id: 4,
      numero_operacion: 'CR-2024-010',
      tipo_credito: 'personal',
      status: 'legal',
      monto_credito: 10000,
      saldo: 9800,
      cuota: 500,
      plazo: 24,
      tasa_anual: 12.0,
      divisa: 'EUR',
      fecha_ultimo_pago: '2023-12-15',
      primera_deduccion: '2024-01-15',
      garantia: 'Pagaré',
      fecha_culminacion_credito: '2026-01-15',
      cuotas_atrasadas: 4,
      deductora: { id: 1, nombre: 'CoopeAnde' },
      lead: { id: 4, name: 'Ana White', email: 'ana.white@example.com' },
      reference: 'CR-2024-010', title: 'Préstamo Personal Ana', category: 'Personal', progress: 15, lead_id: 4, assigned_to: 'Daniel Gómez', opened_at: '2023-12-01', description: 'Viaje a Europa', deductora_id: 1, linea: 'Personal', proceso: 'Cobro Judicial', documento_id: 'DOC-004',
      numero_cuota: 0
    },
    {
      id: 5,
      numero_operacion: 'CR-2024-088',
      tipo_credito: 'personal',
      status: 'activo',
      monto_credito: 5000,
      saldo: 4800,
      cuota: 200,
      plazo: 36,
      tasa_anual: 10.0,
      divisa: 'GBP',
      fecha_ultimo_pago: '2024-03-01',
      primera_deduccion: '2024-03-01',
      garantia: 'Fiduciaria',
      fecha_culminacion_credito: '2027-03-01',
      cuotas_atrasadas: 0,
      deductora: { id: 4, nombre: 'Davivienda' },
      lead: { id: 5, name: 'James Bond', email: 'j.bond@example.com' },
      reference: 'CR-2024-088', title: 'Préstamo Personal James', category: 'Personal', progress: 5, lead_id: 5, assigned_to: 'Ahixel Rojas', opened_at: '2024-02-15', description: 'Gastos personales', deductora_id: 4, linea: 'Personal', proceso: 'Normal', documento_id: 'DOC-005',
      numero_cuota: 0
    },
    {
      id: 6,
      numero_operacion: 'CR-2023-200',
      tipo_credito: 'hipotecario',
      status: 'activo',
      monto_credito: 75000000,
      saldo: 70000000,
      cuota: 650000,
      plazo: 300,
      tasa_anual: 8.5,
      divisa: 'CRC',
      fecha_ultimo_pago: '2024-03-05',
      garantia: 'Hipoteca',
      fecha_culminacion_credito: '2048-05-20',
      cuotas_atrasadas: 0,
      deductora: { id: 2, nombre: 'Banco Nacional' },
      lead: { id: 6, name: 'Elena Torres', email: 'elena.t@example.com' },
      reference: 'CR-2023-200', title: 'Hipoteca Casa Elena', category: 'Hipotecario', progress: 12, lead_id: 6, assigned_to: 'Wilmer Marquez', opened_at: '2023-04-20', description: 'Compra de vivienda', deductora_id: 2, linea: 'Vivienda', proceso: 'Normal', documento_id: 'DOC-006',
      numero_cuota: 0
    },
    {
      id: 7,
      numero_operacion: 'CR-2021-005',
      tipo_credito: 'personal',
      status: 'legal',
      monto_credito: 2000000,
      saldo: 1800000,
      cuota: 85000,
      plazo: 36,
      tasa_anual: 22.0,
      divisa: 'CRC',
      fecha_ultimo_pago: '2023-06-10',
      garantia: 'Pagaré',
      fecha_culminacion_credito: '2024-06-10',
      cuotas_atrasadas: 8,
      deductora: { id: 5, nombre: 'CoopeServidores' },
      lead: { id: 7, name: 'Mario Jimenez', email: 'mario.j@example.com' },
      reference: 'CR-2021-005', title: 'Préstamo Personal Mario', category: 'Personal', progress: 60, lead_id: 7, assigned_to: 'Carlos Mendez', opened_at: '2021-05-10', description: 'Reparaciones hogar', deductora_id: 5, linea: 'Personal', proceso: 'Cobro Judicial', documento_id: 'DOC-007',
      numero_cuota: 0
    },
    {
      id: 8,
      numero_operacion: 'CR-2024-012',
      tipo_credito: 'prendario',
      status: 'activo',
      monto_credito: 25000,
      saldo: 24000,
      cuota: 600,
      plazo: 60,
      tasa_anual: 9.0,
      divisa: 'USD',
      fecha_ultimo_pago: '2024-02-20',
      garantia: 'Vehículo 2023',
      fecha_culminacion_credito: '2029-02-20',
      cuotas_atrasadas: 0,
      deductora: { id: 3, nombre: 'BAC Credomatic' },
      lead: { id: 8, name: 'Sofia Castro', email: 'sofia.c@example.com' },
      reference: 'CR-2024-012', title: 'Prendario Vehículo Sofia', category: 'Prendario', progress: 5, lead_id: 8, assigned_to: 'Oficina', opened_at: '2024-01-20', description: 'Compra de vehículo nuevo', deductora_id: 3, linea: 'Vehículos', proceso: 'Normal', documento_id: 'DOC-008',
      numero_cuota: 0
    }
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
  { id: 'COUR01', name: 'Carlos Jimenez', vehicle: 'Motocicleta' },
  { id: 'COUR02', name: 'Luisa Fernandez', vehicle: 'Automóvil' },
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

export const OPPORTUNITY_STATUSES = ["Pendiente", "En seguimiento", "Analizada", "Perdida"] as const;

export const VERTICAL_OPTIONS = [
  "I.M.A.S", "C.N.P.", "A.N.E.P.", "P.A.N.I", "MUNICIPALIDAD DE TIBÁS", "MUNICIPALIDAD SAN JOSÉ", "C.C.S.S", 
  "PERSONA JOVEN", "CONAVI", "MUNICIPALIDAD DE GOICOECHEA", "CORONADO", "COSEVI", "UCR", "CEN-CINAI", "INA", 
  "I.C.E.", "MUNICIPALIDAD GRECIA", "I.A.F.A.", "I.C.O.D.E.R", "RECOPE", "MUNICIPALIDAD DE OREAMUNO", 
  "PODER JUDICIAL", "PENSIONADOS PODER JUDICIAL", "MUNICIPALIDAD DE MORAVIA", "O.T.M.", "ASAMBLEA LEGISLATIVA", 
  "CONTROL DE MIGRACIÓN Y EXTRANJERÍA", "DEFENSORÍA DE LOS HABITANTES", "DESARROLLO DE LA COMUNIDAD", 
  "DIRECCIÓN GENERAL DE SERVICIO CIVIL", "DIRECCIÓN NACIONAL DE PENSIONES", "IMPRENTA NACIONAL", 
  "MIN DE AGRICULTURA Y GANADERÍA", "MINISTERIO DE AMBIENTE Y ENERGÍA", "MIN DE CIENCIA TECNOLOGÍA Y TELECOMUNICACIONES", 
  "MIN DE COMERCIO EXTERIOR", "MIN DE CULT.JUV Y DEPORTES", "MIN DE GOBERNACIÓN Y POLICÍA", "MIN DE ECO.IND Y COMERCIO", 
  "MINISTERIO DE EDUACIÓN PÚBLICA", "MINISTERIO DE HACIENDA", "MINISTERIO DE JUSTICIA Y GRACIA", 
  "MINISTERIO DE LA PRESIDENCIA", "MINISTERIO DE OBRAS PUBL. Y TRANSPORTE", "MINISTERIO DE PLANIF.NAC Y POL.ECO", 
  "MINISTERIO DE RELACIONES EXTERIORES Y CULTO", "MINSTERIO DE SALUD", "MINISTERIO DE SEGURIDAD PÚBLICA", 
  "MINSITERIO DE TRAB. Y SEGUR. SOC", "MINISTERIO DE VIVIENDA Y ASENT.HUMANOS", "PRESIDENCIA DE LA REPÚBLICA", 
  "PROCURADURÍA GENERAL DE LA REPÚBLICA", "REGISTRO NACIONAL", "SERVICIO EXTERIOR", "TRIBUNAL DE SERVICIO CIVIL", 
  "TRIBUNAL SUPREMO DE ELECCIONES", "AYA", "ARCHIVO NACIONAL", "CN MUSICA", "CNE", "COOPEJOVO", "FANAL", 
  "FITOSANITARIO", "SENASA", "FONAFIFO", "ICD", "ICE EMERGENCIAS 911", "IFAM", "INDER (IDA)", "INVU", "SEC", 
  "TEATRO NACIONAL", "CNC", "GOBIERNO CENTRAL INTEGRA", "INTA", "JUNTA ADM. REGISTRO NACIONAL", "MINAE", "IMAS", 
  "ICE ENERGIA Y TELEC.", "AVIACION CIVIL", "MUNICIPALIDAD DE ALVARADO", "MUNICIPALIDAD DE ASERRI", 
  "MUNICIPALIDAD DE CORONADO", "MUNICIPALIDAD DE CORREDORES", "MUNICIPALIDAD DE DESAMPARADOS", "MUNICIPALIDAD DE MORA", 
  "MUNICIPALIDAD DE NARANJO", "MUNICIPALIDAD DE OROTINA", "MUNICIPALIDAD DE PALMARES", "MUNICIPALIDAD DE PARRITA", 
  "MUNICIPALIDAD DE PUNTARENAS", "MUNICIPALIDAD DE SAN MATEO", "MUNICIPALIDAD DE SAN PABLO", "MUNICIPALIDAD DE SAN VITO", 
  "MUSEO NACIONAL", "UCR UNIVERSIDAD DE COSTA RICA"
] as const;

export const OPPORTUNITY_TYPES = ["Personal (Diferentes usos)", "Refundición (Pagar deudas actuales)","Microcrédito (Hasta ₡690.000)","Descuento de facturas"] as const;

export const conversations: Conversation[] = [
  { id: 'CONV01', name: 'Ana Silva Rojas', avatarUrl: 'https://picsum.photos/seed/avatar1/40/40', caseId: 'CR-002', lastMessage: 'Entendido, ¿qué necesito para ponerme al día?', time: '10:15 AM', status: 'Abierto' },
  { id: 'CONV02', name: 'John Doe', avatarUrl: 'https://picsum.photos/seed/avatarJD/40/40', caseId: 'CR-001', lastMessage: 'Gracias por la información.', time: 'Ayer', status: 'Resuelto' },
];

export const chatMessages: ChatMessage[] = [
  { id: 'MSG01', conversationId: 'CR-002', senderType: 'agent', senderName: 'Wilmer Marquez', avatarUrl: 'https://picsum.photos/seed/staff2/40/40', text: 'Buenos días Sra. Ana, le escribimos para recordarle que su crédito presenta una mora de 25 días.', time: '10:05 AM' },
  { id: 'MSG02', conversationId: 'CR-002', senderType: 'client', senderName: 'Ana Silva Rojas', avatarUrl: 'https://picsum.photos/seed/avatar1/40/40', text: 'Hola, no estaba enterada. Pensé que el pago era automático.', time: '10:10 AM' },
  { id: 'MSG03', conversationId: 'CR-002', senderType: 'client', senderName: 'Ana Silva Rojas', avatarUrl: 'https://picsum.photos/seed/avatar1/40/40', text: 'Entendido, ¿qué necesito para ponerme al día?', time: '10:15 AM' },
];

export const internalNotes: InternalNote[] = [
  { id: 'NOTE01', conversationId: 'CR-002', senderName: 'Wilmer Marquez', avatarUrl: 'https://picsum.photos/seed/staff2/40/40', text: 'Cliente parece anuente a pagar. Ofrecerle un arreglo de pago si lo solicita.', time: '10:12 AM' },
  { id: 'NOTE02', conversationId: 'CR-001', senderName: 'Carlos Mendez', avatarUrl: 'https://picsum.photos/seed/staff1/40/40', text: 'Cliente consultó sobre adelanto de cuotas. Se le envió la información por correo.', time: 'Ayer' },
];

export const judicialNotifications: JudicialNotification[] = [
    { id: 'NOT001', expediente: '23-012345-1027-CA', acto: 'Notificación de demanda', fecha: '2023-11-20', status: 'Leída', asignadaA: 'Sistema' },
    { id: 'NOT002', expediente: '21-001234-1027-CA', acto: 'Prevención', fecha: '2023-11-21', status: 'Pendiente', asignadaA: 'Daniel Gómez' },
    { id: 'NOT003', expediente: '22-004567-1027-CA', acto: 'Resolución', fecha: '2023-11-19', status: 'Leída', asignadaA: 'Sistema' },
];
  
export const undefinedNotifications: UndefinedNotification[] = [
  { id: 'UNDEF001', subject: 'FW: Actualización de estado', receivedDate: '2023-11-22 14:30', assignedTo: 'Daniel Gómez' },
  { id: 'UNDEF002', subject: 'Consulta Urgente', receivedDate: '2023-11-22 15:00', assignedTo: 'Daniel Gómez' },
];

export const tasks: Task[] = [
  { id: 'TSK001', title: 'Resolver prevención en expediente 21-001234-1027-CA', caseId: 'CR-004', assignedTo: 'Daniel Gómez', dueDate: '2023-11-23', priority: 'Alta', status: 'Pendiente' },
  { id: 'TSK002', title: 'Contactar a Ana Silva para arreglo de pago', caseId: 'CR-002', assignedTo: 'Ahixel Rojas', dueDate: '2023-11-25', priority: 'Media', status: 'En Progreso' },
  { id: 'TSK003', title: 'Preparar documentos para nuevo crédito de Bruno Costa', caseId: 'OPP001', assignedTo: 'Daniel Gómez', dueDate: '2023-11-28', priority: 'Media', status: 'Pendiente' },
];

export const cases: Case[] = [
    {id: "23-015896-1027-CA", title: "Amparo de Legalidad vs. CCSS", clientName: "Juan Pérez", specialty: "Derecho Administrativo", status: "Presentado", assignedTo: "Lic. Daniel Gómez", lastUpdate: "2023-11-15", category: 'Contenciosa', opportunityLifecycle: 20},
    {id: "23-015897-1027-CA", title: "Amparo de Legalidad vs. MEP", clientName: "Maria Rodriguez", specialty: "Derecho Administrativo", status: "Con curso", assignedTo: "Lic. Wilmer Marquez", lastUpdate: "2023-11-14", category: 'Contenciosa', opportunityLifecycle: 40},
    {id: "23-015898-1027-CA", title: "Recurso de Amparo vs. CCSS", clientName: "Carlos Gómez", specialty: "Derecho Constitucional", status: "Rechazo de plano", assignedTo: "Lic. Carlos Mendez", lastUpdate: "2023-11-13", category: 'No Contenciosa', opportunityLifecycle: 10},
    {id: "23-015899-1027-CA", title: "Ejecución de Sentencia", clientName: "Ana Fernandez", specialty: "Derecho Administrativo", status: "Con lugar con costas", assignedTo: "Lic. Daniel Gómez", lastUpdate: "2023-11-12", category: 'Contenciosa', opportunityLifecycle: 80, amparoId: '21-001234-1027-CA'},
    {id: "23-015900-1027-CA", title: "Amparo por Silencio Positivo vs. MEP", clientName: "Luis Hernández", specialty: "Derecho Administrativo", status: "Sentencia", assignedTo: "Lic. Daniel Gómez", lastUpdate: "2023-11-10", category: 'Contenciosa', opportunityLifecycle: 100},
    {id: "23-015901-1027-CA", title: "Ejecución de Sentencia", clientName: "Sofía Torres", specialty: "Derecho Constitucional", status: "Con lugar sin costas", assignedTo: "Lic. Wilmer Marquez", lastUpdate: "2023-11-09", category: 'No Contenciosa', opportunityLifecycle: 90, amparoId: '20-005678-1027-CA'}
];

export const payments: Payment[] = [
    { id: 'PAY001',  cedula: 123456789, monto: 150000, source: 'Planilla' },
    { id: 'PAY002', cedula: 987654321, monto: 195000,  source: 'Planilla' },
    { id: 'PAY003', cedula: 456789123, monto: 60000, source: 'Planilla' },
    { id: 'PAY004', cedula: 789123456, monto: 50000, source: 'Ventanilla' },
    { id: 'PAY005', cedula: 321654987, monto: 70000,  source: 'Transferencia' },
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
  { id: 1, nombre: 'Banco Nacional de Costa Rica', fecha_reporte_pago: '2025-01-15', comision: 1.50 },
  { id: 2, nombre: 'Banco de Costa Rica', fecha_reporte_pago: '2025-01-20', comision: 1.75 },
  { id: 3, nombre: 'BAC Credomatic', fecha_reporte_pago: '2025-01-10', comision: 2.00 },
  { id: 4, nombre: 'Banco Popular', fecha_reporte_pago: '2025-01-25', comision: 1.25 },
  { id: 5, nombre: 'Scotiabank Costa Rica', fecha_reporte_pago: '2025-01-18', comision: 1.80 },
  { id: 6, nombre: 'Davivienda Costa Rica', fecha_reporte_pago: '2025-01-12', comision: 1.60 },
  { id: 7, nombre: 'CoopeAnde', fecha_reporte_pago: '2025-01-22', comision: 1.00 },
  { id: 8, nombre: 'CoopeAhorro', fecha_reporte_pago: '2025-01-28', comision: 0.75 },
  { id: 9, nombre: 'CoopeSoliDar R.L.', fecha_reporte_pago: '2025-01-14', comision: 1.20 },
  { id: 10, nombre: 'CoopeAlajuela R.L.', fecha_reporte_pago: '2025-01-16', comision: 1.10 },
  { id: 11, nombre: 'CoopeGranada R.L.', fecha_reporte_pago: '2025-01-30', comision: 0.90 },
  { id: 12, nombre: 'CoopeMepe R.L.', fecha_reporte_pago: '2025-01-08', comision: 1.30 },
  { id: 13, nombre: 'CoopeSur R.L.', fecha_reporte_pago: '2025-01-24', comision: 1.15 },
  { id: 14, nombre: 'CoopeCoco R.L.', fecha_reporte_pago: '2025-01-26', comision: 1.05 },
  { id: 15, nombre: 'Banco BCT', fecha_reporte_pago: '2025-01-19', comision: 1.85 },
];

export const salesVisits: SalesVisit[] = [
  { id: 'VIS001', institution: 'Ministerio de Educación Pública', salesperson: 'Carlos Mendez', date: '2023-11-20', status: 'Planificada' },
  { id: 'VIS002', institution: 'Caja Costarricense de Seguro Social', salesperson: 'Wilmer Marquez', date: '2023-11-22', status: 'Planificada' },
  { id: 'VIS003', institution: 'Poder Judicial', salesperson: 'Carlos Mendez', date: '2023-11-24', status: 'Planificada' },
];

export const salesGoals: SalesGoal[] = [
  { id: 'GOAL01', salespersonId: 'STF001', salespersonName: 'Carlos Mendez', salespersonAvatar: 'https://picsum.photos/seed/staff1/40/40', month: 'Noviembre 2023', goalAmount: 50000000, achievedAmount: 22000000 },
  { id: 'GOAL02', salespersonId: 'STF002', salespersonName: 'Wilmer Marquez', salespersonAvatar: 'https://picsum.photos/seed/staff2/40/40', month: 'Noviembre 2023', goalAmount: 40000000, achievedAmount: 31000000 },
];

// NOTE: Removed duplicate `volunteers` and `branches` definitions introduced by a merge.
// The canonical `volunteers` and `branches` exports are defined earlier in this file.
