<?php

namespace App\Services;

use App\Models\Analisis;
use App\Models\Person;
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
     * Verificar estado de configuración de Credid (sin exponer valores sensibles).
     */
    public function verificarConfiguracion(): array
    {
        return [
            'url_configured' => !empty($this->baseUrl),
            'token_configured' => !empty($this->token),
            'service_ready' => !empty($this->baseUrl) && !empty($this->token),
        ];
    }

    /**
     * Enmascarar cédula para logging seguro: muestra solo los últimos 4 dígitos.
     */
    private function maskCedula(string $cedula): string
    {
        $len = strlen($cedula);
        if ($len <= 4) {
            return str_repeat('*', $len);
        }
        return str_repeat('*', $len - 4) . substr($cedula, -4);
    }

    /**
     * Consultar reporte completo de una persona por cédula.
     */
    public function consultarReporte(string $cedula): ?array
    {
        $cleanCedula = preg_replace('/[^0-9]/', '', $cedula);
        $maskedCedula = $this->maskCedula($cleanCedula);

        if (empty($cleanCedula) || empty($this->token)) {
            Log::warning('Credid: cédula o token vacío', ['cedula' => $maskedCedula]);
            return null;
        }

        try {
            $response = Http::timeout(30)->get($this->baseUrl, [
                'token' => $this->token,
                'cedula' => $cleanCedula,
            ]);

            if (!$response->successful()) {
                Log::warning('Credid: HTTP error', ['status' => $response->status(), 'cedula' => $maskedCedula]);
                return null;
            }

            $data = $response->json();

            // Si json() retorna string en vez de array (ej: mensaje de error de Credid)
            if (is_string($data)) {
                Log::warning('Credid: respuesta es string', ['message' => $data, 'cedula' => $maskedCedula]);
                $decoded = json_decode($data, true);
                if (is_array($decoded)) {
                    $data = $decoded;
                } else {
                    return null;
                }
            }

            if (!is_array($data)) {
                Log::warning('Credid: respuesta inesperada', ['type' => gettype($data), 'cedula' => $maskedCedula]);
                return null;
            }

            if (isset($data['Message'])) {
                Log::warning('Credid: API error', ['message' => $data['Message'], 'cedula' => $maskedCedula]);
                return null;
            }

            return $data;
        } catch (\Exception $e) {
            Log::error('Credid: Error al consultar reporte', [
                'cedula' => $maskedCedula,
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
            ...$this->calcularScoreRiesgo($reporte),
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

            // Extraer nombre del actor (demandante/acreedor)
            $partes = $juicio['Partes'] ?? [];
            $actor = collect($partes)->first(fn($p) => stripos($p['Tipo'] ?? '', 'ACTOR') !== false);
            $acreedor = $actor ? trim($actor['Nombre'] ?? '') : null;

            $resultado[] = [
                'fecha_inicio' => $this->parseFechaCredid($juicio['FechaEntrada'] ?? null),
                'estado' => $estaActivo ? 'En Trámite' : 'Finalizado',
                'expediente' => $juicio['Expediente'] ?? '',
                'monto' => (float) ($juicio['Cuantia'] ?? 0),
                'acreedor' => $acreedor ?: null,
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
     * Calcular score interno de riesgo usando los accessors del modelo Analisis.
     */
    private function calcularScoreRiesgo(array $reporte): array
    {
        $analisis = new Analisis([
            'numero_manchas' => $this->contarManchas($reporte),
            'numero_juicios' => count($reporte['Juicios'] ?? []),
            'numero_embargos' => count($reporte['Embargos'] ?? []),
        ]);

        return [
            'score_riesgo' => $analisis->score_riesgo,
            'score_riesgo_color' => $analisis->score_riesgo_color,
            'score_riesgo_label' => $analisis->score_riesgo_label,
        ];
    }

    /**
     * Extraer datos personales del reporte Credid para mostrar en "Datos Adicionales".
     */
    public function extraerDatosPersonales(array $reporte): array
    {
        $filiacion = $reporte['FiliacionFisica'] ?? $reporte['FiliacionExtranjero'] ?? [];

        return [
            'filiacion' => [
                'nacionalidad' => $filiacion['Nacionalidad'] ?? null,
                'fecha_nacimiento' => $this->parseFechaCredid($filiacion['FechaNacimiento'] ?? null),
                'edad' => $filiacion['Edad'] ?? null,
                'genero' => $filiacion['GeneroLiteral'] ?? ($filiacion['Genero'] ?? null),
                'lugar_nacimiento' => $filiacion['LugarNacimiento'] ?? null,
                'vencimiento_cedula' => $this->parseFechaCredid($filiacion['VencimientoCedula'] ?? null),
                'indice_desarrollo_social' => $filiacion['IndiceDesarrolloSocial']['Indice'] ?? null,
                'nivel_desarrollo_social' => $filiacion['IndiceDesarrolloSocial']['Nivel'] ?? null,
                'profesiones' => array_map(fn($p) => $p['Descripcion'] ?? '', $filiacion['Profesion'] ?? []),
                'colegios_profesionales' => array_map(fn($c) => [
                    'colegio' => $c['Colegio'] ?? '',
                    'carne' => $c['Carne'] ?? '',
                    'estado' => $c['Estado'] ?? '',
                ], $filiacion['ColegioProfesional'] ?? []),
                'titulos_mep' => array_map(fn($t) => [
                    'titulo' => $t['Titulo'] ?? '',
                    'institucion' => $t['Institucion'] ?? '',
                    'periodo' => $t['Periodo'] ?? '',
                ], $filiacion['TitulosMep'] ?? []),
                'domicilio_electoral' => [
                    'provincia' => $filiacion['DomicilioElectoral']['Provincia'] ?? null,
                    'canton' => $filiacion['DomicilioElectoral']['Canton'] ?? null,
                    'distrito' => $filiacion['DomicilioElectoral']['Distrito'] ?? null,
                ],
                'defuncion' => !empty($filiacion['Defuncion']['Fecha']) ? $filiacion['Defuncion'] : null,
            ],
            'matrimonio_actual' => $this->extraerMatrimonioActual($reporte),
            'total_hijos' => $reporte['ParientesTotalHijos'] ?? null,
            'hijos_menores' => $reporte['HijosMenores'] ?? [],
            'vehiculos' => array_map(fn($v) => [
                'tipo' => $v['Tipo'] ?? '',
                'placa' => $v['Placa'] ?? '',
                'marca' => $v['Marca'] ?? '',
                'modelo' => $v['Modelo'] ?? '',
                'anio' => $v['Anio'] ?? '',
                'valor_fiscal' => (float) ($v['ValorFiscal'] ?? 0),
                'valor_prendas' => (float) ($v['ValorPrendas'] ?? 0),
                'embargos' => (int) ($v['Embargos'] ?? 0),
            ], $reporte['Vehiculos'] ?? []),
            'vehiculos_vinculados' => array_map(fn($v) => [
                'tipo' => $v['Tipo'] ?? '',
                'placa' => $v['Placa'] ?? '',
                'marca' => $v['Marca'] ?? '',
                'modelo' => $v['Modelo'] ?? '',
                'anio' => $v['Anio'] ?? '',
                'valor_fiscal' => (float) ($v['ValorFiscal'] ?? 0),
                'valor_prendas' => (float) ($v['ValorPrendas'] ?? 0),
                'embargos' => (int) ($v['Embargos'] ?? 0),
            ], $reporte['VehiculosVinculados'] ?? []),
            'propiedades' => array_map(fn($p) => [
                'numero' => $p['Numero'] ?? '',
                'medida' => $p['Medida'] ?? 0,
                'distrito' => $p['Distrito'] ?? '',
                'canton' => $p['Canton'] ?? '',
                'provincia' => $p['Provincia'] ?? '',
                'valor_fiscal' => (float) ($p['ValorFiscal'] ?? 0),
                'valor_hipotecas' => (float) ($p['ValorHipotecas'] ?? 0),
                'embargos' => (int) ($p['CantidadEmbargos'] ?? 0),
            ], $reporte['Propiedades'] ?? []),
            'propiedades_vinculadas' => array_map(fn($p) => [
                'numero' => $p['Numero'] ?? '',
                'medida' => $p['Medida'] ?? 0,
                'distrito' => $p['Distrito'] ?? '',
                'canton' => $p['Canton'] ?? '',
                'provincia' => $p['Provincia'] ?? '',
                'valor_fiscal' => (float) ($p['ValorFiscal'] ?? 0),
                'valor_hipotecas' => (float) ($p['ValorHipotecas'] ?? 0),
                'embargos' => (int) ($p['CantidadEmbargos'] ?? 0),
            ], $reporte['PropiedadesVinculadas'] ?? []),
            'representaciones' => array_map(fn($r) => [
                'nombre' => $r['Nombre'] ?? '',
                'identificacion' => $r['IdentificacionSociedad'] ?? '',
                'puesto' => $r['Descripcion'] ?? '',
                'representacion' => $r['Representacion'] ?? '',
            ], $reporte['Representaciones'] ?? []),
            'localizacion' => array_map(fn($l) => [
                'dato' => $l['Dato'] ?? '',
                'tipo' => $l['Tipo'] ?? '',
                'relacion' => $l['Relacion'] ?? '',
                'fecha' => $l['Fecha'] ?? '',
            ], $reporte['Localizacion'] ?? []),
            'pep' => $this->extraerPepDetalle($reporte),
            'apnfd' => array_map(fn($a) => [
                'actividad' => $a['Actividad'] ?? '',
                'clasificacion' => $a['Clasificacion'] ?? '',
                'condicion' => $a['Condicion'] ?? '',
            ], $reporte['APNFD'] ?? []),
            'listas_internacionales' => $this->extraerListasInternacionales($reporte),
            'ccss' => $reporte['CCSS'] ?? null,
            'fotografia' => $reporte['Fotografia'] ?? null,
            'consentimiento' => $reporte['Consentimiento'] ?? null,
        ];
    }

    /**
     * Sincronizar datos de Credid al Lead/Client.
     * Regla de prioridad: Cuestionario > Manual > Credid (solo auto-llena si vacío).
     */
    public function sincronizarLead(Person $lead, array $reporte): array
    {
        $filiacion = $reporte['FiliacionFisica'] ?? $reporte['FiliacionExtranjero'] ?? [];
        $camposActualizados = [];

        // Campos auto-llenables (no vienen del cuestionario)
        $autoFill = [
            'fecha_nacimiento' => $this->parseFechaCredid($filiacion['FechaNacimiento'] ?? null),
            'genero' => $filiacion['GeneroLiteral'] ?? null,
            'nacionalidad' => $filiacion['Nacionalidad'] ?? null,
            'cedula_vencimiento' => $this->parseFechaCredid($filiacion['VencimientoCedula'] ?? null),
            'profesion' => ($filiacion['Profesion'][0]['Descripcion'] ?? null),
            'province' => $filiacion['DomicilioElectoral']['Provincia'] ?? null,
            'canton' => $filiacion['DomicilioElectoral']['Canton'] ?? null,
            'distrito' => $filiacion['DomicilioElectoral']['Distrito'] ?? null,
        ];

        foreach ($autoFill as $campo => $valor) {
            if (!empty($valor) && empty($lead->{$campo})) {
                $lead->{$campo} = $valor;
                $camposActualizados[] = $campo;
            }
        }

        // Estado civil: solo si vacío (el cuestionario también lo llena)
        $matrimonioActual = $this->extraerMatrimonioActual($reporte);
        if (!empty($matrimonioActual) && empty($lead->estado_civil)) {
            $lead->estado_civil = $matrimonioActual['relacion'];
            $camposActualizados[] = 'estado_civil';
        }

        // Campos resumen queryables
        $vehiculos = $reporte['Vehiculos'] ?? [];
        $propiedades = $reporte['Propiedades'] ?? [];

        $lead->credid_data = $reporte;
        $lead->credid_consultado_at = now();
        $lead->indice_desarrollo_social = $filiacion['IndiceDesarrolloSocial']['Indice'] ?? null;
        $lead->nivel_desarrollo_social = $filiacion['IndiceDesarrolloSocial']['Nivel'] ?? null;
        $lead->total_vehiculos = count($vehiculos);
        $lead->total_propiedades = count($propiedades);
        $lead->patrimonio_vehiculos = collect($vehiculos)->sum('ValorFiscal');
        $lead->patrimonio_propiedades = collect($propiedades)->sum('ValorFiscal');
        $lead->total_hipotecas = collect($propiedades)->sum('ValorHipotecas');
        $lead->total_prendas = collect($vehiculos)->sum('ValorPrendas');
        $lead->es_pep = !empty($reporte['PEP']);
        $lead->en_listas_internacionales = !empty($reporte['ListasInternacionales']) &&
            collect($reporte['ListasInternacionales'])->sum('TotalExacto') > 0;
        $lead->total_hijos = $reporte['ParientesTotalHijos'] ?? null;

        $lead->save();

        return $camposActualizados;
    }

    private function extraerMatrimonioActual(array $reporte): ?array
    {
        $matrimonios = $reporte['Matrimonios'] ?? [];
        foreach ($matrimonios as $m) {
            if (!empty($m['Actual'])) {
                return [
                    'relacion' => $m['Relacion'] ?? '',
                    'nombre' => trim(($m['Nombre'] ?? '') . ' ' . ($m['Apellido1'] ?? '') . ' ' . ($m['Apellido2'] ?? '')),
                    'tiene_actividad_economica' => $m['TieneActividadEconomica'] ?? false,
                ];
            }
        }
        return null;
    }

    private function extraerListasInternacionales(array $reporte): array
    {
        $listas = $reporte['ListasInternacionales'] ?? [];
        if (empty($listas)) {
            return ['total_exacto' => 0, 'fuentes' => []];
        }

        $lista = $listas[0] ?? [];
        $fuentes = [];
        foreach ($lista['Datos'] ?? [] as $dato) {
            if (($dato['Status'] ?? 0) > 0) {
                $fuentes[] = [
                    'fuente' => $dato['Fuente'] ?? '',
                    'total' => $dato['Total'] ?? 0,
                ];
            }
        }

        return [
            'total_exacto' => $lista['TotalExacto'] ?? 0,
            'fuentes' => $fuentes,
        ];
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
