<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\LeadController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\OpportunityController;
use App\Http\Controllers\Api\PersonDocumentController;
use App\Http\Controllers\Api\CreditPaymentController;
use App\Http\Controllers\Api\InvestorController;
use App\Http\Controllers\Api\InvestmentController;
use App\Http\Controllers\Api\InvestmentCouponController;
use App\Http\Controllers\Api\InvestmentPaymentController;
use App\Http\Controllers\Api\InvestmentExportController;
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
use App\Http\Controllers\Api\CommentController;
use App\Http\Controllers\Api\NotificationController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Rutas públicas: solo autenticación y exports que se abren en nueva pestaña.
| Todo lo demás requiere auth:sanctum.
|
*/

// --- Autenticación (públicas) ---
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

// --- PDFs/Excel públicos del Plan de Pagos (se abren en nueva pestaña) ---
Route::get('/credits/{id}/plan-pdf', [\App\Http\Controllers\Api\CreditController::class, 'downloadPlanPDF']);
Route::get('/credits/{id}/plan-excel', [\App\Http\Controllers\Api\CreditController::class, 'downloadPlanExcel']);

// --- Exports de Inversiones (se abren en nueva pestaña del navegador, sin auth header) ---
Route::get('investments/export/tabla-general-pdf', [InvestmentExportController::class, 'tablaGeneralPdf']);
Route::get('investments/export/tabla-general-excel', [InvestmentExportController::class, 'tablaGeneralExcel']);
Route::get('investments/export/retenciones-pdf', [InvestmentExportController::class, 'retencionesPdf']);
Route::get('investments/export/retenciones-excel', [InvestmentExportController::class, 'retencionesExcel']);
Route::get('investors/{id}/export/pdf', [InvestmentExportController::class, 'inversionistaPdf']);
Route::get('investors/{id}/export/excel', [InvestmentExportController::class, 'inversionistaExcel']);
Route::get('investments/{id}/export/pdf', [InvestmentExportController::class, 'detalleInversionPdf']);
Route::get('investments/{id}/export/excel', [InvestmentExportController::class, 'detalleInversionExcel']);
Route::get('investments/{id}/export/estado-cuenta', [InvestmentExportController::class, 'estadoCuentaPdf']);

// --- Registro público de leads (formulario compartido en redes) ---
Route::post('/leads', [LeadController::class, 'store']);

// --- Cuestionario público (accedido desde link enviado por WhatsApp) ---
Route::get('/questionnaire/status', [QuestionnaireController::class, 'checkStatus']);
Route::post('/questionnaire/submit', [QuestionnaireController::class, 'submit']);
Route::get('/instituciones', [InstitucionController::class, 'index']);

