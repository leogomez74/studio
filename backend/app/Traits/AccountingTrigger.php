<?php

namespace App\Traits;

use App\Models\ErpAccountingAccount;
use App\Models\AccountingEntryConfig;
use App\Models\Deductora;
use App\Services\ErpAccountingService;
use Illuminate\Support\Facades\Log;

/**
 * AccountingTrigger Trait
 *
 * Dispara asientos contables al ERP externo en los puntos clave del sistema.
 * Lee los códigos de cuenta desde la tabla erp_accounting_accounts (configurables desde UI).
 * Si el ERP no está configurado o las cuentas no tienen código, solo loggea sin enviar.
 */
trait AccountingTrigger
{
    /**
     * Obtener instancia del servicio ERP
     */
    private function getErpService(): ErpAccountingService
    {
        return app(ErpAccountingService::class);
    }

    /**
     * Obtener código de cuenta contable por key
     */
    private function getAccountCode(string $key): ?string
    {
        return ErpAccountingAccount::getCode($key);
    }

    /**
     * NUEVO: Disparar asiento contable usando configuración dinámica
     *
     * @param string $entryType Tipo de asiento (PAGO_PLANILLA, PAGO_VENTANILLA, etc.)
     * @param float $amount Monto del asiento
     * @param string $reference Referencia del asiento
     * @param array $context Contexto adicional (deductora_id, lead_nombre, etc.)
     * @return array Resultado del envío
     */
    protected function triggerConfigurableEntry(string $entryType, float $amount, string $reference, array $context = []): array
    {
        $amount = round($amount, 2);

        // Log de auditoría
        Log::info('ACCOUNTING_API_TRIGGER: Asiento Configurable', [
            'trigger_type' => $entryType,
            'amount' => $amount,
            'reference' => $reference,
            'context' => $context,
        ]);

        // Buscar configuración activa para este tipo de asiento
        $config = AccountingEntryConfig::active()
            ->byType($entryType)
            ->with('lines')
            ->first();

        if (!$config || $config->lines->isEmpty()) {
            Log::warning('ERP: No hay configuración activa para este tipo de asiento', [
                'entry_type' => $entryType,
            ]);
            return ['success' => false, 'error' => 'No hay configuración para este tipo de asiento'];
        }

        // Verificar que el servicio esté configurado
        $service = $this->getErpService();
        if (!$service->isConfigured()) {
            return ['success' => false, 'error' => 'Servicio ERP no configurado', 'skipped' => true];
        }

        // Obtener desglose de montos desde el contexto
        $breakdown = $context['amount_breakdown'] ?? [
            'total' => $amount,
            'interes_corriente' => 0,
            'interes_moratorio' => 0,
            'poliza' => 0,
            'capital' => $amount,
            'cargos_adicionales_total' => 0,
            'cargos_adicionales' => [],
        ];

        // Preparar variables para reemplazo en descripciones
        $variables = [
            '{reference}' => $reference,
            '{amount}' => number_format($amount, 2),
            '{clienteNombre}' => $context['lead_nombre'] ?? 'N/A',
            '{cedula}' => $context['cedula'] ?? '',
            '{credit_id}' => $context['credit_id'] ?? '',
            '{deductora_nombre}' => $context['deductora_nombre'] ?? '',
        ];

        // Construir items del asiento desde la configuración
        $items = [];
        foreach ($config->lines as $line) {
            $accountCode = null;
            $deductoraContextNombre = null;

            // Resolver código de cuenta según el tipo
            if ($line->account_type === 'fixed') {
                // Cuenta fija desde erp_accounting_accounts
                $accountCode = $this->getAccountCode($line->account_key);
            } elseif ($line->account_type === 'deductora') {
                // Cuenta dinámica por deductora
                $deductoraId = $context['deductora_id'] ?? null;
                if ($deductoraId) {
                    $deductora = Deductora::find($deductoraId);
                    if ($deductora && $deductora->erp_account_key) {
                        $accountCode = $this->getAccountCode($deductora->erp_account_key);
                        $deductoraContextNombre = $deductora->nombre;
                    }
                }
            }

            if (!$accountCode) {
                Log::warning('ERP: No se pudo resolver código de cuenta', [
                    'line_id' => $line->id,
                    'account_type' => $line->account_type,
                    'account_key' => $line->account_key,
                ]);
                continue;
            }

            // Resolver monto según el componente
            $lineAmount = $this->resolveLineAmount($line, $breakdown, $amount);

            // Si el monto es 0, skip esta línea (componente no aplicado en este pago)
            if ($lineAmount == 0) {
                Log::info('ERP: Línea omitida por monto cero', [
                    'line_id' => $line->id,
                    'amount_component' => $line->amount_component,
                    'cargo_adicional_key' => $line->cargo_adicional_key,
                ]);
                continue;
            }

            // Reemplazar variables en la descripción de la línea
            $lineDescription = $line->description ?? $config->name;
            if ($deductoraContextNombre) {
                // Si esta línea es de tipo deductora, agregar el nombre de la deductora
                $variables['{deductora_nombre}'] = $deductoraContextNombre;
            }
            $lineDescription = str_replace(array_keys($variables), array_values($variables), $lineDescription);

            // Construir línea del asiento
            $items[] = [
                'account_code' => $accountCode,
                'debit' => $line->movement_type === 'debit' ? $lineAmount : 0,
                'credit' => $line->movement_type === 'credit' ? $lineAmount : 0,
                'description' => $lineDescription,
            ];
        }

        if (empty($items)) {
            Log::error('ERP: No se pudieron construir líneas del asiento', [
                'entry_type' => $entryType,
            ]);
            return ['success' => false, 'error' => 'No se pudieron construir líneas del asiento'];
        }

        // Enviar al ERP
        $clienteNombre = $context['lead_nombre'] ?? 'N/A';
        $cedula = $context['cedula'] ?? '';

        // Reemplazar variables en la descripción principal del asiento
        $mainDescription = $config->description ?? $config->name;
        $mainDescriptionResolved = str_replace(array_keys($variables), array_values($variables), $mainDescription);

        // Si no tiene variables, usar formato legacy
        if ($mainDescription === $mainDescriptionResolved && !str_contains($mainDescription, '{')) {
            $mainDescriptionResolved = "{$config->name} {$reference} - {$clienteNombre} ({$cedula})";
        }

        $result = $service->createJournalEntry(
            date: now()->format('Y-m-d'),
            description: $mainDescriptionResolved,
            items: $items,
            reference: strtoupper($entryType) . "-{$reference}"
        );

        if (!($result['success'] ?? false) && !($result['skipped'] ?? false)) {
            Log::critical('ACCOUNTING: Fallo al enviar asiento configurable', [
                'entry_type' => $entryType,
                'error' => $result['error'] ?? 'Desconocido',
            ]);
        }

        return $result;
    }

