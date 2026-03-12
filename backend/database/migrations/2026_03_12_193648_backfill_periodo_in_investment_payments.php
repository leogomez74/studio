<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Backfill periodo from investment_coupons:
        // Match each payment to the coupon of the same investment
        // where the coupon's fecha_pago matches the payment's fecha_pago.
        DB::statement("
            UPDATE investment_payments ip
            JOIN investment_coupons ic
                ON ic.investment_id = ip.investment_id
                AND ic.fecha_pago = ip.fecha_pago
                AND ic.estado = 'Pagado'
            SET ip.periodo = ic.fecha_cupon
            WHERE ip.periodo IS NULL
              AND ip.investment_id IS NOT NULL
        ");
    }

    public function down(): void
    {
        // Cannot safely reverse a backfill
    }
};
