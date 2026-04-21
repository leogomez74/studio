# Auto-Assignment by Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Assign leads, clients, opportunities and credits automatically to the responsible agent based on module, with round-robin for shared modules and a manual reassign button.

**Architecture:** A `module_assignments` pivot table maps modules → users. An `AssignmentService` resolves the next assignee (least-loaded round-robin when multiple users share a module). Controllers call the service on `store()`. Frontend gets a reusable `ReassignButton` component added to detail pages.

**Tech Stack:** Laravel 12, PHP 8.2, Eloquent, Next.js App Router, TypeScript, shadcn/ui

---

## Assignment Rules

| Module | DB entity | Responsible users |
|--------|-----------|-------------------|
| `leads` | persons (Lead) | Daniela |
| `crm` | persons (Client) | Daniela |
| `analysis` | opportunities | Made, Daniela (round-robin) |
| `credits` | credits | Made |
| `cobro` | credit_payments / collections | Carlos |

> **Note:** "Made", "Daniela" and "Carlos" must exist as active users. Their emails must be confirmed before running the seeder (Task 3). Use `php artisan tinker` → `User::pluck('name','email')` to list them.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/database/migrations/XXXX_create_module_assignments_table.php` | Create | Schema for module→user mapping |
| `backend/app/Models/ModuleAssignment.php` | Create | Eloquent model |
| `backend/app/Services/AssignmentService.php` | Create | Resolve next assignee (round-robin by least count) |
| `backend/database/seeders/ModuleAssignmentSeeder.php` | Create | Seed initial rules |
| `backend/database/seeders/DatabaseSeeder.php` | Modify | Call ModuleAssignmentSeeder |
| `backend/app/Http/Controllers/Api/LeadController.php` | Modify | Auto-assign on store() |
| `backend/app/Http/Controllers/Api/ClientController.php` | Modify | Auto-assign on store() |
| `backend/app/Http/Controllers/Api/OpportunityController.php` | Modify | Auto-assign on store() |
| `backend/app/Http/Controllers/Api/CreditController.php` | Modify | Auto-assign on store() |
| `src/components/shared/ReassignButton.tsx` | Create | Dropdown to change assignee |
| `src/app/dashboard/leads/[id]/page.tsx` | Modify | Add ReassignButton |
| `src/app/dashboard/clientes/[id]/page.tsx` | Modify | Add ReassignButton |
| `src/app/dashboard/oportunidades/[id]/page.tsx` | Modify | Add ReassignButton |
| `src/app/dashboard/creditos/[id]/page.tsx` | Modify | Add ReassignButton (if exists) |

---

## Task 1: Migration — module_assignments table

**Files:**
- Create: `backend/database/migrations/2026_04_09_000000_create_module_assignments_table.php`

- [ ] **Step 1: Crear la migración**

```bash
cd /home/rrichard/trabajo/studio/backend
php artisan make:migration create_module_assignments_table
```

Editar el archivo generado:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('module_assignments', function (Blueprint $table) {
            $table->id();
            $table->string('module', 50); // 'leads', 'crm', 'analysis', 'credits', 'cobro'
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['module', 'user_id']);
            $table->index('module');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('module_assignments');
    }
};
```

- [ ] **Step 2: Ejecutar la migración**

```bash
cd /home/rrichard/trabajo/studio/backend
php artisan migrate
```

Expected: `Migrating: 2026_04_09_000000_create_module_assignments_table` → `Migrated`

- [ ] **Step 3: Commit**

```bash
git add backend/database/migrations/
git commit -m "add: migration module_assignments table"
```

---

## Task 2: Model ModuleAssignment

**Files:**
- Create: `backend/app/Models/ModuleAssignment.php`

