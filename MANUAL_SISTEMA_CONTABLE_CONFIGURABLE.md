# Manual de Configuración del Sistema Contable Configurable

## ¿Qué son las Banderas de Funcionalidad?

Las **banderas de funcionalidad** (feature flags) son interruptores que te permiten activar o desactivar funcionalidades del sistema **sin necesidad de cambiar código ni hacer deploy**. Solo modificas una variable de entorno en el archivo `.env`.

### ¿Por qué las usamos aquí?

El sistema contable tiene dos "versiones":
- **Legacy (viejo)**: Código hardcodeado que funciona actualmente
- **Configurable (nuevo)**: Sistema flexible que se configura desde la UI

Las banderas te permiten **migrar gradualmente** sin riesgo:
1. Probar el nuevo sistema en un tipo de asiento primero
2. Si funciona bien, activar más tipos
3. Si algo falla, desactivar inmediatamente sin tocar código

---

## Tipos de Control Disponibles

### 1. Control Global (todo o nada)
```bash
ACCOUNTING_USE_CONFIGURABLE=true
```
- Activa el sistema configurable para **TODOS** los tipos de asiento
- Recomendado SOLO cuando ya probaste todo individualmente
- Si está en `false`, todo usa el sistema legacy

### 2. Control Individual (migración gradual) — RECOMENDADO
```bash
ACCOUNTING_CONFIGURABLE_VENTANILLA=true
ACCOUNTING_CONFIGURABLE_PLANILLA=false
ACCOUNTING_CONFIGURABLE_FORMALIZACION=false
# ... etc
```
- Activa el sistema configurable solo para los tipos específicos que configures
- El resto sigue usando legacy
- Ideal para migración segura paso a paso

---

## Variables Disponibles en .env

```bash
# ============================================================
# CONTROL GLOBAL (no recomendado usar solo)
# ============================================================
ACCOUNTING_USE_CONFIGURABLE=false

# ============================================================
# CONTROL INDIVIDUAL POR TIPO DE ASIENTO
# ============================================================

# Formalización de créditos (cuando se aprueba un crédito)
ACCOUNTING_CONFIGURABLE_FORMALIZACION=false

# Pagos de planilla (deducciones de nómina)
ACCOUNTING_CONFIGURABLE_PLANILLA=false

# Pagos de ventanilla (pagos directos en oficina)
ACCOUNTING_CONFIGURABLE_VENTANILLA=false

# Abonos extraordinarios (pagos fuera de cuota)
ACCOUNTING_CONFIGURABLE_EXTRAORDINARIO=false

# Cancelación anticipada (cuando cliente paga todo antes)
ACCOUNTING_CONFIGURABLE_CANCELACION=false

# Refundición - Cierre del crédito viejo
ACCOUNTING_CONFIGURABLE_REFUND_CIERRE=false

# Refundición - Apertura del crédito nuevo
ACCOUNTING_CONFIGURABLE_REFUND_NUEVO=false

# Devoluciones (distinto a anulación de planilla)
ACCOUNTING_CONFIGURABLE_DEVOLUCION=false

# Anulación de abono individual
ACCOUNTING_CONFIGURABLE_ANULACION_ABONO=false

# Anulación de planilla completa
ACCOUNTING_CONFIGURABLE_ANULACION_PLANILLA=false

# Saldo sobrante de planilla (se dispara automáticamente cuando
# queda dinero sobrante tras pagar todos los créditos de una planilla)
ACCOUNTING_CONFIGURABLE_SALDO_SOBRANTE=false

# Reintegro de saldo pendiente (botón "Reintegro de Saldo" en módulo de saldos)
ACCOUNTING_CONFIGURABLE_REINTEGRO_SALDO=false

# Anulación de sobrante (se dispara automáticamente al anular una planilla que tenía sobrante)
# Es el espejo inverso de SALDO_SOBRANTE
ACCOUNTING_CONFIGURABLE_ANULACION_SOBRANTE=false

# Reverso de abono extraordinario (anulación de abono a capital con penalización)
ACCOUNTING_CONFIGURABLE_REVERSO_EXTRAORDINARIO=false
```

---

## Estrategia de Migración Recomendada

### Fase 1: Preparación

#### Paso 1.1: Configurar Cuentas Contables
1. Ir a `/dashboard/configuracion` → pestaña **Contabilidad ERP**
2. Asignar el código de cuenta ERP a cada cuenta:
   - `banco_credipep` → código ERP del banco principal
   - `cuentas_por_cobrar` → código ERP de CxC
