<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bug;
use App\Models\BugImage;
use App\Services\JiraService;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;

class BugController extends Controller
{
    use LogsActivity;

    public function index(Request $request)
    {
        $query = Bug::with(['assignee:id,name', 'creator:id,name', 'images']);

        if ($request->status) {
            $query->where('status', $request->status);
        }
        if ($request->priority) {
            $query->where('priority', $request->priority);
        }
        if ($request->assigned_to) {
            $query->where('assigned_to', $request->assigned_to);
        }
        if ($request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('reference', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        return response()->json(
            $query->orderByRaw("FIELD(priority, 'critica', 'alta', 'media', 'baja')")
                  ->orderBy('created_at', 'desc')
                  ->get()
        );
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title'       => 'required|string|max:255',
            'description' => 'nullable|string|max:5000',
            'priority'    => 'required|in:baja,media,alta,critica',
            'assigned_to' => 'nullable|exists:users,id',
            'status'      => 'nullable|in:abierto,en_progreso,en_revision,cerrado',
        ]);

        $validated['created_by'] = $request->user()->id;
        $validated['status'] = $validated['status'] ?? 'abierto';

        $bug = Bug::create($validated);

        // Sincronizar con Jira
        try {
            $jira = new JiraService();
            $jiraKey = $jira->createIssue(
                $bug->reference,
                $bug->title,
                $bug->priority,
                $bug->description,
                $request->input('jira_assignee_id')
            );
            if ($jiraKey) $bug->update(['jira_key' => $jiraKey]);
        } catch (\Exception $e) {
            Log::warning('Jira sync on create: ' . $e->getMessage());
        }

        $bug->load(['assignee:id,name', 'creator:id,name', 'images']);

        $this->logActivity('create', 'Incidencias', $bug, $bug->reference . ' - ' . $bug->title, [], $request);

        return response()->json($bug, 201);
    }

    public function show(Bug $bug)
    {
        $bug->load(['assignee:id,name', 'creator:id,name', 'images']);
        return response()->json($bug);
    }

    public function update(Request $request, Bug $bug)
    {
        $validated = $request->validate([
            'title'       => 'sometimes|string|max:255',
            'description' => 'nullable|string|max:5000',
            'status'      => 'sometimes|in:abierto,en_progreso,en_revision,cerrado',
            'priority'    => 'sometimes|in:baja,media,alta,critica',
            'assigned_to' => 'nullable|exists:users,id',
        ]);

        $oldData = $bug->toArray();
        $bug->update($validated);
        $changes = $this->getChanges($oldData, $bug->fresh()->toArray());

        if ($bug->jira_key) {
            try {
                $jira = new JiraService();
                if (isset($validated['status'])) {
                    $jira->updateStatus($bug->jira_key, $validated['status']);
                }
                if (array_intersect_key($validated, array_flip(['title', 'description']))) {
                    $jira->updateIssue($bug->jira_key, $validated);
                }
            } catch (\Exception $e) { Log::warning('Jira sync on update: ' . $e->getMessage()); }
        }

        $this->logActivity('update', 'Incidencias', $bug, $bug->reference, $changes, $request);

        $bug->load(['assignee:id,name', 'creator:id,name', 'images']);
        return response()->json($bug);
    }

    public function destroy(Request $request, Bug $bug)
    {
        $this->logActivity('delete', 'Incidencias', $bug, $bug->reference . ' - ' . $bug->title, [], $request);

        // Eliminar en Jira
        if ($bug->jira_key) {
            try { (new JiraService())->deleteIssue($bug->jira_key); }
            catch (\Exception $e) { Log::warning('Jira deleteIssue failed: ' . $e->getMessage()); }
        }

        // Eliminar imágenes del disco
        foreach ($bug->images as $img) {
            Storage::disk('public')->delete($img->path);
        }
        $bug->delete();

        return response()->json(['message' => 'Incidencia eliminada']);
    }

    /**
     * Actualizar solo el status (para drag & drop en el Kanban)
     */
    public function updateStatus(Request $request, Bug $bug)
    {
        $validated = $request->validate([
            'status' => 'required|in:abierto,en_progreso,en_revision,cerrado',
        ]);

        $oldStatus = $bug->status;
        $bug->update($validated);

        if ($bug->jira_key) {
            try { (new JiraService())->updateStatus($bug->jira_key, $validated['status']); }
            catch (\Exception $e) { Log::warning('Jira sync on status: ' . $e->getMessage()); }
        }

        $this->logActivity('update', 'Incidencias', $bug, $bug->reference, [
            ['field' => 'status', 'old_value' => $oldStatus, 'new_value' => $validated['status']]
        ], $request);

        $bug->load(['assignee:id,name', 'creator:id,name', 'images']);
        return response()->json($bug);
    }

    /**
     * Subir imágenes a un bug
     */
    public function uploadImages(Request $request, Bug $bug)
    {
        $request->validate([
            'images'   => 'required|array|max:10',
            'images.*' => 'image|mimes:jpg,jpeg,png,gif,webp|max:5120',
        ]);

        $uploaded = [];
        $jira = new JiraService();

        foreach ($request->file('images') as $file) {
            $path = $file->store('bugs/' . $bug->id, 'public');
            $uploaded[] = BugImage::create([
                'bug_id'        => $bug->id,
                'path'          => $path,
                'original_name' => $file->getClientOriginalName(),
                'size'          => $file->getSize(),
            ]);

            // Adjuntar imagen a Jira si el bug tiene jira_key
            if ($bug->jira_key) {
                try {
                    $fullPath = Storage::disk('public')->path($path);
                    $jira->attachFile($bug->jira_key, $fullPath, $file->getClientOriginalName());
                } catch (\Exception $e) {
                    Log::warning('Jira attachFile failed: ' . $e->getMessage());
                }
            }
        }

        return response()->json($uploaded, 201);
    }

    /**
     * Eliminar una imagen de un bug
     */
    public function deleteImage(Bug $bug, BugImage $image)
    {
        if ($image->bug_id !== $bug->id) {
            return response()->json(['message' => 'Imagen no pertenece a esta incidencia'], 403);
        }

        Storage::disk('public')->delete($image->path);
        $image->delete();

        return response()->json(['message' => 'Imagen eliminada']);
    }

    /**
     * Estadísticas para el board
     */
    public function stats()
    {
        return response()->json([
            'total'       => Bug::count(),
            'abierto'     => Bug::where('status', 'abierto')->count(),
            'en_progreso' => Bug::where('status', 'en_progreso')->count(),
            'en_revision' => Bug::where('status', 'en_revision')->count(),
            'cerrado'     => Bug::where('status', 'cerrado')->count(),
        ]);
    }
}
