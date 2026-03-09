# Reglas del Proyecto — CR Studio

## Regla obligatoria: Actualizar memoria después de CADA cambio

Después de completar cualquier tarea (fix, feature, refactor, configuración, etc.), SIEMPRE:

1. Actualizar `.claude/MEMORY.md` con los cambios relevantes (bugs resueltos, decisiones arquitectónicas, patrones nuevos)
2. Actualizar `.claude/mejoras.md` si se resolvió o agregó un pendiente
3. Actualizar otros archivos de `.claude/` si aplican (auditoria.md, accounting.md)
4. Incluir los archivos de memoria en el commit si hubo cambios

**No esperar a que el usuario lo pida.** Hacerlo automáticamente como parte de cada tarea.

## Idioma

Comunicarse siempre en **español**.

## Commits y push

- Solo hacer commit/push cuando el usuario lo pida explícitamente
- Si el push es rechazado: `git pull origin main --rebase` antes de reintentar

## Convenciones del código

- Backend: Laravel 12, PHP 8.2+, MySQL, Sanctum
- Frontend: Next.js (App Router), TypeScript
- Axios: siempre con prefijo `/api/` (ej: `api.get('/api/credits')`)
- `LogsActivity` trait: usar en controllers CRUD sensibles
- `/api/users` y `/api/roles` tienen middleware `admin` — NUNCA mezclar en `Promise.all` con endpoints que deben funcionar para todos los usuarios

## Archivos de memoria

- `.claude/MEMORY.md` → Bitácora general del proyecto
- `.claude/mejoras.md` → Mejoras resueltas y pendientes
- `.claude/auditoria.md` → Sistema de auditoría
- `.claude/accounting.md` → Sistema contable ERP
