# Guía Técnica Completa: Implementación de Asientos Contables

**Fecha de creación:** 2026-02-12
**Sistema:** CREDIPEPE - Laravel 12 + Next.js
**Estado actual:** Marcadores implementados (fase 1)
**Próximo paso:** Integración con API externa de contabilidad (fase 2)

---

## 📋 Índice

1. [Contexto y Objetivo](#contexto-y-objetivo)
2. [Arquitectura de la Solución](#arquitectura-de-la-solución)
3. [Lógica Contable del Sistema](#lógica-contable-del-sistema)
4. [Implementación Actual (Fase 1)](#implementación-actual-fase-1)
5. [Archivos Modificados](#archivos-modificados)
6. [Puntos de Disparo Detallados](#puntos-de-disparo-detallados)
7. [Guía de Integración con API Externa (Fase 2)](#guía-de-integración-con-api-externa-fase-2)
8. [Ejemplos de Código](#ejemplos-de-código)
9. [Payloads de Ejemplo](#payloads-de-ejemplo)
10. [Testing y Validación](#testing-y-validación)
11. [Troubleshooting](#troubleshooting)
12. [Checklist de Implementación](#checklist-de-implementación)

---

## 🎯 Contexto y Objetivo

### Problema Original

El sistema CREDIPEPE maneja operaciones de crédito (formalización, pagos, refundiciones, anulaciones) pero **NO genera asientos contables**. La contabilidad se manejará en un sistema externo a través de una API.

### Solución Implementada

Se han colocado **marcadores estratégicos** en todos los puntos del código donde ocurren transacciones financieras que requieren registro contable. Estos marcadores:

- ✅ Identifican el momento exacto de la transacción
- ✅ Capturan todos los datos necesarios para el asiento
- ✅ Registran en logs para auditoría
- ✅ Están listos para ser reemplazados por llamadas HTTP a API externa

### Objetivo Final

Cuando se active la fase 2, cada marcador se convertirá en una llamada HTTP a la API de contabilidad externa, creando asientos contables en tiempo real sin modificar la lógica de negocio del sistema.

---

## 🏗 Arquitectura de la Solución

### Diagrama de Flujo

```
┌─────────────────────────────────────────────────────────┐
│  CREDIPEPE (Laravel)                                    │
│                                                         │
│  ┌──────────────────────────────────────────┐          │
│  │ Controlador (Ej: CreditController)       │          │
│  │                                          │          │
│  │  1. Ejecuta operación (formalización)   │          │
│  │  2. Guarda en BD local                  │          │
│  │  3. Llama triggerAccountingXXX()        │───────┐  │
│  └──────────────────────────────────────────┘       │  │
│                                                      │  │
│  ┌──────────────────────────────────────────┐       │  │
│  │ Trait: AccountingTrigger                 │◄──────┘  │
│  │                                          │          │
│  │  - Prepara payload                      │          │
│  │  - [FASE 1] Log a archivo               │          │
│  │  - [FASE 2] POST a API externa ────────────────┐   │
│  └──────────────────────────────────────────┘     │   │
│                                                    │   │
└────────────────────────────────────────────────────┼───┘
                                                     │
                                                     ▼
                                    ┌────────────────────────────┐
                                    │  API Contabilidad Externa  │
                                    │                            │
                                    │  - Recibe payload JSON     │
                                    │  - Valida datos            │
                                    │  - Crea asiento contable   │
                                    │  - Retorna confirmación    │
                                    └────────────────────────────┘
```

### Patrón de Diseño

**Patrón:** Strategy + Template Method

- **Trait `AccountingTrigger`**: Encapsula la lógica de disparo contable
- **Métodos protegidos**: Cada tipo de asiento tiene su método específico
- **Controladores**: Usan el trait e invocan el método correspondiente
- **Desacoplamiento**: La lógica de negocio no conoce detalles de la API contable

---

## 💰 Lógica Contable del Sistema

### Principio Fundamental

El sistema CREDIPEPE NO es un sistema contable tradicional. Es un sistema de **gestión de préstamos** que genera **movimientos** que deben reflejarse en la contabilidad.

### Cuentas Principales

| Cuenta Contable | Tipo | Descripción |
|----------------|------|-------------|
| **Banco CREDIPEPE** | Activo | Efectivo disponible en banco |
| **Cuentas por Cobrar** | Activo | Dinero que los clientes deben a CREDIPEPE |

### Reglas Contables por Operación

#### 1. **Formalización de Crédito**

**Momento:** Cliente firma el pagaré y se aprueba el crédito

**Explicación:** CREDIPEPE entrega dinero (sale del banco) y crea una cuenta por cobrar (el cliente debe ese dinero)

**Asiento:**
```
DÉBITO:  Cuentas por Cobrar      ₡1,000,000
CRÉDITO: Banco CREDIPEPE         ₡1,000,000
```

#### 2. **Pago de Cuota (Cualquier origen)**

**Momento:** Cliente paga cuota (ventanilla, planilla, saldo pendiente, etc.)

**Explicación:** Entra dinero al banco y se reduce lo que el cliente debe

**Asiento:**
```
DÉBITO:  Banco CREDIPEPE         ₡150,000
CRÉDITO: Cuentas por Cobrar      ₡150,000
```

**Desglose interno** (no afecta el asiento principal pero se registra):
- Mora: ₡5,000
- Interés Vencido: ₡10,000
- Interés Corriente: ₡35,000
- Póliza: ₡2,000
- Capital: ₡98,000

#### 3. **Cancelación Anticipada**

**Momento:** Cliente paga todo el crédito antes del plazo

**Explicación:** Igual que un pago normal, pero por el saldo total + penalización

**Asiento:**
```
DÉBITO:  Banco CREDIPEPE         ₡850,000
CRÉDITO: Cuentas por Cobrar      ₡850,000
```

#### 4. **Refundición (Doble Asiento)**

**Momento:** Se cierra un crédito viejo y se abre uno nuevo (consolidación)

**Explicación:**
- Se "paga" sintéticamente el crédito viejo con el nuevo
- Se crea un nuevo crédito que incluye el saldo del viejo + dinero adicional

**Asiento 1 - Cierre del crédito viejo:**
```
DÉBITO:  Banco CREDIPEPE         ₡500,000  (saldo absorbido)
CRÉDITO: Cuentas por Cobrar      ₡500,000
```

**Asiento 2 - Apertura del crédito nuevo:**
```
DÉBITO:  Cuentas por Cobrar      ₡1,200,000  (nuevo crédito)
CRÉDITO: Banco CREDIPEPE         ₡1,200,000
```

**Neto:**
- Sale del banco: ₡1,200,000 - ₡500,000 = ₡700,000
- Esto coincide con el "monto entregado" al cliente

#### 5. **Abono a Capital (desde Saldo Pendiente)**

**Momento:** Se aplica un exceso de planilla directamente al capital

**Explicación:** Mismo efecto que un pago, reduce la deuda

**Asiento:**
```
DÉBITO:  Banco CREDIPEPE         ₡25,000
CRÉDITO: Cuentas por Cobrar      ₡25,000
```

#### 6. **Anulación de Planilla (Reversa)**

**Momento:** Se anula una planilla completa (todos sus pagos)

**Explicación:** Se revierten todos los pagos, como si nunca hubieran ocurrido

**Asiento (por cada pago anulado):**
```
DÉBITO:  Cuentas por Cobrar      ₡150,000
CRÉDITO: Banco CREDIPEPE         ₡150,000
```

---

## ✅ Implementación Actual (Fase 1)

### Archivo Principal: `AccountingTrigger.php`

**Ubicación:** `backend/app/Traits/AccountingTrigger.php`

**Métodos implementados:**

```php
protected function triggerAccountingFormalizacion(
    int $creditId,
    float $amount,
    string $reference,
    array $additionalData = []
)

protected function triggerAccountingPago(
    int $creditId,
    int $paymentId,
    float $amount,
    string $source,
    array $breakdown = []
)

protected function triggerAccountingDevolucion(
    int $creditId,
    ?int $paymentId,
    float $amount,
    string $reason,
    array $additionalData = []
)

protected function triggerAccountingRefundicionCierre(
    int $oldCreditId,
    float $balanceAbsorbed,
    int $newCreditId
)

protected function triggerAccountingRefundicionNuevo(
    int $newCreditId,
    float $amount,
    int $oldCreditId,
    float $cashDelivered
)
```

**Estado actual:** Todos los métodos registran en `storage/logs/laravel.log`

---

## 📁 Archivos Modificados

### Controladores que usan el trait:

| Archivo | Línea | Cambio |
|---------|-------|--------|
| `CreditController.php` | 14 | `use App\Traits\AccountingTrigger;` |
| `CreditController.php` | 24 | `use AccountingTrigger;` |
| `CreditPaymentController.php` | 6 | `use App\Traits\AccountingTrigger;` |
| `CreditPaymentController.php` | 25 | `use AccountingTrigger;` |
| `SaldoPendienteController.php` | 7 | `use App\Traits\AccountingTrigger;` |
| `SaldoPendienteController.php` | 13 | `use AccountingTrigger;` |
| `PlanillaUploadController.php` | 9 | `use App\Traits\AccountingTrigger;` |
| `PlanillaUploadController.php` | 16 | `use AccountingTrigger;` |

### Triggers colocados:

| Archivo | Método | Línea aproximada | Trigger |
|---------|--------|------------------|---------|
| `CreditController.php` | `update()` | ~632 | `triggerAccountingFormalizacion()` |
| `CreditController.php` | `refundicion()` | ~1048 | `triggerAccountingRefundicionCierre()` |
| `CreditController.php` | `refundicion()` | ~1056 | `triggerAccountingRefundicionNuevo()` |
| `CreditPaymentController.php` | `processPaymentTransaction()` | ~975 | `triggerAccountingPago()` |
| `CreditPaymentController.php` | `cancelacionAnticipada()` | ~1340 | `triggerAccountingPago()` |
| `SaldoPendienteController.php` | `asignar()` | ~284 | `triggerAccountingPago()` |
| `PlanillaUploadController.php` | `anular()` | ~147 | `triggerAccountingDevolucion()` |

---

## 🎯 Puntos de Disparo Detallados

### 1. Formalización de Crédito

**Archivo:** `backend/app/Http/Controllers/Api/CreditController.php`
**Método:** `update()`
**Línea:** ~632

**Condición de disparo:**
```php
if (isset($validated['status']) &&
    strtolower($validated['status']) === 'formalizado' &&
    strtolower($previousStatus) !== 'formalizado') {

    // ... código de formalización ...

    // TRIGGER AQUÍ
    $this->triggerAccountingFormalizacion(
        $credit->id,
        (float) $credit->monto_credito,
        $credit->reference,
        [
            'lead_id' => $credit->lead_id,
            'lead_cedula' => $credit->lead->cedula ?? null,
            'lead_nombre' => $credit->lead->name ?? null,
            'tasa_id' => $credit->tasa_id,
            'plazo' => $credit->plazo,
            'formalized_at' => $credit->formalized_at->toIso8601String(),
        ]
    );
}
```

**Asiento esperado:**
- DÉBITO: Cuentas por Cobrar
- CRÉDITO: Banco CREDIPEPE

---

### 2. Pago de Crédito (Todos los orígenes)

**Archivo:** `backend/app/Http/Controllers/Api/CreditPaymentController.php`
**Método:** `processPaymentTransaction()` (privado, llamado por todos)
**Línea:** ~975

**Flujo de llamadas:**
```
store() (Ventanilla)           ──┐
upload() (Planilla)             ─┤
adelanto() (Extraordinario)     ─┼──► processPaymentTransaction()
asignar() → processPublic()     ─┤         │
                                 ─┘         │
                                            ▼
                                   triggerAccountingPago()
```

**Código del trigger:**
```php
// Después de crear el CreditPayment
$paymentRecord = CreditPayment::create([...]);

// TRIGGER AQUÍ
$this->triggerAccountingPago(
    $credit->id,
    $paymentRecord->id,
    $montoEntrante,
    $source,  // 'Ventanilla', 'Planilla', 'Saldo Pendiente', etc.
    [
        'mora' => $credit->planDePagos()->sum('movimiento_interes_moratorio'),
        'interes_vencido' => $credit->planDePagos()->sum('movimiento_int_corriente_vencido'),
        'interes_corriente' => $credit->planDePagos()->sum('movimiento_interes_corriente'),
        'poliza' => $credit->planDePagos()->sum('movimiento_poliza'),
        'capital' => $capitalAmortizadoHoy,
        'cedula' => $cedulaRef,
        'credit_reference' => $credit->reference,
        'lead_nombre' => $credit->lead->name ?? null,
    ]
);
```

**Asiento esperado:**
- DÉBITO: Banco CREDIPEPE
- CRÉDITO: Cuentas por Cobrar

---

### 3. Cancelación Anticipada

**Archivo:** `backend/app/Http/Controllers/Api/CreditPaymentController.php`
**Método:** `cancelacionAnticipada()`
**Línea:** ~1340

**Código del trigger:**
```php
// Después de cerrar el crédito
$credit->saldo = 0;
$credit->status = 'Cerrado';
$credit->save();

// TRIGGER AQUÍ
$this->triggerAccountingPago(
    $credit->id,
    $payment->id,
    $montoTotalCancelar,
    'Cancelación Anticipada',
    [
        'capital' => $saldoCapital,
        'intereses_vencidos' => $interesesVencidos,
        'penalizacion' => $penalizacion,
        'cuota_actual' => $numeroCuotaActual,
        'aplico_penalizacion' => $numeroCuotaActual < 12,
        'cedula' => $credit->lead->cedula ?? null,
        'credit_reference' => $credit->reference,
    ]
);
```

**Asiento esperado:**
- DÉBITO: Banco CREDIPEPE
- CRÉDITO: Cuentas por Cobrar

---

### 4. Abono a Capital

**Archivo:** `backend/app/Http/Controllers/Api/SaldoPendienteController.php`
**Método:** `asignar()` (cuando `accion === 'capital'`)
**Línea:** ~284

**Código del trigger:**
```php
// Después de reducir el saldo directamente
$credit->saldo = max(0, $saldoAnterior - $montoAplicar);
$credit->save();

// Crear el CreditPayment
$payment = \App\Models\CreditPayment::create([...]);

// TRIGGER AQUÍ
$this->triggerAccountingPago(
    $credit->id,
    $payment->id,
    $montoAplicar,
    'Abono a Capital',
    [
        'capital' => $montoAplicar,
        'saldo_anterior' => $saldoAnterior,
        'nuevo_saldo' => $credit->saldo,
        'cedula' => $saldo->cedula,
        'credit_reference' => $credit->reference,
        'origen' => 'Saldo Pendiente',
    ]
);
```

**Nota:** Si `accion === 'cuota'`, NO se dispara trigger aquí porque se llama a `processPaymentTransactionPublic()` que ya tiene el trigger.

**Asiento esperado:**
- DÉBITO: Banco CREDIPEPE
- CRÉDITO: Cuentas por Cobrar

---

### 5. Refundición (Doble Asiento)

**Archivo:** `backend/app/Http/Controllers/Api/CreditController.php`
**Método:** `refundicion()`
**Líneas:** ~1048 y ~1056

**Código de los triggers:**
```php
// Después de generar el plan del nuevo crédito
$this->calculateAndSetCuota($newCredit);
$this->generateAmortizationSchedule($newCredit);

// TRIGGER 1: Cierre del crédito viejo
$this->triggerAccountingRefundicionCierre(
    $oldCredit->id,
    $saldoAbsorbido,
    $newCredit->id
);

// TRIGGER 2: Formalización del nuevo crédito
$this->triggerAccountingRefundicionNuevo(
    $newCredit->id,
    (float) $validated['monto_credito'],
    $oldCredit->id,
    $montoEntregado
);
```

**Asientos esperados:**

Asiento 1:
- DÉBITO: Banco CREDIPEPE (saldo absorbido)
- CRÉDITO: Cuentas por Cobrar (saldo absorbido)

Asiento 2:
- DÉBITO: Cuentas por Cobrar (monto nuevo)
- CRÉDITO: Banco CREDIPEPE (monto nuevo)

---

### 6. Anulación de Planilla

**Archivo:** `backend/app/Http/Controllers/Api/PlanillaUploadController.php`
**Método:** `anular()`
**Línea:** ~147

**Código del trigger:**
```php
foreach ($pagos as $pago) {
    // ... código de reversión ...

    // Marcar pago como reversado
    $pago->estado = 'Reversado';
    $pago->save();

    // TRIGGER AQUÍ (por cada pago)
    $this->triggerAccountingDevolucion(
        $credit->id,
        $pago->id,
        (float) $pago->monto,
        'Anulación de planilla: ' . $validated['motivo'],
        [
            'planilla_id' => $planilla->id,
            'deductora_id' => $planilla->deductora_id,
            'fecha_planilla' => $planilla->fecha_planilla,
            'amortizacion_revertida' => (float) $pago->amortizacion,
            'interes_revertido' => (float) $pago->interes_corriente,
            'mora_revertida' => (float) $pago->interes_moratorio,
            'cedula' => $pago->cedula,
            'credit_reference' => $credit->reference,
        ]
    );
}
```

**Asiento esperado (por cada pago):**
- DÉBITO: Cuentas por Cobrar
- CRÉDITO: Banco CREDIPEPE

---

## 🔌 Guía de Integración con API Externa (Fase 2)

### Paso 1: Configuración de Credenciales

**Archivo:** `.env`

```env
# API Contabilidad Externa
ACCOUNTING_API_URL=https://api-contabilidad.ejemplo.com
ACCOUNTING_API_KEY=tu_api_key_aqui
ACCOUNTING_API_SECRET=tu_secret_aqui
ACCOUNTING_API_TIMEOUT=30
ACCOUNTING_API_RETRIES=3
```

**Archivo:** `config/services.php`

```php
return [
    // ... otras configuraciones ...

    'accounting' => [
        'url' => env('ACCOUNTING_API_URL'),
        'api_key' => env('ACCOUNTING_API_KEY'),
        'api_secret' => env('ACCOUNTING_API_SECRET'),
        'timeout' => env('ACCOUNTING_API_TIMEOUT', 30),
        'retries' => env('ACCOUNTING_API_RETRIES', 3),
    ],
];
```

---

### Paso 2: Crear Servicio HTTP para API

**Archivo nuevo:** `backend/app/Services/AccountingApiService.php`

```php
<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Exception;

class AccountingApiService
{
    protected string $baseUrl;
    protected string $apiKey;
    protected int $timeout;
    protected int $retries;

    public function __construct()
    {
        $this->baseUrl = config('services.accounting.url');
        $this->apiKey = config('services.accounting.api_key');
        $this->timeout = config('services.accounting.timeout', 30);
        $this->retries = config('services.accounting.retries', 3);
    }

    /**
     * Enviar asiento contable a la API externa
     */
    public function sendAccountingEntry(array $payload): array
    {
        $attempt = 0;
        $lastException = null;

        while ($attempt < $this->retries) {
            try {
                $response = Http::timeout($this->timeout)
                    ->withHeaders([
                        'Authorization' => 'Bearer ' . $this->apiKey,
                        'Content-Type' => 'application/json',
                        'Accept' => 'application/json',
                    ])
                    ->post($this->baseUrl . '/api/asientos', $payload);

                if ($response->successful()) {
                    Log::info('Asiento contable enviado exitosamente', [
                        'trigger_type' => $payload['trigger_type'] ?? 'UNKNOWN',
                        'credit_id' => $payload['credit_id'] ?? null,
                        'api_response' => $response->json(),
                    ]);

                    return [
                        'success' => true,
                        'data' => $response->json(),
                        'http_status' => $response->status(),
                    ];
                }

                // Si no fue exitoso, loggear y reintentar
                Log::warning('Asiento contable falló, reintentando...', [
                    'attempt' => $attempt + 1,
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

            } catch (Exception $e) {
                $lastException = $e;
                Log::error('Error al enviar asiento contable', [
                    'attempt' => $attempt + 1,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
            }

            $attempt++;

            if ($attempt < $this->retries) {
                // Espera exponencial: 1s, 2s, 4s...
                sleep(pow(2, $attempt - 1));
            }
        }

        // Si llegamos aquí, todos los intentos fallaron
        Log::critical('Asiento contable FALLÓ después de todos los reintentos', [
            'payload' => $payload,
            'last_error' => $lastException ? $lastException->getMessage() : 'Unknown',
        ]);

        return [
            'success' => false,
            'error' => $lastException ? $lastException->getMessage() : 'Failed after retries',
            'attempts' => $attempt,
        ];
    }

    /**
     * Verificar conexión con la API
     */
    public function healthCheck(): bool
    {
        try {
            $response = Http::timeout(5)
                ->withHeaders(['Authorization' => 'Bearer ' . $this->apiKey])
                ->get($this->baseUrl . '/api/health');

            return $response->successful();
        } catch (Exception $e) {
            Log::error('Health check fallido', ['error' => $e->getMessage()]);
            return false;
        }
    }
}
```

---

### Paso 3: Modificar el Trait

**Archivo:** `backend/app/Traits/AccountingTrigger.php`

**Reemplazar cada método con la nueva lógica:**

```php
<?php

namespace App\Traits;

use App\Services\AccountingApiService;
use Illuminate\Support\Facades\Log;

trait AccountingTrigger
{
    /**
     * ACCOUNTING_API_TRIGGER: Formalización de Crédito
     */
    protected function triggerAccountingFormalizacion(int $creditId, float $amount, string $reference, array $additionalData = [])
    {
        $payload = [
            'trigger_type' => 'FORMALIZACION',
            'credit_id' => $creditId,
            'reference' => $reference,
            'amount' => $amount,
            'accounting_entry' => [
                'debit' => [
                    'account_code' => 'CUENTAS_POR_COBRAR',
                    'account_name' => 'Cuentas por Cobrar',
                    'amount' => $amount,
                ],
                'credit' => [
                    'account_code' => 'BANCO_CREDIPEPE',
                    'account_name' => 'Banco CREDIPEPE',
                    'amount' => $amount,
                ],
            ],
            'additional_data' => $additionalData,
            'timestamp' => now()->toIso8601String(),
            'source_system' => 'CREDIPEPE',
        ];

        // Enviar a API externa
        $service = app(AccountingApiService::class);
        $result = $service->sendAccountingEntry($payload);

        // Si falla, loggear pero NO detener la operación principal
        if (!$result['success']) {
            Log::critical('FALLO EN ENVÍO DE ASIENTO CONTABLE - REQUIERE ACCIÓN MANUAL', [
                'trigger_type' => 'FORMALIZACION',
                'credit_id' => $creditId,
                'payload' => $payload,
                'error' => $result['error'] ?? 'Unknown',
            ]);
        }

        return $result;
    }

    /**
     * ACCOUNTING_API_TRIGGER: Pago de Crédito
     */
    protected function triggerAccountingPago(int $creditId, int $paymentId, float $amount, string $source, array $breakdown = [])
    {
        $payload = [
            'trigger_type' => 'PAGO',
            'credit_id' => $creditId,
            'payment_id' => $paymentId,
            'amount' => $amount,
            'source' => $source,
            'accounting_entry' => [
                'debit' => [
                    'account_code' => 'BANCO_CREDIPEPE',
                    'account_name' => 'Banco CREDIPEPE',
                    'amount' => $amount,
                ],
                'credit' => [
                    'account_code' => 'CUENTAS_POR_COBRAR',
                    'account_name' => 'Cuentas por Cobrar',
                    'amount' => $amount,
                ],
            ],
            'breakdown' => $breakdown,
            'timestamp' => now()->toIso8601String(),
            'source_system' => 'CREDIPEPE',
        ];

        $service = app(AccountingApiService::class);
        $result = $service->sendAccountingEntry($payload);

        if (!$result['success']) {
            Log::critical('FALLO EN ENVÍO DE ASIENTO CONTABLE - REQUIERE ACCIÓN MANUAL', [
                'trigger_type' => 'PAGO',
                'credit_id' => $creditId,
                'payment_id' => $paymentId,
                'payload' => $payload,
                'error' => $result['error'] ?? 'Unknown',
            ]);
        }

        return $result;
    }

    /**
     * ACCOUNTING_API_TRIGGER: Devolución/Anulación de Pago
     */
    protected function triggerAccountingDevolucion(int $creditId, ?int $paymentId, float $amount, string $reason, array $additionalData = [])
    {
        $payload = [
            'trigger_type' => 'DEVOLUCION',
            'credit_id' => $creditId,
            'payment_id' => $paymentId,
            'amount' => $amount,
            'reason' => $reason,
            'accounting_entry' => [
                'debit' => [
                    'account_code' => 'CUENTAS_POR_COBRAR',
                    'account_name' => 'Cuentas por Cobrar',
                    'amount' => $amount,
                ],
                'credit' => [
                    'account_code' => 'BANCO_CREDIPEPE',
                    'account_name' => 'Banco CREDIPEPE',
                    'amount' => $amount,
                ],
            ],
            'additional_data' => $additionalData,
            'timestamp' => now()->toIso8601String(),
            'source_system' => 'CREDIPEPE',
        ];

        $service = app(AccountingApiService::class);
        $result = $service->sendAccountingEntry($payload);

        if (!$result['success']) {
            Log::critical('FALLO EN ENVÍO DE ASIENTO CONTABLE - REQUIERE ACCIÓN MANUAL', [
                'trigger_type' => 'DEVOLUCION',
                'credit_id' => $creditId,
                'payment_id' => $paymentId,
                'payload' => $payload,
                'error' => $result['error'] ?? 'Unknown',
            ]);
        }

        return $result;
    }

    /**
     * ACCOUNTING_API_TRIGGER: Refundición - Cierre de Crédito Viejo
     */
    protected function triggerAccountingRefundicionCierre(int $oldCreditId, float $balanceAbsorbed, int $newCreditId)
    {
        $payload = [
            'trigger_type' => 'REFUNDICION_CIERRE',
            'old_credit_id' => $oldCreditId,
            'new_credit_id' => $newCreditId,
            'balance_absorbed' => $balanceAbsorbed,
            'accounting_entry' => [
                'debit' => [
                    'account_code' => 'BANCO_CREDIPEPE',
                    'account_name' => 'Banco CREDIPEPE',
                    'amount' => $balanceAbsorbed,
                ],
                'credit' => [
                    'account_code' => 'CUENTAS_POR_COBRAR',
                    'account_name' => 'Cuentas por Cobrar',
                    'amount' => $balanceAbsorbed,
                ],
            ],
            'timestamp' => now()->toIso8601String(),
            'source_system' => 'CREDIPEPE',
        ];

        $service = app(AccountingApiService::class);
        $result = $service->sendAccountingEntry($payload);

        if (!$result['success']) {
            Log::critical('FALLO EN ENVÍO DE ASIENTO CONTABLE - REQUIERE ACCIÓN MANUAL', [
                'trigger_type' => 'REFUNDICION_CIERRE',
                'old_credit_id' => $oldCreditId,
                'payload' => $payload,
                'error' => $result['error'] ?? 'Unknown',
            ]);
        }

        return $result;
    }

    /**
     * ACCOUNTING_API_TRIGGER: Refundición - Formalización de Nuevo Crédito
     */
    protected function triggerAccountingRefundicionNuevo(int $newCreditId, float $amount, int $oldCreditId, float $cashDelivered)
    {
        $payload = [
            'trigger_type' => 'REFUNDICION_NUEVO',
            'new_credit_id' => $newCreditId,
            'old_credit_id' => $oldCreditId,
            'total_amount' => $amount,
            'cash_delivered' => $cashDelivered,
            'accounting_entry' => [
                'debit' => [
                    'account_code' => 'CUENTAS_POR_COBRAR',
                    'account_name' => 'Cuentas por Cobrar',
                    'amount' => $amount,
                ],
                'credit' => [
                    'account_code' => 'BANCO_CREDIPEPE',
                    'account_name' => 'Banco CREDIPEPE',
                    'amount' => $amount,
                ],
            ],
            'timestamp' => now()->toIso8601String(),
            'source_system' => 'CREDIPEPE',
        ];

        $service = app(AccountingApiService::class);
        $result = $service->sendAccountingEntry($payload);

        if (!$result['success']) {
            Log::critical('FALLO EN ENVÍO DE ASIENTO CONTABLE - REQUIERE ACCIÓN MANUAL', [
                'trigger_type' => 'REFUNDICION_NUEVO',
                'new_credit_id' => $newCreditId,
                'payload' => $payload,
                'error' => $result['error'] ?? 'Unknown',
            ]);
        }

        return $result;
    }
}
```

---

### Paso 4: (Opcional) Implementar Cola de Trabajos

Para operaciones más robustas y asíncronas:

**Archivo nuevo:** `backend/app/Jobs/SendAccountingEntry.php`

```php
<?php

namespace App\Jobs;

use App\Services\AccountingApiService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SendAccountingEntry implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 3;
    public $backoff = [60, 300, 900]; // 1min, 5min, 15min

    protected array $payload;

    public function __construct(array $payload)
    {
        $this->payload = $payload;
    }

    public function handle(AccountingApiService $service): void
    {
        $result = $service->sendAccountingEntry($this->payload);

        if (!$result['success']) {
            Log::error('Job de asiento contable falló', [
                'payload' => $this->payload,
                'result' => $result,
            ]);

            // Lanzar excepción para que Laravel lo reintente
            throw new \Exception('Failed to send accounting entry: ' . ($result['error'] ?? 'Unknown'));
        }

        Log::info('Job de asiento contable completado exitosamente', [
            'trigger_type' => $this->payload['trigger_type'] ?? 'UNKNOWN',
            'credit_id' => $this->payload['credit_id'] ?? null,
        ]);
    }

    public function failed(\Throwable $exception): void
    {
        Log::critical('Job de asiento contable FALLÓ PERMANENTEMENTE', [
            'payload' => $this->payload,
            'error' => $exception->getMessage(),
        ]);
    }
}
```

**Modificar el trait para usar la cola:**

```php
protected function triggerAccountingFormalizacion(...)
{
    $payload = [...];

    // Despachar a la cola en lugar de envío sincrónico
    SendAccountingEntry::dispatch($payload)->onQueue('accounting');
}
```

---

## 📦 Payloads de Ejemplo

### 1. Formalización

```json
{
  "trigger_type": "FORMALIZACION",
  "credit_id": 123,
  "reference": "26-00123-01-CRED",
  "amount": 1000000.00,
  "accounting_entry": {
    "debit": {
      "account_code": "CUENTAS_POR_COBRAR",
      "account_name": "Cuentas por Cobrar",
      "amount": 1000000.00
    },
    "credit": {
      "account_code": "BANCO_CREDIPEPE",
      "account_name": "Banco CREDIPEPE",
      "amount": 1000000.00
    }
  },
  "additional_data": {
    "lead_id": 456,
    "lead_cedula": "1-0234-0567",
    "lead_nombre": "Juan Pérez Mora",
    "tasa_id": 2,
    "plazo": 24,
    "formalized_at": "2026-02-12T10:30:00Z"
  },
  "timestamp": "2026-02-12T10:30:00Z",
  "source_system": "CREDIPEPE"
}
```

### 2. Pago de Cuota

```json
{
  "trigger_type": "PAGO",
  "credit_id": 123,
  "payment_id": 789,
  "amount": 150000.00,
  "source": "Ventanilla",
  "accounting_entry": {
    "debit": {
      "account_code": "BANCO_CREDIPEPE",
      "account_name": "Banco CREDIPEPE",
      "amount": 150000.00
    },
    "credit": {
      "account_code": "CUENTAS_POR_COBRAR",
      "account_name": "Cuentas por Cobrar",
      "amount": 150000.00
    }
  },
  "breakdown": {
    "mora": 5000.00,
    "interes_vencido": 10000.00,
    "interes_corriente": 35000.00,
    "poliza": 2000.00,
    "capital": 98000.00,
    "cedula": "1-0234-0567",
    "credit_reference": "26-00123-01-CRED",
    "lead_nombre": "Juan Pérez Mora"
  },
  "timestamp": "2026-02-12T14:15:00Z",
  "source_system": "CREDIPEPE"
}
```

### 3. Refundición (Cierre)

```json
{
  "trigger_type": "REFUNDICION_CIERRE",
  "old_credit_id": 100,
  "new_credit_id": 150,
  "balance_absorbed": 500000.00,
  "accounting_entry": {
    "debit": {
      "account_code": "BANCO_CREDIPEPE",
      "account_name": "Banco CREDIPEPE",
      "amount": 500000.00
    },
    "credit": {
      "account_code": "CUENTAS_POR_COBRAR",
      "account_name": "Cuentas por Cobrar",
      "amount": 500000.00
    }
  },
  "timestamp": "2026-02-12T16:00:00Z",
  "source_system": "CREDIPEPE"
}
```

### 4. Refundición (Nuevo)

```json
{
  "trigger_type": "REFUNDICION_NUEVO",
  "new_credit_id": 150,
  "old_credit_id": 100,
  "total_amount": 1200000.00,
  "cash_delivered": 700000.00,
  "accounting_entry": {
    "debit": {
      "account_code": "CUENTAS_POR_COBRAR",
      "account_name": "Cuentas por Cobrar",
      "amount": 1200000.00
    },
    "credit": {
      "account_code": "BANCO_CREDIPEPE",
      "account_name": "Banco CREDIPEPE",
      "amount": 1200000.00
    }
  },
  "timestamp": "2026-02-12T16:00:01Z",
  "source_system": "CREDIPEPE"
}
```

### 5. Anulación de Pago

```json
{
  "trigger_type": "DEVOLUCION",
  "credit_id": 123,
  "payment_id": 789,
  "amount": 150000.00,
  "reason": "Anulación de planilla: Error en archivo de deductora",
  "accounting_entry": {
    "debit": {
      "account_code": "CUENTAS_POR_COBRAR",
      "account_name": "Cuentas por Cobrar",
      "amount": 150000.00
    },
    "credit": {
      "account_code": "BANCO_CREDIPEPE",
      "account_name": "Banco CREDIPEPE",
      "amount": 150000.00
    }
  },
  "additional_data": {
    "planilla_id": 45,
    "deductora_id": 2,
    "fecha_planilla": "2026-02-01",
    "amortizacion_revertida": 98000.00,
    "interes_revertido": 35000.00,
    "mora_revertida": 5000.00,
    "cedula": "1-0234-0567",
    "credit_reference": "26-00123-01-CRED"
  },
  "timestamp": "2026-02-12T18:00:00Z",
  "source_system": "CREDIPEPE"
}
```

---

## 🧪 Testing y Validación

### Test 1: Verificar que los triggers se disparan

**Archivo:** `backend/tests/Feature/AccountingTriggersTest.php`

```php
<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\Credit;
use App\Models\Lead;
use Illuminate\Support\Facades\Log;

class AccountingTriggersTest extends TestCase
{
    public function test_formalizacion_trigger_fires()
    {
        Log::shouldReceive('info')
            ->once()
            ->with('ACCOUNTING_API_TRIGGER: Formalización de Crédito', \Mockery::any());

        $credit = Credit::factory()->create(['status' => 'Pendiente']);

        $response = $this->putJson("/api/credits/{$credit->id}", [
            'status' => 'Formalizado',
        ]);

        $response->assertOk();
    }

    public function test_pago_trigger_fires()
    {
        Log::shouldReceive('info')
            ->once()
            ->with('ACCOUNTING_API_TRIGGER: Pago de Crédito', \Mockery::any());

        $credit = Credit::factory()->create(['status' => 'Formalizado']);

        $response = $this->postJson('/api/credit-payments', [
            'credit_id' => $credit->id,
            'monto' => 100000,
            'fecha' => now()->format('Y-m-d'),
        ]);

        $response->assertCreated();
    }
}
```

### Test 2: Verificar integración con API

```php
public function test_accounting_api_integration()
{
    Http::fake([
        config('services.accounting.url') . '/api/asientos' => Http::response([
            'success' => true,
            'asiento_id' => 'ASIENTO-12345',
            'message' => 'Asiento creado exitosamente'
        ], 200),
    ]);

    $credit = Credit::factory()->create(['status' => 'Pendiente']);

    $response = $this->putJson("/api/credits/{$credit->id}", [
        'status' => 'Formalizado',
    ]);

    $response->assertOk();

    Http::assertSent(function ($request) {
        return $request->url() === config('services.accounting.url') . '/api/asientos' &&
               $request['trigger_type'] === 'FORMALIZACION';
    });
}
```

### Test 3: Verificar manejo de errores

```php
public function test_accounting_api_retry_on_failure()
{
    Http::fake([
        config('services.accounting.url') . '/api/asientos' => Http::sequence()
            ->push(['error' => 'Timeout'], 500)
            ->push(['error' => 'Server busy'], 503)
            ->push(['success' => true, 'asiento_id' => 'ASIENTO-12345'], 200),
    ]);

    $credit = Credit::factory()->create(['status' => 'Pendiente']);

    $response = $this->putJson("/api/credits/{$credit->id}", [
        'status' => 'Formalizado',
    ]);

    $response->assertOk();

    // Verificar que se intentó 3 veces
    Http::assertSentCount(3);
}
```

---

## 🔍 Troubleshooting

### Problema 1: Los triggers no se disparan

**Síntomas:**
- No hay registros en el log
- No se ven llamadas a la API

**Solución:**
```bash
# Verificar que el trait está incluido
grep -r "use AccountingTrigger" backend/app/Http/Controllers/Api/

# Verificar sintaxis PHP
cd backend && php artisan tinker
>>> app(App\Traits\AccountingTrigger::class);

# Ver logs en tiempo real
tail -f backend/storage/logs/laravel.log | grep "ACCOUNTING"
```

### Problema 2: API externa retorna errores

**Síntomas:**
- Status code 400, 401, 422

**Solución:**
```bash
# Verificar credenciales
php artisan tinker
>>> config('services.accounting')

# Probar health check
$service = app(\App\Services\AccountingApiService::class);
$service->healthCheck();

# Ver payload exacto que se envía
Log::info('Payload enviado', ['payload' => $payload]);
```

### Problema 3: Timeouts o latencia

**Síntomas:**
- Las operaciones tardan mucho
- Timeouts frecuentes

**Solución:**
```bash
# Aumentar timeout en .env
ACCOUNTING_API_TIMEOUT=60

# Usar colas para operaciones asíncronas
php artisan queue:work --queue=accounting

# Monitorear tiempos de respuesta
Log::info('API response time', ['duration' => $response->handlerStats()['total_time']]);
```

### Problema 4: Asientos duplicados

**Síntomas:**
- Se crean múltiples asientos para una misma operación

**Solución:**

Agregar campo `idempotency_key` al payload:

```php
$payload = [
    'idempotency_key' => 'CRED-' . $creditId . '-' . $trigger_type . '-' . time(),
    // ... resto del payload
];
```

La API externa debe usar este key para evitar duplicados.

---

## ✅ Checklist de Implementación

### Fase 1: Preparación (YA COMPLETADA ✅)

- [x] Crear trait `AccountingTrigger`
- [x] Agregar trait a controladores
- [x] Colocar triggers en todos los puntos de operación
- [x] Verificar que los logs se generan correctamente
- [x] Documentar todos los marcadores

### Fase 2: Integración con API Externa (PENDIENTE)

- [ ] Obtener credenciales de la API de contabilidad
- [ ] Documentación de la API externa (endpoints, autenticación, formato)
- [ ] Configurar credenciales en `.env`
- [ ] Crear `AccountingApiService`
- [ ] Modificar métodos del trait para llamar al servicio
- [ ] Probar conexión con API (health check)
- [ ] Enviar asiento de prueba manualmente
- [ ] Verificar que el asiento se crea en el sistema contable
- [ ] Ajustar estructura de payloads según requerimientos de la API
- [ ] Implementar manejo de errores y reintentos
- [ ] (Opcional) Implementar cola de trabajos
- [ ] Crear tests de integración
- [ ] Probar en ambiente de staging
- [ ] Monitorear logs durante período de prueba
- [ ] Validar asientos creados vs operaciones en CREDIPEPE
- [ ] Deplegar a producción
- [ ] Monitoreo continuo

### Fase 3: Optimización (FUTURO)

- [ ] Implementar caché de respuestas para evitar duplicados
- [ ] Crear dashboard de monitoreo de asientos
- [ ] Implementar notificaciones de asientos fallidos
- [ ] Crear proceso de reconciliación automático
- [ ] Optimizar performance (batching, async)

---

## 📞 Notas Importantes

### Decisiones de Diseño

1. **No bloquear operaciones principales:** Si la API de contabilidad falla, la operación en CREDIPEPE debe completarse de todas formas. El asiento fallido se loggea para acción manual.

2. **Idempotencia:** Todos los payloads deben incluir un `idempotency_key` único para evitar asientos duplicados en caso de reintentos.

3. **Orden de operaciones:** Los triggers se disparan DESPUÉS de confirmar la operación en la BD local, nunca antes.

4. **Transacciones:** Los triggers NO están dentro de transacciones DB. Si un trigger falla, NO se revierte la operación en CREDIPEPE.

5. **Logging crítico:** Todos los fallos se loggean con nivel `CRITICAL` para fácil identificación.

### Códigos de Cuenta (Ajustar según sistema contable)

- `BANCO_CREDIPEPE` → Cuenta bancaria principal
- `CUENTAS_POR_COBRAR` → Cuentas por cobrar de clientes

**IMPORTANTE:** Estos códigos deben coincidir con el plan de cuentas del sistema contable externo.

---

## 📄 Archivos de Referencia Rápida

### Archivos creados/modificados:

1. `backend/app/Traits/AccountingTrigger.php` - Trait principal (CREADO)
2. `backend/app/Http/Controllers/Api/CreditController.php` - +trait, +3 triggers (MODIFICADO)
3. `backend/app/Http/Controllers/Api/CreditPaymentController.php` - +trait, +2 triggers (MODIFICADO)
4. `backend/app/Http/Controllers/Api/SaldoPendienteController.php` - +trait, +1 trigger (MODIFICADO)
5. `backend/app/Http/Controllers/Api/PlanillaUploadController.php` - +trait, +1 trigger (MODIFICADO)
6. `MARCADORES_CONTABLES.md` - Documentación de usuario (CREADO)
7. `IMPLEMENTACION_ASIENTOS_CONTABLES.md` - Este documento técnico (CREADO)

### Comandos útiles:

```bash
# Ver todos los triggers
grep -rn "triggerAccounting" backend/app/Http/Controllers/Api/

# Ver logs de asientos
tail -f backend/storage/logs/laravel.log | grep "ACCOUNTING_API_TRIGGER"

# Buscar asientos por tipo
grep "FORMALIZACION" backend/storage/logs/laravel.log
grep "PAGO" backend/storage/logs/laravel.log
grep "DEVOLUCION" backend/storage/logs/laravel.log

# Verificar sintaxis PHP
cd backend && find app/Http/Controllers/Api -name "*.php" -exec php -l {} \;
```

---

**FIN DEL DOCUMENTO**

Guarda este documento y úsalo como referencia completa cuando necesites implementar la integración con la API de contabilidad externa. Todos los marcadores ya están en su lugar y listos para ser activados.
