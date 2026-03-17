# Resumen del Proyecto CR Studio (Gemini)

Este documento proporciona una visión general del proyecto CR Studio, migrada desde el contexto de Claude.

## Archivos de Contexto Principales

A continuación se presenta el contenido de los archivos de configuración y memoria encontrados en el directorio `.claude/`.

---

### Contenido de: .claude/MEMORY.md

# Bitácora del Proyecto — CR Studio (Laravel + Next.js)

## Stack
- **Backend:** Laravel 12, PHP 8.2+, MySQL, Sanctum
- **Frontend:** Next.js (App Router), TypeScript
- **Idioma del usuario:** Español siempre

---

## Arquitectura General
- STI pattern: tabla `persons`, `person_type_id=1` = Lead, `person_type_id=2` = Client
- Opportunity: ID formato `YY-XXXXX-OP`
- Auth: Sanctum. Frontend baseURL = `http://localhost:8000` (sin `/api`), todas las rutas usan `/api/` prefix en axios.
- CI/CD: GitHub Actions → SSH → `git reset --hard` + `php artisan migrate --force` + `npm run build` + `pm2 restart`

---

## Módulos del sistema

| Módulo | Ruta frontend | Estado |
|--------|--------------|--------|
| CRM / Leads | `/dashboard/clientes` | ✅ |
| Créditos | `/dashboard/creditos` | ✅ |
| Cobros | `/dashboard/cobros` | ✅ |
| Analisis | `/dashboard/analisis` | ✅ |
| Oportunidades | `/dashboard/oportunidades` | ✅ |
| Configuración | `/dashboard/configuracion` | ✅ (96 líneas — refactorizado Mar 2026) |
| Auditoría General | `/dashboard/auditoria` | ✅ Mar 2026 |
| Auditoría Asientos ERP | `/dashboard/auditoria-asientos` | ✅ Mar 2026 |
| Inversiones | `/dashboard/inversiones` | ✅ |
| Rewards | `/dashboard/rewards` | ✅ |
| Tareas | `/dashboard/tareas` | ✅ |
| Reportes | `/dashboard/reportes` | ✅ Mar 2026 (5 tabs — Inversiones removido, tiene su propia sección) |
| Rutas | `/dashboard/rutas` | ✅ Mar 2026 (refactorizado: 1,672 → ~100 líneas orquestador + 5 tabs + types + utils) |

---

## Sistema de Permisos
- `Role::getFormattedPermissions()` en `backend/app/Models/Role.php`
- Módulos: `reportes, kpis, crm, oportunidades, analizados, creditos, calculos, cobros, cobro_judicial, ventas, inversiones, rutas, proyectos, comunicaciones, staff, entrenamiento, recompensas, configuracion, tareas, auditoria`
- `full_access=true` → acceso total automático
- Frontend: `canViewModule('modulo')` desde `PermissionsContext`
- **Flujo de permisos**: `/me` retorna `user` + `permissions` → `PermissionsContext` usa `/me` (NO `/users/{id}` ni `/roles/{id}` que requieren middleware admin)
- **Bug resuelto Mar 2026**: usuarios no-admin veían sidebar vacío porque PermissionsContext llamaba endpoints con middleware `admin` → fix: usar `/me`
- **Patrón crítico**: NUNCA mezclar `/api/users` (middleware admin) en `Promise.all` con otros endpoints — si falla uno, fallan todos. Siempre separar con try/catch propio.
- **Alternativa para listar usuarios sin admin**: usar `/api/agents` (retorna `id`, `name` de todos los usuarios, sin middleware admin). Usado en `chat-bubble.tsx`.

---

## Archivos de detalle (en .claude/)
- `accounting.md` → Sistema de asientos contables completo
- `auditoria.md` → Sistema de auditoría general
- `mejoras.md` → Análisis de mejoras resueltas y pendientes

---

## Convenciones importantes
- Axios: siempre `/api/` prefix (ej: `api.get('/api/credits')`)
- PDF estado de cuenta: filtrar SOLO cuotas `'Pagado'` o `'Pagada'`
- PDF estado de cuenta inversiones: reconstruye capital original desde payments (safety net). Columna "Intereses Pendientes" muestra acumulado de intereses no pagados.
- `cancelacionTotal('sin_intereses')` NO debe zerear `monto_capital` ni `interes_mensual` — el estado `Finalizada` es suficiente para marcar la devolución de capital
- Tasa de interés: leer de `/api/loan-configurations/activas`, NO hardcodear
- `LogsActivity` trait: usar en controllers CRUD sensibles

### Cómo usar LogsActivity en nuevo controller
```php
use App\Traits\LogsActivity;
class MiController extends Controller {
    use LogsActivity;
    public function update(Request $request, $id) {
        $model = MiModelo::findOrFail($id);
        $oldData = $model->toArray();
        $model->update($request->validated());
        $changes = $this->getChanges($oldData, $model->fresh()->toArray());
        $this->logActivity('update', 'MiMódulo', $model, $model->nombre, $changes, $request);
    }
}
```

---

## Integración Credid API
- **Endpoint:** `GET /api/credid/reporte?cedula=...` (auth:sanctum)
- **Backend:** `CredidService` (consultar API + extraer datos análisis) + `CredidController`
- **Config:** `services.credid` con `CREDID_API_URL` y `CREDID_API_TOKEN` en `.env`
- **Frontend:** Auto-consulta al crear análisis (wizard modal) + botón manual "Consultar Credid" en detalle de análisis
- **Datos auto-llenados:** cargo, nombramiento, manchas/juicios/embargos (conteo + detalles), PEP, refs comerciales
- **No auto-llena:** montos, plazo, cuota, ingreso neto exacto, deducciones, propuesta
- **Score Credid:** Requiere permiso adicional en contrato Credid — token actual NO lo tiene. `CredidService` ya lo extrae (`$reporte['Score']['ConfidenceResult']`), se activará automáticamente cuando Credid habilite el módulo
- **Score Interno de Riesgo (Mar 2026):** Accessor computado en `Analisis` model, sin migración. Fórmula: 100 - (manchas×12, máx 48) - (juicios×15, máx 45) - (embargos×20, máx 40). Colores: green(80-100)/yellow(60-79)/orange(40-59)/red(0-39). Labels: Bajo/Moderado/Alto/Muy Alto. Visible en listado, detalle y wizard. Score incluido en respuesta de `CredidService::extraerDatosAnalisis()` — fuente única de verdad en el modelo
- **Datos Adicionales Leads/Clientes (Mar 2026):** Sección "Datos Adicionales" en detalle de Lead y Cliente con datos de Credid. Enfoque híbrido: JSON cache en `credid_data` + 13 columnas resumen en `persons`. 3 paneles: Información Personal, Patrimonio, Cumplimiento. Auto-consulta Credid al crear Lead (`store()`). Prioridad auto-fill: Cuestionario > Manual > Credid. `$hidden = ['credid_data']` en modelos. Endpoints: `POST /leads/{id}/consultar-credid`, `POST /clients/{id}/consultar-credid` (throttle:10,1)
- **Wizard reordenado (Mar 2026):** Paso 1=Historial Crediticio, Paso 2=Info Básica, Paso 3=Ingresos, Paso 4=Documentos
- **Estados juicios normalizados:** `En Trámite` / `Finalizado` (backend, frontend, validación, tipos)
- **Fix producción:** `$response->json()` puede retornar string en vez de array → se agregó `json_decode` fallback en `CredidService`
- **Auditoría Seguridad Credid (Mar 2026):** 7 fixes aplicados: (1) `status()` protegido con middleware `admin` + no expone URL/token/body_preview, (2) `status()` refactorizado para usar `CredidService::verificarConfiguracion()`, (3) `throttle:10,1` en ambas rutas credid, (4) Token en query string es limitación de la API de Credid (documentado), (5) Validación cédula con regex `/^\d{9,12}$/`, (6) `LogsActivity` trait en `CredidController`, (7) Cédulas enmascaradas en logs (`*****6789`)
- **Auditoría Seguridad Global (Mar 2026):** 5 fixes críticos: (C1) throttle en 40+ rutas financieras/mutación, (C2) `/health/env` ya no expone detalles de configuración de integraciones — solo status boolean, (C3) `CreditController::storeDocument` validación `mimes|max:10240`, (C4) `DB::transaction + lockForUpdate()` en InvestmentController (liquidate/renew/cancel/cancelacionTotal), InvestmentCouponController (markPaid/correct/markBulkPaid/bulkPayByDesembolso), ComisionController (aprobar/pagar/bulkAprobar/bulkPagar), (C5) DOMPurify sanitización en `dangerouslySetInnerHTML` de chat-bubble.tsx y comunicaciones/page.tsx

