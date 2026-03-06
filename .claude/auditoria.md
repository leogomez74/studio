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

## Controllers CON LogsActivity
AuthController, LeadController, ClientController, UserController, CreditController,
CreditPaymentController, PlanillaUploadController, AnalisisController, OpportunityController,
TaskController, LoanConfigurationController, TasaController, DeductoraController,
AccountingEntryConfigController, ErpAccountingConfigController, SaldoPendienteController

## Controllers SIN LogsActivity (pendiente)
InvestmentController, InvestorController, InvestmentCouponController, InvestmentPaymentController,
ProductController, RoleController, LeadAlertController, KpiController, PropuestaController,
ChatMessageController, CommentController, NotificationController, QuestionnaireController

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
