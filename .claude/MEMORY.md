# Bitácora del Proyecto — CR Studio (Laravel + Next.js)

## Stack
- **Backend:** Laravel 12, PHP 8.2+, MySQL, Sanctum
- **Frontend:** Next.js (App Router), TypeScript
- **Testing:** SQLite in-memory
- **Idioma del usuario:** Español siempre

---

## Arquitectura General

Ver `CLAUDE.md` para detalles completos. Puntos clave:
- STI pattern: tabla `persons`, `person_type_id=1` = Lead, `person_type_id=2` = Client
- Opportunity: ID formato `YY-XXXXX-OP`
- Auth: Sanctum. Frontend baseURL = `http://localhost:8000` (sin `/api`), todas las rutas usan `/api/` prefix.

---

## Sistema de Asientos Contables — Historial Completo

### Descripción
Sistema híbrido: configurable (dinámico por BD) + legacy (hardcodeado). Controlado por feature flags en `config/accounting.php`.

### Archivos clave
| Archivo | Rol |
|---------|-----|
| `backend/app/Traits/AccountingTrigger.php` | Trait principal. Punto de entrada: `triggerAccountingEntry()` |
| `backend/app/Services/ErpAccountingService.php` | HTTP client al ERP externo |
| `backend/app/Models/AccountingEntryLog.php` | Registro de auditoría + reintentos |
| `backend/app/Models/ErpAccountingAccount.php` | Catálogo de cuentas (key → código ERP) |
| `backend/app/Models/AccountingEntryConfig.php` | Configuraciones de asientos por tipo |
| `backend/app/Models/AccountingEntryLine.php` | Líneas (filas) de cada asiento |
| `backend/app/Http/Controllers/Api/AccountingEntryLogController.php` | API de auditoría |
| `backend/app/Http/Controllers/Api/ErpAccountingConfigController.php` | API de cuentas ERP |
| `backend/app/Http/Controllers/Api/AccountingEntryConfigController.php` | API de configuraciones |
| `backend/app/Console/Commands/RetryFailedAccountingEntries.php` | Comando artisan de reintentos |
| `backend/app/Console/Kernel.php` | Scheduling: retry cada 5 min |
| `backend/routes/api.php` | Rutas contables |
| `src/app/dashboard/configuracion/page.tsx` | Frontend: tab Contabilidad + Auditoría |

### Lo que se implementó (sesiones Feb 2026)

#### Punto 1 — Registro local de asientos ✅
- Tabla `accounting_entry_logs` con estado, payload, respuesta ERP, contexto
- Pestaña "Auditoría de Asientos" en el frontend (`configuracion/page.tsx`)

#### Punto 2 — Cola de reintentos ✅
- Campos `retry_count`, `max_retries`, `next_retry_at`, `last_retry_at` en `accounting_entry_logs`
- Backoff exponencial: 5 → 15 → 45 minutos
- Comando `accounting:retry-failed --limit=10 --dry-run`
- Endpoint `POST /api/accounting-entry-logs/{id}/retry`

#### Punto 3 — Prevención de duplicados ✅
- Chequeo en `triggerAccountingEntry()` antes de procesar
- Scope `isDuplicate($entryType, $reference)` en `AccountingEntryLog`

#### Punto 4 — Validación de cuentas ERP ✅
- Campo `validated_at` en `erp_accounting_accounts`
- Warnings en log si se usan cuentas nunca validadas
- Se marca `validated_at` tras cada envío exitoso
- Endpoint `GET /api/erp-accounting/accounts/validation-status`

#### Punto 5 — Scheduling automático ✅
- `$schedule->command('accounting:retry-failed --limit=10')->everyFiveMinutes()` en `Kernel.php`

#### Punto 6 — Notificaciones de errores ✅
- Endpoint `GET /api/accounting-entry-logs/alerts`
- Badge rojo en pestaña "Auditoría de Asientos"
- Banner de alerta en el frontend cuando hay errores recientes (48h)

#### Punto 7 — Exportación CSV ✅
- Endpoint `GET /api/accounting-entry-logs/export` (streaming, hasta 5000 filas, BOM UTF-8)
- Botón "Exportar CSV" junto al botón "Limpiar" en la barra de filtros

#### Bug crítico corregido — fallbackToLegacy() ✅
- Los parámetros nombrados (PHP 8) no coincidían con las firmas reales de los métodos legacy
- Se normalizó el contexto (aliases: `lead_nombre`, `lead_cedula`, `credit_reference`)
- Se corrigieron los 7 casos del match para usar los params correctos

#### Punto 8 — Sobrante en PAGO_PLANILLA ✅ (Mar 2026)
**Caso:** La cooperativa deductora tarda 1 mes en retirar a un cliente cuyo crédito ya está pagado. Ese mes extra se deduce igual → genera un sobrante que se devuelve al cliente.

