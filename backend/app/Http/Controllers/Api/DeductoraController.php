<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Deductora;
use Illuminate\Http\Request;

class DeductoraController extends Controller
{
    public function index()
    {
        return response()->json(Deductora::all());
    }

    public function show(string $id)
    {
        $deductora = Deductora::find($id);

        if (!$deductora) {
            return response()->json(['message' => 'Deductora no encontrada'], 404);
        }

        return response()->json($deductora);
    }
}
