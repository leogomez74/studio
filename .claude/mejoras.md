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

## Estadísticas del proyecto
- Backend PHP: 163 archivos
- Frontend TS/TSX: 146 archivos
- Controllers Api/: 38 archivos
- Páginas dashboard: ~35 páginas