// =============================================================================
// RUTAS PROTEGIDAS — Requieren autenticación Sanctum
// =============================================================================
Route::middleware(['auth:sanctum'])->group(function () {

    // --- Sesión ---
    Route::get('/user', function (Request $request) { return $request->user(); });
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    // --- Usuarios y Roles ---
    Route::apiResource('users', \App\Http\Controllers\Api\UserController::class);
    Route::post('/users/{id}/set-default-lead-assignee', [\App\Http\Controllers\Api\UserController::class, 'setDefaultLeadAssignee']);
    Route::apiResource('roles', \App\Http\Controllers\Api\RoleController::class);

    // --- Utilidades / Listas ---
    Route::get('/agents', function () {
        return response()->json(\App\Models\User::select('id', 'name')->get());
    });
    Route::get('/lead-statuses', function () {
        return response()->json(\App\Models\LeadStatus::select('id', 'name')->orderBy('order_column')->get());
    });

    // --- Productos e Instituciones ---
    Route::apiResource('products', ProductController::class);
    Route::apiResource('instituciones', InstitucionController::class)->except(['index']);

    // --- Leads ---
    Route::patch('/leads/{id}/toggle-active', [LeadController::class, 'toggleActive']);
    Route::post('/leads/{id}/convert', [LeadController::class, 'convertToClient']);
    Route::post('/leads/delete-by-cedula', [LeadController::class, 'deleteByCedula']);
    // Bulk actions ANTES del apiResource para evitar conflictos de rutas
    Route::patch('/leads/bulk-archive', [LeadController::class, 'bulkArchive']);
    Route::post('/leads/bulk-convert', [LeadController::class, 'bulkConvert']);
    Route::get('/persons/search', [LeadController::class, 'search']);
    Route::apiResource('leads', LeadController::class)->except(['store']);

    // --- Clientes ---
    Route::apiResource('clients', ClientController::class);

    // --- Oportunidades ---
    Route::post('/opportunities/{id}/move-files', [OpportunityController::class, 'moveFiles']);
    Route::get('/opportunities/{id}/files', [OpportunityController::class, 'getFiles']);
    Route::post('/opportunities/{id}/files', [OpportunityController::class, 'uploadFile']);
    Route::delete('/opportunities/{id}/files/{filename}', [OpportunityController::class, 'deleteFile']);
    Route::patch('/opportunities/update-status', [OpportunityController::class, 'updateStatus']);
    // Bulk action ANTES del apiResource
    Route::delete('/opportunities/bulk', [OpportunityController::class, 'bulkDelete']);
    Route::apiResource('opportunities', OpportunityController::class);

    // --- Tareas ---
    Route::get('/tareas', [TaskController::class, 'index']);
    Route::post('/tareas', [TaskController::class, 'store']);
    Route::get('/tareas/{task}', [TaskController::class, 'show']);
    Route::put('/tareas/{task}', [TaskController::class, 'update']);
    Route::delete('/tareas/{task}', [TaskController::class, 'destroy']);
    Route::post('/tareas/{task}/archivar', [TaskController::class, 'archive']);
    Route::post('/tareas/{task}/restaurar', [TaskController::class, 'restore']);

    // --- Automatización de Tareas ---
    Route::get('/task-automations', [\App\Http\Controllers\Api\TaskAutomationController::class, 'index']);
    Route::post('/task-automations', [\App\Http\Controllers\Api\TaskAutomationController::class, 'upsert']);

    // --- Deductoras ---
    Route::apiResource('deductoras', \App\Http\Controllers\Api\DeductoraController::class)->only(['index', 'show', 'update']);

    // --- Configuración de Préstamos ---
    Route::prefix('loan-configurations')->group(function () {
        Route::get('/', [\App\Http\Controllers\Api\LoanConfigurationController::class, 'index']);
        Route::get('/activas', [\App\Http\Controllers\Api\LoanConfigurationController::class, 'activas']);
        Route::get('/rangos', [\App\Http\Controllers\Api\LoanConfigurationController::class, 'rangosParaFormulario']);
        Route::get('/{tipo}', [\App\Http\Controllers\Api\LoanConfigurationController::class, 'porTipo']);
        Route::put('/{tipo}', [\App\Http\Controllers\Api\LoanConfigurationController::class, 'update']);
    });

    // --- Configuración ERP Contabilidad ---
    Route::prefix('erp-accounting')->group(function () {
        Route::get('/accounts', [\App\Http\Controllers\Api\ErpAccountingConfigController::class, 'index']);
        Route::post('/accounts', [\App\Http\Controllers\Api\ErpAccountingConfigController::class, 'store']);
        Route::put('/accounts/{id}', [\App\Http\Controllers\Api\ErpAccountingConfigController::class, 'update']);
        Route::delete('/accounts/{id}', [\App\Http\Controllers\Api\ErpAccountingConfigController::class, 'destroy']);
        Route::post('/test-connection', [\App\Http\Controllers\Api\ErpAccountingConfigController::class, 'testConnection']);
        Route::get('/accounts/validation-status', [\App\Http\Controllers\Api\ErpAccountingConfigController::class, 'validationStatus']);
    });

    // --- Configuración de Asientos Contables ---
    Route::prefix('accounting-entry-configs')->group(function () {
        Route::get('/', [\App\Http\Controllers\Api\AccountingEntryConfigController::class, 'index']);
        Route::get('/{id}', [\App\Http\Controllers\Api\AccountingEntryConfigController::class, 'show']);
        Route::post('/', [\App\Http\Controllers\Api\AccountingEntryConfigController::class, 'store']);
        Route::put('/{id}', [\App\Http\Controllers\Api\AccountingEntryConfigController::class, 'update']);
        Route::delete('/{id}', [\App\Http\Controllers\Api\AccountingEntryConfigController::class, 'destroy']);
        Route::post('/{id}/toggle', [\App\Http\Controllers\Api\AccountingEntryConfigController::class, 'toggle']);
        Route::post('/{id}/preview', [\App\Http\Controllers\Api\AccountingEntryConfigController::class, 'preview']);
    });

    // --- Log de Asientos Contables enviados al ERP ---
    Route::prefix('accounting-entry-logs')->group(function () {
        Route::get('/', [\App\Http\Controllers\Api\AccountingEntryLogController::class, 'index']);
        Route::get('/stats', [\App\Http\Controllers\Api\AccountingEntryLogController::class, 'stats']);
        Route::get('/alerts', [\App\Http\Controllers\Api\AccountingEntryLogController::class, 'alerts']);
        Route::get('/export', [\App\Http\Controllers\Api\AccountingEntryLogController::class, 'export']);
        Route::get('/{id}', [\App\Http\Controllers\Api\AccountingEntryLogController::class, 'show']);
        Route::post('/{id}/retry', [\App\Http\Controllers\Api\AccountingEntryLogController::class, 'retry']);
    });

    // --- Bitácora de Auditoría General del Sistema ---
    Route::prefix('activity-logs')->group(function () {
        Route::get('/', [\App\Http\Controllers\Api\ActivityLogController::class, 'index']);
        Route::get('/stats', [\App\Http\Controllers\Api\ActivityLogController::class, 'stats']);
        Route::get('/alerts', [\App\Http\Controllers\Api\ActivityLogController::class, 'alerts']);
        Route::get('/export', [\App\Http\Controllers\Api\ActivityLogController::class, 'export']);
        Route::get('/{id}', [\App\Http\Controllers\Api\ActivityLogController::class, 'show']);
    });

    // --- Documentos de Personas (Leads/Clientes) ---
    Route::get('/person-documents', [PersonDocumentController::class, 'index']);
    Route::post('/person-documents', [PersonDocumentController::class, 'store']);
    Route::delete('/person-documents/{id}', [PersonDocumentController::class, 'destroy']);
    Route::get('/person-documents/check-cedula-folder', [PersonDocumentController::class, 'checkCedulaFolder']);
    Route::post('/person-documents/sync-to-opportunity', [PersonDocumentController::class, 'syncToOpportunity']);

    // --- Cotizaciones ---
    Route::post('quotes/send', [\App\Http\Controllers\Api\QuoteController::class, 'sendQuote']);

    // --- Chat Messages ---
    Route::get('chat-messages', [\App\Http\Controllers\Api\ChatMessageController::class, 'index']);
    Route::post('chat-messages', [\App\Http\Controllers\Api\ChatMessageController::class, 'store']);

    // --- KPIs ---
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

    // --- Enterprises ---
    Route::apiResource('enterprises', \App\Http\Controllers\Api\EnterpriseEmployeeDocumentController::class);

    // --- Rewards / Gamificación ---
    Route::prefix('rewards')->group(function () {
        Route::get('/profile', [RewardController::class, 'profile']);
        Route::get('/balance', [RewardController::class, 'balance']);
        Route::get('/history', [RewardController::class, 'history']);
        Route::get('/dashboard', [RewardController::class, 'dashboard']);

        Route::get('/analytics', [\App\Http\Controllers\Api\Rewards\AnalyticsController::class, 'all']);
        Route::get('/analytics/overview', [\App\Http\Controllers\Api\Rewards\AnalyticsController::class, 'overview']);
        Route::get('/analytics/top-actions', [\App\Http\Controllers\Api\Rewards\AnalyticsController::class, 'topActions']);
        Route::get('/analytics/badge-distribution', [\App\Http\Controllers\Api\Rewards\AnalyticsController::class, 'badgeDistribution']);
        Route::get('/analytics/challenge-stats', [\App\Http\Controllers\Api\Rewards\AnalyticsController::class, 'challengeStats']);
        Route::get('/analytics/redemptions-by-category', [\App\Http\Controllers\Api\Rewards\AnalyticsController::class, 'redemptionsByCategory']);
        Route::get('/analytics/weekly-activity', [\App\Http\Controllers\Api\Rewards\AnalyticsController::class, 'weeklyActivity']);

        Route::get('/badges', [BadgeController::class, 'index']);
        Route::get('/badges/available', [BadgeController::class, 'available']);
        Route::get('/badges/progress', [BadgeController::class, 'progress']);
        Route::get('/badges/{id}', [BadgeController::class, 'show']);

        Route::get('/leaderboard', [LeaderboardController::class, 'index']);
        Route::get('/leaderboard/position', [LeaderboardController::class, 'myPosition']);
        Route::get('/leaderboard/stats', [LeaderboardController::class, 'stats']);

        Route::get('/challenges', [ChallengeController::class, 'index']);
        Route::get('/challenges/{id}', [ChallengeController::class, 'show']);
        Route::post('/challenges/{id}/join', [ChallengeController::class, 'join']);
        Route::get('/challenges/{id}/progress', [ChallengeController::class, 'progress']);

        Route::get('/catalog', [CatalogController::class, 'index']);
        Route::get('/catalog/{id}', [CatalogController::class, 'show']);
        Route::post('/catalog/{id}/redeem', [CatalogController::class, 'redeem']);

        Route::get('/redemptions', [RedemptionController::class, 'index']);
    });

    // --- Inversiones ---
    Route::get('investments/tabla-general', [InvestmentController::class, 'tablaGeneral']);
    Route::get('investments/pagos-proximos', [InvestmentController::class, 'pagosProximos']);
    Route::get('investments/reservas', [InvestmentController::class, 'reservas']);
    Route::get('investments/preview', [InvestmentController::class, 'preview']);
    Route::get('investments/vencimientos', [InvestmentController::class, 'vencimientos']);
    Route::get('investments/{id}/reserva', [InvestmentController::class, 'reservaDetalle']);
    Route::post('investments/{id}/liquidate', [InvestmentController::class, 'liquidate']);
    Route::post('investments/{id}/renew', [InvestmentController::class, 'renew']);
    Route::post('investments/{id}/cancel', [InvestmentController::class, 'cancel']);
    Route::patch('investment-coupons/bulk-pay', [InvestmentCouponController::class, 'markBulkPaid']);
    Route::patch('investment-coupons/{id}/pay', [InvestmentCouponController::class, 'markPaid']);
    Route::patch('investment-coupons/{id}/correct', [InvestmentCouponController::class, 'correct']);
    Route::apiResource('investors', InvestorController::class);
    Route::apiResource('investments', InvestmentController::class);
    Route::apiResource('investment-payments', InvestmentPaymentController::class)->only(['index', 'store', 'destroy']);
    Route::get('investments/{id}/coupons', [InvestmentCouponController::class, 'index']);

    // --- Embargo ---
    Route::get('/embargo/personas', [\App\Http\Controllers\Api\EmbargoCalculatorController::class, 'buscarPersonas']);
    Route::post('/calcular-embargo', [\App\Http\Controllers\Api\EmbargoCalculatorController::class, 'calcular']);
    Route::get('/embargo-configuracion', [\App\Http\Controllers\Api\EmbargoConfiguracionController::class, 'show']);
    Route::put('/embargo-configuracion', [\App\Http\Controllers\Api\EmbargoConfiguracionController::class, 'update']);
    Route::post('/embargo-configuracion/verificar-pdf', [\App\Http\Controllers\Api\EmbargoConfiguracionController::class, 'verificarPdf']);

    // --- Lead Alerts ---
    Route::get('/lead-alerts/count', [LeadAlertController::class, 'count']);
    Route::get('/lead-alerts', [LeadAlertController::class, 'index']);
    Route::patch('/lead-alerts/{id}/read', [LeadAlertController::class, 'markAsRead']);

    // --- Analisis ---
    Route::patch('analisis/bulk-status', [\App\Http\Controllers\Api\AnalisisController::class, 'bulkStatus']);
    Route::apiResource('analisis', \App\Http\Controllers\Api\AnalisisController::class);
    Route::get('analisis/{id}/files', [\App\Http\Controllers\Api\AnalisisController::class, 'getFiles']);
    Route::post('analisis/{id}/files', [\App\Http\Controllers\Api\AnalisisController::class, 'uploadFile']);
    Route::delete('analisis/{id}/files/{filename}', [\App\Http\Controllers\Api\AnalisisController::class, 'deleteFile']);

    // --- Propuestas de Análisis ---
    Route::get('analisis/{reference}/propuestas', [\App\Http\Controllers\Api\PropuestaController::class, 'index']);
    Route::post('analisis/{reference}/propuestas', [\App\Http\Controllers\Api\PropuestaController::class, 'store']);
    Route::put('propuestas/{id}', [\App\Http\Controllers\Api\PropuestaController::class, 'update']);
    Route::delete('propuestas/{id}', [\App\Http\Controllers\Api\PropuestaController::class, 'destroy']);
    Route::patch('propuestas/{id}/aceptar', [\App\Http\Controllers\Api\PropuestaController::class, 'aceptar']);
    Route::patch('propuestas/{id}/denegar', [\App\Http\Controllers\Api\PropuestaController::class, 'denegar']);

    // --- Créditos ---
    Route::get('credits/next-reference', [\App\Http\Controllers\Api\CreditController::class, 'nextReference']);
    Route::apiResource('credits', \App\Http\Controllers\Api\CreditController::class);
    Route::get('credits/{id}/balance', [\App\Http\Controllers\Api\CreditController::class, 'balance']);
    Route::post('credits/{id}/generate-plan-de-pagos', [\App\Http\Controllers\Api\CreditController::class, 'generatePlanDePagos']);
    Route::get('credits/{id}/documents', [\App\Http\Controllers\Api\CreditController::class, 'documents']);
    Route::post('credits/{id}/documents', [\App\Http\Controllers\Api\CreditController::class, 'storeDocument']);
    Route::delete('credits/{id}/documents/{documentId}', [\App\Http\Controllers\Api\CreditController::class, 'destroyDocument']);
    Route::get('credits/{id}/refundicion-preview', [\App\Http\Controllers\Api\CreditController::class, 'refundicionPreview']);
    Route::post('credits/{id}/refundicion', [\App\Http\Controllers\Api\CreditController::class, 'refundicion']);

    // --- Pagos de Crédito ---
    Route::post('credit-payments/carga-intereses', [CreditPaymentController::class, 'cargarInteresesSinDeductora']);
    Route::post('credit-payments/cancelacion-anticipada/calcular', [CreditPaymentController::class, 'calcularCancelacionAnticipada']);
    Route::post('credit-payments/cancelacion-anticipada', [CreditPaymentController::class, 'cancelacionAnticipada']);
    Route::post('credit-payments/preview-planilla', [CreditPaymentController::class, 'previewPlanilla']);
    Route::get('credit-payments/export-preview-excel/{hash}', [CreditPaymentController::class, 'exportPreviewExcel']);
    Route::get('credit-payments/export-preview-pdf/{hash}', [CreditPaymentController::class, 'exportPreviewPdf']);
    Route::post('credit-payments/upload', [CreditPaymentController::class, 'upload']);
    Route::post('credit-payments/adelanto', [CreditPaymentController::class, 'adelanto']);
    Route::post('credit-payments/abono-extraordinario/preview', [CreditPaymentController::class, 'previewAbonoExtraordinario']);
    Route::post('credit-payments/{id}/reverse', [CreditPaymentController::class, 'reversePayment']);
    Route::apiResource('credit-payments', CreditPaymentController::class);

    // --- Saldos Pendientes ---
    Route::get('saldos-pendientes', [\App\Http\Controllers\Api\SaldoPendienteController::class, 'index']);
    Route::post('saldos-pendientes/{id}/preview', [\App\Http\Controllers\Api\SaldoPendienteController::class, 'previewAsignacion']);
    Route::post('saldos-pendientes/{id}/asignar', [\App\Http\Controllers\Api\SaldoPendienteController::class, 'asignar']);
    Route::post('saldos-pendientes/{id}/reintegrar', [\App\Http\Controllers\Api\SaldoPendienteController::class, 'reintegrar']);

    // --- Historial de Planillas ---
    Route::get('planilla-uploads', [\App\Http\Controllers\Api\PlanillaUploadController::class, 'index']);
    Route::get('planilla-uploads/{id}', [\App\Http\Controllers\Api\PlanillaUploadController::class, 'show']);
    Route::get('planilla-uploads/{id}/download', [\App\Http\Controllers\Api\PlanillaUploadController::class, 'download']);
    Route::get('planilla-uploads/{id}/export-resumen', [\App\Http\Controllers\Api\PlanillaUploadController::class, 'exportResumen']);
    Route::post('planilla-uploads/{id}/anular', [\App\Http\Controllers\Api\PlanillaUploadController::class, 'anular']);

    // --- Tasas ---
    Route::apiResource('tasas', \App\Http\Controllers\Api\TasaController::class);
    Route::get('tasas/nombre/{nombre}', [\App\Http\Controllers\Api\TasaController::class, 'porNombre']);
    Route::patch('tasas/{id}/toggle-activo', [\App\Http\Controllers\Api\TasaController::class, 'toggleActivo']);

    // --- Comments ---
    Route::get('/comments', [CommentController::class, 'index']);
    Route::get('/comments/recent', [CommentController::class, 'recent']);
    Route::post('/comments', [CommentController::class, 'store']);
    Route::delete('/comments/{id}', [CommentController::class, 'destroy']);
    Route::patch('/comments/{id}/archive', [CommentController::class, 'archive']);
    Route::patch('/comments/{id}/unarchive', [CommentController::class, 'unarchive']);

    // --- Notifications ---
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/count', [NotificationController::class, 'count']);
    Route::patch('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
    Route::patch('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);

    // --- Admin ---
    Route::post('/admin/trigger-inactivity-check', function () {
        \Illuminate\Support\Facades\Artisan::call('leads:check-inactivity');
        $output = \Illuminate\Support\Facades\Artisan::output();
        return response()->json([
            'message' => 'Comando ejecutado exitosamente',
            'output'  => $output,
            'timestamp' => now()->toIso8601String()
        ]);
    });

    Route::post('/admin/clear-cache', function () {
        \Illuminate\Support\Facades\Artisan::call('cache:clear');
        $cacheOutput = \Illuminate\Support\Facades\Artisan::output();
        \Illuminate\Support\Facades\Artisan::call('config:clear');
        $configOutput = \Illuminate\Support\Facades\Artisan::output();
        \Illuminate\Support\Facades\Artisan::call('route:clear');
        $routeOutput = \Illuminate\Support\Facades\Artisan::output();
        return response()->json([
            'message' => 'Caché limpiado exitosamente',
            'cache'   => trim($cacheOutput),
            'config'  => trim($configOutput),
            'route'   => trim($routeOutput),
            'timestamp' => now()->toIso8601String()
        ]);
    });

    // --- Admin Gamificación ---
    Route::prefix('admin/gamification')->group(function () {
        Route::get('/config', [GamificationConfigController::class, 'index']);
        Route::put('/config', [GamificationConfigController::class, 'update']);
        Route::get('/stats', [GamificationConfigController::class, 'stats']);
    });
});
