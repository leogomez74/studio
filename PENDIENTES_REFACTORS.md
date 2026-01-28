# 📋 Pendientes y Refactors - Studio API

**Fecha de análisis:** 28 de enero 2026
**Analista:** Richard

---

## 📊 Resumen Trabajo Anterior (27 Enero 2026)

### Últimos Commits hasta 8pm

#### 1. **Sistema de Alertas de Inactividad** (Richard)
- **Commits:** `d9ba214`, `82013fb`, `b69ce42`
- **Implementado:**
  - Command `CheckLeadInactivity` (detecta >11 días inactivos)
  - Ciclo de 3 alertas (día 1, día 14, día 30)
  - Model `LeadAlert` con scopes
  - Controller + endpoints API
  - Frontend `/dashboard/notificaciones` completo
  - Webhook configurable
  - Protección con `auth:sanctum`
  - Exclusión de oportunidades "Ganadas" y "Perdidas"

#### 2. **Validación WhatsApp en Registro** (Richard)
- **Commits:** `e415297`, `d7e7c69`
- **Implementado:**
  - Verificación en tiempo real via Evolution API
  - Estados visuales (loading, valid, invalid)
  - Prevención de checks duplicados

#### 3. **Validaciones Cargos Adicionales** (Richard)
- **Commit:** `902e2ca`
- **Implementado:**
  - Validación monto_neto > 0
  - Recálculo automático de saldo
  - Inclusión en endpoint `/balance`

#### 4. **Fecha de Formalización** (Alberto)
- **Commit:** `10b2ffc`
- **Implementado:**
  - Campo `formalized_at` en credits
  - Registro automático al formalizar

#### 5. **Nuevas Instituciones** (Richard)
- **Commits:** `f79395d`, `a419f9c`, `744fdf7`
- **Implementado:**
  - 166+ instituciones educativas
  - Migraciones de limpieza de duplicados

---

## 🐛 BUGS IDENTIFICADOS

### 🔴 **CRÍTICO: Race Condition en CreditController**

**Ubicación:** `backend/app/Http/Controllers/Api/CreditController.php:426-435`

**Problema:**
```php
$credit->update($validated);  // 1️⃣ PRIMER GUARDADO

if (isset($validated['cargos_adicionales']) || isset($validated['monto_credito'])) {
    $credit->refresh();  // 2️⃣ RECARGAR DESDE DB
    $montoCredito = (float) $credit->monto_credito;
    $totalCargosActualizados = array_sum($credit->cargos_adicionales ?? []);
    $credit->saldo = $montoCredito - $totalCargosActualizados;
    $credit->save();  // 3️⃣ SEGUNDO GUARDADO
}
```

**Issues:**
1. **Operaciones no atómicas:** 2 escrituras separadas crean ventana de inconsistencia
2. **Race condition real:** Requests simultáneos pueden sobrescribirse
3. **Refresh innecesario:** Datos ya están en memoria después de `update()`

**Escenario de fallo:**
```
Request A: update(monto=2000) → saldo=1850 → save()
Request B: update(cargos=[200]) → saldo=1800 → save() ❌ SOBRESCRIBE
RESULTADO: Se pierde cambio de Request A
```

**Impacto:**
- ⚠️ Saldos incorrectos en créditos
- ⚠️ Inconsistencias en plan de pagos
- ⚠️ Reportes financieros erróneos

---

## ✅ SOLUCIONES PROPUESTAS

### 📦 **Solución 1: Transacción DB + Cálculo Atómico**

**Prioridad:** 🔴 P0 - CRÍTICO