3. Para cuentas de sobrantes (si aplica), agregar desde "+ Agregar cuenta":
   - Crear cuentas necesarias (ej: `retenciones_por_aplicar`, `desembolsos_saldos_favor`)

#### Paso 1.2: Crear Configuración de Asiento de Prueba
1. En la sección **Asientos Configurables**
2. Crear configuración para `PAGO_VENTANILLA`:
   ```
   Nombre: Pago de Ventanilla
   Tipo: PAGO_VENTANILLA
   Activo: ✓

   Línea 1:
   - Tipo de Cuenta: Fija
   - Cuenta: banco_credipep
   - Movimiento: Débito
   - Componente: Monto Total

   Línea 2:
   - Tipo de Cuenta: Fija
   - Cuenta: cuentas_por_cobrar
   - Movimiento: Crédito
   - Componente: Monto Total
   ```

#### Paso 1.3: Probar con Preview
1. Hacer clic en **Vista Previa**
2. Ingresar un monto de prueba
3. Verificar que suma de débitos = suma de créditos

---

### Fase 2: Prueba en Desarrollo

#### Activar Solo Ventanilla
```bash
ACCOUNTING_USE_CONFIGURABLE=false
ACCOUNTING_CONFIGURABLE_VENTANILLA=true
```
```bash
php artisan config:cache
```

#### Si Hay Problemas
```bash
ACCOUNTING_CONFIGURABLE_VENTANILLA=false
php artisan config:cache
```

---

### Fase 3: Producción Gradual

**Semana 1** — Solo Ventanilla:
```bash
ACCOUNTING_CONFIGURABLE_VENTANILLA=true
```

**Semana 2** — Agregar Planilla:
```bash
ACCOUNTING_CONFIGURABLE_VENTANILLA=true
ACCOUNTING_CONFIGURABLE_PLANILLA=true
```

**Semana 3** — Agregar más tipos:
```bash
ACCOUNTING_CONFIGURABLE_FORMALIZACION=true
ACCOUNTING_CONFIGURABLE_EXTRAORDINARIO=true
```

**Semana 4** — Completar migración:
```bash
ACCOUNTING_USE_CONFIGURABLE=true
```

---

## Tipos de Asientos y Sus Configuraciones Típicas

### FORMALIZACION
**Cuándo se dispara**: Al aprobar y formalizar un crédito
| Línea | Cuenta | Movimiento | Componente |
|-------|--------|------------|------------|
| 1 | cuentas_por_cobrar | Débito | Total |
| 2 | banco_credipep | Crédito | Total |

---

### PAGO_VENTANILLA
**Cuándo se dispara**: Pago directo en oficina

**Variable .env**: `ACCOUNTING_CONFIGURABLE_VENTANILLA=true`

**Estado**: Configuración creada en UI (03/03/2026), flag pendiente de activar

| Línea | Cuenta | Movimiento | Componente |
|-------|--------|------------|------------|
| 1 | banco_credipep | Débito | Total |
| 2 | cuentas_por_cobrar | Crédito | Total |

> Si el pago genera sobrante (monto pagado > cuota), se dispara automáticamente el asiento `SALDO_SOBRANTE`.

---

### REVERSO_PAGO (Anulación de Abono)
**Cuándo se dispara**: Al revertir/anular un pago de ventanilla

**Variable .env**: `ACCOUNTING_CONFIGURABLE_ANULACION_ABONO=true`

**Estado**: Configuración creada en UI (03/03/2026), flag pendiente de activar

| Línea | Cuenta | Movimiento | Componente |
|-------|--------|------------|------------|
| 1 | cuentas_por_cobrar | Débito | Total |
| 2 | banco_credipep | Crédito | Total |

> Es el espejo inverso de `PAGO_VENTANILLA`. Si el pago original tenía sobrante, se dispara automáticamente el asiento `ANULACION_SOBRANTE`.

---

### PAGO_PLANILLA
**Cuándo se dispara**: Deducción de nómina procesada
| Línea | Cuenta | Movimiento | Componente |
|-------|--------|------------|------------|
| 1 | Cuenta Deductora | Débito | Total |
| 2 | cuentas_por_cobrar (capital) | Crédito | Capital |
| 3 | ingresos_intereses | Crédito | Interés Corriente |
| 4 | ingresos_mora | Crédito | Interés Moratorio |
| 5 | ingresos_seguros | Crédito | Póliza |
| 6 | retenciones_por_aplicar | Crédito | **Sobrante** |

