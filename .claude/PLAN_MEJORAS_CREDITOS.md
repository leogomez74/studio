# Plan de Mejoras: Modulo de Creditos y Cobranza

## Contexto

El modulo de creditos tiene funcionalidad core operativa (pagos, reversiones, cancelacion anticipada, refundicion), pero carece de herramientas administrativas criticas para la gestion diaria de cobranza. El equipo de cobros necesita: documentos legales (estados de cuenta, certificaciones, cartas), ajustes manuales de mora/estado, y flexibilidad en descuentos al momento de cancelar operaciones. Adicionalmente hay un bug donde el interes moratorio no se muestra en el plan de pagos del listado de creditos.

---

## Tarea 1: Generacion de Estados de Cuenta (PDF)

### Estado actual
**No existe.** Solo existe el PDF del plan de pagos (`/credits/{id}/plan-pdf`).

### Implementacion requerida

#### Ruta
```php
GET /api/credits/{id}/estado-de-cuenta-pdf
```

#### Archivos a crear/modificar
1. **Vista Blade:** `backend/resources/views/pdf/estado_de_cuenta.blade.php`
2. **Metodo en controlador:** `CreditController::downloadEstadoDeCuenta()`

#### Contenido del Estado de Cuenta
- **Encabezado:** Logo empresa, fecha de emision, numero de referencia del credito
- **Datos del cliente:** Nombre, cedula, direccion (del Lead/Client asociado)
- **Datos del credito:** Monto original, tasa, plazo, fecha de formalizacion, deductora
- **Resumen financiero:**
  - Saldo de capital vigente
  - Interes corriente pendiente
  - Interes moratorio acumulado
  - Cargos/polizas pendientes
  - **Saldo total adeudado**
- **Detalle de cuotas:** Tabla con todas las cuotas (pagadas, pendientes, en mora)
- **Historial de pagos:** Ultimos N pagos registrados (credit_payments)
- **Pie de pagina:** Aviso legal, fecha de corte del estado

#### Infraestructura existente a reutilizar
- DomPDF ya instalado (`barryvdh/laravel-dompdf`)
- Patron existente en `downloadPlanPDF()` (linea ~792 de CreditController)
- Relaciones: `$credit->planDePagos`, `$credit->payments`, `$credit->lead`

---

## Tarea 2: Certificacion de Deuda (PDF)

### Estado actual
**No existe.**

### Implementacion requerida

#### Ruta
```php
GET /api/credits/{id}/certificacion-deuda-pdf
```

#### Archivos a crear/modificar
1. **Vista Blade:** `backend/resources/views/pdf/certificacion_deuda.blade.php`
2. **Metodo en controlador:** `CreditController::downloadCertificacionDeuda()`

#### Contenido
- **Encabezado formal:** "CERTIFICACION DE DEUDA" con membrete
- **Cuerpo:** "Se certifica que [NOMBRE], portador de cedula [CEDULA], mantiene una obligacion crediticia con las siguientes condiciones:"
  - Numero de operacion
  - Monto original del credito
  - Saldo actual de capital
  - Cuotas pagadas / cuotas totales
  - Estado del credito (Al dia, En mora X dias)
  - Monto total adeudado a la fecha
- **Firma:** Espacio para firma autorizada, sello
- **Pie:** Fecha de emision, vigencia de la certificacion

---

## Tarea 3: Carta de Cancelacion / Paz y Salvo (PDF)

### Estado actual
**No existe.**

### Implementacion requerida

#### Ruta
```php
GET /api/credits/{id}/carta-cancelacion-pdf
```

#### Archivos a crear/modificar
1. **Vista Blade:** `backend/resources/views/pdf/carta_cancelacion.blade.php`
2. **Metodo en controlador:** `CreditController::downloadCartaCancelacion()`

#### Contenido
- **Encabezado formal:** "CARTA DE CANCELACION / PAZ Y SALVO"
- **Cuerpo:** "Se hace constar que [NOMBRE], cedula [CEDULA], ha cancelado en su totalidad la obligacion crediticia numero [REFERENCIA] por un monto original de [MONTO], quedando libre de toda deuda."
  - Fecha de apertura del credito
  - Fecha de ultima cuota / cancelacion
  - Monto total pagado