```php
// backend/app/Http/Controllers/Api/CreditController.php

use Illuminate\Support\Facades\DB;

public function update(Request $request, $id)
{
    $validated = $this->validateUpdate($request);
    $credit = Credit::findOrFail($id);

    DB::transaction(function () use ($credit, $validated) {
        // Calcular saldo ANTES de guardar (en un solo update)
        if (isset($validated['cargos_adicionales']) || isset($validated['monto_credito'])) {
            $montoCredito = $validated['monto_credito'] ?? $credit->monto_credito;
            $cargos = $validated['cargos_adicionales'] ?? $credit->cargos_adicionales ?? [];

            $validated['saldo'] = $montoCredito - array_sum($cargos);
        }

        // UN SOLO guardado atómico
        $credit->update($validated);

        // Si se formalizó, generar plan
        if (/* formalizado logic */) {
            $this->generateAmortizationSchedule($credit);
        }
    });

    return response()->json($credit->fresh());
}
```

**Beneficios:**
- ✅ Una sola escritura (atómica)
- ✅ No hay ventana de inconsistencia
- ✅ Rollback automático si falla
- ✅ No requiere `refresh()`

**Esfuerzo:** 2 horas

---

### 🎯 **Solución 2: Observer para Cálculo Automático**

**Prioridad:** 🟡 P1 - ALTA

```php
// backend/app/Observers/CreditObserver.php

namespace App\Observers;

use App\Models\Credit;

class CreditObserver
{
    public function saving(Credit $credit): void
    {
        // Antes de guardar, recalcular saldo si cambió monto o cargos
        if ($credit->isDirty(['monto_credito', 'cargos_adicionales'])) {
            $credit->saldo = $credit->monto_credito - array_sum($credit->cargos_adicionales ?? []);
        }
    }
}

// backend/app/Providers/EventServiceProvider.php
use App\Models\Credit;
use App\Observers\CreditObserver;

public function boot(): void
{
    Credit::observe(CreditObserver::class);
}
```

**Beneficios:**
- ✅ Cálculo automático SIEMPRE
- ✅ DRY: lógica en un solo lugar
- ✅ Funciona con `create()`, `update()`, `save()`
- ✅ No hay que recordar calcular manualmente

**Esfuerzo:** 1 hora

---

### 🔒 **Solución 3: Sistema de Bloqueo de Procesamiento**

**Prioridad:** 🟡 P1 - ALTA

**Problema a resolver:**
- Múltiples usuarios editando el mismo crédito
- Operaciones largas (formalización, plan de pagos) sin feedback
- Posibilidad de corrupción de datos

**Propuesta:** Sistema híbrido de 3 capas

#### **Capa 1: Estado de Procesamiento (Backend)**

```php
// Migration: 2026_01_28_add_processing_status_to_credits.php

Schema::table('credits', function (Blueprint $table) {
    $table->string('processing_status')->default('idle')->after('status');
    // Estados: idle, formalizing, generating_plan, applying_payment, updating

    $table->timestamp('processing_started_at')->nullable();
    $table->unsignedBigInteger('processing_by_user_id')->nullable();

    $table->index(['processing_status', 'processing_started_at']);
});
```

#### **Capa 2: Métodos de Bloqueo en Model**

```php
// backend/app/Models/Credit.php

public const STATUS_IDLE = 'idle';
public const STATUS_FORMALIZING = 'formalizing';
public const STATUS_GENERATING_PLAN = 'generating_plan';
public const PROCESSING_TIMEOUT_MINUTES = 5;

public function isProcessing(): bool
{
    if ($this->processing_status === self::STATUS_IDLE) {
        return false;
    }

    // Auto-liberar si pasó el timeout (proceso zombi)
    if ($this->processing_started_at &&
        $this->processing_started_at->diffInMinutes(now()) > self::PROCESSING_TIMEOUT_MINUTES) {
        $this->releaseProcessing();
        return false;
    }

    return true;
}

public function acquireProcessingLock(string $status, ?int $userId = null): bool
{
    if ($this->isProcessing()) {
        return false;
    }

    return $this->update([
        'processing_status' => $status,
        'processing_started_at' => now(),
        'processing_by_user_id' => $userId,
    ]);
}

public function releaseProcessing(): bool
{
    return $this->update([
        'processing_status' => self::STATUS_IDLE,
        'processing_started_at' => null,
        'processing_by_user_id' => null,
    ]);
}
```

