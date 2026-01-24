# Changelog - Módulo de Análisis

## Resumen de Cambios (Enero 2026)

### Nuevas Funcionalidades

#### 1. Módulo de Deducciones
- **Ubicación**: `analisis/[id]/page.tsx`, `oportunidades/page.tsx`
- Agregados 7 tipos de deducciones al salario:
  - Comisión
  - Intereses
  - Respaldo deudor
  - Transporte
  - Comisión de Formalización Elastic 1
  - Descuento por factura
  - Intereses por adelantado
- Checklist con inputs de monto en el dialog "Nuevo Análisis"
- Visualización de deducciones en detalle de análisis
- Columna `deducciones` (JSON) agregada a tabla `analisis`

#### 2. Modo Edición en Análisis
- **Condición**: Se activa cuando `estado_pep === "Pendiente de cambios"`
- **Campos editables**:
  - Monto de crédito
  - Ingreso bruto
  - Ingreso neto
  - Propuesta
  - Deducciones (agregar/quitar/modificar montos)
- Indicador visual (banner amber) cuando está en modo edición
- Botón "Guardar Cambios" para persistir modificaciones

#### 3. Cálculo Automático de Ingreso Neto
- **Fórmula**: `Ingreso Neto = Ingreso Bruto - Total Deducciones`
- Se calcula automáticamente al modificar bruto o deducciones
- Permite override manual si el usuario edita directamente
- Botón "Recalcular automático" para restaurar el cálculo

---

### Optimizaciones

#### Seguridad
- Endpoints de análisis ahora requieren autenticación (`auth:sanctum`)
- Rutas protegidas: CRUD de análisis y manejo de archivos

#### Performance
- Nueva migración con índices en:
  - `opportunity_id`
  - `lead_id`
  - `estado_pep`

#### Validaciones Mejoradas (FormRequest)
- `StoreAnalisisRequest` - Validaciones para crear análisis
- `UpdateAnalisisRequest` - Validaciones para actualizar análisis
- Incluye:
  - `exists` para `lead_id` y `opportunity_id`
  - Límite `max:20` en deducciones
  - Límite `max:360` en plazo
  - Límite `max:999999999.99` en montos

#### Código Centralizado
- Nuevo archivo: `src/lib/analisis.ts`
- Contiene:
  - `DEDUCCIONES_TIPOS` - Constante con tipos de deducciones
  - Interfaces: `DeduccionItem`, `EditableDeduccion`, `AnalisisItem`, `AnalisisFile`
  - Funciones: `formatCurrency()`, `formatFileSize()`
  - Helpers: `initializeEditableDeducciones()`, `getActiveDeduccionesTotal()`, `filterActiveDeduccionesForSave()`

#### Autenticación
- Corregido axios para enviar Bearer token en todas las requests
- Interceptor lee token de cookies y agrega header `Authorization`

---

### Archivos Modificados

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `backend/app/Http/Controllers/Api/AnalisisController.php` | Modificado | Usa FormRequest |
| `backend/app/Http/Requests/StoreAnalisisRequest.php` | Nuevo | Validaciones crear |
| `backend/app/Http/Requests/UpdateAnalisisRequest.php` | Nuevo | Validaciones actualizar |
| `backend/app/Models/Analisis.php` | Modificado | Campo deducciones |
| `backend/database/migrations/*_add_deducciones_*.php` | Nuevo | Columna JSON |
| `backend/database/migrations/*_add_indexes_*.php` | Nuevo | Índices BD |
| `backend/routes/api.php` | Modificado | Auth en analisis |
| `src/app/dashboard/analisis/[id]/page.tsx` | Modificado | Modo edición + deducciones |
| `src/app/dashboard/oportunidades/page.tsx` | Modificado | Deducciones en dialog |
| `src/lib/analisis.ts` | Nuevo | Tipos y constantes |
| `src/lib/axios.ts` | Modificado | Bearer token |

---

### Migraciones Pendientes

Ejecutar en deploy:
```bash
php artisan migrate
```

Esto creará:
1. Columna `deducciones` (JSON) en tabla `analisis`
2. Índices en `opportunity_id`, `lead_id`, `estado_pep`

---

### Commits

```
b424d37 fix: agregar Bearer token a requests de axios
55f4dee feat: optimizaciones módulo análisis
66478b4 feat: ingreso neto auto-calculado (bruto - deducciones)
412d0c8 feat: deducciones editables en modo Pendiente de cambios
40204d3 feat: modo edición en análisis cuando estado_pep es Pendiente de cambios
2103dda fix: reducir tamaño dialog Nuevo Análisis
7e55db3 feat: agregar módulo de deducciones a análisis
```
