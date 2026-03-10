# Plan de Implementación: Sistema de Mora

## Resumen Ejecutivo

Implementar el cálculo automático de intereses moratorios cuando se sube una planilla de pagos.

---

## 1. Reglas de Negocio

### 1.1 Filtro por Deductora
- Al subir planilla, se debe **seleccionar la deductora** (cooperativa)
- Solo se procesan créditos de **esa deductora específica**
- Solo se calcula mora para créditos de **esa deductora** que no estén en la lista
- Relación: `credits.deductora_id` → viene de la persona/lead

### 1.2 Cuándo Inicia la Mora
- La mora **NO** inicia desde la fecha de formalización
- Inicia el **1ro del mes siguiente** a la formalización
- Ejemplo: Crédito formalizado el 22 de diciembre → mora inicia el **1 de enero**

### 1.3 Ciclo de Planillas (Siempre 1 mes de retraso)
| Mes Actual | Planilla Corresponde a | Notas |
|------------|------------------------|-------|
| Enero | - | No hay planilla (primer mes del crédito) |
| Febrero | Enero | Primera planilla |
| Marzo | Febrero | ... |
| Abril | Marzo | ... |

### 1.4 Cuándo se Calcula Mora
- **SOLO** cuando la persona **NO está en la lista** de la planilla
- Si **SÍ está** en la lista → No hay mora, se procesa pago normal

### 1.5 Fórmula de Mora
```
Mora = Capital × (Tasa Mora / 365) × Días del mes
```
- **Capital**: `credits.monto_credito` (monto total del crédito)
- **Tasa Mora**: 33.5% anual (desde configuración "Tasa Actual")
- **Días**: Días completos del mes que se está pagando (31 para enero, 28/29 para febrero, etc.)

### 1.6 Estados de Cuota en `plan_de_pagos`
| Estado | Descripción |
|--------|-------------|
| `Pendiente` | Default. Cuota aún no vence o está al día |
| `Mora` | No pagó en el mes correspondiente. Tiene mora calculada |
| `Pagado` | Cuota completamente saldada |

---

## 2. Ciclo Completo - Ejemplo

### Escenario: Crédito formalizado en Diciembre

| Mes | Planilla | ¿En lista? | Acción |
|-----|----------|------------|--------|
| Dic | - | - | Crédito formalizado el 22 |
| Ene | - | - | No hay planilla (primer mes) |
| Feb | Enero | ✅ Sí | Cuota 1 → "Pagado", sin mora |
| Mar | Febrero | ❌ No | Calcular mora de Feb (28 días), Cuota 2 → "Mora" |
| Abr | Marzo | ✅ Sí | Pago se aplica a cuota en mora primero (ver cascada) |
| May | Abril | ✅ Sí | Continúa ciclo normal... |


---

## 3. Cascada de Pagos (Cuando hay mora pendiente)

Cuando una persona **SÍ está en la lista** pero tiene cuotas en estado "Mora", el pago se aplica en este orden:

### Paso 1: Pagar primero la cuota en "Mora" (la más antigua)
```
1. Mora (interes_moratorio)
2. Interés (interes)
3. Capital (amortizacion)
```

### Paso 2: Si sobra dinero, aplicar a la cuota actual
```
1. Interés
2. Capital
```

### Ejemplo Numérico

**Situación:**
- Cuota 2 (febrero) → estado "Mora"
  - Mora: ₡5,000
  - Interés: ₡10,000
  - Capital: ₡35,000
- Cuota 3 (marzo) → estado "Pendiente"
- Pago recibido en abril: ₡50,000

**Distribución del pago:**
```
Cuota 2 (en mora):
├── Mora:    ₡5,000  ✓ (saldada)
├── Interés: ₡10,000 ✓ (saldado)
├── Capital: ₡35,000 ✓ (saldado)
└── Estado:  "Pagado"

Sobran: ₡0

Cuota 3 queda "Pendiente" (se pagará con siguiente planilla)
```

**Otro ejemplo (pago insuficiente):**
- Pago recibido: ₡40,000

```
Cuota 2 (en mora):
├── Mora:    ₡5,000  ✓ (saldada)
├── Interés: ₡10,000 ✓ (saldado)
├── Capital: ₡25,000 de ₡35,000 (parcial)
└── Estado:  Sigue en "Mora" (queda saldo de ₡10,000)
```

---

## 4. Cambios en Base de Datos

### 4.1 Ya Implementado ✅
- `credits.formalized_at` (timestamp) - Fecha de formalización

### 4.2 Por Implementar

