<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\RutaDiaria;
use App\Models\Task;
use App\Models\TaskAutomation;
use App\Models\TareaRuta;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class RutaDiariaController extends Controller
{
    use LogsActivity;

    public function index(Request $request)
    {
        $user = Auth::user();
        $query = RutaDiaria::with(['mensajero:id,name', 'confirmadaPor:id,name'])
            ->withCount(['tareas', 'tareas as completadas_count' => fn($q) => $q->where('status', 'completada')]);

        // Non-admin users only see their own routes
        if (!$user->role?->full_access) {
            $query->where('mensajero_id', $user->id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('fecha_desde')) {
            $query->whereDate('fecha', '>=', $request->fecha_desde);
        }
        if ($request->filled('fecha_hasta')) {
            $query->whereDate('fecha', '<=', $request->fecha_hasta);
        }
        if ($request->filled('mensajero_id') && $user->role?->full_access) {
            $query->where('mensajero_id', $request->mensajero_id);
        }

        $perPage = min((int) $request->input('per_page', 50), 100);

        return response()->json($query->orderBy('fecha', 'desc')->paginate($perPage));
    }

    public function show(string $id)
    {
        $user = Auth::user();
        $ruta = RutaDiaria::with([
            'mensajero:id,name',
            'confirmadaPor:id,name',
            'tareas' => fn($q) => $q->orderBy('posicion')->withCount('evidencias')->with(['solicitante:id,name']),
        ])->findOrFail($id);

        // Non-admin users can only view their own routes
        if (!$user->role?->full_access && $ruta->mensajero_id !== $user->id) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        return response()->json($ruta);
    }

    /**
     * Generar ruta para una fecha: toma tareas pendientes en orden FIFO y las asigna.
     */
    public function generar(Request $request)
    {
        $validated = $request->validate([
            'fecha' => 'required|date|after_or_equal:today',
            'mensajero_id' => 'required|exists:users,id',
            'tarea_ids' => 'nullable|array',
            'tarea_ids.*' => 'integer|exists:tareas_ruta,id',
            'external_stops' => 'nullable|array',
            'external_stops.*.branch_name' => 'required_with:external_stops|string|max:255',
            'external_stops.*.address' => 'nullable|string|max:500',
            'external_stops.*.integration_name' => 'nullable|string|max:100',
            'external_stops.*.external_ref' => 'nullable|string|max:100',
            'external_stops.*.pickups_summary' => 'nullable|string|max:1000',
        ]);

        $tareaIds = $validated['tarea_ids'] ?? [];
        $externalStops = $validated['external_stops'] ?? [];

        if (count($tareaIds) === 0 && count($externalStops) === 0) {
            return response()->json(['message' => 'Selecciona al menos una tarea o parada externa.'], 422);
        }

        // Verificar que no exista ruta para esa fecha y mensajero
        $existe = RutaDiaria::where('fecha', $validated['fecha'])
            ->where('mensajero_id', $validated['mensajero_id'])
            ->first();

        if ($existe) {
            return response()->json([
                'message' => 'Ya existe una ruta para esta fecha y mensajero.',
                'ruta' => $existe,
            ], 422);
        }

        return DB::transaction(function () use ($validated, $tareaIds, $externalStops) {
            $ruta = RutaDiaria::create([
                'fecha' => $validated['fecha'],
                'mensajero_id' => $validated['mensajero_id'],
                'status' => 'borrador',
                'total_tareas' => count($tareaIds) + count($externalStops),
                'completadas' => 0,
            ]);

            // Asignar tareas PEP existentes en el orden recibido
            $posicion = 1;
            foreach ($tareaIds as $tareaId) {
                TareaRuta::where('id', $tareaId)
                    ->whereIn('status', ['pendiente', 'fallida'])
                    ->update([
                        'status' => 'asignada',
                        'asignado_a' => $validated['mensajero_id'],
                        'ruta_diaria_id' => $ruta->id,
                        'fecha_asignada' => $validated['fecha'],
                        'posicion' => $posicion++,
                    ]);
            }

            // Crear tareas desde paradas externas
            foreach ($externalStops as $stop) {
                $descripcion = $stop['pickups_summary'] ?? null;
                $source = $stop['integration_name'] ?? 'Externa';

                TareaRuta::create([
                    'titulo' => "[$source] {$stop['branch_name']}",
                    'descripcion' => $descripcion,
                    'tipo' => 'recoleccion',
                    'prioridad' => 'normal',
                    'status' => 'asignada',
                    'solicitado_por' => Auth::id(),
                    'asignado_a' => $validated['mensajero_id'],
                    'ruta_diaria_id' => $ruta->id,
                    'fecha_asignada' => $validated['fecha'],
                    'posicion' => $posicion++,
                    'empresa_destino' => $stop['branch_name'],
                    'direccion_destino' => $stop['address'] ?? null,
                    'referencia_tipo' => 'ExternalStop',
                    'referencia_id' => null,
                ]);
            }

            $ruta->recalcularConteo();

            $extCount = count($externalStops);
            $pepCount = count($tareaIds);
            $detail = "Ruta generada: {$validated['fecha']} ({$pepCount} PEP" . ($extCount ? ", {$extCount} externas" : '') . ')';
            $this->logActivity('create', 'Rutas', $ruta, $detail);

            return response()->json(
                $ruta->load(['mensajero:id,name', 'tareas' => fn($q) => $q->orderBy('posicion')]),
                201
            );
        });
    }

    /**
     * Dispara una auto-tarea si existe la automatización activa.
     */
    private function dispararAutoTarea(string $eventType, string $projectCode, string $details = ''): void
    {
        $automation = TaskAutomation::where('event_type', $eventType)
            ->where('is_active', true)
            ->first();

        if ($automation) {
            Task::createFromAutomation($automation, $projectCode, $details);
        }
    }

    public function confirmar(Request $request, string $id)
    {
        return DB::transaction(function () use ($id) {
            $ruta = RutaDiaria::lockForUpdate()->findOrFail($id);

            if ($ruta->status !== 'borrador') {
                return response()->json(['message' => 'Solo se pueden confirmar rutas en borrador.'], 422);
            }

            $ruta->update([
                'status' => 'confirmada',
                'confirmada_por' => Auth::id(),
                'confirmada_at' => now(),
            ]);

            $this->logActivity('update', 'Rutas', $ruta, "Ruta confirmada: {$ruta->fecha->format('Y-m-d')}");

            // Auto-tarea: ruta_confirmada
            $this->dispararAutoTarea('ruta_confirmada', 'RUTA-' . $ruta->id,
                "Ruta del {$ruta->fecha->format('d/m/Y')} confirmada con {$ruta->total_tareas} tarea(s).");

            // Notificar al mensajero
            Notification::create([
                'user_id' => $ruta->mensajero_id,
                'type' => 'ruta_confirmada',
                'title' => 'Ruta confirmada',
                'body' => "Tu ruta del {$ruta->fecha->format('d/m/Y')} ha sido confirmada con {$ruta->total_tareas} tarea(s).",
                'data' => [
                    'ruta_id' => $ruta->id,
                    'fecha' => $ruta->fecha->format('Y-m-d'),
                    'total_tareas' => $ruta->total_tareas,
                    'confirmada_por' => Auth::user()->name ?? 'Admin',
                ],
            ]);

            return response()->json($ruta);
        });
    }

    public function iniciar(string $id)
    {
        return DB::transaction(function () use ($id) {
            $user = Auth::user();
            $ruta = RutaDiaria::lockForUpdate()->findOrFail($id);

            // Only admin or the assigned mensajero can start a route
            if (!$user->role?->full_access && $ruta->mensajero_id !== $user->id) {
                return response()->json(['message' => 'No autorizado.'], 403);
            }

            if ($ruta->status !== 'confirmada') {
                return response()->json(['message' => 'Solo se pueden iniciar rutas confirmadas.'], 422);
            }

            $ruta->update(['status' => 'en_progreso']);

            // Marcar tareas como en_transito
            $ruta->tareas()->where('status', 'asignada')->update(['status' => 'en_transito']);

            $this->logActivity('update', 'Rutas', $ruta, "Ruta iniciada: {$ruta->fecha->format('Y-m-d')}");

            // Auto-tarea: ruta_iniciada
            $this->dispararAutoTarea('ruta_iniciada', 'RUTA-' . $ruta->id,
                "Ruta del {$ruta->fecha->format('d/m/Y')} iniciada por el mensajero.");

            return response()->json($ruta);
        });
    }

    /**
     * Mi ruta actual (para el mensajero autenticado).
     * Admin puede ver la ruta de cualquier mensajero con ?mensajero_id=X.
     * Prioridad: en_progreso hoy > confirmada hoy > próxima confirmada futura.
     */
    public function miRuta(Request $request)
    {
        $user = Auth::user();
        $userId = $user->id;

        // Admin puede consultar la ruta de otro mensajero
        if ($request->filled('mensajero_id') && $user->role?->full_access) {
            $userId = (int) $request->query('mensajero_id');
        }

        $eagerLoad = ['tareas' => fn($q) => $q->orderBy('posicion')->withCount('evidencias')->with('solicitante:id,name')];

        // 1. Ruta en progreso (sin importar fecha — una ruta activa siempre se muestra)
        $ruta = RutaDiaria::with($eagerLoad)
            ->where('mensajero_id', $userId)
            ->where('status', 'en_progreso')
            ->orderByRaw("ABS(DATEDIFF(fecha, CURDATE()))")
            ->first();

        // 2. Ruta confirmada de hoy
        if (!$ruta) {
            $ruta = RutaDiaria::with($eagerLoad)
                ->where('mensajero_id', $userId)
                ->whereDate('fecha', today())
                ->where('status', 'confirmada')
                ->first();
        }

        // 3. Próxima ruta confirmada (hoy o futura)
        if (!$ruta) {
            $ruta = RutaDiaria::with($eagerLoad)
                ->where('mensajero_id', $userId)
                ->where('status', 'confirmada')
                ->whereDate('fecha', '>=', today())
                ->orderBy('fecha')
                ->first();
        }

        if (!$ruta) {
            return response()->json(['message' => 'No tienes rutas asignadas.', 'ruta' => null]);
        }

        return response()->json($ruta);
    }

    /**
     * Reordenar tareas dentro de una ruta.
     */
    public function reordenar(Request $request, string $id)
    {
        $ruta = RutaDiaria::findOrFail($id);

        if (in_array($ruta->status, ['completada'])) {
            return response()->json(['message' => 'No se puede reordenar una ruta completada.'], 422);
        }

        $validated = $request->validate([
            'orden' => 'required|array|min:1',
            'orden.*' => 'integer|exists:tareas_ruta,id',
        ]);

        // Verificar que TODAS las tareas pertenezcan a esta ruta
        $rutaTareaIds = $ruta->tareas()->pluck('id')->toArray();
        $idsNoPertenecen = array_diff($validated['orden'], $rutaTareaIds);
        if (!empty($idsNoPertenecen)) {
            return response()->json([
                'message' => 'Algunas tareas no pertenecen a esta ruta.',
                'ids_invalidos' => array_values($idsNoPertenecen),
            ], 422);
        }

        DB::transaction(function () use ($ruta, $validated) {
            $posicion = 1;
            foreach ($validated['orden'] as $tareaId) {
                TareaRuta::where('id', $tareaId)
                    ->where('ruta_diaria_id', $ruta->id)
                    ->update(['posicion' => $posicion++]);
            }
        });

        $this->logActivity('update', 'Rutas', $ruta, "Ruta reordenada: {$ruta->fecha->format('Y-m-d')}");

        return response()->json(
            $ruta->load(['tareas' => fn($q) => $q->orderBy('posicion')])
        );
    }

    /**
     * Replanificar una ruta: cambiar la fecha y resetear a confirmada.
     */
    public function replanificar(Request $request, string $id)
    {
        $ruta = RutaDiaria::findOrFail($id);

        if ($ruta->status === 'completada') {
            return response()->json(['message' => 'No se puede replanificar una ruta completada.'], 422);
        }

        $validated = $request->validate([
            'fecha' => 'required|date|after_or_equal:today',
        ]);

        return DB::transaction(function () use ($ruta, $validated) {
            $fechaAnterior = $ruta->fecha->format('Y-m-d');

            $ruta->update([
                'fecha' => $validated['fecha'],
                'status' => 'confirmada',
            ]);

            // Resetear tareas en_transito a asignada (si la ruta estaba en progreso)
            $ruta->tareas()
                ->where('status', 'en_transito')
                ->update(['status' => 'asignada', 'fecha_asignada' => $validated['fecha']]);

            // Actualizar fecha_asignada de las demás tareas activas
            $ruta->tareas()
                ->where('status', 'asignada')
                ->update(['fecha_asignada' => $validated['fecha']]);

            $this->logActivity('update', 'Rutas', $ruta, "Ruta replanificada: {$fechaAnterior} → {$validated['fecha']}");

            return response()->json($ruta->load(['tareas' => fn($q) => $q->orderBy('posicion')]));
        });
    }

    /**
     * Cancelar una ruta: devuelve todas las tareas no completadas a pendiente y elimina la ruta.
     */
    public function cancelar(string $id)
    {
        $ruta = RutaDiaria::findOrFail($id);

        if ($ruta->status === 'completada') {
            return response()->json(['message' => 'No se puede cancelar una ruta completada.'], 422);
        }

        return DB::transaction(function () use ($ruta) {
            $completadas = $ruta->tareas()->where('status', 'completada')->count();

            // Devolver tareas no completadas/fallidas a pendiente
            $liberadas = $ruta->tareas()
                ->whereNotIn('status', ['completada', 'fallida'])
                ->update([
                    'status' => 'pendiente',
                    'ruta_diaria_id' => null,
                    'fecha_asignada' => null,
                    'posicion' => null,
                    'asignado_a' => null,
                ]);

            // Desvincular tareas completadas de la ruta (preservar su status)
            $ruta->tareas()->where('status', 'completada')->update([
                'ruta_diaria_id' => null,
                'posicion' => null,
            ]);

            $fecha = $ruta->fecha->format('Y-m-d');

            $this->logActivity('delete', 'Rutas', $ruta, "Ruta cancelada: {$fecha} ({$completadas} completadas, {$liberadas} liberadas)");

            $ruta->delete();

            return response()->json([
                'message' => 'Ruta cancelada. Las tareas pendientes fueron liberadas.',
                'completadas_preservadas' => $completadas,
                'tareas_liberadas' => $liberadas,
            ]);
        });
    }
}