- [ ] **Step 1: Crear el modelo**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ModuleAssignment extends Model
{
    protected $fillable = ['module', 'user_id', 'is_active'];

    protected $casts = ['is_active' => 'boolean'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/Models/ModuleAssignment.php
git commit -m "add: ModuleAssignment model"
```

---

## Task 3: AssignmentService

**Files:**
- Create: `backend/app/Services/AssignmentService.php`

La lógica de round-robin usa "least-assigned": entre todos los usuarios activos del módulo, asigna al que tenga menos registros con `assigned_to_id` en la tabla correspondiente.

- [ ] **Step 1: Crear el servicio**

```php
<?php

namespace App\Services;

use App\Models\ModuleAssignment;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class AssignmentService
{
    /**
     * Module → table + column for counting existing assignments.
     */
    private const MODULE_COUNT_MAP = [
        'leads'    => ['table' => 'persons', 'type_id' => 1],  // person_type_id = 1 → Lead
        'crm'      => ['table' => 'persons', 'type_id' => 2],  // person_type_id = 2 → Client
        'analysis' => ['table' => 'opportunities', 'type_id' => null],
        'credits'  => ['table' => 'credits', 'type_id' => null],
        'cobro'    => ['table' => 'credits', 'type_id' => null], // same table, Carlos handles collections
    ];

    /**
     * Returns the user_id that should receive the next assignment for the given module.
     * When multiple users share a module, picks the one with the fewest existing assignments.
     */
    public function getNextAssignee(string $module): ?int
    {
        $assignments = ModuleAssignment::where('module', $module)
            ->where('is_active', true)
            ->with('user')
            ->get();

        if ($assignments->isEmpty()) {
            return null;
        }

        if ($assignments->count() === 1) {
            return $assignments->first()->user_id;
        }

        // Round-robin: pick user with fewest existing assignments in the module
        $config = self::MODULE_COUNT_MAP[$module] ?? null;

        return $assignments
            ->sortBy(function ($assignment) use ($config) {
                if (!$config) {
                    return 0;
                }

                $query = DB::table($config['table'])
                    ->where('assigned_to_id', $assignment->user_id);

                if ($config['type_id'] !== null) {
                    $query->where('person_type_id', $config['type_id']);
                }

                return $query->count();
            })
            ->first()
            ->user_id;
    }
}
```

- [ ] **Step 2: Registrar en AppServiceProvider**

En `backend/app/Providers/AppServiceProvider.php`, en el método `register()`:

```php
use App\Services\AssignmentService;

$this->app->singleton(AssignmentService::class);
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/Services/AssignmentService.php backend/app/Providers/AppServiceProvider.php
git commit -m "add: AssignmentService with least-loaded round-robin"
```

---

## Task 4: Seeder — ModuleAssignmentSeeder

**Files:**
- Create: `backend/database/seeders/ModuleAssignmentSeeder.php`
- Modify: `backend/database/seeders/DatabaseSeeder.php`

> **Usuarios confirmados:** Carlos Mendez `carlosm@pep.cr`, Madeleyn Huete `mh@pep.cr`, Daniela Alvarado `da@pep.cr`

- [ ] **Step 1: Crear el seeder**

```php
<?php

namespace Database\Seeders;

use App\Models\ModuleAssignment;
use App\Models\User;
use Illuminate\Database\Seeder;

class ModuleAssignmentSeeder extends Seeder
{
    /**
     * Emails reales — verificar con: php artisan tinker
     * User::select('id','name','email')->get()
     */
    private const ASSIGNMENTS = [
        'leads'    => ['da@pep.cr'],
        'crm'      => ['da@pep.cr'],
        'analysis' => ['mh@pep.cr', 'da@pep.cr'],
        'credits'  => ['mh@pep.cr'],
        'cobro'    => ['carlosm@pep.cr'],
    ];

    public function run(): void
    {
        foreach (self::ASSIGNMENTS as $module => $emails) {
            foreach ($emails as $email) {
                $user = User::where('email', $email)->first();

                if (!$user) {
                    $this->command->warn("Usuario no encontrado para email: {$email} (módulo: {$module})");
                    continue;
                }

                ModuleAssignment::updateOrCreate(
                    ['module' => $module, 'user_id' => $user->id],
                    ['is_active' => true]
                );

                $this->command->info("Asignado: {$user->name} → {$module}");
            }
        }
    }
}
```

- [ ] **Step 2: Agregar a DatabaseSeeder**

En `backend/database/seeders/DatabaseSeeder.php`, agregar al array de call():

```php
$this->call([
    // ...seeders existentes...
    ModuleAssignmentSeeder::class,
]);
```

- [ ] **Step 3: Ejecutar el seeder (después de confirmar emails)**

```bash
cd /home/rrichard/trabajo/studio/backend
php artisan db:seed --class=ModuleAssignmentSeeder
```

Expected: lista de líneas `Asignado: [Nombre] → [módulo]` sin warnings de "no encontrado".

- [ ] **Step 4: Commit**

```bash
git add backend/database/seeders/
git commit -m "add: ModuleAssignmentSeeder con reglas leads/crm/analysis/credits/cobro"
```

---

## Task 5: Auto-asignación en LeadController

**Files:**
- Modify: `backend/app/Http/Controllers/Api/LeadController.php`

- [ ] **Step 1: Inyectar AssignmentService en el método store()**

Localizar el método `store()` (línea ~129). Agregar la inyección del servicio e invocar `getNextAssignee('leads')` cuando `assigned_to_id` no viene en el request:

```php
use App\Services\AssignmentService;

// Dentro del método store(), después de $validated = $request->validate([...]):
if (empty($validated['assigned_to_id'])) {
    $service = app(AssignmentService::class);
    $validated['assigned_to_id'] = $service->getNextAssignee('leads');
}
```

Insertar esas 4 líneas **antes** de `Lead::create($validated)`.

- [ ] **Step 2: Verificar con tinker**

```bash
cd /home/rrichard/trabajo/studio/backend
php artisan tinker --execute="
\$s = app(\App\Services\AssignmentService::class);
echo 'Leads → user_id: ' . \$s->getNextAssignee('leads');
"
```

Expected: imprime el `user_id` de Daniela.

- [ ] **Step 3: Commit**

```bash
git add backend/app/Http/Controllers/Api/LeadController.php
git commit -m "feat: auto-asignación de leads a Daniela via AssignmentService"
```

---

## Task 6: Auto-asignación en ClientController

**Files:**
- Modify: `backend/app/Http/Controllers/Api/ClientController.php`

- [ ] **Step 1: Inyectar AssignmentService en store()**

Localizar `store()` (línea ~88). Agregar antes de `Client::create($validated)`:

```php
use App\Services\AssignmentService;

if (empty($validated['assigned_to_id'])) {
    $service = app(AssignmentService::class);
    $validated['assigned_to_id'] = $service->getNextAssignee('crm');
}
```

- [ ] **Step 2: Verificar con tinker**

```bash
cd /home/rrichard/trabajo/studio/backend
php artisan tinker --execute="
\$s = app(\App\Services\AssignmentService::class);
echo 'CRM → user_id: ' . \$s->getNextAssignee('crm');
"
```

Expected: user_id de Daniela.

- [ ] **Step 3: Commit**

```bash
git add backend/app/Http/Controllers/Api/ClientController.php
git commit -m "feat: auto-asignación de clientes CRM a Daniela"
```

---

## Task 7: Auto-asignación en OpportunityController (round-robin)

**Files:**
- Modify: `backend/app/Http/Controllers/Api/OpportunityController.php`

- [ ] **Step 1: Inyectar AssignmentService en store()**

Localizar `store()` (línea ~156). Agregar antes de `Opportunity::create($validated)`:

```php
use App\Services\AssignmentService;

if (empty($validated['assigned_to_id'])) {
    $service = app(AssignmentService::class);
    $validated['assigned_to_id'] = $service->getNextAssignee('analysis');
}
```

- [ ] **Step 2: Verificar round-robin con tinker**

```bash
cd /home/rrichard/trabajo/studio/backend
php artisan tinker --execute="
\$s = app(\App\Services\AssignmentService::class);
echo 'Analysis (1) → user_id: ' . \$s->getNextAssignee('analysis') . PHP_EOL;
echo 'Analysis (2) → user_id: ' . \$s->getNextAssignee('analysis') . PHP_EOL;
"
```

Expected: puede devolver el mismo si uno tiene menos asignaciones, o alternar si están equilibrados.

- [ ] **Step 3: Commit**

```bash
git add backend/app/Http/Controllers/Api/OpportunityController.php
git commit -m "feat: auto-asignación de oportunidades a Made/Daniela con round-robin"
```

---

## Task 8: Auto-asignación en CreditController

**Files:**
- Modify: `backend/app/Http/Controllers/Api/CreditController.php`

El módulo `credits` mapea a Made. El módulo `cobro` (Carlos) aplica a cobros/colecciones, no a la creación del crédito en sí. Por eso `credits` → Made.

- [ ] **Step 1: Reemplazar lógica `is_default_lead_assignee` con AssignmentService**

Localizar las líneas ~226-232 que contienen:

```php
if (empty($validated['assigned_to'])) {
    $defaultAssignee = \App\Models\User::where('is_default_lead_assignee', true)->first();
    if ($defaultAssignee) {
        $validated['assigned_to'] = $defaultAssignee->id;
    }
}
```

Reemplazar con:

```php
if (empty($validated['assigned_to'])) {
    $service = app(\App\Services\AssignmentService::class);
    $userId = $service->getNextAssignee('credits');
    if ($userId) {
        $validated['assigned_to'] = $userId;
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/Http/Controllers/Api/CreditController.php
git commit -m "feat: auto-asignación de créditos a Made via AssignmentService"
```

---

## Task 9: ReassignButton — componente frontend

**Files:**
- Create: `src/components/shared/ReassignButton.tsx`

Componente reutilizable: muestra el nombre del asignado actual + un dropdown para cambiarlo. Llama al endpoint PATCH con `assigned_to_id`.

- [ ] **Step 1: Crear el componente**

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserCheck, ChevronDown, Loader2 } from 'lucide-react';
import api from '@/lib/axios';

interface Agent {
  id: number;
  name: string;
}

interface ReassignButtonProps {
  currentAssigneeId: number | null;
  currentAssigneeName: string | null;
  agents: Agent[];
  endpoint: string; // e.g. '/api/leads/123'
  onReassigned?: (newAgentId: number, newAgentName: string) => void;
}

export function ReassignButton({
  currentAssigneeId,
  currentAssigneeName,
  agents,
  endpoint,
  onReassigned,
}: ReassignButtonProps) {
  const [saving, setSaving] = useState(false);

  const handleReassign = async (agent: Agent) => {
    if (agent.id === currentAssigneeId) return;
    setSaving(true);
    try {
      await api.patch(endpoint, { assigned_to_id: agent.id });
      onReassigned?.(agent.id, agent.name);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-8 text-xs" disabled={saving}>
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <UserCheck className="h-3.5 w-3.5" />
          )}
          {currentAssigneeName ?? 'Sin asignar'}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {agents.map((agent) => (
          <DropdownMenuItem
            key={agent.id}
            className={agent.id === currentAssigneeId ? 'font-semibold' : ''}
            onClick={() => handleReassign(agent)}
          >
            {agent.name}
            {agent.id === currentAssigneeId && ' ✓'}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/shared/ReassignButton.tsx
git commit -m "add: ReassignButton componente reutilizable de reasignación"
```

---

## Task 10: ReassignButton en detalle de Lead

**Files:**
- Modify: `src/app/dashboard/leads/[id]/page.tsx`

- [ ] **Step 1: Importar y localizar el header de la página**

Agregar import al inicio del archivo:

```tsx
import { ReassignButton } from '@/components/shared/ReassignButton';
```

- [ ] **Step 2: Agregar el botón junto al nombre del lead en el header**

Localizar el área del header donde se muestra el nombre del lead (buscar el `<h1>` o título principal). Agregar junto a él:

```tsx
<ReassignButton
  currentAssigneeId={lead.assigned_to_id ?? null}
  currentAssigneeName={agents.find(a => a.id === lead.assigned_to_id)?.name ?? null}
  agents={agents}
  endpoint={`/api/leads/${lead.id}`}
  onReassigned={(id, name) => {
    setLead(prev => prev ? { ...prev, assigned_to_id: id } : prev);
  }}
/>
```

> `agents` y `lead` ya son estados existentes en la página. `setLead` puede requerir ajuste según el nombre real del setter.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/leads/[id]/page.tsx
git commit -m "feat: botón reasignación en detalle de lead"
```

---

## Task 11: ReassignButton en detalle de Cliente

**Files:**
- Modify: `src/app/dashboard/clientes/[id]/page.tsx`

- [ ] **Step 1: Importar**

```tsx
import { ReassignButton } from '@/components/shared/ReassignButton';
```

- [ ] **Step 2: Agregar en el header del cliente**

```tsx
<ReassignButton
  currentAssigneeId={formData.assigned_to_id ?? null}
  currentAssigneeName={agents.find(a => a.id === formData.assigned_to_id)?.name ?? null}
  agents={agents}
  endpoint={`/api/clients/${clientId}`}
  onReassigned={(id) => {
    handleInputChange('assigned_to_id', id);
  }}
/>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/clientes/[id]/page.tsx
git commit -m "feat: botón reasignación en detalle de cliente"
```

---

## Task 12: ReassignButton en detalle de Oportunidad

**Files:**
- Modify: `src/app/dashboard/oportunidades/[id]/page.tsx`

- [ ] **Step 1: Importar**

```tsx
import { ReassignButton } from '@/components/shared/ReassignButton';
```

- [ ] **Step 2: Agregar en el header de la oportunidad**

```tsx
<ReassignButton
  currentAssigneeId={opportunity.assigned_to_id ?? null}
  currentAssigneeName={agents.find(a => a.id === opportunity.assigned_to_id)?.name ?? null}
  agents={agents}
  endpoint={`/api/opportunities/${opportunity.id}`}
  onReassigned={(id) => {
    setOpportunity(prev => prev ? { ...prev, assigned_to_id: id } : prev);
  }}
/>
```

> Si la página no tiene `agents` cargados, agregar:
> ```tsx
> useEffect(() => {
>   api.get('/api/agents').then(r => setAgents(r.data));
> }, []);
> ```

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/oportunidades/[id]/page.tsx
git commit -m "feat: botón reasignación en detalle de oportunidad"
```

---

## Verificación Final

- [ ] Crear un lead nuevo sin `assigned_to_id` → verificar que quede asignado a Daniela
- [ ] Crear un cliente nuevo → verificar que quede asignado a Daniela
- [ ] Crear 4 oportunidades seguidas → verificar que se repartan entre Made y Daniela
- [ ] Crear un crédito → verificar que quede asignado a Made
- [ ] Verificar que el `ReassignButton` aparece en las 3 páginas de detalle
- [ ] Cambiar asignado manualmente desde el botón → verificar que el PATCH actualiza la DB

---

## Nota sobre "Cobro" (Carlos)

El módulo `cobro` está registrado en `module_assignments` apuntando a Carlos, pero **no hay una entidad de "cobro" con `store()`** diferenciada hoy. Cuando se implemente un módulo de colecciones/cobros, usar:

```php
$validated['assigned_to_id'] = $service->getNextAssignee('cobro');
```
