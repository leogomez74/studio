# Prompt de Importación - Sistema de Gestión de Tareas

## Resumen Ejecutivo

Sistema completo de gestión de tareas con vinculación a CRM, vista de calendario, exportación de reportes y sistema de permisos granular.

**URL**: `/dashboard/tareas`

**Stack**: Laravel (Backend) + Next.js 14 (Frontend) + TypeScript + TailwindCSS

---

## Base de Datos

```sql
CREATE TABLE tasks (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  project_code VARCHAR(255) NULL,
  project_name VARCHAR(255) NULL,
  title VARCHAR(255) NOT NULL,
  details TEXT NULL,
  status ENUM('pendiente', 'en_progreso', 'completada', 'archivada', 'deleted') DEFAULT 'pendiente',
  priority ENUM('alta', 'media', 'baja') DEFAULT 'media',
  assigned_to BIGINT UNSIGNED NULL,
  start_date DATE NULL,
  due_date DATE NULL,
  archived_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_project_code (project_code),
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);
```

---

## API Endpoints (Backend Laravel)

### Rutas
```php
Route::get('/tareas', [TaskController::class, 'index']);
Route::post('/tareas', [TaskController::class, 'store']);
Route::get('/tareas/{task}', [TaskController::class, 'show']);
Route::put('/tareas/{task}', [TaskController::class, 'update']);
Route::delete('/tareas/{task}', [TaskController::class, 'destroy']); // Requiere permiso tasks.delete
Route::post('/tareas/{task}/archivar', [TaskController::class, 'archive']);
Route::post('/tareas/{task}/restaurar', [TaskController::class, 'restore']);
```

### Modelo (Task.php)
```php
protected $fillable = [
    'project_code', 'project_name', 'title', 'details',
    'status', 'priority', 'assigned_to',
    'start_date', 'due_date', 'archived_at'
];

protected $casts = [
    'start_date' => 'date',
    'due_date' => 'date',
    'archived_at' => 'datetime'
];

public function assignee(): BelongsTo {
    return $this->belongsTo(User::class, 'assigned_to');
}

// Auto-gestión de archived_at basado en status
protected static function booted() {
    static::saving(function (Task $task) {
        if (in_array($task->status, ['archivada', 'deleted'], true)) {
            $task->archived_at = $task->archived_at ?? Carbon::now();
        } else {
            $task->archived_at = null;
        }
    });
}
```

### Validaciones
```php
[
    'project_code' => 'nullable|string|max:50',
    'project_name' => 'nullable|string|max:255',
    'title' => 'required|string|max:255',
    'details' => 'nullable|string',
    'status' => 'string|in:pendiente,en_progreso,completada,archivada,deleted',
    'priority' => 'string|in:alta,media,baja',
    'assigned_to' => 'nullable|integer|exists:users,id',
    'start_date' => 'nullable|date',
    'due_date' => 'nullable|date|after_or_equal:start_date'
]
```

---

## Frontend (Next.js + TypeScript)

### Estructura de Archivos
```
src/
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

### Tipos TypeScript Clave

```typescript
type TaskStatus = "pendiente" | "en_progreso" | "completada" | "archivada" | "deleted";
type TaskPriority = "alta" | "media" | "baja";
type MilestoneValue = "sin_hito" | "amparo" | "ejecutoria" | "ejecucion" | "cobro";

interface TaskItem {
  id: number;
  project_code: string | null;
  title: string;
  details: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_to: number | null;
  assignee: {
    id: number;
    name: string;
    email: string;
  } | null;
  start_date: string | null;
  due_date: string | null;
  archived_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  milestone: MilestoneValue;
}

interface TaskTableFilters {
  search: string;
  status: "todos" | TaskStatus;
  priority: "todas" | TaskPriority;
  milestone: string;
  assignee: string;
  dueFrom: string;
  dueTo: string;
}
```

### Hitos del Proceso (milestones.ts)

```typescript
export const MILESTONE_NONE_VALUE = "sin_hito" as const;

export const MILESTONE_OPTIONS = [
  { value: MILESTONE_NONE_VALUE, label: "Sin hito" },
  { value: "amparo", label: "Amparo" },
  { value: "ejecutoria", label: "Ejecutoria" },
  { value: "ejecucion", label: "Ejecución" },
  { value: "cobro", label: "Cobro" }
] as const;

export const normalizeMilestoneValue = (value?: string | null): MilestoneValue => {
  if (typeof value === "string" && MILESTONE_VALUE_SET.has(value as MilestoneValue)) {
    return value as MilestoneValue;
  }
  return MILESTONE_NONE_VALUE;
};

