<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreAnalisisRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'reference' => 'nullable|unique:analisis,reference',
            'title' => 'required|string|max:255',
            'estado_pep' => 'nullable|string|in:Pendiente,Aceptado,Pendiente de cambios,Rechazado',
            'estado_cliente' => 'nullable|string|in:Pendiente,Aprobado,Rechazado',
            'category' => 'nullable|string|max:100',
            'monto_solicitado' => 'nullable|numeric|min:0|max:999999999.99',
            'monto_sugerido' => 'nullable|numeric|min:0|max:999999999.99',
            'cuota' => 'nullable|numeric|min:0|max:999999999.99',
            'lead_id' => 'nullable|integer|exists:persons,id',
            'opportunity_id' => 'nullable|exists:opportunities,id',
            'assigned_to' => 'nullable|string|max:255',
            'opened_at' => 'nullable|date',
            'description' => 'nullable|string|max:2000',
            'divisa' => 'nullable|string|max:10',
            'plazo' => 'required|integer|min:1|max:120',
            'ingreso_bruto' => 'nullable|numeric|min:0|max:999999999.99',
            'ingreso_neto' => 'nullable|numeric|min:0|max:999999999.99',
            'ingreso_bruto_2' => 'nullable|numeric|min:0|max:999999999.99',
            'ingreso_neto_2' => 'nullable|numeric|min:0|max:999999999.99',
            'ingreso_bruto_3' => 'nullable|numeric|min:0|max:999999999.99',
            'ingreso_neto_3' => 'nullable|numeric|min:0|max:999999999.99',
            'ingreso_bruto_4' => 'nullable|numeric|min:0|max:999999999.99',
            'ingreso_neto_4' => 'nullable|numeric|min:0|max:999999999.99',
            'ingreso_bruto_5' => 'nullable|numeric|min:0|max:999999999.99',
            'ingreso_neto_5' => 'nullable|numeric|min:0|max:999999999.99',
            'ingreso_bruto_6' => 'nullable|numeric|min:0|max:999999999.99',
            'ingreso_neto_6' => 'nullable|numeric|min:0|max:999999999.99',
            'numero_manchas' => 'nullable|integer|min:0',
            'numero_juicios' => 'nullable|integer|min:0',
            'numero_embargos' => 'nullable|integer|min:0',
            'propuesta' => 'nullable|string|max:5000',
            'cargo' => 'nullable|string|max:255',
            'nombramiento' => 'nullable|string|max:255',
            'salarios_anteriores' => 'nullable|array|max:10',
            'salarios_anteriores.*.mes' => 'required_with:salarios_anteriores|string|max:50',
            'salarios_anteriores.*.bruto' => 'required_with:salarios_anteriores|numeric|min:0|max:999999999.99',
            'salarios_anteriores.*.neto' => 'required_with:salarios_anteriores|numeric|min:0|max:999999999.99',
            'deducciones' => 'nullable|array|max:20',
            'deducciones.*.nombre' => 'required_with:deducciones|string|max:100',
            'deducciones.*.monto' => 'required_with:deducciones|numeric|min:0|max:999999999.99',
        ];
    }

    public function messages(): array
    {
        return [
            'title.required' => 'El título es obligatorio',
            'monto_solicitado.min' => 'El monto solicitado debe ser mayor o igual a 0',
            'monto_sugerido.min' => 'El monto sugerido debe ser mayor o igual a 0',
            'plazo.required' => 'El plazo es obligatorio',
            'plazo.min' => 'El plazo debe ser al menos 1 mes',
            'plazo.max' => 'El plazo no puede exceder 120 meses',
            'lead_id.exists' => 'El lead especificado no existe',
            'opportunity_id.exists' => 'La oportunidad especificada no existe',
            'numero_manchas.integer' => 'El número de manchas debe ser un número entero',
            'numero_juicios.integer' => 'El número de juicios debe ser un número entero',
            'numero_embargos.integer' => 'El número de embargos debe ser un número entero',
            'deducciones.max' => 'No puede haber más de 20 deducciones',
            'salarios_anteriores.max' => 'No puede haber más de 10 salarios anteriores',
        ];
    }
}
