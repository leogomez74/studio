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
use App\Http\Controllers\Api\MetaVentaController;
use App\Http\Controllers\Api\VisitaController;
use App\Http\Controllers\Api\ComisionController;
use App\Http\Controllers\Api\TareaRutaController;
use App\Http\Controllers\Api\RutaDiariaController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Rutas públicas: solo autenticación y exports que se abren en nueva pestaña.
| Todo lo demás requiere auth:sanctum.
|
*/

// --- Health check: solo status global (detalles requieren admin) ---
Route::get('/health/env', function () {
    $allOk = !empty(env('DB_DATABASE'))
        && !empty(config('services.erp.service_url'))
        && !empty(config('services.erp.service_token'))
        && !empty(config('services.credid.url'))
        && !empty(config('services.credid.token'))
        && !empty(config('services.dsf.url'))
        && !empty(config('services.dsf.token'));

    return response()->json([
        'status' => $allOk ? 'ok' : 'degraded',
        'timestamp' => now()->toIso8601String(),
    ], $allOk ? 200 : 503);
});

// --- Autenticación (públicas, con rate limiting) ---
Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:5,1');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');

// --- PDFs/Excel públicos del Plan de Pagos (se abren en nueva pestaña) ---
Route::get('/credits/{id}/plan-pdf', [\App\Http\Controllers\Api\CreditController::class, 'downloadPlanPDF']);
Route::get('/credits/{id}/plan-excel', [\App\Http\Controllers\Api\CreditController::class, 'downloadPlanExcel']);