    /**
     * Resolver el monto de una línea según su componente
     *
     * @param \App\Models\AccountingEntryLine $line
     * @param array $breakdown Desglose de montos
     * @param float $totalAmount Monto total
     * @return float
     */
    private function resolveLineAmount($line, array $breakdown, float $totalAmount): float
    {
        $component = $line->amount_component ?? 'total';

        return match($component) {
            'total' => $breakdown['total'] ?? $totalAmount,
            'interes_corriente' => $breakdown['interes_corriente'] ?? 0,
            'interes_moratorio' => $breakdown['interes_moratorio'] ?? 0,
            'poliza' => $breakdown['poliza'] ?? 0,
            'capital' => $breakdown['capital'] ?? 0,
            'cargo_adicional' => $this->resolveCargosAdicionales($breakdown, $line->cargo_adicional_key),
            default => $breakdown['total'] ?? $totalAmount,
        };
    }

    /**
     * Resolver monto de un cargo adicional específico
     *
     * @param array $breakdown Desglose de montos
     * @param string|null $cargoKey Key del cargo adicional
     * @return float
     */
    private function resolveCargosAdicionales(array $breakdown, ?string $cargoKey): float
    {
        if (!$cargoKey) {
            // Si no especifica cuál, usar el total de todos los cargos
            return $breakdown['cargos_adicionales_total'] ?? 0;
        }

        // Buscar el cargo específico en el desglose
        $cargos = $breakdown['cargos_adicionales'] ?? [];
        return $cargos[$cargoKey] ?? 0;
    }

