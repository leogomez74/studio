<?php

namespace App\Http\Controllers\Api;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class ActivityLogController extends Controller
{
    /**
     * Listado paginado con filtros.
     * GET /api/activity-logs
     */
    public function index(Request $request)
    {
        $query = ActivityLog::with('user')->orderBy('created_at', 'desc');

        if ($request->filled('user_id')) {
            $query->byUser((int) $request->user_id);
        }
        if ($request->filled('module')) {
            $query->byModule($request->module);
        }
        if ($request->filled('action')) {
            $query->byAction($request->action);
        }
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('model_label', 'like', "%{$search}%")
                  ->orWhere('user_name', 'like', "%{$search}%");
            });
        }
        if ($request->filled('fecha_desde') || $request->filled('fecha_hasta')) {
            $query->dateRange($request->fecha_desde, $request->fecha_hasta);
        }
        if ($request->filled('ip_address')) {
            $query->where('ip_address', 'like', "%{$request->ip_address}%");
        }

        $perPage = min((int) $request->get('per_page', 20), 100);

        return response()->json($query->paginate($perPage));
    }

    /**
     * Detalle de un registro.
     * GET /api/activity-logs/{id}
     */
    public function show($id)
    {
        $log = ActivityLog::with('user')->findOrFail($id);
        return response()->json(['log' => $log]);
    }

    /**
     * Estadísticas resumidas.
     * GET /api/activity-logs/stats
     */
    public function stats(Request $request)
    {
        $base = ActivityLog::query();

        if ($request->filled('fecha_desde') || $request->filled('fecha_hasta')) {
            $base->dateRange($request->fecha_desde, $request->fecha_hasta);
        }

        $total       = (clone $base)->count();
        $hoy         = (clone $base)->whereDate('created_at', today())->count();
        $eliminaciones24h = (clone $base)
            ->where('action', 'delete')
            ->where('created_at', '>=', now()->subHours(24))
            ->count();

        $loginsFallidos24h = (clone $base)
            ->where('action', 'login_failed')
            ->where('created_at', '>=', now()->subHours(24))
            ->count();

        $usuariosActivosHoy = (clone $base)
            ->whereDate('created_at', today())
            ->whereNotNull('user_id')
            ->distinct('user_id')
            ->count('user_id');

        $porModulo = (clone $base)
            ->selectRaw('module, COUNT(*) as count')
            ->groupBy('module')
            ->orderByDesc('count')
            ->get();

        $porAccion = (clone $base)
            ->selectRaw('action, COUNT(*) as count')
            ->groupBy('action')
            ->orderByDesc('count')
            ->get();

        $topUsuarios = (clone $base)
            ->selectRaw('user_id, user_name, COUNT(*) as count')
            ->whereNotNull('user_id')
            ->groupBy('user_id', 'user_name')
            ->orderByDesc('count')
            ->limit(10)
            ->get();

        return response()->json([
            'total'               => $total,
            'hoy'                 => $hoy,
            'usuarios_activos_hoy' => $usuariosActivosHoy,
            'eliminaciones_24h'   => $eliminaciones24h,
            'logins_fallidos_24h' => $loginsFallidos24h,
            'por_modulo'          => $porModulo,
            'por_accion'          => $porAccion,
            'top_usuarios'        => $topUsuarios,
        ]);
    }

    /**
     * Alertas de actividad sospechosa.
     * GET /api/activity-logs/alerts
     */
    public function alerts()
    {
        $eliminaciones = ActivityLog::where('action', 'delete')
            ->where('created_at', '>=', now()->subHours(24))
            ->count();

        $loginsFallidos = ActivityLog::where('action', 'login_failed')
            ->where('created_at', '>=', now()->subHours(24))
            ->count();

        // Umbral: >5 eliminaciones o >10 logins fallidos en 24h = alerta
        $hasAlerts = $eliminaciones > 5 || $loginsFallidos > 10;

        return response()->json([
            'has_alerts'          => $hasAlerts,
            'eliminaciones_24h'   => $eliminaciones,
            'logins_fallidos_24h' => $loginsFallidos,
        ]);
    }

    /**
     * Exportar a CSV.
     * GET /api/activity-logs/export
     */
    public function export(Request $request)
    {
        $query = ActivityLog::orderBy('created_at', 'desc');

        if ($request->filled('user_id'))   $query->byUser((int) $request->user_id);
        if ($request->filled('module'))    $query->byModule($request->module);
        if ($request->filled('action'))    $query->byAction($request->action);
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('model_label', 'like', "%{$search}%")
                  ->orWhere('user_name', 'like', "%{$search}%");
            });
        }
        if ($request->filled('fecha_desde') || $request->filled('fecha_hasta')) {
            $query->dateRange($request->fecha_desde, $request->fecha_hasta);
        }
        if ($request->filled('ip_address')) {
            $query->where('ip_address', 'like', "%{$request->ip_address}%");
        }

        $logs = $query->limit(5000)->get();

        $headers = [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="auditoria_' . now()->format('Y-m-d_His') . '.csv"',
        ];

        $callback = function () use ($logs) {
            $file = fopen('php://output', 'w');
            fprintf($file, chr(0xEF) . chr(0xBB) . chr(0xBF)); // BOM UTF-8

            fputcsv($file, [
                'ID', 'Fecha', 'Usuario', 'Acción', 'Módulo',
                'Tipo Registro', 'ID Registro', 'Referencia', 'Cambios', 'IP',
            ]);

            foreach ($logs as $log) {
                fputcsv($file, [
                    $log->id,
                    $log->created_at->format('Y-m-d H:i:s'),
                    $log->user_name ?? '-',
                    $log->action,
                    $log->module,
                    $log->model_type ?? '-',
                    $log->model_id ?? '-',
                    $log->model_label ?? '-',
                    $log->changes ? json_encode($log->changes, JSON_UNESCAPED_UNICODE) : '-',
                    $log->ip_address ?? '-',
                ]);
            }

            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }
}
