# Migración Legacy CrediPEP — Cálculo de Mora según Ley 9859

> Documento del cálculo de intereses moratorios aplicado por el comando
> `php artisan migrar:creditos-legacy`. Aplica **solo dentro del script de
> migración**; el sistema Studio en operaciones normales no se ve afectado.

## Marco legal

- **Ley 9859** — Ley de Usura (Costa Rica), vigente desde 20 de julio de 2020.
- **Artículo 36 ter**: la suma de la tasa ordinaria y la tasa moratoria de un
  crédito **no puede exceder** la tasa máxima legal del semestre publicada por
  el BCCR.
- **Cálculo**: la mora se determina sobre el **monto vencido de cada cuota** y
  **no se capitaliza** al capital del crédito (prohibición de anatocismo).

## Reglas implementadas

### Scope (a qué créditos aplica el cálculo nuevo)

Solo los créditos con TODAS estas condiciones:

| Condición | Detalle |
|---|---|
| `reg_creditos.ESTADO = 'A'` | Activo (no cancelado ni anulado) |
| `FECHA_REGISTRO >= 2020-07-01` | Post Ley de Usura |
| `INT > 0` | Tasa corriente mayor a 0% |
| `YEAR(FECHA_REGISTRO) < 2026` | Excluye créditos 2026 |

Para créditos fuera de scope (cancelados, anulados, pre-Ley, tasa 0%) se
preservan los valores `mora_dias` e `interes_moratorio` del legacy tal cual.

### Tasa moratoria efectiva (Regla 1, PRIORITARIA)

```
y_max = N − x
```

- **N** = tope de usura del semestre de formalización (colones), distinguiendo
  por monto: `MONTOAPR > 690.000` → gral; `MONTOAPR ≤ 690.000` → micro.
- **x** = tasa corriente del crédito (`reg_creditos.INT`).

Si `x ≥ N`, entonces `y_max = 0` → la mora del crédito completo es 0,
independientemente de la antigüedad de las cuotas vencidas.

### Gracia de 2 meses (Regla 2)

A partir de `fecha_pago` (vencimiento de la cuota):
- Días 0 a 60 ± (= `fecha_pago + 2 meses calendario`): **sin mora**.
- A partir del día 61 (= `fecha_pago + 2 meses + 1 día`): **se acumula mora**.

Implementación: `Carbon::parse($fechaPago)->addMonths(2)` da el fin de gracia.

### Fórmula

```
interes_moratorio = monto_vencido_cuota × (y_max / 100) × (dias_mora / 360)
```

donde:
- `monto_vencido_cuota` = `plan_de_pagos.cuota` de esa fila legacy
  - Bullet intermedia: el interés mensual (ej. ₡11.969)
  - Bullet final: capital + último interés (ej. ₡610.419)
  - Amortizable: cuota nivelada (amort + interés)
- `dias_mora` = días desde `fin_gracia` hasta `now()`
- Base = **360 días** (convención financiera CR)

### Sub-líneas

El legacy tiene sub-líneas para cuotas pagadas en partes (ID_SEQ 3.00, 3.01,
3.02 todas con NUM_CUOTA=1). **Solo la sub-línea madre (X.00)** acumula mora;
las sub-líneas X.01+ quedan con `mora_dias=0`, `interes_moratorio=0` para
evitar duplicación de la base.

## Tabla histórica de tasas máximas (BCCR, colones)

| Semestre | Gral. Colones | Micro Colones |
|---|---:|---:|
| 2/2020 | 37.69 | 53.18 |
| 1/2021 | 35.56 | 50.22 |
| 2/2021 | 33.66 | 47.58 |
| 1/2022 | 33.44 | 47.27 |
| 2/2022 | 33.41 | 47.23 |
| 1/2023 | 35.51 | 50.16 |
| 2/2023 | 38.16 | 53.83 |
| 1/2024 | 38.55 | 54.37 |
| 2/2024 | 38.98 | 54.98 |
| 1/2025 | 38.36 | 54.11 |
| 2/2025 | 36.65 | 51.74 |
| **1/2026** | **36.27** | **51.21** |

