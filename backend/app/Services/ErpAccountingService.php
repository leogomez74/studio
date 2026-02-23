<?php

namespace App\Services;

use App\Models\ErpAccountingAccount;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Exception;

class ErpAccountingService
{
    private string $baseUrl;
    private string $email;
    private string $password;
    private const TOKEN_CACHE_KEY = 'erp_accounting_token';
    private const TOKEN_TTL = 3600; // 1 hora

    public function __construct()
    {
        $this->baseUrl = rtrim(config('services.erp.url', ''), '/');
        $this->email = config('services.erp.email', '');
        $this->password = config('services.erp.password', '');
    }

    /**
     * Verificar si el servicio ERP está configurado
     */
    public function isConfigured(): bool
    {
        return !empty($this->baseUrl) && !empty($this->email) && !empty($this->password);
    }

    /**
     * Verificar si las cuentas contables están configuradas
     */
    public function areAccountsConfigured(): bool
    {
        $codes = ErpAccountingAccount::getActiveCodesMap();
        $banco = $codes['banco_credipepe'] ?? '';
        $cxc = $codes['cuentas_por_cobrar'] ?? '';

        return !empty($banco) && !empty($cxc);
    }

    // ================================================================
    // AUTENTICACIÓN
    // ================================================================

    /**
     * Obtener token Bearer. Usa caché y reautentica si es necesario.
     */
    public function getToken(): string
    {
        $cached = Cache::get(self::TOKEN_CACHE_KEY);
        if ($cached) {
            return $cached;
        }

        return $this->authenticate();
    }

