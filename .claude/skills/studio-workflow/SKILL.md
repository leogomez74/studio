---
name: studio-workflow
description: >
  Skill AUTOMÁTICO para el proyecto CR Studio (Laravel 12 + Next.js). Se activa en TODOS los prompts.
  Gestiona tres responsabilidades clave: (1) selección del modelo más eficiente según el tipo de tarea,
  (2) enrutamiento inteligente a skills y plugins especializados disponibles en el proyecto,
  (3) protocolo de análisis-primero con Plan Mode obligatorio antes de modificar lógica compleja.
  SIEMPRE usar este skill en CR Studio. Aplica para cualquier tarea: código, análisis, documentación,
  auditoría, refactoring, ingeniería inversa, creación de módulos, debugging, o consultas del sistema.
---

# Studio Workflow — Protocolo Automático CR Studio

Eres el orquestador inteligente de tareas en el proyecto CR Studio. Antes de responder cualquier prompt,
pasa por los tres pilares de este workflow. No esperes que el usuario lo pida — aplícalo siempre.

---

## PILAR 1 — Optimización de Tokens y Selección de Modelo

El objetivo es usar el modelo correcto para cada tipo de trabajo, maximizando calidad y minimizando costo.

### Árbol de Decisión

```
¿Cuál es la naturaleza de la tarea?
│
├── PREGUNTAS DEL SISTEMA / ANÁLISIS / CONTEXTO
│   ├── Ejemplos: "¿qué hace este archivo?", "¿cómo funciona X?",
│   │            "analiza esta carpeta", "¿está implementado Y?",
│   │            crear archivos .md de contexto/documentación
│   └── → Usar: claude-haiku-4-5-20251001 (subagente Explore)
│
├── EDICIÓN / ESCRITURA DE CÓDIGO
│   ├── Ejemplos: agregar feature, corregir bug, crear controller,
│   │            modificar componente Next.js, refactorizar servicio Laravel
│   └── → Usar: claude-sonnet-4-6 (modelo principal)
│       └── Patrón: Haiku analiza primero → Sonnet edita con contexto
│
└── TAREAS LARGAS / PARALELAS / GENERACIÓN DE TESTS
    ├── Ejemplos: refactorización de módulo completo, generar suite de tests,
    │            documentar API completa, múltiples archivos simultáneos
    └── → Delegar a: subagente general-purpose con aislamiento (worktree)
```

### Patrón Haiku → Sonnet para edición de código

Cuando vayas a editar código, no leas los archivos tú mismo si el análisis puede ser delegado.
Usa un subagente Haiku para entender primero, luego actúa con ese contexto:

```
# Paso 1: Subagente Haiku analiza (subagent_type: "Explore", model: "haiku")
"Lee app/Http/Controllers/Api/CreditController.php y lista: métodos públicos,
dependencias inyectadas, y rutas que los llaman en routes/api.php"

# Paso 2: Con el resumen, Sonnet edita quirúrgicamente
→ Read solo el archivo específico → Edit con precisión
```

Esto reduce tokens consumidos en el contexto principal y mejora la precisión de los cambios.

---

## PILAR 2 — Registro de Skills y Plugins Disponibles

Antes de ejecutar cualquier tarea, verifica si existe una herramienta especializada para ella.
Priorizar siempre la herramienta más específica sobre hacerlo manualmente.

### Skills Disponibles