// (exports de inversiones movidos a grupo auth:sanctum — ver abajo)

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

    // --- API Tokens ---
    Route::get('/api-tokens', [\App\Http\Controllers\Api\ApiTokenController::class, 'index']);
    Route::post('/api-tokens', [\App\Http\Controllers\Api\ApiTokenController::class, 'store']);
    Route::delete('/api-tokens/{id}', [\App\Http\Controllers\Api\ApiTokenController::class, 'destroy']);

    // --- Usuarios y Roles (admin) ---
    Route::apiResource('users', \App\Http\Controllers\Api\UserController::class)->middleware('admin');
    Route::post('/users/{id}/set-default-lead-assignee', [\App\Http\Controllers\Api\UserController::class, 'setDefaultLeadAssignee'])->middleware('admin');
    Route::apiResource('roles', \App\Http\Controllers\Api\RoleController::class)->middleware('admin');

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
    Route::post('/leads/delete-by-cedula', [LeadController::class, 'deleteByCedula'])->middleware('permission:crm,delete');
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
    Route::post('/opportunities/{id}/files', [OpportunityController::class, 'uploadFile'])->middleware('throttle:30,1');
    Route::delete('/opportunities/{id}/files/{filename}', [OpportunityController::class, 'deleteFile'])->middleware('permission:oportunidades,delete');
    Route::patch('/opportunities/update-status', [OpportunityController::class, 'updateStatus']);
    // Bulk action ANTES del apiResource
    Route::delete('/opportunities/bulk', [OpportunityController::class, 'bulkDelete'])->middleware('permission:oportunidades,delete');
    Route::apiResource('opportunities', OpportunityController::class);

    // --- Tareas ---
    Route::get('/tareas/overdue-count', [TaskController::class, 'overdueCount']);
    Route::get('/tareas', [TaskController::class, 'index']);
    Route::post('/tareas', [TaskController::class, 'store'])->middleware('permission:tareas,create');
    Route::get('/tareas/{task}', [TaskController::class, 'show']);
    Route::put('/tareas/{task}', [TaskController::class, 'update'])->middleware('permission:tareas,edit');
    Route::delete('/tareas/{task}', [TaskController::class, 'destroy'])->middleware('permission:tareas,delete');
    Route::post('/tareas/{task}/archivar', [TaskController::class, 'archive'])->middleware('permission:tareas,archive');
    Route::post('/tareas/{task}/restaurar', [TaskController::class, 'restore'])->middleware('permission:tareas,edit');
    Route::get('/tareas/{task}/timeline', [TaskController::class, 'timeline']);
    Route::get('/tareas/{task}/documents', [TaskController::class, 'documents']);
    Route::post('/tareas/{task}/documents', [TaskController::class, 'storeDocument'])->middleware('permission:tareas,edit');
    Route::delete('/tareas/{task}/documents/{document}', [TaskController::class, 'destroyDocument'])->middleware('permission:tareas,delete');
    Route::get('/tareas/{task}/checklist', [TaskController::class, 'checklistItems']);
    Route::post('/tareas/{task}/checklist', [TaskController::class, 'storeChecklistItem'])->middleware('permission:tareas,edit');
    Route::patch('/tareas/{task}/checklist/{item}/toggle', [TaskController::class, 'toggleChecklistItem'])->middleware('permission:tareas,edit');
    Route::delete('/tareas/{task}/checklist/{item}', [TaskController::class, 'destroyChecklistItem'])->middleware('permission:tareas,delete');

    // --- Rutas (Mensajería / Logística) ---
    Route::apiResource('tareas-ruta', TareaRutaController::class);
    Route::patch('/tareas-ruta/{id}/completar', [TareaRutaController::class, 'completar'])->middleware('throttle:60,1');
    Route::patch('/tareas-ruta/{id}/fallar', [TareaRutaController::class, 'fallar'])->middleware('throttle:60,1');
    Route::patch('/tareas-ruta/{id}/prioridad', [TareaRutaController::class, 'overridePrioridad'])->middleware(['admin', 'throttle:30,1']);
    Route::get('/tareas-ruta/{id}/evidencias', [TareaRutaController::class, 'evidencias']);
    Route::post('/tareas-ruta/{id}/evidencias', [TareaRutaController::class, 'uploadEvidencia'])->middleware('throttle:30,1');
    Route::delete('/tareas-ruta/{tareaId}/evidencias/{evidenciaId}', [TareaRutaController::class, 'deleteEvidencia'])->middleware('throttle:30,1');

    Route::get('/rutas-diarias', [RutaDiariaController::class, 'index']);
    Route::get('/rutas-diarias/mi-ruta', [RutaDiariaController::class, 'miRuta']);
    Route::get('/rutas-diarias/{id}', [RutaDiariaController::class, 'show']);
    Route::post('/rutas-diarias/generar', [RutaDiariaController::class, 'generar'])->middleware(['admin', 'throttle:30,1']);
    Route::patch('/rutas-diarias/{id}/confirmar', [RutaDiariaController::class, 'confirmar'])->middleware(['admin', 'throttle:60,1']);
    Route::patch('/rutas-diarias/{id}/iniciar', [RutaDiariaController::class, 'iniciar'])->middleware('throttle:60,1');
    Route::patch('/rutas-diarias/{id}/reordenar', [RutaDiariaController::class, 'reordenar'])->middleware(['admin', 'throttle:60,1']);
    Route::patch('/rutas-diarias/{id}/replanificar', [RutaDiariaController::class, 'replanificar'])->middleware(['admin', 'throttle:60,1']);
    Route::delete('/rutas-diarias/{id}/cancelar', [RutaDiariaController::class, 'cancelar'])->middleware(['admin', 'throttle:30,1']);

    // --- Automatización de Tareas ---
    Route::get('/task-automations', [\App\Http\Controllers\Api\TaskAutomationController::class, 'index'])->middleware('admin');
    Route::post('/task-automations', [\App\Http\Controllers\Api\TaskAutomationController::class, 'upsert'])->middleware('admin');

    // --- Integraciones Externas ---
    Route::apiResource('external-integrations', \App\Http\Controllers\Api\ExternalIntegrationController::class)->middleware('admin');
    Route::post('/external-integrations/{id}/test', [\App\Http\Controllers\Api\ExternalIntegrationController::class, 'test'])->middleware(['admin', 'throttle:10,1']);
    Route::get('/external-routes', [\App\Http\Controllers\Api\ExternalIntegrationController::class, 'routes'])->middleware('admin');
    Route::get('/external-routes/{id}', [\App\Http\Controllers\Api\ExternalIntegrationController::class, 'integrationRoutes'])->middleware('admin');

    // --- Deductoras ---
    Route::apiResource('deductoras', \App\Http\Controllers\Api\DeductoraController::class)->only(['index', 'show', 'update']);

    // --- Configuración de Préstamos ---
    Route::prefix('loan-configurations')->group(function () {
        Route::get('/', [\App\Http\Controllers\Api\LoanConfigurationController::class, 'index']);
        Route::get('/activas', [\App\Http\Controllers\Api\LoanConfigurationController::class, 'activas']);
        Route::get('/rangos', [\App\Http\Controllers\Api\LoanConfigurationController::class, 'rangosParaFormulario']);
        Route::get('/{tipo}', [\App\Http\Controllers\Api\LoanConfigurationController::class, 'porTipo']);
        Route::put('/{tipo}', [\App\Http\Controllers\Api\LoanConfigurationController::class, 'update'])->middleware(['admin', 'throttle:30,1']);
    });

    // --- Configuración ERP Contabilidad ---
    Route::prefix('erp-accounting')->middleware('admin')->group(function () {
        Route::get('/accounts', [\App\Http\Controllers\Api\ErpAccountingConfigController::class, 'index']);
        Route::post('/accounts', [\App\Http\Controllers\Api\ErpAccountingConfigController::class, 'store'])->middleware('throttle:30,1');
        Route::put('/accounts/{id}', [\App\Http\Controllers\Api\ErpAccountingConfigController::class, 'update'])->middleware('throttle:30,1');
        Route::delete('/accounts/{id}', [\App\Http\Controllers\Api\ErpAccountingConfigController::class, 'destroy'])->middleware('throttle:30,1');
        Route::post('/test-connection', [\App\Http\Controllers\Api\ErpAccountingConfigController::class, 'testConnection'])->middleware('throttle:10,1');
        Route::get('/accounts/validation-status', [\App\Http\Controllers\Api\ErpAccountingConfigController::class, 'validationStatus']);
    });

    // --- Configuración de Asientos Contables ---
    Route::prefix('accounting-entry-configs')->middleware('admin')->group(function () {
        Route::get('/', [\App\Http\Controllers\Api\AccountingEntryConfigController::class, 'index']);
        Route::get('/{id}', [\App\Http\Controllers\Api\AccountingEntryConfigController::class, 'show']);
        Route::post('/', [\App\Http\Controllers\Api\AccountingEntryConfigController::class, 'store'])->middleware('throttle:30,1');
        Route::put('/{id}', [\App\Http\Controllers\Api\AccountingEntryConfigController::class, 'update'])->middleware('throttle:30,1');
        Route::delete('/{id}', [\App\Http\Controllers\Api\AccountingEntryConfigController::class, 'destroy'])->middleware('throttle:30,1');
        Route::post('/{id}/toggle', [\App\Http\Controllers\Api\AccountingEntryConfigController::class, 'toggle'])->middleware('throttle:30,1');
        Route::post('/{id}/preview', [\App\Http\Controllers\Api\AccountingEntryConfigController::class, 'preview'])->middleware('throttle:30,1');
    });

    // --- Log de Asientos Contables enviados al ERP ---
    Route::prefix('accounting-entry-logs')->group(function () {
        Route::get('/', [\App\Http\Controllers\Api\AccountingEntryLogController::class, 'index']);
        Route::get('/stats', [\App\Http\Controllers\Api\AccountingEntryLogController::class, 'stats']);
        Route::get('/alerts', [\App\Http\Controllers\Api\AccountingEntryLogController::class, 'alerts']);
        Route::get('/export', [\App\Http\Controllers\Api\AccountingEntryLogController::class, 'export']);
        Route::get('/{id}', [\App\Http\Controllers\Api\AccountingEntryLogController::class, 'show']);
        Route::post('/{id}/retry', [\App\Http\Controllers\Api\AccountingEntryLogController::class, 'retry'])->middleware(['admin', 'throttle:10,1']);
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
    Route::post('/person-documents', [PersonDocumentController::class, 'store'])->middleware('throttle:30,1');
    Route::delete('/person-documents/{id}', [PersonDocumentController::class, 'destroy']);
    Route::get('/person-documents/check-cedula-folder', [PersonDocumentController::class, 'checkCedulaFolder']);
    Route::post('/person-documents/sync-to-opportunity', [PersonDocumentController::class, 'syncToOpportunity']);

    // --- Cotizaciones ---
    Route::post('quotes/send', [\App\Http\Controllers\Api\QuoteController::class, 'sendQuote'])->middleware('throttle:10,1');

    // --- Chat Messages ---
    Route::get('chat-messages', [\App\Http\Controllers\Api\ChatMessageController::class, 'index']);
    Route::post('chat-messages', [\App\Http\Controllers\Api\ChatMessageController::class, 'store']);

    // --- Reportes ---
    Route::prefix('reportes')->group(function () {
        Route::get('cartera',                   [\App\Http\Controllers\Api\ReporteController::class, 'cartera']);
        Route::get('cartera/excel',             [\App\Http\Controllers\Api\ReporteController::class, 'carteraExcel']);
        Route::get('cartera/pdf',               [\App\Http\Controllers\Api\ReporteController::class, 'carteraPdf']);
        Route::get('cartera-mora',              [\App\Http\Controllers\Api\ReporteController::class, 'carteraMora']);
        Route::get('cartera-mora/excel',        [\App\Http\Controllers\Api\ReporteController::class, 'carteraMoraExcel']);
        Route::get('cartera-mora/pdf',          [\App\Http\Controllers\Api\ReporteController::class, 'carteraMoraPdf']);
        Route::get('cartera-deductora',         [\App\Http\Controllers\Api\ReporteController::class, 'carteraDeductora']);
        Route::get('cartera-deductora/excel',   [\App\Http\Controllers\Api\ReporteController::class, 'carteraDeductoraExcel']);
        Route::get('novedades-planilla',        [\App\Http\Controllers\Api\ReporteController::class, 'novedadesPlanilla']);
        Route::get('novedades-planilla/pdf',    [\App\Http\Controllers\Api\ReporteController::class, 'novedadesPlanillaPdf']);
        Route::get('planilla-cobro/{id}',       [\App\Http\Controllers\Api\ReporteController::class, 'planillaCobro']);
        Route::get('planilla-cobro/{id}/pdf',   [\App\Http\Controllers\Api\ReporteController::class, 'planillaCobroPdf']);
        Route::get('planilla-reports-status',   [\App\Http\Controllers\Api\ReporteController::class, 'planillaReportsStatus']);
        Route::get('cobros',                    [\App\Http\Controllers\Api\ReporteController::class, 'cobros']);
        Route::get('cobros/excel',              [\App\Http\Controllers\Api\ReporteController::class, 'cobrosExcel']);
        Route::get('cobros/pdf',                [\App\Http\Controllers\Api\ReporteController::class, 'cobrosPdf']);
        Route::get('inversiones',               [\App\Http\Controllers\Api\ReporteController::class, 'inversiones']);
        Route::get('inversiones/excel',         [\App\Http\Controllers\Api\ReporteController::class, 'inversionesExcel']);
    });

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

    // --- Tipo de Cambio ---
    Route::get('exchange-rates/current', [\App\Http\Controllers\Api\ExchangeRateController::class, 'current']);
    Route::get('exchange-rates/history', [\App\Http\Controllers\Api\ExchangeRateController::class, 'history']);
    Route::post('exchange-rates', [\App\Http\Controllers\Api\ExchangeRateController::class, 'store'])->middleware(['admin', 'throttle:30,1']);
    Route::post('exchange-rates/refresh', [\App\Http\Controllers\Api\ExchangeRateController::class, 'refresh'])->middleware(['admin', 'throttle:10,1']);

    // --- Inversiones ---
    Route::get('investments/tabla-general', [InvestmentController::class, 'tablaGeneral']);
    Route::get('investments/pagos-proximos', [InvestmentController::class, 'pagosProximos']);
    Route::get('investments/reservas', [InvestmentController::class, 'reservas']);
    Route::get('investments/preview', [InvestmentController::class, 'preview']);
    Route::get('investments/vencimientos', [InvestmentController::class, 'vencimientos']);
    Route::get('investments/pagadas', [InvestmentController::class, 'pagadas']);
    Route::post('investments/recalculate-all', [InvestmentController::class, 'recalculateAll'])->middleware(['admin', 'throttle:5,1']);
    Route::get('investments/{id}/reserva', [InvestmentController::class, 'reservaDetalle']);
    Route::post('investments/{id}/liquidate', [InvestmentController::class, 'liquidate'])->middleware('throttle:30,1');
    Route::post('investments/{id}/renew', [InvestmentController::class, 'renew'])->middleware('throttle:30,1');
    Route::post('investments/{id}/cancel', [InvestmentController::class, 'cancel'])->middleware('throttle:30,1');
    Route::post('investments/{id}/cancelacion-total', [InvestmentController::class, 'cancelacionTotal'])->middleware('throttle:30,1');
    Route::patch('investment-coupons/bulk-pay', [InvestmentCouponController::class, 'markBulkPaid'])->middleware('throttle:30,1');
    Route::post('investment-coupons/bulk-pay-by-desembolso', [InvestmentCouponController::class, 'bulkPayByDesembolso'])->middleware('throttle:30,1');
    Route::patch('investment-coupons/{id}/pay', [InvestmentCouponController::class, 'markPaid'])->middleware('throttle:60,1');
    Route::patch('investment-coupons/{id}/correct', [InvestmentCouponController::class, 'correct'])->middleware('throttle:30,1');
    Route::apiResource('investors', InvestorController::class);
    Route::apiResource('investments', InvestmentController::class);
    Route::apiResource('investment-payments', InvestmentPaymentController::class)->only(['index', 'store', 'destroy']);
    Route::get('investments/{id}/coupons', [InvestmentCouponController::class, 'index']);

    // --- Exports de Inversiones (protegidos con auth) ---
    Route::get('investments/export/tabla-general-pdf', [InvestmentExportController::class, 'tablaGeneralPdf']);
    Route::get('investments/export/tabla-general-excel', [InvestmentExportController::class, 'tablaGeneralExcel']);
    Route::get('investments/export/retenciones-pdf', [InvestmentExportController::class, 'retencionesPdf']);
    Route::get('investments/export/retenciones-excel', [InvestmentExportController::class, 'retencionesExcel']);
    Route::get('investors/{id}/export/pdf', [InvestmentExportController::class, 'inversionistaPdf']);
    Route::get('investors/{id}/export/excel', [InvestmentExportController::class, 'inversionistaExcel']);
    Route::get('investments/{id}/export/pdf', [InvestmentExportController::class, 'detalleInversionPdf']);
    Route::get('investments/{id}/export/excel', [InvestmentExportController::class, 'detalleInversionExcel']);
    Route::get('investments/{id}/export/estado-cuenta', [InvestmentExportController::class, 'estadoCuentaPdf']);

    // --- Embargo ---
    Route::get('/embargo/personas', [\App\Http\Controllers\Api\EmbargoCalculatorController::class, 'buscarPersonas']);
    Route::post('/calcular-embargo', [\App\Http\Controllers\Api\EmbargoCalculatorController::class, 'calcular'])->middleware('throttle:30,1');
    Route::get('/embargo-configuracion', [\App\Http\Controllers\Api\EmbargoConfiguracionController::class, 'show']);
    Route::put('/embargo-configuracion', [\App\Http\Controllers\Api\EmbargoConfiguracionController::class, 'update'])->middleware(['admin', 'throttle:30,1']);
    Route::post('/embargo-configuracion/verificar-pdf', [\App\Http\Controllers\Api\EmbargoConfiguracionController::class, 'verificarPdf'])->middleware('throttle:10,1');

    // --- Lead Alerts ---
    Route::get('/lead-alerts/count', [LeadAlertController::class, 'count']);
    Route::get('/lead-alerts', [LeadAlertController::class, 'index']);
    Route::patch('/lead-alerts/{id}/read', [LeadAlertController::class, 'markAsRead']);

    // --- Credid (consulta externa) ---
    Route::get('credid/status', [\App\Http\Controllers\Api\CredidController::class, 'status'])->middleware(['admin', 'throttle:10,1']);
    Route::get('credid/reporte', [\App\Http\Controllers\Api\CredidController::class, 'reporte'])->middleware('throttle:10,1');

    // --- Analisis ---
    Route::patch('analisis/bulk-status', [\App\Http\Controllers\Api\AnalisisController::class, 'bulkStatus'])->middleware('throttle:30,1');
    Route::apiResource('analisis', \App\Http\Controllers\Api\AnalisisController::class);
    Route::get('analisis/{id}/files', [\App\Http\Controllers\Api\AnalisisController::class, 'getFiles']);
    Route::post('analisis/{id}/files', [\App\Http\Controllers\Api\AnalisisController::class, 'uploadFile'])->middleware('throttle:30,1');
    Route::delete('analisis/{id}/files/{filename}', [\App\Http\Controllers\Api\AnalisisController::class, 'deleteFile'])->middleware('permission:analizados,delete');

    // --- Propuestas de Análisis ---
    Route::get('analisis/{reference}/propuestas', [\App\Http\Controllers\Api\PropuestaController::class, 'index']);
    Route::post('analisis/{reference}/propuestas', [\App\Http\Controllers\Api\PropuestaController::class, 'store'])->middleware('throttle:30,1');
    Route::put('propuestas/{id}', [\App\Http\Controllers\Api\PropuestaController::class, 'update'])->middleware('throttle:30,1');
    Route::delete('propuestas/{id}', [\App\Http\Controllers\Api\PropuestaController::class, 'destroy'])->middleware('throttle:30,1');
    Route::patch('propuestas/{id}/aceptar', [\App\Http\Controllers\Api\PropuestaController::class, 'aceptar'])->middleware('throttle:30,1');
    Route::patch('propuestas/{id}/denegar', [\App\Http\Controllers\Api\PropuestaController::class, 'denegar'])->middleware('throttle:30,1');

    // --- Créditos ---
    Route::get('credits/next-reference', [\App\Http\Controllers\Api\CreditController::class, 'nextReference']);
    Route::apiResource('credits', \App\Http\Controllers\Api\CreditController::class);
    Route::get('credits/{id}/balance', [\App\Http\Controllers\Api\CreditController::class, 'balance']);
    Route::post('credits/{id}/generate-plan-de-pagos', [\App\Http\Controllers\Api\CreditController::class, 'generatePlanDePagos'])->middleware('throttle:30,1');
    Route::get('credits/{id}/documents', [\App\Http\Controllers\Api\CreditController::class, 'documents']);
    Route::post('credits/{id}/documents', [\App\Http\Controllers\Api\CreditController::class, 'storeDocument'])->middleware('throttle:30,1');
    Route::delete('credits/{id}/documents/{documentId}', [\App\Http\Controllers\Api\CreditController::class, 'destroyDocument'])->middleware('permission:creditos,delete');
    Route::get('credits/{id}/refundicion-preview', [\App\Http\Controllers\Api\CreditController::class, 'refundicionPreview']);
    Route::post('credits/{id}/refundicion', [\App\Http\Controllers\Api\CreditController::class, 'refundicion'])->middleware('throttle:10,1');

    // --- Pagos de Crédito ---
    Route::post('credit-payments/carga-intereses', [CreditPaymentController::class, 'cargarInteresesSinDeductora'])->middleware('throttle:30,1');
    Route::post('credit-payments/cancelacion-anticipada/calcular', [CreditPaymentController::class, 'calcularCancelacionAnticipada'])->middleware('throttle:30,1');
    Route::post('credit-payments/cancelacion-anticipada', [CreditPaymentController::class, 'cancelacionAnticipada'])->middleware('throttle:10,1');
    Route::post('credit-payments/preview-planilla', [CreditPaymentController::class, 'previewPlanilla'])->middleware('throttle:30,1');
    Route::get('credit-payments/export-preview-excel/{hash}', [CreditPaymentController::class, 'exportPreviewExcel']);
    Route::get('credit-payments/export-preview-pdf/{hash}', [CreditPaymentController::class, 'exportPreviewPdf']);
    Route::post('credit-payments/upload', [CreditPaymentController::class, 'upload'])->middleware('throttle:10,1');
    Route::post('credit-payments/adelanto', [CreditPaymentController::class, 'adelanto'])->middleware('throttle:30,1');
    Route::post('credit-payments/abono-extraordinario/preview', [CreditPaymentController::class, 'previewAbonoExtraordinario'])->middleware('throttle:30,1');
    Route::post('credit-payments/{id}/reverse', [CreditPaymentController::class, 'reversePayment'])->middleware('throttle:10,1');
    Route::apiResource('credit-payments', CreditPaymentController::class);

    // --- Saldos Pendientes ---
    Route::get('saldos-pendientes', [\App\Http\Controllers\Api\SaldoPendienteController::class, 'index']);
    Route::post('saldos-pendientes/{id}/preview', [\App\Http\Controllers\Api\SaldoPendienteController::class, 'previewAsignacion'])->middleware('throttle:30,1');
    Route::post('saldos-pendientes/{id}/asignar', [\App\Http\Controllers\Api\SaldoPendienteController::class, 'asignar'])->middleware('throttle:30,1');
    Route::post('saldos-pendientes/{id}/reintegrar', [\App\Http\Controllers\Api\SaldoPendienteController::class, 'reintegrar'])->middleware('throttle:30,1');

    // --- Historial de Planillas ---
    Route::get('planilla-uploads', [\App\Http\Controllers\Api\PlanillaUploadController::class, 'index']);
    Route::get('planilla-uploads/{id}', [\App\Http\Controllers\Api\PlanillaUploadController::class, 'show']);
    Route::get('planilla-uploads/{id}/download', [\App\Http\Controllers\Api\PlanillaUploadController::class, 'download']);
    Route::get('planilla-uploads/{id}/export-resumen', [\App\Http\Controllers\Api\PlanillaUploadController::class, 'exportResumen']);
    Route::post('planilla-uploads/{id}/anular', [\App\Http\Controllers\Api\PlanillaUploadController::class, 'anular'])->middleware('throttle:10,1');

    // --- Tasas ---
    Route::apiResource('tasas', \App\Http\Controllers\Api\TasaController::class);
    Route::get('tasas/nombre/{nombre}', [\App\Http\Controllers\Api\TasaController::class, 'porNombre']);
    Route::patch('tasas/{id}/toggle-activo', [\App\Http\Controllers\Api\TasaController::class, 'toggleActivo']);

    // --- Comments ---
    Route::get('/comments', [CommentController::class, 'index']);
    Route::get('/comments/recent', [CommentController::class, 'recent']);
    Route::post('/comments', [CommentController::class, 'store'])->middleware('throttle:60,1');
    Route::delete('/comments/{id}', [CommentController::class, 'destroy']);
    Route::patch('/comments/{id}/archive', [CommentController::class, 'archive']);
    Route::patch('/comments/{id}/unarchive', [CommentController::class, 'unarchive']);

    // --- Notifications ---
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/count', [NotificationController::class, 'count']);
    Route::patch('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
    Route::patch('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);

    // --- Ventas: Metas ---
    Route::apiResource('metas-venta', MetaVentaController::class);

    // --- Ventas: Visitas ---
    Route::get('visitas/proximas', [VisitaController::class, 'proximas']);
    Route::patch('visitas/{id}/status', [VisitaController::class, 'updateStatus']);
    Route::apiResource('visitas', VisitaController::class);

    // --- Ventas: Comisiones ---
    Route::get('comisiones/resumen', [ComisionController::class, 'resumen']);
    Route::patch('comisiones/{id}/aprobar', [ComisionController::class, 'aprobar'])->middleware('throttle:30,1');
    Route::patch('comisiones/{id}/pagar', [ComisionController::class, 'pagar'])->middleware('throttle:30,1');
    Route::patch('comisiones/bulk-aprobar', [ComisionController::class, 'bulkAprobar'])->middleware('throttle:10,1');
    Route::patch('comisiones/bulk-pagar', [ComisionController::class, 'bulkPagar'])->middleware('throttle:10,1');
    Route::apiResource('comisiones', ComisionController::class)->only(['index', 'store', 'destroy']);
    // Reglas de comisión
    Route::get('reglas-comision', [ComisionController::class, 'reglas']);
    Route::post('reglas-comision', [ComisionController::class, 'storeRegla'])->middleware(['admin', 'throttle:30,1']);
    Route::put('reglas-comision/{id}', [ComisionController::class, 'updateRegla'])->middleware(['admin', 'throttle:30,1']);
    Route::delete('reglas-comision/{id}', [ComisionController::class, 'destroyRegla'])->middleware(['admin', 'throttle:30,1']);

    // --- Admin (requiere full_access) ---
    Route::middleware('admin')->group(function () {
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
    }); // fin middleware admin
}); // fin middleware auth:sanctum
