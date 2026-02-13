<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\LeadController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\OpportunityController;
use App\Http\Controllers\Api\PersonDocumentController;
use App\Http\Controllers\Api\CreditPaymentController;
// Rewards Controllers
use App\Http\Controllers\Api\Rewards\RewardController;
use App\Http\Controllers\Api\Rewards\BadgeController;
use App\Http\Controllers\Api\Rewards\LeaderboardController;
use App\Http\Controllers\Api\Rewards\ChallengeController;
use App\Http\Controllers\Api\Rewards\CatalogController;
use App\Http\Controllers\Api\Rewards\RedemptionController;
use App\Http\Controllers\Api\Rewards\Admin\GamificationConfigController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\QuestionnaireController;
use App\Http\Controllers\Api\InstitucionController;
use App\Http\Controllers\Api\LeadAlertController;
use App\Http\Controllers\Api\TaskController;

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

// PDF público del Plan de Pagos
Route::get('/credits/{id}/plan-pdf', [\App\Http\Controllers\Api\CreditController::class, 'downloadPlanPDF']);
Route::get('/credits/{id}/plan-excel', [\App\Http\Controllers\Api\CreditController::class, 'downloadPlanExcel']);

// Utilidades / Listas
Route::get('/agents', function () {
    return response()->json(\App\Models\User::select('id', 'name')->get());
});

Route::get('/lead-statuses', function () {
    return response()->json(\App\Models\LeadStatus::select('id', 'name')->orderBy('order_column')->get());
});

// Products
Route::apiResource('products', ProductController::class);

// Instituciones
Route::apiResource('instituciones', InstitucionController::class);

// Leads
Route::patch('/leads/{id}/toggle-active', [LeadController::class, 'toggleActive']);
Route::post('/leads/{id}/convert', [LeadController::class, 'convertToClient']);
Route::post('/leads/delete-by-cedula', [LeadController::class, 'deleteByCedula']);

// Bulk actions for leads (MUST be before apiResource to avoid route conflicts)
Route::patch('/leads/bulk-archive', [LeadController::class, 'bulkArchive'])->middleware('auth:sanctum');
Route::post('/leads/bulk-convert', [LeadController::class, 'bulkConvert'])->middleware('auth:sanctum');

// Search persons (leads and clients) with autocomplete
Route::get('/persons/search', [LeadController::class, 'search']);

Route::apiResource('leads', LeadController::class);

// Questionnaires
Route::get('/questionnaire/status', [QuestionnaireController::class, 'checkStatus']);
Route::post('/questionnaire/submit', [QuestionnaireController::class, 'submit']);

// Clientes
Route::apiResource('clients', ClientController::class);
Route::post('/opportunities/{id}/move-files', [OpportunityController::class, 'moveFiles']);
Route::get('/opportunities/{id}/files', [OpportunityController::class, 'getFiles']);
Route::post('/opportunities/{id}/files', [OpportunityController::class, 'uploadFile']);
Route::delete('/opportunities/{id}/files/{filename}', [OpportunityController::class, 'deleteFile']);
Route::patch('/opportunities/update-status', [OpportunityController::class, 'updateStatus']);

// Bulk actions for opportunities (MUST be before apiResource to avoid route conflicts)
Route::delete('/opportunities/bulk', [OpportunityController::class, 'bulkDelete'])->middleware('auth:sanctum');

// Oportunidades
Route::apiResource('opportunities', OpportunityController::class);

// Tareas
Route::get('/tareas', [TaskController::class, 'index']);
Route::post('/tareas', [TaskController::class, 'store']);
Route::get('/tareas/{task}', [TaskController::class, 'show']);
Route::put('/tareas/{task}', [TaskController::class, 'update']);
Route::delete('/tareas/{task}', [TaskController::class, 'destroy']);
Route::post('/tareas/{task}/archivar', [TaskController::class, 'archive']);
Route::post('/tareas/{task}/restaurar', [TaskController::class, 'restore']);

// Automatización de Tareas
Route::get('/task-automations', [\App\Http\Controllers\Api\TaskAutomationController::class, 'index']);
Route::post('/task-automations', [\App\Http\Controllers\Api\TaskAutomationController::class, 'upsert']);

// Créditos - MOVIDO A RUTAS PROTEGIDAS (ver línea ~178)

// Deductoras (solo lectura - datos hardcodeados en config/deductoras.php)
Route::apiResource('deductoras', \App\Http\Controllers\Api\DeductoraController::class)->only(['index', 'show']);