- **Condicion:** Solo generable cuando `credit.status = 'Cerrado'` y todas las cuotas esten en estado 'Pagado'
- **Firma y sello**

---

## Tarea 4: Poner Cliente Al Dia (Ajuste Manual)

### Estado actual
**No existe.** Solo existe el calculo automatico de mora via `credit:calcular-mora`.

### Implementacion requerida

#### Ruta
```php
POST /api/credits/{id}/regularizar
```

#### Archivos a crear/modificar
1. **Metodo en controlador:** `CreditController::regularizar()` o nuevo `CreditAdjustmentController`
2. **FormRequest:** `RegularizarCreditRequest`

#### Logica
- **Input:** `credit_id`, `motivo` (texto), `cuotas_a_regularizar` (array de IDs o "todas"), `condonar_mora` (bool)
- **Proceso:**
  1. Validar que el usuario tiene permiso de admin/supervisor
  2. Para cada cuota en mora seleccionada:
     - Si `condonar_mora = true`: Resetear `interes_moratorio` a 0
     - Resetear `dias_mora` a 0
     - Cambiar `estado` de 'Mora' a 'Pendiente' (si no esta pagada)
  3. Actualizar status del credito si aplica (de 'En Mora' a 'Activo')
  4. Registrar en log de auditoria: quien, cuando, motivo, valores anteriores
- **Respuesta:** Credito actualizado con plan de pagos recalculado

#### Tabla de auditoria (nueva)
```
credit_adjustments:
  - id
  - credit_id
  - user_id (quien lo hizo)
  - tipo ('regularizacion' | 'atraso_manual' | 'descuento')
  - motivo (text)
  - detalle (JSON con snapshot antes/despues)
  - created_at
```

---

## Tarea 5: Agregar Atraso Manual

### Estado actual
**No existe.**

### Implementacion requerida

#### Ruta
```php
POST /api/credits/{id}/marcar-atraso
```

#### Archivos a crear/modificar
1. **Metodo en controlador:** En el mismo controlador de ajustes
2. **FormRequest:** `MarcarAtrasoCreditRequest`

#### Logica
- **Input:** `credit_id`, `cuota_ids` (array), `dias_mora_override` (int), `motivo`
- **Proceso:**
  1. Validar permisos de admin
  2. Para cada cuota seleccionada:
     - Marcar `estado = 'Mora'`
     - Establecer `dias_mora` al valor indicado
     - Recalcular `interes_moratorio` usando la formula estandar con los dias indicados
  3. Actualizar status del credito a 'En Mora' si corresponde
  4. Registrar en `credit_adjustments`
- **Restriccion:** No se puede marcar en mora una cuota ya pagada

---

## Tarea 6: Descuentos en Cancelacion Total / Saldo a Cancelar (CON APROBACION DE GERENCIA)

### Estado actual
La cancelacion anticipada (`POST /api/credit-payments/cancelacion-anticipada`) calcula el saldo exacto sin opcion de descuento. La refundicion (`POST /api/credits/{id}/refundicion`) tampoco contempla descuentos.

### Problema reportado
Al cancelar una operacion en su totalidad o al refundir un credito para arreglo de pago, se necesita poder aplicar descuentos sobre:
- Interes moratorio acumulado (condonacion parcial o total)
- Saldo total a cancelar (descuento general)

**REQUISITO CRITICO:** Todo descuento requiere aprobacion de Gerencia antes de ejecutarse.

### Sistema de roles existente (a reutilizar)
- **Roles actuales:** Administrador (full_access), Colaborador, Finanzas
- **Campo existente:** `users.monto_max_aprobacion` (decimal 15,2) - limite de aprobacion por usuario
- **Permisos por modulo:** `role_permissions` con `can_view/create/edit/delete/archive/assign`
- **Modulos relevantes:** `cobros`, `creditos`
- **Falta:** Rol "Gerencia" y flujo de aprobacion de descuentos

### Implementacion requerida

