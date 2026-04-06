<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('expedientes_judiciales', function (Blueprint $table) {
            // Si Credipep es quien presentó la demanda (actor) o solo fue citado como parte
            // Ref: Carlos explicó que hay expedientes que "no presentamos nosotros, sino el banco,
            // pero igual nos notifican porque estamos como parte".
            $table->boolean('credipep_es_actor')->default(true)->after('sub_estado')
                ->comment('true = Credipep presentó la demanda; false = Credipep fue citado como parte');

            // Patrono actual del deudor — necesario para solicitar embargo de salario al juzgado
            // y para solicitar cambio de patrono cuando la persona cambia de trabajo.
            // Ref: Carlos: "para hacer el embargo de salario se indica el patrono...
            //  si cambió de trabajo tengo que solicitar un cambio de patrono al PJ".
            $table->string('patrono_deudor')->nullable()->after('nombre_deudor')
                ->comment('Empleador actual del deudor para efectos de embargo de salario');

            $table->string('patrono_anterior')->nullable()->after('patrono_deudor')
                ->comment('Empleador anterior — registrado cuando se detecta cambio de trabajo');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('expedientes_judiciales', function (Blueprint $table) {
            $table->dropColumn(['credipep_es_actor', 'patrono_deudor', 'patrono_anterior']);
        });
    }
};