// Configuración de Préstamos
Route::prefix('loan-configurations')->group(function () {
    Route::get('/', [\App\Http\Controllers\Api\LoanConfigurationController::class, 'index']);
    Route::get('/activas', [\App\Http\Controllers\Api\LoanConfigurationController::class, 'activas']);
    Route::get('/rangos', [\App\Http\Controllers\Api\LoanConfigurationController::class, 'rangosParaFormulario']);
    Route::get('/{tipo}', [\App\Http\Controllers\Api\LoanConfigurationController::class, 'porTipo']);
    Route::put('/{tipo}', [\App\Http\Controllers\Api\LoanConfigurationController::class, 'update']);
});

// Configuración ERP Contabilidad
Route::prefix('erp-accounting')->group(function () {
    Route::get('/accounts', [\App\Http\Controllers\Api\ErpAccountingConfigController::class, 'index']);
    Route::post('/accounts', [\App\Http\Controllers\Api\ErpAccountingConfigController::class, 'store']);
    Route::put('/accounts/{id}', [\App\Http\Controllers\Api\ErpAccountingConfigController::class, 'update']);
    Route::delete('/accounts/{id}', [\App\Http\Controllers\Api\ErpAccountingConfigController::class, 'destroy']);
    Route::post('/test-connection', [\App\Http\Controllers\Api\ErpAccountingConfigController::class, 'testConnection']);
});

// Documentos de Personas (Leads/Clientes) - Unificado
Route::get('/person-documents', [PersonDocumentController::class, 'index']);
Route::post('/person-documents', [PersonDocumentController::class, 'store']);
Route::delete('/person-documents/{id}', [PersonDocumentController::class, 'destroy']);
Route::get('/person-documents/check-cedula-folder', [PersonDocumentController::class, 'checkCedulaFolder']);
Route::post('/person-documents/sync-to-opportunity', [PersonDocumentController::class, 'syncToOpportunity']);

// Pagos de Crédito - MOVIDO A RUTAS PROTEGIDAS (ver línea ~178)

// Cotizaciones
Route::post('quotes/send', [\App\Http\Controllers\Api\QuoteController::class, 'sendQuote']);

// Chat Messages
Route::get('chat-messages', [\App\Http\Controllers\Api\ChatMessageController::class, 'index']);
Route::post('chat-messages', [\App\Http\Controllers\Api\ChatMessageController::class, 'store']);

