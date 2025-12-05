<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\LeadController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\OpportunityController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Aquí se registran las rutas de la API. Por defecto están protegidas,
| pero las hemos dejado públicas temporalmente para facilitar la integración
| con el Frontend de Next.js.
|
*/

// --- Autenticación ---
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

// --- Rutas de Negocio (Públicas) ---

// Leads
Route::post('/leads/{id}/convert', [LeadController::class, 'convertToClient']);
Route::apiResource('leads', LeadController::class);

// Clientes
Route::apiResource('clients', ClientController::class);

// Oportunidades
Route::apiResource('opportunities', OpportunityController::class);


// --- Rutas Protegidas (Requieren Sanctum) ---
Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    Route::post('/logout', [AuthController::class, 'logout']);
});
