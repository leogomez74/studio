# PRIMARY DIRECTIVE: HYBRID AGENTIC WORKFLOW

Role: You are an Expert Code Editor & Generator with access to terminal tools. Constraint (Crucial):

For Discovery & Context: You must NOT use your context window to read large sets of files or entire folders. Delegate "understanding the system" to gemini.

For Editing: Once you have identified the specific file(s) that need changes via Gemini's analysis, you MUST read those specific files into your context to ensure precise, syntax-correct edits.

Capabilities: You HAVE permission to execute terminal commands.

---

## Git Workflow (OBLIGATORIO)

### Antes de cualquier cambio o feature:
1. **SIEMPRE crear un branch** antes de empezar a trabajar:
   ```bash
   git checkout -b feature/nombre-descriptivo
   # o
   git checkout -b fix/nombre-del-bug
   ```

2. **Convención de commits** - Usar nombres simples y directos:
   - `add: descripcion` - Nueva funcionalidad
   - `fix: descripcion` - Corrección de bug
   - `update: descripcion` - Mejora a feature existente
   - `remove: descripcion` - Eliminación de código
   - `refactor: descripcion` - Refactorización sin cambio funcional
   - `docs: descripcion` - Documentación

3. **Ejemplos**:
   ```bash
   git commit -m "add: módulo deducciones en análisis"
   git commit -m "fix: auth token en axios"
   git commit -m "update: validaciones en AnalisisController"
   ```

4. **Al terminar**, hacer merge a main solo cuando el usuario lo solicite.

---

## API Testing con Postman MCP

Usar el MCP de Postman para probar endpoints de la API:

```
# Listar colecciones disponibles
mcp postman list-collections

# Ejecutar request específico
mcp postman run-request --collection "Studio API" --request "GET /api/analisis"

# Probar endpoint con datos
mcp postman run-request --collection "Studio API" --request "POST /api/analisis" --body '{"title": "Test"}'
```

Usar Postman MCP para:
- Verificar que endpoints funcionan después de cambios
- Probar autenticación y tokens
- Validar respuestas de la API

---

## Workflow Principal

Analyze Request: Identify if the request requires finding where something is, understanding how it works, or fixing a known file.

AUTONOMOUS DISCOVERY (Gemini):

If the request is broad (e.g., "fix the auth bug", "how does credit calculation work?"):

EXECUTE gemini -p "..." to locate the relevant logic and understand the flow.

Example: gemini -p "@app/Http/Controllers/ @routes/ Find the controller handling credit creation"

SURGICAL ACTION (Claude):

Once Gemini confirms the logic is in CreditController.php:

READ CreditController.php (using your native tool) to see the exact code.

EDIT the file based on the context gained from Gemini + the raw code.

Project Overview & Architecture
Stack: Laravel 12 (API), PHP 8.2+, MySQL, Next.js (Frontend), Laravel Sanctum (Auth). Testing: SQLite (in-memory).

Domain Model (Single Table Inheritance)
The persons table uses a single-table inheritance pattern with person_type_id:

Lead (person_type_id = 1): Potential customer.

Client (person_type_id = 2): Converted customer. Both models inherit from Person and use Global Scopes to filter automatically.

Core Business Entities
Opportunity: Linked to Lead via lead_cedula (Not a standard FK). Uses custom string IDs YY-XXXXX-OP (e.g., 25-00001-OP).

Credit: The loan record. Linked to Lead and Opportunity. Auto-creates an initial PlanDePago upon creation.

PlanDePago: Amortization schedule entries.

CreditPayment: Individual payment records.

Deductora: Payroll deduction entity.

Key Relationships
Lead/Client -> Opportunity (via cedula field, not standard FK).

Credit -> Lead, Opportunity, Deductora, PlanDePago, CreditPayment.

User -> Assigned Leads, Opportunities, Credits.

Gamification System
Locations: app/Services/Rewards/, app/Models/Rewards/, app/Events/Rewards/.

Config: config/gamification.php.

Pattern: Event-driven architecture (Events/Listeners).

API Structure
Controllers: app/Http/Controllers/Api/.

Routes: Most are public (routes/api.php), protected ones use auth:sanctum.

Rewards: Endpoints grouped under /api/rewards.

Gemini CLI Execution Protocols
Use these patterns to fetch context BEFORE writing code. Execute these commands directly.

🔎 File/Files Analysis (Understanding Logic) gemini -p "@src/file.php Explain the logic of the calculateTotal function"

🔎 Architecture & Structure (Broad View) gemini -p "@./folder_name Explain the structure and data flow"

✅ Implementation Verification gemini -p "@src/ @tests/ Is [feature] implemented? List files and functions"

🐛 Debugging (Tracing) gemini -p "@app/Http/Controllers/ @routes/ Analyze why [error] might occur"

🧪 Test Generation gemini -p "@app/Models/Credit.php @tests/Feature/ Analyze the model and suggest test cases"

Coding Standards (After Analysis)
Once you have the context from Gemini AND have read the target file:

Strict Typing: Use PHP types for all method arguments and return values.

Laravel Best Practices: Use Eloquent scopes, FormRequests for validation, and API Resources.

Tests: Suggest test updates if logic changes.

Action: Apply the changes directly to the files.
