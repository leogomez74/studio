# Módulo de Inversiones — Especificación Completa

**Fecha de creación:** 2026-03-04
**Estado:** Pendiente de implementación
**Proyecto:** CR Studio (Laravel 12 + Next.js)

---

## Contexto

Módulo para gestionar inversiones de terceros (inversionistas) en la cooperativa.
Basado en un Excel existente con dos secciones: **Dólares (USD)** y **Colones (CRC)**.

---

## Reglas de negocio

| Campo | Fórmula / Regla |
|---|---|
| Interés mensual | `Monto × Tasa_anual / 12` |
| Retención 15% | `Interés_mensual × 0.15` (obligatorio por ley) |
| Interés por pagar | `Interés_mensual − Retención_15` |
| Conversión USD→CRC | Solo en inversiones en dólares, tipo de cambio configurable |
| Fecha vencimiento | `Fecha_inicio + Plazo_meses` |
| Al editar tasa | Regenerar toda la tabla de pagos automáticamente |

**Formas de pago soportadas:**
- `mensual` — pago cada mes
- `trimestral` — pago cada 3 meses
- `semestral` — pago cada 6 meses
- `reserva` — acumula y paga todo al vencimiento

**Estados de una inversión:**
- `activa` — vigente
- `por_vencer` — vence en ≤ 30 días (calculado, no almacenado)
- `vencida` — pasó la fecha de vencimiento sin renovar/cancelar
- `cancelada` — cancelada manualmente
- `renovada` — fue renovada (la nueva inversión referencia a esta)

---

## Base de datos

### Tabla `investors`
```
id
name              string        — Nombre completo o razón social
cedula            string        — Cédula o pasaporte
tipo              enum          — persona / empresa
email             string nullable
telefono          string nullable
banco             string nullable
cuenta_bancaria   string nullable
moneda_preferida  enum          — USD / CRC
observaciones     text nullable
timestamps
```

### Tabla `investments`
```
id
investor_id       FK → investors
numero_desembolso string        — Número correlativo o referencia
moneda            enum          — USD / CRC
monto             decimal(15,2)
plazo_meses       integer
fecha_inicio      date
fecha_vencimiento date          — Calculada: fecha_inicio + plazo_meses
tasa_anual        decimal(8,4)  — Editable, dispara regeneración de pagos
forma_pago        enum          — mensual / trimestral / semestral / reserva
estado            enum          — activa / vencida / cancelada / renovada
tipo_cambio       decimal(10,4) nullable  — Solo USD, para conversión a CRC
investment_origen_id FK nullable — Si es renovación, apunta a la inversión original
observaciones     text nullable
cancelado_por     string nullable
fecha_cancelacion date nullable
timestamps
```

### Tabla `investment_payments` (tabla de amortización)
```
id
investment_id     FK → investments
numero_pago       integer
fecha_pago        date          — Fecha programada
interes_bruto     decimal(15,2) — Interés mensual/trimestral/semestral calculado
retencion_15      decimal(15,2) — 15% del interés bruto
interes_neto      decimal(15,2) — interes_bruto - retencion_15
estado            enum          — pendiente / pagado / vencido
fecha_pago_real   date nullable — Fecha real en que se pagó
comprobante       string nullable — Ruta a archivo adjunto
notas             string nullable
timestamps
```

---

## API Backend (Laravel)

```
# Inversionistas
GET    /api/investors                         Listado
POST   /api/investors                         Crear
PUT    /api/investors/{id}                    Editar
DELETE /api/investors/{id}                    Eliminar

# Inversiones
GET    /api/investments                       Listado (filtros: investor_id, moneda, estado, fecha)
POST   /api/investments                       Nueva inversión + genera tabla de pagos
GET    /api/investments/{id}                  Detalle + tabla de pagos
PUT    /api/investments/{id}                  Editar (si cambia tasa → regenera pagos)
POST   /api/investments/{id}/cancel           Cancelar inversión
POST   /api/investments/{id}/renew            Renovar (crea nueva inversión referenciando esta)

# Pagos
GET    /api/investments/{id}/payments         Tabla de amortización
PATCH  /api/investments/{id}/payments/{pid}   Marcar pago como realizado / subir comprobante

# Exportación
GET    /api/investments/export/excel          Excel con sección USD y CRC (igual al original)
GET    /api/investments/export/pdf            PDF estado de cuenta por inversionista

# Utilidades
GET    /api/investments/preview               Preview de tabla de pagos antes de guardar
GET    /api/investments/vencimientos          Próximos vencimientos (30/60/90 días)
```

