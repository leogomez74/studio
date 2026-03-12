<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Reset ALL paid investment coupons back to Pendiente
        DB::table('investment_coupons')
            ->where('estado', 'Pagado')
            ->update([
                'estado'    => 'Pendiente',
                'fecha_pago' => null,
            ]);

        // Delete all investment payment records
        DB::table('investment_payments')->delete();
    }

    public function down(): void
    {
        // Cannot safely reverse a data reset
    }
};