    /**
     * ACCOUNTING_API_TRIGGER: Formalización de Crédito
     *
     * Asiento: DÉBITO Cuentas por Cobrar / CRÉDITO Banco CREDIPEPE
     */
    protected function triggerAccountingFormalizacion(int $creditId, float $amount, string $reference, array $additionalData = [])
    {
        $codBanco = $this->getAccountCode('banco_credipepe');
        $codCxC = $this->getAccountCode('cuentas_por_cobrar');
        $amount = round($amount, 2);

        // Log siempre (auditoría)
        Log::info('ACCOUNTING_API_TRIGGER: Formalización de Crédito', [
            'trigger_type' => 'FORMALIZACION',
            'credit_id' => $creditId,
            'amount' => $amount,
            'reference' => $reference,
            'additional_data' => $additionalData,
        ]);

        // Si las cuentas no están configuradas, no enviar
        if (!$codBanco || !$codCxC) {
            Log::warning('ERP: Cuentas contables no configuradas. Asiento de formalización NO enviado.', [
                'credit_id' => $creditId,
                'banco_code' => $codBanco,
                'cxc_code' => $codCxC,
            ]);
            return;
        }

        $service = $this->getErpService();
        if (!$service->isConfigured()) {
            return;
        }

        $clienteNombre = $additionalData['lead_nombre'] ?? 'N/A';
        $cedula = $additionalData['lead_cedula'] ?? '';

        $result = $service->createJournalEntry(
            date: now()->format('Y-m-d'),
            description: "Formalización crédito {$reference} - {$clienteNombre} ({$cedula})",
            items: [
                [
                    'account_code' => $codCxC,
                    'debit' => $amount,
                    'credit' => 0,
                    'description' => "Cuenta por cobrar - Crédito {$reference}",
                ],
                [
                    'account_code' => $codBanco,
                    'debit' => 0,
                    'credit' => $amount,
                    'description' => "Desembolso crédito {$reference}",
                ],
            ],
            reference: "FORM-{$reference}"
        );

        if (!($result['success'] ?? false) && !($result['skipped'] ?? false)) {
            Log::critical('ACCOUNTING: Fallo al enviar asiento de formalización', [
                'credit_id' => $creditId,
                'error' => $result['error'] ?? 'Desconocido',
            ]);
        }
    }

    /**
     * ACCOUNTING_API_TRIGGER: Pago de Crédito (todos los orígenes)
     *
     * Asiento: DÉBITO Banco CREDIPEPE / CRÉDITO Cuentas por Cobrar
     */
    protected function triggerAccountingPago(int $creditId, int $paymentId, float $amount, string $source, array $breakdown = [])
    {
        $codBanco = $this->getAccountCode('banco_credipepe');
        $codCxC = $this->getAccountCode('cuentas_por_cobrar');
        $amount = round($amount, 2);

        Log::info('ACCOUNTING_API_TRIGGER: Pago de Crédito', [
            'trigger_type' => 'PAGO',
            'credit_id' => $creditId,
            'payment_id' => $paymentId,
            'amount' => $amount,
            'source' => $source,
            'breakdown' => $breakdown,
        ]);

        if (!$codBanco || !$codCxC) {
            Log::warning('ERP: Cuentas contables no configuradas. Asiento de pago NO enviado.', [
                'credit_id' => $creditId,
                'payment_id' => $paymentId,
            ]);
            return;
        }

        $service = $this->getErpService();
        if (!$service->isConfigured()) {
            return;
        }

        $creditRef = $breakdown['credit_reference'] ?? "CRED-{$creditId}";
        $cedula = $breakdown['cedula'] ?? '';
        $clienteNombre = $breakdown['lead_nombre'] ?? '';

        $result = $service->createJournalEntry(
            date: now()->format('Y-m-d'),
            description: "Pago {$source} - Crédito {$creditRef} - {$clienteNombre} ({$cedula})",
            items: [
                [
                    'account_code' => $codBanco,
                    'debit' => $amount,
                    'credit' => 0,
                    'description' => "Cobro {$source} - {$creditRef}",
                ],
                [
                    'account_code' => $codCxC,
                    'debit' => 0,
                    'credit' => $amount,
                    'description' => "Reducción CxC - {$creditRef}",
                ],
            ],
            reference: "PAG-{$paymentId}-{$creditRef}"
        );

        if (!($result['success'] ?? false) && !($result['skipped'] ?? false)) {
            Log::critical('ACCOUNTING: Fallo al enviar asiento de pago', [
                'credit_id' => $creditId,
                'payment_id' => $paymentId,
                'error' => $result['error'] ?? 'Desconocido',
            ]);
        }
    }