    /**
     * POST /auth/login → obtiene y guarda token
     */
    public function authenticate(): string
    {
        $response = Http::timeout(15)
            ->post($this->baseUrl . '/auth/login', [
                'email' => $this->email,
                'password' => $this->password,
            ]);

        if (!$response->successful()) {
            Log::error('ERP Auth: Login fallido', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            throw new Exception('No se pudo autenticar con el ERP. Status: ' . $response->status());
        }

        $data = $response->json();

        if (!($data['is_success'] ?? $data['success'] ?? false) || empty($data['data']['token'])) {
            throw new Exception('ERP Auth: Respuesta inesperada - ' . ($data['message'] ?? 'Sin mensaje'));
        }

        $token = $data['data']['token'];

        // Guardar en caché por 1 hora
        Cache::put(self::TOKEN_CACHE_KEY, $token, self::TOKEN_TTL);

        Log::info('ERP Auth: Token obtenido exitosamente');

        return $token;
    }

    /**
     * Limpiar token cacheado (para forzar reautenticación)
     */
    public function clearToken(): void
    {
        Cache::forget(self::TOKEN_CACHE_KEY);
    }

    // ================================================================
    // CREAR ASIENTO CONTABLE
    // ================================================================

    /**
     * Crear asiento contable en el ERP externo
     *
     * @param string $date Fecha YYYY-MM-DD
     * @param string $description Descripción del asiento
     * @param array $items Array de líneas [{account_code, debit, credit, description?}]
     * @param string|null $reference Referencia opcional
     * @return array Respuesta del ERP
     */
    public function createJournalEntry(string $date, string $description, array $items, ?string $reference = null): array
    {
        // 1. Validar que el servicio está configurado
        if (!$this->isConfigured()) {
            Log::warning('ERP: Servicio no configurado. Asiento NO enviado.', [
                'description' => $description,
            ]);
            return ['success' => false, 'error' => 'ERP no configurado', 'skipped' => true, '_payload' => null];
        }

        // 2. Validar partida doble localmente
        $validation = $this->validateItems($items);
        if (!$validation['valid']) {
            Log::error('ERP: Validación local falló', [
                'error' => $validation['error'],
                'items' => $items,
            ]);
            $earlyPayload = ['date' => $date, 'description' => $description, 'items' => $items];
            if ($reference) $earlyPayload['reference'] = $reference;
            return ['success' => false, 'error' => $validation['error'], '_payload' => $earlyPayload];
        }

        // 3. Preparar payload
        $payload = [
            'date' => $date,
            'description' => $description,
            'items' => $items,
        ];

        if ($reference) {
            $payload['reference'] = $reference;
        }

        // 4. Enviar con retry en caso de 401
        $result = $this->sendWithRetry($payload);
        $result['_payload'] = $payload;
        return $result;
    }

    /**
     * Enviar request con reintento automático en caso de 401
     */
    private function sendWithRetry(array $payload, bool $isRetry = false): array
    {
        try {
            $token = $this->getToken();

            $response = Http::timeout(30)
                ->withHeaders([
                    'Authorization' => 'Bearer ' . $token,
                    'Accept' => 'application/json',
                ])
                ->post($this->baseUrl . '/journal-entry', $payload);

            // 201 = Éxito
            if ($response->status() === 201) {
                $data = $response->json();
                Log::info('ERP: Asiento contable creado', [
                    'journal_entry_id' => $data['data']['journal_entry_id'] ?? null,
                    'description' => $payload['description'],
                    'total_debit' => $data['data']['total_debit'] ?? null,
                    'total_credit' => $data['data']['total_credit'] ?? null,
                ]);

                return [
                    'success' => true,
                    'data' => $data['data'] ?? [],
                    'message' => $data['message'] ?? 'Asiento creado',
                ];
            }

            // 401 = Token expirado → reautenticar y reintentar una vez
            if ($response->status() === 401 && !$isRetry) {
                Log::warning('ERP: Token expirado, reautenticando...');
                $this->clearToken();
                return $this->sendWithRetry($payload, true);
            }

            // 422 = Error de validación
            if ($response->status() === 422) {
                $data = $response->json();
                $errorMsg = $data['message'] ?? 'Error de validación';
                Log::error('ERP: Error 422 al crear asiento', [
                    'message' => $errorMsg,
                    'payload' => $payload,
                ]);

                return [
                    'success' => false,
                    'error' => $errorMsg,
                    'http_status' => 422,
                ];
            }

            // Otros errores
            Log::error('ERP: Error inesperado', [
                'status' => $response->status(),
                'body' => $response->body(),
                'payload' => $payload,
            ]);

            return [
                'success' => false,
                'error' => 'Error HTTP ' . $response->status(),
                'http_status' => $response->status(),
            ];

        } catch (Exception $e) {
            Log::error('ERP: Excepción al enviar asiento', [
                'error' => $e->getMessage(),
                'payload' => $payload,
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    // ================================================================
    // VALIDACIÓN LOCAL
    // ================================================================

    /**
     * Validar ítems antes de enviar al ERP
     * - Suma de débitos == suma de créditos
     * - Cada línea tiene debit O credit (no ambos, no ceros)
     * - Mínimo 2 líneas
     */
    public function validateItems(array $items): array
    {
        if (count($items) < 2) {
            return ['valid' => false, 'error' => 'Se requieren mínimo 2 líneas en el asiento'];
        }

        $totalDebit = 0;
        $totalCredit = 0;

        foreach ($items as $i => $item) {
            $debit = round((float) ($item['debit'] ?? 0), 2);
            $credit = round((float) ($item['credit'] ?? 0), 2);

            // Regla: debit O credit, nunca ambos > 0, nunca ambos = 0
            if ($debit > 0 && $credit > 0) {
                return ['valid' => false, 'error' => "Línea {$i}: No puede tener débito y crédito al mismo tiempo"];
            }
            if ($debit == 0 && $credit == 0) {
                return ['valid' => false, 'error' => "Línea {$i}: Debe tener débito o crédito mayor a 0"];
            }

            // Verificar que tenga account_code
            if (empty($item['account_code'])) {
                return ['valid' => false, 'error' => "Línea {$i}: Falta el código de cuenta contable"];
            }

            $totalDebit += $debit;
            $totalCredit += $credit;
        }

        // Partida doble: débitos == créditos
        if (abs($totalDebit - $totalCredit) > 0.01) {
            return [
                'valid' => false,
                'error' => "Partida doble no cuadra: Débito={$totalDebit}, Crédito={$totalCredit}",
            ];
        }

        return ['valid' => true, 'total_debit' => $totalDebit, 'total_credit' => $totalCredit];
    }

    // ================================================================
    // TEST DE CONEXIÓN
    // ================================================================

    /**
     * Probar la conexión con el ERP (autenticación)
     */
    public function testConnection(): array
    {
        if (!$this->isConfigured()) {
            return [
                'success' => false,
                'message' => 'El servicio ERP no está configurado. Verifica las variables de entorno ERP_API_URL, ERP_API_EMAIL y ERP_API_PASSWORD.',
            ];
        }

        try {
            $this->clearToken();
            $token = $this->authenticate();

            return [
                'success' => true,
                'message' => 'Conexión exitosa con el ERP.',
                'token_preview' => substr($token, 0, 10) . '...',
            ];
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Error de conexión: ' . $e->getMessage(),
            ];
        }
    }
}
