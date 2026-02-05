# Toast System - Guía de Uso

## Importación

```typescript
import { toastSuccess, toastError, toastWarning, toastInfo } from '@/hooks/use-toast';
```

## Uso Básico

### Éxito (Success) - 3 segundos
```typescript
toastSuccess("Guardado", "La oportunidad fue creada correctamente");
```

### Error - 8 segundos
```typescript
toastError("Error", "No se pudo conectar con el servidor");
```

### Advertencia (Warning) - 6 segundos
```typescript
toastWarning("Atención", "Algunos campos están incompletos");
```

### Información (Info) - 4 segundos
```typescript
toastInfo("Actualización", "Hay una nueva versión disponible");
```

## Con Acciones (Botones)

### Reintentar después de error
```typescript
toastError("Error de conexión", "No se pudo guardar el documento", {
  action: {
    label: "Reintentar",
    onClick: () => handleSave()
  }
});
```

### Deshacer eliminación
```typescript
toastSuccess("Eliminado", "3 oportunidades eliminadas", {
  action: {
    label: "Deshacer",
    onClick: () => handleUndo()
  }
});
```

### Ver detalles (Bulk operations)
```typescript
toastWarning(
  "Operación parcial",
  `${successful} exitosas, ${failed} fallidas`,
  {
    action: {
      label: "Ver detalles",
      onClick: () => setShowErrorModal(true)
    }
  }
);
```

## Duraciones Personalizadas

```typescript
// Toast que se queda 10 segundos
toastError("Error crítico", "Revisa los logs del sistema", {
  duration: 10000
});

// Toast rápido (2 segundos)
toastSuccess("Copiado", "Texto copiado al portapapeles", {
  duration: 2000
});
```

## Ejemplos por Caso de Uso

### CRUD Operations

#### Crear
```typescript
try {
  await createOpportunity(data);
  toastSuccess("Creado", "Oportunidad creada correctamente");
} catch (error) {
  toastError("Error", "No se pudo crear la oportunidad", {
    action: { label: "Reintentar", onClick: () => handleCreate() }
  });
}
```

#### Actualizar
```typescript
try {
  await updateOpportunity(id, data);
  toastSuccess("Actualizado", "Los cambios fueron guardados");
} catch (error) {
  toastError("Error al guardar", error.message);
}
```

#### Eliminar
```typescript
const handleDelete = async () => {
  try {
    await deleteOpportunity(id);
    toastSuccess("Eliminado", "Oportunidad eliminada correctamente", {
      action: {
        label: "Deshacer",
        onClick: () => handleRestore(id)
      }
    });
  } catch (error) {
    toastError("Error", "No se pudo eliminar la oportunidad");
  }
};
```

### Validaciones

```typescript
if (!formData.nombre) {
  toastWarning("Campo requerido", "El nombre es obligatorio");
  return;
}

if (formData.monto < minAmount) {
  toastWarning(
    "Monto inválido",
    `El monto mínimo es ₡${minAmount.toLocaleString()}`
  );
  return;
}
```

### Operaciones Asíncronas

```typescript
toastInfo("Procesando", "Generando el reporte...");

try {
  const result = await generateReport();
  toastSuccess("Completado", "El reporte está listo", {
    action: {
      label: "Descargar",
      onClick: () => downloadReport(result.url)
    }
  });
} catch (error) {
  toastError("Error", "No se pudo generar el reporte", {
    action: { label: "Reintentar", onClick: () => generateReport() }
  });
}
```

### Copiar al Portapapeles

```typescript
const handleCopy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toastSuccess("Copiado", "Texto copiado al portapapeles", {
      duration: 2000
    });
  } catch (error) {
    toastError("Error", "No se pudo copiar al portapapeles");
  }
};
```

## Configuración Actual

- **TOAST_LIMIT**: 1 (solo un toast visible a la vez)
- **TOAST_REMOVE_DELAY**: 5000ms (5 segundos por defecto)

### Duraciones por Tipo

| Tipo | Duración | Uso |
|------|----------|-----|
| Success | 3s | Confirmaciones de éxito |
| Info | 4s | Información general |
| Warning | 6s | Advertencias que requieren atención |
| Error | 8s | Errores que el usuario debe leer |

## Características

✅ **Íconos automáticos**: Cada tipo tiene su ícono visual
✅ **Duraciones inteligentes**: Auto-dismiss según importancia
✅ **Acciones interactivas**: Botones de undo, retry, ver detalles
✅ **Colores semánticos**: Verde (success), rojo (error), amarillo (warning), azul (info)
✅ **Auto-dismiss**: Se cierran automáticamente según duración
✅ **Botón cerrar**: Siempre disponible para cerrar manualmente

## Migración desde Toast Antiguo

### Antes
```typescript
toast({
  title: "Error",
  description: "No se pudo cargar",
  variant: "destructive"
});
```

### Después
```typescript
toastError("Error", "No se pudo cargar");
```

### Antes (con éxito)
```typescript
toast({
  title: "Guardado",
  description: "Documento guardado correctamente"
});
```

### Después
```typescript
toastSuccess("Guardado", "Documento guardado correctamente");
```