| Skill | Cuándo usarlo |
|-------|--------------|
| `webapp-testing` | Testing de UI con Playwright, verificar funcionalidad frontend, capturar screenshots, ver browser logs |
| `frontend-design` | Crear interfaces web de producción (componentes React, páginas, dashboards, landing pages) |
| `simplify` | Revisar código ya escrito para calidad, reuso y eficiencia. Úsalo después de implementar features |
| `pdf` | Cualquier operación con archivos PDF: leer, crear, combinar, dividir |
| `docx` | Crear o editar documentos Word (.docx) con formato profesional |
| `pptx` | Crear o manipular presentaciones PowerPoint (.pptx) |
| `xlsx` | Abrir, leer, editar o crear archivos Excel/CSV |
| `mcp-builder` | Crear nuevos servidores MCP para integrar APIs externas |
| `claude-api` | Construir apps con el SDK de Anthropic / Claude API |
| `internal-comms` | Redactar comunicaciones internas: reportes, actualizaciones de liderazgo, status reports |
| `schedule` / `loop` | Programar tareas recurrentes o agentes con intervalos |
| `doc-coauthoring` | Co-redactar documentación técnica, specs, propuestas estructuradas |
| `canvas-design` | Crear arte visual, posters, diseños estáticos en PNG/PDF |
| `atlassian:spec-to-backlog` | Convertir specs de Confluence en backlog de Jira (épicas + tareas implementación) |
| `atlassian:capture-tasks-from-meeting-notes` | Analizar notas de reunión y crear tareas Jira para los action items |
| `atlassian:triage-issue` | Triaje de bugs: buscar duplicados en Jira y crear/actualizar issues |
| `atlassian:search-company-knowledge` | Buscar en Confluence, Jira y docs internos para encontrar contexto de empresa |
| `atlassian:generate-status-report` | Generar reportes de estado desde Jira y publicarlos en Confluence |
| `claude-md-management:revise-claude-md` | Actualizar CLAUDE.md con aprendizajes de la sesión actual |
| `claude-md-management:claude-md-improver` | Auditar y mejorar archivos CLAUDE.md del repositorio |
| `code-review:code-review` | Revisar un pull request completo con análisis especializado |
| `commit-commands:commit` | Crear un git commit siguiendo convenciones del proyecto |
| `commit-commands:commit-push-pr` | Commit + push + abrir PR en un solo flujo |
| `commit-commands:clean_gone` | Limpiar ramas locales cuyo remoto ya fue eliminado |
| `feature-dev:feature-dev` | Desarrollo guiado de features con foco en arquitectura y comprensión del codebase |
| `pr-review-toolkit:review-pr` | Review comprehensivo de PR usando agentes especializados |
| `superpowers:writing-plans` | Crear plan de implementación antes de tocar código (requerido para tareas multi-paso) |
| `superpowers:executing-plans` | Ejecutar un plan de implementación ya aprobado con checkpoints de revisión |
| `superpowers:brainstorming` | Ideación antes de cualquier trabajo creativo o de diseño de features |
| `superpowers:test-driven-development` | Implementar features con TDD: tests primero, luego implementación |
| `superpowers:systematic-debugging` | Debugging estructurado ante cualquier bug o fallo de tests |
| `superpowers:dispatching-parallel-agents` | Ejecutar 2+ tareas independientes en paralelo con subagentes |
| `superpowers:verification-before-completion` | Verificar que el trabajo está completo antes de hacer commit o PR |
| `superpowers:finishing-a-development-branch` | Guía para integrar una rama cuando la implementación está completa |
| `superpowers:requesting-code-review` | Solicitar revisión de código al completar una feature o antes de mergear |
| `superpowers:subagent-driven-development` | Ejecutar planes de implementación con tareas independientes en subagentes |

### MCP Plugins Disponibles

| Plugin MCP | Herramientas clave | Cuándo activar |
|------------|-------------------|----------------|
| **laravel-boost** | `database-schema`, `tinker`, `list-routes`, `read-log-entries`, `last-error`, `list-artisan-commands`, `search-docs` | Inspeccionar DB, ejecutar Tinker, ver rutas registradas, leer errores de Laravel, buscar docs de Laravel |

### Regla de enrutamiento

```
¿La tarea involucra...?
│
├── Archivos .pdf, .docx, .pptx, .xlsx → skill correspondiente
├── Testing de UI o verificación visual → webapp-testing
├── Diseño de interfaz nueva → frontend-design
├── Revisión de código recién escrito → simplify o code-review:code-review
├── Explorar schema de DB o rutas Laravel → laravel-boost MCP
├── Error reciente en Laravel → laravel-boost last-error
├── Refactor largo o múltiples archivos → superpowers:dispatching-parallel-agents
├── Comunicación interna / reporte → internal-comms
├── Nueva feature multi-paso → superpowers:writing-plans → superpowers:executing-plans
├── Feature con tests → superpowers:test-driven-development
├── Bug o fallo inesperado → superpowers:systematic-debugging
├── Commit / push / PR → commit-commands:commit o commit-commands:commit-push-pr
├── Revisar PR → pr-review-toolkit:review-pr
├── Jira / Confluence / backlogs → atlassian:* (skill correspondiente)
├── Actualizar CLAUDE.md → claude-md-management:revise-claude-md
└── Desarrollo guiado de feature → feature-dev:feature-dev
```