export const getMilestoneLabel = (value?: string | null): string => {
  const normalized = normalizeMilestoneValue(value);
  return MILESTONE_LABEL_MAP[normalized] ?? MILESTONE_LABEL_MAP[MILESTONE_NONE_VALUE];
};
```

---

## Funcionalidades Principales

### 1. Vista de Lista
- Tabla responsiva con columnas ordenables
- Tarjetas en móvil
- Filtros: búsqueda, estado, prioridad, hito, responsable, rango de fechas
- Exportación a CSV y PDF
- Detección de tareas atrasadas (badge rojo "ATRASADA")

### 2. Vista de Calendario
- Calendario mensual (lunes como primer día)
- Indicadores visuales de tareas por día
- Panel lateral con detalle del día seleccionado
- Timeline de tareas ordenadas por fecha
- Sección de tareas sin fecha programada

### 3. Diálogo de Creación/Edición
- Vinculación con oportunidades del CRM (auto-completa project_code)
- Selector de hito
- Selector de colaborador
- Selector de estado y prioridad
- Fechas con validación (due_date >= start_date)
- Campo de descripción (textarea)

### 4. Vista de Detalle
- Tabs: Resumen / Seguimiento
- Panel lateral: Comunicaciones / Archivos
- Actualización rápida de estado (botones)
- Edición de hito
- Edición de descripción con guardado manual
- Link a oportunidad vinculada
- Timeline de eventos

### 5. Exportación
- **CSV**: Todos los campos en formato tabular
- **PDF**: Tabla formateada con jsPDF + autoTable
- Solo exporta tareas visibles (respeta filtros)

---

## Lógica de Negocio Importante

### Tareas Atrasadas
```typescript
const isTaskOverdue = (task: TaskItem) => {
  if (!task.due_date || task.status === "completada") return false;

  const dueDate = new Date(task.due_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return dueDate < today;
};
```

### Formato de Referencia
```typescript
// TA-0001, TA-0123, TA-9999
const formatTaskReference = (id: number) => {
  return `TA-${String(id).padStart(4, "0")}`;
};
```

### Vinculación con Oportunidades
```typescript
// project_code formato: "25-12345-0007-CO"
// Extrae ID: 12345
const match = projectCode.match(/-(\d+)-[A-Z]+$/);
if (match) {
  const opportunityId = Number(match[1]);
  // Link: /dashboard/deals/{opportunityId}
}
```

### Soft Delete
```typescript
// DELETE /tareas/{id}
// No elimina físicamente, solo marca como "deleted"
{
  status: "deleted",
  archived_at: Carbon::now()
}
```

---

## Sistema de Permisos

```typescript
// Permisos relacionados
const TASK_PERMISSIONS = [
  "tasks.view",      // Ver tablero
  "tasks.create",    // Crear tareas
  "tasks.edit",      // Editar tareas
  "tasks.delete"     // Eliminar/archivar
];

// Permiso adicional
"lists.export"       // Exportar a CSV/PDF

// Verificación
const canDeleteTasks = userHasPermission(user, "tasks.delete");
```

---

## Integraciones Requeridas

### 1. Endpoint de Colaboradores
```typescript
GET /colaboradores
Response: [
  { id: 1, name: "Juan Pérez", email: "juan@example.com" }
]
```

### 2. Endpoint de Oportunidades
```typescript
GET /opportunities
Response: [
  {
    id: 12345,
    reference: "25-12345-0007-CO",
    lead: { nombre_completo: "Cliente X" },
    status: "active"
  }
]
```

### 3. Componente de Chat
```typescript
<CaseChat conversationId={`TASK-${taskId}`} />
```

---

## Estados y Badges

### Estados
```typescript
const STATUS_LABELS = {
  pendiente: "Pendiente",
  en_progreso: "En progreso",
  completada: "Completada",
  archivada: "Archivada",
  deleted: "Eliminada"
};

const STATUS_BADGE_VARIANT = {
  pendiente: "outline",       // Gris con borde
  en_progreso: "default",     // Azul
  completada: "secondary",    // Verde
  archivada: "destructive",   // Rojo
  deleted: "destructive"      // Rojo
};
```

### Prioridades
```typescript
const PRIORITY_BADGE_VARIANT = {
  alta: "destructive",        // Rojo
  media: "default",           // Azul
  baja: "secondary"           // Gris
};
```

---

## Dependencias npm

```json
{
  "dependencies": {
    "jspdf": "^2.5.2",
    "jspdf-autotable": "^3.8.4",
    "lucide-react": "^0.x.x"
  }
}
```

---

## Instalación Paso a Paso

### 1. Backend
```bash
# Copiar archivos
cp backend/app/Http/Controllers/Api/TaskController.php [destino]
cp backend/app/Models/Task.php [destino]
cp backend/app/Resources/TaskResource.php [destino]
cp backend/database/migrations/*tasks* [destino]

# Ejecutar migración
php artisan migrate

# Agregar rutas en api.php
# (ver sección API Endpoints)
```

### 2. Frontend
```bash
# Copiar archivos
cp -r src/app/dashboard/tareas [destino]
cp src/lib/milestones.ts [destino]
cp src/lib/permissions.ts [destino]

# Instalar dependencias
npm install jspdf jspdf-autotable
```

### 3. Configuración
```bash
# .env
API_BASE_URL=http://localhost:8000/api

# Verificar CORS en backend si es necesario
```

### 4. Permisos
```bash
# Agregar permisos a la tabla de permisos
php artisan tinker

# Asignar permisos a roles/usuarios según necesidad
```

---

## Flujos de Usuario Críticos

### Crear Tarea
```
Click "Agregar tarea" → Llenar formulario → POST /tareas → Recarga lista
```

### Filtrar Tareas
```
Abrir filtros → Seleccionar criterios → Filtrado client-side en tiempo real
```

### Cambiar Estado
```
En detalle → Click en botón de estado → PUT /tareas/{id} → Recarga
```

### Exportar
```
Aplicar filtros → Click "Exportar" → Seleccionar CSV/PDF → Descarga
```

### Vista Calendario
```
Click "Calendario" → Ver mes → Click en día → Ver tareas de ese día
```

---

## Consideraciones Importantes

1. **Soft Delete**: Las tareas eliminadas NO se borran de la BD, solo se marcan como "deleted"
2. **Archivado Automático**: El campo `archived_at` se sincroniza automáticamente con el estado
3. **Tareas Atrasadas**: Se detectan comparando `due_date` con la fecha actual
4. **Responsable Fijo**: En la vista de detalle, el responsable no es editable (se gestiona desde CRM)
5. **Hito Editable**: El hito SÍ es editable directamente desde la vista de detalle
6. **Filtros Client-Side**: Los filtros se aplican en el frontend para mejor rendimiento
7. **Exportación Filtrada**: Solo se exportan las tareas que pasan por los filtros actuales

---

## Casos de Uso Comunes

### Caso 1: Tarea vinculada a oportunidad
```json
POST /api/tareas
{
  "project_code": "25-12345-0007-CO",
  "project_name": "amparo",
  "title": "Revisar documentos",
  "priority": "alta",
  "assigned_to": 4,
  "due_date": "2025-12-10"
}
```

### Caso 2: Tarea independiente
```json
POST /api/tareas
{
  "project_code": null,
  "project_name": "sin_hito",
  "title": "Reunión de equipo",
  "priority": "media",
  "assigned_to": 1,
  "due_date": "2025-12-05"
}
```

### Caso 3: Búsqueda de tareas de un colaborador
```typescript
// Frontend
filters.assignee = "4"

// Backend (opcional)
GET /api/tareas?assigned_to=4
```

### Caso 4: Tareas atrasadas
```typescript
const overdueTasks = tasks.filter(isTaskOverdue);
```

---

## Solución de Problemas Comunes

### Problema: Permisos no funcionan
**Solución**: Verificar que los permisos estén en la tabla y asignados al usuario/rol

### Problema: Vinculación con oportunidades falla
**Solución**: Verificar que exista endpoint `/opportunities` y devuelva campo `reference`

### Problema: Exportación de PDF no funciona
**Solución**: Verificar que `jspdf` y `jspdf-autotable` estén instalados

### Problema: Calendario no muestra tareas
**Solución**: Verificar que las tareas tengan `due_date` válido

### Problema: Tareas eliminadas aparecen en lista
**Solución**: Verificar filtro `with_deleted=0` y que el filtro de estado no sea "todos"

---

## Checklist de Migración

- [ ] Ejecutar migración de tabla `tasks`
- [ ] Copiar modelo `Task.php`
- [ ] Copiar controlador `TaskController.php`
- [ ] Copiar recurso `TaskResource.php`
- [ ] Agregar rutas en `api.php`
- [ ] Copiar archivos de frontend
- [ ] Instalar dependencias npm
- [ ] Configurar `API_BASE_URL`
- [ ] Agregar permisos al sistema
- [ ] Verificar endpoint `/colaboradores`
- [ ] Verificar endpoint `/opportunities`
- [ ] Probar creación de tarea
- [ ] Probar filtros
- [ ] Probar exportación
- [ ] Probar vista de calendario
- [ ] Probar permisos de eliminación

---

**Versión**: 1.0
**Fecha**: 2026-02-03
**Tipo**: Prompt de Importación