#### Paso 1: Crear rol Gerencia y permiso de aprobacion
- Agregar rol "Gerencia" en seeder/migracion con `full_access: false` pero permisos amplios
- Agregar columna `can_approve_discounts` a `role_permissions` (o usar `full_access` de Administrador)
- Alternativa simple: usar `monto_max_aprobacion` del usuario - si el descuento esta dentro del limite, se auto-aprueba; si excede, requiere aprobacion de alguien con limite mayor

#### Paso 2: Tabla de solicitudes de descuento (nueva)
```
discount_requests:
  - id
  - credit_id
  - requested_by (user_id - quien solicita)
  - approved_by (user_id - nullable, quien aprueba)
  - status ('pendiente' | 'aprobado' | 'rechazado')
  - tipo ('cancelacion_anticipada' | 'refundicion')
  - saldo_original (decimal)
  - descuento_mora (decimal)
  - descuento_saldo (decimal)
  - saldo_final (decimal)
  - motivo (text)
  - motivo_rechazo (text, nullable)
  - approved_at (timestamp, nullable)
  - created_at
  - updated_at
```

#### Paso 3: Endpoints nuevos
```php
// Solicitar descuento (cualquier usuario de cobros/finanzas)
POST /api/discount-requests

// Listar solicitudes pendientes (gerencia/admin)
GET  /api/discount-requests?status=pendiente

// Aprobar/Rechazar (solo gerencia/admin)
PATCH /api/discount-requests/{id}/approve
PATCH /api/discount-requests/{id}/reject

// Ejecutar cancelacion con descuento aprobado
POST /api/credit-payments/cancelacion-anticipada  (+ discount_request_id)
```

#### Paso 4: Modificar endpoints existentes
**Archivos a modificar:**
1. `backend/app/Http/Controllers/Api/CreditPaymentController.php`
   - Metodos: `calcularCancelacionAnticipada()` y `cancelacionAnticipada()`

#### Flujo completo
```
1. Operador calcula cancelacion anticipada (preview normal)
   POST /api/credit-payments/cancelacion-anticipada/calcular
   -> Retorna: saldo_total = 150,000

2. Operador solicita descuento
   POST /api/discount-requests
   { credit_id, descuento_mora: 5000, descuento_saldo: 2000, motivo: "Arreglo de pago" }
   -> Retorna: request_id, status: "pendiente"

3. Gerencia ve solicitudes pendientes en su dashboard
   GET /api/discount-requests?status=pendiente
   -> Lista de solicitudes con desglose

4. Gerencia aprueba
   PATCH /api/discount-requests/{id}/approve
   -> Status cambia a "aprobado", registra approved_by y approved_at

5. Operador ejecuta cancelacion CON el descuento aprobado
   POST /api/credit-payments/cancelacion-anticipada
   { credit_id, discount_request_id: 45 }
   -> Valida que el request este aprobado
   -> Aplica descuento y cierra credito
   -> Registra en credit_adjustments
   -> Genera asiento contable diferenciado (condonacion como gasto/provision)
```

#### Parametros del calculo preview (sin cambios, solo informativo)
```json
{
  "credit_id": 123,
  "descuento_mora": 5000.00,
  "descuento_porcentaje_mora": 50,
  "descuento_saldo": 2000.00
}
```
-> Retorna desglose: saldo_original, descuento_mora, descuento_saldo, **saldo_final_a_pagar**
(Este preview NO ejecuta nada, solo muestra el impacto para que gerencia decida)

#### Aplicar tambien a refundicion
- Modificar `CreditController::refundicionPreview()` y `refundicion()` para aceptar `discount_request_id`
- Archivo: `backend/app/Http/Controllers/Api/CreditController.php`

#### Archivos a crear
| Archivo | Descripcion |
|---------|-------------|
| `backend/app/Models/DiscountRequest.php` | Modelo de solicitudes de descuento |
| `backend/app/Http/Controllers/Api/DiscountRequestController.php` | CRUD + approve/reject |
| `backend/database/migrations/xxxx_create_discount_requests_table.php` | Tabla de solicitudes |
| `backend/app/Http/Requests/StoreDiscountRequest.php` | Validacion de solicitud |

---

