# Prompt de Implementación: Auditoría + Auditoría de Asientos + Configuración de Asientos Contables

> **Instrucciones de uso:** Pasa este documento completo a Claude para implementar estos tres módulos en un nuevo proyecto Laravel + Next.js. Los tres módulos son independientes pero comparten patrones de diseño.

---

## CONTEXTO DEL PROYECTO DESTINO

- **Backend:** Laravel 12, PHP 8.2+, MySQL
- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Auth:** Laravel Sanctum
- Adapta los nombres de modelos y namespaces al proyecto destino.

---

## MÓDULO 1 — AUDITORÍA (Activity Log)

### Qué hace
Registro inmutable de todas las acciones de usuarios sobre cualquier entidad del sistema. Captura quién hizo qué, cuándo, desde qué IP, y qué campos cambiaron (antes/después).

### Base de datos

```sql
CREATE TABLE activity_logs (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         BIGINT UNSIGNED NULL,
    user_name       VARCHAR(150) NULL,          -- snapshot del nombre (sobrevive borrado de usuario)
    action          VARCHAR(30) NOT NULL,        -- create|update|delete|login|logout|login_failed|export|upload|restore
    module          VARCHAR(60) NOT NULL,        -- nombre legible del módulo: Créditos, Pagos, Usuarios…
    model_type      VARCHAR(100) NULL,           -- App\Models\Credit
    model_id        VARCHAR(50) NULL,            -- ID del registro afectado
    model_label     VARCHAR(200) NULL,           -- referencia legible: "26-00001-01-CRED"
    changes         JSON NULL,                   -- [{field, old_value, new_value}, ...]
    ip_address      VARCHAR(45) NULL,
    user_agent      VARCHAR(300) NULL,
    created_at      TIMESTAMP NULL,
    updated_at      TIMESTAMP NULL,
    INDEX idx_user_id   (user_id),
    INDEX idx_action    (action),
    INDEX idx_module    (module),
    INDEX idx_model     (model_type, model_id),
    INDEX idx_created   (created_at)
);
```

### Trait LogsActivity (backend)

Crear `app/Traits/LogsActivity.php`. Los controllers que lo usen llaman manualmente a `$this->logActivity(...)`:

```php
trait LogsActivity {
    protected function logActivity(
        string   $action,
        string   $module,
        ?Model   $model      = null,
        ?string  $modelLabel = null,
        array    $changes    = [],
        ?Request $request    = null
    ): void {
        $user = Auth::user();
        ActivityLog::create([
            'user_id'    => $user?->id,
            'user_name'  => $user?->name,
            'action'     => $action,
            'module'     => $module,
            'model_type' => $model ? get_class($model) : null,
            'model_id'   => $model?->getKey(),
            'model_label'=> $modelLabel,
            'changes'    => $changes ?: null,
            'ip_address' => $request?->ip(),
            'user_agent' => $request?->userAgent(),
        ]);
    }

    // Compara snapshot anterior vs actual, excluye campos sensibles
    protected function getChanges(array $old, array $new): array {
        $exclude = ['password','remember_token','updated_at','created_at','email_verified_at'];
        $changes = [];
        foreach ($new as $field => $newVal) {
            if (in_array($field, $exclude)) continue;
            $oldVal = $old[$field] ?? null;
            if ($oldVal != $newVal) {
                $changes[] = ['field' => $field, 'old_value' => $oldVal, 'new_value' => $newVal];
            }
        }
        return $changes;
    }
}
```

**Uso en controllers:**
```php
// Al crear
$this->logActivity('create', 'Créditos', $credit, $credit->reference, [], $request);

// Al actualizar
$old = $model->toArray();
$model->update($validated);
$changes = $this->getChanges($old, $model->fresh()->toArray());
$this->logActivity('update', 'Créditos', $model, $model->reference, $changes, $request);

// Al borrar
$this->logActivity('delete', 'Créditos', $model, $model->reference);
```

### Modelo ActivityLog (backend)

```php
class ActivityLog extends Model {
    protected $fillable = [
        'user_id','user_name','action','module',
        'model_type','model_id','model_label',
        'changes','ip_address','user_agent',
    ];
    protected $casts = ['changes' => 'array'];

    public function scopeByModule($q, $module)  { return $q->where('module', $module); }
    public function scopeByUser($q, $userId)    { return $q->where('user_id', $userId); }
    public function scopeByAction($q, $action)  { return $q->where('action', $action); }
    public function scopeDateRange($q, $from, $to) {
        if ($from) $q->whereDate('created_at', '>=', $from);
        if ($to)   $q->whereDate('created_at', '<=', $to);
        return $q;
    }
}
```

