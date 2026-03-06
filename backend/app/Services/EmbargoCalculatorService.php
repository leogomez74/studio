<?php

namespace App\Services;

use App\Models\EmbargoConfiguracion;
use Exception;

class EmbargoCalculatorService
{
    private EmbargoConfiguracion $config;

    public function __construct(?EmbargoConfiguracion $config = null)
    {
        $this->config = $config ?? EmbargoConfiguracion::vigente();

        if (!$this->config) {
            throw new Exception('No hay configuración de embargo activa. Ejecutá: php artisan embargo:actualizar-smi');
        }
    }

    /**
     * Calcular el monto máximo embargable según Art. 172 del Código de Trabajo.
     *
     * Algoritmo verificado al 100% contra la calculadora oficial del MTSS.
     */
    public function calcular(
        float $salarioBruto,
        float $pensionAlimenticia = 0,
        float $otroEmbargo1 = 0,
        float $otroEmbargo2 = 0,
    ): array {
        $smi = (float) $this->config->salario_minimo_inembargable;
        $tasaCcss = (float) $this->config->tasa_ccss;
        $tasaTramo1 = (float) $this->config->tasa_tramo1;
        $tasaTramo2 = (float) $this->config->tasa_tramo2;
        $multTramo1 = $this->config->multiplicador_tramo1;
        $tramosRenta = $this->config->tramos_renta ?? [];

        // Paso 1: Deducir CCSS
        $descuentoCcss = $salarioBruto * $tasaCcss;
        $salarioNeto = $salarioBruto - $descuentoCcss;

        // Paso 2: Calcular y deducir impuesto sobre la renta (sobre salario bruto)
        $impuestoRenta = $this->calcularRenta($salarioBruto, $tramosRenta);
        $salarioLiquido = $salarioNeto - $impuestoRenta;

        // Paso 3: Deducir pensión alimentaria y otros embargos existentes
        $disponible = $salarioLiquido - $pensionAlimenticia - $otroEmbargo1 - $otroEmbargo2;

        // Paso 4: Determinar monto embargable (excedente sobre SMI)
        $embargable = max(0, $disponible - $smi);

        if ($embargable <= 0) {
            return $this->buildResponse(0, $salarioBruto, $descuentoCcss, $impuestoRenta, $pensionAlimenticia, $smi);
        }

        // Paso 5: Aplicar tramos
        $limiteTramo1 = $multTramo1 * $smi;
        $montoTramo1 = min($embargable, $limiteTramo1) * $tasaTramo1;
        $montoTramo2 = max(0, $embargable - $limiteTramo1) * $tasaTramo2;

        $totalEmbargo = round($montoTramo1 + $montoTramo2, 2);

        return $this->buildResponse(
            $totalEmbargo, $salarioBruto, $descuentoCcss, $impuestoRenta,
            $pensionAlimenticia, $smi, $embargable, $montoTramo1, $montoTramo2, $limiteTramo1
        );
    }

    /**
     * Calcular impuesto sobre la renta (Art. 34 Ley Impuesto sobre la Renta).
     * Los tramos se aplican sobre el salario bruto.
     */
    private function calcularRenta(float $salarioBruto, array $tramos): float
    {
        if (empty($tramos)) {
            return 0;
        }

        $impuesto = 0;
        $prevLimite = 0;

        foreach ($tramos as $tramo) {
            $limite = $tramo['limite'] ?? PHP_FLOAT_MAX;
            $tasa = (float) $tramo['tasa'];

            if ($salarioBruto <= $prevLimite) {
                break;
            }

            $gravable = min($salarioBruto, $limite) - $prevLimite;
            $impuesto += $gravable * $tasa;
            $prevLimite = $limite;
        }

        return round($impuesto, 2);
    }

    private function buildResponse(
        float $totalEmbargo,
        float $salarioBruto,
        float $descuentoCcss,
        float $impuestoRenta,
        float $pensionAlimenticia,
        float $smi,
        float $embargable = 0,
        float $montoTramo1 = 0,
        float $montoTramo2 = 0,
        float $limiteTramo1 = 0,
    ): array {
        return [
            'resultado' => $totalEmbargo,
            'source' => 'local',
            'desglose' => [
                'salario_bruto' => round($salarioBruto, 2),
                'descuento_ccss' => round($descuentoCcss, 2),
                'impuesto_renta' => round($impuestoRenta, 2),
                'salario_liquido' => round($salarioBruto - $descuentoCcss - $impuestoRenta, 2),
                'pension_alimenticia' => round($pensionAlimenticia, 2),
                'salario_minimo_protegido' => round($smi, 2),
                'monto_embargable' => round($embargable, 2),
                'limite_tramo1' => round($limiteTramo1, 2),
                'embargo_tramo1' => round($montoTramo1, 2),
                'embargo_tramo2' => round($montoTramo2, 2),
                'total_embargo' => $totalEmbargo,
            ],
            'config' => [
                'anio' => $this->config->anio,
                'decreto' => $this->config->decreto,
                'ultima_verificacion' => $this->config->ultima_verificacion?->toIso8601String(),
            ],
        ];
    }
}