**Asiento PAGO_PLANILLA (con sobrante opcional):**
```
DÉBITO:  Cuenta por Cobrar Cooperativa     total
CRÉDITO: Cuenta por cobrar a Plazo         capital
CRÉDITO: Ingresos Por Intereses            interes_corriente
CRÉDITO: Ingresos por Mora                 interes_moratorio
CRÉDITO: Ingresos por Seguros              poliza
CRÉDITO: Retenciones por aplicar Cuentas   sobrante  ← se omite si sobrante=0
```

**Asiento RETENCION_SOBRANTE (automático si sobrante > 0):**
```
DÉBITO:  Retenciones por aplicar cuentas   total
CRÉDITO: Desembolsos Saldos a Favor        total
```

**Lo que se implementó:**
- `sobrante` agregado como `amount_component` en `resolveLineAmount()`
- `sobrante: 0` en el breakdown por defecto
- Método privado `triggerCascadeEntries()` en `AccountingTrigger`
  - Si `PAGO_PLANILLA` exitoso y `sobrante > 0` → dispara `RETENCION_SOBRANTE` automáticamente
  - Referencia: `{referencia}-SOBRANTE`
  - Resultado del 2do asiento queda en `sobrante_entry` del resultado padre
- Frontend: opción "Sobrante (retención de más)" en el selector de componentes

**Cómo configurar desde UI:**
1. En config `PAGO_PLANILLA`: agregar línea Crédito → cuenta "Retenciones" → componente "Sobrante"
2. Crear config nueva `RETENCION_SOBRANTE` con 2 líneas (Débito/Crédito)

#### Lunes 03/03/2026 — Ventanilla configurable + sobrantes + penalización ✅
- Asientos `PAGO_VENTANILLA` y `REVERSO_PAGO` (anulación de abono) creados desde la UI como configurables
  - Antes funcionaban solo por legacy; ahora tienen config en BD (flags aún desactivados, pendiente activar)
- `SALDO_SOBRANTE` ahora se dispara también para pagos de ventanilla/manuales (antes solo planilla)
- `ANULACION_SOBRANTE` ahora se dispara al revertir pagos de ventanilla con sobrante
- Limpieza de `SaldoPendiente` expandida a TODOS los tipos de pago (antes solo planilla)
- **Nuevo `account_type = deductora_or_fixed`**: tipo híbrido de cuenta que usa la deductora si el crédito tiene una, o fallback a cuenta fija (ej. Banco CREDIPEPE)
  - Implementado en `AccountingTrigger.php` → `resolveLineAmount()`
  - Opción "Deductora o Fija (auto)" en frontend
  - Migración: `2026_03_03_155531_add_deductora_or_fixed_to_account_type_enum`
- **Nuevo `amount_component = penalizacion`**: componente propio para penalización por abono anticipado (<12 cuotas)
  - Agregado en `resolveLineAmount()` y en selector frontend
  - La penalización es un **ingreso**, NO un cargo adicional
- **ABONO_EXTRAORDINARIO** actualizado:
  - Breakdown: `total = montoAbono`, `capital = montoAplicarAlSaldo`, `penalizacion = penalizacion`
  - Contexto incluye `deductora_id`/`deductora_nombre` para `deductora_or_fixed`
- **CANCELACION_ANTICIPADA** actualizado:
  - Breakdown: `total = saldo + intereses + penalizacion`, `capital`, `interes_corriente`, `penalizacion`
  - Contexto incluye `deductora_id`/`deductora_nombre`
- **REVERSO_EXTRAORDINARIO** agregado a `config/accounting.php` con flag `ACCOUNTING_CONFIGURABLE_REVERSO_EXTRAORDINARIO`
- Manual actualizado a v2.4

#### Semana 23/02 al 01/03/2026 — Planillas y Sobrantes ✅

**Lunes 23/02**
- Ajustes generales al sistema configurable
- Funcionalidad para adjuntar pagaré firmado en créditos

**Martes 24/02 — Sobrantes**
- Soporte de `SALDO_SOBRANTE` en `AccountingTrigger` y `CreditPaymentController`
- Tipo `SALDO_SOBRANTE` agregado a `config/accounting.php`
- Limpieza y refinamiento del cálculo del sobrante

**Miércoles 25/02 — Reintegro**
- Tipo `REINTEGRO_SALDO` agregado a `config/accounting.php`
- Asiento de reintegro de saldos a favor implementado
- `MANUAL_SISTEMA_CONTABLE_CONFIGURABLE.md` documentado

**Jueves 26/02 — Planillas (día más activo)**
- API completa `PlanillaUploadController` — listado, detalle, anulación, reverso
- API `CreditPaymentController` — pagos y preview de planilla
- Dashboard de Cobros (`/dashboard/cobros`) creado en frontend
- Asiento de devolución de planilla implementado
- Asiento de anulación de planilla y anulación de sobrante implementados
- Tipos nuevos en `config/accounting.php`: `ANULACION_PLANILLA`, `ANULACION_SOBRANTE`

