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
| 2026-03-16 | **Documentos: "Ambas caras en este archivo"**: Botón en DocumentManager permite marcar un PDF/imagen de cédula como conteniendo frente y reverso. Backend `POST /person-documents/{id}/mark-dual` crea segundo registro `cedula_reverso` apuntando al mismo archivo, con auto-sync a oportunidades. El checklist de documentos faltantes se actualiza automáticamente |
| 2026-03-16 | **Módulo Tareas — Sistema de Workflows tipo Jira/Notion**: Motor de workflows configurables por admin (estados, transiciones con puntos/XP), vista Kanban (drag-drop @dnd-kit), vista Calendario, labels, watchers, modal global Ctrl+Shift+T, transiciones dinámicas en detalle con reward toast, backward compat con status ENUM, eventos TaskStatusChanged/TaskCompleted alimentan gamificación (RewardService, StreakService, BadgeService), notificaciones programadas (due-soon hourly, overdue daily), KPIs workflow-aware. Backend: 8 migraciones, 5 modelos nuevos, 2 controllers nuevos, 2 eventos, 3 listeners, 2 commands, 13+ rutas. Frontend: 10 componentes nuevos, refactor page.tsx + [id]/page.tsx, admin WorkflowsTab + LabelManager en configuración |
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
