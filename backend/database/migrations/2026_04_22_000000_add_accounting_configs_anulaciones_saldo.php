<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // ANULACION_ABONO_CAPITAL — reverso de ABONO_CAPITAL
        // Dr cuenta_por_cobrar_pepito_plazo / Cr desembolso_saldos_a_favor
        if (!DB::table('accounting_entry_configs')->where('entry_type', 'ANULACION_ABONO_CAPITAL')->exists()) {
            $id = DB::table('accounting_entry_configs')->insertGetId([
                'entry_type'  => 'ANULACION_ABONO_CAPITAL',
                'name'        => 'Anulación Abono a Capital',
                'description' => 'Reverso de saldo aplicado como abono a capital {reference} {clienteNombre}',
                'active'      => true,
                'created_at'  => now(),
                'updated_at'  => now(),
            ]);

            DB::table('accounting_entry_lines')->insert([
                [
                    'accounting_entry_config_id' => $id,
                    'line_order'       => 0,
                    'movement_type'    => 'debit',
                    'account_type'     => 'fixed',
                    'account_key'      => 'cuenta_por_cobrar_pepito_plazo',
                    'description'      => 'Reverso CxC abono capital {reference} {clienteNombre}',
                    'amount_component' => 'capital',
                    'cargo_adicional_key' => null,
                    'created_at'       => now(),
                    'updated_at'       => now(),
                ],
                [
                    'accounting_entry_config_id' => $id,
                    'line_order'       => 1,
                    'movement_type'    => 'credit',
                    'account_type'     => 'fixed',
                    'account_key'      => 'desembolso_saldos_a_favor',
                    'description'      => 'Devolución desembolsos saldos a favor {reference} {clienteNombre}',
                    'amount_component' => 'capital',
                    'cargo_adicional_key' => null,
                    'created_at'       => now(),
                    'updated_at'       => now(),
                ],
            ]);
        }

        // ANULACION_REINTEGRO_SALDO — reverso de REINTEGRO_SALDO (solitario)
        // Dr desembolso_saldos_a_favor / Cr cuenta_por_cobrar_pepito_plazo
        if (!DB::table('accounting_entry_configs')->where('entry_type', 'ANULACION_REINTEGRO_SALDO')->exists()) {
            $id2 = DB::table('accounting_entry_configs')->insertGetId([
                'entry_type'  => 'ANULACION_REINTEGRO_SALDO',
                'name'        => 'Anulación Reintegro de Saldo',
                'description' => 'Reverso de reintegro de saldo al cliente {reference} {clienteNombre}',
                'active'      => true,
                'created_at'  => now(),
                'updated_at'  => now(),
            ]);

            DB::table('accounting_entry_lines')->insert([
                [
                    'accounting_entry_config_id' => $id2,
                    'line_order'       => 0,
                    'movement_type'    => 'debit',
                    'account_type'     => 'fixed',
                    'account_key'      => 'desembolso_saldos_a_favor',
                    'description'      => 'Reverso desembolso reintegro {reference} {clienteNombre}',
                    'amount_component' => 'total',
                    'cargo_adicional_key' => null,
                    'created_at'       => now(),
                    'updated_at'       => now(),
                ],
                [
                    'accounting_entry_config_id' => $id2,
                    'line_order'       => 1,
                    'movement_type'    => 'credit',
                    'account_type'     => 'fixed',
                    'account_key'      => 'cuenta_por_cobrar_pepito_plazo',
                    'description'      => 'Reverso CxC reintegro saldo {reference} {clienteNombre}',
                    'amount_component' => 'total',
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
            ->whereIn('entry_type', ['ANULACION_ABONO_CAPITAL', 'ANULACION_REINTEGRO_SALDO'])
            ->pluck('id');

        DB::table('accounting_entry_lines')->whereIn('accounting_entry_config_id', $ids)->delete();
        DB::table('accounting_entry_configs')->whereIn('id', $ids)->delete();
    }
};