    /**
     * ACCOUNTING_API_TRIGGER: Pago por Planilla (Deducción Automática)
     *
     * Asiento: DÉBITO Banco CREDIPEPE / CRÉDITO Cuentas por Cobrar
     */
    protected function triggerAccountingPagoPlanilla(int $creditId, int $paymentId, float $amount, array $breakdown = [])
    {
        $codBanco = $this->getAccountCode('banco_credipepe');
        $codCxC = $this->getAccountCode('cuentas_por_cobrar');
        $amount = round($amount, 2);

        Log::info('ACCOUNTING_API_TRIGGER: Pago por Planilla', [
            'trigger_type' => 'PAGO_PLANILLA',
            'credit_id' => $creditId,
            'payment_id' => $paymentId,
            'amount' => $amount,
            'breakdown' => $breakdown,
        ]);

        if (!$codBanco || !$codCxC) {
            Log::warning('ERP: Cuentas contables no configuradas. Asiento de planilla NO enviado.', [
                'credit_id' => $creditId,
                'payment_id' => $paymentId,
            ]);
            return;
        }

        $service = $this->getErpService();
        if (!$service->isConfigured()) {
            return;
        }

        $creditRef = $breakdown['credit_reference'] ?? "CRED-{$creditId}";
        $cedula = $breakdown['cedula'] ?? '';
        $clienteNombre = $breakdown['lead_nombre'] ?? '';
        $deductora = $breakdown['deductora_nombre'] ?? '';

        $result = $service->createJournalEntry(
            date: now()->format('Y-m-d'),
            description: "Deducción planilla {$deductora} - {$clienteNombre} ({$cedula}) - {$creditRef}",
            items: [
                [
                    'account_code' => $codBanco,
                    'debit' => $amount,
                    'credit' => 0,
                    'description' => "Cobro planilla {$deductora} - {$creditRef}",
                ],
                [
                    'account_code' => $codCxC,
                    'debit' => 0,
                    'credit' => $amount,
                    'description' => "Reducción CxC planilla - {$creditRef}",
                ],
            ],
            reference: "PLAN-{$paymentId}-{$creditRef}"
        );

        if (!($result['success'] ?? false) && !($result['skipped'] ?? false)) {
            Log::critical('ACCOUNTING: Fallo al enviar asiento de planilla', [
                'credit_id' => $creditId,
                'payment_id' => $paymentId,
                'error' => $result['error'] ?? 'Desconocido',
            ]);
        }
    }

    /**
     * ACCOUNTING_API_TRIGGER: Pago de Ventanilla (Pago Manual)
     *
     * Asiento: DÉBITO Banco CREDIPEPE / CRÉDITO Cuentas por Cobrar
     */
    protected function triggerAccountingPagoVentanilla(int $creditId, int $paymentId, float $amount, array $breakdown = [])
    {
        $codBanco = $this->getAccountCode('banco_credipepe');
        $codCxC = $this->getAccountCode('cuentas_por_cobrar');
        $amount = round($amount, 2);

        Log::info('ACCOUNTING_API_TRIGGER: Pago de Ventanilla', [
            'trigger_type' => 'PAGO_VENTANILLA',
            'credit_id' => $creditId,
            'payment_id' => $paymentId,
            'amount' => $amount,
            'breakdown' => $breakdown,
        ]);

        if (!$codBanco || !$codCxC) {
            Log::warning('ERP: Cuentas contables no configuradas. Asiento de ventanilla NO enviado.', [
                'credit_id' => $creditId,
                'payment_id' => $paymentId,
            ]);
            return;
        }

        $service = $this->getErpService();
        if (!$service->isConfigured()) {
            return;
        }

        $creditRef = $breakdown['credit_reference'] ?? "CRED-{$creditId}";
        $cedula = $breakdown['cedula'] ?? '';
        $clienteNombre = $breakdown['lead_nombre'] ?? '';

        $result = $service->createJournalEntry(
            date: now()->format('Y-m-d'),
            description: "Pago ventanilla - {$clienteNombre} ({$cedula}) - {$creditRef}",
            items: [
                [
                    'account_code' => $codBanco,
                    'debit' => $amount,
                    'credit' => 0,
                    'description' => "Cobro ventanilla - {$creditRef}",
                ],
                [
                    'account_code' => $codCxC,
                    'debit' => 0,
                    'credit' => $amount,
                    'description' => "Reducción CxC - {$creditRef}",
                ],
            ],
            reference: "VENT-{$paymentId}-{$creditRef}"
        );

        if (!($result['success'] ?? false) && !($result['skipped'] ?? false)) {
            Log::critical('ACCOUNTING: Fallo al enviar asiento de ventanilla', [
                'credit_id' => $creditId,
                'payment_id' => $paymentId,
                'error' => $result['error'] ?? 'Desconocido',
            ]);
        }
    }

