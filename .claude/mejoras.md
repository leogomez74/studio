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

## Pendiente — Media prioridad

### HttpOnly cookies (diferido)
- Migrar auth de Sanctum token en header a HttpOnly cookies
- Bajo riesgo actual: API interna, requiere cambio completo frontend+backend

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