---

## Módulo Reportes — detalles (Mar 2026)

### Tabs activos: Cartera Activa | Cartera en Mora | Por Deductora | Novedades de Planilla | Cobros
- **Inversiones eliminado** del módulo Reportes — tiene su propia sección en `/dashboard/inversiones`
- **Breadcrumb fix**: segmento `dashboard` omitido en todos los breadcrumbs (`dashboard-header.tsx`). El ícono Home ya enlaza a `/dashboard`.
- **Backend ReporteController**: nuevos endpoints Mar 2026:
  - `GET /api/reportes/planilla-cobro/{id}` → JSON créditos activos de una deductora
  - `GET /api/reportes/planilla-cobro/{id}/pdf` → PDF planilla de cobro (Carlos → cooperativas)
  - `GET /api/reportes/novedades-planilla/pdf` → PDF de novedades (inclusiones/exclusiones/cambios cuota)
- **Novedades automáticas**: se cargan automáticamente al seleccionar cooperativa (sin botón "Consultar")
- **PDF Planilla de Cobro**: landscape, incluye nombre, cédula, No. crédito, F. Formalización, Tasa %, Plazo, cuota, saldo, Tipo Movimiento + totales + firmas. Fuente: DejaVu Sans (soporta ₡)
- **Status filter default**: incluye `['Activo', 'En Mora', 'Formalizado', 'Legal', 'En Progreso', 'Aprobado', 'Por firmar']` (excluye solo 'Cerrado')
- **Historial de cambios**: tabla `deductora_changes` registra inclusiones, exclusiones, traslados y refundiciones automáticamente. Modelo `DeductoraChange` con helpers estáticos
- **Control mensual PDF**: tabla `planilla_reports` registra generación por deductora/periodo/tipo. Endpoint `GET /api/reportes/planilla-reports-status?periodo=YYYY-MM`
- **Novedades expandidas**: 5 secciones (inclusiones con F.Formalización/Tasa/Plazo/Saldo, exclusiones, traslados de cooperativa, refundiciones, cambios de cuota)

---

## Módulo Rutas — Refactorización (Mar 2026)
- `page.tsx` monolítico de 1,672 líneas → orquestador de ~100 líneas
- 7 archivos extraídos en `src/components/rutas/`:
  - `types.ts` — interfaces compartidas (TareaRuta, RutaDiaria, ExternalRoute, etc.)
  - `utils.tsx` — constantes (statusColors, tipoIcons, prioridadLabels, etc.)
  - `TareasPendientesTab.tsx` — CRUD tareas pendientes con filtros
  - `GenerarRutaTab.tsx` — selección + generación de ruta + referencia externa
  - `RutasActivasTab.tsx` — gestión rutas activas con sidebar + detalle
  - `HistorialTab.tsx` — historial PEP + rutas externas con sidebar
  - `MiRutaTab.tsx` — vista mensajero con PEP tasks + DSF stops + completar/fallar
- **Tabs filtrados por rol**: admin ve [Panel, Generar Ruta, Rutas Activas, Historial]; no-admin ve [Mi Ruta, Historial]
- Detección de rol: `user?.role?.full_access === true` vía `useAuth()`
- Integración DSF: config en `.env` (`DSF_API_URL`, `DSF_API_TOKEN`) con fallback a BD
- `ExternalRoutesService` resuelve config con slug fallback: `dsf3` → `dsf`
- Health check: `GET /api/health/env` verifica variables críticas del `.env`
- **miRuta() — búsqueda por prioridad** (Mar 2026): 1) en_progreso cualquier fecha (orderBy ABS DATEDIFF), 2) confirmada hoy, 3) próxima confirmada futura. Resuelve rutas que desaparecían al iniciar o al estar planificadas a futuro.
- **Admin viewer en MiRutaTab**: query param `?mensajero_id=X` con check `full_access`. Rutas externas solo se cargan para vista propia (no al ver otro mensajero).
- **Replanificar**: `PATCH /rutas-diarias/{id}/replanificar` — cambia fecha, reset status→confirmada, reset tareas en_transito→asignada. Middleware `admin` + `throttle:60,1`.
- **Date parsing Laravel dates en frontend**: `String(ruta.fecha).split('T')[0]` porque Laravel `date` cast serializa como `"2026-03-11T00:00:00.000000Z"`, no `"2026-03-11"`.
- **Paradas externas en ruta PEP**: `generar()` acepta `external_stops[]` (branch_name, address, integration_name, external_ref, pickups_summary). Crea `TareaRuta` tipo `recoleccion` con `referencia_tipo='ExternalStop'`. Frontend selecciona stops individuales de cada ruta externa.

---

## Auditoría Seguridad — Módulo Rutas (Mar 2026)

### ✅ Fase 1 — Crítico (completado 2026-03-11)
- `auth_token`/`auth_password` cifrados con `encrypted` cast en `ExternalIntegration` + migración para datos existentes
- Ownership checks (IDOR) en `RutaDiariaController`: `index()` scoped por usuario, `show()` + `iniciar()` verifican mensajero o admin
- Ownership checks en `TareaRutaController`: `completar()` + `fallar()` verifican `asignado_a` o admin
- `external-routes` endpoints protegidos con middleware `admin`
- SSRF: validación de dominio con whitelist configurable (`ALLOWED_INTEGRATION_DOMAINS` en .env) + bloqueo de IPs privadas

