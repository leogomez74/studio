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

            // Create storage directory for this cedula
            $storagePath = "leads/{$cedula}";

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
            if (isset($questionnaireData['situacion_laboral'])) {
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

            $lead->update($updateData);

            Log::info("Questionnaire submitted for lead: {$cedula}", [
                'lead_id' => $lead->id,
                'files' => [$cedulaPath, $reciboPath],
                'data' => $questionnaireData
            ]);

            return response()->json([
                'message' => 'Cuestionario enviado exitosamente.',
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
}
