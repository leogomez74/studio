<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class CredidService
{
    private string $baseUrl;
    private string $token;

    public function __construct()
    {
        $this->baseUrl = config('services.credid.url', 'https://ws.credid.net/wstest/api/reporte');
        $this->token = config('services.credid.token', '');
    }

    /**
     * Consultar reporte completo de una persona por cédula.
     */
    public function consultarReporte(string $cedula): ?array
    {
        $cleanCedula = preg_replace('/[^0-9]/', '', $cedula);

        if (empty($cleanCedula) || empty($this->token)) {
            Log::warning('Credid: cédula o token vacío', ['cedula' => $cedula]);
            return null;
        }

        try {
            $response = Http::timeout(30)->get($this->baseUrl, [
                'token' => $this->token,
                'cedula' => $cleanCedula,
            ]);

            if (!$response->successful()) {
                Log::warning('Credid: HTTP error', ['status' => $response->status(), 'cedula' => $cleanCedula]);
                return null;
            }

            $data = $response->json();

            if (isset($data['Message'])) {
                Log::warning('Credid: API error', ['message' => $data['Message'], 'cedula' => $cleanCedula]);
                return null;
            }

            return $data;
        } catch (\Exception $e) {
            Log::error('Credid: Error al consultar reporte', [
                'cedula' => $cleanCedula,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Extraer datos relevantes para el análisis de crédito.
     * Solo campos del análisis (no del lead/persona).
     */
    public function extraerDatosAnalisis(array $reporte): array
    {
        return [
            'cargo' => $this->extraerCargo($reporte),
            'nombramiento' => $this->extraerNombramiento($reporte),
            'ingreso_sugerido' => $this->extraerIngresoSugerido($reporte),
            'numero_manchas' => $this->contarManchas($reporte),
            'numero_juicios' => count($reporte['Juicios'] ?? []),
            'numero_embargos' => count($reporte['Embargos'] ?? []),
            'manchas_detalle' => $this->extraerManchasDetalle($reporte),
            'juicios_detalle' => $this->extraerJuiciosDetalle($reporte),
            'embargos_detalle' => $this->extraerEmbargosDetalle($reporte),
            'es_pep' => !empty($reporte['PEP']),
            'pep_detalle' => $this->extraerPepDetalle($reporte),
            'actividad_economica' => $this->extraerActividadEconomica($reporte),
            'referencias_comerciales' => $this->extraerReferenciasComerciales($reporte),
            'score' => $reporte['Score']['ConfidenceResult'] ?? null,
            'score_color' => $reporte['Score']['Color'] ?? null,
            'listas_internacionales' => $reporte['ListasInternacionalesCoincidenciaExacta'] ?? 0,
        ];
    }

    private function extraerCargo(array $reporte): ?string
    {
        $historico = $reporte['ActividadEconomica']['HistoricoLaboral'] ?? [];
        if (empty($historico)) {
            return null;
        }
        return $historico[0]['RazonSocial'] ?? null;
    }

    private function extraerNombramiento(array $reporte): ?string
    {
        $actividad = $reporte['ActividadEconomica']['ActividadActual'] ?? [];

        if (!empty($actividad['Pensionado'])) {
            return 'Pensionado';
        }
        if (!empty($actividad['Asalariado'])) {
            $historico = $reporte['ActividadEconomica']['HistoricoLaboral'] ?? [];
            $esPublico = !empty($historico[0]['EsInstitucionPublica']);
            return $esPublico ? 'Propiedad' : 'Fijo';
        }
        if (!empty($actividad['Independiente'])) {
            return 'Independiente';
        }

        return null;
    }

    private function extraerIngresoSugerido(array $reporte): ?array
    {
        $actividad = $reporte['ActividadEconomica'] ?? [];

        return [
            'promedio_3_meses' => $actividad['Promedio_3Meses'] ?? null,
            'promedio_6_meses' => $actividad['Promedio_6Meses'] ?? null,
            'promedio_12_meses' => $actividad['Promedio_12Meses'] ?? null,
            'monto_historico' => $this->extraerMontoHistorico($reporte),
        ];
    }

    private function extraerMontoHistorico(array $reporte): ?float
    {
        $historico = $reporte['ActividadEconomica']['HistoricoLaboral'] ?? [];
        if (empty($historico)) {
            return null;
        }
        return $historico[0]['Monto'] ?? null;
    }

    private function contarManchas(array $reporte): int
    {
        $referencias = $reporte['ReferenciasComerciales'] ?? [];
        $count = 0;
        foreach ($referencias as $ref) {
            if (($ref['dias_mora'] ?? 0) > 0 && empty($ref['EsHistorica'])) {
                $count++;
            }
        }
        return $count;
    }

    private function extraerManchasDetalle(array $reporte): array
    {
        $referencias = $reporte['ReferenciasComerciales'] ?? [];
        $manchas = [];

        foreach ($referencias as $ref) {
            if (($ref['dias_mora'] ?? 0) > 0 && empty($ref['EsHistorica'])) {
                $manchas[] = [
                    'fecha_inicio' => $this->parseFechaCredid($ref['fecha_otorgamiento_credito'] ?? null),
                    'descripcion' => trim(
                        ($ref['Cliente'] ?? 'Sin fuente') . ' - ' .
                        ($ref['codigo_estado_cuenta'] ?? $ref['tipo_credito'] ?? '') . ' - ' .
                        ($ref['dias_mora'] ?? 0) . ' días mora' .
                        (($ref['Clasificacion'] ?? '') ? ' (Clasif. ' . $ref['Clasificacion'] . ')' : '')
                    ),
                    'monto' => (float) ($ref['saldo_mora'] ?? 0),
                ];
            }
        }

        return $manchas;
    }

    private function extraerJuiciosDetalle(array $reporte): array
    {
        $juicios = $reporte['Juicios'] ?? [];
        $resultado = [];

        foreach ($juicios as $juicio) {
            $estado = $juicio['Estado'] ?? '';
            $estaActivo = stripos($estado, 'proceso') !== false || stripos($estado, 'trámite') !== false;

            $resultado[] = [
                'fecha_inicio' => $this->parseFechaCredid($juicio['FechaEntrada'] ?? null),
                'estado' => $estaActivo ? 'activo' : 'cerrado',
                'expediente' => $juicio['Expediente'] ?? '',
                'monto' => (float) ($juicio['Cuantia'] ?? 0),
            ];
        }

        return $resultado;
    }

    private function extraerEmbargosDetalle(array $reporte): array
    {
        $embargos = $reporte['Embargos'] ?? [];
        $resultado = [];

        foreach ($embargos as $embargo) {
            $resultado[] = [
                'fecha_inicio' => $this->parseFechaCredid($embargo['Fecha'] ?? null),
                'motivo' => $embargo['Descripcion'] ?? ($embargo['Tipo'] ?? 'Sin descripción'),
                'monto' => (float) ($embargo['Monto'] ?? 0),
            ];
        }

        return $resultado;
    }

    private function extraerPepDetalle(array $reporte): ?array
    {
        $pep = $reporte['PEP'] ?? null;
        if (!$pep) {
            return null;
        }

        return [
            'directo' => $pep['Directo'] ?? false,
            'nombre' => $pep['Nombre'] ?? '',
            'puesto' => $pep['Puesto'] ?? '',
            'institucion' => $pep['Institucion'] ?? '',
            'categoria' => $pep['Categoria'] ?? '',
            'descripcion' => $pep['Descripcion'] ?? [],
        ];
    }

    private function extraerActividadEconomica(array $reporte): ?array
    {
        $actividad = $reporte['ActividadEconomica'] ?? null;
        if (!$actividad) {
            return null;
        }

        $actual = $actividad['ActividadActual'] ?? [];
        $historico = $actividad['HistoricoLaboral'] ?? [];

        return [
            'asalariado' => $actual['Asalariado'] ?? false,
            'independiente' => $actual['Independiente'] ?? false,
            'pensionado' => $actual['Pensionado'] ?? false,
            'economicamente_activo' => $actual['EconomicamenteActivo'] ?? false,
            'patrono' => $historico[0]['RazonSocial'] ?? null,
            'cedula_patrono' => $historico[0]['Patrono'] ?? null,
            'fecha_inicio' => $historico[0]['FechaInicial'] ?? null,
            'antiguedad' => $historico[0]['CantidadTiempo'] ?? null,
            'es_institucion_publica' => $historico[0]['EsInstitucionPublica'] ?? false,
            'monto_aproximado' => $historico[0]['MontoAproximado'] ?? null,
        ];
    }

    private function extraerReferenciasComerciales(array $reporte): array
    {
        $referencias = $reporte['ReferenciasComerciales'] ?? [];
        $resultado = [];

        foreach ($referencias as $ref) {
            $resultado[] = [
                'cliente' => $ref['Cliente'] ?? '',
                'tipo' => $ref['tipo_informacion'] ?? '',
                'tipo_credito' => $ref['tipo_credito'] ?? '',
                'estado_cuenta' => $ref['codigo_estado_cuenta'] ?? '',
                'dias_mora' => (int) ($ref['dias_mora'] ?? 0),
                'saldo_mora' => (float) ($ref['saldo_mora'] ?? 0),
                'cuotas_vencidas' => (int) ($ref['cuotas_vencidas'] ?? 0),
                'clasificacion' => $ref['Clasificacion'] ?? '',
                'es_historica' => $ref['EsHistorica'] ?? false,
            ];
        }

        return $resultado;
    }

    /**
     * Parsear fecha en formato dd/mm/yyyy a yyyy-mm-dd.
     */
    private function parseFechaCredid(?string $fecha): ?string
    {
        if (!$fecha) {
            return null;
        }

        try {
            $parts = explode('/', $fecha);
            if (count($parts) === 3) {
                return "{$parts[2]}-{$parts[1]}-{$parts[0]}";
            }
        } catch (\Exception $e) {
            // Silenciar
        }

        return null;
    }
}