### Frontend — Página `/dashboard/auditoria`

**Estructura visual:**
1. **5 stat cards:** Total eventos · Hoy · Usuarios activos hoy · Eliminaciones 24h · Logins fallidos 24h
2. **Filtros:** Búsqueda libre (label/usuario/referencia) · Módulo (dropdown) · Acción (dropdown) · Usuario (multiselect) · Rango de fechas · IP
3. **Tabla paginada (20/página):** Fecha/hora · Usuario · Badge acción · Módulo · Registro · IP · Botón detalle
4. **Modal de detalle:** Metadatos del evento + tabla "Campos modificados" con columnas Campo / Antes / Después
5. **Exportar CSV** respetando todos los filtros activos

**Colores de badges por acción:**
```
create       → verde   (bg-green-100 text-green-700)
update       → azul    (bg-blue-100 text-blue-700)
delete       → rojo    (bg-red-100 text-red-700)
login        → índigo  (bg-indigo-100 text-indigo-700)
login_failed → naranja (bg-orange-100 text-orange-700)
logout       → gris    (bg-gray-100 text-gray-700)
export       → amarillo(bg-yellow-100 text-yellow-700)
upload       → morado  (bg-purple-100 text-purple-700)
restore      → teal    (bg-teal-100 text-teal-700)
```

**Módulos disponibles para filtro** (adaptar al proyecto):
```ts
const MODULES = [
  'Leads','Clientes','Créditos','Pagos','Planilla',
  'Análisis','Oportunidades','Tareas','Usuarios',
  'Configuración','Tasas','Deductoras','Config. Contable',
];
```

---

## MÓDULO 2 — AUDITORÍA DE ASIENTOS CONTABLES

### Qué hace
Registro de cada intento de enviar un asiento contable (journal entry) a un ERP externo. Captura el payload enviado, la respuesta recibida, el estado del intento y permite reintentos automáticos/manuales con backoff exponencial.

### Base de datos

```sql
CREATE TABLE accounting_entry_logs (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    entry_type          VARCHAR(50) NOT NULL,       -- PAGO_PLANILLA, FORMALIZACION, etc.
    reference           VARCHAR(100) NOT NULL,      -- PLAN-{paymentId}-{creditRef}
    status              ENUM('pending','success','error','skipped') NOT NULL DEFAULT 'pending',
    amount              DECIMAL(15,2) NULL,
    total_debit         DECIMAL(15,2) NULL,
    total_credit        DECIMAL(15,2) NULL,
    erp_journal_entry_id VARCHAR(100) NULL,         -- ID que devuelve el ERP al aceptar
    erp_message         VARCHAR(500) NULL,
    error_message       VARCHAR(1000) NULL,
    http_status         SMALLINT NULL,
    payload_sent        JSON NULL,                  -- request completo al ERP (para reintentos)
    erp_response        JSON NULL,                  -- response completo del ERP
    context             JSON NULL,                  -- credit_id, cedula, nombre, deductora, breakdown
    source_method       VARCHAR(50) DEFAULT 'configurable', -- 'configurable' o 'legacy'
    retry_count         INT DEFAULT 0,
    max_retries         INT DEFAULT 3,
    next_retry_at       TIMESTAMP NULL,
    last_retry_at       TIMESTAMP NULL,
    created_at          TIMESTAMP NULL,
    updated_at          TIMESTAMP NULL,
    INDEX idx_entry_type (entry_type),
    INDEX idx_status     (status),
    INDEX idx_reference  (reference),
    INDEX idx_erp_id     (erp_journal_entry_id),
    INDEX idx_created    (created_at)
);
```

### Modelo AccountingEntryLog (backend)

