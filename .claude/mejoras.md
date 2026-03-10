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

## Pendiente — Media prioridad

### ~~3. configuracion/page.tsx con 4,035 líneas~~ ✅ Resuelto (Mar 2026)
Dividido en 12 componentes en `src/components/configuracion/`. page.tsx ahora es orquestador de 96 líneas.

### ~~4. Controllers sin LogsActivity~~ ✅ Resuelto (Mar 2026)
31 controllers con LogsActivity. Solo quedan sin él los de solo lectura (ver `auditoria.md`).

### ~~5. empresas-mock.ts con datos hardcodeados~~ ✅ No aplica
Funciona como respaldo intencional si falla la lista de empresas desde BD.

### ~~6. CreditPaymentController con 2,847 líneas~~ ✅ Resuelto (Mar 2026)
Extraído en 7 Services: PaymentHelperService, MoraService, PaymentProcessingService, PlanillaService, AbonoService, CancelacionService, ReversalService. Controller ahora es orquestador de 406 líneas.

## Pendiente — Baja prioridad

### ~~7. 149 usos de `as any` en TypeScript~~ ✅ Resuelto (Mar 2026)
0 `as any` en todo `src/`. Errores TS pre-existentes quedan en: analisis (3), inversiones (2), oportunidades/[id] (3 — bug tuple), use-toast (3), exceljs (2 — módulo no instalado).

### ~~8. Log de errores en backend~~ ✅ Resuelto (Mar 2026)
9 logs sin contexto corregidos. Todos los `Log::error/warning/critical` ahora incluyen IDs relevantes, `getMessage()` y `getTraceAsString()`.

## Auditoría Módulo Inversiones (Mar 2026)

### ✅ Implementado en esta sesión
- **O2**: Calculadora de interés diario ahora usa convención Actual/Actual — detecta si el período incluye 29-Feb y usa base 366 en años bisiestos. UI muestra "base 366 (bisiesto)" cuando aplica. `inversiones/[id]/page.tsx`
- **O3**: Indicador visual de mora en Tabla General — backend `InvestmentService@getTablaGeneral` agrega `overdue_coupons_count` vía `withCount`. Frontend colorea la fila rojo claro y muestra ícono ⚠️ con tooltip si hay cupones atrasados. `page.tsx` + `InvestmentService.php`
- **O4**: Sección Pagos Próximos — banner rojo al tope si hay meses con cupones atrasados (muestra cantidad y montos totales); separador visual "PRÓXIMOS PAGOS" entre la sección de atrasados y futuros. `page.tsx`

### 🔲 Pendiente (del plan de auditoría)
- **O1**: Capitalización — el negocio confirmó que capitalizar por interés neto está correcto. Sin cambio.
- **S1**: Proteger rutas de exportación (mover a auth:sanctum + cambiar frontend de window.open a axios blob)
- **S3**: Validar estado inversión en `markPaid/markBulkPaid`
- **S6**: Validar estado en `liquidate()` y `renew()`
- **S4**: Unicidad de cédula en inversionistas
- **O10**: Mensaje confuso en `cancelacionTotal()`
- **O5**: Alerta de vencimientos próximos en dashboard
- **S7**: Reemplazar catch silenciosos con toasts en frontend
- **O7**: Botón editar inversionista desde la lista
- **O8**: Tab historial de pagos en detalle de inversionista
- **S10**: Índice en `numero_desembolso`

## Estadísticas del proyecto
- Backend PHP: 163 archivos
- Frontend TS/TSX: 146 archivos
- Controllers Api/: 38 archivos
- Páginas dashboard: ~35 páginas