    /**
     * ACCOUNTING_API_TRIGGER: Abono Extraordinario
     *
     * Asiento: DÉBITO Banco CREDIPEPE / CRÉDITO Cuentas por Cobrar
     */
    protected function triggerAccountingAbonoExtraordinario(int $creditId, int $paymentId, float $amount, array $breakdown = [])
    {
        $codBanco = $this->getAccountCode('banco_credipepe');
        $codCxC = $this->getAccountCode('cuentas_por_cobrar');
        $amount = round($amount, 2);

        Log::info('ACCOUNTING_API_TRIGGER: Abono Extraordinario', [
            'trigger_type' => 'ABONO_EXTRAORDINARIO',
            'credit_id' => $creditId,
            'payment_id' => $paymentId,
            'amount' => $amount,
            'breakdown' => $breakdown,
        ]);

        if (!$codBanco || !$codCxC) {
            Log::warning('ERP: Cuentas contables no configuradas. Asiento de abono extraordinario NO enviado.', [
                'credit_id' => $creditId,
                'payment_id' => $paymentId,
            ]);
            return;
        }

        $service = $this->getErpService();
        if (!$service->isConfigured()) {
            return;
        }

        $creditRef = $breakdown['credit_reference'] ?? "CRED-{$creditId}";
        $cedula = $breakdown['cedula'] ?? '';
        $clienteNombre = $breakdown['lead_nombre'] ?? '';
        $penalizacion = $breakdown['penalizacion'] ?? 0;

        $descripcion = "Abono extraordinario - {$clienteNombre} ({$cedula}) - {$creditRef}";
        if ($penalizacion > 0) {
            $descripcion .= " (Penalización: ₡" . number_format($penalizacion, 2) . ")";
        }

        $result = $service->createJournalEntry(
            date: now()->format('Y-m-d'),
            description: $descripcion,
            items: [
                [
                    'account_code' => $codBanco,
                    'debit' => $amount,
                    'credit' => 0,
                    'description' => "Abono extraordinario - {$creditRef}",
                ],
                [
                    'account_code' => $codCxC,
                    'debit' => 0,
                    'credit' => $amount,
                    'description' => "Reducción CxC extraordinaria - {$creditRef}",
                ],
            ],
            reference: "EXTRA-{$paymentId}-{$creditRef}"
        );

        if (!($result['success'] ?? false) && !($result['skipped'] ?? false)) {
            Log::critical('ACCOUNTING: Fallo al enviar asiento de abono extraordinario', [
                'credit_id' => $creditId,
                'payment_id' => $paymentId,
                'error' => $result['error'] ?? 'Desconocido',
            ]);
        }
    }

    /**
     * ACCOUNTING_API_TRIGGER: Devolución/Anulación de Pago (reversa)
     *
     * Asiento: DÉBITO Cuentas por Cobrar / CRÉDITO Banco CREDIPEPE
     */
    protected function triggerAccountingDevolucion(int $creditId, ?int $paymentId, float $amount, string $reason, array $additionalData = [])
    {
        $codBanco = $this->getAccountCode('banco_credipepe');
        $codCxC = $this->getAccountCode('cuentas_por_cobrar');
        $amount = round($amount, 2);

        Log::info('ACCOUNTING_API_TRIGGER: Devolución/Anulación', [
            'trigger_type' => 'DEVOLUCION',
            'credit_id' => $creditId,
            'payment_id' => $paymentId,
            'amount' => $amount,
            'reason' => $reason,
            'additional_data' => $additionalData,
        ]);

        if (!$codBanco || !$codCxC) {
            Log::warning('ERP: Cuentas contables no configuradas. Asiento de devolución NO enviado.', [
                'credit_id' => $creditId,
            ]);
            return;
        }

        $service = $this->getErpService();
        if (!$service->isConfigured()) {
            return;
        }

        $creditRef = $additionalData['credit_reference'] ?? "CRED-{$creditId}";

        $result = $service->createJournalEntry(
            date: now()->format('Y-m-d'),
            description: "Reversa pago - {$reason} - Crédito {$creditRef}",
            items: [
                [
                    'account_code' => $codCxC,
                    'debit' => $amount,
                    'credit' => 0,
                    'description' => "Reversa CxC - {$creditRef}",
                ],
                [
                    'account_code' => $codBanco,
                    'debit' => 0,
                    'credit' => $amount,
                    'description' => "Reversa banco - {$creditRef}",
                ],
            ],
            reference: "REV-{$paymentId}-{$creditRef}"
        );

        if (!($result['success'] ?? false) && !($result['skipped'] ?? false)) {
            Log::critical('ACCOUNTING: Fallo al enviar asiento de devolución', [
                'credit_id' => $creditId,
                'payment_id' => $paymentId,
                'error' => $result['error'] ?? 'Desconocido',
            ]);
        }
    }