// KPIs
Route::prefix('kpis')->group(function () {
    Route::get('/', [\App\Http\Controllers\Api\KpiController::class, 'all']);
    Route::get('/leads', [\App\Http\Controllers\Api\KpiController::class, 'leads']);
    Route::get('/opportunities', [\App\Http\Controllers\Api\KpiController::class, 'opportunities']);
    Route::get('/credits', [\App\Http\Controllers\Api\KpiController::class, 'credits']);
    Route::get('/collections', [\App\Http\Controllers\Api\KpiController::class, 'collections']);
    Route::get('/agents', [\App\Http\Controllers\Api\KpiController::class, 'agents']);
    Route::get('/gamification', [\App\Http\Controllers\Api\KpiController::class, 'gamification']);
    Route::get('/business', [\App\Http\Controllers\Api\KpiController::class, 'business']);
    Route::get('/trends', [\App\Http\Controllers\Api\KpiController::class, 'trends']);
});

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
    Route::post('/users/{id}/set-default-lead-assignee', [\App\Http\Controllers\Api\UserController::class, 'setDefaultLeadAssignee']);

    // Roles and Permissions
    Route::apiResource('roles', \App\Http\Controllers\Api\RoleController::class);

    // Lead Alerts (Inactivity tracking)
    Route::get('/lead-alerts/count', [LeadAlertController::class, 'count']);
    Route::get('/lead-alerts', [LeadAlertController::class, 'index']);
    Route::patch('/lead-alerts/{id}/read', [LeadAlertController::class, 'markAsRead']);

    // Trigger manual de verificación de inactividad
    Route::post('/admin/trigger-inactivity-check', function() {
        \Illuminate\Support\Facades\Artisan::call('leads:check-inactivity');
        $output = \Illuminate\Support\Facades\Artisan::output();

        return response()->json([
            'message' => 'Comando ejecutado exitosamente',
            'output' => $output,
            'timestamp' => now()->toIso8601String()
        ]);
    });

    // Analisis CRUD (Protegido)
    // Bulk actions for analisis (MUST be before apiResource to avoid route conflicts)
    Route::patch('analisis/bulk-status', [\App\Http\Controllers\Api\AnalisisController::class, 'bulkStatus']);

    Route::apiResource('analisis', \App\Http\Controllers\Api\AnalisisController::class);
    Route::get('analisis/{id}/files', [\App\Http\Controllers\Api\AnalisisController::class, 'getFiles']);
    Route::post('analisis/{id}/files', [\App\Http\Controllers\Api\AnalisisController::class, 'uploadFile']);
    Route::delete('analisis/{id}/files/{filename}', [\App\Http\Controllers\Api\AnalisisController::class, 'deleteFile']);

    // Propuestas de Análisis (Protegido)
    Route::get('analisis/{reference}/propuestas', [\App\Http\Controllers\Api\PropuestaController::class, 'index']);
    Route::post('analisis/{reference}/propuestas', [\App\Http\Controllers\Api\PropuestaController::class, 'store']);
    Route::put('propuestas/{id}', [\App\Http\Controllers\Api\PropuestaController::class, 'update']);
    Route::delete('propuestas/{id}', [\App\Http\Controllers\Api\PropuestaController::class, 'destroy']);
    Route::patch('propuestas/{id}/aceptar', [\App\Http\Controllers\Api\PropuestaController::class, 'aceptar']);
    Route::patch('propuestas/{id}/denegar', [\App\Http\Controllers\Api\PropuestaController::class, 'denegar']);

    // Créditos (Protegido)
    Route::get('credits/next-reference', [\App\Http\Controllers\Api\CreditController::class, 'nextReference']);
    Route::apiResource('credits', \App\Http\Controllers\Api\CreditController::class);
    Route::get('credits/{id}/balance', [\App\Http\Controllers\Api\CreditController::class, 'balance']);
    Route::post('credits/{id}/generate-plan-de-pagos', [\App\Http\Controllers\Api\CreditController::class, 'generatePlanDePagos']);
    Route::get('credits/{id}/documents', [\App\Http\Controllers\Api\CreditController::class, 'documents']);
    Route::post('credits/{id}/documents', [\App\Http\Controllers\Api\CreditController::class, 'storeDocument']);
    Route::delete('credits/{id}/documents/{documentId}', [\App\Http\Controllers\Api\CreditController::class, 'destroyDocument']);

    // Refundición de Créditos
    Route::get('credits/{id}/refundicion-preview', [\App\Http\Controllers\Api\CreditController::class, 'refundicionPreview']);
    Route::post('credits/{id}/refundicion', [\App\Http\Controllers\Api\CreditController::class, 'refundicion']);

    // Pagos de Crédito - Rutas específicas ANTES del apiResource
    Route::post('credit-payments/cancelacion-anticipada/calcular', [CreditPaymentController::class, 'calcularCancelacionAnticipada']);
    Route::post('credit-payments/cancelacion-anticipada', [CreditPaymentController::class, 'cancelacionAnticipada']);
    Route::post('credit-payments/preview-planilla', [CreditPaymentController::class, 'previewPlanilla']);
    Route::get('credit-payments/export-preview-excel/{hash}', [CreditPaymentController::class, 'exportPreviewExcel']);
    Route::get('credit-payments/export-preview-pdf/{hash}', [CreditPaymentController::class, 'exportPreviewPdf']);
    Route::post('credit-payments/upload', [CreditPaymentController::class, 'upload']);
    Route::post('credit-payments/adelanto', [CreditPaymentController::class, 'adelanto']);
    Route::post('credit-payments/{id}/reverse', [CreditPaymentController::class, 'reversePayment']);
    Route::apiResource('credit-payments', CreditPaymentController::class);

    // Saldos Pendientes (sobrantes de planilla)
    Route::get('saldos-pendientes', [\App\Http\Controllers\Api\SaldoPendienteController::class, 'index']);
    Route::post('saldos-pendientes/{id}/preview', [\App\Http\Controllers\Api\SaldoPendienteController::class, 'previewAsignacion']);
    Route::post('saldos-pendientes/{id}/asignar', [\App\Http\Controllers\Api\SaldoPendienteController::class, 'asignar']);

    // Historial de Planillas
    Route::get('planilla-uploads', [\App\Http\Controllers\Api\PlanillaUploadController::class, 'index']);
    Route::get('planilla-uploads/{id}', [\App\Http\Controllers\Api\PlanillaUploadController::class, 'show']);
    Route::get('planilla-uploads/{id}/download', [\App\Http\Controllers\Api\PlanillaUploadController::class, 'download']);
    Route::post('planilla-uploads/{id}/anular', [\App\Http\Controllers\Api\PlanillaUploadController::class, 'anular']);

    // Tasas (Protegido)
    Route::apiResource('tasas', \App\Http\Controllers\Api\TasaController::class);
    Route::get('tasas/nombre/{nombre}', [\App\Http\Controllers\Api\TasaController::class, 'porNombre']);
    Route::patch('tasas/{id}/toggle-activo', [\App\Http\Controllers\Api\TasaController::class, 'toggleActivo']);

    // --- Admin Gamificación ---
    Route::prefix('admin/gamification')->group(function () {
        Route::get('/config', [GamificationConfigController::class, 'index']);
        Route::put('/config', [GamificationConfigController::class, 'update']);
        Route::get('/stats', [GamificationConfigController::class, 'stats']);
    });
});
