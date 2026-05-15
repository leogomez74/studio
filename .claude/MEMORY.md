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
| Tareas | `/dashboard/tareas` | ✅ (refactorizado Mar 2026 — workflows, Kanban, calendario, labels, watchers) |
| Reportes | `/dashboard/reportes` | ✅ Mar 2026 (5 tabs — Inversiones removido, tiene su propia sección) |
| Rutas | `/dashboard/rutas` | ✅ Mar 2026 (refactorizado: 1,672 → ~100 líneas orquestador + 5 tabs + types + utils) |
| Ventas | `/dashboard/ventas` | ✅ Abr 2026 — rediseño completo (ver PLAN_MODULO_VENTAS.md) |

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
- **Embargo fecha_inicio optional (Abr 2026):** `fecha_inicio` es nullable en `embargo_detalles` (migración `2026_04_21`). `UpdateAnalisisRequest` y `StoreAnalisisRequest` usan `nullable|date`. UI muestra 'Sin fecha' si es null. Embargos tienen botón Trash + dialog de confirmación para eliminar (filtra array y re-envía vía PUT /api/analisis/{id}).
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

## Módulo de Verificación Bancaria (Mar 2026)
- **Flujo**: Captura de datos de abono → Solicitud a verificador (Task + DM + Notificación) → Aprobación/Rechazo interactivo → Aplicación final por el solicitante.
- **Interacción**: Tarjetas interactivas en Chat y Comunicaciones con aprobación directa y campo de notas.
- **Configuración**: El verificador se define en `task_automations` bajo el evento `payment_verification`.
- **Backend**: `PaymentVerificationController.php`, robustez con null coalescing en notas y transacciones seguras.

## Módulo Comentarios Internos (Mar 2026)
- **Polimórfico**: comentarios en Credit, Opportunity, Lead, Client, Analisis, User (direct).
- **Mensajes directos**: `commentable_type = 'direct'` → `App\Models\User`, `commentable_id` = user destinatario.
- **Privacidad**: Mensajes directos solo visibles para emisor y receptor (filtrado en `CommentController@recent`).
- **Agrupamiento**: 
  - Directos: Agrupados por contacto (el "otro" usuario) para evitar duplicados.
  - Entidades: Agrupados por `type:id` para mostrar solo el más reciente por Crédito/Lead.
- **Fix Carga de Hilos**: Hilos directos resuelven dinámicamente el `targetId` según quién es el contacto (emisor o receptor), evitando chats vacíos.
- **Emojis/GIFs**: Integrados con picker y formato `[GIF](url)`.
- **Burbuja chat**: Tabs "Directos" y "Comentarios" con ancho ampliado al 85% para tarjetas de verificación.
- **Archivos clave**: `chat-bubble.tsx`, `comments-panel.tsx`, `comunicaciones/page.tsx`, `CommentController.php`, `Comment.php`.
- **Filtro teléfonos válidos (Abr 2026)**: `WhatsappController::conversations()` y `syncChats()` filtran `CHAR_LENGTH(phone_number) BETWEEN 7 AND 15` (E.164). Excluye grupos (>15 dígitos) Y JIDs internos de WhatsApp como status/newsletters/lid (<7 dígitos). También se filtra por JID type: `@g.us`, `@broadcast`, `@newsletter`, `@lid`. 54 registros inválidos limpiados de la BD.
- **Aliases de números (Abr 2026)**: Tabla `whatsapp_contacts` (phone_number + alias por instancia). Endpoints: `POST /api/whatsapp/contacts`, `DELETE /api/whatsapp/contacts/{phone}`. UI: lápiz en hover de cada fila en lista (edición inline sin abrir chat) + ícono `@` en header del chat abierto. El alias tiene prioridad sobre contact_name. También buscable en filtro.
- **Integración Chatwoot (Abr 2026)**: Cuando una instancia Evolution está sincronizada con Chatwoot, Evolution no notifica directamente — lo hace Chatwoot. Solución: `chatwoot_inbox_id` (nullable) en `evolution_instances` vincula instancia ↔ inbox. Webhook público `POST /api/webhooks/chatwoot` → `ChatwootWebhookController::handle()` procesa evento `message_created` y hace upsert en `whatsapp_messages`. Endpoint admin: `PATCH /api/evolution-instances/{id}/chatwoot` para configurar la vinculación. UI: columna "Chatwoot" en tabla de instancias + dialog para ingresar el inbox ID.
- **Bug crítico PHP groupBy + JSON**: `groupBy('phone_number')` en PHP castea claves numéricas puras a int → JSON sin comillas → Laravel rechaza con "must be a string". Fix: `(string) $phone` en el `return` del `map()`. También `String(phone)` en el frontend como defensa secundaria.
- **WhatsApp bubble — emojis en composer (Abr 2026)**: El tab de WhatsApp en `chat-bubble.tsx` ahora tiene botón `Smile` propio con `@emoji-mart/react`, inserción del emoji en la posición del cursor sobre `waInput`, cierre por click fuera y preservación del foco/caret tras insertar. Este paso no toca aún micrófono ni media.
- **WhatsApp bubble — micrófono UX local (Abr 2026)**: El composer del tab WhatsApp ahora alterna `Mic`/`Send` según `waInput`. Si no hay texto, el botón principal inicia grabación con `MediaRecorder`, oculta el input y muestra estado `Grabando audio...` con contador y acciones cancelar/detener. Al detener, se muestra una vista previa local del audio con `<audio controls>` y acciones cancelar/enviar. El envío real del audio a Evolution sigue pendiente del siguiente paso.

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

