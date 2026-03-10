# Sistema de Gestión de Tareas - Documentación Completa

## Índice
1. [Descripción General](#descripción-general)
2. [Arquitectura](#arquitectura)
3. [Base de Datos](#base-de-datos)
4. [API Endpoints](#api-endpoints)
5. [Frontend - Interfaz Principal](#frontend---interfaz-principal)
6. [Frontend - Vista de Detalle](#frontend---vista-de-detalle)
7. [Flujos de Usuario](#flujos-de-usuario)
8. [Permisos](#permisos)
9. [Características Especiales](#características-especiales)
10. [Integración con Otros Módulos](#integración-con-otros-módulos)

---

## Descripción General

El módulo de **Gestión de Tareas** permite administrar pendientes internos, asignarlos a colaboradores, establecer prioridades y fechas, y hacer seguimiento del progreso. Está diseñado para integrarse con el sistema CRM de oportunidades y permitir la planificación de trabajo por hitos.

### Propósito
- Dar seguimiento a pendientes internos y externos
- Reasignar tareas según prioridad y responsable
- Vincular tareas con oportunidades del CRM
- Organizar trabajo por hitos del proceso legal
- Exportar reportes y visualizar calendarios

### Ubicación
- **Ruta principal**: `/dashboard/tareas`
- **Ruta de detalle**: `/dashboard/tareas/[id]`

---

## Arquitectura

### Stack Tecnológico

**Backend:**
- Laravel 10+ (PHP)
- MySQL/PostgreSQL
- API RESTful

**Frontend:**
- Next.js 14+ (App Router)
- TypeScript
- React 18+
- TailwindCSS
- shadcn/ui components
- jsPDF (exportación PDF)
- autoTable (tablas en PDF)

### Estructura de Archivos

```
proyecto/
├── backend/
│   ├── app/
│   │   ├── Http/
│   │   │   └── Controllers/
│   │   │       └── Api/
│   │   │           └── TaskController.php
│   │   ├── Models/
│   │   │   └── Task.php
│   │   └── Resources/
│   │       └── TaskResource.php
│   └── database/
│       └── migrations/
│           └── 2025_11_18_000000_create_tasks_table.php
│
└── src/
    ├── app/
    │   └── dashboard/
    │       └── tareas/
    │           ├── page.tsx              # Listado principal
    │           └── [id]/
    │               └── page.tsx          # Vista de detalle
    └── lib/
        ├── milestones.ts                 # Hitos del proceso
        └── permissions.ts                # Sistema de permisos
```

---

## Base de Datos

### Tabla: `tasks`

```sql
CREATE TABLE tasks (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  project_code VARCHAR(255) NULL,           -- Referencia a oportunidad (ej: "25-12345-CO")
  project_name VARCHAR(255) NULL,           -- Hito del proceso legal
  title VARCHAR(255) NOT NULL,              -- Título de la tarea
  details TEXT NULL,                        -- Descripción detallada
  status ENUM('pendiente', 'en_progreso', 'completada', 'archivada', 'deleted') DEFAULT 'pendiente',
  priority ENUM('alta', 'media', 'baja') DEFAULT 'media',
  assigned_to BIGINT UNSIGNED NULL,         -- FK a users.id
  start_date DATE NULL,                     -- Fecha de inicio planificada
  due_date DATE NULL,                       -- Fecha de vencimiento
  archived_at TIMESTAMP NULL,               -- Timestamp de archivado
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_project_code (project_code),
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);
```

### Campos Importantes

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | BIGINT | ID único autoincrementable |
| `project_code` | VARCHAR | Código de oportunidad vinculada (ej: "25-12345-CO") |
| `project_name` | VARCHAR | Hito del proceso (amparo, ejecutoria, ejecución, cobro, sin_hito) |
| `title` | VARCHAR | Título descriptivo de la tarea |
| `details` | TEXT | Descripción detallada, notas adicionales |
| `status` | ENUM | Estado actual: pendiente, en_progreso, completada, archivada, deleted |
| `priority` | ENUM | Prioridad: alta, media, baja |
| `assigned_to` | BIGINT | ID del colaborador asignado |
| `start_date` | DATE | Fecha planificada de inicio |
| `due_date` | DATE | Fecha límite de entrega |
| `archived_at` | TIMESTAMP | Marca temporal de archivado/eliminación |

### Relaciones
- **BelongsTo User** (assignee): Una tarea pertenece a un colaborador asignado

---

## API Endpoints

### Base URL
```
{API_BASE_URL}/tareas
```

### 1. Listar Tareas
**Endpoint**: `GET /tareas`

**Query Parameters**:
```typescript
{
  with_archived?: 0 | 1          // Incluir archivadas
  with_deleted?: 0 | 1           // Incluir eliminadas
  status?: string                // Filtrar por estado
  project_code?: string          // Filtrar por código de proyecto
  search?: string                // Búsqueda de texto
  per_page?: number              // Paginación (default: 25)
}
```

**Response**:
```json
{
  "data": [
    {
      "id": 1,
      "project_code": "25-12345-CO",
      "project_name": "amparo",
      "title": "Revisar el pago",
      "details": "Crear plantillas transaccionales y configurar...",
      "status": "pendiente",
      "priority": "media",
      "assigned_to": 4,
      "assignee": {
        "id": 4,
        "name": "Administrador DSF",
        "email": "admin@pep.cr"
      },
      "start_date": "2025-11-29",
      "due_date": "2025-12-06",
      "archived_at": null,
      "created_at": "2025-11-29T00:00:00.000000Z",
      "updated_at": "2025-12-01T00:00:00.000000Z"
    }
  ],
  "links": { ... },
  "meta": { ... }
}
```

### 2. Crear Tarea
**Endpoint**: `POST /tareas`

**Request Body**:
```json
{
  "project_code": "25-12345-CO",  // Opcional
  "project_name": "amparo",       // Opcional (hito)
  "title": "Título de la tarea",
  "details": "Descripción detallada",
  "status": "pendiente",          // Opcional (default: pendiente)
  "priority": "media",            // Opcional (default: media)
  "assigned_to": 4,               // Opcional
  "start_date": "2025-11-29",     // Opcional
  "due_date": "2025-12-06"        // Opcional
}
```

**Response**: `201 Created`
```json
{
  "data": { /* Tarea creada */ }
}
```

### 3. Obtener Detalle de Tarea
**Endpoint**: `GET /tareas/{id}`

**Response**: `200 OK`
```json
{
  "data": { /* Detalles completos de la tarea */ }
}
```

### 4. Actualizar Tarea
**Endpoint**: `PUT /tareas/{id}`

**Request Body**: (todos los campos opcionales)
```json
{
  "project_code": "25-12345-CO",
  "project_name": "ejecutoria",
  "title": "Nuevo título",
  "details": "Nueva descripción",
  "status": "en_progreso",
  "priority": "alta",
  "assigned_to": 5,
  "start_date": "2025-12-01",
  "due_date": "2025-12-15"
}
```

**Response**: `200 OK`
```json
{
  "data": { /* Tarea actualizada */ }
}
```

### 5. Eliminar Tarea (Soft Delete)
**Endpoint**: `DELETE /tareas/{id}`

**Permisos requeridos**: `tasks.delete`

**Comportamiento**:
- No elimina físicamente el registro
- Cambia `status` a `"deleted"`
- Establece `archived_at` a la fecha/hora actual

**Response**: `204 No Content`

### 6. Archivar Tarea
**Endpoint**: `POST /tareas/{id}/archivar`

**Comportamiento**:
- Cambia `status` a `"archivada"`
- Establece `archived_at` a la fecha/hora actual

**Response**: `200 OK`
```json
{
  "data": { /* Tarea archivada */ }
}
```

### 7. Restaurar Tarea
**Endpoint**: `POST /tareas/{id}/restaurar`

**Comportamiento**:
- Cambia `status` a `"en_progreso"`
- Limpia `archived_at` (NULL)

**Response**: `200 OK`
```json
{
  "data": { /* Tarea restaurada */ }
}
```

### Validaciones del Backend

```php
[
  'project_code' => 'nullable|string|max:50',
  'project_name' => 'nullable|string|max:255',
  'title' => 'required|string|max:255',          // Requerido en POST
  'details' => 'nullable|string',
  'status' => 'string|in:pendiente,en_progreso,completada,archivada,deleted',
  'priority' => 'string|in:alta,media,baja',
  'assigned_to' => 'nullable|integer|exists:users,id',
  'start_date' => 'nullable|date',
  'due_date' => 'nullable|date|after_or_equal:start_date'
]
```

---

## Frontend - Interfaz Principal

### Ubicación
`src/app/dashboard/tareas/page.tsx`

### Componentes Principales

#### 1. Modos de Vista

**A) Vista de Lista** (default)
- Tabla responsiva con columnas ordenables
- Tarjetas en móvil
- Filtros colapsables

**B) Vista de Calendario**
- Calendario mensual con indicadores de tareas
- Timeline de tareas por fecha
- Panel lateral con tareas del día seleccionado
- Sección de tareas sin fecha programada

#### 2. Sistema de Filtros

**Filtros disponibles**:
```typescript
interface TaskTableFilters {
  search: string;              // Búsqueda de texto libre
  status: "todos" | TaskStatus;
  priority: "todas" | TaskPriority;
  milestone: string;           // Filtro por hito
  assignee: string;            // Filtro por responsable
  dueFrom: string;             // Fecha desde (formato: YYYY-MM-DD)
  dueTo: string;               // Fecha hasta (formato: YYYY-MM-DD)
}
```

**Campos de búsqueda**:
- Referencia de tarea (TA-0001)
- Título
- Detalles
- Código de proyecto
- Nombre del responsable
- Email del responsable
- Etiqueta del hito

#### 3. Ordenamiento de Columnas

**Columnas ordenables**:
- Referencia (ID)
- Título
- Responsable
- Prioridad
- Estado
- Hito
- Fecha de vencimiento
- Fecha de última actualización

**Modo de ordenamiento**:
- Click en encabezado cambia entre: sin orden → ascendente → descendente
- Indicador visual del estado de ordenamiento

#### 4. Exportación de Datos

**Formatos disponibles**:

**A) CSV**
```
Referencia,Título,Proyecto,Hito,Responsable,Prioridad,Estado,Inicio,Vencimiento,Actualizada
TA-0007,tarea2,25-12345-0007-CO,Sin hito,Administrador DSF,media,pendiente,,,2025-11-29
```

**B) PDF**
- Orientación horizontal
- Tabla con todas las columnas
- Estilo profesional con encabezados azules
- Nombre del archivo: `tareas_{timestamp}.pdf`

#### 5. Estados de Tarea

```typescript
type TaskStatus = "pendiente" | "en_progreso" | "completada" | "archivada" | "deleted";

const STATUS_LABELS = {
  pendiente: "Pendiente",
  en_progreso: "En progreso",
  completada: "Completada",
  archivada: "Archivada",
  deleted: "Eliminada"
};

const STATUS_BADGE_VARIANT = {
  pendiente: "outline",
  en_progreso: "default",
  completada: "secondary",
  archivada: "destructive",
  deleted: "destructive"
};
```

**Lógica de tareas atrasadas**:
```typescript
// Una tarea se marca como ATRASADA si:
// - Tiene fecha de vencimiento
// - NO está completada
// - La fecha de vencimiento es anterior a hoy
```

#### 6. Prioridades

```typescript
type TaskPriority = "alta" | "media" | "baja";

const PRIORITY_OPTIONS = [
  { value: "alta", label: "Alta" },
  { value: "media", label: "Media" },
  { value: "baja", label: "Baja" }
];

const PRIORITY_BADGE_VARIANT = {
  alta: "destructive",    // Rojo
  media: "default",       // Azul
  baja: "secondary"       // Gris
};

const PRIORITY_PILL_CLASSES = {
  alta: "border-rose-500/70 bg-rose-500/10 text-rose-600",
  media: "border-amber-500/70 bg-amber-500/10 text-amber-600",
  baja: "border-emerald-500/70 bg-emerald-500/10 text-emerald-600"
};
```

#### 7. Hitos del Proceso

```typescript
const MILESTONE_OPTIONS = [
  { value: "sin_hito", label: "Sin hito" },
  { value: "amparo", label: "Amparo" },
  { value: "ejecutoria", label: "Ejecutoria" },
  { value: "ejecucion", label: "Ejecución" },
  { value: "cobro", label: "Cobro" }
];
```

#### 8. Diálogo de Creación/Edición

**Campos del formulario**:
```typescript
interface TaskFormValues {
  opportunityId: string;        // ID de oportunidad o "__manual__"
  projectCode: string;          // Auto-generado desde oportunidad
  title: string;                // Requerido
  details: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo: number | null;
  startDate: string;            // YYYY-MM-DD
  dueDate: string;              // YYYY-MM-DD
  milestone: MilestoneValue;
}
```

**Validaciones frontend**:
- Título es obligatorio
- Si hay fecha de vencimiento y fecha de inicio, la fecha de vencimiento debe ser igual o posterior

**Lógica de vinculación con oportunidades**:
- Selector de oportunidades carga desde `/opportunities`
- Al seleccionar una oportunidad, el `project_code` se asigna automáticamente
- Opción "Sin oportunidad vinculada" permite tareas independientes

#### 9. Menú de Acciones

**Por tarea**:
- Ver detalles (link a `/dashboard/tareas/{id}`)
- Editar tarea (abre diálogo de edición)
- Eliminar tarea (requiere permiso `tasks.delete`)

#### 10. Vista de Calendario

**Estructura**:
```
[Calendario]                    [Timeline]
- Navegación mes anterior/siguiente
- Grid 7x6 de días              - Lista de tareas agrupadas por fecha
- Indicador visual de tareas    - Incluye sección "Sin fecha definida"
- Selección de día              - Detalles de cada tarea
                                - Botones de acción
[Panel de detalle del día]
- Hasta 3 tareas visibles
- Indicador de tareas adicionales
```

**Características**:
- Lunes como primer día de la semana
- Indicador visual (punto) en días con tareas
- Resaltado del día actual
- Navegación entre meses
- Filtros aplicables a vista de calendario

---

## Frontend - Vista de Detalle

### Ubicación
`src/app/dashboard/tareas/[id]/page.tsx`

### Layout

```
[Botón regresar]                    [Botón actualizar]

+----------------------------------+  +----------------------+
|  [Resumen] [Seguimiento]        |  | [Comunicaciones]     |
|                                  |  | [Archivos]           |
|  +----------------------------+  |  |                      |
|  | TA-0007                    |  |  | [Panel lateral]      |
|  | 25-12345-0007-CO          |  |  |                      |
|  | tarea2                     |  |  |                      |
|  |                            |  |  |                      |
|  | [Pendiente][En progreso]  |  |  |                      |
|  | [Completada][Archivada]   |  |  |                      |
|  +----------------------------+  |  |                      |
|                                  |  |                      |
|  [Detalles de la tarea]         |  |                      |
|  [Asignación y prioridad]       |  |                      |
|  [Descripción editable]         |  |                      |
+----------------------------------+  +----------------------+
```

### Tabs Principales

#### 1. Tab "Resumen"

**Sección: Información general**
- Referencia de tarea (TA-XXXX)
- Código de proyecto con link a oportunidad
- Título de la tarea
- Botones de cambio rápido de estado

**Sección: Detalles**
- Responsable (nombre y email)
- ID del responsable
- Estado actual (badge)
- Prioridad (badge)
- Fecha de inicio
- Fecha de vencimiento
- Fecha de creación
- Última actualización
- Fecha de archivado (si aplica)

**Sección: Asignación y prioridad**
- Selector de responsable (deshabilitado, se gestiona desde CRM)
- Selector de prioridad (deshabilitado, fijo desde oportunidad)
- Selector de hito (habilitado, actualizable)

**Sección: Descripción**
- Textarea editable
- Indicador de guardado
- Botón "Guardar descripción"
- Solo se guarda si hay cambios

#### 2. Tab "Seguimiento"

**Timeline de eventos**:
```typescript
[
  { label: "Creada", value: "29 nov 2025, 00:00", helper: "Registro inicial" },
  { label: "Inicio planificado", value: "6 dic 2025" },
  { label: "Vencimiento", value: "13 dic 2025" },
  { label: "Última actualización", value: "1 dic 2025, 14:30" },
  { label: "Archivada", value: "...", helper: "Esta tarea está fuera del tablero activo" }
]
```

### Panel Lateral

#### 1. Tab "Comunicaciones"
- Componente `<CaseChat />` reutilizado
- ID de conversación: `TASK-{taskId}`
- Permite mensajería interna sobre la tarea

#### 2. Tab "Archivos"
- Lista de archivos adjuntos (mockup actualmente)
- Botones "Ver" y "Descargar"
- Metadatos: nombre, categoría, tamaño, estado, fecha

### Funcionalidades

#### Actualización de Estado
- Botones de cambio rápido en header
- PUT a `/tareas/{id}` con `{ status: "nuevo_estado" }`
- Sincronización automática de `archived_at`
- Recarga de datos tras actualizar

#### Actualización de Hito
- Select en sección de asignación
- PUT a `/tareas/{id}` con `{ project_name: "hito" }`
- Indicador de carga durante actualización

#### Edición de Descripción
- Textarea con debounce implícito
- Detección de cambios (dirty state)
- Botón "Guardar" habilitado solo si hay cambios
- PUT a `/tareas/{id}` con `{ details: "..." }`

#### Navegación a Oportunidad
- Si `project_code` tiene formato `XX-NNNNN-XXXX`
- Extrae el número y genera link a `/dashboard/deals/{id}`

---

## Flujos de Usuario

### 1. Crear Nueva Tarea

```
Usuario → Click "Agregar tarea"
        → Se abre diálogo modal
        → Completa formulario:
            - Título (obligatorio)
            - Oportunidad (opcional, auto-completa project_code)
            - Hito (opcional)
            - Responsable (opcional)
            - Estado (default: pendiente)
            - Prioridad (default: media)
            - Fechas (opcionales, con validación)
            - Descripción (opcional)
        → Click "Crear tarea"
        → POST /tareas
        → Cierra diálogo
        → Recarga lista
        → Toast de confirmación
```

### 2. Filtrar y Buscar Tareas

```
Usuario → Abre filtros
        → Ingresa criterios:
            - Texto de búsqueda
            - Estado
            - Prioridad
            - Hito
            - Responsable
            - Rango de fechas
        → Filtrado en tiempo real (client-side)
        → Puede ordenar por columna
        → Puede exportar resultados filtrados
        → Click "Limpiar filtros" para resetear
```

### 3. Editar Tarea Existente

```
Usuario → Click en menú de acciones (...)
        → Click "Editar tarea"
        → Se abre diálogo con datos pre-cargados
        → Modifica campos
        → Click "Guardar cambios"
        → PUT /tareas/{id}
        → Cierra diálogo
        → Recarga lista
        → Toast de confirmación
```

### 4. Ver Detalle y Actualizar Estado

```
Usuario → Click en título de tarea (link)
        → Navega a /dashboard/tareas/{id}
        → Ve toda la información
        → Click en botón de estado (Pendiente/En progreso/Completada/Archivada)
        → PUT /tareas/{id} con nuevo estado
        → Recarga automática de datos
        → Toast de confirmación
```

### 5. Cambiar Hito de una Tarea

```
Usuario → En vista de detalle
        → Tab "Resumen"
        → Sección "Asignación y prioridad"
        → Abre selector de hito
        → Selecciona nuevo hito
        → PUT /tareas/{id} con { project_name: "hito" }
        → Recarga automática
        → Toast de confirmación
```

### 6. Editar Descripción

```
Usuario → En vista de detalle
        → Tab "Resumen"
        → Sección "Descripción"
        → Edita texto en textarea
        → Botón "Guardar descripción" se habilita
        → Click en botón
        → PUT /tareas/{id} con { details: "..." }
        → Indicador de guardado
        → Toast de confirmación
```

### 7. Eliminar Tarea

```
Usuario → Click en menú de acciones (...)
        → Click "Eliminar tarea" (solo si tiene permiso tasks.delete)
        → Se abre diálogo de confirmación
        → Click "Eliminar"
        → DELETE /tareas/{id}
        → Tarea se marca como "deleted" (soft delete)
        → Recarga lista
        → Toast de confirmación
```

### 8. Archivar/Restaurar Tarea

```
[Archivar]
Usuario → Cambia estado a "Archivada"
        → POST /tareas/{id}/archivar
        → Tarea sale del tablero activo
        → archived_at se establece

[Restaurar]
Usuario → Filtra por estado "Archivada"
        → Cambia estado a otro (ej: En progreso)
        → POST /tareas/{id}/restaurar
        → Tarea vuelve al tablero activo
        → archived_at se limpia
```

### 9. Exportar Listado

```
Usuario → Aplica filtros deseados (opcional)
        → Click en botón "Exportar"
        → Selecciona formato:
            - "Descargar CSV" → genera CSV con datos filtrados
            - "Descargar PDF" → genera PDF con tabla formateada
        → Descarga automática del archivo
```

### 10. Vista de Calendario

```
Usuario → Click en botón "Calendario"
        → Ve calendario mensual
        → Días con tareas tienen indicador visual
        → Click en un día
        → Panel derecho muestra tareas de ese día
        → Timeline muestra todas las tareas ordenadas por fecha
        → Puede navegar entre meses
        → Puede aplicar filtros
        → Puede editar tareas desde esta vista
```

---

## Permisos

### Sistema de Permisos

```typescript
// Permisos relacionados con tareas
const taskPermissions = [
  "tasks.view",      // Ver el tablero de tareas
  "tasks.create",    // Crear nuevas tareas
  "tasks.edit",      // Editar tareas existentes
  "tasks.delete"     // Eliminar/archivar tareas
];
```

### Verificación de Permisos

**En el frontend**:
```typescript
const canDeleteTasks = userHasPermission(user, "tasks.delete");

// Mostrar botón solo si tiene permiso
{canDeleteTasks && (
  <Button onClick={() => confirmDeleteTask(task)}>
    Eliminar tarea
  </Button>
)}
```

**En el backend**:
```php
public function destroy(Request $request, Task $task)
{
    $user = $request->user();

    if (!$user || !$user->hasPermission('tasks.delete')) {
        abort(403, 'No tienes permiso para eliminar tareas.');
    }

    $task->update([
        'status' => 'deleted',
        'archived_at' => Carbon::now()
    ]);

    return response()->noContent();
}
```

### Permisos Adicionales

```typescript
"lists.export"      // Permite exportar a CSV/PDF (usado en exportación)
```

---

## Características Especiales

### 1. Formato de Referencia de Tarea

```typescript
// Formato: TA-XXXX (4 dígitos con padding)
TA-0001
TA-0007
TA-0123
TA-9999

// Función de formato
const formatTaskReference = (id: number) => {
  return `TA-${String(id).padStart(4, "0")}`;
};
```

### 2. Vinculación con Oportunidades

**Formato de project_code**:
```
{año}-{id_oportunidad}-{referencia_interna}
25-12345-0007-CO
```

**Extracción de ID de oportunidad**:
```typescript
// Regex: /-(\d+)-[A-Z]+$/
const match = projectCode.match(/-(\d+)-[A-Z]+$/);
if (match) {
  const opportunityId = Number(match[1]);
  // Link a /dashboard/deals/{opportunityId}
}
```

### 3. Detección de Tareas Atrasadas

```typescript
const isTaskOverdue = (task: TaskItem) => {
  // Si no tiene fecha de vencimiento, no está atrasada
  if (!task.due_date) return false;

  // Si ya está completada, no se marca como atrasada
  if (task.status === "completada") return false;

  // Comparar fecha de vencimiento con hoy
  const dueDate = new Date(task.due_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return dueDate < today;
};

// Badge especial para tareas atrasadas
if (isTaskOverdue(task)) {
  return {
    variant: "destructive",
    label: "ATRASADA",
    className: "bg-destructive text-white"
  };
}
```

### 4. Sincronización de Estado de Archivado

**En el backend** (automático via model observer):
```php
static::saving(function (Task $task) {
    // Si el estado es archivada o deleted, establecer archived_at
    if (in_array($task->status, ['archivada', 'deleted'], true)) {
        $task->archived_at = $task->archived_at ?? Carbon::now();
    }

    // Si el estado NO es archivada o deleted, limpiar archived_at
    if (!in_array($task->status, ['archivada', 'deleted'], true)) {
        $task->archived_at = null;
    }
});
```

### 5. Ordenamiento Personalizado

```typescript
// Por número (ID, fechas)
if (typeof aValue === "number" && typeof bValue === "number") {
  return (aValue - bValue) * multiplier;
}

// Por texto (título, responsable, hito)
return String(aValue ?? "").localeCompare(String(bValue ?? "")) * multiplier;
```

### 6. Calendario Dinámico

**Generación de matriz de calendario**:
```typescript
// Genera matriz de 6 semanas x 7 días
// Lunes como primer día
const buildCalendarMatrix = (referenceDate: Date) => {
  const startOfMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const firstWeekStart = new Date(startOfMonth);
  const weekdayIndex = (startOfMonth.getDay() + 6) % 7; // Lunes = 0
  firstWeekStart.setDate(firstWeekStart.getDate() - weekdayIndex);

  // Genera 6 semanas de 7 días cada una
  // ...
};
```

**Agrupación de tareas por fecha**:
```typescript
const tasksByDate = visibleTasks.reduce((acc, task) => {
  const key = task.due_date
    ? formatDateKeyFromDate(new Date(task.due_date))
    : "__unscheduled__";

  if (!acc[key]) acc[key] = [];
  acc[key].push(task);

  return acc;
}, {});
```

### 7. Exportación Inteligente

**Solo exporta tareas visibles** (respeta filtros):
```typescript
const handleExportCSV = () => {
  // visibleTasks ya contiene el resultado de todos los filtros
  const rows = visibleTasks.map(task => [
    formatTaskReference(task.id),
    task.title,
    task.project_code ?? "",
    getMilestoneLabel(task.milestone),
    task.assignee?.name ?? "Sin asignar",
    task.priority,
    task.status,
    task.start_date ?? "",
    task.due_date ?? "",
    task.updated_at ?? ""
  ]);

  // Genera CSV...
};
```

### 8. Formateo de Fechas Localizado

```typescript
// Formato estándar: "6 dic 2025"
const DATE_FORMATTER = new Intl.DateTimeFormat("es-CR", {
  dateStyle: "medium"
});

// Formato de mes: "diciembre de 2025"
const MONTH_FORMATTER = new Intl.DateTimeFormat("es-CR", {
  month: "long",
  year: "numeric"
});

// Formato completo: "lunes, 06 de diciembre"
const TIMELINE_FULL_FORMATTER = new Intl.DateTimeFormat("es-CR", {
  weekday: "long",
  day: "2-digit",
  month: "long"
});
```

### 9. Gestión de Colaboradores

**Carga de colaboradores**:
```typescript
// GET /colaboradores
const collaborators = [
  { id: 1, name: "Juan Pérez", email: "juan@example.com" },
  { id: 2, name: "María González", email: "maria@example.com" }
];

// Select con opción "Sin asignar"
<Select>
  <SelectItem value="__none__">Sin asignar</SelectItem>
  {collaborators.map(c => (
    <SelectItem key={c.id} value={String(c.id)}>
      {c.name}
    </SelectItem>
  ))}
</Select>
```

### 10. Estados Especiales

**Estado "deleted"**:
- No se muestra por defecto en filtros
- Solo visible si se selecciona explícitamente en filtro de estado
- Marcado visualmente como "destructive"
- No se puede restaurar directamente (requiere cambio manual de estado)

**Estado "archivada"**:
- Se oculta por defecto a menos que se incluya `with_archived=1`
- Tiene funciones dedicadas de archivado/restauración
- Marcado visualmente con badge destructive

---

## Integración con Otros Módulos

### 1. Integración con CRM - Oportunidades

**Endpoint**: `GET /opportunities`

**Uso**:
- Cargar lista de oportunidades en selector
- Obtener `reference` (project_code)
- Obtener nombre del lead asociado
- Generar links a vista de detalle de oportunidad

**Ejemplo**:
```typescript
const opportunities = [
  {
    id: 12345,
    reference: "25-12345-0007-CO",
    lead: {
      nombre_completo: "Juan Pérez"
    },
    status: "active"
  }
];
```

### 2. Integración con Colaboradores

**Endpoint**: `GET /colaboradores`

**Uso**:
- Listar colaboradores en selector de asignación
- Mostrar nombre y email del responsable
- Filtrar tareas por colaborador

### 3. Integración con Sistema de Chat

**Componente**: `<CaseChat />`

**Uso**:
```typescript
<CaseChat conversationId={`TASK-${taskId}`} />
```

- Permite comunicación sobre la tarea
- Historial de mensajes
- Notificaciones en tiempo real (si está implementado)

### 4. Integración con Sistema de Archivos (Futuro)

**Estructura prevista**:
```typescript
interface TaskFile {
  id: string;
  label: string;
  fileName: string;
  category: string;
  uploadedAt: string;
  status: string;
  size: string;
  url: string;
}
```

**Funcionalidades futuras**:
- Subir archivos adjuntos a tareas
- Descargar evidencias
- Organizar por categorías

### 5. Integración con Sistema de Permisos

**Verificación en cada acción**:
```typescript
// En listado
const canExportLists = userHasPermission(user, "lists.export");
const canDeleteTasks = userHasPermission(user, "tasks.delete");

// En formularios
const canEditTasks = userHasPermission(user, "tasks.edit");
const canCreateTasks = userHasPermission(user, "tasks.create");
```

---

## Notas de Implementación

### Estado Actual vs. Futuro

**Implementado**:
- ✅ CRUD completo de tareas
- ✅ Sistema de filtros y búsqueda
- ✅ Vista de lista y calendario
- ✅ Exportación a CSV y PDF
- ✅ Vinculación con oportunidades
- ✅ Sistema de hitos
- ✅ Gestión de prioridades y estados
- ✅ Detección de tareas atrasadas
- ✅ Integración con chat

**Pendiente/Mock**:
- ⚠️ Sistema de archivos adjuntos (mockup en UI)
- ⚠️ Notificaciones automáticas de tareas próximas a vencer
- ⚠️ Dashboard de métricas de tareas
- ⚠️ Asignación masiva de tareas
- ⚠️ Plantillas de tareas recurrentes

### Consideraciones de Migración

Al importar este sistema a otro repositorio, asegúrate de:

1. **Base de datos**:
   - Ejecutar migración de tabla `tasks`
   - Verificar relación con tabla `users`
   - Índice en `project_code` para rendimiento

2. **Backend**:
   - Controlador `TaskController.php`
   - Modelo `Task.php`
   - Recurso `TaskResource.php`
   - Rutas en `api.php`

3. **Frontend**:
   - Componentes de UI de shadcn/ui
   - Librerías: jsPDF, autoTable
   - Sistema de permisos
   - Sistema de autenticación (AuthGuard)

4. **Variables de entorno**:
   - `API_BASE_URL`: URL base del backend
   - Configurar CORS si frontend y backend están en dominios diferentes

5. **Dependencias npm**:
   ```json
   {
     "dependencies": {
       "jspdf": "^2.x.x",
       "jspdf-autotable": "^3.x.x",
       "lucide-react": "^0.x.x"
     }
   }
   ```

6. **Permisos**:
   - Configurar roles con permisos apropiados
   - Verificar que usuarios tengan permisos asignados

---

## Ejemplos de Uso

### Crear una tarea vinculada a oportunidad

```bash
POST /api/tareas
{
  "project_code": "25-12345-0007-CO",
  "project_name": "amparo",
  "title": "Revisar documentación del cliente",
  "details": "Validar que todos los documentos estén completos",
  "priority": "alta",
  "assigned_to": 4,
  "start_date": "2025-12-01",
  "due_date": "2025-12-05"
}
```

### Buscar tareas de un colaborador específico

```typescript
// En el frontend
setFilters({
  ...filters,
  assignee: "4"  // ID del colaborador
});

// O directamente en la API
GET /api/tareas?assigned_to=4
```

### Listar todas las tareas atrasadas

```typescript
// Filtrado client-side
const overdueTasks = tasks.filter(task => isTaskOverdue(task));
```

### Obtener tareas de un hito específico

```typescript
// En el frontend
setFilters({
  ...filters,
  milestone: "amparo"
});

// O directamente en la API
GET /api/tareas?project_name=amparo
```

---

## Glosario

- **Tarea**: Pendiente interno o actividad asignable
- **Hito**: Etapa del proceso legal (amparo, ejecutoria, ejecución, cobro)
- **Oportunidad**: Caso o expediente en el CRM
- **project_code**: Código de referencia de la oportunidad vinculada
- **project_name**: Nombre del hito del proceso
- **Colaborador**: Usuario del sistema que puede ser asignado a tareas
- **Soft delete**: Eliminación lógica (marca como deleted, no elimina físicamente)
- **Archivado**: Estado que oculta la tarea del tablero activo

---

## Contacto y Soporte

Para dudas sobre la implementación o problemas al migrar este sistema, consulta:
- Documentación de la API en `/api/documentation`
- Repositorio del proyecto
- Equipo de desarrollo

---

**Versión del documento**: 1.0
**Última actualización**: 2026-02-03
**Autor**: Generado automáticamente desde análisis del código fuente
