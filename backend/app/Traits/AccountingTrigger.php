<?php

namespace App\Traits;

use App\Models\ErpAccountingAccount;
use App\Models\AccountingEntryConfig;
use App\Models\AccountingEntryLog;
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
     * Actualmente soporta:
     * - PAGO_PLANILLA con sobrante > 0 → dispara SALDO_SOBRANTE automáticamente
     */
    private function triggerCascadeEntries(string $parentType, string $reference, array $context, array &$parentResult): void
    {
        if ($parentType !== 'PAGO_PLANILLA') {
            return;
        }

        $sobrante = (float) ($context['amount_breakdown']['sobrante'] ?? 0);

        if ($sobrante <= 0) {
            return;
        }

        Log::info('ERP: Sobrante detectado en PAGO_PLANILLA, disparando SALDO_SOBRANTE', [
            'reference' => $reference,
            'sobrante' => $sobrante,
        ]);

        $sobranteReference = $reference . '-SOBRANTE';

        // Construir contexto para el asiento de sobrante (monto total = el sobrante)
        $sobranteContext = $context;
        $sobranteContext['amount_breakdown'] = [
            'total' => $sobrante,
            'interes_corriente' => 0,
            'interes_moratorio' => 0,
            'poliza' => 0,
            'capital' => 0,
            'sobrante' => $sobrante,
            'cargos_adicionales_total' => 0,
            'cargos_adicionales' => [],
        ];

        $sobranteResult = $this->triggerAccountingEntry(
            'SALDO_SOBRANTE',
            $sobrante,
            $sobranteReference,
            $sobranteContext
        );

        // Adjuntar resultado del sobrante al resultado padre para trazabilidad
        $parentResult['sobrante_entry'] = $sobranteResult;

        if (!($sobranteResult['success'] ?? false)) {
            Log::warning('ERP: Fallo al registrar SALDO_SOBRANTE', [
                'reference' => $sobranteReference,
                'sobrante' => $sobrante,
                'error' => $sobranteResult['error'] ?? 'Desconocido',
            ]);
        }
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
    protected function triggerAccountingFormalizacion(int $creditId, float $amount, string $reference, array $additionalData = []): array
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
     * Asiento: DÉBITO Banco CREDIPEPE / CRÉDITO Cuentas por Cobrar
     */
    protected function triggerAccountingPago(int $creditId, int $paymentId, float $amount, string $source, array $breakdown = []): array
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
     * Asiento: DÉBITO Banco CREDIPEPE / CRÉDITO Cuentas por Cobrar
     */
    protected function triggerAccountingPagoPlanilla(int $creditId, int $paymentId, float $amount, array $breakdown = []): array
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
     * Asiento: DÉBITO Banco CREDIPEPE / CRÉDITO Cuentas por Cobrar
     */
    protected function triggerAccountingPagoVentanilla(int $creditId, int $paymentId, float $amount, array $breakdown = []): array
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
     * Asiento: DÉBITO Banco CREDIPEPE / CRÉDITO Cuentas por Cobrar
     */
    protected function triggerAccountingAbonoExtraordinario(int $creditId, int $paymentId, float $amount, array $breakdown = []): array
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
     * Asiento: DÉBITO Cuentas por Cobrar / CRÉDITO Banco CREDIPEPE
     */
    protected function triggerAccountingDevolucion(int $creditId, ?int $paymentId, float $amount, string $reason, array $additionalData = []): array
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
     * Asiento: DÉBITO Banco CREDIPEPE / CRÉDITO Cuentas por Cobrar
     */
    protected function triggerAccountingRefundicionCierre(int $oldCreditId, float $balanceAbsorbed, int $newCreditId): array
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
     * ACCOUNTING_API_TRIGGER: Refundición - Formalización de Nuevo Crédito
     *
     * Asiento: DÉBITO Cuentas por Cobrar / CRÉDITO Banco CREDIPEPE
     */
    protected function triggerAccountingRefundicionNuevo(int $newCreditId, float $amount, int $oldCreditId, float $cashDelivered): array
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