### ✅ Fase 2 — Alto (completado 2026-03-12)
- Rate limiting `throttle:60,1` en endpoints de mutación (completar, fallar, iniciar, generar, confirmar, reordenar, cancelar); `throttle:30,1` en operaciones destructivas; `throttle:10,1` en test de integraciones
- `lockForUpdate()` en transiciones de estado: `confirmar()`, `iniciar()` en RutaDiariaController; `completar()`, `fallar()` en TareaRutaController
- `$request->only()` defense-in-depth en `TareaRutaController::update()` y `ExternalIntegrationController::update()`
- `max` en campos de texto sin límite: `descripcion:1000`, `direccion_destino:500`, `notas_completado:1000`

### ✅ Fase 3 — Medio (completado 2026-03-12)
- `$hidden` en ExternalIntegration: auth_token, auth_user, auth_password excluidos de JSON
- Sanitización errores: mensajes genéricos al cliente, detalles solo en Log::warning
- HttpOnly cookies: diferido — requiere migración completa auth, bajo riesgo actual

## Módulo Comentarios Internos (Mar 2026)
- **Polimórfico**: comentarios en Credit, Opportunity, Lead, Client, Analisis, User (direct)
- **Mensajes directos**: `commentable_type = 'direct'` → `App\Models\User`, `commentable_id` = user destinatario
- **Emojis**: `@emoji-mart/react` + `@emoji-mart/data`
- **GIFs**: `gif-picker-react` (Tenor API, key en `NEXT_PUBLIC_TENOR_API_KEY`)
- **GIF formato**: `[GIF](url)` en body del comentario, parseado en frontend
- **Notificaciones**: click navega a `/dashboard/comunicaciones?comment_id=X` para abrir thread
- **Mensaje directo desde burbuja**: CommentsPanel tiene botón Users en header → picker de usuarios → thread directo. Usa `activeType`/`activeId` para alternar entre modo entidad y directo
- **Burbuja chat** (`chat-bubble.tsx`): dos tabs "Directos" y "Comentarios". DMs agrupados por contacto, comentarios agrupados por entidad. Usa `/api/agents` (no `/api/users`).
- **Archivos clave**: `chat-bubble.tsx`, `comments-panel.tsx`, `comunicaciones/page.tsx`, `CommentController.php`, `Comment.php`

---

## Auditoría React/Next.js (Mar 2026) — Puntaje: 4.5/10

### Hallazgos críticos
- **82% client components** — convención moderna sugiere ~40%
- **0 archivos `loading.tsx`/`error.tsx`/`not-found.tsx`** en toda la app
- **No existe `middleware.ts`** — auth solo client-side
- ~~**`ignoreBuildErrors: true`** en next.config~~ → **RESUELTO Mar 2026**: eliminado, 22 errores TS corregidos, build limpio
- ~~**API keys hardcodeadas**~~ → **RESUELTO Mar 2026**: EVOLUTION_API_KEY movida a proxy backend (`ProxyController`), TENOR_API_KEY fallback eliminado (usa .env)
- **0 dynamic imports** — jsPDF, ExcelJS, emoji-mart, recharts en bundle global
- **Páginas monolíticas**: cobros 3,115 líneas, créditos 2,803, clientes 2,534, oportunidades 2,088
- **Sin React Query/SWR** — re-fetch en cada navegación, sin cache
- **Sin `next/image`** — 10+ tags `<img>` plain
- **Forms inconsistentes** — mix de react-hook-form+Zod y useState manual
- **jsPDF boilerplate duplicado en 5 archivos**
- **Tokens en cookies JS** (no httpOnly)

### Lo que está bien
- 100% componentes funcionales, hooks correctos
- Tailwind + cn() + CVA excelente
- CSRF bien configurado con Sanctum
- DOMPurify en dangerouslySetInnerHTML
- Promise.all para requests paralelos
- Memoización (useMemo/useCallback) extensiva
- next/link bien usado
- Custom hooks reutilizables (use-bulk-selection, use-toast, use-debounce)

---

## Deuda técnica pendiente (ver mejoras.md)

### 🔴 Alta
- ~~Mover API keys hardcodeadas al backend (Evolution, Tenor)~~ ✅ Mar 2026
- ~~Quitar `ignoreBuildErrors: true` de next.config y corregir errores TS~~ ✅ Mar 2026
- Crear `middleware.ts` para auth server-side
- Agregar `error.tsx` y `loading.tsx` en /dashboard

### 🟡 Media
- HttpOnly cookies para auth (diferido, bajo riesgo actual)
- Verificar account codes en `erp_accounting_accounts` vs plan contable del ERP real
- Implementar dynamic imports para librerías pesadas
- Romper páginas monolíticas (2000-3100 líneas) en sub-componentes
- Estandarizar todos los forms a react-hook-form + Zod
- Migrar `<img>` a `<Image>` de next/image
- Evaluar React Query/SWR para caching

### 🟢 Baja
- 13 instancias `as unknown`/`as any` en frontend
- 5 componentes en PascalCase (debería ser kebab-case)
- Accesibilidad: ARIA en forms, focus trapping, skip links

---

## Preferencias del usuario
- Comunicarse siempre en **español**
- Commits y push: solo cuando el usuario lo pida explícitamente
- Si el push es rechazado: `git pull origin main --rebase` antes de reintentar
- **Siempre actualizar `.claude/MEMORY.md` y archivos de memoria del repo** al completar cada tarea

---
---

### Contenido de: .claude/auditoria.md

# Sistema de Auditoría General — Mar 2026

## Archivos clave
| Archivo | Rol |
|---------|-----|
| `backend/database/migrations/2026_03_05_000000_create_activity_logs_table.php` | Tabla `activity_logs` |
| `backend/app/Models/ActivityLog.php` | Modelo con cast JSON para `changes` |
| `backend/app/Traits/LogsActivity.php` | Trait reutilizable |
| `backend/app/Http/Controllers/Api/ActivityLogController.php` | API |
| `src/app/dashboard/auditoria/page.tsx` | Frontend (actividad de usuarios) |
| `src/app/dashboard/auditoria-asientos/page.tsx` | Frontend (asientos contables al ERP) |
| `src/hooks/use-audit-alerts.ts` | Polling de alertas cada 5 min |
| `src/components/dashboard-nav.tsx` | Badge `!` rojo cuando `has_alerts=true` |

## Tabla activity_logs
- `user_id` (nullable), `user_name` (snapshot), `action`, `module`
- `model_type`, `model_id`, `model_label`
- `changes` (JSON: `[{field, old_value, new_value}]`)
- `ip_address`, `user_agent`, `timestamps`

## Acciones y badges
| Acción | Color |
|--------|-------|
| `create` | Verde |
| `update` | Azul |
| `delete` | Rojo |
| `login` | Gris |
| `login_failed` | Naranja |
| `logout` | Gris |
| `export`/`upload` | Amarillo |

