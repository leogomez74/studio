<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Lead;
use App\Models\PersonDocument;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;

class QuestionnaireController extends Controller
{
    /**
     * Verificar si el cuestionario ya fue completado para una cédula.
     */
    public function checkStatus(Request $request)
    {
        $cedula = $request->query('cedula');

        if (!$cedula) {
            return response()->json([
                'message' => 'Cédula no proporcionada.'
            ], 400);
        }

        // Decodificar cédula si viene en base64
        try {
            $cedula = base64_decode($cedula);
        } catch (\Exception $e) {
            // Si falla el decode, usar el valor tal cual
        }

        $lead = Lead::where('cedula', $cedula)->first();

        if (!$lead) {
            return response()->json([
                'completed' => false,
                'message' => 'Lead no encontrado.'
            ], 404);
        }

        return response()->json([
            'completed' => !is_null($lead->questionnaire_completed_at),
            'completed_at' => $lead->questionnaire_completed_at,
            'lead_name' => $lead->nombre_completo
        ]);
    }

    public function submit(Request $request)
    {
        try {
            // Validate request
            $request->validate([
                'cedula' => 'required|string',
                'cedula_file' => 'required|file|image|max:5120', // 5MB max
                'recibo_file' => 'required|file|mimes:jpg,jpeg,png,pdf|max:5120',
                'questionnaire_data' => 'required|string',
            ]);

            $cedula = $request->input('cedula');
            $questionnaireData = json_decode($request->input('questionnaire_data'), true);

            // Find the lead by cedula
            $lead = Lead::where('cedula', $cedula)->first();

            if (!$lead) {
                return response()->json([
                    'message' => 'No se encontró un lead con esta cédula.'
                ], 404);
            }

            // Verificar si el cuestionario ya fue completado
            if ($lead->questionnaire_completed_at) {
                return response()->json([
                    'message' => 'Este cuestionario ya fue completado anteriormente.',
                    'completed_at' => $lead->questionnaire_completed_at
                ], 400);
            }

            // Limpiar cédula (remover guiones y espacios)
            $strippedCedula = preg_replace('/[^0-9]/', '', $cedula);

            // Crear directorio en la estructura unificada: documentos/{cedula}/buzon/
            $storagePath = "documentos/{$strippedCedula}/buzon";

            // Save cedula file
            $cedulaFile = $request->file('cedula_file');
            $cedulaFileName = 'cedula_' . time() . '.' . $cedulaFile->getClientOriginalExtension();
            $cedulaPath = $cedulaFile->storeAs($storagePath, $cedulaFileName, 'public');

            // Save recibo file
            $reciboFile = $request->file('recibo_file');
            $reciboFileName = 'recibo_' . time() . '.' . $reciboFile->getClientOriginalExtension();
            $reciboPath = $reciboFile->storeAs($storagePath, $reciboFileName, 'public');

            // Create PersonDocument records
            PersonDocument::create([
                'person_id' => $lead->id,
                'name' => 'Cédula de Identidad',
                'path' => $cedulaPath,
                'url' => Storage::url($cedulaPath),
                'mime_type' => $cedulaFile->getMimeType(),
                'size' => $cedulaFile->getSize(),
                'file_created_at' => now(),
            ]);

            PersonDocument::create([
                'person_id' => $lead->id,
                'name' => 'Recibo de Servicio',
                'path' => $reciboPath,
                'url' => Storage::url($reciboPath),
                'mime_type' => $reciboFile->getMimeType(),
                'size' => $reciboFile->getSize(),
                'file_created_at' => now(),
            ]);

            // Update lead with questionnaire data - mapeo directo a campos de BD
            $updateData = [];

            // Personal info
            if (isset($questionnaireData['estado_civil'])) {
                $updateData['estado_civil'] = $questionnaireData['estado_civil'];
            }
            if (isset($questionnaireData['nivel_academico'])) {
                $updateData['nivel_academico'] = $questionnaireData['nivel_academico'];
            }
            // Institución - priorizar el campo 'institucion' sobre 'situacion_laboral'
            if (isset($questionnaireData['institucion']) && !empty($questionnaireData['institucion'])) {
                $updateData['institucion_labora'] = $questionnaireData['institucion'];
            } elseif (isset($questionnaireData['situacion_laboral'])) {
                $updateData['institucion_labora'] = $questionnaireData['situacion_laboral'];
            }
            if (isset($questionnaireData['origen_lead'])) {
                $updateData['source'] = $questionnaireData['origen_lead'];
            }

            // Interes general
            if (isset($questionnaireData['interes'])) {
                $updateData['interes'] = $questionnaireData['interes'];
            }

            // Credit related data
            if (isset($questionnaireData['tipo_credito'])) {
                $updateData['tipo_credito'] = $questionnaireData['tipo_credito'];
            }
            if (isset($questionnaireData['monto'])) {
                $updateData['monto'] = $questionnaireData['monto'];
            }
            if (isset($questionnaireData['uso_credito'])) {
                $updateData['uso_credito'] = $questionnaireData['uso_credito'];
            }
            if (isset($questionnaireData['tiene_deudas'])) {
                $updateData['tiene_deudas'] = $questionnaireData['tiene_deudas'];
            }

            // Financial profile
            if (isset($questionnaireData['ingreso'])) {
                $updateData['ingreso'] = $questionnaireData['ingreso'];
            }
            if (isset($questionnaireData['salario_exacto'])) {
                $updateData['salario_exacto'] = $questionnaireData['salario_exacto'];
            }
            if (isset($questionnaireData['experiencia_crediticia'])) {
                $updateData['experiencia_crediticia'] = $questionnaireData['experiencia_crediticia'];
            }
            if (isset($questionnaireData['historial_mora'])) {
                $updateData['historial_mora'] = $questionnaireData['historial_mora'];
            }
            if (isset($questionnaireData['tipo_vivienda'])) {
                $updateData['tipo_vivienda'] = $questionnaireData['tipo_vivienda'];
            }
            if (isset($questionnaireData['dependientes'])) {
                $updateData['dependientes'] = $questionnaireData['dependientes'];
            }

            // Legal services data
            if (isset($questionnaireData['tramites'])) {
                $updateData['tramites'] = $questionnaireData['tramites']; // Will be cast to JSON
            }
            if (isset($questionnaireData['urgencia'])) {
                $updateData['urgencia'] = $questionnaireData['urgencia'];
            }
            if (isset($questionnaireData['detalle_legal'])) {
                $updateData['detalle_legal'] = $questionnaireData['detalle_legal'];
            }

            // Marcar el cuestionario como completado
            $updateData['questionnaire_completed_at'] = now();

            $lead->update($updateData);

            // Actualizar oportunidades existentes con los nuevos datos del cuestionario
            $this->updateOpportunitiesFromLead($lead);

            // Sincronizar archivos a oportunidades existentes
            $syncResult = $this->syncFilesToOpportunities($lead, $strippedCedula);

            Log::info("Questionnaire submitted for lead: {$cedula}", [
                'lead_id' => $lead->id,
                'files' => [$cedulaPath, $reciboPath],
                'data' => $questionnaireData,
                'synced_to_opportunities' => $syncResult
            ]);

            // Determinar elegibilidad basada en salario para créditos (solo para sector público)
            $salarioExacto = isset($questionnaireData['salario_exacto'])
                ? (float) $questionnaireData['salario_exacto']
                : 0;
            $interes = $questionnaireData['interes'] ?? '';
            $sector = $lead->sector ?? '';

            $elegibleCredito = true; // Por defecto elegible
            $responseMessage = '¡Registro completado satisfactoriamente! Nuestro equipo revisará tu solicitud y se pondrá en contacto contigo pronto.';
            $responseType = 'success';

            // Validación de salario mínimo solo para sector público
            if ($sector === 'publico' && ($interes === 'credito' || $interes === 'ambos')) {
                $elegibleCredito = $salarioExacto >= 300000;
                if (!$elegibleCredito) {
                    $responseMessage = 'Lamentamos informarle que actualmente no contamos con créditos para clientes del sector público cuyo salario sea menor a ₡300,000. Sin embargo, puede optar por nuestros servicios legales (divorcios, notariado, testamentos, etc.).';
                    $responseType = 'info';
                }
            }

            return response()->json([
                'message' => $responseMessage,
                'type' => $responseType,
                'elegible_credito' => $elegibleCredito,
                'lead_id' => $lead->id,
                'files' => [
                    'cedula' => Storage::url($cedulaPath),
                    'recibo' => Storage::url($reciboPath),
                ]
            ], 200);

        } catch (\Exception $e) {
            Log::error("Error submitting questionnaire: " . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'message' => 'Error al procesar el cuestionario.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Actualizar oportunidades existentes con datos del cuestionario del lead.
     */
    private function updateOpportunitiesFromLead($lead): void
    {
        // Buscar oportunidades del lead que tengan valores por defecto
        $opportunities = \App\Models\Opportunity::where('lead_cedula', $lead->cedula)
            ->where(function ($query) {
                $query->where('opportunity_type', 'Estándar')
                      ->orWhere('vertical', 'General')
                      ->orWhere('amount', 0)
                      ->orWhereNull('amount');
            })->get();

        foreach ($opportunities as $opportunity) {
            $changes = [];

            // Actualizar opportunity_type
            if (($opportunity->opportunity_type === 'Estándar' || empty($opportunity->opportunity_type)) && !empty($lead->interes)) {
                $changes['opportunity_type'] = $this->determineOpportunityType($lead);
            }

            // Actualizar vertical
            if (($opportunity->vertical === 'General' || empty($opportunity->vertical)) && !empty($lead->institucion_labora)) {
                $changes['vertical'] = $lead->institucion_labora;
            }

            // Actualizar amount
            if ((empty($opportunity->amount) || $opportunity->amount == 0) && !empty($lead->monto)) {
                $changes['amount'] = $this->extractAmountFromRange($lead->monto);
            }

            if (!empty($changes)) {
                $opportunity->update($changes);
                Log::info("Oportunidad actualizada automáticamente desde cuestionario", [
                    'opportunity_id' => $opportunity->id,
                    'changes' => $changes
                ]);
            }
        }
    }

    private function determineOpportunityType($lead): string
    {
        $interes = $lead->interes;
        $tipoCreditoValue = $lead->tipo_credito;
        $tramites = $lead->tramites;

        if ($interes === 'credito') {
            if ($tipoCreditoValue === 'microcredito') {
                return 'Micro Crédito';
            } elseif ($tipoCreditoValue === 'regular') {
                return 'Crédito';
            }
            return 'Crédito';
        }

        if ($interes === 'servicios_legales') {
            if (is_array($tramites) && count($tramites) > 0) {
                return $this->mapTramiteToOpportunityType($tramites[0]);
            }
            return 'Servicios Legales';
        }

        if ($interes === 'ambos') {
            if (!empty($tipoCreditoValue)) {
                if ($tipoCreditoValue === 'microcredito') {
                    return 'Micro Crédito';
                } elseif ($tipoCreditoValue === 'regular') {
                    return 'Crédito';
                }
                return 'Crédito';
            }
            if (is_array($tramites) && count($tramites) > 0) {
                return $this->mapTramiteToOpportunityType($tramites[0]);
            }
        }

        return 'Estándar';
    }

    private function mapTramiteToOpportunityType(string $tramite): string
    {
        $mapping = [
            'divorcio' => 'Divorcio',
            'notariado' => 'Notariado',
            'testamento' => 'Testamentos',
            'testamentos' => 'Testamentos',
            'descuento_facturas' => 'Descuento de Facturas',
        ];

        $tramiteLower = strtolower($tramite);
        return $mapping[$tramiteLower] ?? ucfirst($tramite);
    }

    private function extractAmountFromRange(string $rangoMonto): float
    {
        $rangosMap = [
            '100k-250k' => 175000,
            '250k-450k' => 350000,
            '300k-450k' => 375000,
            '450k-690k' => 570000,
            '690k-1m' => 845000,
            '1m-1.7m' => 1350000,
            '1.7m-2.2m' => 1950000,
        ];

        if (isset($rangosMap[$rangoMonto])) {
            return $rangosMap[$rangoMonto];
        }

        $rangoMonto = strtolower(str_replace([' ', ',', '₡'], '', $rangoMonto));

        if (preg_match('/(\d+(?:\.\d+)?)(k|m)?-(\d+(?:\.\d+)?)(k|m)?/', $rangoMonto, $matches)) {
            $min = (float) $matches[1];
            $max = (float) $matches[3];

            if (isset($matches[2]) && $matches[2] === 'k') $min *= 1000;
            if (isset($matches[2]) && $matches[2] === 'm') $min *= 1000000;
            if (isset($matches[4]) && $matches[4] === 'k') $max *= 1000;
            if (isset($matches[4]) && $matches[4] === 'm') $max *= 1000000;

            return ($min + $max) / 2;
        }

        return 0;
    }

    /**
     * Sincronizar archivos del buzón del lead a todas sus oportunidades existentes.
     *
     * @param Lead $lead
     * @param string $strippedCedula
     * @return array
     */
    private function syncFilesToOpportunities($lead, string $strippedCedula): array
    {
        // Buscar oportunidades del lead
        $opportunities = \App\Models\Opportunity::where('lead_cedula', $lead->cedula)
            ->orWhere('lead_cedula', $strippedCedula)
            ->get();

        if ($opportunities->isEmpty()) {
            return ['count' => 0, 'opportunities' => []];
        }

        $sourceFolder = "documentos/{$strippedCedula}/buzon";
        $synced = [];

        foreach ($opportunities as $opportunity) {
            $targetFolder = "documentos/{$strippedCedula}/{$opportunity->id}/heredados";

            try {
                // Crear carpeta destino si no existe usando mkdir() directamente
                $fullTargetFolder = Storage::disk('public')->path($targetFolder);

                if (!file_exists($fullTargetFolder)) {
                    @mkdir($fullTargetFolder, 0755, true);
                }

                // Obtener archivos del buzón
                if (!Storage::disk('public')->exists($sourceFolder)) {
                    continue;
                }

                $files = Storage::disk('public')->files($sourceFolder);

                foreach ($files as $file) {
                    $fileName = basename($file);
                    $targetPath = "{$targetFolder}/{$fileName}";

                    // Skip si ya existe
                    if (Storage::disk('public')->exists($targetPath)) {
                        continue;
                    }

                    // Copiar archivo
                    Storage::disk('public')->copy($file, $targetPath);
                }

                $synced[] = $opportunity->id;

                Log::info("Archivos sincronizados a oportunidad desde cuestionario", [
                    'opportunity_id' => $opportunity->id,
                    'lead_cedula' => $lead->cedula
                ]);
            } catch (\Exception $e) {
                Log::error("Error sincronizando archivos a oportunidad", [
                    'opportunity_id' => $opportunity->id,
                    'error' => $e->getMessage()
                ]);
            }
        }

        return ['count' => count($synced), 'opportunities' => $synced];
    }
}
