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
use App\Http\Controllers\Api\InvestorDocumentController;
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
use App\Http\Controllers\Api\VentasDashboardController;
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

// --- Health check (detalle para admins autenticados) ---
Route::get('/health/env/detail', function (Request $request) {
    $groups = [
        'app'      => ['APP_NAME', 'APP_ENV', 'APP_KEY', 'APP_URL'],
        'database' => ['DB_CONNECTION', 'DB_HOST', 'DB_PORT', 'DB_DATABASE', 'DB_USERNAME'],
        'auth'     => ['SANCTUM_STATEFUL_DOMAINS', 'FRONTEND_URL'],
        'erp'      => ['ERP_SERVICE_URL', 'ERP_SERVICE_TOKEN', 'ERP_SERVICE_SECRET'],
        'credid'   => ['CREDID_API_URL', 'CREDID_API_TOKEN'],
        'dsf'      => ['DSF_API_URL', 'DSF_API_TOKEN'],
        'evolution'=> ['EVOLUTION_API_URL', 'EVOLUTION_API_KEY', 'EVOLUTION_INSTANCE'],
        'tenor'    => ['TENOR_API_KEY'],
        'mail'     => ['MAIL_MAILER', 'MAIL_HOST', 'MAIL_PORT'],
        'cache'    => ['CACHE_STORE', 'QUEUE_CONNECTION', 'SESSION_DRIVER'],
        'jira'     => ['JIRA_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN', 'JIRA_PROJECT_KEY'],
    ];

    $results = [];
    $missing = [];
    foreach ($groups as $group => $vars) {
        $groupOk = true;
        $details = [];
        foreach ($vars as $var) {
            $val = env($var, '');
            $set = !empty($val);
            $details[$var] = $set ? ('✅ ' . substr($val, 0, 12) . (strlen($val) > 12 ? '...' : '')) : '❌ vacío';
            if (!$set) { $groupOk = false; $missing[] = $var; }
        }
        $results[$group] = ['ok' => $groupOk, 'vars' => $details];
    }

    // Estado del servicio ERP
    $erpService = app(\App\Services\ErpAccountingService::class);
    $results['erp']['service_configured'] = $erpService->isConfigured() ? '✅ isConfigured=true' : '❌ isConfigured=false';

    return response()->json([
        'status'         => empty($missing) ? 'ok' : 'degraded',
        'timestamp'      => now()->toIso8601String(),
        'groups'         => $results,
        'missing'        => $missing,
        'total_missing'  => count($missing),
    ]);
})->middleware(['auth:sanctum', 'admin', 'throttle:10,1']);

// --- Health check ---
Route::get('/health/env', function (Request $request) {
    $groups = [
        'app' => [
            'APP_NAME', 'APP_ENV', 'APP_KEY', 'APP_URL',
        ],
        'database' => [
            'DB_CONNECTION', 'DB_HOST', 'DB_PORT', 'DB_DATABASE', 'DB_USERNAME',
        ],
        'auth' => [
            'SANCTUM_STATEFUL_DOMAINS', 'FRONTEND_URL',
        ],
        'erp' => [
            'ERP_SERVICE_URL', 'ERP_SERVICE_TOKEN', 'ERP_SERVICE_SECRET',
        ],
        'credid' => [
            'CREDID_API_URL', 'CREDID_API_TOKEN',
        ],
        'dsf' => [
            'DSF_API_URL', 'DSF_API_TOKEN',
        ],
        'evolution' => [
            'EVOLUTION_API_URL', 'EVOLUTION_API_KEY', 'EVOLUTION_INSTANCE',
        ],
        'tenor' => [
            'TENOR_API_KEY',
        ],
        'mail' => [
            'MAIL_MAILER', 'MAIL_HOST', 'MAIL_PORT',
        ],
        'cache' => [
            'CACHE_STORE', 'QUEUE_CONNECTION', 'SESSION_DRIVER',
        ],
    ];

    $results = [];
    $missing = [];
    foreach ($groups as $group => $vars) {
        $groupOk = true;
        $details = [];
        foreach ($vars as $var) {
            $set = !empty(env($var));
            $details[$var] = $set;
            if (!$set) {
                $groupOk = false;
                $missing[] = $var;
            }
        }
        $results[$group] = ['ok' => $groupOk, 'vars' => $details];
    }

    $allOk = empty($missing);

    // Público: solo status global. Admin: detalle completo.
    $isAdmin = $request->user()?->role?->full_access ?? false;

    $response = [
        'status' => $allOk ? 'ok' : 'degraded',
        'timestamp' => now()->toIso8601String(),
    ];

    if ($isAdmin) {
        $response['groups'] = $results;
        $response['missing'] = $missing;
        $response['total_checked'] = array_sum(array_map(fn($g) => count($g), $groups));
        $response['total_missing'] = count($missing);
    }

    if ($isAdmin) {
        // Variables que el frontend necesita (para referencia del admin)
        $response['frontend_env'] = [
            'NEXT_PUBLIC_BACKEND_URL' => '(verificar en .env.local del frontend)',
            'NEXT_PUBLIC_TENOR_API_KEY' => '(verificar en .env.local del frontend)',
        ];
    }

    return response()->json($response, $allOk ? 200 : 503);
});

