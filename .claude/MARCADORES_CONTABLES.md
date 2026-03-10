# Marcadores de Disparadores Contables

Este documento lista todos los puntos del sistema donde se han colocado marcadores para disparadores contables que eventualmente se conectarán a una API externa de contabilidad.

## 📋 Resumen de Implementación

Se ha creado un **trait helper** (`App\Traits\AccountingTrigger`) que contiene métodos placeholder para cada tipo de asiento contable. Por ahora, estos métodos solo registran en logs, pero están diseñados para ser reemplazados fácilmente por llamadas HTTP a la API externa.

---

## 🎯 Puntos de Disparador Implementados

### 1. **Formalización de Crédito**

**Ubicación:** `CreditController::update()` - Línea ~632

**Trigger:** `triggerAccountingFormalizacion()`

**Asiento Contable:**
- **DÉBITO:** Cuentas por Cobrar (monto del crédito)
- **CRÉDITO:** Banco CREDIPEPE (monto del crédito)

**Cuándo se dispara:**
- Cuando el status de un crédito cambia a "Formalizado"
- Después de generar el plan de amortización

**Datos capturados:**
- ID del crédito
- Monto del crédito
- Referencia del crédito
- Datos del cliente (lead_id, cédula, nombre)
- Datos financieros (tasa_id, plazo)
- Fecha de formalización

---

### 2. **Pago de Crédito (Todos los orígenes)**

**Ubicación:** `CreditPaymentController::processPaymentTransaction()` - Línea ~975

**Trigger:** `triggerAccountingPago()`

**Asiento Contable:**
- **DÉBITO:** Banco CREDIPEPE (monto del pago)
- **CRÉDITO:** Cuentas por Cobrar (monto del pago)

**Cuándo se dispara:**
- Después de aplicar cualquier pago al crédito
- Se ejecuta desde todas las fuentes de pago:
  - Ventanilla (`CreditPaymentController::store()`)
  - Planilla (`CreditPaymentController::upload()`)
  - Adelanto/Extraordinario (`CreditPaymentController::adelanto()`)
  - Saldo Pendiente → Cuota (`SaldoPendienteController::asignar()` con acción='cuota')

**Datos capturados:**
- ID del crédito
- ID del pago registrado
- Monto del pago
- Origen del pago (Ventanilla, Planilla, Saldo Pendiente, etc.)
- Desglose completo:
  - Mora
  - Interés vencido
  - Interés corriente
  - Póliza
  - Capital (amortización)
- Datos del cliente (cédula, nombre)
- Referencia del crédito

---

### 3. **Cancelación Anticipada (Pago Total)**

**Ubicación:** `CreditPaymentController::cancelacionAnticipada()` - Línea ~1340

**Trigger:** `triggerAccountingPago()` (mismo que pagos normales, pero con source diferente)

**Asiento Contable:**
- **DÉBITO:** Banco CREDIPEPE (monto total de cancelación)
- **CRÉDITO:** Cuentas por Cobrar (monto total de cancelación)

**Cuándo se dispara:**
- Cuando un cliente cancela anticipadamente todo el crédito
- Después de cerrar el crédito con status "Cerrado"

**Datos capturados:**
- Monto total (capital + intereses vencidos + penalización)
- Desglose de capital, intereses vencidos y penalización
- Cuota actual en la que se cancela
- Si aplicó penalización (< 12 cuotas)

---

### 4. **Abono a Capital (desde Saldo Pendiente)**

**Ubicación:** `SaldoPendienteController::asignar()` - Línea ~284

**Trigger:** `triggerAccountingPago()`

**Asiento Contable:**
- **DÉBITO:** Banco CREDIPEPE (monto aplicado)
- **CRÉDITO:** Cuentas por Cobrar (monto aplicado)

**Cuándo se dispara:**
- Cuando un saldo pendiente (exceso de planilla) se aplica directamente a capital
- Reduce el saldo del crédito sin afectar cuotas específicas