---

## PILAR 3 — Protocolo Análisis-Primero con Plan Mode

Para cualquier tarea que involucre lógica de negocio, funciones complejas, módulos, auditoría,
ingeniería inversa o reingeniería, NO empieces a escribir código directamente.

### Gatillos que activan este protocolo

- "implementa X funcionalidad"
- "refactoriza / reorganiza / reestructura"
- "audita / revisa / analiza el módulo"
- "crea un nuevo módulo / servicio / controlador"
- "¿cómo funciona X?" (cuando implique cambios posteriores)
- "ingeniería inversa de..."
- "optimiza la lógica de..."
- cualquier tarea que toque más de 2 archivos de código

### Secuencia Obligatoria

```
PASO 1 — ANÁLISIS (Haiku subagente)
├── Lanzar subagente Explore/Haiku para mapear archivos relevantes
├── Usar gemini CLI si el alcance es amplio:
│   gemini -p "@app/Http/Controllers/ @routes/ Explica el flujo de X"
└── Resultado: lista de archivos, relaciones, dependencias, patrones actuales

PASO 2 — PLAN MODE (EnterPlanMode)
├── Presentar plan estructurado con:
│   - Archivos a modificar (con rutas)
│   - Cambios por archivo (qué y por qué)
│   - Orden de ejecución
│   - Riesgos o efectos secundarios
│   - Modelo a usar para cada parte
└── Esperar aprobación explícita del usuario

PASO 3 — EJECUCIÓN (solo tras aprobación)
├── Seguir el plan aprobado quirúrgicamente
├── Un archivo a la vez, con confirmación si hay desvíos
└── Al finalizar: actualizar .claude/MEMORY.md y .claude/mejoras.md
```

### Formato del Plan

```markdown
## Plan: [Nombre de la tarea]

### Análisis previo
- Archivos identificados: [lista]
- Patrón actual: [descripción breve]
- Dependencias: [qué depende de qué]

### Cambios propuestos

#### 1. `ruta/archivo.php`
- Qué: [descripción del cambio]
- Por qué: [justificación]
- Modelo: Sonnet (edición de código)

#### 2. `ruta/componente.tsx`
- Qué: [descripción del cambio]
- Por qué: [justificación]
- Modelo: Sonnet (edición de código)

### Orden de ejecución
1. Backend primero (migraciones si las hay → modelos → servicios → controllers)
2. Frontend después (types → hooks → componentes → páginas)

### Riesgos
- [Posibles efectos secundarios o breaking changes]

¿Apruebas este plan?
```

---

## Reglas Globales del Proyecto (Recordatorio)

Estas reglas del CLAUDE.md siempre aplican, incluso dentro de este skill:

- **Idioma**: Siempre en español con el usuario
- **Commits**: Solo cuando el usuario lo pida explícitamente
- **Axios**: Siempre con prefijo `/api/` (ej: `api.get('/api/credits')`)
- **Permisos**: NUNCA mezclar `/api/users` (middleware admin) en `Promise.all` con otros endpoints
- **Alternativa usuarios**: Usar `/api/agents` para listar usuarios sin requerir admin
- **LogsActivity**: Usar en controllers CRUD sensibles
- **Memoria**: Actualizar `.claude/MEMORY.md` y `.claude/mejoras.md` al terminar cada tarea
- **Git**: Crear rama antes de trabajar (`feature/` o `fix/`)

---

## Resumen Rápido de Decisiones

```
Tarea recibida
    │
    ├─ ¿Existe skill/MCP especializado? → Usarlo (Pilar 2)
    │
    ├─ ¿Es análisis/pregunta/documentación? → Haiku subagente (Pilar 1)
    │
    ├─ ¿Es lógica compleja / módulo / auditoría?
    │   → Análisis Haiku → Plan Mode → Esperar aprobación (Pilar 3)
    │
    └─ ¿Es edición puntual de código?
        → Haiku analiza archivo → Sonnet edita (Pilar 1)
```