## Resumen de Archivos a Modificar/Crear

### Modificar (existentes)
| Archivo | Cambio |
|---------|--------|
| `backend/app/Http/Controllers/Api/CreditController.php` | 3 nuevos metodos PDF + regularizar + marcar atraso |
| `backend/app/Http/Controllers/Api/CreditPaymentController.php` | Agregar logica de descuentos en cancelacion anticipada |
| `backend/routes/api.php` | Nuevas rutas para PDFs, regularizacion, atraso manual, descuentos |

### Crear (nuevos)

| Archivo | Descripcion |
|---------|-------------|
| `backend/resources/views/pdf/estado_de_cuenta.blade.php` | Vista PDF estado de cuenta |
| `backend/resources/views/pdf/certificacion_deuda.blade.php` | Vista PDF certificacion |
| `backend/resources/views/pdf/carta_cancelacion.blade.php` | Vista PDF carta cancelacion |
| `backend/database/migrations/xxxx_create_credit_adjustments_table.php` | Tabla de auditoria de ajustes |
| `backend/database/migrations/xxxx_create_discount_requests_table.php` | Tabla de solicitudes de descuento |
| `backend/app/Models/CreditAdjustment.php` | Modelo de ajustes |
| `backend/app/Models/DiscountRequest.php` | Modelo de solicitudes de descuento |
| `backend/app/Http/Controllers/Api/DiscountRequestController.php` | CRUD + approve/reject |
| `backend/app/Http/Requests/RegularizarCreditRequest.php` | Validacion regularizacion |
| `backend/app/Http/Requests/MarcarAtrasoCreditRequest.php` | Validacion atraso manual |
| `backend/app/Http/Requests/StoreDiscountRequest.php` | Validacion solicitud descuento |

---

## Nuevas Rutas (todas protegidas con auth:sanctum)

```php
// PDFs / Documentos
GET  /api/credits/{id}/estado-de-cuenta-pdf
GET  /api/credits/{id}/certificacion-deuda-pdf
GET  /api/credits/{id}/carta-cancelacion-pdf

// Ajustes manuales
POST /api/credits/{id}/regularizar
POST /api/credits/{id}/marcar-atraso

// Solicitudes de descuento (flujo con aprobacion de gerencia)
POST  /api/discount-requests                    // Solicitar descuento
GET   /api/discount-requests?status=pendiente   // Listar pendientes (gerencia)
PATCH /api/discount-requests/{id}/approve       // Aprobar (solo gerencia/admin)
PATCH /api/discount-requests/{id}/reject        // Rechazar (solo gerencia/admin)

// Cancelacion con descuento aprobado (modificacion de endpoint existente)
POST /api/credit-payments/cancelacion-anticipada  (+ discount_request_id)
```

---

## Orden de Ejecucion Sugerido

| Prioridad | Tarea | Complejidad |
|-----------|-------|-------------|
| 1 | Estado de cuenta PDF (T1) | Media - Nuevo pero con patron existente |
| 2 | Certificacion de deuda PDF (T2) | Baja - Similar al anterior |
| 3 | Carta de cancelacion PDF (T3) | Baja - Similar al anterior |
| 4 | Poner cliente al dia / regularizar (T4) | Media-Alta - Nueva logica + migracion |
| 5 | Agregar atraso manual (T5) | Media - Reutiliza infraestructura de T4 |
| 6 | Descuentos en cancelacion total (T6) | Media-Alta - Flujo aprobacion + modificar logica |

---

## Verificacion

1. **PDFs:** Descargar cada PDF y validar contenido, formato y datos correctos
2. **Regularizar:** Tomar un credito en mora -> POST regularizar -> verificar que cuotas vuelven a 'Pendiente' y mora = 0
4. **Atraso manual:** Tomar cuota vigente -> POST marcar-atraso -> verificar estado 'Mora' y mora calculada
5. **Descuentos:** Calcular cancelacion anticipada con descuento -> verificar que saldo_final < saldo_original -> ejecutar cancelacion -> verificar credito cerrado
6. **Auditoria:** Verificar que cada ajuste manual queda registrado en `credit_adjustments`
