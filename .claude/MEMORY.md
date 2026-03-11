# Bitácora del Proyecto — CR Studio (Laravel + Next.js)

## Stack
- **Backend:** Laravel 12, PHP 8.2+, MySQL, Sanctum
- **Frontend:** Next.js (App Router), TypeScript
- **Idioma del usuario:** Español siempre

---

## Arquitectura General
- STI pattern: tabla `persons`, `person_type_id=1` = Lead, `person_type_id=2` = Client
- Opportunity: ID formato `YY-XXXXX-OP`
- Auth: Sanctum. Frontend baseURL = `http://localhost:8000` (sin `/api`), todas las rutas usan `/api/` prefix en axios.
- CI/CD: GitHub Actions → SSH → `git reset --hard` + `php artisan migrate --force` + `npm run build` + `pm2 restart`

---

## Módulos del sistema

| Módulo | Ruta frontend | Estado |
|--------|--------------|--------|
| CRM / Leads | `/dashboard/clientes` | ✅ |
| Créditos | `/dashboard/creditos` | ✅ |
| Cobros | `/dashboard/cobros` | ✅ |
| Analisis | `/dashboard/analisis` | ✅ |
| Oportunidades | `/dashboard/oportunidades` | ✅ |
| Configuración | `/dashboard/configuracion` | ✅ (96 líneas — refactorizado Mar 2026) |
| Auditoría General | `/dashboard/auditoria` | ✅ Mar 2026 |
| Auditoría Asientos ERP | `/dashboard/auditoria-asientos` | ✅ Mar 2026 |
| Inversiones | `/dashboard/inversiones` | ✅ |
| Rewards | `/dashboard/rewards` | ✅ |
| Tareas | `/dashboard/tareas` | ✅ |
| Reportes | `/dashboard/reportes` | ✅ Mar 2026 (5 tabs — Inversiones removido, tiene su propia sección) |

---

## Sistema de Permisos
- `Role::getFormattedPermissions()` en `backend/app/Models/Role.php`
- Módulos: `reportes, kpis, crm, oportunidades, analizados, creditos, calculos, cobros, cobro_judicial, ventas, inversiones, rutas, proyectos, comunicaciones, staff, entrenamiento, recompensas, configuracion, tareas, auditoria`
- `full_access=true` → acceso total automático
- Frontend: `canViewModule('modulo')` desde `PermissionsContext`
- **Flujo de permisos**: `/me` retorna `user` + `permissions` → `PermissionsContext` usa `/me` (NO `/users/{id}` ni `/roles/{id}` que requieren middleware admin)
- **Bug resuelto Mar 2026**: usuarios no-admin veían sidebar vacío porque PermissionsContext llamaba endpoints con middleware `admin` → fix: usar `/me`
- **Patrón crítico**: NUNCA mezclar `/api/users` (middleware admin) en `Promise.all` con otros endpoints — si falla uno, fallan todos. Siempre separar con try/catch propio.

---

## Archivos de detalle (en .claude/)
- `accounting.md` → Sistema de asientos contables completo
- `auditoria.md` → Sistema de auditoría general
- `mejoras.md` → Análisis de mejoras resueltas y pendientes

---

## Convenciones importantes
- Axios: siempre `/api/` prefix (ej: `api.get('/api/credits')`)
- PDF estado de cuenta: filtrar SOLO cuotas `'Pagado'` o `'Pagada'`
- Tasa de interés: leer de `/api/loan-configurations/activas`, NO hardcodear
- `LogsActivity` trait: usar en controllers CRUD sensibles

### Cómo usar LogsActivity en nuevo controller
```php
use App\Traits\LogsActivity;
class MiController extends Controller {
    use LogsActivity;
    public function update(Request $request, $id) {
        $model = MiModelo::findOrFail($id);
        $oldData = $model->toArray();
        $model->update($request->validated());
        $changes = $this->getChanges($oldData, $model->fresh()->toArray());
        $this->logActivity('update', 'MiMódulo', $model, $model->nombre, $changes, $request);
    }
}
```

---

## Integración Credid API
- **Endpoint:** `GET /api/credid/reporte?cedula=...` (auth:sanctum)
- **Backend:** `CredidService` (consultar API + extraer datos análisis) + `CredidController`
- **Config:** `services.credid` con `CREDID_API_URL` y `CREDID_API_TOKEN` en `.env`
- **Frontend:** Auto-consulta al crear análisis (wizard modal) + botón manual "Consultar Credid" en detalle de análisis
- **Datos auto-llenados:** cargo, nombramiento, manchas/juicios/embargos (conteo + detalles), PEP, score, refs comerciales
- **No auto-llena:** montos, plazo, cuota, ingreso neto exacto, deducciones, propuesta
- **Wizard reordenado (Mar 2026):** Paso 1=Historial Crediticio, Paso 2=Info Básica, Paso 3=Ingresos, Paso 4=Documentos
- **Estados juicios normalizados:** `En Trámite` / `Finalizado` (backend, frontend, validación, tipos)
- **Fix producción:** `$response->json()` puede retornar string en vez de array → se agregó `json_decode` fallback en `CredidService`

---

## Módulo Reportes — detalles (Mar 2026)

### Tabs activos: Cartera Activa | Cartera en Mora | Por Deductora | Novedades de Planilla | Cobros
- **Inversiones eliminado** del módulo Reportes — tiene su propia sección en `/dashboard/inversiones`
- **Breadcrumb fix**: segmento `dashboard` omitido en todos los breadcrumbs (`dashboard-header.tsx`). El ícono Home ya enlaza a `/dashboard`.
- **Backend ReporteController**: nuevos endpoints Mar 2026:
  - `GET /api/reportes/planilla-cobro/{id}` → JSON créditos activos de una deductora
  - `GET /api/reportes/planilla-cobro/{id}/pdf` → PDF planilla de cobro (Carlos → cooperativas)
  - `GET /api/reportes/novedades-planilla/pdf` → PDF de novedades (inclusiones/exclusiones/cambios cuota)
- **Novedades automáticas**: se cargan automáticamente al seleccionar cooperativa (sin botón "Consultar")
- **PDF Planilla de Cobro**: incluye nombre asociado, cédula, No. crédito, cuota a rebajar, saldo, estado + totales + espacio firmas
- **Status filter default**: incluye `['Activo', 'En Mora', 'Formalizado', 'Legal', 'En Progreso', 'Aprobado', 'Por firmar']` (excluye solo 'Cerrado')

---

## Deuda técnica pendiente (ver mejoras.md)

### 🔴 Alta
- (sin pendientes críticos)

### 🟡 Media
- ~~`CreditPaymentController` con 2,847 líneas~~ ✅ Resuelto — extraído en 7 Services (406 líneas el controller)

### 🟢 Baja
- 149 `as any` en TypeScript (bajó de 292)
- 64 `Log::` en backend (subió de 48)

---

## Preferencias del usuario
- Comunicarse siempre en **español**
- Commits y push: solo cuando el usuario lo pida explícitamente
- Si el push es rechazado: `git pull origin main --rebase` antes de reintentar
- **Siempre actualizar `.claude/MEMORY.md` y archivos de memoria del repo** al completar cada tarea