> Nota: La línea de sobrante solo aplica si hubo sobrante. Si el monto del componente es 0, la línea se omite automáticamente.

---

### SALDO_SOBRANTE
**Cuándo se dispara**: Automáticamente después de PAGO_PLANILLA o PAGO_VENTANILLA cuando queda dinero sobrante tras pagar todos los créditos del cliente

**Variable .env**: `ACCOUNTING_CONFIGURABLE_SALDO_SOBRANTE=true`

| Línea | Cuenta | Movimiento | Componente |
|-------|--------|------------|------------|
| 1 | retenciones_por_aplicar | Débito | Sobrante |
| 2 | desembolsos_saldos_favor | Crédito | Sobrante |

> Este es el **2do asiento automático** del flujo de sobrantes. Se dispara solo si hay un sobrante mayor a ₡0.50 y si existe una configuración activa de tipo `SALDO_SOBRANTE`. Aplica tanto para pagos de planilla (desde `PlanillaUploadController`) como para pagos de ventanilla/manuales (desde `CreditPaymentController`).

---

### ABONO_EXTRAORDINARIO
**Cuándo se dispara**: Abono a capital (pago fuera de cuota regular)

**Variable .env**: `ACCOUNTING_CONFIGURABLE_EXTRAORDINARIO=true`

**Penalización**: Si el crédito tiene menos de 12 cuotas pagadas, se cobra una penalización igual a la suma del interés corriente de las próximas 3 cuotas. La penalización se resta del monto aplicado al saldo: `capital = montoAbono - penalizacion`.

| Línea | Tipo Cuenta | Cuenta | Movimiento | Componente |
|-------|-------------|--------|------------|------------|
| 1 | Deductora o Fija (auto) | banco_credipepe (fallback) | Débito | Total |
| 2 | Fija | cuenta_por_cobrar_pepito_plazo | Crédito | Capital |
| 3 | Fija | ingresos_por_penalizacion | Crédito | Penalización |

> La línea de penalización se omite automáticamente si no hay penalización (≥12 cuotas pagadas). El tipo de cuenta "Deductora o Fija" usa la cuenta de la deductora si el crédito tiene una, o la cuenta fija de fallback si no.

---

### REVERSO_EXTRAORDINARIO
**Cuándo se dispara**: Al revertir/anular un abono extraordinario

**Variable .env**: `ACCOUNTING_CONFIGURABLE_REVERSO_EXTRAORDINARIO=true`

| Línea | Tipo Cuenta | Cuenta | Movimiento | Componente |
|-------|-------------|--------|------------|------------|
| 1 | Deductora o Fija (auto) | banco_credipepe (fallback) | Crédito | Total |
| 2 | Fija | cuenta_por_cobrar_pepito_plazo | Débito | Capital |
| 3 | Fija | ingresos_por_penalizacion | Débito | Penalización |

> Es el espejo inverso de `ABONO_EXTRAORDINARIO`.

---

### CANCELACION_ANTICIPADA
**Cuándo se dispara**: Cliente paga todo el crédito antes del plazo

**Variable .env**: `ACCOUNTING_CONFIGURABLE_CANCELACION=true`

**Penalización**: Si el crédito tiene menos de 12 cuotas pagadas, se cobra `cuotaMensual × 3` como penalización.

| Línea | Tipo Cuenta | Cuenta | Movimiento | Componente |
|-------|-------------|--------|------------|------------|
| 1 | Deductora o Fija (auto) | banco_credipepe (fallback) | Débito | Total |
| 2 | Fija | cuenta_por_cobrar_pepito_plazo | Crédito | Capital |
| 3 | Fija | ingreso_interes_corriente | Crédito | Interés Corriente |
| 4 | Fija | ingresos_por_penalizacion | Crédito | Penalización |

> `total = capital + interes_corriente + penalizacion`. Las líneas de interés corriente (intereses vencidos de cuotas en mora) y penalización se omiten si son 0.

---

### REFUNDICION_CIERRE
**Cuándo se dispara**: Al cerrar crédito viejo en refundición
| Línea | Cuenta | Movimiento | Componente |
|-------|--------|------------|------------|
| 1 | banco_credipep | Débito | Total |
| 2 | cuentas_por_cobrar | Crédito | Total |

---