**Viernes 27/02 — Ajustes finales**
- Ajustes al asiento de pago de ventanilla
- Asiento de abonos ajustado
- Anulación de planilla finalizada
- Página de gestión de cobros y pagos terminada en frontend

---

### Todos los tipos de asiento en config/accounting.php
| Tipo | Descripción | Estado |
|------|-------------|--------|
| `FORMALIZACION` | Apertura de crédito | existía |
| `PAGO_PLANILLA` | Cobro por deducción de nómina | existía |
| `PAGO_VENTANILLA` | Pago directo en oficina | existía |
| `ABONO_EXTRAORDINARIO` | Abono fuera de cuota | existía |
| `CANCELACION_ANTICIPADA` | Pago total anticipado | existía |
| `REFUNDICION_CIERRE` | Cierre crédito viejo en refundición | existía |
| `REFUNDICION_NUEVO` | Apertura crédito nuevo en refundición | existía |
| `DEVOLUCION` | Devolución | existía |
| `REVERSO_PAGO` | Anulación de abono de ventanilla | config creada lun 03/03 |
| `SALDO_SOBRANTE` | Sobrante de retención excedente (planilla o ventanilla) | agregado mar 24/02, expandido lun 03/03 |
| `REINTEGRO_SALDO` | Reintegro de saldo a favor | agregado mié 25/02 |
| `ANULACION_PLANILLA` | Reverso completo de planilla | agregado jue 26/02 |
| `ANULACION_SOBRANTE` | Reverso del sobrante al anular planilla o ventanilla | agregado jue 26/02, expandido lun 03/03 |
| `RETENCION_SOBRANTE` | 2do asiento automático cuando hay sobrante | agregado mar 02/03 |
| `REVERSO_EXTRAORDINARIO` | Reverso de abono extraordinario | agregado lun 03/03 |

### amount_component disponibles
| Valor | Descripción |
|-------|-------------|
| `total` | Monto completo |
| `capital` | Solo amortización |
| `interes_corriente` | Solo interés corriente |
| `interes_moratorio` | Solo mora |
| `poliza` | Solo seguro/póliza |
| `sobrante` | Excedente retenido (crédito ya pagado) |
| `penalizacion` | Penalización por abono anticipado (<12 cuotas) |
| `cargo_adicional` | Cargo específico (requiere `cargo_adicional_key`) |

### Rutas API contables
```
GET    /api/accounting-entry-logs              # Listado con filtros
GET    /api/accounting-entry-logs/stats        # Estadísticas
GET    /api/accounting-entry-logs/alerts       # Alertas de errores
GET    /api/accounting-entry-logs/export       # CSV streaming
POST   /api/accounting-entry-logs/{id}/retry   # Reintento manual

GET    /api/erp-accounting/accounts                    # Listado cuentas
POST   /api/erp-accounting/accounts                    # Crear cuenta
PUT    /api/erp-accounting/accounts/{id}               # Actualizar
DELETE /api/erp-accounting/accounts/{id}               # Eliminar
POST   /api/erp-accounting/test-connection             # Probar ERP
GET    /api/erp-accounting/accounts/validation-status  # Estado validación

GET    /api/accounting-entry-configs           # Listado configs
GET    /api/accounting-entry-configs/{id}      # Ver config
POST   /api/accounting-entry-configs           # Crear config
PUT    /api/accounting-entry-configs/{id}      # Actualizar
DELETE /api/accounting-entry-configs/{id}      # Eliminar
PATCH  /api/accounting-entry-configs/{id}/toggle  # Activar/desactivar
POST   /api/accounting-entry-configs/{id}/preview # Preview asiento
```

### Migraciones ejecutadas
- `2026_02_20_100000_add_retry_and_validation_fields` — campos retry en logs + validated_at en cuentas
- `2026_02_16_200111_add_amount_component_to_accounting_entry_lines` — componentes de monto

---

## Pendiente / Próximos pasos

- **Reportes de Conciliación:** No solicitado aún
- **Pasar `sobrante` en el breakdown:** El servicio que procesa la planilla debe calcular el sobrante y enviarlo en `context['amount_breakdown']['sobrante']`
- **Archivos nuevos clave de esta semana:**
  - `backend/app/Http/Controllers/Api/PlanillaUploadController.php`
  - `backend/app/Http/Controllers/Api/CreditPaymentController.php`
  - `src/app/dashboard/cobros/page.tsx`
  - `MANUAL_SISTEMA_CONTABLE_CONFIGURABLE.md` (documentación de feature flags)

---

## Preferencias del usuario
- Comunicarse siempre en **español**
- No crear commits sin pedido explícito
- No hacer merges sin pedido explícito
- Workflow: crear rama antes de trabajar (`feature/` o `fix/`)