// --- Autenticación (públicas, con rate limiting) ---
Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:5,1');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');

// --- PDFs/Excel del Plan de Pagos (requieren auth via cookie de sesión Sanctum) ---
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/credits/{id}/plan-pdf', [\App\Http\Controllers\Api\CreditController::class, 'downloadPlanPDF']);
    Route::get('/credits/{id}/plan-excel', [\App\Http\Controllers\Api\CreditController::class, 'downloadPlanExcel']);
});

// (exports de inversiones movidos a grupo auth:sanctum — ver abajo)

// --- Registro público de leads (formulario compartido en redes) ---
Route::post('/leads', [LeadController::class, 'store']);

// --- Cuestionario público (accedido desde link enviado por WhatsApp) ---
Route::get('/questionnaire/status', [QuestionnaireController::class, 'checkStatus']);
Route::post('/questionnaire/submit', [QuestionnaireController::class, 'submit']);
Route::get('/instituciones', [InstitucionController::class, 'index']);

// --- Webhook n8n: notificaciones judiciales entrantes ---
// Protegido por token estático en header X-N8N-Token (validado en middleware/controller)
Route::post('/cobro-judicial/notificacion-entrante', [\App\Http\Controllers\Api\CobroJudicialController::class, 'notificacionEntrante']);

// =============================================================================
// WEBHOOK JIRA — Público (Jira llama sin auth)
// =============================================================================
Route::post('/webhooks/jira', [\App\Http\Controllers\Api\JiraWebhookController::class, 'handle']);
Route::post('/jira/register-webhook', fn() => response()->json((new \App\Services\JiraService())->registerWebhook()))->middleware('auth:sanctum');

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
    Route::get('/agents', function (\Illuminate\Http\Request $request) {
        $user    = $request->user()->load('role');
        $isAdmin = $user->role?->full_access === true;

        if ($isAdmin) {
            $users = \App\Models\User::select('id', 'name')->where('status', 'Activo')->get();
        } else {
            $users = \App\Models\User::select('id', 'name')->where('id', $user->id)->get();
        }

        return response()->json($users);
    });
    Route::get('/lead-statuses', function () {
        return response()->json(\App\Models\LeadStatus::select('id', 'name')->orderBy('order_column')->get());
    });

    // --- Productos e Instituciones ---
    Route::apiResource('products', ProductController::class);
    Route::apiResource('instituciones', InstitucionController::class)->except(['index']);

    // --- Leads ---
    Route::patch('/leads/{id}/toggle-active', [LeadController::class, 'toggleActive']);
    Route::post('/leads/{id}/consultar-credid', [LeadController::class, 'consultarCredid'])->middleware('throttle:10,1');
    Route::post('/leads/{id}/convert', [LeadController::class, 'convertToClient']);
    Route::post('/leads/delete-by-cedula', [LeadController::class, 'deleteByCedula'])->middleware(['permission:crm,delete', 'throttle:5,1']);
    // Bulk actions ANTES del apiResource para evitar conflictos de rutas
    Route::patch('/leads/bulk-archive', [LeadController::class, 'bulkArchive']);
    Route::post('/leads/bulk-convert', [LeadController::class, 'bulkConvert']);
    Route::get('/persons/search', [LeadController::class, 'search']);
    Route::apiResource('leads', LeadController::class)->except(['store']);

    // --- Clientes ---
    Route::patch('/clients/{id}/toggle-active', [ClientController::class, 'toggleActive']);
    Route::post('/clients/{id}/consultar-credid', [ClientController::class, 'consultarCredid'])->middleware('throttle:10,1');
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
    Route::get('/tareas/board/{workflow}', [TaskController::class, 'boardData']);
    Route::get('/tareas', [TaskController::class, 'index']);
    Route::post('/tareas', [TaskController::class, 'store'])->middleware('permission:tareas,create');
    Route::get('/tareas/{task}', [TaskController::class, 'show']);
    Route::put('/tareas/{task}', [TaskController::class, 'update'])->middleware('permission:tareas,edit');
    Route::delete('/tareas/{task}', [TaskController::class, 'destroy'])->middleware('permission:tareas,delete');
    Route::post('/tareas/{task}/archivar', [TaskController::class, 'archive'])->middleware('permission:tareas,archive');
    Route::post('/tareas/{task}/restaurar', [TaskController::class, 'restore'])->middleware('permission:tareas,edit');
    Route::post('/tareas/{task}/transition', [TaskController::class, 'transition'])->middleware('permission:tareas,edit');
    Route::post('/tareas/{task}/watchers', [TaskController::class, 'addWatcher'])->middleware('permission:tareas,edit');
    Route::delete('/tareas/{task}/watchers/{user}', [TaskController::class, 'removeWatcher'])->middleware('permission:tareas,edit');
    Route::post('/tareas/{task}/labels', [TaskController::class, 'addLabel'])->middleware('permission:tareas,edit');
    Route::delete('/tareas/{task}/labels/{label}', [TaskController::class, 'removeLabel'])->middleware('permission:tareas,edit');
    Route::get('/tareas/{task}/timeline', [TaskController::class, 'timeline']);
    Route::get('/tareas/{task}/documents', [TaskController::class, 'documents']);
    Route::post('/tareas/{task}/documents', [TaskController::class, 'storeDocument'])->middleware('permission:tareas,edit');
    Route::delete('/tareas/{task}/documents/{document}', [TaskController::class, 'destroyDocument'])->middleware('permission:tareas,delete');
    Route::get('/tareas/{task}/checklist', [TaskController::class, 'checklistItems']);
    Route::post('/tareas/{task}/checklist', [TaskController::class, 'storeChecklistItem'])->middleware('permission:tareas,edit');
    Route::patch('/tareas/{task}/checklist/{item}/toggle', [TaskController::class, 'toggleChecklistItem'])->middleware('permission:tareas,edit');
    Route::delete('/tareas/{task}/checklist/{item}', [TaskController::class, 'destroyChecklistItem'])->middleware('permission:tareas,delete');

    // --- Workflows (admin) ---
    Route::prefix('task-workflows')->middleware('admin')->group(function () {
        Route::get('/', [\App\Http\Controllers\Api\TaskWorkflowController::class, 'index']);
        Route::post('/', [\App\Http\Controllers\Api\TaskWorkflowController::class, 'store']);
        Route::get('/{workflow}', [\App\Http\Controllers\Api\TaskWorkflowController::class, 'show']);
        Route::put('/{workflow}', [\App\Http\Controllers\Api\TaskWorkflowController::class, 'update']);
        Route::delete('/{workflow}', [\App\Http\Controllers\Api\TaskWorkflowController::class, 'destroy']);
        Route::get('/{workflow}/statuses', [\App\Http\Controllers\Api\TaskWorkflowController::class, 'statuses']);
        Route::post('/{workflow}/statuses', [\App\Http\Controllers\Api\TaskWorkflowController::class, 'storeStatus']);
        Route::put('/{workflow}/statuses/{status}', [\App\Http\Controllers\Api\TaskWorkflowController::class, 'updateStatus']);
        Route::delete('/{workflow}/statuses/{status}', [\App\Http\Controllers\Api\TaskWorkflowController::class, 'deleteStatus']);
        Route::post('/{workflow}/statuses/reorder', [\App\Http\Controllers\Api\TaskWorkflowController::class, 'reorderStatuses']);
        Route::get('/{workflow}/transitions', [\App\Http\Controllers\Api\TaskWorkflowController::class, 'transitions']);
        Route::post('/{workflow}/transitions', [\App\Http\Controllers\Api\TaskWorkflowController::class, 'storeTransition']);
        Route::delete('/{workflow}/transitions/{transition}', [\App\Http\Controllers\Api\TaskWorkflowController::class, 'deleteTransition']);
    });

    // Also expose workflows list for non-admin users (needed for task creation)
    Route::get('/task-workflows', [\App\Http\Controllers\Api\TaskWorkflowController::class, 'index']);

    // --- Labels ---
    Route::get('/task-labels', [\App\Http\Controllers\Api\TaskLabelController::class, 'index']);
    Route::post('/task-labels', [\App\Http\Controllers\Api\TaskLabelController::class, 'store'])->middleware('admin');
    Route::put('/task-labels/{label}', [\App\Http\Controllers\Api\TaskLabelController::class, 'update'])->middleware('admin');
    Route::delete('/task-labels/{label}', [\App\Http\Controllers\Api\TaskLabelController::class, 'destroy'])->middleware('admin');

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

    // --- Automatización de Tareas (sistema) ---
    Route::get('/task-automations', [\App\Http\Controllers\Api\TaskAutomationController::class, 'index'])->middleware('admin');
    Route::post('/task-automations', [\App\Http\Controllers\Api\TaskAutomationController::class, 'upsert'])->middleware('admin');
    Route::delete('/task-automations/{taskAutomation}', [\App\Http\Controllers\Api\TaskAutomationController::class, 'destroy'])->middleware('admin');

    // --- Plantillas de Automatización personalizadas ---
    Route::middleware('admin')->prefix('automation-templates')->group(function () {
        Route::get('/',                                    [\App\Http\Controllers\Api\AutomationTemplateController::class, 'index']);
        Route::post('/',                                   [\App\Http\Controllers\Api\AutomationTemplateController::class, 'store']);
        Route::get('/variables',                           [\App\Http\Controllers\Api\AutomationTemplateController::class, 'variables']);
        Route::get('/event-hooks',                         [\App\Http\Controllers\Api\AutomationTemplateController::class, 'eventHooks']);
        Route::get('/{automationTemplate}',                [\App\Http\Controllers\Api\AutomationTemplateController::class, 'show']);
        Route::put('/{automationTemplate}',                [\App\Http\Controllers\Api\AutomationTemplateController::class, 'update']);
        Route::delete('/{automationTemplate}',             [\App\Http\Controllers\Api\AutomationTemplateController::class, 'destroy']);
        Route::post('/{automationTemplate}/evaluate',      [\App\Http\Controllers\Api\AutomationTemplateController::class, 'evaluateCondition']);
        Route::post('/{automationTemplate}/execute',       [\App\Http\Controllers\Api\AutomationTemplateController::class, 'execute']);
    });

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
        Route::get('/export', [\App\Http\Controllers\Api\AccountingEntryLogController::class, 'export'])->middleware('throttle:10,1');
        Route::get('/{id}', [\App\Http\Controllers\Api\AccountingEntryLogController::class, 'show']);
        Route::post('/{id}/retry', [\App\Http\Controllers\Api\AccountingEntryLogController::class, 'retry'])->middleware(['admin', 'throttle:10,1']);
    });

    // --- Bitácora de Auditoría General del Sistema ---
    Route::prefix('activity-logs')->middleware('admin')->group(function () {
        Route::get('/', [\App\Http\Controllers\Api\ActivityLogController::class, 'index']);
        Route::get('/stats', [\App\Http\Controllers\Api\ActivityLogController::class, 'stats']);
        Route::get('/alerts', [\App\Http\Controllers\Api\ActivityLogController::class, 'alerts']);
        Route::get('/export', [\App\Http\Controllers\Api\ActivityLogController::class, 'export'])->middleware('throttle:10,1');
        Route::get('/{id}', [\App\Http\Controllers\Api\ActivityLogController::class, 'show']);
    });

    // --- Incidencias (Bugs) ---
    Route::get('/bugs/stats', [\App\Http\Controllers\Api\BugController::class, 'stats']);
    Route::apiResource('bugs', \App\Http\Controllers\Api\BugController::class);
    Route::patch('/bugs/{bug}/status', [\App\Http\Controllers\Api\BugController::class, 'updateStatus'])->middleware('throttle:60,1');
    Route::post('/bugs/{bug}/images', [\App\Http\Controllers\Api\BugController::class, 'uploadImages'])->middleware('throttle:30,1');
    Route::delete('/bugs/{bug}/images/{image}', [\App\Http\Controllers\Api\BugController::class, 'deleteImage'])->middleware('throttle:30,1');
    Route::patch('/bugs/{bug}/archive', [\App\Http\Controllers\Api\BugController::class, 'archive']);
    Route::get('/bugs/archived', [\App\Http\Controllers\Api\BugController::class, 'archived']);
    Route::patch('/bugs/{bug}/assignees', [\App\Http\Controllers\Api\BugController::class, 'syncAssignees']);
    Route::get('/jira/users', fn() => response()->json((new \App\Services\JiraService())->getUsers()));
    Route::get('/jira/status', fn() => response()->json(['connected' => (new \App\Services\JiraService())->isConfigured()]));
    Route::post('/jira/sync', function() {
        $jira    = new \App\Services\JiraService();
        $issues  = $jira->fetchProjectIssues();
        $created = 0; $updated = 0;

        foreach ($issues as $issue) {
            $jiraKey = $issue['key'];
            $fields  = $issue['fields'] ?? [];

            // Título limpio (sin prefijo [BUG-XXXX] si fue creado desde Studio)
            $title = preg_replace('/^\[BUG-\d+\]\s*/', '', $fields['summary'] ?? 'Sin título');

            // Prioridad
            $priority = match(strtolower($fields['priority']['name'] ?? 'medium')) {
                'highest','critical' => 'critica', 'high' => 'alta', 'low','lowest' => 'baja', default => 'media'
            };

            // Estado — mapeo exacto de columnas Jira → Studio
            $jiraStatus = strtolower($fields['status']['name'] ?? '');
            $status = str_contains($jiraStatus,'progress') || str_contains($jiraStatus,'curso')   ? 'en_progreso'
                   : (str_contains($jiraStatus,'review')   || str_contains($jiraStatus,'revision') ? 'en_revision'
                   : (str_contains($jiraStatus,'done')     || str_contains($jiraStatus,'finaliz')  ? 'cerrado'
                   : 'abierto'));

            // Asignado — busca por primer nombre
            $assigneeName = $fields['assignee']['displayName'] ?? null;
            $userId = $assigneeName
                ? \App\Models\User::whereRaw('LOWER(name) LIKE ?', ['%'.strtolower(explode(' ',$assigneeName)[0]).'%'])->value('id')
                : null;
            $adminId = $userId ?? \App\Models\User::first()?->id ?? 1;

            // Descripción (formato ADF de Jira)
            $desc = $fields['description']['content'][0]['content'][0]['text'] ?? null;

            // Crear o actualizar
            $bug = \App\Models\Bug::where('jira_key', $jiraKey)->first();
            if ($bug) {
                if (!$bug->archived_at) {
                    $bug->update([
                        'title'       => $title,
                        'description' => $desc,
                        'priority'    => $priority,
                        'status'      => $status,
                        'assigned_to' => $userId,
                    ]);
                }
                $updated++;
            } else {
                $bug = \App\Models\Bug::create([
                    'jira_key'    => $jiraKey,
                    'title'       => $title,
                    'description' => $desc,
                    'priority'    => $priority,
                    'status'      => $status,
                    'assigned_to' => $userId,
                    'created_by'  => $adminId,
                ]);
                $created++;
            }

            // Sincronizar archivos adjuntos de Jira → Studio
            $attachments = $fields['attachment'] ?? [];
            foreach ($attachments as $att) {
                $filename    = $att['filename'] ?? 'archivo';
                $contentUrl  = $att['content'] ?? null;
                if (!$contentUrl) continue;

                // Solo descargar si no existe ya con ese nombre
                $exists = $bug->images()->where('original_name', $filename)->exists();
                if ($exists) continue;

                $content = $jira->downloadAttachment($contentUrl);
                if (!$content) continue;

                $ext  = pathinfo($filename, PATHINFO_EXTENSION) ?: 'jpg';
                $path = 'bugs/' . $bug->id . '/' . uniqid() . '.' . $ext;
                \Illuminate\Support\Facades\Storage::disk('public')->put($path, $content);

                $bug->images()->create([
                    'path'          => $path,
                    'original_name' => $filename,
                    'size'          => strlen($content),
                ]);
            }
        }

        // Eliminar de Studio los bugs cuya tarea ya no existe en Jira
        $jiraKeys = collect($issues)->pluck('key')->toArray();
        $deleted  = 0;
        \App\Models\Bug::whereNotNull('jira_key')
            ->whereNotIn('jira_key', $jiraKeys)
            ->get()
            ->each(function ($bug) use (&$deleted) {
                foreach ($bug->images as $img) {
                    \Illuminate\Support\Facades\Storage::disk('public')->delete($img->path);
                }
                $bug->delete();
                $deleted++;
            });

        return response()->json(['created' => $created, 'updated' => $updated, 'deleted' => $deleted, 'total' => count($issues)]);
    });
    Route::get('/bugs/{bug}/subtasks', fn(\App\Models\Bug $bug) => response()->json(
        $bug->jira_key ? (new \App\Services\JiraService())->getSubtasks($bug->jira_key) : []
    ));
    Route::post('/bugs/{bug}/subtasks', function(\Illuminate\Http\Request $req, \App\Models\Bug $bug) {
        $req->validate(['title' => 'required|string|max:255', 'assignee_id' => 'nullable|string']);
        if (!$bug->jira_key) return response()->json(['error' => 'Bug no tiene jira_key'], 422);
        $key = (new \App\Services\JiraService())->createSubtask($bug->jira_key, $req->title, $req->assignee_id);
        return response()->json(['key' => $key], $key ? 201 : 500);
    });

    // --- Documentos de Personas (Leads/Clientes) ---
    Route::get('/person-documents', [PersonDocumentController::class, 'index']);
    Route::post('/person-documents', [PersonDocumentController::class, 'store'])->middleware('throttle:30,1');
    Route::post('/person-documents/{id}/mark-dual', [PersonDocumentController::class, 'markDual'])->middleware('throttle:30,1');
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

    // --- Cobro Judicial ---
    Route::prefix('cobro-judicial')->group(function () {
        // Expedientes
        Route::get('expedientes',                        [\App\Http\Controllers\Api\CobroJudicialController::class, 'index']);
        Route::get('expedientes/{expediente}',           [\App\Http\Controllers\Api\CobroJudicialController::class, 'show']);
        Route::get('expedientes/{expediente}/notificaciones', [\App\Http\Controllers\Api\CobroJudicialController::class, 'notificaciones']);
        Route::patch('expedientes/{expediente}/sub-estado',       [\App\Http\Controllers\Api\CobroJudicialController::class, 'cambiarSubEstado']);
        Route::patch('expedientes/{expediente}/patrono',          [\App\Http\Controllers\Api\CobroJudicialController::class, 'cambiarPatrono']);
        Route::patch('expedientes/{expediente}/numero-expediente', [\App\Http\Controllers\Api\CobroJudicialController::class, 'actualizarNumeroExpediente']);

        // Posibles casos
        Route::get('posibles',                                    [\App\Http\Controllers\Api\CobroJudicialController::class, 'posibles']);
        Route::post('posibles/{credit}/descartar',                [\App\Http\Controllers\Api\CobroJudicialController::class, 'descartarPosible']);

        // Casos donde Credipep fue citada (sin flujo de aprobación)
        Route::post('registrar-citado',                           [\App\Http\Controllers\Api\CobroJudicialController::class, 'registrarCitado']);

        // Flujo de aprobación
        Route::post('proponer',                          [\App\Http\Controllers\Api\CobroJudicialController::class, 'proponer']);
        Route::post('expedientes/{expediente}/decision',  [\App\Http\Controllers\Api\CobroJudicialController::class, 'decision']);
        Route::post('expedientes/{expediente}/actuacion', [\App\Http\Controllers\Api\CobroJudicialController::class, 'registrarActuacionManual']);

        // Notificaciones indefinidas
        Route::get('notificaciones/indefinidas',         [\App\Http\Controllers\Api\CobroJudicialController::class, 'indefinidas']);
        Route::patch('notificaciones/{notificacion}/clasificar', [\App\Http\Controllers\Api\CobroJudicialController::class, 'clasificar']);
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
        Route::get('/ventas', [\App\Http\Controllers\Api\KpiController::class, 'ventas']);
        Route::get('/ventas/tendencias', [\App\Http\Controllers\Api\KpiController::class, 'ventasTendencias']);
        Route::get('/ventas/equipo', [\App\Http\Controllers\Api\KpiController::class, 'ventasEquipo'])->middleware('admin');
    });

    Route::get('/dashboard/summary', [\App\Http\Controllers\Api\KpiController::class, 'dashboardSummary']);

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
    Route::post('investors/{id}/create-erp-accounts', [InvestorController::class, 'createErpAccounts'])->middleware('throttle:10,1');
    Route::get('investor-documents', [InvestorDocumentController::class, 'index']);
    Route::post('investor-documents', [InvestorDocumentController::class, 'store']);
    Route::delete('investor-documents/{id}', [InvestorDocumentController::class, 'destroy']);
    Route::apiResource('investments', InvestmentController::class);
    Route::apiResource('investment-payments', InvestmentPaymentController::class)->only(['index', 'store', 'destroy']);
    Route::get('investments/{id}/coupons', [InvestmentCouponController::class, 'index']);

    // --- Exports de Inversiones (protegidos con auth) ---
    Route::middleware('throttle:10,1')->group(function () {
        Route::get('investments/export/tabla-general-pdf', [InvestmentExportController::class, 'tablaGeneralPdf']);
        Route::get('investments/export/tabla-general-excel', [InvestmentExportController::class, 'tablaGeneralExcel']);
        Route::get('investments/export/retenciones-pdf', [InvestmentExportController::class, 'retencionesPdf']);
        Route::get('investments/export/retenciones-excel', [InvestmentExportController::class, 'retencionesExcel']);
        Route::get('investors/{id}/export/pdf', [InvestmentExportController::class, 'inversionistaPdf']);
        Route::get('investors/{id}/export/excel', [InvestmentExportController::class, 'inversionistaExcel']);
        Route::get('investments/{id}/export/pdf', [InvestmentExportController::class, 'detalleInversionPdf']);
        Route::get('investments/{id}/export/excel', [InvestmentExportController::class, 'detalleInversionExcel']);
        Route::get('investments/{id}/export/estado-cuenta', [InvestmentExportController::class, 'estadoCuentaPdf']);
        Route::get('investments/{id}/export/contrato/{lang}', [InvestmentExportController::class, 'contratoInversionPdf']);
    });

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
    Route::post('/credits/{id}/sync-status', [App\Http\Controllers\Api\CreditController::class, 'syncStatus']);
    // TEMPORAL: forzar mora en cuota para testing
    Route::post('/credits/{id}/force-mora', [App\Http\Controllers\Api\CreditController::class, 'forceMora'])->middleware('admin');
    Route::get('credits/{id}/balance', [\App\Http\Controllers\Api\CreditController::class, 'balance']);
    Route::post('credits/{id}/generate-plan-de-pagos', [\App\Http\Controllers\Api\CreditController::class, 'generatePlanDePagos'])->middleware('throttle:30,1');
    Route::get('credits/{id}/documents', [\App\Http\Controllers\Api\CreditController::class, 'documents']);
    Route::post('credits/{id}/documents', [\App\Http\Controllers\Api\CreditController::class, 'storeDocument'])->middleware('throttle:30,1');
    Route::delete('credits/{id}/documents/{documentId}', [\App\Http\Controllers\Api\CreditController::class, 'destroyDocument'])->middleware('permission:creditos,delete');
    Route::get('credits/{id}/refundicion-preview', [\App\Http\Controllers\Api\CreditController::class, 'refundicionPreview']);
    Route::post('credits/{id}/refundicion', [\App\Http\Controllers\Api\CreditController::class, 'refundicion'])->middleware('throttle:10,1');

    // --- Verificación de Abonos ---
    Route::get('payment-verifications', [\App\Http\Controllers\Api\PaymentVerificationController::class, 'index']);
    Route::post('payment-verifications', [\App\Http\Controllers\Api\PaymentVerificationController::class, 'store'])->middleware('throttle:30,1');
    Route::patch('payment-verifications/{id}/respond', [\App\Http\Controllers\Api\PaymentVerificationController::class, 'respond'])->middleware('throttle:30,1');
    Route::post('payment-verifications/{id}/apply', [\App\Http\Controllers\Api\PaymentVerificationController::class, 'apply'])->middleware('throttle:10,1');
    Route::post('payment-verifications/{id}/cancel', [\App\Http\Controllers\Api\PaymentVerificationController::class, 'cancel'])->middleware('throttle:30,1');

    // --- Pagos de Crédito ---
    Route::post('credit-payments/carga-intereses', [CreditPaymentController::class, 'cargarInteresesSinDeductora'])->middleware('throttle:30,1');
    Route::post('credit-payments/cancelacion-anticipada/calcular', [CreditPaymentController::class, 'calcularCancelacionAnticipada'])->middleware('throttle:30,1');
    Route::post('credit-payments/cancelacion-anticipada', [CreditPaymentController::class, 'cancelacionAnticipada'])->middleware('throttle:10,1');
    Route::post('credit-payments/preview-planilla', [CreditPaymentController::class, 'previewPlanilla'])->middleware('throttle:30,1');
    Route::get('credit-payments/export-preview-excel/{hash}', [CreditPaymentController::class, 'exportPreviewExcel'])->middleware('throttle:20,1');
    Route::get('credit-payments/export-preview-pdf/{hash}', [CreditPaymentController::class, 'exportPreviewPdf'])->middleware('throttle:20,1');
    Route::post('credit-payments/upload', [CreditPaymentController::class, 'upload'])->middleware('throttle:10,1');
    Route::post('credit-payments/adelanto', [CreditPaymentController::class, 'adelanto'])->middleware('throttle:30,1');
    Route::post('credit-payments/abono-extraordinario/preview', [CreditPaymentController::class, 'previewAbonoExtraordinario'])->middleware('throttle:30,1');
    Route::post('credit-payments/{id}/reverse', [CreditPaymentController::class, 'reversePayment'])->middleware('throttle:10,1');
    Route::post('credit-payments/{id}/request-reverse', [CreditPaymentController::class, 'requestReverse'])->middleware('throttle:10,1');
    Route::apiResource('credit-payments', CreditPaymentController::class);

    // --- Saldos Pendientes ---
    Route::get('saldos-pendientes', [\App\Http\Controllers\Api\SaldoPendienteController::class, 'index']);
    Route::post('saldos-pendientes/{id}/preview', [\App\Http\Controllers\Api\SaldoPendienteController::class, 'previewAsignacion'])->middleware('throttle:30,1');
    Route::post('saldos-pendientes/{id}/asignar', [\App\Http\Controllers\Api\SaldoPendienteController::class, 'asignar'])->middleware('throttle:30,1');
    Route::post('saldos-pendientes/{id}/reintegrar', [\App\Http\Controllers\Api\SaldoPendienteController::class, 'reintegrar'])->middleware('throttle:30,1');
    Route::post('saldos-pendientes/{id}/request-reintegrar', [\App\Http\Controllers\Api\SaldoPendienteController::class, 'requestReintegrar'])->middleware('throttle:10,1');

    // --- Historial de Planillas ---
    Route::get('planilla-uploads', [\App\Http\Controllers\Api\PlanillaUploadController::class, 'index']);
    Route::get('planilla-uploads/{id}', [\App\Http\Controllers\Api\PlanillaUploadController::class, 'show']);
    Route::get('planilla-uploads/{id}/download', [\App\Http\Controllers\Api\PlanillaUploadController::class, 'download']);
    Route::get('planilla-uploads/{id}/export-resumen', [\App\Http\Controllers\Api\PlanillaUploadController::class, 'exportResumen'])->middleware('throttle:20,1');
    Route::get('planilla-uploads/{id}/export-resumen-pdf', [\App\Http\Controllers\Api\PlanillaUploadController::class, 'exportResumenPdf'])->middleware('throttle:20,1');
    Route::post('planilla-uploads/{id}/anular', [\App\Http\Controllers\Api\PlanillaUploadController::class, 'anular'])->middleware('throttle:10,1');
    Route::get('planilla-uploads/{id}/preview-ajuste-decimales', [\App\Http\Controllers\Api\PlanillaUploadController::class, 'previewAjusteDecimales']);
    Route::post('planilla-uploads/{id}/ajustar-decimales', [\App\Http\Controllers\Api\PlanillaUploadController::class, 'ajustarDecimales'])->middleware('throttle:10,1');

    // --- Tasas ---
    Route::apiResource('tasas', \App\Http\Controllers\Api\TasaController::class);
    Route::get('tasas/nombre/{nombre}', [\App\Http\Controllers\Api\TasaController::class, 'porNombre']);
    Route::patch('tasas/{id}/toggle-activo', [\App\Http\Controllers\Api\TasaController::class, 'toggleActivo']);

    // --- Proxies (keys protegidas en backend) ---
    Route::post('/proxy/whatsapp-check', [\App\Http\Controllers\Api\ProxyController::class, 'whatsappCheck'])->middleware('throttle:30,1');
    Route::get('/proxy/tenor/search', [\App\Http\Controllers\Api\ProxyController::class, 'tenorSearch'])->middleware('throttle:60,1');

    // --- Comments ---
    Route::get('/comments', [CommentController::class, 'index']);
    Route::get('/comments/recent', [CommentController::class, 'recent']);
    Route::post('/comments', [CommentController::class, 'store'])->middleware('throttle:60,1');
    Route::delete('/comments/{id}', [CommentController::class, 'destroy']);
    Route::patch('/comments/{id}/archive', [CommentController::class, 'archive']);
    Route::patch('/comments/{id}/unarchive', [CommentController::class, 'unarchive']);
    Route::patch('/comments/{id}/star', [CommentController::class, 'star']);
    Route::patch('/comments/{id}/unstar', [CommentController::class, 'unstar']);
    Route::patch('/comments/{id}/pending', [CommentController::class, 'markPending']);
    Route::patch('/comments/{id}/unpending', [CommentController::class, 'unmarkPending']);

    // --- Notifications ---
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/count', [NotificationController::class, 'count']);
    Route::patch('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
    Route::patch('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);

    // --- Ventas: Dashboard y Leaderboard ---
    Route::get('ventas/dashboard', [VentasDashboardController::class, 'dashboard']);
    Route::get('ventas/dashboard/{userId}', [VentasDashboardController::class, 'dashboardVendor'])->middleware('admin');
    Route::get('ventas/leaderboard', [VentasDashboardController::class, 'leaderboard']);
    Route::get('ventas/vendedores', function () {
        return \App\Models\User::select('id', 'name', 'role_id')
            ->with('role:id,name')
            ->whereHas('role', fn ($q) => $q->whereIn('name', ['Vendedor', 'Vendedor Interno', 'Vendedor Externo']))
            ->where('status', 'Activo')
            ->orderBy('name')
            ->get()
            ->map(fn ($u) => ['id' => $u->id, 'name' => $u->name, 'role_name' => $u->role?->name ?? 'Vendedor']);
    });

    // --- Ventas: Metas ---
    Route::apiResource('metas-venta', MetaVentaController::class);
    Route::post('metas-venta/{metaId}/tiers', [MetaVentaController::class, 'storeTier']);
    Route::put('metas-venta/{metaId}/tiers/{tierId}', [MetaVentaController::class, 'updateTier']);
    Route::delete('metas-venta/{metaId}/tiers/{tierId}', [MetaVentaController::class, 'destroyTier']);

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

            // Catalog CRUD
            Route::get('/catalog', [GamificationConfigController::class, 'catalogIndex']);
            Route::post('/catalog', [GamificationConfigController::class, 'catalogStore']);
            Route::put('/catalog/{id}', [GamificationConfigController::class, 'catalogUpdate']);
            Route::delete('/catalog/{id}', [GamificationConfigController::class, 'catalogDestroy']);

            // Badges CRUD
            Route::get('/badges', [GamificationConfigController::class, 'badgeIndex']);
            Route::post('/badges', [GamificationConfigController::class, 'badgeStore']);
            Route::put('/badges/{id}', [GamificationConfigController::class, 'badgeUpdate']);
            Route::delete('/badges/{id}', [GamificationConfigController::class, 'badgeDestroy']);

            // Challenges CRUD
            Route::get('/challenges', [GamificationConfigController::class, 'challengeIndex']);
            Route::post('/challenges', [GamificationConfigController::class, 'challengeStore']);
            Route::put('/challenges/{id}', [GamificationConfigController::class, 'challengeUpdate']);
            Route::delete('/challenges/{id}', [GamificationConfigController::class, 'challengeDestroy']);
        });
    }); // fin middleware admin

    // ── WhatsApp (mensajería vía Evolution API) ───────────────────────────────
    Route::prefix('whatsapp')->group(function () {
        Route::get('/conversations',  [\App\Http\Controllers\Api\WhatsappController::class, 'conversations']);
        Route::get('/messages',       [\App\Http\Controllers\Api\WhatsappController::class, 'messages']);
        Route::post('/send',          [\App\Http\Controllers\Api\WhatsappController::class, 'send']);
        Route::post('/sync-chats',    [\App\Http\Controllers\Api\WhatsappController::class, 'syncChats']);
    });

    // ── Evolution API (WhatsApp) ──────────────────────────────────────────────
    Route::middleware('admin')->group(function () {
        Route::get('/evolution-server-config',    [\App\Http\Controllers\Api\EvolutionServerConfigController::class, 'show']);
        Route::put('/evolution-server-config',    [\App\Http\Controllers\Api\EvolutionServerConfigController::class, 'update']);

        Route::get('/evolution-instances',                                        [\App\Http\Controllers\Api\EvolutionInstanceController::class, 'index']);
        Route::post('/evolution-instances',                                       [\App\Http\Controllers\Api\EvolutionInstanceController::class, 'store']);
        Route::delete('/evolution-instances/{evolutionInstance}',                 [\App\Http\Controllers\Api\EvolutionInstanceController::class, 'destroy']);
        Route::patch('/evolution-instances/{evolutionInstance}/alias',            [\App\Http\Controllers\Api\EvolutionInstanceController::class, 'updateAlias']);
        Route::post('/evolution-instances/{evolutionInstance}/reconnect',         [\App\Http\Controllers\Api\EvolutionInstanceController::class, 'reconnect']);
    });
}); // fin middleware auth:sanctum