### REFUNDICION_NUEVO
**Cuándo se dispara**: Al abrir crédito nuevo en refundición
| Línea | Cuenta | Movimiento | Componente |
|-------|--------|------------|------------|
| 1 | cuentas_por_cobrar | Débito | Total |
| 2 | banco_credipep | Crédito | Total |

---

### DEVOLUCION / ANULACION_PLANILLA
**Cuándo se dispara**: Al revertir un pago o anular planilla
| Línea | Cuenta | Movimiento | Componente |
|-------|--------|------------|------------|
| 1 | cuentas_por_cobrar | Débito | Total |
| 2 | banco_credipep | Crédito | Total |
| 3 | retenciones_por_aplicar | Débito | **Sobrante** *(solo si había sobrante)* |

> Si el pago anulado tenía sobrante, se incluye automáticamente la línea 3 para revertir la retención. Además se dispara el segundo asiento `ANULACION_SOBRANTE`. Esto aplica tanto para anulación de planilla como para reversión de pagos de ventanilla.

---

### ANULACION_SOBRANTE
**Cuándo se dispara**: Automáticamente al anular/revertir un pago (planilla o ventanilla) que tenía sobrante retenido. Es el espejo inverso de `SALDO_SOBRANTE`.

**Variable .env**: `ACCOUNTING_CONFIGURABLE_ANULACION_SOBRANTE=true`

| Línea | Cuenta | Movimiento | Componente |
|-------|--------|------------|------------|
| 1 | desembolsos_saldos_favor | Débito | Sobrante |
| 2 | retenciones_por_aplicar | Crédito | Sobrante |

> Solo se dispara si el sobrante asociado al pago es > 0.50. Aplica tanto para anulación de planilla (desde `PlanillaUploadController`) como para reversión de pagos de ventanilla/manuales (desde `CreditPaymentController::reverseNormalPayment()`).

---

### ABONO_CAPITAL
**Cuándo se dispara**: Al aplicar saldo pendiente a capital del crédito
| Línea | Cuenta | Movimiento | Componente |
|-------|--------|------------|------------|
| 1 | banco_credipep | Débito | Total |
| 2 | cuentas_por_cobrar | Crédito | Total |

---

### REINTEGRO_SALDO
**Cuándo se dispara**: Al devolver saldo pendiente no aplicado
| Línea | Cuenta | Movimiento | Componente |
|-------|--------|------------|------------|
| 1 | cuentas_por_cobrar | Débito | Total |
| 2 | banco_credipep | Crédito | Total |

---

## Componentes de Monto Disponibles

Al configurar una línea de asiento, el campo **"Componente del Monto"** indica qué parte del pago aplica a esa línea:

| Valor | Descripción |
|-------|-------------|
| `total` | Monto total del pago |
| `capital` | Solo la amortización de capital |
| `interes_corriente` | Solo intereses corrientes |
| `interes_moratorio` | Solo intereses por mora |
| `poliza` | Solo el componente de póliza/seguro |
| `sobrante` | El monto sobrante (exceso no aplicado a ningún crédito) |
| `penalizacion` | Penalización por abono anticipado (< 12 cuotas pagadas) |
| `cargo_adicional` | Un cargo adicional específico (requiere seleccionar cuál) |

> Si el componente es 0 en un pago específico, esa línea se omite automáticamente del asiento.

---

## Monitoreo y Verificación

```bash
# Ver logs de contabilidad en tiempo real
tail -f storage/logs/laravel.log | grep ACCOUNTING

# Ver configuración actual
php artisan config:show accounting

# Limpiar y recargar configuración
php artisan config:clear && php artisan config:cache
```

### Señales en los logs:

| Mensaje | Significado |
|---------|-------------|
| `Usando sistema configurable` | OK — Encontró configuración y la usó |
| `No hay configuración activa` | Usando legacy como fallback |
| `Sobrante detectado en PAGO_PLANILLA, disparando SALDO_SOBRANTE` | Se detectó sobrante y se intentará el 2do asiento |
| `Fallo al registrar SALDO_SOBRANTE` | El 2do asiento falló (revisar config) |

---

## Plan de Rollback

### Rollback inmediato (< 1 minuto)
```bash
ACCOUNTING_USE_CONFIGURABLE=false
php artisan config:cache
```

### Rollback parcial (solo un tipo)
```bash
ACCOUNTING_CONFIGURABLE_SALDO_SOBRANTE=false
php artisan config:cache
```

---

## Checklist Pre-Producción

