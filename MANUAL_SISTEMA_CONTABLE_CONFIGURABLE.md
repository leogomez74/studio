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

# Devoluciones y reversos
ACCOUNTING_CONFIGURABLE_DEVOLUCION=false

# Saldo sobrante de planilla (se dispara automáticamente cuando
# queda dinero sobrante tras pagar todos los créditos de una planilla)
ACCOUNTING_CONFIGURABLE_SALDO_SOBRANTE=false
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
| Línea | Cuenta | Movimiento | Componente |
|-------|--------|------------|------------|
| 1 | banco_credipep | Débito | Total |
| 2 | cuentas_por_cobrar | Crédito | Total |

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
**Cuándo se dispara**: Automáticamente después de PAGO_PLANILLA cuando queda dinero sobrante tras pagar todos los créditos del cliente

**Variable .env**: `ACCOUNTING_CONFIGURABLE_SALDO_SOBRANTE=true`

| Línea | Cuenta | Movimiento | Componente |
|-------|--------|------------|------------|
| 1 | retenciones_por_aplicar | Débito | Sobrante |
| 2 | desembolsos_saldos_favor | Crédito | Sobrante |

> Este es el **2do asiento automático** del flujo de sobrantes. Se dispara solo si hay un sobrante mayor a ₡0.50 y si existe una configuración activa de tipo `SALDO_SOBRANTE`.

---

### ABONO_EXTRAORDINARIO
**Cuándo se dispara**: Pago fuera de cuota
| Línea | Cuenta | Movimiento | Componente |
|-------|--------|------------|------------|
| 1 | banco_credipep | Débito | Total |
| 2 | cuentas_por_cobrar | Crédito | Total |

---

### CANCELACION_ANTICIPADA
**Cuándo se dispara**: Cliente paga todo el crédito antes del plazo
| Línea | Cuenta | Movimiento | Componente |
|-------|--------|------------|------------|
| 1 | banco_credipep | Débito | Total |
| 2 | cuentas_por_cobrar | Crédito | Total |

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

---

**Última actualización**: 2026-02-24
**Versión del manual**: 2.0
**Cambios v2.0**:
- Renombrado CREDIPEPE → CREDIPEP en todo el sistema
- Agregado tipo de asiento `SALDO_SOBRANTE` con variable `ACCOUNTING_CONFIGURABLE_SALDO_SOBRANTE`
- Agregado componente de monto `sobrante` en el configurador de líneas
- Corregido punto de disparo del asiento de sobrante (ahora se dispara directamente desde el upload de planilla)
- Actualizada tabla de tipos de asiento con estructura completa de PAGO_PLANILLA
