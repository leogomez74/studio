# QA de módulo de rutas

## Bugs encontrados (QA manual)

### Configurar Ruta (Tab Generar)
- No permite cambiar de orden las tareas seleccionadas para las rutas

### Rutas Activas
- ~~En el detalle de las rutas no se debe completar ni fallar una tarea~~ → Resuelto: botones completar/fallar eliminados, reemplazados por "Cancelar Ruta" global
- Iniciar ruta debe ser a través del mensajero, no el agente autorizado

## Tests automatizados (Playwright)

Script: `~/test_rutas_qa.py`
Ejecutar: `python3 ~/test_rutas_qa.py`

### Casos de prueba

| # | Test | Tab | Descripción |
|---|------|-----|-------------|
| 1 | Login | - | Login con admin@pep.cr, esperar redirect a /dashboard |
| 2 | Navegación | - | Ir a /dashboard/rutas, verificar 5 tabs visibles |
| 3 | Tabla pendientes | Pendientes | Verificar que la tabla muestra tareas |
| 4 | Filtro tipo | Pendientes | Filtrar por tipo "Entrega", resetear |
| 5 | Filtro prioridad | Pendientes | Filtrar por prioridad "Urgente", resetear |
| 6 | Crear tarea | Pendientes | Abrir dialog, llenar formulario, crear, verificar en tabla |
| 7 | Editar tarea | Pendientes | Editar título de tarea creada, guardar, verificar |
| 8 | Eliminar tarea | Pendientes | Eliminar tarea editada, verificar que desaparece |
| 9 | Cargar tab | Generar | Verificar que carga lista de tareas disponibles |
| 10 | Seleccionar tareas | Generar | Seleccionar todas con checkbox |
| 11 | Generar ruta | Generar | Configurar fecha/mensajero, generar, verificar redirect |
| 12 | Cargar tab | Activas | Verificar que carga lista de rutas |
| 13 | Seleccionar ruta | Activas | Click en ruta, ver detalle con tareas |
| 14 | Confirmar ruta | Activas | Confirmar ruta en borrador (si existe) |
| 15 | Cargar tab | Historial | Verificar que carga correctamente |
| 16 | Ver detalle | Historial | Click en ruta, ver detalle con tareas y estados |
| 17 | Cargar tab | Mi Ruta | Verificar header, progreso o mensaje "sin ruta" |
| 18 | Progreso | Mi Ruta | Verificar barra de progreso y contador |
| 19 | Completar tarea | Mi Ruta | Completar tarea con notas desde vista mensajero |
| 20 | Reportar fallo | Mi Ruta | Reportar tarea fallida con motivo desde vista mensajero |

### Notas de implementación
- Timeout de 10s entre cada redirección (login→dashboard→rutas→tabs)
- Auth persiste via localStorage, se usa navegación por URL con espera explícita
- Screenshots de fallos en `~/qa_screenshots/`
- Completar/Fallar tareas solo se prueba en tab Mi Ruta (vista mensajero), no en Rutas Activas