#### **Capa 3: Middleware de Protección**

```php
// backend/app/Http/Middleware/EnsureCreditNotProcessing.php

public function handle(Request $request, Closure $next)
{
    $creditId = $request->route('id') ?? $request->route('credit');
    $credit = Credit::find($creditId);

    if ($credit && $credit->isProcessing()) {
        return response()->json([
            'message' => 'Este crédito está siendo procesado por otro usuario.',
            'processing_status' => $credit->processing_status,
        ], 423); // 423 Locked
    }

    return $next($request);
}
```

#### **Uso en Controller**

```php
public function update(Request $request, $id)
{
    $credit = Credit::findOrFail($id);

    // Bloqueo optimista: verificar que no cambió
    if ($request->has('_updated_at')) {
        if ($credit->updated_at->toIso8601String() !== $request->input('_updated_at')) {
            return response()->json([
                'message' => 'Crédito modificado por otro usuario. Recarga la página.',
                'conflict' => true,
            ], 409); // 409 Conflict
        }
    }

    // Adquirir lock si va a formalizar
    $needsLock = isset($validated['status']) &&
                 strtolower($validated['status']) === 'formalizado';

    if ($needsLock) {
        if (!$credit->acquireProcessingLock(Credit::STATUS_FORMALIZING, Auth::id())) {
            return response()->json(['message' => 'Crédito en proceso.'], 423);
        }
    }

    try {
        DB::transaction(function () use ($credit, $validated) {
            // ... operaciones
        });

        return response()->json($credit->fresh());
    } finally {
        if ($needsLock) {
            $credit->releaseProcessing();
        }
    }
}
```

#### **Frontend: Feedback Visual**

```typescript
// src/app/dashboard/creditos/[id]/edit/page.tsx

const [isProcessing, setIsProcessing] = useState(false);

// Polling para verificar estado
useEffect(() => {
  if (!isProcessing) return;

  const interval = setInterval(async () => {
    const res = await api.get(`/api/credits/${creditId}`);
    if (res.data.processing_status === 'idle') {
      setIsProcessing(false);
      fetchCredit(); // Recargar datos
    }
  }, 2000);

  return () => clearInterval(interval);
}, [isProcessing]);

return (
  <form>
    {isProcessing && (
      <Alert>
        <Loader2 className="animate-spin" />
        Procesando... No cierres esta ventana.
      </Alert>
    )}

    <Button
      disabled={isProcessing || credit.processing_status !== 'idle'}
      onClick={handleFormalize}
    >
      {isProcessing ? 'Procesando...' : 'Formalizar'}
    </Button>
  </form>
);
```

**Beneficios:**
- ✅ Previene ediciones simultáneas
- ✅ Feedback claro al usuario
- ✅ Auto-recovery de procesos zombi
- ✅ Detecta conflictos antes de guardar

**Esfuerzo:** 6 horas

---

## 🔧 REFACTORS ADICIONALES

### 🔴 **P0 - Seguridad en Validación WhatsApp**

**Problema:** API key de Evolution expuesto en frontend

**Archivo:** `public/registro/index.html:534-541`

```javascript
// ❌ ACTUAL (INSEGURO)
const EVOLUTION_API_KEY = '7E269F8C445B-4D63-B75B-BB59D7481AC7';
```