- [ ] Cuentas contables configuradas con códigos ERP
- [ ] Configuración creada para cada tipo de asiento a activar
- [ ] Preview verificado (débitos = créditos)
- [ ] Probado en desarrollo/staging primero
- [ ] Backup de base de datos reciente
- [ ] Equipo sabe cómo hacer rollback

---

## Glosario

| Término | Descripción |
|---------|-------------|
| **Feature Flag** | Interruptor de configuración en .env |
| **Legacy** | Sistema antiguo hardcodeado |
| **Configurable** | Sistema flexible configurable desde UI |
| **Entry Type** | Tipo de asiento (PAGO_PLANILLA, SALDO_SOBRANTE, etc.) |
| **Amount Component** | Componente del monto (total, capital, sobrante, etc.) |
| **Sobrante** | Excedente de dinero que queda tras pagar todos los créditos de un cliente en planilla |
| **Retenciones por aplicar** | Cuenta transitoria donde se registra el sobrante retenido |
| **Desembolsos Saldos a Favor** | Cuenta que registra el saldo a favor del cliente |
| **Deductora o Fija (auto)** | Tipo de cuenta híbrido: usa la cuenta de la deductora si el crédito tiene una, o la cuenta fija de fallback si no |
| **Penalización** | Cargo por abono anticipado cuando el crédito tiene < 12 cuotas pagadas |

---

**Última actualización**: 2026-03-03
**Versión del manual**: 2.4
**Cambios v2.4**:
- Nuevo tipo de cuenta `deductora_or_fixed` (Deductora o Fija auto): usa cuenta de deductora si existe, o fallback a cuenta fija
- Nuevo componente de monto `penalizacion`: para penalización por abono anticipado (< 12 cuotas)
- `ABONO_EXTRAORDINARIO` actualizado: desglose con capital + penalización, soporte deductora_or_fixed
- `CANCELACION_ANTICIPADA` actualizado: desglose con capital + intereses vencidos + penalización, soporte deductora_or_fixed
- Nuevo tipo `REVERSO_EXTRAORDINARIO` con variable `ACCOUNTING_CONFIGURABLE_REVERSO_EXTRAORDINARIO`
- Secciones de ABONO_EXTRAORDINARIO, REVERSO_EXTRAORDINARIO y CANCELACION_ANTICIPADA reescritas con detalle completo

**Cambios v2.3**:
- Agregada sección `REVERSO_PAGO` (Anulación de Abono) con variable `ACCOUNTING_CONFIGURABLE_ANULACION_ABONO`
- Configuraciones de `PAGO_VENTANILLA` y `REVERSO_PAGO` creadas desde la UI (flags pendientes de activar)
- `SALDO_SOBRANTE` ahora se dispara también para pagos de ventanilla/manuales (no solo planilla)
- `ANULACION_SOBRANTE` ahora se dispara al revertir pagos de ventanilla/manuales con sobrante
- Al revertir un pago de ventanilla, se eliminan los registros `SaldoPendiente` asociados (antes solo se limpiaban para planilla)
- Ambos asientos de sobrante usan la misma configuración existente (no requieren nuevas variables .env)

**Cambios v2.2**:
- Agregado tipo de asiento `ANULACION_SOBRANTE` con variable `ACCOUNTING_CONFIGURABLE_ANULACION_SOBRANTE`
- `ANULACION_PLANILLA` ahora incluye componente `sobrante` en el breakdown
- Al anular una planilla con sobrante, se dispara automáticamente el segundo asiento `ANULACION_SOBRANTE` (espejo inverso de `SALDO_SOBRANTE`)

**Cambios v2.1**:
- Agregado tipo de asiento `REINTEGRO_SALDO` con variable `ACCOUNTING_CONFIGURABLE_REINTEGRO_SALDO`
- Corregido cálculo de componentes contables (interes_corriente, mora, poliza) para que reflejen solo el pago de la transacción actual y no el acumulado histórico del crédito
- Eliminado doble disparo de `SALDO_SOBRANTE` (la cascada automática fue removida; ahora solo se dispara desde `upload()`)

**Cambios v2.0**:
- Renombrado CREDIPEPE → CREDIPEP en todo el sistema
- Agregado tipo de asiento `SALDO_SOBRANTE` con variable `ACCOUNTING_CONFIGURABLE_SALDO_SOBRANTE`
- Agregado componente de monto `sobrante` en el configurador de líneas
- Corregido punto de disparo del asiento de sobrante (ahora se dispara directamente desde el upload de planilla)
- Actualizada tabla de tipos de asiento con estructura completa de PAGO_PLANILLA
