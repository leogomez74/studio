<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // PAGO_SALDO_PENDIENTE
        if (!DB::table('accounting_entry_configs')->where('entry_type', 'PAGO_SALDO_PENDIENTE')->exists()) {
            $pagoId = DB::table('accounting_entry_configs')->insertGetId([
                'entry_type'  => 'PAGO_SALDO_PENDIENTE',
                'name'        => 'Pago desde Saldo Pendiente',
                'description' => 'Aplicación de saldo sobrante a cuota de crédito {reference} {clienteNombre}',
                'active'      => true,
                'created_at'  => now(),
                'updated_at'  => now(),
            ]);

            DB::table('accounting_entry_lines')->insert([
                [
                    'accounting_entry_config_id' => $pagoId,
                    'line_order'       => 0,
                    'movement_type'    => 'debit',
                    'account_type'     => 'fixed',
                    'account_key'      => 'retenciones_por_aplicar_cuentas',
                    'description'      => 'Aplicación saldo sobrante a crédito {reference} {clienteNombre}',
                    'amount_component' => 'capital',
                    'cargo_adicional_key' => null,
                    'created_at'       => now(),
                    'updated_at'       => now(),
                ],
                [
                    'accounting_entry_config_id' => $pagoId,
                    'line_order'       => 1,
                    'movement_type'    => 'credit',
                    'account_type'     => 'fixed',
                    'account_key'      => 'cuenta_por_cobrar_pepito_plazo',
                    'description'      => 'Reducción CxC por saldo aplicado {reference} {clienteNombre}',
                    'amount_component' => 'capital',
                    'cargo_adicional_key' => null,
                    'created_at'       => now(),
                    'updated_at'       => now(),
                ],
            ]);
        }

        // ANULACION_SALDO_APLICADO
        if (!DB::table('accounting_entry_configs')->where('entry_type', 'ANULACION_SALDO_APLICADO')->exists()) {
            $anulId = DB::table('accounting_entry_configs')->insertGetId([
                'entry_type'  => 'ANULACION_SALDO_APLICADO',
                'name'        => 'Anulación Saldo Aplicado',
                'description' => 'Reverso de saldo pendiente aplicado {reference} {clienteNombre}',
                'active'      => true,
                'created_at'  => now(),
                'updated_at'  => now(),
            ]);

            DB::table('accounting_entry_lines')->insert([
                [
                    'accounting_entry_config_id' => $anulId,
                    'line_order'       => 0,
                    'movement_type'    => 'debit',
                    'account_type'     => 'fixed',
                    'account_key'      => 'cuenta_por_cobrar_pepito_plazo',
                    'description'      => 'Reverso CxC saldo aplicado {reference} {clienteNombre}',
                    'amount_component' => 'capital',
                    'cargo_adicional_key' => null,
                    'created_at'       => now(),
                    'updated_at'       => now(),
                ],
                [
                    'accounting_entry_config_id' => $anulId,
                    'line_order'       => 1,
                    'movement_type'    => 'credit',
                    'account_type'     => 'fixed',
                    'account_key'      => 'retenciones_por_aplicar_cuentas',
                    'description'      => 'Devolución a retenciones por aplicar {reference} {clienteNombre}',
                    'amount_component' => 'capital',
                    'cargo_adicional_key' => null,
                    'created_at'       => now(),
                    'updated_at'       => now(),
                ],
            ]);
        }
    }

    public function down(): void
    {
        $ids = DB::table('accounting_entry_configs')
            ->whereIn('entry_type', ['PAGO_SALDO_PENDIENTE', 'ANULACION_SALDO_APLICADO'])
            ->pluck('id');

        DB::table('accounting_entry_lines')->whereIn('accounting_entry_config_id', $ids)->delete();
        DB::table('accounting_entry_configs')->whereIn('id', $ids)->delete();
    }
};