**Solución:**
```php
// backend/app/Http/Controllers/Api/WhatsAppController.php

public function verifyNumber(Request $request): JsonResponse
{
    $validated = $request->validate([
        'phone' => 'required|string|min:7|max:15'
    ]);

    $phone = $validated['phone'];

    // Rate limiting por IP
    $key = 'whatsapp_verify:' . $request->ip();
    if (Cache::has($key) && Cache::get($key) > 10) {
        return response()->json(['error' => 'Demasiados intentos'], 429);
    }

    try {
        $response = Http::withHeaders([
            'apikey' => config('services.evolution.api_key')
        ])->post(config('services.evolution.url') . '/chat/whatsappNumbers/' .
                config('services.evolution.instance'), [
            'numbers' => [$phone]
        ]);

        $data = $response->json();
        $exists = $data[0]['exists'] ?? false;

        Cache::put($key, (Cache::get($key, 0) + 1), now()->addMinutes(1));

        return response()->json(['exists' => $exists]);

    } catch (\Exception $e) {
        Log::error('WhatsApp verification failed', ['error' => $e->getMessage()]);
        return response()->json(['error' => 'Servicio no disponible'], 503);
    }
}
```

**Frontend:**
```javascript
// public/registro/index.html
async function checkWhatsApp(fullNumber) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/verify-whatsapp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: fullNumber })
        });
        const data = await response.json();

        if (data.exists) {
            setWhatsappStatus('valid');
        } else {
            setWhatsappStatus('invalid');
        }
    } catch (error) {
        // Fallback: permitir continuar si el servicio falla
        setWhatsappStatus('none');
    }
}
```

**Esfuerzo:** 2 horas

---

### 🟡 **P1 - Tests para Sistema de Alertas**

**Archivos a testear:**
- `app/Console/Commands/CheckLeadInactivity.php`
- `app/Http/Controllers/Api/LeadAlertController.php`
- `app/Models/LeadAlert.php`

```php
// tests/Feature/LeadInactivityAlertTest.php

public function test_genera_primera_alerta_cuando_hay_leads_inactivos()
{
    // Arrange
    $lead = Lead::factory()->create([
        'updated_at' => now()->subDays(12)
    ]);

    // Act
    $this->artisan('leads:check-inactivity');

    // Assert
    $this->assertDatabaseHas('lead_alerts', [
        'alert_number' => 1,
        'alert_type' => LeadAlert::TYPE_INACTIVITY_WARNING,
    ]);
}

public function test_no_genera_segunda_alerta_antes_de_14_dias()
{
    // Arrange
    LeadAlert::factory()->create([
        'alert_number' => 1,
        'created_at' => now()->subDays(10)
    ]);

    // Act
    $this->artisan('leads:check-inactivity');

    // Assert
    $this->assertEquals(1, LeadAlert::count());
}

public function test_endpoint_count_retorna_alertas_no_leidas()
{
    LeadAlert::factory()->count(3)->create(['is_read' => false]);
    LeadAlert::factory()->count(2)->create(['is_read' => true]);

    $response = $this->getJson('/api/lead-alerts/count');

    $response->assertJson(['unread_count' => 3]);
}
```

**Esfuerzo:** 4 horas

---

### 🟡 **P1 - Índices de Performance**

```php
// Migration: 2026_01_28_add_indexes_for_performance.php

Schema::table('lead_alerts', function (Blueprint $table) {
    $table->index(['is_read', 'created_at']);
    $table->index('alert_number');
});

Schema::table('credits', function (Blueprint $table) {
    $table->index('status');
    $table->index('processing_status');
});

Schema::table('opportunities', function (Blueprint $table) {
    $table->index(['status', 'updated_at']);
});
```

**Esfuerzo:** 1 hora

---

### 🟢 **P2 - Debounce en Validación WhatsApp**

```javascript
// public/registro/index.html

let whatsappCheckTimeout = null;

document.getElementById('phone').addEventListener('input', function(e) {
    // Limpiar timeout anterior
    clearTimeout(whatsappCheckTimeout);

    // Reset estados visuales
    setWhatsappStatus('none');

    // Debounce de 500ms
    whatsappCheckTimeout = setTimeout(() => {
        const fullNumber = getFullPhoneNumber();
        if (fullNumber.length >= 7) {
            checkWhatsApp(fullNumber);
        }
    }, 500);
});
```

**Esfuerzo:** 30 minutos

---

### 🟢 **P2 - Seeders para Instituciones**

