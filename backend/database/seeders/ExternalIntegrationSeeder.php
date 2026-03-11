<?php

namespace Database\Seeders;

use App\Models\ExternalIntegration;
use Illuminate\Database\Seeder;

class ExternalIntegrationSeeder extends Seeder
{
    public function run(): void
    {
        $url = config('services.dsf.url');
        $token = config('services.dsf.token');

        if (empty($url) || empty($token)) {
            $this->command->warn('DSF_API_URL o DSF_API_TOKEN no configurados en .env, omitiendo.');
            return;
        }

        ExternalIntegration::updateOrCreate(
            ['slug' => 'dsf3'],
            [
                'name' => 'DSF3',
                'type' => 'rutas',
                'base_url' => $url,
                'auth_type' => 'bearer',
                'auth_token' => $token,
                'endpoints' => ['rutas' => '/api/external/rutas'],
                'is_active' => true,
            ]
        );
    }
}
