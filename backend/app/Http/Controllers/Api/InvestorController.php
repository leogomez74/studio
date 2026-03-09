<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Investor;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Traits\LogsActivity;

class InvestorController extends Controller
{
    use LogsActivity;
    public function index(Request $request)
    {
        $query = Investor::withCount(['investments as active_investments_count' => fn ($q) => $q->where('estado', 'Activa')]);

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('cedula', 'like', "%{$search}%");
            });
        }

        if ($request->get('all') === 'true') {
            return response()->json($query->latest()->get());
        }

        $perPage = min($request->get('per_page', 50), 100);
        return response()->json($query->latest()->paginate($perPage));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'cedula' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:20',
            'status' => 'in:Activo,Inactivo',
            'tipo_persona' => 'string|max:255',
            'notas' => 'nullable|string',
            'cuenta_bancaria' => 'nullable|string|max:50',
            'banco' => 'nullable|string|max:100',
            'joined_at' => 'nullable|date',
        ]);

        $investor = Investor::create($validated);
        $this->logActivity('create', 'Inversionistas', $investor, $investor->name . ' (' . ($investor->cedula ?? 'Sin cédula') . ')', [], $request);
        return response()->json($investor, 201);
    }

    public function show(int $id)
    {
        $investor = Investor::withCount(['investments as active_investments_count' => fn ($q) => $q->where('estado', 'Activa')])
            ->with(['investments.coupons', 'payments', 'capitalReserves'])
            ->findOrFail($id);
        return response()->json($investor);
    }

    public function update(Request $request, int $id)
    {
        $investor = Investor::findOrFail($id);
        $oldData = $investor->toArray();

        $validated = $request->validate([
            'name' => 'string|max:255',
            'cedula' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:20',
            'status' => 'in:Activo,Inactivo',
            'tipo_persona' => 'string|max:255',
            'notas' => 'nullable|string',
            'cuenta_bancaria' => 'nullable|string|max:50',
            'banco' => 'nullable|string|max:100',
            'joined_at' => 'nullable|date',
        ]);

        $investor->update($validated);
        $changes = $this->getChanges($oldData, $investor->fresh()->toArray());
        $this->logActivity('update', 'Inversionistas', $investor, $investor->name . ' (' . ($investor->cedula ?? 'Sin cédula') . ')', $changes, $request);
        return response()->json($investor);
    }

    public function destroy(int $id)
    {
        $investor = Investor::findOrFail($id);
        $this->logActivity('delete', 'Inversionistas', $investor, $investor->name . ' (' . ($investor->cedula ?? 'Sin cédula') . ')');

        DB::transaction(function () use ($investor) {
            // Cascade delete related records
            $investor->capitalReserves()->delete();
            $investor->payments()->delete();
            $investor->investments()->each(function ($investment) {
                $investment->coupons()->delete();
                $investment->delete();
            });

            $investor->delete();
        });

        return response()->json(['message' => 'Inversionista eliminado']);
    }
}
