# Skill: Actualizar documentación contable

## Trigger
Invocable por el usuario con `/update-accounting-docs` después de hacer cambios al módulo contable.

## Instrucciones

Actualiza **ambos** archivos de documentación contable del proyecto para reflejar los cambios realizados en la sesión actual.

### Paso 1: Identificar cambios

Revisa los archivos modificados en la sesión o los cambios uncommitted (`git diff` y `git diff --cached`) buscando cambios en:

- `backend/app/Traits/AccountingTrigger.php` — lógica de asientos, componentes, resolución de cuentas
- `backend/app/Http/Controllers/Api/CreditPaymentController.php` — breakdowns de pagos, reversos, cancelaciones
- `backend/app/Http/Controllers/Api/CreditController.php` — breakdowns de refundición, formalización
- `backend/app/Http/Controllers/Api/AccountingEntryConfigController.php` — validación de componentes
- `backend/config/accounting.php` — feature flags de asientos
- `backend/.env` — variables de flags contables
- `src/app/dashboard/configuracion/page.tsx` — opciones del UI de configuración contable

### Paso 2: Actualizar MEMORY.md

Archivo: `/home/rrichard/trabajo/studio/.claude/MEMORY.md`

Actualiza las secciones relevantes:

1. **"Sistema de Asientos Contables"**: Si hay cambios en la lógica general, tipos de cuenta, o flujo de triggers
2. **"Todos los tipos de asiento en config/accounting.php"**: Si se agregó o modificó un tipo de asiento, actualizar la tabla
3. **"amount_component disponibles"**: Si se agregó o cambió un componente de monto
4. **Sección cronológica**: Agregar un bloque con la fecha del día describiendo los cambios hechos, siguiendo el formato existente (ej: "#### Fecha — Descripción")

Reglas:
- Mantener el archivo bajo 200 líneas (se trunca después)
- Si se acerca al límite, comprimir las secciones cronológicas más antiguas
- No duplicar información que ya existe
- Ser conciso pero preciso

### Paso 3: Actualizar Manual del Sistema Contable

Archivo: `/home/rrichard/trabajo/studio/MANUAL_SISTEMA_CONTABLE_CONFIGURABLE.md`

Actualizar las secciones correspondientes:

1. **Variables .env**: Si se agregó un nuevo flag, agregarlo a la lista con su descripción
2. **Tipos de Asientos y Sus Configuraciones Típicas**: Actualizar o agregar la tabla de líneas del asiento modificado/nuevo, incluyendo:
   - Cuándo se dispara
   - Variable .env asociada
   - Tabla con: Línea | Tipo Cuenta | Cuenta | Movimiento | Componente
   - Notas sobre comportamiento especial (omisión de líneas en 0, cascadas, etc.)
3. **Componentes de Monto Disponibles**: Si se agregó un nuevo componente
4. **Glosario**: Si se introdujo un concepto nuevo
5. **Changelog al final**: Agregar entrada con versión incrementada describiendo los cambios

Reglas:
- Seguir el formato de tablas markdown existente
- Incluir el tipo de cuenta (Fija, Deductora, Deductora o Fija) cuando aplique
- Documentar la fórmula de cálculo cuando haya lógica de negocio (ej: prorrateo de interés, penalización)
- Especificar qué líneas se omiten automáticamente cuando su componente es 0

### Paso 4: Confirmar

Mostrar un resumen de los cambios aplicados a cada archivo.
