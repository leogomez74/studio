# 📖 Manual de Configuración del Sistema Contable Configurable

## 🎯 ¿Qué son las Banderas de Funcionalidad?

Las **banderas de funcionalidad** (feature flags) son interruptores que te permiten activar o desactivar funcionalidades del sistema **sin necesidad de cambiar código ni hacer deploy**. Solo modificas una variable de entorno en el archivo `.env`.

### ¿Por qué las usamos aquí?

El sistema contable tiene dos "versiones":
- **Legacy (viejo)**: Código hardcodeado que funciona actualmente
- **Configurable (nuevo)**: Sistema flexible que acabamos de implementar

Las banderas te permiten **migrar gradualmente** sin riesgo:
1. Probar el nuevo sistema en un tipo de asiento primero
2. Si funciona bien, activar más tipos
3. Si algo falla, desactivar inmediatamente sin tocar código

---

## 🔧 Tipos de Control Disponibles

### 1. **Control Global** (todo o nada)
```bash
ACCOUNTING_USE_CONFIGURABLE=true
```
- Activa el sistema configurable para **TODOS** los tipos de asiento
- **Recomendado SOLO** cuando ya probaste todo individualmente
- Si está en `false`, todo usa el sistema legacy

### 2. **Control Individual** (migración gradual) ⭐ RECOMENDADO
```bash
ACCOUNTING_CONFIGURABLE_VENTANILLA=true
ACCOUNTING_CONFIGURABLE_PLANILLA=false
ACCOUNTING_CONFIGURABLE_FORMALIZACION=false
# ... etc
```
- Activa el sistema configurable solo para los tipos específicos que configures
- El resto sigue usando legacy
- **Ideal para migración segura paso a paso**

---

## 📝 Variables Disponibles en .env

Aquí están **todas** las variables que puedes configurar:

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
```

---

## 🚀 Estrategia de Migración Recomendada

### **Fase 1: Preparación** (Semana 1)

#### Paso 1.1: Configurar Cuentas de Deductoras
1. Ir a `/dashboard/configuracion`
2. En la sección **"Mapeo de Deductoras a Cuentas Contables"**:
   - Para cada deductora, asignar su código de cuenta contable
   - Ejemplo: BNCR → `2-300`, Scotiabank → `2-305`
3. Guardar cambios

#### Paso 1.2: Crear Configuración de Asiento de Prueba
1. En la sección **"Configuración de Asientos Contables"**
2. Crear una configuración para `PAGO_VENTANILLA`:
   ```
   Nombre: Pago de Ventanilla
   Tipo: PAGO_VENTANILLA
   Activo: ✓

   Línea 1:
   - Tipo de Cuenta: Fija
   - Cuenta: banco_credipepe
   - Movimiento: Débito
   - Componente: Monto Total
   - Descripción: Cobro ventanilla - {credit_id}

   Línea 2:
   - Tipo de Cuenta: Fija
   - Cuenta: cuentas_por_cobrar
   - Movimiento: Crédito
   - Componente: Monto Total
   - Descripción: Reducción CxC - {credit_id}
   ```

#### Paso 1.3: Probar con Preview
1. Hacer clic en el botón de **Vista Previa** de la configuración
2. Ingresar un monto de prueba: `50000`
3. Verificar que:
   - Suma de débitos = Suma de créditos ✓
   - Cuentas correctas
   - Descripciones se ven bien

---

### **Fase 2: Prueba en Desarrollo/Staging** (Semana 2)

#### Paso 2.1: Activar Solo Ventanilla
En tu archivo `.env` de desarrollo:
```bash
ACCOUNTING_USE_CONFIGURABLE=false
ACCOUNTING_CONFIGURABLE_VENTANILLA=true
```

Luego ejecutar:
```bash
php artisan config:cache
```

#### Paso 2.2: Realizar Prueba Real
1. Procesar un pago de ventanilla real
2. Verificar en logs (`storage/logs/laravel.log`):
   ```
   ACCOUNTING_API_TRIGGER: Usando sistema configurable
   ```
3. Verificar en el ERP externo que el asiento se creó correctamente
4. Comparar con asiento legacy (debe ser idéntico)

#### Paso 2.3: Si Hay Problemas
Desactivar inmediatamente:
```bash
ACCOUNTING_CONFIGURABLE_VENTANILLA=false
```
```bash
php artisan config:cache
```
El sistema volverá a usar legacy automáticamente.

---

### **Fase 3: Producción Gradual** (Semanas 3-6)

#### Semana 3: Solo Ventanilla
```bash
ACCOUNTING_CONFIGURABLE_VENTANILLA=true
```
- Monitorear 1 semana completa
- Verificar todos los pagos de ventanilla
- Si todo está OK → siguiente fase

#### Semana 4: Agregar Planilla
```bash
ACCOUNTING_CONFIGURABLE_VENTANILLA=true
ACCOUNTING_CONFIGURABLE_PLANILLA=true
```
- Importante: Ya debes tener configuradas las cuentas de deductoras
- Monitorear pagos de planilla
- Verificar que cada deductora use su cuenta correcta

#### Semana 5: Agregar Formalización y Extraordinarios
```bash
ACCOUNTING_CONFIGURABLE_VENTANILLA=true
ACCOUNTING_CONFIGURABLE_PLANILLA=true
ACCOUNTING_CONFIGURABLE_FORMALIZACION=true
ACCOUNTING_CONFIGURABLE_EXTRAORDINARIO=true
```

#### Semana 6: Completar Migración
```bash
ACCOUNTING_CONFIGURABLE_VENTANILLA=true
ACCOUNTING_CONFIGURABLE_PLANILLA=true
ACCOUNTING_CONFIGURABLE_FORMALIZACION=true
ACCOUNTING_CONFIGURABLE_EXTRAORDINARIO=true
ACCOUNTING_CONFIGURABLE_CANCELACION=true
ACCOUNTING_CONFIGURABLE_REFUND_CIERRE=true
ACCOUNTING_CONFIGURABLE_REFUND_NUEVO=true
ACCOUNTING_CONFIGURABLE_DEVOLUCION=true
```

---

## 🔍 Monitoreo y Verificación

### 1. Revisar Logs
```bash
tail -f storage/logs/laravel.log | grep ACCOUNTING
```

Debes ver:
```
✓ "Usando sistema configurable para PAGO_VENTANILLA"
✓ "Asiento enviado exitosamente al ERP"
```

Si ves:
```
⚠️ "Usando método legacy (sin plantilla)"
⚠️ "No hay configuración activa"
```
Significa que no encontró configuración y usó legacy (esperado si no has creado la config).

### 2. Verificar en Base de Datos
```sql
-- Ver configuraciones activas
SELECT entry_type, name, active
FROM accounting_entry_configs
WHERE active = 1;

