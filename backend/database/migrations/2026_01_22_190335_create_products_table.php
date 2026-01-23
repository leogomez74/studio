<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150)->unique();
            $table->string('slug')->index();
            $table->string('description')->nullable();
            $table->boolean('is_default')->default(false);
            $table->integer('order_column')->default(0);
            $table->timestamps();
        });

        // Insert default products
        $products = [
            ['name' => 'Micro Crédito', 'slug' => 'micro-credito', 'description' => 'Préstamos pequeños de rápida aprobación', 'order_column' => 1],
            ['name' => 'Crédito', 'slug' => 'credito', 'description' => 'Préstamos estándar', 'order_column' => 2, 'is_default' => true],
            ['name' => 'Divorcio', 'slug' => 'divorcio', 'description' => 'Servicios legales de divorcio', 'order_column' => 3],
            ['name' => 'Notariado', 'slug' => 'notariado', 'description' => 'Servicios notariales', 'order_column' => 4],
            ['name' => 'Testamentos', 'slug' => 'testamentos', 'description' => 'Redacción y trámites de testamentos', 'order_column' => 5],
            ['name' => 'Descuento de Facturas', 'slug' => 'descuento-de-facturas', 'description' => 'Descuento de facturas', 'order_column' => 6],
        ];

        foreach ($products as $product) {
            DB::table('products')->insert(array_merge($product, [
                'created_at' => now(),
                'updated_at' => now(),
            ]));
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
