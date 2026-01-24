<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateAnalisisRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $id = $this->route('analisi'); // Laravel pluralizes 'analisis' to 'analisi' for route model binding

        return [
            'reference' => 'sometimes|required|unique:analisis,reference,' . $id,
            'title' => 'sometimes|required|string|max:255',
            'estado_pep' => 'nullable|string|in:Pendiente,Aceptado,Pendiente de cambios,Rechazado',
            'estado_cliente' => 'nullable|string|in:Aprobado,Rechazado',
            'category' => 'nullable|string|max:100',
            'monto_credito' => 'nullable|numeric|min:0|max:999999999.99',
            'lead_id' => 'nullable|integer|exists:persons,id',
            'opportunity_id' => 'nullable|exists:opportunities,id',
            'assigned_to' => 'nullable|string|max:255',
            'opened_at' => 'nullable|date',
            'description' => 'nullable|string|max:2000',
            'divisa' => 'nullable|string|max:10',
            'plazo' => 'nullable|integer|min:1|max:360',
            'ingreso_bruto' => 'nullable|numeric|min:0|max:999999999.99',
            'ingreso_neto' => 'nullable|numeric|min:0|max:999999999.99',
            'deducciones' => 'nullable|array|max:20',
            'deducciones.*.nombre' => 'required_with:deducciones|string|max:100',
            'deducciones.*.monto' => 'required_with:deducciones|numeric|min:0|max:999999999.99',
            'propuesta' => 'nullable|string|max:5000',
        ];
    }

    public function messages(): array
    {
        return [
            'monto_credito.min' => 'El monto de crédito debe ser mayor o igual a 0',
            'plazo.min' => 'El plazo debe ser al menos 1 mes',
            'plazo.max' => 'El plazo no puede exceder 360 meses',
            'lead_id.exists' => 'El lead especificado no existe',
            'opportunity_id.exists' => 'La oportunidad especificada no existe',
            'deducciones.max' => 'No puede haber más de 20 deducciones',
        ];
    }
}