-- Ver deductoras con cuenta configurada
SELECT nombre, account_code
FROM deductoras
WHERE account_code IS NOT NULL;
```

### 3. Comparar Asientos
1. Procesar mismo tipo de operación antes y después
2. Comparar los asientos en el ERP
3. Deben ser **idénticos** en:
   - Cuentas usadas
   - Montos débito/crédito
   - Descripciones (excepto variables que mejoran)

---

## 🆘 Plan de Rollback (Si algo sale mal)

### Rollback Inmediato (< 1 minuto)
```bash
# Desactivar TODO inmediatamente
ACCOUNTING_USE_CONFIGURABLE=false
```
```bash
php artisan config:cache
```
✓ Sistema vuelve a legacy instantáneamente

### Rollback Parcial
```bash
# Desactivar solo el tipo problemático
ACCOUNTING_CONFIGURABLE_PLANILLA=false
# Los demás siguen funcionando
```
```bash
php artisan config:cache
```

---

## 💡 Ejemplos de Configuración por Escenario

### Escenario 1: Quiero probar solo en desarrollo
```bash
# .env.development
ACCOUNTING_USE_CONFIGURABLE=false
ACCOUNTING_CONFIGURABLE_VENTANILLA=true
```

### Escenario 2: Producción con un solo tipo activado
```bash
# .env.production
ACCOUNTING_USE_CONFIGURABLE=false
ACCOUNTING_CONFIGURABLE_VENTANILLA=true
```

### Escenario 3: Producción con todo activado (meta final)
```bash
# .env.production
ACCOUNTING_USE_CONFIGURABLE=true
# Ya no necesitas las individuales si usas global=true
```

---

## ⚙️ Comandos Útiles

```bash
# Ver configuración actual en caché
php artisan config:show accounting

# Limpiar caché de configuración
php artisan config:clear

# Aplicar nueva configuración
php artisan config:cache

# Ver logs en tiempo real
tail -f storage/logs/laravel.log

