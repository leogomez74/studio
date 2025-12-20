<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\LeadController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\OpportunityController;
use App\Http\Controllers\Api\PersonDocumentController;
use App\Http\Controllers\Api\CreditPaymentController;
use App\Http\Controllers\Api\LeadDocumentController;
// Rewards Controllers
use App\Http\Controllers\Api\Rewards\RewardController;
use App\Http\Controllers\Api\Rewards\BadgeController;
use App\Http\Controllers\Api\Rewards\LeaderboardController;
use App\Http\Controllers\Api\Rewards\ChallengeController;
use App\Http\Controllers\Api\Rewards\CatalogController;
use App\Http\Controllers\Api\Rewards\RedemptionController;
use App\Http\Controllers\Api\Rewards\Admin\GamificationConfigController;

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

// Utilidades / Listas
Route::get('/agents', function () {
    return response()->json(\App\Models\User::select('id', 'name')->get());
});

Route::get('/lead-statuses', function () {
    return response()->json(\App\Models\LeadStatus::select('id', 'name')->orderBy('order_column')->get());
});

// Leads
Route::patch('/leads/{id}/toggle-active', [LeadController::class, 'toggleActive']);
Route::post('/leads/{id}/convert', [LeadController::class, 'convertToClient']);
Route::apiResource('leads', LeadController::class);
Route::get('/leads/check-cedula-folder', [LeadDocumentController::class, 'checkCedulaFolder']);
Route::post('/leads/create-cedula-folder', [LeadDocumentController::class, 'createCedulaFolder']);
Route::post('/leads/{lead}/documents', [LeadDocumentController::class, 'store']);
Route::get('/leads/{lead}/documents', [LeadDocumentController::class, 'index']);
Route::delete('/leads/documents', [LeadDocumentController::class, 'destroy']);
// Clientes
Route::apiResource('clients', ClientController::class);
Route::post('/opportunities/{id}/move-files', [OpportunityController::class, 'moveFiles']);
Route::get('/opportunities/{id}/files', [OpportunityController::class, 'getFiles']);
Route::get('/leads/check-cedula-folder', [LeadDocumentController::class, 'checkCedulaFolder']);
// Oportunidades
Route::apiResource('opportunities', OpportunityController::class);

// Créditos
Route::apiResource('credits', \App\Http\Controllers\Api\CreditController::class);
Route::get('credits/{id}/balance', [\App\Http\Controllers\Api\CreditController::class, 'balance']);
Route::get('credits/{id}/documents', [\App\Http\Controllers\Api\CreditController::class, 'documents']);
Route::post('credits/{id}/documents', [\App\Http\Controllers\Api\CreditController::class, 'storeDocument']);
Route::delete('credits/{id}/documents/{documentId}', [\App\Http\Controllers\Api\CreditController::class, 'destroyDocument']);

// Deductoras
Route::apiResource('deductoras', \App\Http\Controllers\Api\DeductoraController::class);

// Documentos de Personas (Leads/Clientes)
Route::post('/person-documents', [PersonDocumentController::class, 'store']);
Route::delete('/person-documents/{id}', [PersonDocumentController::class, 'destroy']);

// Pagos de Crédito
Route::apiResource('credit-payments', CreditPaymentController::class);
Route::post('credit-payments/upload', [CreditPaymentController::class, 'upload']);
Route::post('credit-payments/adelanto', [CreditPaymentController::class, 'adelanto']);

// Analisis CRUD
Route::apiResource('analisis', \App\Http\Controllers\Api\AnalisisController::class);

// Enterprises CRUD
// GET /api/enterprises?business_name=NombreEmpresa para filtrar por empresa
Route::apiResource('enterprises', \App\Http\Controllers\Api\EnterpriseEmployeeDocumentController::class);

// --- Rewards / Gamificación (Público temporalmente) ---
Route::prefix('rewards')->group(function () {
    // Perfil y balance
    Route::get('/profile', [RewardController::class, 'profile']);
    Route::get('/balance', [RewardController::class, 'balance']);
    Route::get('/history', [RewardController::class, 'history']);
    Route::get('/dashboard', [RewardController::class, 'dashboard']);

    // Analytics
    Route::get('/analytics', [\App\Http\Controllers\Api\Rewards\AnalyticsController::class, 'all']);
    Route::get('/analytics/overview', [\App\Http\Controllers\Api\Rewards\AnalyticsController::class, 'overview']);
    Route::get('/analytics/top-actions', [\App\Http\Controllers\Api\Rewards\AnalyticsController::class, 'topActions']);
    Route::get('/analytics/badge-distribution', [\App\Http\Controllers\Api\Rewards\AnalyticsController::class, 'badgeDistribution']);
    Route::get('/analytics/challenge-stats', [\App\Http\Controllers\Api\Rewards\AnalyticsController::class, 'challengeStats']);
    Route::get('/analytics/redemptions-by-category', [\App\Http\Controllers\Api\Rewards\AnalyticsController::class, 'redemptionsByCategory']);
    Route::get('/analytics/weekly-activity', [\App\Http\Controllers\Api\Rewards\AnalyticsController::class, 'weeklyActivity']);

    // Badges
    Route::get('/badges', [BadgeController::class, 'index']);
    Route::get('/badges/available', [BadgeController::class, 'available']);
    Route::get('/badges/progress', [BadgeController::class, 'progress']);
    Route::get('/badges/{id}', [BadgeController::class, 'show']);

    // Leaderboard
    Route::get('/leaderboard', [LeaderboardController::class, 'index']);
    Route::get('/leaderboard/position', [LeaderboardController::class, 'myPosition']);
    Route::get('/leaderboard/stats', [LeaderboardController::class, 'stats']);

    // Challenges
    Route::get('/challenges', [ChallengeController::class, 'index']);
    Route::get('/challenges/{id}', [ChallengeController::class, 'show']);
    Route::post('/challenges/{id}/join', [ChallengeController::class, 'join']);
    Route::get('/challenges/{id}/progress', [ChallengeController::class, 'progress']);

    // Catálogo
    Route::get('/catalog', [CatalogController::class, 'index']);
    Route::get('/catalog/{id}', [CatalogController::class, 'show']);
    Route::post('/catalog/{id}/redeem', [CatalogController::class, 'redeem']);

    // Redenciones
    Route::get('/redemptions', [RedemptionController::class, 'index']);
});


// --- Rutas Protegidas (Requieren Sanctum) ---
Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/user', function (Request $request) {
        return $request->user();
    });
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::apiResource('users', \App\Http\Controllers\Api\UserController::class);

    // --- Admin Gamificación ---
    Route::prefix('admin/gamification')->group(function () {
        Route::get('/config', [GamificationConfigController::class, 'index']);
        Route::put('/config', [GamificationConfigController::class, 'update']);
        Route::get('/stats', [GamificationConfigController::class, 'stats']);
    });
});
