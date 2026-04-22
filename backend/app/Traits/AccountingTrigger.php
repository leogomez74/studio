<?php

namespace App\Traits;

use App\Models\ErpAccountingAccount;
use App\Models\AccountingEntryConfig;
use App\Models\AccountingEntryLog;
use App\Models\Deductora;
use App\Models\Investor;
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
     * Verificar si debe usar sistema configurable para este tipo de asiento
     */
    private function shouldUseConfigurable(string $entryType): bool
    {
        // Feature flag global
        if (config('accounting.use_configurable_system', false)) {
            return true;
        }

        // Feature flag por tipo
        return config("accounting.use_configurable_by_type.{$entryType}", false);
    }

    /**
     * Método unificado para disparar asientos (configurable o legacy)
     *
     * Este es el método que deben llamar los controladores.
     * Decide automáticamente si usar el sistema configurable o el legacy.
     */
    protected function triggerAccountingEntry(
        string $entryType,
        float $amount,
        string $reference,
        array $context = []
    ): array {
        // #3: Verificar duplicados antes de procesar
        $isDuplicate = AccountingEntryLog::isDuplicate($entryType, $reference)->exists();
        if ($isDuplicate) {
            Log::warning('ERP: Asiento duplicado detectado, no se enviará', [
                'entry_type' => $entryType,
                'reference' => $reference,
            ]);
            return ['success' => false, 'error' => 'Asiento duplicado detectado', 'duplicate' => true];
        }

        // Si debe usar configurable, intentarlo primero
        if ($this->shouldUseConfigurable($entryType)) {
            $result = $this->triggerConfigurableEntry($entryType, $amount, $reference, $context);

            // Si funcionó, disparar cascada si aplica y retornar
            if ($result['success'] ?? false) {
                $this->triggerCascadeEntries($entryType, $reference, $context, $result);
                return $result;
            }

            // Si falló porque no hay configuración, usar fallback
            if (str_contains($result['error'] ?? '', 'No hay configuración')) {
                Log::warning("ERP: No hay configuración para {$entryType}, usando método legacy como fallback");
                $result = $this->fallbackToLegacy($entryType, $amount, $reference, $context);
                if ($result['success'] ?? false) {
                    $this->triggerCascadeEntries($entryType, $reference, $context, $result);
                }
                return $result;
            }

            // Otro error, retornar
            return $result;
        }

        // Si no debe usar configurable, usar legacy directamente
        $result = $this->fallbackToLegacy($entryType, $amount, $reference, $context);
        if ($result['success'] ?? false) {
            $this->triggerCascadeEntries($entryType, $reference, $context, $result);
        }
        return $result;
    }

    /**
     * Fallback a métodos legacy cuando no hay configuración
     */
    private function fallbackToLegacy(
        string $entryType,
        float $amount,
        string $reference,
        array $context
    ): array {
        Log::info("ERP: Usando método legacy para {$entryType}");

        $log = AccountingEntryLog::createPending($entryType, $amount, $reference, $context, 'legacy');

        // Normalizar context: agregar aliases que los métodos legacy esperan
        // Controllers usan clienteNombre/cedula, legacy espera lead_nombre/lead_cedula/credit_reference
        $context['lead_nombre'] = $context['lead_nombre'] ?? $context['clienteNombre'] ?? '';
        $context['lead_cedula'] = $context['lead_cedula'] ?? $context['cedula'] ?? '';
        $context['credit_reference'] = $context['credit_reference'] ?? $context['credit_id'] ?? $reference;

        // IDs numéricos (usados solo en logs y refs internas de los métodos legacy)
        $creditId = (int) ($context['credit_numeric_id'] ?? 0);
        $paymentId = (int) ($context['payment_id'] ?? 0);

        $result = match($entryType) {
            'FORMALIZACION' => $this->triggerAccountingFormalizacion(
                creditId: $creditId,
                amount: $amount,
                reference: $reference,
                additionalData: $context
            ),

            'PAGO_PLANILLA' => $this->triggerAccountingPagoPlanilla(
                creditId: $creditId,
                paymentId: $paymentId,
                amount: $amount,
                breakdown: $context
            ),

            'PAGO_VENTANILLA' => $this->triggerAccountingPagoVentanilla(
                creditId: $creditId,
                paymentId: $paymentId,
                amount: $amount,
                breakdown: $context
            ),

            // Saldo pendiente aplicado a cuota — mismo asiento que ventanilla pero origen distinto
            'PAGO_SALDO_PENDIENTE' => $this->triggerAccountingPagoVentanilla(
                creditId: $creditId,
                paymentId: $paymentId,
                amount: $amount,
                breakdown: array_merge($context, ['trigger_type' => 'PAGO_SALDO_PENDIENTE', 'source' => 'Saldo Pendiente'])
            ),

            // Reverso de un saldo pendiente aplicado a cuota
            'ANULACION_SALDO_APLICADO' => $this->triggerAccountingDevolucion(
                creditId: $creditId,
                paymentId: $paymentId,
                amount: $amount,
                reason: 'Anulación de saldo pendiente aplicado a cuota',
                additionalData: array_merge($context, ['trigger_type' => 'ANULACION_SALDO_APLICADO'])
            ),

            // Reverso de un saldo aplicado como abono a capital
            'ANULACION_ABONO_CAPITAL' => $this->triggerAccountingDevolucion(
                creditId: $creditId,
                paymentId: $paymentId,
                amount: $amount,
                reason: 'Anulación de abono a capital desde saldo pendiente',
                additionalData: array_merge($context, ['trigger_type' => 'ANULACION_ABONO_CAPITAL'])
            ),

            // Reverso de un reintegro de saldo al cliente
            'ANULACION_REINTEGRO_SALDO' => $this->triggerAccountingDevolucion(
                creditId: $creditId,
                paymentId: $paymentId,
                amount: $amount,
                reason: 'Anulación de reintegro de saldo',
                additionalData: array_merge($context, ['trigger_type' => 'ANULACION_REINTEGRO_SALDO'])
            ),

            'ABONO_EXTRAORDINARIO' => $this->triggerAccountingAbonoExtraordinario(
                creditId: $creditId,
                paymentId: $paymentId,
                amount: $amount,
                breakdown: $context
            ),

            'CANCELACION_ANTICIPADA', 'PAGO' => $this->triggerAccountingPago(
                creditId: $creditId,
                paymentId: $paymentId,
                amount: $amount,
                source: $context['source'] ?? 'Legacy',
                breakdown: $context
            ),

            'REFUNDICION_CIERRE' => $this->triggerAccountingRefundicionCierre(
                oldCreditId: $creditId,
                balanceAbsorbed: $amount,
                newCreditId: (int) ($context['new_credit_numeric_id'] ?? 0)
            ),

            'REFUNDICION_NUEVO' => $this->triggerAccountingRefundicionNuevo(
                newCreditId: $creditId,
                amount: $amount,
                oldCreditId: (int) ($context['old_credit_numeric_id'] ?? 0),
                cashDelivered: (float) ($context['monto_entregado'] ?? 0)
            ),

            'DEVOLUCION' => $this->triggerAccountingDevolucion(
                creditId: $creditId,
                paymentId: $paymentId > 0 ? $paymentId : null,
                amount: $amount,
                reason: $context['reason'] ?? 'Devolución',
                additionalData: $context
            ),

            'REVERSO_PAGO', 'ANULACION_PLANILLA' => $this->triggerAccountingDevolucion(
                creditId: $creditId,
                paymentId: $paymentId > 0 ? $paymentId : null,
                amount: $amount,
                reason: $context['motivo'] ?? $context['reason'] ?? 'Reverso de pago',
                additionalData: $context
            ),

            'INV_CAPITAL_RECIBIDO' => $this->triggerAccountingInversionRecibida(
                investmentId: (int) ($context['investment_id'] ?? 0),
                monto: $amount,
                moneda: $context['moneda'] ?? 'CRC',
                investorNombre: $context['investor_nombre'] ?? 'N/A'
            ),

            'INV_INTERES_DEVENGADO', 'INV_RETENCION_INTERES' => $this->triggerAccountingInteresInversion(
                investmentId: (int) ($context['investment_id'] ?? 0),
                couponId: (int) ($context['coupon_id'] ?? 0),
                interesNeto: (float) ($context['amount_breakdown']['interes_neto'] ?? $amount),
                retencion: (float) ($context['amount_breakdown']['retencion'] ?? 0),
                moneda: $context['moneda'] ?? 'CRC',
                investorNombre: $context['investor_nombre'] ?? 'N/A'
            ),

            // Tipos de inversión solo disponibles en sistema configurable
            'INV_CANCELACION_TOTAL', 'INV_PAGO_CAPITAL' => [
                'success' => false,
                'skipped' => true,
                'error' => "Tipo '{$entryType}' requiere configuración en la UI de asientos contables.",
            ],

            // Tipos solo disponibles en sistema configurable — sin implementación legacy
            'ANULACION_SOBRANTE', 'SALDO_SOBRANTE', 'REINTEGRO_SALDO' => [
                'success' => false,
                'skipped' => true,
                'error' => "Tipo '{$entryType}' requiere configuración en la UI. Active ACCOUNTING_CONFIGURABLE_* y cree el asiento en Configuración.",
            ],

            default => [
                'success' => false,
                'error' => "Tipo de asiento '{$entryType}' no soportado en sistema legacy"
            ]
        };

        // Registrar resultado en el log
        $payload = $result['_payload'] ?? [];
        unset($result['_payload']);

        if ($result['success'] ?? false) {
            $log?->markSuccess($result, $payload);

            // #4: Marcar cuentas como validadas tras éxito (legacy)
            $validatedCodes = collect($payload['items'] ?? [])
                ->pluck('account_code')
                ->filter()
                ->unique()
                ->toArray();
            if (!empty($validatedCodes)) {
                ErpAccountingAccount::markCodesValidated($validatedCodes);
            }
        } elseif ($result['skipped'] ?? false) {
            $log?->markSkipped($result['error'] ?? 'Skipped', $payload);
        } else {
            $log?->markError($result, $payload);
        }

        return $result;
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

        // Crear registro de log pendiente
        $log = AccountingEntryLog::createPending($entryType, $amount, $reference, $context, 'configurable');

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
            $log?->markSkipped('No hay configuración para este tipo de asiento');
            return ['success' => false, 'error' => 'No hay configuración para este tipo de asiento'];
        }

        // Verificar que el servicio esté configurado
        $service = $this->getErpService();
        if (!$service->isConfigured()) {
            $log?->markSkipped('Servicio ERP no configurado');
            return ['success' => false, 'error' => 'Servicio ERP no configurado', 'skipped' => true];
        }

        // Obtener desglose de montos desde el contexto
        $breakdown = $context['amount_breakdown'] ?? [
            'total' => $amount,
            'interes_corriente' => 0,
            'interes_moratorio' => 0,
            'poliza' => 0,
            'capital' => $amount,
            'sobrante' => 0,
            'cargos_adicionales_total' => 0,
            'cargos_adicionales' => [],
        ];

        // Preparar variables para reemplazo en descripciones
        $variables = [
            '{reference}' => $reference,
            '{amount}' => number_format($amount, 2),
            '{clienteNombre}' => $context['clienteNombre'] ?? $context['lead_nombre'] ?? 'N/A',
            '{cedula}' => $context['cedula'] ?? '',
            '{credit_id}' => $context['credit_id'] ?? '',
            '{deductora_nombre}' => '', // Se resuelve dinámicamente según si se usó deductora o fallback
        ];

        // Construir items del asiento desde la configuración
        $items = [];
        $deductoraResuelta = null; // Nombre de la deductora que realmente se usó en alguna línea
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
            } elseif ($line->account_type === 'investor_prestamos') {
                // Cuenta dinámica por inversionista — Préstamos por Pagar (capital)
                $investorId = $context['investor_id'] ?? null;
                if ($investorId) {
                    $investor = Investor::find($investorId);
                    if ($investor && $investor->erp_account_key_prestamos) {
                        $accountCode = $this->getAccountCode($investor->erp_account_key_prestamos);
                        $deductoraContextNombre = $investor->name;
                    }
                }
            } elseif ($line->account_type === 'investor_intereses') {
                // Cuenta dinámica por inversionista — Intereses por Pagar
                $investorId = $context['investor_id'] ?? null;
                if ($investorId) {
                    $investor = Investor::find($investorId);
                    if ($investor && $investor->erp_account_key_intereses) {
                        $accountCode = $this->getAccountCode($investor->erp_account_key_intereses);
                        $deductoraContextNombre = $investor->name;
                    }
                }
            } elseif ($line->account_type === 'deductora_or_fixed') {
                // Cuenta dinámica por deductora con fallback a cuenta fija
                $deductoraId = $context['deductora_id'] ?? null;
                if ($deductoraId) {
                    $deductora = Deductora::find($deductoraId);
                    if ($deductora && $deductora->erp_account_key) {
                        $accountCode = $this->getAccountCode($deductora->erp_account_key);
                        $deductoraContextNombre = $deductora->nombre;
                    }
                }
                // Fallback a cuenta fija si no hay deductora o no tiene cuenta ERP
                if (!$accountCode) {
                    $accountCode = $this->getAccountCode($line->account_key);
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

            // Resolver monto según el componente (redondear a 2 decimales para evitar artifacts de punto flotante como 1.8e-12)
            $lineAmount = round($this->resolveLineAmount($line, $breakdown, $amount), 2);

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
                // Si esta línea usó deductora, guardar para la descripción principal
                $deductoraResuelta = $deductoraContextNombre;
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
            $log?->markError(['error' => 'No se pudieron construir líneas del asiento'], []);
            return ['success' => false, 'error' => 'No se pudieron construir líneas del asiento'];
        }

        // #4: Advertir si alguna cuenta nunca ha sido validada en el ERP
        $usedAccountCodes = array_unique(array_column($items, 'account_code'));
        $neverValidated = ErpAccountingAccount::whereIn('account_code', $usedAccountCodes)
            ->where('active', true)
            ->whereNull('validated_at')
            ->pluck('account_code')
            ->toArray();

        if (!empty($neverValidated)) {
            Log::warning('ERP: Algunas cuentas nunca han sido validadas en el ERP', [
                'entry_type' => $entryType,
                'unvalidated_accounts' => $neverValidated,
            ]);
        }

        // Enviar al ERP
        $clienteNombre = $context['clienteNombre'] ?? $context['lead_nombre'] ?? 'N/A';
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

        // Registrar resultado en el log
        $payload = $result['_payload'] ?? [];
        unset($result['_payload']);

        if ($result['success'] ?? false) {
            $log?->markSuccess($result, $payload);

            // #4: Marcar cuentas como validadas tras éxito
            $validatedCodes = array_unique(array_column($items, 'account_code'));
            if (!empty($validatedCodes)) {
                ErpAccountingAccount::markCodesValidated($validatedCodes);
            }
        } elseif ($result['skipped'] ?? false) {
            $log?->markSkipped($result['error'] ?? 'Skipped', $payload);
        } else {
            $log?->markError($result, $payload);
        }

        if (!($result['success'] ?? false) && !($result['skipped'] ?? false)) {
            Log::critical('ACCOUNTING: Fallo al enviar asiento configurable', [
                'entry_type' => $entryType,
                'error' => $result['error'] ?? 'Desconocido',
            ]);
        }

        return $result;
    }

    /**
     * Disparar asientos en cascada luego de un asiento exitoso.
     *
     * Nota: SALDO_SOBRANTE ya NO se dispara aquí. Se dispara directamente
     * desde CreditPaymentController@upload() después de confirmar el sobrante
     * real y crear el SaldoPendiente. Esto evita doble disparo.
     */
    private function triggerCascadeEntries(string $parentType, string $reference, array $context, array &$parentResult): void
    {
        // Reservado para futuras cascadas. SALDO_SOBRANTE se maneja en upload().
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
            'sobrante' => $breakdown['sobrante'] ?? 0,
            'penalizacion' => $breakdown['penalizacion'] ?? 0,
            'cargos_adicionales_total' => $breakdown['cargos_adicionales_total'] ?? 0,
            'monto_neto' => ($breakdown['total'] ?? $totalAmount) - ($breakdown['cargos_adicionales_total'] ?? 0),
            'cargo_adicional' => $this->resolveCargosAdicionales($breakdown, $line->cargo_adicional_key),
            // Componentes de inversiones (individuales)
            'interes_neto' => $breakdown['interes_neto'] ?? 0,
            'retencion' => $breakdown['retencion'] ?? 0,
            'interes_bruto' => $breakdown['interes_bruto'] ?? 0,
            // Componentes de inversiones (sumatoria para pago masivo)
            'total_interes_bruto' => $breakdown['total_interes_bruto'] ?? 0,
            'total_retencion' => $breakdown['total_retencion'] ?? 0,
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
     * Asiento: DÉBITO Cuentas por Cobrar / CRÉDITO Banco CREDIPEP
     */
    protected function triggerAccountingFormalizacion(int $creditId, float $amount, string $reference, array $additionalData = []): array
    {
        $codBanco = $this->getAccountCode('banco_credipep');
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
            return ['success' => false, 'skipped' => true, 'error' => 'Cuentas contables no configuradas'];
        }

        $service = $this->getErpService();
        if (!$service->isConfigured()) {
            return ['success' => false, 'skipped' => true, 'error' => 'Servicio ERP no configurado'];
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

        return $result;
    }

    /**
     * ACCOUNTING_API_TRIGGER: Pago de Crédito (todos los orígenes)
     *
     * Asiento: DÉBITO Banco CREDIPEP / CRÉDITO Cuentas por Cobrar
     */
    protected function triggerAccountingPago(int $creditId, int $paymentId, float $amount, string $source, array $breakdown = []): array
    {
        $codBanco = $this->getAccountCode('banco_credipep');
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
            return ['success' => false, 'skipped' => true, 'error' => 'Cuentas contables no configuradas'];
        }

        $service = $this->getErpService();
        if (!$service->isConfigured()) {
            return ['success' => false, 'skipped' => true, 'error' => 'Servicio ERP no configurado'];
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

        return $result;
    }

    /**
     * ACCOUNTING_API_TRIGGER: Pago por Planilla (Deducción Automática)
     *
     * Asiento: DÉBITO Banco CREDIPEP / CRÉDITO Cuentas por Cobrar
     */
    protected function triggerAccountingPagoPlanilla(int $creditId, int $paymentId, float $amount, array $breakdown = []): array
    {
        $codBanco = $this->getAccountCode('banco_credipep');
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
            return ['success' => false, 'skipped' => true, 'error' => 'Cuentas contables no configuradas'];
        }

        $service = $this->getErpService();
        if (!$service->isConfigured()) {
            return ['success' => false, 'skipped' => true, 'error' => 'Servicio ERP no configurado'];
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

        return $result;
    }

    /**
     * ACCOUNTING_API_TRIGGER: Pago de Ventanilla (Pago Manual)
     *
     * Asiento: DÉBITO Banco CREDIPEP / CRÉDITO Cuentas por Cobrar
     */
    protected function triggerAccountingPagoVentanilla(int $creditId, int $paymentId, float $amount, array $breakdown = []): array
    {
        $codBanco = $this->getAccountCode('banco_credipep');
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
            return ['success' => false, 'skipped' => true, 'error' => 'Cuentas contables no configuradas'];
        }

        $service = $this->getErpService();
        if (!$service->isConfigured()) {
            return ['success' => false, 'skipped' => true, 'error' => 'Servicio ERP no configurado'];
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

        return $result;
    }

    /**
     * ACCOUNTING_API_TRIGGER: Abono Extraordinario
     *
     * Asiento: DÉBITO Banco CREDIPEP / CRÉDITO Cuentas por Cobrar
     */
    protected function triggerAccountingAbonoExtraordinario(int $creditId, int $paymentId, float $amount, array $breakdown = []): array
    {
        $codBanco = $this->getAccountCode('banco_credipep');
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
            return ['success' => false, 'skipped' => true, 'error' => 'Cuentas contables no configuradas'];
        }

        $service = $this->getErpService();
        if (!$service->isConfigured()) {
            return ['success' => false, 'skipped' => true, 'error' => 'Servicio ERP no configurado'];
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

        return $result;
    }

    /**
     * ACCOUNTING_API_TRIGGER: Devolución/Anulación de Pago (reversa)
     *
     * Asiento: DÉBITO Cuentas por Cobrar / CRÉDITO Banco CREDIPEP
     */
    protected function triggerAccountingDevolucion(int $creditId, ?int $paymentId, float $amount, string $reason, array $additionalData = []): array
    {
        $codBanco = $this->getAccountCode('banco_credipep');
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
            return ['success' => false, 'skipped' => true, 'error' => 'Cuentas contables no configuradas'];
        }

        $service = $this->getErpService();
        if (!$service->isConfigured()) {
            return ['success' => false, 'skipped' => true, 'error' => 'Servicio ERP no configurado'];
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

        return $result;
    }

    /**
     * ACCOUNTING_API_TRIGGER: Refundición - Cierre de Crédito Viejo
     *
     * Asiento: DÉBITO Banco CREDIPEP / CRÉDITO Cuentas por Cobrar
     */
    protected function triggerAccountingRefundicionCierre(int $oldCreditId, float $balanceAbsorbed, int $newCreditId): array
    {
        $codBanco = $this->getAccountCode('banco_credipep');
        $codCxC = $this->getAccountCode('cuentas_por_cobrar');
        $balanceAbsorbed = round($balanceAbsorbed, 2);

        Log::info('ACCOUNTING_API_TRIGGER: Refundición - Cierre', [
            'trigger_type' => 'REFUNDICION_CIERRE',
            'old_credit_id' => $oldCreditId,
            'new_credit_id' => $newCreditId,
            'balance_absorbed' => $balanceAbsorbed,
        ]);

        if (!$codBanco || !$codCxC) {
            return ['success' => false, 'skipped' => true, 'error' => 'Cuentas contables no configuradas'];
        }

        $service = $this->getErpService();
        if (!$service->isConfigured()) {
            return ['success' => false, 'skipped' => true, 'error' => 'Servicio ERP no configurado'];
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

        return $result;
    }

    /**
     * ACCOUNTING_API_TRIGGER: Inversión Recibida (entrada de capital)
     *
     * 1er Asiento: DÉBITO Bancos / CRÉDITO Pasivo Capital Inversionista
     */
    protected function triggerAccountingInversionRecibida(int $investmentId, float $monto, string $moneda, string $investorNombre): array
    {
        $codBanco = $this->getAccountCode('banco_inversiones_' . strtolower($moneda));
        $codPasivo = $this->getAccountCode('pasivo_capital_inversionistas');
        $monto = round($monto, 2);

        Log::info('ACCOUNTING_API_TRIGGER: Inversión Recibida', [
            'trigger_type' => 'INV_CAPITAL_RECIBIDO',
            'investment_id' => $investmentId,
            'monto' => $monto,
            'moneda' => $moneda,
            'investor' => $investorNombre,
        ]);

        if (!$codBanco || !$codPasivo) {
            Log::warning('ERP: Cuentas de inversión no configuradas. Asiento INV_CAPITAL_RECIBIDO NO enviado.', ['investment_id' => $investmentId]);
            return ['success' => false, 'skipped' => true, 'error' => 'Cuentas contables de inversión no configuradas'];
        }

        $service = $this->getErpService();
        if (!$service->isConfigured()) {
            return ['success' => false, 'skipped' => true, 'error' => 'Servicio ERP no configurado'];
        }

        $result = $service->createJournalEntry(
            date: now()->format('Y-m-d'),
            description: "Capital recibido inversión #{$investmentId} - {$investorNombre} ({$moneda})",
            items: [
                ['account_code' => $codBanco,   'debit' => $monto, 'credit' => 0,     'description' => "Entrada capital inversión #{$investmentId}"],
                ['account_code' => $codPasivo,  'debit' => 0,      'credit' => $monto, 'description' => "Pasivo capital {$investorNombre}"],
            ],
            reference: "INV-CAP-{$investmentId}"
        );

        if (!($result['success'] ?? false) && !($result['skipped'] ?? false)) {
            Log::critical('ACCOUNTING: Fallo asiento INV_CAPITAL_RECIBIDO', ['investment_id' => $investmentId, 'error' => $result['error'] ?? 'Desconocido']);
        }

        return $result;
    }

    /**
     * ACCOUNTING_API_TRIGGER: Pago de Interés a Inversionista
     *
     * 1er Asiento (devengo): DÉBITO Intereses sobre Préstamos Recibidos / CRÉDITO Intereses por Pagar [inversionista]
     * 2do Asiento (retención): DÉBITO Intereses por Pagar [inversionista] / CRÉDITO Retenciones a la Fuente
     *
     * Los asientos reales al pagar se hacen manualmente en el ERP (ver imagen de especificación).
     */
    protected function triggerAccountingInteresInversion(int $investmentId, int $couponId, float $interesNeto, float $retencion, string $moneda, string $investorNombre): array
    {
        $codGastoInteres  = $this->getAccountCode('gasto_intereses_inversiones');
        $codPagarInversor = $this->getAccountCode('intereses_por_pagar_inversiones');
        $codRetenciones   = $this->getAccountCode('retenciones_a_la_fuente');
        $interesNeto = round($interesNeto, 2);
        $retencion   = round($retencion, 2);
        $interesBruto = round($interesNeto + $retencion, 2);

        Log::info('ACCOUNTING_API_TRIGGER: Interés Inversión', [
            'trigger_type'  => 'INV_INTERES_DEVENGADO',
            'investment_id' => $investmentId,
            'coupon_id'     => $couponId,
            'interes_bruto' => $interesBruto,
            'interes_neto'  => $interesNeto,
            'retencion'     => $retencion,
            'investor'      => $investorNombre,
        ]);

        if (!$codGastoInteres || !$codPagarInversor || !$codRetenciones) {
            Log::warning('ERP: Cuentas de interés inversión no configuradas. Asiento INV_INTERES_DEVENGADO NO enviado.', ['investment_id' => $investmentId]);
            return ['success' => false, 'skipped' => true, 'error' => 'Cuentas contables de interés inversión no configuradas'];
        }

        $service = $this->getErpService();
        if (!$service->isConfigured()) {
            return ['success' => false, 'skipped' => true, 'error' => 'Servicio ERP no configurado'];
        }

        // 1er Asiento: devengo de interés neto
        $result1 = $service->createJournalEntry(
            date: now()->format('Y-m-d'),
            description: "Interés devengado inversión #{$investmentId} - {$investorNombre}",
            items: [
                ['account_code' => $codGastoInteres,  'debit' => $interesBruto, 'credit' => 0,           'description' => "Intereses sobre préstamos recibidos #{$investmentId}"],
                ['account_code' => $codPagarInversor, 'debit' => 0,             'credit' => $interesNeto, 'description' => "Intereses por pagar {$investorNombre}"],
            ],
            reference: "INV-INT-{$couponId}"
        );

        // 2do Asiento: retención fiscal (solo si hay retención)
        $result2 = ['success' => true, 'skipped' => true];
        if ($retencion > 0) {
            $result2 = $service->createJournalEntry(
                date: now()->format('Y-m-d'),
                description: "Retención interés inversión #{$investmentId} - {$investorNombre}",
                items: [
                    ['account_code' => $codPagarInversor, 'debit' => $retencion, 'credit' => 0,          'description' => "Retención {$investorNombre} cupón #{$couponId}"],
                    ['account_code' => $codRetenciones,   'debit' => 0,          'credit' => $retencion, 'description' => "Retenciones a la fuente inversiones"],
                ],
                reference: "INV-RET-{$couponId}"
            );
        }

        if (!($result1['success'] ?? false) && !($result1['skipped'] ?? false)) {
            Log::critical('ACCOUNTING: Fallo asiento INV_INTERES_DEVENGADO', ['investment_id' => $investmentId, 'error' => $result1['error'] ?? 'Desconocido']);
        }

        return $result1;
    }

    /**
     * ACCOUNTING_API_TRIGGER: Refundición - Formalización de Nuevo Crédito
     *
     * Asiento: DÉBITO Cuentas por Cobrar / CRÉDITO Banco CREDIPEP
     */
    protected function triggerAccountingRefundicionNuevo(int $newCreditId, float $amount, int $oldCreditId, float $cashDelivered): array
    {
        $codBanco = $this->getAccountCode('banco_credipep');
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
            return ['success' => false, 'skipped' => true, 'error' => 'Cuentas contables no configuradas'];
        }

        $service = $this->getErpService();
        if (!$service->isConfigured()) {
            return ['success' => false, 'skipped' => true, 'error' => 'Servicio ERP no configurado'];
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

        return $result;
    }
}
