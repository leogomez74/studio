<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RutaDiaria;
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
        $query = RutaDiaria::with(['mensajero:id,name', 'confirmadaPor:id,name'])
            ->withCount(['tareas', 'tareas as completadas_count' => fn($q) => $q->where('status', 'completada')]);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('fecha_desde')) {
            $query->whereDate('fecha', '>=', $request->fecha_desde);
        }
        if ($request->filled('fecha_hasta')) {
            $query->whereDate('fecha', '<=', $request->fecha_hasta);
        }
        if ($request->filled('mensajero_id')) {
            $query->where('mensajero_id', $request->mensajero_id);
        }

        return response()->json($query->orderBy('fecha', 'desc')->get());
    }

    public function show(string $id)
    {
        $ruta = RutaDiaria::with([
            'mensajero:id,name',
            'confirmadaPor:id,name',
            'tareas' => fn($q) => $q->orderBy('posicion')->with(['solicitante:id,name']),
        ])->findOrFail($id);

        return response()->json($ruta);
    }

    /**
     * Generar ruta para una fecha: toma tareas pendientes en orden FIFO y las asigna.
     */
    public function generar(Request $request)
    {
        $validated = $request->validate([
            'fecha' => 'required|date',
            'mensajero_id' => 'required|exists:users,id',
            'tarea_ids' => 'required|array|min:1',
            'tarea_ids.*' => 'integer|exists:tareas_ruta,id',
        ]);

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

        return DB::transaction(function () use ($validated) {
            $ruta = RutaDiaria::create([
                'fecha' => $validated['fecha'],
                'mensajero_id' => $validated['mensajero_id'],
                'status' => 'borrador',
                'total_tareas' => count($validated['tarea_ids']),
                'completadas' => 0,
            ]);

            // Asignar tareas en el orden recibido (el frontend envía ya ordenado FIFO)
            $posicion = 1;
            foreach ($validated['tarea_ids'] as $tareaId) {
                TareaRuta::where('id', $tareaId)
                    ->where('status', 'pendiente')
                    ->update([
                        'status' => 'asignada',
                        'asignado_a' => $validated['mensajero_id'],
                        'ruta_diaria_id' => $ruta->id,
                        'fecha_asignada' => $validated['fecha'],
                        'posicion' => $posicion++,
                    ]);
            }

            $ruta->recalcularConteo();

            $this->logActivity('create', 'Rutas', $ruta, "Ruta generada: {$validated['fecha']}");

            return response()->json(
                $ruta->load(['mensajero:id,name', 'tareas' => fn($q) => $q->orderBy('posicion')]),
                201
            );
        });
    }

    public function confirmar(Request $request, string $id)
    {
        $ruta = RutaDiaria::findOrFail($id);

        if ($ruta->status !== 'borrador') {
            return response()->json(['message' => 'Solo se pueden confirmar rutas en borrador.'], 422);
        }

        $ruta->update([
            'status' => 'confirmada',
            'confirmada_por' => Auth::id(),
            'confirmada_at' => now(),
        ]);

        $this->logActivity('update', 'Rutas', $ruta, "Ruta confirmada: {$ruta->fecha->format('Y-m-d')}");

        return response()->json($ruta);
    }

    public function iniciar(string $id)
    {
        $ruta = RutaDiaria::findOrFail($id);

        if ($ruta->status !== 'confirmada') {
            return response()->json(['message' => 'Solo se pueden iniciar rutas confirmadas.'], 422);
        }

        $ruta->update(['status' => 'en_progreso']);

        // Marcar tareas como en_transito
        $ruta->tareas()->where('status', 'asignada')->update(['status' => 'en_transito']);

        $this->logActivity('update', 'Rutas', $ruta, "Ruta iniciada: {$ruta->fecha->format('Y-m-d')}");

        return response()->json($ruta);
    }

    /**
     * Mi ruta de hoy (para el mensajero autenticado).
     */
    public function miRuta()
    {
        $ruta = RutaDiaria::with(['tareas' => fn($q) => $q->orderBy('posicion')->with('solicitante:id,name')])
            ->where('mensajero_id', Auth::id())
            ->whereDate('fecha', today())
            ->first();

        if (!$ruta) {
            return response()->json(['message' => 'No tienes ruta asignada para hoy.', 'ruta' => null]);
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
}