#### Migración: Agregar estado a plan_de_pagos
```php
// database/migrations/xxxx_add_estado_to_plan_de_pagos_table.php
Schema::table('plan_de_pagos', function (Blueprint $table) {
    $table->string('estado')->default('Pendiente')->after('numero_cuota');
    // Valores: 'Pendiente', 'Mora', 'Pagado'
});
```

---

## 5. Lógica en el Backend

### 5.1 Modificar `CreditPaymentController@upload()`

#### Validación inicial
```php
$validated = $request->validate([
    'file' => 'required|file',
    'deductora_id' => 'required|exists:deductoras,id',
]);

$deductoraId = $request->input('deductora_id');
```

#### Paso 1: Procesar planilla normalmente
- Leer archivo Excel
- Hacer match por cédula + **deductora_id del crédito**
- Para cada persona EN la lista:
  - Verificar si tiene cuotas en "Mora"
  - Si tiene → aplicar cascada (mora → interés → capital)
  - Si no tiene → pago normal a cuota pendiente
  - Marcar cuota como "Pagado" si se completó

#### Paso 2: Calcular mora para los ausentes (de la misma deductora)
```php
// Deductora seleccionada en el frontend
$deductoraId = $request->input('deductora_id');

// Mes que se está pagando (mes anterior al actual)
$mesPago = now()->subMonth();
$diasDelMes = $mesPago->daysInMonth;

// Obtener tasa de mora desde configuración
$tasaMora = Config::where('key', 'tasa_actual')->value('value') ?? 33.5;

// IDs de créditos que SÍ pagaron (ya procesados en paso 1)
$creditosQuePagaron = collect($procesados)->pluck('credit_id')->toArray();

// Obtener créditos formalizados de ESTA DEDUCTORA que NO pagaron
$creditosSinPago = Credit::where('status', 'Formalizado')
    ->where('deductora_id', $deductoraId)  // ← FILTRO POR DEDUCTORA
    ->whereNotNull('formalized_at')
    ->whereNotIn('id', $creditosQuePagaron)
    ->get();

foreach ($creditosSinPago as $credit) {
    // Verificar si ya comenzó período de mora
    $inicioMora = Carbon::parse($credit->formalized_at)
        ->startOfMonth()
        ->addMonth();

    if ($mesPago->lt($inicioMora)) {
        continue; // Crédito muy nuevo, aún no genera mora
    }

    // Buscar cuota pendiente más antigua
    $cuota = $credit->planDePagos()
        ->where('numero_cuota', '>', 0)
        ->where('estado', 'Pendiente')
        ->orderBy('numero_cuota')
        ->first();

    if (!$cuota) continue;

    // Calcular mora
    $mora = $credit->monto_credito * ($tasaMora / 100 / 365) * $diasDelMes;

    // Guardar mora y cambiar estado
    $cuota->interes_moratorio = round($mora, 2);
    $cuota->estado = 'Mora';
    $cuota->save();
}
```

### 5.2 Modificar `processPaymentTransaction()`

```php
private function processPaymentTransaction(Credit $credit, float $montoPagado, $fechaPago, string $source, ?string $cedula)
{
    $restante = $montoPagado;

    // Obtener cuotas en orden: primero las que están en "Mora", luego "Pendiente"
    $cuotas = $credit->planDePagos()
        ->where('numero_cuota', '>', 0)
        ->whereIn('estado', ['Mora', 'Pendiente'])
        ->orderByRaw("FIELD(estado, 'Mora', 'Pendiente')")
        ->orderBy('numero_cuota')
        ->get();

    foreach ($cuotas as $cuota) {
        if ($restante <= 0) break;

        // 1. Pagar MORA primero (si existe)
        $moraPendiente = $cuota->interes_moratorio - $cuota->movimiento_interes_moratorio;
        if ($moraPendiente > 0) {
            $pagoMora = min($restante, $moraPendiente);
            $cuota->movimiento_interes_moratorio += $pagoMora;
            $restante -= $pagoMora;
        }

        // 2. Pagar INTERÉS
        $interesPendiente = $cuota->interes - $cuota->movimiento_interes;
        if ($interesPendiente > 0 && $restante > 0) {
            $pagoInteres = min($restante, $interesPendiente);
            $cuota->movimiento_interes += $pagoInteres;
            $restante -= $pagoInteres;
        }

        // 3. Pagar PÓLIZA (si aplica)
        $polizaPendiente = ($cuota->poliza ?? 0) - ($cuota->movimiento_poliza ?? 0);
        if ($polizaPendiente > 0 && $restante > 0) {
            $pagoPoliza = min($restante, $polizaPendiente);
            $cuota->movimiento_poliza += $pagoPoliza;
            $restante -= $pagoPoliza;
        }

        // 4. Pagar CAPITAL
        $capitalPendiente = $cuota->amortizacion - $cuota->movimiento_amortizacion;
        if ($capitalPendiente > 0 && $restante > 0) {
            $pagoCapital = min($restante, $capitalPendiente);
            $cuota->movimiento_amortizacion += $pagoCapital;
            $restante -= $pagoCapital;
        }

        // Verificar si la cuota está completamente pagada
        $totalCuota = $cuota->interes_moratorio + $cuota->interes + ($cuota->poliza ?? 0) + $cuota->amortizacion;
        $totalPagado = $cuota->movimiento_interes_moratorio + $cuota->movimiento_interes + ($cuota->movimiento_poliza ?? 0) + $cuota->movimiento_amortizacion;

        if ($totalPagado >= $totalCuota) {
            $cuota->estado = 'Pagado';
        }

        $cuota->save();
    }

    // Registrar el pago en credit_payments
    // ... (código existente)
}
```