## Controllers CON LogsActivity (31 total)
AuthController, LeadController, ClientController, UserController, CreditController,
CreditPaymentController, PlanillaUploadController, AnalisisController, OpportunityController,
TaskController, LoanConfigurationController, TasaController, DeductoraController,
AccountingEntryConfigController, ErpAccountingConfigController, SaldoPendienteController,
EnterpriseEmployeeDocumentController, InstitucionController,
InvestmentController, InvestorController, InvestmentCouponController, InvestmentPaymentController,
ProductController, RoleController, PropuestaController, PersonDocumentController,
ComisionController, VisitaController, MetaVentaController, EmbargoConfiguracionController,
TaskAutomationController, ChatMessageController, CommentController

## Controllers SIN LogsActivity (solo lectura — no necesitan)
ActivityLogController, AccountingEntryLogController, KpiController, LeadAlertController,
QuestionnaireController, QuoteController, InvestmentExportController, NotificationController,
EmbargoCalculatorController, Rewards/* (9 controllers)

## Rutas API
```
GET /api/activity-logs           # Listado paginado (filtros: user_id, module, action, search, fecha_desde, fecha_hasta, ip_address)
GET /api/activity-logs/stats     # Totales + logins_fallidos_24h
GET /api/activity-logs/alerts    # has_alerts (>5 deletes o >10 login_failed en 24h)
GET /api/activity-logs/export    # CSV streaming BOM UTF-8
GET /api/activity-logs/{id}      # Detalle
```

## Alertas en sidebar
- `useAuditAlerts(enabled)` en `dashboard-nav.tsx`
- Solo hace fetch si `canViewModule('auditoria') = true`
- Badge rojo `!` cuando `has_alerts = true`
- Módulo `auditoria` en `Role::getFormattedPermissions()`

## Bugs corregidos
- `"Logout: {$request->user()->email ?? ''}"` → PHP no permite `??` dentro de `{}`
  - Fix: `'Logout: ' . ($request->user()?->email ?? '')`
- Rutas del módulo faltaban prefijo `/api/` → causaba 404 en todas las llamadas

---
---

### Contenido de: .claude/mejoras.md

# Análisis de Mejoras — CR Studio (Mar 2026)

## Resuelto

| Fecha | Mejora |
|-------|--------|
| Mar 2026 | 50 `console.log` de debug eliminados (7 archivos) |
| Mar 2026 | PDF estado de cuenta: filtrar solo cuotas `'Pagado'/'Pagada'` en cobros, creditos, clientes |
| Mar 2026 | Tasa hardcodeada 25% → leer de `/api/loan-configurations/activas` en oportunidades |
| Mar 2026 | Módulo Auditoría General completo |
| Mar 2026 | Auditoría Asientos movida a página standalone en sidebar |
| Mar 2026 | Fix prefijo `/api/` faltante en módulo auditoría |
| Mar 2026 | Fix PHP syntax error `??` dentro de `{}` en AuthController |
| Mar 2026 | Archivo `nul` basura en backend/ eliminado |
| Mar 2026 | `sender_name: 'Agente'` → `user?.name \|\| 'Agente'` en `comunicaciones/page.tsx` (usando `useAuth()`) |
| Mar 2026 | Todas las rutas de `api.php` protegidas con `auth:sanctum` — solo público: register, login, plan-pdf/excel, exports de inversiones |
| Mar 2026 | `configuracion/page.tsx`: eliminado tab duplicado `auditoria-asientos` + componente `AccountingAuditLog` (544 líneas → de 5,675 a 5,142) |
| Mar 2026 | `configuracion/page.tsx`: tab Contabilidad ERP extraído a `ContabilidadErpTab.tsx` (5,142 → 4,035 líneas) |
| Mar 2026 | Fix permisos sidebar vacío para usuarios no-admin: PermissionsContext usa `/me` en vez de endpoints con middleware admin |
| Mar 2026 | `configuracion/page.tsx` dividido en 12 componentes (4,035 → 96 líneas) |
| Mar 2026 | Fix inversiones vacías para no-admin: `/api/users` (middleware admin) estaba en `Promise.all` bloqueando todos los datos |
| Mar 2026 | `CreditPaymentController` refactorizado: 2,868 → 406 líneas. Lógica extraída en 7 Services |
| Mar 2026 | **149 `as any` → 0** en 13 archivos frontend. Tipos extendidos en `data.ts`, interfaces locales actualizadas, jsPDF tipado con `unknown` cast |
| Mar 2026 | 9 `Log::error/warning` mejorados con contexto (IDs, trace, datos relevantes) en 7 archivos backend |
| Mar 2026 | Notificaciones de tareas vencidas: badge rojo en sidebar + pestaña "Tareas" en popover de notificaciones del header |
| Mar 2026 | Módulo Inversiones — Auditoría completa: 3 mejoras implementadas (ver detalle abajo) |
| Mar 2026 | Módulo Inversiones — Fase 2: O5, O6, O7, O8, O9, O10 implementados (ver detalle abajo) |
| Mar 2026 | TareasTab extraído a `src/components/TareasTab.tsx`: 5 implementaciones inline → 1 componente reutilizable (-2,126 líneas en leads, oportunidades, analisis, creditos, clientes) |
| Mar 2026 | Integración API Credid: backend service + controller + endpoint, auto-consulta al crear análisis (wizard pre-llena paso 3 + cargo/nombramiento), botón manual en detalle para re-consultar |
| Mar 2026 | Wizard análisis reordenado: Paso 1=Historial Crediticio (Credid), Paso 2=Info Básica, Paso 3=Ingresos, Paso 4=Documentos |
| Mar 2026 | Estados de juicios normalizados: `En Trámite` / `Finalizado` en backend (CredidService, validaciones) y frontend (tipos, wizard, badges) |
| Mar 2026 | Fix producción Credid: `$response->json()` retornaba string → fallback con `json_decode` + validación de tipo en `CredidService` |
| Mar 2026 | `due_date` configurable en automatizaciones: campo `due_days_offset` en `task_automations` (default 3 días). Actualizado en 7 puntos de creación (6 controllers + 1 command). UI con input numérico en Configuración > Tareas Automáticas |
| Mar 2026 | Detalle de tarea (`tareas/[id]/page.tsx`): Timeline real desde `activity_logs` con diffs visuales, archivos adjuntos (upload/download/delete con `task_documents`), campos editables (título, descripción, prioridad, asignado, fechas). Backend: modelo `TaskDocument`, migración, 4 endpoints nuevos |
| Mar 2026 | Seguridad tareas: `/api/task-automations` protegido con middleware `admin`. Índices BD en `tasks` (`assigned_to`, `status`, `due_date`) para rendimiento |
| Mar 2026 | Permisos granulares en tareas: middleware `permission:tareas,{action}` en 7 rutas (create, edit, delete, archive, restore, upload doc, delete doc). Lectura y view sin restricción adicional |
| Mar 2026 | `project_code` estandarizado: formato `{MODULO}-{ID}` (LEAD, OPP, ANA, CRED, CLIENT). 6 controllers + 1 command + migración de datos existentes. Frontend con `parseProjectCode()` y links automáticos por módulo |
| Mar 2026 | Campo `reference` (TA-XXXX) en tabla `tasks`: auto-generado al crear, único, con índice. Búsqueda server-side por `?search=` (reference, title, project_code) |
| Mar 2026 | Módulo Reportes completo: 6 tabs (Cartera Activa, Mora, Por Deductora, Novedades de Planilla, Cobros, Inversiones). Backend: `ReporteController` con 15 endpoints. Novedades de Planilla detecta inclusiones/exclusiones/cambios de cuota por deductora |
| Mar 2026 | Subtareas/checklist en tareas: `task_checklist_items` + `task_automation_checklist_items` (plantillas). UI: checklist con barra de progreso en detalle, plantillas editables en Configuración > Tareas Automáticas. 8 controllers actualizados con `copyChecklistFromAutomation()` |
| Mar 2026 | Limpieza de tareas huérfanas: `Task::where('project_code', 'PREFIX-'.$id)->delete()` en 5 controllers (Lead, Opportunity, Analisis, Credit, Client) al eliminar entidades |
| Mar 2026 | Auth "Recordarme": cookie 30 días (persistent) vs session cookie. Auto-redirect a `/dashboard` si ya logueado |
| Mar 2026 | Integración DSF: config en `.env` con fallback a BD, health check `/api/health/env`, Artisan `route-token:manage` en DSF3 |
| Mar 2026 | `rutas/page.tsx` refactorizado: 1,672 → ~100 líneas orquestador + 7 archivos en `src/components/rutas/`. Tabs filtrados por rol (admin vs mensajero) |
| Mar 2026 | Paginación en reportes: componente `TablePagination` (25 filas/pág) en Cartera Activa y Cobros. Reset automático al cambiar filtros |
| Mar 2026 | Búsqueda client-side en reportes: input de búsqueda por cliente/cédula/referencia en CarteraTab, MoraTab y CobrosTab. Integrado con paginación (reset a página 1 al buscar) |
| Mar 2026 | R4 — Gráfico de fuentes de cobro: PieChart + tabla con monto y conteo por fuente (Ventanilla, Planilla, SINPE, etc.) en tab Cobros |
| 2026-03-11 | **Auditoría Seguridad Rutas — Fase 1 completa**: tokens cifrados con `encrypted` cast, ownership checks (IDOR) en RutaDiariaController y TareaRutaController, middleware admin en external-routes, validación SSRF de dominio con whitelist |
| 2026-03-12 | **Auditoría Seguridad Rutas — Fase 2 completa**: rate limiting `throttle:60,1` en mutations, `lockForUpdate()` en transiciones de estado, `$request->only()` defense-in-depth, `max` en campos de texto sin límite |
| 2026-03-12 | **Auditoría Seguridad Rutas — Fase 3 completa**: `$hidden` en ExternalIntegration (auth_token/user/password excluidos de JSON), sanitización mensajes de error (genéricos al cliente, detalles en Log::warning), truncado last_sync_message a 200 chars |
| 2026-03-12 | **Comentarios internos — Mensajes directos**: tipo `direct` (commentable_type=User) permite conversaciones entre usuarios sin vincular a entidad. Backend: typeMap + notificación automática. Frontend: botón "Mensaje directo" en comunicaciones con selector de usuario |
| 2026-03-12 | **Comentarios internos — Emojis y GIFs**: `@emoji-mart/react` para picker de emojis, `gif-picker-react` (Tenor API) para GIFs. Integrado en comments-panel.tsx y comunicaciones/page.tsx (compose, reply, direct) |
| 2026-03-12 | **Notificaciones → Comunicaciones**: click en notificación de comentario ahora navega a `/dashboard/comunicaciones?comment_id=X` y abre el thread automáticamente, en vez de ir directo a la entidad |
| 2026-03-12 | **Comentarios — Fix GIF/Direct**: GIFs como imagen en thread, "GIF" en preview lista. Directos agrupados por usuario en bandeja. `previewBody()` para listas |
| 2026-03-12 | **Comentarios — Mensaje directo desde burbuja**: CommentsPanel (sidebar flotante) ahora permite iniciar mensajes directos con botón Users en header, picker de usuarios con buscador, y envío/carga de thread directo. `comments-panel.tsx` |
| 2026-03-12 | **Burbuja chat — DMs estilo WhatsApp + GIFs**: mensajes directos filtrados del feed principal (solo aparecen en modo directo). Vista directa con burbujas alineadas izq/der según emisor (estilo WhatsApp). GIFs en preview muestran "🎞 GIF" en vez de URL cruda. `extractGifUrl()`, `isGifMessage()` helpers. `chat-bubble.tsx` |
| 2026-03-12 | **Burbuja chat — accesible para todos los usuarios**: `/api/users` (middleware admin) reemplazado por `/api/agents` (solo auth:sanctum) para listar usuarios en el chat. Cualquier usuario autenticado puede usar la burbuja de comunicaciones. `chat-bubble.tsx` |
| 2026-03-12 | **Burbuja chat — tabs separados estilo WhatsApp**: dos tabs "Directos" y "Comentarios" separados. DMs agrupados por contacto (un ítem por conversación con último mensaje). Comentarios de entidades agrupados por entidad (un ítem por entidad con último comentario). Botón "Nuevo mensaje" en tab Directos. Helpers `groupDirectsByContact()` y `groupByEntity()`. `chat-bubble.tsx` |
| 2026-03-12 | **Planilla de Cobro — Mejoras completas**: (1) Fix `?` → `₡` en todos los PDFs (charset UTF-8 + DejaVu Sans), (2) Nuevas columnas: F. Formalización, Tasa %, Plazo, Tipo Movimiento (reemplaza Estado), (3) PDF landscape para más espacio, (4) Tabla `deductora_changes` para historial de movimientos: inclusión, exclusión, traslado entre cooperativas, refundición, (5) Modelo `DeductoraChange` con helpers estáticos para registrar automáticamente, (6) Tracking automático al formalizar, cancelar, refundir y trasladar deductora, (7) Novedades de Planilla expandido: 5 secciones (inclusiones, exclusiones, traslados, refundiciones, cambios cuota), (8) Control mensual: tabla `planilla_reports` + endpoint `/api/reportes/planilla-reports-status`, (9) Frontend actualizado: 5 tarjetas resumen, secciones con tablas especializadas por tipo |
| 2026-03-12 | **Fix Estado de Cuenta inversiones — cancelación sin intereses**: `cancelacionTotal('sin_intereses')` ya no zerear `monto_capital`/`interes_mensual`. PDF reconstruye capital original como safety net. Nueva columna "Intereses Pendientes". Nuevo estado `Capital Devuelto` cuando se devuelve capital pero quedan intereses pendientes — auto-finaliza al pagar todos los cupones. Migración ENUM + corrección datos existentes. Frontend: badge, filtros y selects actualizados. Archivos: `InvestmentService.php`, `InvestmentExportController.php`, `estado_cuenta_inversion.blade.php`, `InvestmentCouponController.php`, `InvestmentController.php`, páginas frontend inversiones |
| 2026-03-12 | **Rutas — Fix críticos (4)**: (1) SSRF protection activada en ExternalRoutesService, (2) validación pertenencia tareas en reordenar, (3) status `fallida` ahora se usa correctamente (fallar→fallida, no pendiente; frontend muestra badge+motivo, generar acepta fallidas), (4) AlertDialog confirmación antes de eliminar tarea |
| 2026-03-12 | **Rutas — Fase 2 performance/validaciones (5)**: (1) `recalcularConteo()` + auto-completar ruta cuando no quedan tareas activas, (2) paginación `index()` (50/pág, max 100) + frontend compatible, (3) validación `after_or_equal:today` en fecha generar, (4) `cancelar()` preserva tareas completadas (desvincula sin cambiar status), (5) `destroy()` permite eliminar tareas fallidas |
| 2026-03-12 | **Rutas — Fase 3 features (2)**: (1) Notificación al mensajero cuando su ruta es confirmada (modelo `Notification` custom, tipo `ruta_confirmada`), (2) Evidencia fotográfica en tareas: modelo `TareaRutaEvidencia`, migración, 3 endpoints (list/upload/delete), upload multipart con validación mimes+size, storage `ruta-evidencias/`, frontend con file picker en diálogo completar + contador evidencias en tareas completadas |
| 2026-03-13 | **Rutas — Fase 4 (4 mejoras)**: (1) `miRuta()` reescrito con búsqueda por prioridad: en_progreso (cualquier fecha) > confirmada hoy > próxima confirmada futura — resuelve rutas que desaparecían al iniciar o al estar planificadas a futuro, (2) Admin viewer: selector de mensajero en MiRutaTab con query param `?mensajero_id=X` + check `full_access`, rutas externas solo para vista propia, (3) Endpoint `PATCH /rutas-diarias/{id}/replanificar`: cambia fecha + reset status a confirmada + reset tareas en_transito, (4) Badge "Vencida" en RutasActivasTab con botón Replanificar (date picker) y Cancelar para rutas expiradas. Fix date parsing: `String(ruta.fecha).split('T')[0]` para ISO de Laravel |
| 2026-03-13 | **Rutas — Paradas externas en ruta PEP**: stops de integraciones externas (DSF) ahora son seleccionables con checkbox en GenerarRutaTab. Backend `generar()` acepta `external_stops` y crea `TareaRuta` (tipo recoleccion, referencia_tipo=ExternalStop) por cada parada. Frontend muestra stops con icono Globe verde, resumen en panel derecho, y envía ambos arrays al generar |
| 2026-03-13 | **Auditoría Seguridad Credid — 7 fixes**: (1) `status()` protegido con `admin` middleware — ya no expone URL, token length ni body_preview con PII, (2) `status()` usa `CredidService::verificarConfiguracion()` en vez de leer config directo, (3) `throttle:10,1` en ambas rutas credid, (4) Token en query string documentado como limitación de Credid API, (5) Validación cédula stricta: regex `/^\d{9,12}$/` en vez de `min:5\|max:20`, (6) `LogsActivity` trait en `CredidController` para auditoría, (7) Cédulas enmascaradas en logs de `CredidService` (`*****6789`) |
| 2026-03-14 | **Auditoría Seguridad Global — 5 fixes críticos**: (C1) throttle en 40+ rutas financieras/mutación (inversiones, créditos, pagos, comisiones, embargos, ERP, propuestas, uploads, quotes, etc.), (C2) `/health/env` ya no expone detalles de integración — solo status global ok/degraded, (C3) Validación mimes+max:10240 en `CreditController::storeDocument`, (C4) `DB::transaction + lockForUpdate()` en 11 operaciones financieras: InvestmentController (4), InvestmentCouponController (4), ComisionController (4), (C5) DOMPurify sanitización XSS en `dangerouslySetInnerHTML` de chat-bubble.tsx y comunicaciones/page.tsx |
| 2026-03-16 | **Verificación Bancaria de Abonos**: Flujo completo de aprobación antes de aplicar abonos manuales. Tabla `payment_verifications`, `PaymentVerificationController` (store/respond/apply/cancel/index), comments con `comment_type` y `metadata` para cards embebidos interactivos (solicitud + respuesta), auto-creación de tarea + mensaje directo + notificación. Verificador configurable via `TaskAutomation` event_type=`payment_verification`. Backward compatible: sin automatización activa el abono se aplica directo |
| 2026-03-16 | **Documentos: "Ambas caras en este archivo"**: Botón en DocumentManager permite marcar un PDF/imagen de cédula como conteniendo frente y reverso. Backend `POST /person-documents/{id}/mark-dual` crea segundo registro `cedula_reverso` apuntando al mismo archivo, con auto-sync a oportunidades. El checklist de documentos faltantes se actualiza automáticamente |
| 2026-03-14 | **Datos Adicionales Leads/Clientes — Credid**: Sección siempre visible en detalle de Lead y Cliente con 3 paneles (Personal, Patrimonio, Cumplimiento). Migración: 13 columnas resumen + JSON cache en `persons`. `CredidService` extendido con `extraerDatosPersonales()` + `sincronizarLead()` (auto-fill respetando prioridad Cuestionario > Manual > Credid). Auto-consulta al crear Lead en `store()`. Endpoints manuales `POST /leads/{id}/consultar-credid` y `POST /clients/{id}/consultar-credid`. Frontend: estados, handlers, UI idéntica en ambas páginas. Tipos actualizados en `data.ts` (Lead + Client) |

## Pendiente — Media prioridad

### Migrar ERP de email/password a Service Token HMAC — COMPLETADO (2026-03-12)
- **Implementado**: `ErpAccountingService` usa Service Token con HMAC (X-Service-Token, X-Timestamp, X-Nonce, X-Signature)
- **Eliminado**: todo código legacy (authenticate, getToken, clearToken, sendWithRetry, cache de Bearer token, reintento 401)
- **Archivos modificados**: `.env` (solo ERP_SERVICE_URL/TOKEN/SECRET), `config/services.php` (limpiado refs legacy), `ErpAccountingService.php` (código legacy eliminado), `routes/api.php` (health check actualizado)
- **Test exitoso**: conexión OK, auth HMAC funcional, 422 por account codes = validación de negocio (auth pasó correctamente)
- **Pendiente**: verificar que los account codes en `erp_accounting_accounts` coincidan con el plan contable del ERP real

### HttpOnly cookies (diferido)
- Migrar auth de Sanctum token en header a HttpOnly cookies
- Bajo riesgo actual: API interna, requiere cambio completo frontend+backend

## Pendiente — Alta prioridad (Auditoría React Mar 2026)

| # | Acción | Categoría |
|---|--------|-----------|
| ~~1~~ | ~~Mover EVOLUTION_API_KEY y TENOR_API_KEY al backend (proxy)~~ ✅ `ProxyController` + .env backend | Seguridad |
| ~~2~~ | ~~Quitar `ignoreBuildErrors: true` de next.config.ts y corregir 22 errores TS~~ ✅ Build limpio | Calidad |
| 3 | Crear `middleware.ts` para auth/redirect server-side | Seguridad |
| 4 | Agregar `error.tsx` y `loading.tsx` en `/app/dashboard/` | UX |
| 5 | Implementar `dynamic()` imports: jsPDF, ExcelJS, emoji-mart, recharts | Performance |
| 6 | Romper páginas gigantes en sub-componentes (cobros 3115, creditos 2803, clientes 2534, oportunidades 2088 líneas) | Mantenibilidad |

## Pendiente — Media prioridad (Auditoría React Mar 2026)

| # | Acción | Categoría |
|---|--------|-----------|
| 7 | Estandarizar forms a react-hook-form + Zod (eliminar useState manual) | Consistencia |
| 8 | Migrar `<img>` a `<Image>` de next/image (10+ instancias) | Performance |
| 9 | Evaluar React Query/SWR para caching de requests | Performance |
| 10 | Extraer jsPDF boilerplate a `/lib/pdf-helpers.ts` (duplicado en 5 archivos) | DRY |
| 11 | Metadata dinámica con `generateMetadata()` por página | SEO |
| 12 | Mover tokens a httpOnly cookies server-set | Seguridad |

## Pendiente — Baja prioridad

### Pendiente Rewards (baja prioridad)
- Custom exceptions en vez de `\Exception` genérico
- Tests del módulo

## Auditoría Módulo Inversiones (Mar 2026)

### Implementado en esta sesión
- **O2**: Calculadora de interés diario ahora usa convención Actual/Actual — detecta si el período incluye 29-Feb y usa base 366 en años bisiestos. UI muestra "base 366 (bisiesto)" cuando aplica. `inversiones/[id]/page.tsx`
- **O3**: Indicador visual de mora en Tabla General — backend `InvestmentService@getTablaGeneral` agrega `overdue_coupons_count` vía `withCount`. Frontend colorea la fila rojo claro y muestra ícono con tooltip si hay cupones atrasados. `page.tsx` + `InvestmentService.php`
- **O4**: Sección Pagos Próximos — banner rojo al tope si hay meses con cupones atrasados (muestra cantidad y montos totales); separador visual "PRÓXIMOS PAGOS" entre la sección de atrasados y futuros. `page.tsx`

### Implementado en Fase 2 (Mar 2026)
- **O5**: Banner de alerta en dashboard si hay inversiones vencidas o que vencen en <=30 días. `vencimientos` se carga en el `useEffect` inicial. Banner sobre los Tabs con botón "Ver vencimientos". `page.tsx`
- **O6**: Filtros avanzados en TablaGeneralSection — se añadieron filtros por moneda (CRC/USD) y rango de tasa (min/max %). `page.tsx`
- **O7**: Botón "Editar" en menú dropdown de `InvestorTableRow`. `InvestorFormDialog` pasa `investor={editingInvestor}` para modo edición. `page.tsx`
- **O8**: Tab "Historial de Pagos" en detalle del inversionista (`inversionista/[id]/page.tsx`). Página reestructurada con Tabs: Activas / Otras / Historial de Pagos. Nuevo componente `PaymentsTable`. Se agregó `payments?: InvestmentPayment[]` al tipo `Investor` en `data.ts`.
- **O9**: `InvestmentService@renewInvestment` valida que la inversión sea Activa/Finalizada y que no tenga cupones Pendientes antes de renovar. Aborta con 422 si falla. `InvestmentService.php`
- **O10**: Mensaje en `cancelacionTotal()` corregido de "Solo se pueden finalizar..." a "Solo se pueden realizar abonos totales...". `InvestmentController.php`

### Implementado en Fase 3 — Seguridad y Calidad (Mar 2026)
- **S1**: Rutas export movidas a grupo `auth:sanctum` en `api.php`. Helper `downloadExport()` en `src/lib/download-export.ts` reemplaza todos los `window.open()` de exports de inversiones.
- **S3**: `markPaid` verifica estado=Activa antes de pagar. `markBulkPaid` filtra con `whereHas(investment, estado=Activa)`. `InvestmentCouponController.php`
- **S4**: `unique:investors,cedula` en store; `unique:investors,cedula,{id}` en update. `InvestorController.php`
- **S5**: Ya estaba correcto — `registered_by => required|exists:users,id` ya existía.
- **S6**: `liquidateEarly()` aborta 422 si no está Activa. `InvestmentService.php`
- **S7**: `console.error` silenciosos reemplazados por `toastError()` en fetch functions de los 3 archivos. Cargas opcionales de fondo (vencimientos, tipoCambio) permanecen silenciosas.

### Fixes Rewards (11 Mar 2026)
- LogsActivity añadido a CatalogController, ChallengeController, GamificationConfigController
- Fallback inseguro `User::firstOrFail()` → `abort(401)` en 6 controllers Rewards
- División por cero en ChallengeService (`target=0` → progress=0 en vez de 1)
- Notificaciones habilitadas en listener BadgeEarned + BadgeEarnedNotification + migración notifications
- Magic numbers → constantes y config en StreakService, LeaderboardService, CatalogService, RedemptionService
- `settings.local.json` removido de git tracking
- `.claude/` excepciones en .gitignore para archivos de memoria
- **S10**: Índice en `numero_desembolso` — migración creada

### Pendiente (del plan de auditoría)
- **O1**: Capitalización — el negocio confirmó que capitalizar por interés neto está correcto. Sin cambio.

## Estadísticas del proyecto
- Backend PHP: 163 archivos
- Frontend TS/TSX: 146 archivos
- Controllers Api/: 38 archivos
- Páginas dashboard: ~35 páginas

---
---

### Contenido de: .claude/modulo-inversiones.md

# Módulo de Inversiones — Especificación Completa

**Fecha de creación:** 2026-03-04
**Estado:** Pendiente de implementación
**Proyecto:** CR Studio (Laravel 12 + Next.js)

---

## Contexto

Módulo para gestionar inversiones de terceros (inversionistas) en la cooperativa.
Basado en un Excel existente con dos secciones: **Dólares (USD)** y **Colones (CRC)**.

---

## Reglas de negocio

| Campo | Fórmula / Regla |
|---|---|
| Interés mensual | `Monto × Tasa_anual / 12` |
| Retención 15% | `Interés_mensual × 0.15` (obligatorio por ley) |
| Interés por pagar | `Interés_mensual − Retención_15` |
| Conversión USD→CRC | Solo en inversiones en dólares, tipo de cambio configurable |
| Fecha vencimiento | `Fecha_inicio + Plazo_meses` |
| Al editar tasa | Regenerar toda la tabla de pagos automáticamente |

**Formas de pago soportadas:**
- `mensual` — pago cada mes
- `trimestral` — pago cada 3 meses
- `semestral` — pago cada 6 meses
- `reserva` — acumula y paga todo al vencimiento

**Estados de una inversión:**
- `activa` — vigente
- `por_vencer` — vence en ≤ 30 días (calculado, no almacenado)
- `vencida` — pasó la fecha de vencimiento sin renovar/cancelar
- `renovada` — fue renovada (la nueva inversión referencia a esta)

---

## Base de datos

### Tabla `investors`
```
id
name              string        — Nombre completo o razón social
cedula            string        — Cédula o pasaporte
tipo              enum          — persona / empresa
email             string nullable
telefono          string nullable
banco             string nullable
cuenta_bancaria   string nullable
moneda_preferida  enum          — USD / CRC
observaciones     text nullable
timestamps
```

### Tabla `investments`
```
id
investor_id       FK → investors
numero_desembolso string        — Número correlativo o referencia
moneda            enum          — USD / CRC
monto             decimal(15,2)
plazo_meses       integer
fecha_inicio      date
fecha_vencimiento date          — Calculada: fecha_inicio + plazo_meses
tasa_anual        decimal(8,4)  — Editable, dispara regeneración de pagos
forma_pago        enum          — mensual / trimestral / semestral / reserva
estado            enum          — activa / vencida / cancelada / renovada
tipo_cambio       decimal(10,4) nullable  — Solo USD, para conversión a CRC
investment_origen_id FK nullable — Si es renovación, apunta a la inversión original
observaciones     text nullable
cancelado_por     string nullable
fecha_cancelacion date nullable
timestamps
```

### Tabla `investment_payments` (tabla de amortización)
```
id
investment_id     FK → investments
numero_pago       integer
fecha_pago        date          — Fecha programada
interes_bruto     decimal(15,2) — Interés mensual/trimestral/semestral calculado
retencion_15      decimal(15,2) — 15% del interés bruto
interes_neto      decimal(15,2) — interes_bruto - retencion_15
estado            enum          — pendiente / pagado / vencido
fecha_pago_real   date nullable — Fecha real en que se pagó
comprobante       string nullable — Ruta a archivo adjunto
notas             string nullable
timestamps
```

---

## API Backend (Laravel)

```
# Inversionistas
GET    /api/investors                         Listado
POST   /api/investors                         Crear
PUT    /api/investors/{id}                    Editar
DELETE /api/investors/{id}                    Eliminar

# Inversiones
GET    /api/investments                       Listado (filtros: investor_id, moneda, estado, fecha)
POST   /api/investments                       Nueva inversión + genera tabla de pagos
GET    /api/investments/{id}                  Detalle + tabla de pagos
PUT    /api/investments/{id}                  Editar (si cambia tasa → regenera pagos)
POST   /api/investments/{id}/cancel           Cancelar inversión
POST   /api/investments/{id}/renew            Renovar (crea nueva inversión referenciando esta)

# Pagos
GET    /api/investments/{id}/payments         Tabla de amortización
PATCH  /api/investments/{id}/payments/{pid}   Marcar pago como realizado / subir comprobante

# Exportación
GET    /api/investments/export/excel          Excel con sección USD y CRC (igual al original)
GET    /api/investments/export/pdf            PDF estado de cuenta por inversionista

# Utilidades
GET    /api/investments/preview               Preview de tabla de pagos antes de guardar
GET    /api/investments/vencimientos          Próximos vencimientos (30/60/90 días)
```

---

## Frontend (Next.js)

### Estructura de páginas
```
/dashboard/inversiones/
  page.tsx              — Vista principal: tabla + filtros + resumen financiero
  nueva/page.tsx        — Formulario nueva inversión con preview en tiempo real
  [id]/page.tsx         — Detalle: datos editables + tabla de amortización
```

### Vista principal `/dashboard/inversiones`
- **Resumen al tope:** Total invertido USD | Total invertido CRC | Intereses mensuales a pagar
- **Filtros:** Inversionista, Moneda, Estado, Rango de fechas de vencimiento
- **Tabla:** # Desembolso, Inversionista, Monto, Moneda, Plazo, Fecha inicio, Vencimiento, Tasa, Forma de pago, Estado, Acciones
- **Acciones por fila:** Ver detalle, Editar, Renovar, Cancelar
- **Botones globales:** Nueva Inversión, Exportar Excel, Exportar PDF

### Formulario nueva inversión
- Al cambiar tasa o monto → recalcula preview de pagos en tiempo real (sin llamada API, cálculo frontend)
- Preview muestra tabla de amortización completa antes de guardar
- Selector de inversionista existente o botón "Crear nuevo inversionista"

### Vista detalle `[id]`
- Datos de la inversión todos editables inline
- Al cambiar tasa → botón "Recalcular" que regenera la tabla de pagos (con confirmación si ya hay pagos realizados)
- Tabla de amortización: cada fila con botón "Marcar pagado" + adjuntar comprobante
- Historial de cambios de tasa (auditoría)
- Botón "Renovar" abre modal con las condiciones de renovación (editables)
- Botón "Cancelar inversión" con confirmación y motivo

---

## Funcionalidades adicionales confirmadas

| Funcionalidad | Descripción |
|---|---|
| Dashboard de vencimientos | Inversiones que vencen en 30/60/90 días |
| Historial de cambios de tasa | Auditoría: usuario, fecha, tasa anterior, tasa nueva |
| Comprobante de pago | Adjuntar imagen/PDF al registrar cada pago |
| Renovación parcial | Renovar solo una parte del capital; el resto se devuelve |
| Tipo de cambio configurable | USD→CRC configurable, puede variar por período |
| Reporte de retenciones | Resumen mensual del 15% retenido (para declaración tributaria) |
| Calendario de pagos | Vista calendario con pagos programados del mes |
| Multi-cuenta bancaria | Cada inversionista puede tener cuentas en USD y CRC |

---

## Exportaciones

### Excel
- Formato idéntico al Excel original
- Sección DOLARES + sección COLONES en la misma hoja o en hojas separadas
- Fila de totales al final de cada sección
- Filtrable por período o inversionista

### PDF
- Encabezado con logo y datos de la empresa
- Datos del inversionista
- Tabla de inversiones activas
- Tabla de pagos del período seleccionado
- Total de intereses pagados y retenciones del período

---

## Estimado de implementación

| Fase | Tarea | Días |
|---|---|---|
| 1 | Migraciones (investors, investments, investment_payments) | 0.5 |
| 2 | Backend CRUD inversiones + lógica de generación de pagos | 2 |
| 3 | Backend renovación, cancelación, exportación | 1 |
| 4 | Frontend: vista principal + filtros | 1.5 |
| 5 | Frontend: formulario nueva inversión + preview | 1 |
| 6 | Frontend: detalle + tabla de amortización editable | 1 |
| 7 | Exportación PDF + Excel | 1 |
| 8 | Pruebas y ajustes | 1 |
| **Total** | | **~9 días** |

---

## Notas para implementación

- Seguir el mismo patrón STI del resto del proyecto donde aplique
- Auth: Sanctum, mismo middleware que el resto de rutas
- Validaciones Laravel en FormRequest separados por recurso
- Frontend: mismos componentes UI (shadcn) que el resto del proyecto
- El cálculo de la tabla de pagos debe vivir en un Service de Laravel (`InvestmentPaymentService`) para reutilizarlo en creación, edición y preview
- El campo `tasa_anual` debe guardar historial en tabla separada `investment_rate_history` (investor_id, tasa_anterior, tasa_nueva, cambiado_por, created_at)

---
---

## Skills

Se han identificado un total de **18 skills** en el directorio `.claude/skills/`.
