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

## Pendiente — Media prioridad

### 3. configuracion/page.tsx con 4,035 líneas
- Mezcla: roles, usuarios, cuentas ERP, configs asientos, tasas, deductoras, productos
- Solución: crear sub-páginas como se hizo con `auditoria-asientos`

### ~~4. Controllers sin LogsActivity~~ ✅ Resuelto (Mar 2026)
31 controllers con LogsActivity. Solo quedan sin él los de solo lectura (ver `auditoria.md`).

### ~~5. empresas-mock.ts con datos hardcodeados~~ ✅ No aplica
Funciona como respaldo intencional si falla la lista de empresas desde BD.

### 6. CreditPaymentController con 2,847 líneas
- Mezcla planillas, ventanilla, abonos, refundiciones, mora
- Solución largo plazo: extraer en Services

## Pendiente — Baja prioridad

### 7. 149 usos de `as any` en TypeScript (bajó de 292)
- Origen de los errores TS en analisis, creditos, cobros, clientes, inversiones

### 8. Log de errores en backend (64 `Log::`, subió de 48)
- Poco contexto cuando algo falla en producción

## Estadísticas del proyecto
- Backend PHP: 163 archivos
- Frontend TS/TSX: 146 archivos
- Controllers Api/: 38 archivos
- Páginas dashboard: ~35 páginas
