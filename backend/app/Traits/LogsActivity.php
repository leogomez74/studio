<?php

namespace App\Traits;

use App\Models\ActivityLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

trait LogsActivity
{
    /**
     * Registra una acción en la bitácora de auditoría.
     *
     * @param string      $action      create|update|delete|login|logout|export|upload|restore
     * @param string      $module      Nombre legible del módulo (Leads, Creditos, etc.)
     * @param Model|null  $model       El registro afectado (opcional)
     * @param string|null $modelLabel  Referencia legible del registro (ej: "26-00001-01-CRED")
     * @param array       $changes     Resultado de getChanges() — puede estar vacío
     * @param Request|null $request    Para capturar IP y user-agent
     */
    protected function logActivity(
        string $action,
        string $module,
        ?Model $model = null,
        ?string $modelLabel = null,
        array $changes = [],
        ?Request $request = null
    ): void {
        try {
            ActivityLog::create([
                'user_id'     => Auth::id(),
                'user_name'   => Auth::user()?->name ?? 'Sistema',
                'action'      => $action,
                'module'      => $module,
                'model_type'  => $model ? get_class($model) : null,
                'model_id'    => $model ? (string) $model->getKey() : null,
                'model_label' => $modelLabel,
                'changes'     => !empty($changes) ? $changes : null,
                'ip_address'  => $request?->ip(),
                'user_agent'  => $request?->userAgent(),
            ]);
        } catch (\Throwable $e) {
            // No interrumpir el flujo principal si falla el log
            \Illuminate\Support\Facades\Log::warning('ActivityLog: no se pudo registrar', [
                'error'  => $e->getMessage(),
                'action' => $action,
                'module' => $module,
            ]);
        }
    }

    /**
     * Calcula los campos que cambiaron entre dos snapshots de datos.
     *
     * @param array $oldData  Snapshot anterior ($model->toArray() antes del update)
     * @param array $newData  Snapshot nuevo ($model->fresh()->toArray() después del update)
     * @param array $exclude  Campos adicionales a ignorar
     * @return array          [{field, old_value, new_value}, ...]
     */
    protected function getChanges(array $oldData, array $newData, array $exclude = []): array
    {
        $defaultExclude = [
            'password', 'remember_token', 'updated_at', 'created_at',
            'email_verified_at', 'reversal_snapshot',
        ];

        $exclude = array_merge($defaultExclude, $exclude);
        $changes = [];

        foreach ($newData as $field => $newVal) {
            if (in_array($field, $exclude)) continue;

            $oldVal = $oldData[$field] ?? null;

            // Normalizar para comparación (arrays/objetos → string)
            $normalizeOld = is_array($oldVal) ? json_encode($oldVal) : $oldVal;
            $normalizeNew = is_array($newVal) ? json_encode($newVal) : $newVal;

            if ((string) $normalizeOld !== (string) $normalizeNew) {
                $changes[] = [
                    'field'     => $field,
                    'old_value' => $oldVal,
                    'new_value' => $newVal,
                ];
            }
        }

        return $changes;
    }
}
