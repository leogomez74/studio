<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class AccountingEntryLog extends Model
{
    protected $fillable = [
        'entry_type',
        'reference',
        'status',
        'amount',
        'total_debit',
        'total_credit',
        'erp_journal_entry_id',
        'erp_message',
        'error_message',
        'http_status',
        'payload_sent',
        'erp_response',
        'context',
        'source_method',
        'retry_count',
        'max_retries',
        'next_retry_at',
        'last_retry_at',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'total_debit' => 'decimal:2',
        'total_credit' => 'decimal:2',
        'payload_sent' => 'json',
        'erp_response' => 'json',
        'context' => 'json',
        'next_retry_at' => 'datetime',
        'last_retry_at' => 'datetime',
    ];

    // Backoff exponencial: 5min, 15min, 45min
    private const RETRY_DELAYS = [5, 15, 45];

    // ---- Scopes ----

    public function scopeByEntryType($query, string $type)
    {
        return $query->where('entry_type', $type);
    }

    public function scopeByStatus($query, string $status)
    {
        return $query->where('status', $status);
    }

    public function scopeByReference($query, string $reference)
    {
        return $query->where('reference', 'like', "%{$reference}%");
    }

    public function scopeDateRange($query, ?string $from, ?string $to)
    {
        if ($from) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to) {
            $query->whereDate('created_at', '<=', $to);
        }
        return $query;
    }

    public function scopeByCreditId($query, string $creditId)
    {
        return $query->whereRaw("JSON_EXTRACT(context, '$.credit_id') = ?", [$creditId]);
    }

    /**
     * Logs con status error que pueden reintentarse
     */
    public function scopeRetryable($query)
    {
        return $query->where('status', 'error')
            ->whereColumn('retry_count', '<', 'max_retries')
            ->whereNotNull('payload_sent')
            ->where(function ($q) {
                $q->whereNull('next_retry_at')
                  ->orWhere('next_retry_at', '<=', now());
            });
    }

    /**
     * Verificar si ya existe un asiento exitoso con el mismo tipo y referencia
     */
    public function scopeIsDuplicate($query, string $entryType, string $reference)
    {
        return $query->where('entry_type', $entryType)
            ->where('reference', $reference)
            ->where('status', 'success');
    }

    // ---- Factory Methods ----

    /**
     * Crear registro pendiente antes de enviar al ERP
     */
    public static function createPending(
        string $entryType,
        float $amount,
        string $reference,
        array $context = [],
        string $sourceMethod = 'configurable'
    ): ?self {
        try {
            return static::create([
                'entry_type' => $entryType,
                'reference' => $reference,
                'status' => 'pending',
                'amount' => round($amount, 2),
                'context' => $context,
                'source_method' => $sourceMethod,
            ]);
        } catch (\Exception $e) {
            Log::error('AccountingEntryLog: Error al crear registro pending', [
                'error' => $e->getMessage(),
                'entry_type' => $entryType,
            ]);
            return null;
        }
    }

    // ---- Status Transitions ----

    /**
     * Marcar como exitoso con datos del ERP
     */
    public function markSuccess(array $erpResult, array $payload): void
    {
        $this->update([
            'status' => 'success',
            'erp_journal_entry_id' => $erpResult['data']['journal_entry_id'] ?? null,
            'total_debit' => $erpResult['data']['total_debit'] ?? null,
            'total_credit' => $erpResult['data']['total_credit'] ?? null,
            'erp_message' => $erpResult['message'] ?? 'Asiento creado',
            'payload_sent' => $payload,
            'erp_response' => $erpResult,
            'next_retry_at' => null,
        ]);
    }

    /**
     * Marcar como error y programar reintento
     */
    public function markError(array $erpResult, array $payload = []): void
    {
        $updateData = [
            'status' => 'error',
            'error_message' => $erpResult['error'] ?? 'Error desconocido',
            'http_status' => $erpResult['http_status'] ?? null,
            'payload_sent' => !empty($payload) ? $payload : null,
            'erp_response' => $erpResult,
        ];

        // Programar reintento automático si hay intentos disponibles
        if ($this->retry_count < $this->max_retries && !empty($payload)) {
            $delayMinutes = self::RETRY_DELAYS[$this->retry_count] ?? 45;
            $updateData['next_retry_at'] = now()->addMinutes($delayMinutes);
        }

        $this->update($updateData);
    }

    /**
     * Marcar como omitido (ERP no configurado, cuentas faltantes, etc.)
     */
    public function markSkipped(string $reason, array $payload = []): void
    {
        $this->update([
            'status' => 'skipped',
            'error_message' => $reason,
            'payload_sent' => !empty($payload) ? $payload : null,
        ]);
    }

    // ---- Retry Methods ----

    /**
     * Verificar si este log puede reintentarse
     */
    public function canRetry(): bool
    {
        return $this->status === 'error'
            && $this->retry_count < $this->max_retries
            && !empty($this->payload_sent);
    }

    /**
     * Incrementar contador de reintento y registrar timestamp
     */
    public function incrementRetry(): void
    {
        $this->update([
            'retry_count' => $this->retry_count + 1,
            'last_retry_at' => now(),
            'status' => 'pending',
        ]);
    }

    /**
     * Calcular delay para el próximo reintento
     */
    public function getNextRetryDelay(): int
    {
        return self::RETRY_DELAYS[$this->retry_count] ?? 45;
    }
}