---

## 6. Flujo Visual

```
┌─────────────────────────────────────────────────────────────┐
│                    SUBIR PLANILLA                           │
│                                                             │
│  1. Usuario selecciona DEDUCTORA (ej: COOPENACIONAL)        │
│  2. Usuario sube archivo Excel                              │
│  3. Click "Procesar Planilla"                               │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  PASO 1: Procesar personas EN la lista                      │
│          (Solo créditos de la deductora seleccionada)       │
│                                                             │
│  Para cada persona:                                         │
│  ├── ¿Tiene cuotas en "Mora"?                               │
│  │   ├── SÍ → Cascada: Mora → Interés → Capital             │
│  │   └── NO → Pago normal a cuota pendiente                 │
│  └── Marcar cuota "Pagado" si se completó                   │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  PASO 2: Calcular mora para los que NO están en lista       │
│          (Solo créditos de la MISMA deductora)              │
│                                                             │
│  Para cada crédito formalizado que NO pagó:                 │
│  ├── Filtrar por deductora_id                               │
│  ├── ¿Ya inició período de mora?                            │
│  │   └── (1ro del mes siguiente a formalización)            │
│  ├── Buscar cuota "Pendiente" más antigua                   │
│  ├── Calcular: mora = capital × (33.5%/365) × días_mes      │
│  └── Guardar mora, estado = "Mora"                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Ejemplo Numérico Completo

### Datos del Crédito
- Monto: ₡500,000
- Formalizado: 22 de diciembre
- Tasa mora: 33.5%
- Cuota mensual: ₡50,000

### Mes 1: Febrero (planilla de enero)
- Persona **SÍ está** en lista
- Sin mora (primer mes)
- Cuota 1 → "Pagado"

### Mes 2: Marzo (planilla de febrero)
- Persona **NO está** en lista
- Calcular mora febrero (28 días):
```
Mora = 500,000 × (33.5/100/365) × 28 = ₡12,849.32
```
- Cuota 2 → estado "Mora", interes_moratorio = ₡12,849.32

### Mes 3: Abril (planilla de marzo)
- Persona **SÍ está** en lista
- Pago: ₡50,000
- Distribución:
```
Cuota 2 (en mora):
├── Mora:    ₡12,849.32 ✓
├── Interés: ₡XX,XXX.XX ✓
├── Capital: Lo que reste
└── Si alcanza → "Pagado"
    Si no alcanza → sigue en "Mora"
```

---

## 8. Tareas de Implementación

### Ya Implementado ✅
- [x] **Frontend**: Modal de planilla con selector de deductora
- [x] **Credits**: Campo `formalized_at` agregado

### Por Implementar
- [ ] **Migración**: Agregar campo `estado` a `plan_de_pagos`
- [ ] **Modelo PlanDePago**: Agregar `estado` a fillable
- [ ] **Controller upload()**:
  - Validar `deductora_id` requerido
  - Filtrar créditos por deductora
  - Implementar lógica de mora para ausentes de esa deductora
- [ ] **Controller processPaymentTransaction()**: Implementar cascada Mora → Interés → Capital
- [ ] **Config**: Verificar que existe "tasa_actual" en configuración
- [ ] **Test**: Probar escenarios:
  - Crédito nuevo, primer pago (sin mora)
  - Crédito con 1 mes sin pagar (genera mora)
  - Crédito con mora que luego paga (cascada)
  - Pago insuficiente (queda saldo en mora)

---

## 9. Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `database/migrations/xxxx_add_estado_to_plan_de_pagos.php` | Nueva migración |
| `app/Models/PlanDePago.php` | Agregar `estado` a fillable |
| `app/Http/Controllers/Api/CreditPaymentController.php` | Lógica de mora en `upload()` y cascada en `processPaymentTransaction()` |

