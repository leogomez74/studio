<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Ampliar auth_password a text para soportar valores cifrados
        Schema::table('external_integrations', function (Blueprint $table) {
            $table->text('auth_password')->nullable()->change();
        });

        // Cifrar valores existentes en texto plano
        $rows = DB::table('external_integrations')
            ->whereNotNull('auth_token')
            ->orWhereNotNull('auth_password')
            ->get(['id', 'auth_token', 'auth_password']);

        foreach ($rows as $row) {
            $updates = [];

            if (!empty($row->auth_token)) {
                // Solo cifrar si no está ya cifrado (no empieza con eyJ que es base64 de Laravel encrypt)
                try {
                    Crypt::decryptString($row->auth_token);
                    // Ya está cifrado, skip
                } catch (\Exception $e) {
                    $updates['auth_token'] = Crypt::encryptString($row->auth_token);
                }
            }

            if (!empty($row->auth_password)) {
                try {
                    Crypt::decryptString($row->auth_password);
                } catch (\Exception $e) {
                    $updates['auth_password'] = Crypt::encryptString($row->auth_password);
                }
            }

            if (!empty($updates)) {
                DB::table('external_integrations')
                    ->where('id', $row->id)
                    ->update($updates);
            }
        }
    }

    public function down(): void
    {
        // Descifrar valores para revertir
        $rows = DB::table('external_integrations')
            ->whereNotNull('auth_token')
            ->orWhereNotNull('auth_password')
            ->get(['id', 'auth_token', 'auth_password']);

        foreach ($rows as $row) {
            $updates = [];

            if (!empty($row->auth_token)) {
                try {
                    $updates['auth_token'] = Crypt::decryptString($row->auth_token);
                } catch (\Exception $e) {
                    // Ya en texto plano
                }
            }

            if (!empty($row->auth_password)) {
                try {
                    $updates['auth_password'] = Crypt::decryptString($row->auth_password);
                } catch (\Exception $e) {
                    // Ya en texto plano
                }
            }

            if (!empty($updates)) {
                DB::table('external_integrations')
                    ->where('id', $row->id)
                    ->update($updates);
            }
        }

        Schema::table('external_integrations', function (Blueprint $table) {
            $table->string('auth_password')->nullable()->change();
        });
    }
};
