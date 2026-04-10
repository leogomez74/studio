<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bug;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class JiraWebhookController extends Controller
{
    private function mapStatus(string $jiraStatus): ?string
    {
        $s = strtolower($jiraStatus);
        if (str_contains($s, 'do') || str_contains($s, 'hacer') || str_contains($s, 'backlog')) return 'abierto';
        if (str_contains($s, 'progress') || str_contains($s, 'curso'))                          return 'en_progreso';
        if (str_contains($s, 'review') || str_contains($s, 'revision'))                         return 'en_revision';
        if (str_contains($s, 'done') || str_contains($s, 'finaliz') || str_contains($s, 'cerr')) return 'cerrado';
        return null;
    }

    private function mapPriority(string $jiraPriority): ?string
    {
        return match (strtolower($jiraPriority)) {
            'highest', 'critical' => 'critica',
            'high'                => 'alta',
            'medium'              => 'media',
            'low', 'lowest'       => 'baja',
            default               => null,
        };
    }

    private function extractDescription(array $fields): ?string
    {
        return $fields['description']['content'][0]['content'][0]['text'] ?? null;
    }

    private function findStudioUser(?string $jiraDisplayName): ?int
    {
        if (!$jiraDisplayName) return null;
        $firstName = strtolower(explode(' ', trim($jiraDisplayName))[0]);
        $user = User::whereRaw('LOWER(name) LIKE ?', ["%{$firstName}%"])->first();
        return $user?->id;
    }

    public function handle(Request $request)
    {
        $event   = $request->input('webhookEvent');
        $issue   = $request->input('issue');
        $jiraKey = $issue['key'] ?? null;

        if (!$jiraKey) return response()->json(['ok' => true]);

        Log::info("Jira webhook: {$event} — {$jiraKey}");

        $fields = $issue['fields'] ?? [];

        // ── Crear desde Jira → Studio ─────────────────────────────────────────
        if ($event === 'jira:issue_created') {
            $existing = Bug::where('jira_key', $jiraKey)->first();
            if (!$existing) {
                $title    = preg_replace('/^\[BUG-\d+\]\s*/', '', $fields['summary'] ?? 'Sin título');
                $priority = $this->mapPriority($fields['priority']['name'] ?? 'Medium') ?? 'media';
                $status   = $this->mapStatus($fields['status']['name'] ?? 'To Do') ?? 'abierto';
                $userId   = $this->findStudioUser($fields['assignee']['displayName'] ?? null);
                $adminId  = $userId ?? User::first()?->id ?? 1;

                Bug::create([
                    'jira_key'    => $jiraKey,
                    'title'       => $title,
                    'description' => $this->extractDescription($fields),
                    'priority'    => $priority,
                    'status'      => $status,
                    'assigned_to' => $userId,
                    'created_by'  => $adminId,
                ]);

                Log::info("Jira webhook: bug {$jiraKey} creado en Studio");
            }
            return response()->json(['ok' => true, 'action' => 'created']);
        }

        // ── Eliminar desde Jira → Studio ──────────────────────────────────────
        if ($event === 'jira:issue_deleted') {
            $bug = Bug::where('jira_key', $jiraKey)->first();
            if ($bug) {
                foreach ($bug->images as $img) Storage::disk('public')->delete($img->path);
                $bug->delete();
                Log::info("Jira webhook: bug {$jiraKey} eliminado en Studio");
            }
            return response()->json(['ok' => true, 'action' => 'deleted']);
        }

        // ── Actualizar desde Jira → Studio ────────────────────────────────────
        if ($event === 'jira:issue_updated') {
            $bug = Bug::where('jira_key', $jiraKey)->first();
            if (!$bug) return response()->json(['ok' => true, 'msg' => 'not found']);

            $updates = [];

            // Status
            $jiraStatus = $fields['status']['name'] ?? null;
            if ($jiraStatus) {
                $mapped = $this->mapStatus($jiraStatus);
                if ($mapped && $mapped !== $bug->status) $updates['status'] = $mapped;
            }

            // Prioridad
            $jiraPriority = $fields['priority']['name'] ?? null;
            if ($jiraPriority) {
                $mapped = $this->mapPriority($jiraPriority);
                if ($mapped && $mapped !== $bug->priority) $updates['priority'] = $mapped;
            }

            // Título
            $summary = $fields['summary'] ?? null;
            if ($summary) {
                $clean = preg_replace('/^\[BUG-\d+\]\s*/', '', $summary);
                if ($clean && $clean !== $bug->title) $updates['title'] = $clean;
            }

            // Descripción
            $desc = $this->extractDescription($fields);
            if ($desc && $desc !== $bug->description) $updates['description'] = $desc;

            // Asignado
            $userId = $this->findStudioUser($fields['assignee']['displayName'] ?? null);
            if ($userId && $userId !== $bug->assigned_to) $updates['assigned_to'] = $userId;

            if (!empty($updates)) {
                $bug->update($updates);
                Log::info("Jira webhook: bug {$jiraKey} actualizado en Studio", $updates);
            }

            return response()->json(['ok' => true, 'action' => 'updated', 'changes' => $updates]);
        }

        return response()->json(['ok' => true]);
    }
}
