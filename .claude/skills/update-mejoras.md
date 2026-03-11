# Skill: Actualizar mejoras.md

## Trigger
Se ejecuta automáticamente después de cada tarea completada (fix, feature, refactor, configuración). No requiere invocación manual.

## Instrucciones

Después de completar cualquier cambio en el proyecto, actualiza el archivo `.claude/mejoras.md` para reflejar el estado actual.

### Paso 1: Leer el archivo actual

Lee `/home/rrichard/trabajo/studio/.claude/mejoras.md` completo para entender la estructura y contenido existente.

### Paso 2: Determinar los cambios

Revisa qué se hizo en la sesión actual:
- Si se resolvió un pendiente listado en mejoras.md, moverlo a la sección de resueltos con la fecha
- Si se agregó una mejora nueva o se identificó un pendiente, agregarlo a la sección correspondiente
- Si se hizo un refactor, documentar el antes/después brevemente

### Paso 3: Sobreescribir el archivo

**SIEMPRE usar la herramienta Write** para sobreescribir `.claude/mejoras.md` con el contenido actualizado completo. No usar Edit — usar Write para garantizar que el archivo refleje el estado actual sin residuos.

### Reglas

- Mantener el formato markdown existente (secciones, listas, fechas)
- Ser conciso: una línea por mejora/pendiente
- Incluir fecha en formato `YYYY-MM-DD` para items resueltos
- No duplicar entries que ya existen
- Ordenar pendientes por prioridad (crítico > alto > medio > bajo)
- Si el archivo supera 150 líneas, comprimir secciones antiguas
