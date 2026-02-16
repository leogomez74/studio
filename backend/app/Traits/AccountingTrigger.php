<?php

namespace App\Traits;

use App\Models\ErpAccountingAccount;
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
