<?php

namespace App\Services;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use InvalidArgumentException;

/**
 * Evalúa un condition_json contra la base de datos.
 *
 * Estructura del condition_json:
 * {
 *   "logic": "AND",          // "AND" | "OR"
 *   "rules": [
 *     { "field": "saldo", "operator": "gt", "value": 500000 },
 *     { "field": "fecha_culminacion_credito", "operator": "days_from_now_lt", "value": 30 }
 *   ]
 * }
 *
 * Operadores soportados:
 *   eq, neq, gt, lt, gte, lte,
 *   in, not_in,
 *   is_null, is_not_null,
 *   days_ago_gt, days_ago_lt,
 *   days_from_now_gt, days_from_now_lt
 */
class AutomationConditionEvaluator
{
    /**
     * Aplica las condiciones del JSON al builder y retorna el builder modificado.
     *
     * @param Builder $query
     * @param array   $conditionJson
     * @return Builder
     */
    public function apply(Builder $query, array $conditionJson): Builder
    {
        $logic = strtoupper($conditionJson['logic'] ?? 'AND');
        $rules = $conditionJson['rules'] ?? [];

        if (empty($rules)) {
            return $query;
        }

        $method = $logic === 'OR' ? 'orWhere' : 'where';

        $query->where(function (Builder $q) use ($rules, $method) {
            foreach ($rules as $rule) {
                $this->applyRule($q, $rule, $method);
            }
        });

        return $query;
    }

    /**
     * Aplica una regla individual al builder.
     */
    private function applyRule(Builder $query, array $rule, string $method): void
    {
        $field    = $rule['field']    ?? null;
        $operator = $rule['operator'] ?? null;
        $value    = $rule['value']    ?? null;

        if (!$field || !$operator) {
            return;
        }

        match ($operator) {
            'eq'              => $query->$method($field, '=', $value),
            'neq'             => $query->$method($field, '!=', $value),
            'gt'              => $query->$method($field, '>', $value),
            'lt'              => $query->$method($field, '<', $value),
            'gte'             => $query->$method($field, '>=', $value),
            'lte'             => $query->$method($field, '<=', $value),
            'in'              => $query->{$method . 'In'}($field, (array) $value),
            'not_in'          => $query->{$method . 'NotIn'}($field, (array) $value),
            'is_null'         => $query->{$method . 'Null'}($field),
            'is_not_null'     => $query->{$method . 'NotNull'}($field),
            'days_ago_gt'     => $query->$method($field, '<', Carbon::now()->subDays((int) $value)),
            'days_ago_lt'     => $query->$method($field, '>', Carbon::now()->subDays((int) $value)),
            'days_from_now_gt' => $query->$method($field, '>', Carbon::now()->addDays((int) $value)),
            'days_from_now_lt' => $query->$method($field, '<', Carbon::now()->addDays((int) $value)),
            default           => throw new InvalidArgumentException("Operador no soportado: {$operator}"),
        };
    }

    /**
     * Construye un query base para el módulo y aplica las condiciones.
     * Retorna la colección de registros que cumplen la condición.
     */
    public function evaluate(string $module, array $conditionJson): \Illuminate\Database\Eloquent\Collection
    {
        $config = config("automation_variables.{$module}");

        if (!$config) {
            throw new InvalidArgumentException("Módulo no válido: {$module}");
        }

        $modelClass = $config['model'];
        $query = $modelClass::query();

        // Filtro especial para leads (STI — person_type_id = 1)
        if ($module === 'leads' && method_exists($modelClass, 'scopeOnlyLeads')) {
            $query = $modelClass::query();
        }

        if (!empty($conditionJson['rules'])) {
            $query = $this->apply($query, $conditionJson);
        }

        return $query->get();
    }

    /**
     * Verifica si un único registro cumple las condiciones.
     * Útil para validar antes de crear tarea en ejecución manual.
     */
    public function evaluateSingle(string $module, array $conditionJson, int $recordId): bool
    {
        $config = config("automation_variables.{$module}");

        if (!$config) {
            return false;
        }

        if (empty($conditionJson['rules'])) {
            return true; // sin condición = siempre aplica
        }

        $modelClass = $config['model'];
        $query = $modelClass::where('id', $recordId);
        $query = $this->apply($query, $conditionJson);

        return $query->exists();
    }

    /**
     * Retorna los operadores disponibles agrupados por tipo de campo.
     */
    public static function operatorsByType(): array
    {
        return [
            'number'  => [
                ['value' => 'gt',  'label' => 'Mayor que'],
                ['value' => 'lt',  'label' => 'Menor que'],
                ['value' => 'gte', 'label' => 'Mayor o igual a'],
                ['value' => 'lte', 'label' => 'Menor o igual a'],
                ['value' => 'eq',  'label' => 'Igual a'],
                ['value' => 'neq', 'label' => 'Distinto de'],
            ],
            'string'  => [
                ['value' => 'eq',         'label' => 'Igual a'],
                ['value' => 'neq',        'label' => 'Distinto de'],
                ['value' => 'is_null',    'label' => 'Está vacío'],
                ['value' => 'is_not_null','label' => 'No está vacío'],
            ],
            'boolean' => [
                ['value' => 'eq', 'label' => 'Es'],
            ],
            'date'    => [
                ['value' => 'days_ago_gt',      'label' => 'Hace más de X días'],
                ['value' => 'days_ago_lt',      'label' => 'Hace menos de X días'],
                ['value' => 'days_from_now_gt', 'label' => 'Vence en más de X días'],
                ['value' => 'days_from_now_lt', 'label' => 'Vence en menos de X días'],
                ['value' => 'is_null',          'label' => 'Sin fecha'],
                ['value' => 'is_not_null',      'label' => 'Tiene fecha'],
            ],
            'enum'    => [
                ['value' => 'eq',      'label' => 'Es igual a'],
                ['value' => 'neq',     'label' => 'Es distinto de'],
                ['value' => 'in',      'label' => 'Es uno de'],
                ['value' => 'not_in',  'label' => 'No es ninguno de'],
            ],
        ];
    }
}