---

## Frontend (Next.js)

### Estructura de páginas
```
/dashboard/inversiones/
  page.tsx              — Vista principal: tabla + filtros + resumen financiero
  nueva/page.tsx        — Formulario nueva inversión con preview en tiempo real
  [id]/page.tsx         — Detalle: datos editables + tabla de amortización
```

### Vista principal `/dashboard/inversiones`
- **Resumen al tope:** Total invertido USD | Total invertido CRC | Intereses mensuales a pagar
- **Filtros:** Inversionista, Moneda, Estado, Rango de fechas de vencimiento
- **Tabla:** # Desembolso, Inversionista, Monto, Moneda, Plazo, Fecha inicio, Vencimiento, Tasa, Forma de pago, Estado, Acciones
- **Acciones por fila:** Ver detalle, Editar, Renovar, Cancelar
- **Botones globales:** Nueva Inversión, Exportar Excel, Exportar PDF

### Formulario nueva inversión
- Al cambiar tasa o monto → recalcula preview de pagos en tiempo real (sin llamada API, cálculo frontend)
- Preview muestra tabla de amortización completa antes de guardar
- Selector de inversionista existente o botón "Crear nuevo inversionista"

### Vista detalle `[id]`
- Datos de la inversión todos editables inline
- Al cambiar tasa → botón "Recalcular" que regenera la tabla de pagos (con confirmación si ya hay pagos realizados)
- Tabla de amortización: cada fila con botón "Marcar pagado" + adjuntar comprobante
- Historial de cambios de tasa (auditoría)
- Botón "Renovar" abre modal con las condiciones de renovación (editables)
- Botón "Cancelar inversión" con confirmación y motivo

---

## Funcionalidades adicionales confirmadas

| Funcionalidad | Descripción |
|---|---|
| Dashboard de vencimientos | Inversiones que vencen en 30/60/90 días |
| Historial de cambios de tasa | Auditoría: usuario, fecha, tasa anterior, tasa nueva |
| Comprobante de pago | Adjuntar imagen/PDF al registrar cada pago |
| Renovación parcial | Renovar solo una parte del capital; el resto se devuelve |
| Tipo de cambio configurable | USD→CRC configurable, puede variar por período |
| Reporte de retenciones | Resumen mensual del 15% retenido (para declaración tributaria) |
| Calendario de pagos | Vista calendario con pagos programados del mes |
| Multi-cuenta bancaria | Cada inversionista puede tener cuentas en USD y CRC |

---

## Exportaciones

### Excel
- Formato idéntico al Excel original
- Sección DOLARES + sección COLONES en la misma hoja o en hojas separadas
- Fila de totales al final de cada sección
- Filtrable por período o inversionista

### PDF
- Encabezado con logo y datos de la empresa
- Datos del inversionista
- Tabla de inversiones activas
- Tabla de pagos del período seleccionado
- Total de intereses pagados y retenciones del período

---

## Estimado de implementación

| Fase | Tarea | Días |
|---|---|---|
| 1 | Migraciones (investors, investments, investment_payments) | 0.5 |
| 2 | Backend CRUD inversiones + lógica de generación de pagos | 2 |
| 3 | Backend renovación, cancelación, exportación | 1 |
| 4 | Frontend: vista principal + filtros | 1.5 |
| 5 | Frontend: formulario nueva inversión + preview | 1 |
| 6 | Frontend: detalle + tabla de amortización editable | 1 |
| 7 | Exportación PDF + Excel | 1 |
| 8 | Pruebas y ajustes | 1 |
| **Total** | | **~9 días** |

---

## Notas para implementación

- Seguir el mismo patrón STI del resto del proyecto donde aplique
- Auth: Sanctum, mismo middleware que el resto de rutas
- Validaciones Laravel en FormRequest separados por recurso
- Frontend: mismos componentes UI (shadcn) que el resto del proyecto
- El cálculo de la tabla de pagos debe vivir en un Service de Laravel (`InvestmentPaymentService`) para reutilizarlo en creación, edición y preview
- El campo `tasa_anual` debe guardar historial en tabla separada `investment_rate_history` (investor_id, tasa_anterior, tasa_nueva, cambiado_por, created_at)