## Módulo Tareas — Sistema de Workflows tipo Jira/Notion (Mar 2026)

### Backend
- **Motor de Workflows**: tablas `task_workflows`, `task_workflow_statuses`, `task_workflow_transitions` — admin configura estados personalizados con colores, transiciones permitidas y puntos/XP por transición
- **Labels y Watchers**: `task_labels` (CRUD admin), `task_watchers` (observadores por tarea)
- **Campos nuevos en tasks**: `workflow_id`, `workflow_status_id`, `created_by`, `completed_at`, `estimated_hours`, `actual_hours`
- **Backward compat**: campo `status` ENUM se sincroniza automáticamente via `syncLegacyStatus()` en boot del modelo Task
- **Workflow default "Por Defecto"**: 4 estados (Pendiente→En Progreso→Completada→Archivada) con 6 transiciones y puntos. Migración de datos existentes incluida
- **Eventos y gamificación**: `TaskStatusChanged` → `AwardTaskTransitionPoints` (puntos de transición) + `NotifyTaskStatusChanged` (notifica assignee + watchers). `TaskCompleted` → `HandleTaskCompletion` (puntos base + bonus on-time)
- **Config**: `config/gamification.php` → sección `tasks` (base_completion_points=50, base_completion_xp=25, on_time_bonus_points=20, on_time_bonus_xp=10) + sección `actions` (puntos por acciones de negocio)
- **Acciones de negocio (Mar 2026)**: Evento genérico `BusinessActionPerformed` + listener `AwardBusinessPoints` conecta todos los flujos CRM con gamificación: lead_created(25pts), lead_converted(100pts), opportunity_created(30pts), opportunity_status_advanced(25pts), opportunity_won(200pts), analisis_created(40pts), credit_created(150pts), payment_recorded(15pts), planilla_uploaded(100pts), investment_created(75pts). Patrón estilo Duolingo — cada acción del día a día otorga puntos, XP y alimenta rachas
- **Optimización dashboard (Mar 2026)**: Endpoint `/rewards/dashboard` consolidado (1 request en vez de 4). CacheService con caché 60s. N+1 eliminados: ChallengeService (withCount+eager load), RewardService (loadCount), LeaderboardService (avatar en select). Frontend: layout 3 columnas con Hero card, sidebar con leaderboard+badges+catálogo CTA
- **Admin CRUD Settings (Mar 2026)**: 12 endpoints bajo `/api/admin/gamification/` (catalog/badges/challenges × index/store/update/destroy). Frontend Settings reescrito: 5 tabs funcionales conectados a API real (antes mock). Protección: no eliminar items con relaciones (redenciones, participantes, badges otorgados)
- **Dashboard con gráficos (Mar 2026)**: `GamificationDashboard` ahora usa `useRewardsAnalytics('week')` además del dashboard hook. 3 gráficos: AreaChart actividad semanal (7 días puntos), BarChart horizontal top acciones CRM, PieChart donut distribución badges por rareza. Todos muestran estructura visual con datos vacíos (placeholder). Usa `ChartContainer` + recharts (mismo patrón que reportes/inversiones/kpis)
- **Notificaciones programadas**: `tasks:notify-due-soon` (hourly), `tasks:notify-overdue` (daily 8AM CR)
- **KPI enhancement**: `completed_at` para cálculo preciso, `workflowBreakdown` por agente, `rewardPoints` de tareas
- **Endpoints nuevos**: `/api/tareas/board/{workflow}`, `/api/tareas/{task}/transition`, watchers CRUD, labels CRUD, 13 rutas admin workflow

