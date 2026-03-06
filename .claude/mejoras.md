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

## Pendiente — Alta prioridad

### 1. Rutas sin auth:sanctum
- 197 de 209 rutas en `api.php` sin middleware explícito
- Solo middleware en: `leads/bulk-archive`, `leads/bulk-convert`, `opportunities/bulk`, y 2 grupos al final
- Acción: auditar rutas críticas (pagos, créditos) y moverlas dentro de `Route::middleware(['auth:sanctum'])`

### 2. sender_name hardcodeado en Comunicaciones
- `src/app/dashboard/comunicaciones/page.tsx` → `sender_name: 'Agente'`
- Fix: leer de `useAuth()` o contexto de sesión

## Pendiente — Media prioridad

### 3. configuracion/page.tsx con 5,675 líneas
- Mezcla: roles, usuarios, cuentas ERP, configs asientos, tasas, deductoras, productos
- Solución: crear sub-páginas como se hizo con `auditoria-asientos`

### 4. Controllers sin LogsActivity
Ver lista en `auditoria.md`. Más urgentes: InvestmentController, RoleController, ProductController

### 5. empresas-mock.ts con datos hardcodeados
- `src/lib/empresas-mock.ts` — fallback que puede mostrar empresas incorrectas
- Fix: eliminar fallback o migrar empresas a BD

### 6. CreditPaymentController con 2,847 líneas
- Mezcla planillas, ventanilla, abonos, refundiciones, mora
- Solución largo plazo: extraer en Services

## Pendiente — Baja prioridad

### 7. 292 usos de `as any` en TypeScript
- Origen de los errores TS en analisis, creditos, cobros, clientes, inversiones

### 8. Log de errores escaso en backend
- Solo 48 `Log::` en todos los controllers
- Poco contexto cuando algo falla en producción

## Estadísticas del proyecto
- Backend PHP: 163 archivos
- Frontend TS/TSX: 146 archivos
- Controllers Api/: 38 archivos
- Páginas dashboard: ~35 páginas