**Datos capturados:**
- Monto aplicado al capital
- Saldo anterior y nuevo saldo del crédito
- Origen: "Saldo Pendiente" → "Abono a Capital"

**Nota:** Cuando el saldo pendiente se aplica a cuota (acción='cuota'), el trigger se dispara automáticamente en `processPaymentTransaction()` y no requiere trigger adicional.

---

### 5. **Refundición - Doble Asiento**

#### 5.1 Cierre del Crédito Viejo

**Ubicación:** `CreditController::refundicion()` - Línea ~1048

**Trigger:** `triggerAccountingRefundicionCierre()`

**Asiento Contable:**
- **DÉBITO:** Banco CREDIPEPE (saldo absorbido)
- **CRÉDITO:** Cuentas por Cobrar (saldo absorbido)

**Cuándo se dispara:**
- Cuando se cierra el crédito antiguo en una refundición
- Después de crear el pago sintético de absorción

**Datos capturados:**
- ID del crédito viejo (cerrado)
- Saldo absorbido del crédito viejo
- ID del nuevo crédito creado

#### 5.2 Formalización del Nuevo Crédito

**Ubicación:** `CreditController::refundicion()` - Línea ~1056

**Trigger:** `triggerAccountingRefundicionNuevo()`

**Asiento Contable:**
- **DÉBITO:** Cuentas por Cobrar (monto del nuevo crédito)
- **CRÉDITO:** Banco CREDIPEPE (monto del nuevo crédito)

**Cuándo se dispara:**
- Inmediatamente después del cierre del crédito viejo
- Después de generar el plan de amortización del nuevo crédito

**Datos capturados:**
- ID del nuevo crédito
- Monto total del nuevo crédito
- ID del crédito viejo refundido
- Monto entregado en efectivo al cliente (diferencia)

---

### 6. **Devolución/Anulación de Pago (Reversa de Planilla)**

**Ubicación:** `PlanillaUploadController::anular()` - Línea ~147

**Trigger:** `triggerAccountingDevolucion()`

**Asiento Contable (Reversa):**
- **DÉBITO:** Cuentas por Cobrar (monto revertido)
- **CRÉDITO:** Banco CREDIPEPE (monto revertido)

**Cuándo se dispara:**
- Cuando un administrador anula una planilla completa
- Se dispara para cada pago individual de la planilla
- Después de revertir los movimientos en `plan_de_pagos`

**Datos capturados:**
- ID del crédito afectado
- ID del pago revertido
- Monto del pago revertido
- Motivo de la anulación
- Desglose de lo revertido:
  - Amortización revertida
  - Interés revertido
  - Mora revertida
- Datos de la planilla (ID, deductora, fecha)

---

## 🔧 Implementación Técnica

### Trait: `App\Traits\AccountingTrigger`

```php
namespace App\Traits;

trait AccountingTrigger
{
    protected function triggerAccountingFormalizacion($creditId, $amount, $reference, $additionalData)
    protected function triggerAccountingPago($creditId, $paymentId, $amount, $source, $breakdown)
    protected function triggerAccountingDevolucion($creditId, $paymentId, $amount, $reason, $additionalData)
    protected function triggerAccountingRefundicionCierre($oldCreditId, $balanceAbsorbed, $newCreditId)
    protected function triggerAccountingRefundicionNuevo($newCreditId, $amount, $oldCreditId, $cashDelivered)
}
```

### Controladores que usan el trait:

1. ✅ `CreditController` - Formalización y Refundición
2. ✅ `CreditPaymentController` - Todos los pagos
3. ✅ `SaldoPendienteController` - Abonos a capital
4. ✅ `PlanillaUploadController` - Anulaciones/Reversas

---

## 📝 Logs Actuales

Por ahora, todos los triggers escriben en el log de Laravel con el formato:

```json
{
  "trigger_type": "FORMALIZACION|PAGO|DEVOLUCION|REFUNDICION_CIERRE|REFUNDICION_NUEVO",
  "credit_id": 123,
  "amount": 1000000.00,
  "accounting_entry": {
    "debit": {"account": "Cuentas por Cobrar", "amount": 1000000.00},
    "credit": {"account": "Banco CREDIPEPE", "amount": 1000000.00}
  },
  "additional_data": {...},
  "timestamp": "2026-02-12T10:30:00Z"
}
```

Puedes buscar en los logs con: `grep "ACCOUNTING_API_TRIGGER" storage/logs/laravel.log`

---

## 🚀 Próximos Pasos

Para conectar estos marcadores a la API externa de contabilidad:

1. **Configurar credenciales de la API externa** en `.env`:
   ```
   ACCOUNTING_API_URL=https://api-contabilidad.ejemplo.com
   ACCOUNTING_API_KEY=tu-api-key-aqui
   ```

2. **Reemplazar los métodos del trait** con llamadas HTTP:
   ```php
   protected function triggerAccountingFormalizacion(...)
   {
       Http::withHeaders([
           'Authorization' => 'Bearer ' . config('services.accounting.api_key')
       ])->post(config('services.accounting.url') . '/asientos', [
           'tipo' => 'FORMALIZACION',
           'credito_id' => $creditId,
           'monto' => $amount,
           'debito' => ['cuenta' => 'CUENTAS_POR_COBRAR', 'monto' => $amount],
           'credito' => ['cuenta' => 'BANCO_CREDIPEPE', 'monto' => $amount],
           // ...
       ]);
   }
   ```

3. **Agregar manejo de errores y reintentos** para asegurar que los asientos se registren correctamente.

4. **Agregar cola de trabajos (Queue)** para que los disparadores no bloqueen las operaciones principales:
   ```php
   dispatch(new TriggerAccountingEntry($data))->onQueue('accounting');
   ```

---

## ✅ Verificación de Cobertura

| Operación | Marcador | Ubicación | Estado |
|-----------|----------|-----------|--------|
| Formalización de Crédito | ✅ | CreditController::update() | Implementado |
| Pago Ventanilla | ✅ | CreditPaymentController::store() → processPaymentTransaction() | Implementado |
| Pago Planilla | ✅ | CreditPaymentController::upload() → processPaymentTransaction() | Implementado |
| Pago Extraordinario | ✅ | CreditPaymentController::adelanto() → processPaymentTransaction() | Implementado |
| Aplicar Saldo Pendiente (cuota) | ✅ | SaldoPendienteController::asignar() → processPaymentTransactionPublic() | Implementado |
| Aplicar Saldo Pendiente (capital) | ✅ | SaldoPendienteController::asignar() | Implementado |
| Cancelación Anticipada | ✅ | CreditPaymentController::cancelacionAnticipada() | Implementado |
| Refundición (cierre viejo) | ✅ | CreditController::refundicion() | Implementado |
| Refundición (nuevo crédito) | ✅ | CreditController::refundicion() | Implementado |
| Anulación de Planilla | ✅ | PlanillaUploadController::anular() | Implementado |

---

## 🔍 Búsqueda Rápida

Para encontrar todos los marcadores en el código:

```bash
# Buscar en archivos PHP
grep -r "ACCOUNTING_API_TRIGGER" backend/app/Http/Controllers/Api/

# Buscar el trait
grep -r "use AccountingTrigger" backend/app/Http/Controllers/Api/

# Ver logs de triggers
tail -f storage/logs/laravel.log | grep "ACCOUNTING_API_TRIGGER"
```

---

## 📞 Contacto

Si tienes preguntas sobre los marcadores contables o necesitas agregar nuevos puntos de disparo, contacta al equipo de desarrollo.

**Última actualización:** 2026-02-12
**Versión del sistema:** Laravel 12 + Next.js
