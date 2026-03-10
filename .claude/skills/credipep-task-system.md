# Skill: CREDIPEP Task & Entity Reference System

## Description
Gestiona y mejora el sistema de tareas y referencias de entidades en CREDIPEP Studio. Incluye validación de `project_code`, generación de `reference`, linking entre tareas y entidades, y búsqueda consistente. Usar cuando se trabaje con tareas, automatizaciones de tareas, o el sistema de `project_code`/`reference`.

## Trigger
- Invocable con `/credipep-tasks`
- Automático cuando se detectan cambios en tareas, project_code, o task automations

---

## Arquitectura del Sistema de Tareas

### Modelo Task (`backend/app/Models/Task.php`)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | int PK | ID auto-increment |
| `reference` | string(20), unique, nullable | Auto-generado: `TA-{id padded 4}` |
| `project_code` | string(255), nullable | Link a entidad: `{MODULO}-{entity_id}` |
| `project_name` | string(255), nullable | Nombre display del proyecto/módulo |
| `title` | string(255) | Título de la tarea |
| `details` | text, nullable | Descripción detallada |
| `status` | enum | `pendiente`, `en_progreso`, `completada`, `archivada`, `deleted` |
| `priority` | enum | `alta`, `media`, `baja` |
| `assigned_to` | FK users.id, nullable | Usuario asignado |
| `start_date` | date, nullable | Fecha inicio |
| `due_date` | date, nullable | Fecha vencimiento |

**Relaciones:**
- `assignee()` → BelongsTo User
- `documents()` → HasMany TaskDocument
- `checklistItems()` → HasMany TaskChecklistItem

### Reference Auto-Generation (Boot Hook)
```php
static::created(function (Task $task) {
    if (!$task->reference) {
        $task->reference = 'TA-' . str_pad($task->id, 4, '0', STR_PAD_LEFT);
        $task->saveQuietly();
    }
});
```

### Formato de project_code

| Módulo | Prefijo | Ejemplo | Ruta Frontend |
|--------|---------|---------|---------------|
| Lead | `LEAD-{id}` | `LEAD-756` | `/dashboard/leads/{id}` |
| Client | `CLIENT-{id}` | `CLIENT-756` | `/dashboard/clientes/{id}` |
| Oportunidad | `OPP-{opportunity.id}` | `OPP-26-00008-101-OP` | `/dashboard/oportunidades/{id}` |
| Análisis | `ANA-{analisis.id}` | `ANA-228` | `/dashboard/analisis/{id}` |
| Crédito | `CRED-{credit.id}` | `CRED-176` | `/dashboard/creditos/{id}` |

### Task Automations

| event_type | Se dispara cuando | project_code generado |
|------------|-------------------|-----------------------|
| `lead_created` | Se crea un Lead | `LEAD-{lead.id}` |
| `opportunity_created` | Se crea una Oportunidad | `OPP-{opportunity.id}` |
| `analisis_created` | Se crea un Análisis | `ANA-{analisis.id}` |
| `credit_created` | Se crea un Crédito | `CRED-{credit.id}` |
| `pep_aceptado` | PEP aceptado | `ANA-{analisis.id}` |
| `pep_rechazado` | PEP rechazado | `ANA-{analisis.id}` |

---

## Frontend (`src/app/dashboard/tareas/page.tsx`)

### Reference Display
```typescript
const formatTaskReference = (id: number): string => {
  return `TA-${String(id).padStart(4, "0")}`;
};
```

### Project Code Parsing
```typescript
const parseProjectCode = (projectCode: string | null) => {
  if (!projectCode) return null;
  const match = projectCode.match(/^(LEAD|OPP|ANA|CRED|CLIENT)-(.+)$/);
  // Returns: { module, id, url }
};
```

### Búsqueda
- Backend busca en: `reference`, `title`, `project_code`
- Frontend filtra adicionalmente con `formatTaskReference(task.id)`

---

## Archivos Clave

| Archivo | Responsabilidad |
|---------|-----------------|
| `backend/app/Models/Task.php` | Modelo, boot hooks, relaciones |
| `backend/app/Models/TaskAutomation.php` | Automatizaciones con checklist |
| `backend/app/Http/Controllers/Api/TaskController.php` | CRUD, filtros, búsqueda |
| `backend/app/Http/Controllers/Api/TaskAutomationController.php` | Config de automatizaciones |
| `src/app/dashboard/tareas/page.tsx` | UI de tareas, kanban, filtros |
| `backend/database/migrations/2026_03_10_160000_add_reference_to_tasks_table.php` | Campo reference |
| `backend/database/migrations/2026_03_10_150000_standardize_task_project_codes.php` | Normalización |

---

## Reglas al Modificar

1. **project_code**: Siempre usar formato `{MODULO}-{entity_id}`. Validar con regex `^(LEAD|OPP|ANA|CRED|CLIENT)-.+$`
2. **reference**: NUNCA establecer manualmente — se auto-genera en el boot hook
3. **Nuevos event_type**: Agregar en el controlador que crea la entidad, no en TaskController
4. **Checklist**: Al crear tarea desde automatización, llamar `$task->copyChecklistFromAutomation($automation)`
5. **Búsqueda**: Si se agrega un nuevo campo buscable, actualizar tanto backend (`TaskController@index`) como frontend (filtro local)
6. **Soft delete**: No usar SoftDeletes de Laravel — el sistema usa `status = 'deleted'` y `archived_at`
7. **Nuevos módulos**: Agregar prefijo en `parseProjectCode` del frontend Y en la migración de standardize

## Inconsistencias Conocidas (a mejorar)

1. `project_code` no tiene validación de formato en el backend (es free string max 50)
2. Oportunidades usan string ID (`26-00008-101-OP`) mientras otros módulos usan int ID
3. Frontend recalcula reference con `formatTaskReference()` en vez de usar `task.reference` del server
4. No hay validación backend que el `project_code` referencie una entidad existente
