<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EvolutionServerConfig;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EvolutionServerConfigController extends Controller
{
    use LogsActivity;

    /** GET /api/evolution-server-config */
    public function show(): JsonResponse
    {
        return response()->json(EvolutionServerConfig::instance());
    }

    /** PUT /api/evolution-server-config */
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'base_url' => 'required|url|max:500',
        ]);

        $config = EvolutionServerConfig::instance();
        $config->update($validated);
        $this->logActivity('update', 'EvolutionServerConfig', $config,
            "URL servidor actualizada: {$config->base_url}", [], $request);

        return response()->json($config);
    }
}