```php
class AccountingEntryLog extends Model {
    protected $fillable = [
        'entry_type','reference','status','amount',
        'total_debit','total_credit','erp_journal_entry_id',
        'erp_message','error_message','http_status',
        'payload_sent','erp_response','context',
        'source_method','retry_count','max_retries',
        'next_retry_at','last_retry_at',
    ];
    protected $casts = [
        'payload_sent' => 'array',
        'erp_response' => 'array',
        'context'      => 'array',
        'next_retry_at'=> 'datetime',
        'last_retry_at'=> 'datetime',
    ];

    public function markSuccess(string $erpId, string $msg, float $debit, float $credit): void {
        $this->update([
            'status' => 'success', 'erp_journal_entry_id' => $erpId,
            'erp_message' => $msg, 'total_debit' => $debit, 'total_credit' => $credit,
        ]);
    }

    public function markError(string $errorMsg, int $httpStatus = 0): void {
        $retryCount = $this->retry_count + 1;
        // Backoff exponencial: 5min, 15min, 45min
        $delays = [5, 15, 45];
        $delay  = $delays[min($retryCount - 1, count($delays) - 1)];
        $this->update([
            'status'        => 'error',
            'error_message' => $errorMsg,
            'http_status'   => $httpStatus,
            'retry_count'   => $retryCount,
            'last_retry_at' => now(),
            'next_retry_at' => $retryCount < $this->max_retries ? now()->addMinutes($delay) : null,
        ]);
    }

    public function markSkipped(string $reason): void {
        $this->update(['status' => 'skipped', 'error_message' => $reason]);
    }

    public function scopeRetryable($q) {
        return $q->where('status', 'error')
                 ->whereColumn('retry_count', '<', 'max_retries')
                 ->where('next_retry_at', '<=', now());
    }

    public function scopeIsDuplicate($q, string $type, string $reference) {
        return $q->where('entry_type', $type)->where('reference', $reference)
                 ->whereIn('status', ['success','pending']);
    }

    public function scopeByEntryType($q, $type)  { return $q->where('entry_type', $type); }
    public function scopeByStatus($q, $status)   { return $q->where('status', $status); }
    public function scopeByReference($q, $ref)   { return $q->where('reference', 'LIKE', "%{$ref}%"); }
    public function scopeDateRange($q, $from, $to) {
        if ($from) $q->whereDate('created_at', '>=', $from);
        if ($to)   $q->whereDate('created_at', '<=', $to);
        return $q;
    }
}
```

### Trait AccountingTrigger (backend)

```php
trait AccountingTrigger {
    protected function crearAsientoContable(
        string $entryType,
        string $reference,
        float  $amount,
        array  $context  = [],   // credit_id, cedula, nombre, deductora, breakdown
        array  $lines    = []    // [{account_code, movement_type, amount, description}, ...]
    ): AccountingEntryLog {
        // Crear log en estado pending
        $log = AccountingEntryLog::create([
            'entry_type'    => $entryType,
            'reference'     => $reference,
            'status'        => 'pending',
            'amount'        => $amount,
            'context'       => $context,
            'source_method' => 'configurable',
        ]);

        try {
            // Aquí va la llamada al ERP (implementar según el destino)
            $payload  = $this->buildErpPayload($entryType, $reference, $lines, $context);
            $response = $this->sendToErp($payload);  // implementar en el proyecto destino

            $log->update(['payload_sent' => $payload, 'erp_response' => $response]);

            if ($response['success']) {
                $log->markSuccess(
                    $response['journal_entry_id'],
                    $response['message'] ?? '',
                    $response['total_debit']  ?? 0,
                    $response['total_credit'] ?? 0
                );
            } else {
                $log->markError($response['message'] ?? 'Error desconocido', $response['http_status'] ?? 0);
            }
        } catch (\Throwable $e) {
            $log->markError($e->getMessage());
        }

        return $log;
    }
}
```

### Frontend — Página `/dashboard/auditoria-asientos`

**Estructura visual:**
1. **Banner de alertas** (solo si hay problemas): cuenta de errores · reintentos agotados · pendientes últimas 48h
2. **5 stat cards:** Total · Exitosos (verde) · Errores (rojo) · Omitidos (amarillo) · Pendientes (azul)
3. **Filtros:** Tipo de asiento · Estado · Rango de fechas · Búsqueda libre (referencia/ID/ERP ID)
4. **Tabla paginada (15/página):** ID · Fecha · Tipo · Referencia · Badge estado · Monto · Origen (Config/Legacy) · ERP ID · Reintentos · Acciones
5. **Modal de detalle:**
   - Info principal: referencia, estado, monto, origen, ERP ID, totales débito/crédito
   - Mensaje ERP o error
   - Contador reintentos / máximo
   - Secciones expandibles: Contexto (JSON) · Payload Enviado (JSON) · Respuesta ERP (JSON)
   - Botón "Reintentar" si `status=error` y hay payload guardado