### Frontend
- **3 vistas**: Lista (tabla con paginación), Board (Kanban drag-drop con @dnd-kit), Calendario (grid mensual)
- **ViewToggle**: segmented control Lista/Tablero/Calendario
- **TaskFilters**: barra unificada con buscar, estado, prioridad, responsable, flujo, etiqueta
- **KanbanBoard**: columnas por workflow status, drag-and-drop dispara `POST /transition`, overlay durante drag
- **CalendarView**: grid mensual con tareas en due_date, dot de color por prioridad
- **TaskCard**: card reutilizable con reference, título, prioridad, assignee, labels, due date
- **QuickTaskModal**: modal global Ctrl+Shift+T desde cualquier página del dashboard
- **Detalle de tarea**: transiciones dinámicas (botones coloreados con puntos/XP), labels add/remove, watchers add/remove, completed_at visible
- **Admin config**: WorkflowsTab (crear/editar workflows con estados y transiciones), LabelManager (CRUD de etiquetas)
- **Dependencia**: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`

### Multi-Assignee en Automatizaciones (Mar 2026)
- **Tabla pivote**: `task_automation_assignees` (automation_id, user_id, unique constraint)
- **Modelo**: `TaskAutomation::assignees()` BelongsToMany + `getAssigneeIds()` helper (fallback a legacy `assigned_to`)
- **Task::createFromAutomation()**: método estático que crea una tarea por cada responsable configurado, copiando checklist
- **Backend**: `TaskAutomationController` acepta `assigned_to_ids[]` array y sincroniza pivote. Los 7 controllers que disparan automations usan `Task::createFromAutomation()` (LeadController, OpportunityController, CreditController, AnalisisController, PropuestaController, PaymentVerificationController, CreateMissingCreditTasks command)
- **Frontend**: `TareasAutomationTab.tsx` usa multi-select con Popover+Checkbox (badges removibles) en vez de Select simple
- **PaymentVerification**: caso especial, usa solo el primer verificador (`$assigneeIds[0]`) porque la verificación es 1:1
- **21 eventos configurables** (7 originales + 3 autorización admin + 4 flujos crédito + 5 inversiones + 2 operaciones):
  - Originales: `lead_created`, `opportunity_created`, `analisis_created`, `pep_aceptado`, `pep_rechazado`, `credit_created`, `payment_verification`
  - `payment_reversal_request` — anulación de abono (CreditPaymentController, fallback: cobros.archive)
  - `saldo_reintegro_request` — reintegro de saldo (SaldoPendienteController, fallback: cobros.assign)
  - `reward_redemption_request` — canje de recompensa (CatalogController)
  - `cancelacion_anticipada` — adjuntar pagaré firmado (CancelacionService, fallback: assigned_to del crédito)
  - `credit_mora` — seguimiento de cobro al entrar en mora (MoraService, solo primera vez)
  - `abono_extraordinario` — verificar plan y notificar cliente (AbonoService)
  - `credit_cerrado` — archivo documental al cerrar crédito (CancelacionService + AbonoService)
  - `investment_created` — formalizar acuerdo de inversión (InvestmentController::store)
  - `investment_renewed` — verificar términos de inversión renovada (InvestmentController::renew)
  - `investment_liquidated` — procesar liquidación anticipada (InvestmentController::liquidate)
  - `investment_cancelacion_total` — completar cancelación total (InvestmentController::cancelacionTotal)
  - `investment_finalized` — archivar expediente finalizado (InvestmentService::markCouponAsPaid, InvestmentService::cancelacionTotal, InvestmentCouponController::markBulkPaid, InvestmentCouponController::bulkPayByDesembolso)
  - `planilla_anulada` — verificar saldos post-anulación (PlanillaUploadController::anular)
  - `lead_inactivity_alert` — seguimiento de leads/oportunidades inactivos (CheckLeadInactivity command, cron diario)

---

## Auditoría Seguridad (Abr 2026)

### Base de datos / Mass Assignment
- `Person.$guarded = ['*']` — base model bloquea toda escritura directa. Lead y Client definen su propio `$fillable`
- `Investor.$hidden = ['erp_account_key', 'erp_account_key_prestamos', 'erp_account_key_intereses']`

### Headers HTTP
- `SecurityHeaders` middleware global (`bootstrap/app.php`, `$middleware->append()`)
- Headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `HSTS` (solo HTTPS)
- **Excluido**: X-XSS-Protection (obsoleto, removido por code review)

### Rate Limiting adicional (Abr 2026)
- `activity-logs` export: `admin + throttle:10,1`
- Exports financieros (investment, credit-payments, planilla, accounting-entries): `throttle:10-20,1`
- `/api/health/env/detail`: `auth:sanctum + admin + throttle:10,1`

---

## KPIs Ventas (Abr 2026)

- `KpiController::getAgentKpis()`: datos reales por vendedor — créditos, monto, comisiones, visitas, alcance de meta
- `KpiController::getConversionPorVendedor()`: tasa lead→crédito por vendedor (llamado desde `getLeadKpis()`)
- `KpiController::getBusinessHealthKpis()`: usa comisiones pagadas para `revenuePerEmployee`, añade `atribucionVendedores` y `creditosSinAtribucion`
- **Columna correcta**: `persons.assigned_to_id` (NOT `assigned_to`)
- Modelos utilizados: `Comision`, `MetaVenta`, `Visita`

---

## KPIs Leads — Bugs corregidos (May 2026)

### Tasa de Conversión (antes 101,700%)
- **Fórmula anterior**: `clients / leads` del periodo — matemáticamente rota porque por STI (`person_type_id` 1→2) un Lead convertido deja de aparecer como Lead. Numerador y denominador son cohorts distintos.
- **Fórmula nueva**: `clients / (leads + clients)` del periodo — acotada a 100%, representa "% de prospectos adquiridos en el periodo que ya son clientes"
- **Limitación**: no es cohort real. Para tasa cohort verdadera ("de los leads del mes X, cuántos se convirtieron") se requiere columna `converted_at` en `persons` y tracking en los 6 puntos de conversión: `LeadController:497`, `CreditController:273,832`, `AnalisisController:373`, `ImportacionCreditoCreator:65`, `Client.php:99` (boot)
- **Defensa frontend**: `StatCard` clampea texto del porcentaje vs meta con `Math.min(..., 100)` (línea 315 de `kpis/page.tsx`)

### Lead Aging
- Antes: doble filtro `whereBetween(created_at, periodo)` + `where(created_at, '<', now-7d)` → vacío en periodos <7 días
- Ahora: solo `where(created_at, '<', end-7d)` con `is_active=true` — refleja estado global del lead, no evento del periodo

### Bugs Fase 2 resueltos (May 2026)
- **Tiempo de Respuesta**: migración `add_first_contacted_at_to_persons_table` (columna timestamp + índice). Tracking en `CommentController::store()` — se setea solo en primer comentario raíz sobre un Lead (no edita si ya tiene valor). Cálculo nuevo en `getLeadKpis`: `AVG(first_contacted_at - created_at)` con guard de `Schema::hasColumn`
- **Cartera Nueva del Periodo** (antes "Portfolio Growth"): label renombrado en frontend, lógica mantenida (suma saldos de créditos del periodo). El nombre nuevo refleja qué mide realmente
- **CAC real**: tabla nueva `marketing_costs` (period_month, channel, amount, notes, created_by). Modelo `MarketingCost` + `MarketingCostController` con CRUD admin en `/api/marketing-costs` (admin + throttle:30,1). Fórmula nueva: `Σ marketing_costs.amount / clientes adquiridos`. Si no hay datos → `available=false` → frontend muestra "N/D"
- **NPS**: frontend oculta condicionalmente la card cuando `value=0` (grid pasa de 5 a 4 columnas)
- **Tasa de Conversión Lead Aging + clamp UI**: ver entrada Mar 2026 (May 2026 fix anterior)

---

## Módulo KPIs — Pestaña Comercial (May 2026)

Nueva pestaña `/dashboard/kpis` (módulo `kpis`) con 13 KPIs avanzados.

### Endpoint
- `GET /api/kpis/comercial?period=month|week|quarter|year`
- Implementado en `KpiController::comercial()` (~190 líneas)
- Devuelve: `leadsPorDia`, `leadToOppPorDia`, `creditosAprobados`, `concentracionInstitucion`, `carteraNueva`, `tasaNoAceptacion`, `tasaDenegados`, `motivosNoAprobacion`, `diasPromedioFormalizacion`, `colocacionVendedor`, `tasaRefinanciacion`, `tasaRecolocacion`

### Mapeo de fuentes
| KPI | Fuente |
|---|---|
| Leads por día | `persons.created_at` (person_type_id=1), GROUP BY DATE |
| Leads → Opp por día | join `opportunities.lead_cedula` ↔ `persons.cedula` |
| Créditos aprobados (qty/monto) | `credits.status IN ('Aprobado','Por firmar','Formalizado','Activo','En Mora','Cerrado')` |
| Concentración por institución | `persons.institucion_labora` top 15 |
| Cartera Nueva | suma `credits.monto_credito` del periodo |
| Tasa No Aceptación | `propuestas.motivo_rechazo NOT NULL` / total propuestas |
| Tasa Denegados | `opportunities.status='Perdida'` / cerradas (Analizada+Perdida) |
| Motivos No Aprobación | `opportunities.lost_reason` + `propuestas.motivo_rechazo` combinados |
| Días promedio formalización | `AVG(credits.formalized_at - persons.created_at)` con join por lead_id |
| Colocación por vendedor | GROUP BY `credits.assigned_to` con CASE WHEN por status |
| Tasa Refinanciación | `credits.refundicion_parent_id NOT NULL` / total credits periodo |
| Tasa Recolocación | clientes con crédito previo formalizado antes del actual |

### Frontend
- 8 StatCards (Aprobados, Monto, Cartera Nueva, Días, 4 tasas)
- 2 charts time-series (AreaChart Leads/día, LineChart Leads→Opp/día)
- 2 listas (Concentración instituciones con Progress, Motivos no aprobación)
- 1 tabla (Colocación por vendedor)
- Visible solo si `canViewModule('kpis')` o `full_access`

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
- **Trabajar directamente en `dev`** — NO crear ramas `fix/*` o `feature/*` salvo que el usuario lo pida explícitamente. La regla "siempre crear rama" en `.claude/CLAUDE.md` está desactualizada respecto al flujo real. Confirmado May 2026 después de crear `fix/kpis-tasa-conversion` innecesariamente — el usuario corrigió "el branch debió ser dev". Excepción: para trabajo realmente experimental o de larga duración, preguntar primero.

---

## Skill Automático — studio-workflow (Abr 2026)

Skill creado en `.claude/skills/studio-workflow/SKILL.md`. Se activa automáticamente en todos los prompts del proyecto.

### Tres pilares:
1. **Optimización de tokens**: Haiku para análisis/preguntas/docs, Sonnet para edición de código. Patrón: Haiku analiza → Sonnet edita.
2. **Registro de skills/MCPs**: Tabla de enrutamiento a webapp-testing, frontend-design, simplify, laravel-boost MCP, jules MCP, etc.
3. **Análisis-primero**: Para lógica compleja → subagente Haiku analiza → EnterPlanMode con plan estructurado → esperar aprobación → ejecutar.