    /**
     * ACCOUNTING_API_TRIGGER: Refundición - Cierre de Crédito Viejo
     *
     * Asiento: DÉBITO Banco CREDIPEPE / CRÉDITO Cuentas por Cobrar
     */
    protected function triggerAccountingRefundicionCierre(int $oldCreditId, float $balanceAbsorbed, int $newCreditId)
    {
        $codBanco = $this->getAccountCode('banco_credipepe');
        $codCxC = $this->getAccountCode('cuentas_por_cobrar');
        $balanceAbsorbed = round($balanceAbsorbed, 2);

        Log::info('ACCOUNTING_API_TRIGGER: Refundición - Cierre', [
            'trigger_type' => 'REFUNDICION_CIERRE',
            'old_credit_id' => $oldCreditId,
            'new_credit_id' => $newCreditId,
            'balance_absorbed' => $balanceAbsorbed,
        ]);

        if (!$codBanco || !$codCxC) {
            return;
        }

        $service = $this->getErpService();
        if (!$service->isConfigured()) {
            return;
        }

        $result = $service->createJournalEntry(
            date: now()->format('Y-m-d'),
            description: "Refundición - Cierre crédito #{$oldCreditId} absorbido por #{$newCreditId}",
            items: [
                [
                    'account_code' => $codBanco,
                    'debit' => $balanceAbsorbed,
                    'credit' => 0,
                    'description' => "Absorción saldo crédito #{$oldCreditId}",
                ],
                [
                    'account_code' => $codCxC,
                    'debit' => 0,
                    'credit' => $balanceAbsorbed,
                    'description' => "Cierre CxC crédito #{$oldCreditId}",
                ],
            ],
            reference: "REF-CIERRE-{$oldCreditId}"
        );

        if (!($result['success'] ?? false) && !($result['skipped'] ?? false)) {
            Log::critical('ACCOUNTING: Fallo al enviar asiento de refundición (cierre)', [
                'old_credit_id' => $oldCreditId,
                'error' => $result['error'] ?? 'Desconocido',
            ]);
        }
    }

    /**
     * ACCOUNTING_API_TRIGGER: Refundición - Formalización de Nuevo Crédito
     *
     * Asiento: DÉBITO Cuentas por Cobrar / CRÉDITO Banco CREDIPEPE
     */
    protected function triggerAccountingRefundicionNuevo(int $newCreditId, float $amount, int $oldCreditId, float $cashDelivered)
    {
        $codBanco = $this->getAccountCode('banco_credipepe');
        $codCxC = $this->getAccountCode('cuentas_por_cobrar');
        $amount = round($amount, 2);

        Log::info('ACCOUNTING_API_TRIGGER: Refundición - Nuevo Crédito', [
            'trigger_type' => 'REFUNDICION_NUEVO',
            'new_credit_id' => $newCreditId,
            'old_credit_id' => $oldCreditId,
            'total_amount' => $amount,
            'cash_delivered' => $cashDelivered,
        ]);

        if (!$codBanco || !$codCxC) {
            return;
        }

        $service = $this->getErpService();
        if (!$service->isConfigured()) {
            return;
        }

        $result = $service->createJournalEntry(
            date: now()->format('Y-m-d'),
            description: "Refundición - Nuevo crédito #{$newCreditId} (reemplaza #{$oldCreditId})",
            items: [
                [
                    'account_code' => $codCxC,
                    'debit' => $amount,
                    'credit' => 0,
                    'description' => "Nueva CxC crédito #{$newCreditId}",
                ],
                [
                    'account_code' => $codBanco,
                    'debit' => 0,
                    'credit' => $amount,
                    'description' => "Desembolso refundición #{$newCreditId}",
                ],
            ],
            reference: "REF-NUEVO-{$newCreditId}"
        );

        if (!($result['success'] ?? false) && !($result['skipped'] ?? false)) {
            Log::critical('ACCOUNTING: Fallo al enviar asiento de refundición (nuevo)', [
                'new_credit_id' => $newCreditId,
                'error' => $result['error'] ?? 'Desconocido',
            ]);
        }
    }
}
