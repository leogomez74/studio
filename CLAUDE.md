# PRIMARY DIRECTIVE: HYBRID AGENTIC WORKFLOW (Laravel Edition)

**Role:** Expert Laravel Code Editor & Generator with terminal access.

**Constraint (Crucial):**
1. **Discovery:** Do NOT use your context window for broad folder reading. Delegate "system understanding" to Gemini.
2. **Editing:** Only read specific files identified by Gemini for precise, syntax-correct PHP edits.

---

## 🌿 Git Workflow (OBLIGATORIO)

**Branching:** Siempre crear rama antes de trabajar:
```bash
git checkout -b feature/nombre-descriptivo
git checkout -b fix/nombre-del-bug
```

**Commits:**
- `add:` - Nueva funcionalidad
- `fix:` - Corrección de bug
- `update:` - Mejora a feature existente
- `remove:` - Eliminación de código
- `refactor:` - Refactorización sin cambio funcional
- `docs:` - Documentación

**Merge:** Solo a petición expresa del usuario.

---

## 🚀 Workflow Principal (Discovery + Action)

### 1. AUTONOMOUS DISCOVERY (Gemini/Jules)
Si el requerimiento es amplio o estructural:

**Protocolo:** Ejecuta `gemini -p "@directorio Explicación..."` para localizar la lógica.

**Ejemplo:**
```bash
gemini -p "@app/Http/Controllers/Api/ @routes/api.php Encuentra el controlador de Opportunities"
```

### 2. SURGICAL ACTION (Claude)
Una vez identificado el archivo (ej. `OpportunityController.php`):
- **Acción:** Lee el archivo con tus herramientas nativas.
- **Edición:** Aplica cambios basados en el contexto de Gemini + el código real.

### 3. API TESTING (Postman MCP)
Usa Postman para validar los cambios en los endpoints de Laravel:

```bash
# Listar colecciones
mcp postman list-collections

# Ejecutar request
mcp postman run-request --collection "Studio API" --request "GET /api/analisis"

# Con body
mcp postman run-request --collection "Studio API" --request "POST /api/analisis" --body '{"title": "Test"}'
```

**Uso:** Validar tokens de Sanctum, respuestas JSON y persistencia en DB.

---

## 🏗 Project Architecture & Domain

**Stack:** Laravel 12 (API), PHP 8.2+, MySQL, Next.js (Frontend), Laravel Sanctum (Auth).
**Testing:** SQLite (in-memory).

### STI Pattern (persons table)
| person_type_id | Tipo   | Descripción          |
|----------------|--------|----------------------|
| 1              | Lead   | Cliente potencial    |
| 2              | Client | Cliente convertido   |

Ambos modelos heredan de `Person` y usan Global Scopes para filtrar automáticamente.

### Core Entities

| Entidad       | Descripción                                                    |
|---------------|----------------------------------------------------------------|
| **Opportunity** | IDs personalizados `YY-XXXXX-OP` (ej. `25-00001-OP`). Vinculado a Lead via `lead_cedula`. |
| **Credit**      | Registro del préstamo. Genera automáticamente un `PlanDePago`. |
| **PlanDePago**  | Entradas del cronograma de amortización.                       |
| **CreditPayment** | Registros de pagos individuales.                             |
| **Deductora**   | Entidad de deducciones de nómina.                              |

### Key Relationships
- `Lead/Client` → `Opportunity` (via campo `cedula`, no FK estándar)
- `Credit` → `Lead`, `Opportunity`, `Deductora`, `PlanDePago`, `CreditPayment`
- `User` → Assigned `Leads`, `Opportunities`, `Credits`

### Gamification System
- **Locations:** `app/Services/Rewards/`, `app/Models/Rewards/`, `app/Events/Rewards/`
- **Config:** `config/gamification.php`
- **Pattern:** Event-driven architecture (Events/Listeners)

### API Structure
- **Controllers:** `app/Http/Controllers/Api/`
- **Routes:** Mayoría públicas (`routes/api.php`), protegidas usan `auth:sanctum`
- **Rewards:** Endpoints agrupados bajo `/api/rewards`

---

## 🤖 Jules MCP (Tareas Asíncronas de Código)

Usa Jules para delegar tareas de código que pueden ejecutarse en paralelo o de forma asíncrona:

### Comandos Principales

| Comando | Descripción |
|---------|-------------|
| `jules_create_task` | Crear nueva tarea de código para Jules |
| `jules_list_tasks` | Ver todas las tareas y su estado |
| `jules_get_task` | Obtener detalles de una tarea específica |
| `jules_analyze_code` | Analizar código sin modificarlo |
| `jules_approve_plan` | Aprobar el plan propuesto por Jules |
| `jules_send_message` | Enviar instrucciones adicionales a una tarea |
| `jules_resume_task` | Reanudar una tarea pausada |
| `jules_bulk_create_tasks` | Crear múltiples tareas a la vez |

### Casos de Uso

```
# Crear tarea para refactorizar un módulo
jules_create_task "Refactoriza app/Services/CreditService.php para usar DTOs"

# Analizar código antes de modificar
jules_analyze_code "app/Http/Controllers/Api/CreditController.php"

# Crear múltiples tareas en paralelo
jules_bulk_create_tasks [
  "Agregar tests para CreditService",
  "Documentar métodos públicos de CreditController"
]
```

### Workflow con Jules
1. **Crear tarea** → Jules analiza y propone un plan
2. **Revisar plan** → `jules_get_task` para ver la propuesta
3. **Aprobar** → `jules_approve_plan` para que ejecute los cambios
4. **Monitorear** → `jules_list_tasks` para ver progreso

**Uso ideal:** Tareas largas, refactorizaciones, generación de tests, documentación.

---

## 🔎 Gemini CLI Execution Protocols

Usa estos patrones antes de escribir código:

```bash
# Análisis de archivo/función
gemini -p "@src/file.php Explica la lógica de calculateTotal"

# Arquitectura y estructura
gemini -p "@./folder_name Explica el flujo de datos"

# Verificación de implementación
gemini -p "@src/ @tests/ ¿Está implementado [feature]? Lista archivos y funciones"

# Debugging
gemini -p "@app/Http/Controllers/ @routes/ Analiza por qué ocurre [error]"

# Generación de tests
gemini -p "@app/Models/Credit.php @tests/Feature/ Analiza el modelo y sugiere casos de test"
```

---

## 🛠 Coding Standards (After Analysis)

Una vez tengas el contexto de Gemini Y hayas leído el archivo objetivo:

- **Strict Typing:** Uso obligatorio de tipos de PHP en argumentos y retornos.
- **Laravel Best Practices:** Eloquent scopes, FormRequests para validación, API Resources.
- **Tests:** Sugerir actualizaciones de tests si la lógica cambia.
- **Action:** Aplica los cambios directamente a los archivos.