6. **Export CSV** con todos los filtros

**Badges de estado:**
```
success → verde  · Exitoso
error   → rojo   · Error
skipped → amarillo · Omitido
pending → azul   · Pendiente
```

**Tipos de asiento disponibles** (adaptar al proyecto):
```ts
const ENTRY_TYPES: Record<string, string> = {
  FORMALIZACION:           'Formalización',
  PAGO_PLANILLA:           'Pago Planilla',
  PAGO_VENTANILLA:         'Pago Ventanilla',
  ABONO_EXTRAORDINARIO:    'Abono Extraordinario',
  CANCELACION_ANTICIPADA:  'Cancelación Anticipada',
  REVERSO_PAGO:            'Anulación de Abono',
  REINTEGRO_SALDO:         'Reintegro de Saldo',
  SALDO_SOBRANTE:          'Saldo Sobrante',
  // Inversiones
  INV_CAPITAL_RECIBIDO:    'Inversión — Capital Recibido',
  INV_INTERES_DEVENGADO:   'Inversión — Interés Devengado',
  INV_CANCELACION_TOTAL:   'Inversión — Cancelación Total',
};
```

---

## MÓDULO 3 — CONFIGURACIÓN DE ASIENTOS CONTABLES

### Qué hace
Permite a administradores definir **plantillas de asientos contables** que se ejecutan automáticamente cuando ocurre un evento del sistema (pago, formalización, etc.). Cada plantilla define qué cuentas debitar/acreditar y por qué monto.

### Base de datos

```sql
-- Plantilla del asiento (una por tipo de evento)
CREATE TABLE accounting_entry_configs (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    entry_type  VARCHAR(50) NOT NULL UNIQUE,   -- PAGO_PLANILLA, FORMALIZACION, etc.
    name        VARCHAR(100) NOT NULL,
    description TEXT NULL,                     -- con variables: {reference}, {clienteNombre}…
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP NULL,
    updated_at  TIMESTAMP NULL,
    INDEX idx_entry_type (entry_type),
    INDEX idx_active     (active)
);

-- Líneas del asiento (mínimo 2: 1 débito + 1 crédito)
CREATE TABLE accounting_entry_lines (
    id                          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    accounting_entry_config_id  BIGINT UNSIGNED NOT NULL,
    line_order                  INT NOT NULL DEFAULT 0,
    movement_type               ENUM('debit','credit') NOT NULL,
    account_type                ENUM('fixed','deductora','deductora_or_fixed','investor_prestamos','investor_intereses') NOT NULL DEFAULT 'fixed',
    account_key                 VARCHAR(50) NULL,       -- clave en erp_accounting_accounts si account_type=fixed
    description                 VARCHAR(255) NULL,      -- con variables
    amount_component            VARCHAR(50) NOT NULL,   -- total|capital|interes_corriente|interes_moratorio|poliza|sobrante|cargo_adicional…
    cargo_adicional_key         VARCHAR(50) NULL,       -- si amount_component=cargo_adicional: comision|transporte|respaldo_deudor…
    created_at                  TIMESTAMP NULL,
    updated_at                  TIMESTAMP NULL,
    CONSTRAINT fk_aec FOREIGN KEY (accounting_entry_config_id) REFERENCES accounting_entry_configs(id) ON DELETE CASCADE,
    INDEX idx_config (accounting_entry_config_id)
);
```

### Modelos (backend)

```php
class AccountingEntryConfig extends Model {
    protected $fillable = ['entry_type','name','description','active'];
    protected $casts    = ['active' => 'boolean'];

    public function lines() {
        return $this->hasMany(AccountingEntryLine::class)->orderBy('line_order');
    }
}

class AccountingEntryLine extends Model {
    protected $fillable = [
        'accounting_entry_config_id','line_order','movement_type',
        'account_type','account_key','description',
        'amount_component','cargo_adicional_key',
    ];
}
```

### Lógica de resolución de cuentas (backend)

Al momento de ejecutar un asiento, las líneas se resuelven así:

```php
function resolveAccountCode(AccountingEntryLine $line, array $context): ?string {
    return match($line->account_type) {
        'fixed'             => ErpAccountingAccount::where('key', $line->account_key)->value('account_code'),
        'deductora'         => Deductora::find($context['deductora_id'])?->erp_account_code,
        'deductora_or_fixed'=> Deductora::find($context['deductora_id'])?->erp_account_code
                                ?? ErpAccountingAccount::where('key', $line->account_key)->value('account_code'),
        'investor_prestamos'=> Investor::find($context['investor_id'])?->erp_prestamos_account_code,
        'investor_intereses' => Investor::find($context['investor_id'])?->erp_intereses_account_code,
        default             => null,
    };
}
```

### Resolución de componentes de monto

```php
function resolveAmount(string $component, ?string $cargoKey, array $breakdown): float {
    return match($component) {
        'total'                  => $breakdown['total'] ?? 0,
        'capital'                => $breakdown['capital'] ?? 0,
        'interes_corriente'      => $breakdown['interes_corriente'] ?? 0,
        'interes_moratorio'      => $breakdown['interes_moratorio'] ?? 0,
        'poliza'                 => $breakdown['poliza'] ?? 0,
        'sobrante'               => $breakdown['sobrante'] ?? 0,
        'penalizacion'           => $breakdown['penalizacion'] ?? 0,
        'cargos_adicionales_total'=> array_sum($breakdown['cargos_adicionales'] ?? []),
        'cargo_adicional'        => $breakdown['cargos_adicionales'][$cargoKey] ?? 0,
        'interes_neto'           => $breakdown['interes_neto'] ?? 0,
        'interes_bruto'          => $breakdown['interes_bruto'] ?? 0,
        'retencion'              => $breakdown['retencion'] ?? 0,
        default                  => 0,
    };
}
```

### Variables de interpolación en descripciones

```php
function interpolateDescription(string $template, array $context): string {
    $vars = [
        '{reference}'        => $context['reference'] ?? '',
        '{amount}'           => number_format($context['amount'] ?? 0, 2),
        '{clienteNombre}'    => $context['lead_nombre'] ?? '',
        '{cedula}'           => $context['cedula'] ?? '',
        '{credit_id}'        => $context['credit_id'] ?? '',
        '{deductora_nombre}' => $context['deductora'] ?? '',
    ];
    return str_replace(array_keys($vars), array_values($vars), $template);
}
```

### Frontend — Sección en `/dashboard/configuracion` (tab Contabilidad ERP)

La configuración de asientos vive como una sección dentro del tab de configuración contable. Implementar como un componente independiente `ConfiguracionAsientosSection`.

#### Tabla de configuraciones

Columnas: **Tipo** (código) · **Nombre** · **Líneas** (badge con count) · **Estado** (toggle switch) · **Acciones** (editar / eliminar)

#### Dialog de crear/editar configuración

```
┌─────────────────────────────────────────────────┐
│ Configurar Asiento Contable                      │
├─────────────────────────────────────────────────┤
│ Tipo de Asiento *      [Dropdown — PAGO_PLANILLA]│
│ Nombre *               [Input text]              │
│ Descripción            [Textarea + hint vars]    │
├─────────────────────────────────────────────────┤
│ LÍNEAS DEL ASIENTO                   [+ Agregar] │
│                                                  │
│ Línea 1:                                         │
│  Movimiento  [Débito ▼]                          │
│  Tipo Cuenta [Fija ▼]                            │
│  Cuenta      [banco_credipep (1-100) ▼]          │
│  Componente  [total ▼]                           │
│  Descripción [Cobro planilla {reference}]        │
│  [🗑]                                             │
│                                                  │
│ Línea 2:                                         │
│  Movimiento  [Crédito ▼]                         │
│  Tipo Cuenta [Por Deductora ▼]                   │
│  Cuenta      [Se resuelve en ejecución 🔒]        │
│  Componente  [total ▼]                           │
│  Descripción [Planilla {deductora_nombre}]       │
│  [🗑]                                             │
│                                                  │
├─────────────────────────────────────────────────┤
│                    [Cancelar] [Guardar]          │
└─────────────────────────────────────────────────┘
```

