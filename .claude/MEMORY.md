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
