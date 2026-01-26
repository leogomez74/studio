<?php

namespace Database\Seeders;

use App\Models\Product;
use Illuminate\Database\Seeder;

class ProductSeeder extends Seeder
{
    public function run(): void
    {
        $products = [
            [
                'name' => 'Personal (Diferentes usos)',
                'slug' => 'personal',
                'description' => 'Crédito personal para diferentes usos',
                'is_default' => true,
                'order_column' => 1,
            ],
            [
                'name' => 'Refundición (Pagar deudas actuales)',
                'slug' => 'refundicion',
                'description' => 'Crédito para consolidar y pagar deudas existentes',
                'is_default' => false,
                'order_column' => 2,
            ],
            [
                'name' => 'Microcrédito (Hasta ₡690.000)',
                'slug' => 'microcredito',
                'description' => 'Microcrédito hasta 690.000 colones',
                'is_default' => false,
                'order_column' => 3,
            ],
            [
                'name' => 'Descuento de facturas',
                'slug' => 'descuento-facturas',
                'description' => 'Crédito por descuento de facturas',
                'is_default' => false,
                'order_column' => 4,
            ],
        ];

        foreach ($products as $product) {
            Product::updateOrCreate(
                ['name' => $product['name']],
                $product
            );
        }
    }
}
