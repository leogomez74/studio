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
            'plazo' => 'nullable|integer|min:1|max:120',
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
            // Deducciones mensuales
            'deducciones_mensuales' => 'nullable|array|max:6',
            'deducciones_mensuales.*.mes' => 'required_with:deducciones_mensuales|integer|min:1|max:6',
            'deducciones_mensuales.*.monto' => 'required_with:deducciones_mensuales|numeric|min:0|max:999999999.99',
            // Manchas detalle
            'manchas_detalle' => 'nullable|array|max:50',
            'manchas_detalle.*.descripcion' => 'required_with:manchas_detalle|string|max:500',
            'manchas_detalle.*.monto' => 'required_with:manchas_detalle|numeric|min:0|max:999999999.99',
            // Juicios detalle
            'juicios_detalle' => 'nullable|array|max:50',
            'juicios_detalle.*.fecha' => 'required_with:juicios_detalle|date',
            'juicios_detalle.*.estado' => 'required_with:juicios_detalle|string|in:activo,cerrado',
            'juicios_detalle.*.expediente' => 'required_with:juicios_detalle|string|max:100',
            'juicios_detalle.*.monto' => 'required_with:juicios_detalle|numeric|min:0|max:999999999.99',
            // Embargos detalle
            'embargos_detalle' => 'nullable|array|max:50',
            'embargos_detalle.*.fecha' => 'required_with:embargos_detalle|date',
            'embargos_detalle.*.motivo' => 'required_with:embargos_detalle|string|max:500',
            'embargos_detalle.*.monto' => 'required_with:embargos_detalle|numeric|min:0|max:999999999.99',
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
            'monto_solicitado.min' => 'El monto solicitado debe ser mayor o igual a 0',
            'monto_sugerido.min' => 'El monto sugerido debe ser mayor o igual a 0',
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