```php
// database/seeders/InstitucionSeeder.php

class InstitucionSeeder extends Seeder
{
    public function run(): void
    {
        $instituciones = [
            ['nombre' => 'Universidad de Costa Rica', 'tipo' => 'publica'],
            // ... 166+ instituciones
        ];

        foreach ($instituciones as $inst) {
            DB::table('instituciones')->updateOrInsert(
                ['nombre' => $inst['nombre']],
                $inst
            );
        }
    }
}
```

**Esfuerzo:** 2 horas

---

## 📊 Matriz de Prioridades

| Prioridad | Tarea | Impacto | Esfuerzo | Archivos Principales |
|-----------|-------|---------|----------|---------------------|
| 🔴 **P0** | Transacción DB (Race Condition) | Seguridad Datos | 2h | `CreditController.php:426` |
| 🔴 **P0** | Mover API Key WhatsApp a Backend | Seguridad | 2h | `public/registro/index.html` |
| 🟡 **P1** | Observer para Cálculo Saldo | Mantenibilidad | 1h | Nuevo: `CreditObserver.php` |
| 🟡 **P1** | Sistema de Bloqueo Procesamiento | UX + Integridad | 6h | `Credit.php`, `CreditController.php` |
| 🟡 **P1** | Tests Sistema Alertas | Estabilidad | 4h | `tests/Feature/` |
| 🟡 **P1** | Índices DB Performance | Performance | 1h | Nueva migration |
| 🟢 **P2** | Debounce WhatsApp | UX | 30min | `public/registro/index.html` |
| 🟢 **P2** | Seeders Instituciones | Mantenibilidad | 2h | Nuevo: `InstitucionSeeder.php` |

**Total estimado:** ~18.5 horas

---

## 🎯 Plan de Implementación Recomendado

### **Día 1 (4h) - Críticos de Seguridad**
1. ✅ Transacción DB para race condition (2h)
2. ✅ Mover API Key WhatsApp (2h)

### **Día 2 (4h) - Observer + Tests**
3. ✅ Observer CreditObserver (1h)
4. ✅ Tests sistema alertas (3h)

### **Día 3 (8h) - Sistema de Bloqueo**
5. ✅ Migration processing_status (30min)
6. ✅ Métodos en Credit model (1.5h)
7. ✅ Middleware (1h)
8. ✅ Refactor CreditController (2h)
9. ✅ Frontend feedback visual (2h)
10. ✅ Tests sistema bloqueo (1h)

### **Día 4 (2.5h) - Mejoras Menores**
11. ✅ Índices DB (1h)
12. ✅ Debounce WhatsApp (30min)
13. ✅ Seeders instituciones (1h)

---

## 📝 Notas Adicionales

### Comandos Útiles para Testing

```bash
# Ejecutar tests de alertas
php artisan test --filter LeadInactivityAlertTest

# Ejecutar command manualmente
php artisan leads:check-inactivity

# Ver logs de webhook
tail -f storage/logs/laravel.log | grep "webhook"

# Verificar índices creados
php artisan db:show --database=mysql
```

### Endpoints Afectados por Refactors

```
PATCH /api/credits/{id}           → Transacción + Bloqueo
POST  /api/credits/{id}/generate-plan → Bloqueo
POST  /api/verify-whatsapp        → Nuevo endpoint
GET   /api/lead-alerts            → Ya protegido
GET   /api/lead-alerts/count      → Ya protegido
```

---

## 🔗 Referencias

- **Race Condition:** `CreditController.php:426-435`
- **Sistema Alertas:** `CheckLeadInactivity.php:33-183`, `notificaciones/page.tsx:1-358`
- **WhatsApp Validation:** `public/registro/index.html:534-541`
- **Credit Model:** `backend/app/Models/Credit.php`

---

**Última actualización:** 28 enero 2026, 10:00 AM
**Próxima revisión:** Cuando se implemente cualquier P0/P1
