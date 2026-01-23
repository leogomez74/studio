<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class DeductoraController extends Controller
{
    public function index()
    {
        return response()->json(config('deductoras.list'));
    }

    public function show(string $id)
    {
        $deductoras = config('deductoras.list');
        $deductora = collect($deductoras)->firstWhere('id', (int) $id);

        if (!$deductora) {
            return response()->json(['message' => 'Deductora no encontrada'], 404);
        }

        return response()->json($deductora);
    }
}