Fuente: BCCR/SUGEF, tabla publicada semestralmente. Solo se usan las columnas
de colones (cartera Studio 100% CRC).

> Para créditos formalizados antes del 2020-07-01 esta regla no aplica
> (no existía la ley). Para futuros semestres se debe extender la constante
> `USURA_COLONES` en `MigrarCreditosLegacy.php`.

## Caso verificable — Crédito #4379 (PERF/4379)

| Datos | Valor |
|---|---:|
| Capital | ₡598.450 |
| Tasa ordinaria `x` | 24% |
| Tasa máxima `N` (sem.1/2022, micro) | 47.27% |
| Tasa moratoria `y_max` | 23.27% |
| Tipo | bullet, 36 cuotas mensuales solo interés |
| Cuota mensual (bullet intermedia) | ₡11.969 |
| Cuota final 39 (capital + interés) | ₡610.419 |
| Fecha referencia | 20/05/2026 |

**Resultados esperados (validados por test):**

| # Cuota | Días mora | Base mora | Interés moratorio |
|---:|---:|---:|---:|
| 1 | 1.327 | ₡11.969 | **₡10.266,51** ✅ |
| 2 | 1.297 | ₡11.969 | **₡10.034,41** ✅ |
| 38 | 200 | ₡11.969 | **₡1.547,33** ✅ |
| 39 | 171 | ₡610.419 | **₡67.471,14** ✅ |

Test: `backend/tests/Unit/MigrarCreditosLegacyMoraTest.php`.
Tolerancia: ±₡0,05 por rounding.

## Errores conocidos que NO se replican

| Error | Origen | Por qué está mal |
|---|---|---|
| Base = capital completo del crédito | CrediPep actual | Sobrecobra masivamente |
| Mora solo en última cuota | Legacy CrediPEP | Ignora cuotas intermedias |
| Tasa moratoria = tasa ordinaria | Legacy | Viola Ley 9859 (24+24 > 47.27) |
| Base = amortización | Implementación anterior | Subestima en bullets |
| Sumar mora al capital | — | Anatocismo, ilegal |

## Saldo total del crédito

```
saldo_total = capital_pendiente + Σ(interés_corriente_vencido) + Σ(interés_moratorio_acumulado)
```

- `credits.saldo` mantiene **solo el capital pendiente** (separación legal del capital).
- El frontend (`creditos/[id]/page.tsx`) calcula el "Saldo Total" en render
  sumando los intereses.
- **Capital NUNCA se contamina con intereses** (no anatocismo).

## Cómo ejecutar la migración

```bash
# Vista previa (sin escribir)
php artisan migrar:creditos-legacy --solo-activos --dry-run

# Migrar todo, sin disparar asientos al ERP
php artisan migrar:creditos-legacy --solo-activos --sin-asientos

# Re-migrar créditos ya existentes (borra y recrea)
php artisan migrar:creditos-legacy --solo-activos --sin-asientos --reemplazar

# Un crédito específico
php artisan migrar:creditos-legacy --codigo=PERF --id-solicitud=4379 --sin-asientos
```

## Restricciones explícitas

- ❌ **NO** se modifica la lógica de mora del core Studio (`PaymentProcessingService`,
  `CreditPaymentController`, `AbonoService`, etc.).
- ❌ **NO** se modifican endpoints, modelos, ni el frontend (excepto el render
  cosmético de "D" y el sort por linea, que son cambios mínimos compatibles).
- ✅ **Solo** se modifica `MigrarCreditosLegacy.php` (el script de migración).

## Versionado

- v1: copia ciega del legacy (mora idéntica a CrediPEP).
- v2: refactor con `saldo_anterior × (N - x)` (incorrecto, sobreestimaba).
- **v3 (actual)**: fórmula Ley 9859 con `monto_vencido_cuota × y_max × días/360`.

Para volver a una versión anterior: ver tag local `migracion-legacy-v2.0` o
backup en `backend/app/Console/Commands/_backups/`.