**Reglas de UI:**
- Si `account_type` ≠ `fixed` → campo Cuenta deshabilitado, mostrar "Se resuelve en tiempo de ejecución"
- Si `amount_component = cargo_adicional` → mostrar campo adicional "¿Cuál Cargo?" con opciones: comision · transporte · respaldo_deudor · descuento_factura · cancelacion_manchas
- El dropdown de Tipo de Asiento filtra los tipos ya configurados (no permite duplicados) — excepto al editar
- Mínimo 2 líneas; el botón eliminar solo aparece si hay 3 o más líneas
- El toggle "activo" en la tabla hace PATCH inmediato sin abrir el dialog

**Opciones de los dropdowns:**

```ts
const MOVEMENT_TYPES = [
  { value: 'debit',  label: 'Débito' },
  { value: 'credit', label: 'Crédito' },
];

const ACCOUNT_TYPES = [
  { value: 'fixed',               label: 'Cuenta Fija' },
  { value: 'deductora',           label: 'Por Deductora' },
  { value: 'deductora_or_fixed',  label: 'Deductora o Fija' },
  { value: 'investor_prestamos',  label: 'Inversionista — Préstamos' },
  { value: 'investor_intereses',  label: 'Inversionista — Intereses' },
];

const AMOUNT_COMPONENTS = [
  { value: 'total',                  label: 'Total del pago' },
  { value: 'capital',                label: 'Capital' },
  { value: 'interes_corriente',      label: 'Interés Corriente' },
  { value: 'interes_moratorio',      label: 'Interés Moratorio' },
  { value: 'poliza',                 label: 'Póliza' },
  { value: 'sobrante',               label: 'Saldo Sobrante' },
  { value: 'penalizacion',           label: 'Penalización' },
  { value: 'cargos_adicionales_total', label: 'Total Cargos Adicionales' },
  { value: 'cargo_adicional',        label: 'Cargo Adicional Específico' },
  { value: 'interes_neto',           label: 'Interés Neto (inversiones)' },
  { value: 'interes_bruto',          label: 'Interés Bruto (inversiones)' },
  { value: 'retencion',              label: 'Retención (inversiones)' },
];

const CARGO_ADICIONAL_KEYS = [
  { value: 'comision',            label: 'Comisión' },
  { value: 'transporte',          label: 'Transporte' },
  { value: 'respaldo_deudor',     label: 'Respaldo Deudor' },
  { value: 'descuento_factura',   label: 'Descuento Factura' },
  { value: 'cancelacion_manchas', label: 'Cancelación de Manchas' },
];
```

---

## RESUMEN DE ARCHIVOS A CREAR

### Backend
```
app/Models/ActivityLog.php
app/Models/AccountingEntryLog.php
app/Models/AccountingEntryConfig.php
app/Models/AccountingEntryLine.php
app/Traits/LogsActivity.php
app/Traits/AccountingTrigger.php
app/Http/Controllers/Api/ActivityLogController.php
app/Http/Controllers/Api/AccountingEntryLogController.php
app/Http/Controllers/Api/AccountingEntryConfigController.php
database/migrations/..._create_activity_logs_table.php
database/migrations/..._create_accounting_entry_logs_table.php
database/migrations/..._create_accounting_entry_configs_table.php
database/migrations/..._create_accounting_entry_lines_table.php
```

### Frontend
```
src/app/dashboard/auditoria/page.tsx
src/app/dashboard/auditoria-asientos/page.tsx
src/components/configuracion/ConfiguracionAsientosSection.tsx
```

---

## NOTAS DE IMPLEMENTACIÓN

1. **LogsActivity** no es automático — los controllers que quieran auditoría deben usar el trait y llamar `$this->logActivity()` explícitamente en cada operación relevante.

2. **AccountingEntryLog** sí puede ser automático si se invoca desde un observer o desde el trait `AccountingTrigger` en los services de negocio.

3. **La configuración de asientos** es solo la definición de plantillas. La ejecución real (llamar al ERP, resolver cuentas, construir el payload) vive en el trait `AccountingTrigger` o en un Service dedicado.

4. **erp_accounting_accounts** es una tabla catálogo separada (no documentada aquí) que mapea claves internas (`banco_credipep`) a códigos del ERP (`1-100`). La configuración de asientos hace referencia a estas claves.

5. Los tres módulos son independientes y pueden implementarse por separado. La auditoría de asientos y la configuración de asientos se complementan, pero la auditoría de actividad es completamente autónoma.