# Ver solo logs de contabilidad
tail -f storage/logs/laravel.log | grep ACCOUNTING
```

---

## ✅ Checklist Pre-Producción

Antes de activar en producción, verifica:

- [ ] Todas las deductoras tienen `account_code` configurado
- [ ] Creaste al menos una configuración de asiento de cada tipo
- [ ] Probaste preview de cada configuración
- [ ] Probaste en staging/desarrollo primero
- [ ] Comparaste asientos legacy vs configurable (deben ser iguales)
- [ ] Equipo sabe cómo hacer rollback rápido
- [ ] Tienes monitoreo de logs activo
- [ ] Backup de base de datos reciente

---

## 📞 Soporte y Troubleshooting

### "No se está usando el sistema configurable"
**Causa**: No hay configuración activa para ese tipo
**Solución**: Crear configuración en `/dashboard/configuracion` y activarla

### "Asiento desbalanceado"
**Causa**: Suma débitos ≠ Suma créditos
**Solución**: Usar preview para verificar configuración antes de activar

### "Cuenta de deductora no encontrada"
**Causa**: Deductora sin `account_code` configurado
**Solución**: Ir a mapeo de deductoras y asignar código de cuenta

### "Config cache no actualiza"
**Causa**: Caché de configuración no se limpió
**Solución**:
```bash
php artisan config:clear
php artisan config:cache
```

### "Variables no disponibles en descripción"
**Causa**: Usando variable no soportada
**Solución**: Variables disponibles:
- `{reference}` - Referencia del pago/crédito
- `{credit_id}` - ID del crédito
- `{cedula}` - Cédula del cliente
- `{clienteNombre}` - Nombre del cliente
- `{deductora_nombre}` - Nombre de deductora (solo en planilla)

---

## 📊 Tipos de Asientos y Sus Configuraciones Típicas

### FORMALIZACION
**Cuándo se dispara**: Al aprobar un crédito
**Estructura típica**:
- Línea 1: Cuentas por Cobrar (Débito) - Total
- Línea 2: Banco CREDIPEPE (Crédito) - Total

### PAGO_VENTANILLA
**Cuándo se dispara**: Pago directo en oficina
**Estructura típica**:
- Línea 1: Banco CREDIPEPE (Débito) - Total
- Línea 2: Cuentas por Cobrar (Crédito) - Total

### PAGO_PLANILLA
**Cuándo se dispara**: Deducción de nómina procesada
**Estructura típica**:
- Línea 1: Cuenta Deductora (Débito) - Total [Cuenta dinámica]
- Línea 2: Cuentas por Cobrar (Crédito) - Total

**Importante**: Requiere `account_code` configurado en cada deductora

### ABONO_EXTRAORDINARIO
**Cuándo se dispara**: Pago fuera de cuota con posible penalización
**Estructura típica**:
- Línea 1: Banco CREDIPEPE (Débito) - Total
- Línea 2: Cuentas por Cobrar (Crédito) - Capital
- Línea 3: Ingreso Penalización (Crédito) - Cargo Adicional: penalizacion [Solo si penalizacion > 0]

### CANCELACION_ANTICIPADA
**Cuándo se dispara**: Cliente paga todo el crédito antes de plazo
**Estructura típica**:
- Línea 1: Banco CREDIPEPE (Débito) - Total
- Línea 2: Cuentas por Cobrar (Crédito) - Capital + Interés Corriente
- Línea 3: Ingreso Penalización (Crédito) - Cargo Adicional: penalizacion [Solo si penalizacion > 0]

### REFUNDICION_CIERRE
**Cuándo se dispara**: Al cerrar crédito viejo en refundición
**Estructura típica**:
- Línea 1: Banco CREDIPEPE (Débito) - Total
- Línea 2: Cuentas por Cobrar (Crédito) - Total

### REFUNDICION_NUEVO
**Cuándo se dispara**: Al abrir crédito nuevo en refundición
**Estructura típica**:
- Línea 1: Cuentas por Cobrar (Débito) - Total
- Línea 2: Banco CREDIPEPE (Crédito) - Total

### REVERSO_PAGO / REVERSO_EXTRAORDINARIO / REVERSO_CANCELACION
**Cuándo se dispara**: Al anular un pago existente
**Estructura típica**:
- Línea 1: Cuentas por Cobrar (Débito) - Total
- Línea 2: Banco CREDIPEPE (Crédito) - Total

### ABONO_CAPITAL
**Cuándo se dispara**: Al aplicar saldo pendiente a capital
**Estructura típica**:
- Línea 1: Banco CREDIPEPE (Débito) - Total
- Línea 2: Cuentas por Cobrar (Crédito) - Total

### REINTEGRO_SALDO
**Cuándo se dispara**: Al devolver saldo no aplicado
**Estructura típica**:
- Línea 1: Cuentas por Cobrar (Débito) - Total
- Línea 2: Banco CREDIPEPE (Crédito) - Total

### ANULACION_PLANILLA
**Cuándo se dispara**: Al anular planilla completa
**Estructura típica**:
- Línea 1: Cuentas por Cobrar (Débito) - Total
- Línea 2: Cuenta Deductora (Crédito) - Total [Cuenta dinámica]

---

## 🎓 Glosario de Términos

**Feature Flag / Bandera de Funcionalidad**: Interruptor de configuración que activa/desactiva funcionalidades

**Legacy**: Sistema antiguo hardcodeado que funciona actualmente

**Configurable**: Nuevo sistema flexible que se configura desde UI

**Rollback**: Volver atrás a la versión anterior del sistema

**Preview**: Vista previa de cómo se vería un asiento antes de activarlo

**Entry Type**: Tipo de asiento contable (FORMALIZACION, PAGO_VENTANILLA, etc.)

**Amount Breakdown**: Desglose del monto total en componentes (interés, capital, etc.)

**Account Type**: Tipo de cuenta (Fija, Deductora, Variable)

**Movement Type**: Tipo de movimiento contable (Débito, Crédito)

**Amount Component**: Componente del monto (Total, Interés Corriente, Capital, etc.)

**Cargo Adicional**: Cargo extra específico (penalización, trámite, etc.)

---

## 📅 Cronograma Sugerido de Implementación

### Semana 1: Preparación
- [ ] Lunes: Configurar cuentas de deductoras
- [ ] Martes: Crear configuración PAGO_VENTANILLA
- [ ] Miércoles: Probar preview y ajustar
- [ ] Jueves: Crear configuración PAGO_PLANILLA
- [ ] Viernes: Crear resto de configuraciones

### Semana 2: Desarrollo/Staging
- [ ] Lunes: Activar VENTANILLA en dev (.env)
- [ ] Martes-Miércoles: Pruebas exhaustivas
- [ ] Jueves: Comparar asientos con legacy
- [ ] Viernes: Ajustes finales

### Semana 3: Producción Piloto
- [ ] Lunes: Activar VENTANILLA en producción
- [ ] Martes-Viernes: Monitoreo intensivo

### Semana 4: Expansión
- [ ] Lunes: Activar PLANILLA
- [ ] Martes-Viernes: Monitoreo

### Semana 5: Más Tipos
- [ ] Lunes: Activar FORMALIZACION + EXTRAORDINARIO
- [ ] Martes-Viernes: Monitoreo

### Semana 6: Completar
- [ ] Lunes: Activar tipos restantes
- [ ] Martes-Jueves: Monitoreo
- [ ] Viernes: Revisión final y documentación

---

## 🔐 Consideraciones de Seguridad

1. **Backup antes de cambios**: Siempre hacer backup de BD antes de activar en producción
2. **Pruebas en staging**: Nunca activar directo en producción sin pruebas
3. **Rollback preparado**: Tener plan y comandos listos para revertir
4. **Monitoreo activo**: Primera semana con monitoreo constante
5. **Documentar cambios**: Llevar bitácora de qué se activó y cuándo

---

## 📈 Métricas de Éxito

Para saber que la migración fue exitosa:

✅ **0 errores críticos** en logs después de 1 semana
✅ **100% de asientos balanceados** (débitos = créditos)
✅ **Contadores en ERP** coinciden con sistema antiguo
✅ **Tiempo de respuesta** similar o mejor que legacy
✅ **Equipo contable** valida que asientos son correctos

---

## 🎯 Contactos y Soporte

**Desarrollador responsable**: [Tu Nombre/Email]
**Equipo contable**: [Contacto del área contable]
**Soporte técnico**: [Contacto de soporte]

**Horarios de soporte durante migración**:
- Lunes a Viernes: 8am - 6pm
- Emergencias: [Número de emergencia]

---

**Última actualización**: 2026-02-16
**Versión del manual**: 1.0
**Sistema**: Studio - Módulo Contable Configurable
