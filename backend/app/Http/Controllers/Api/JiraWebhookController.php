<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bug;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class JiraWebhookController extends Controller
{
    /** Mapeo estado Jira → Studio */
    private function mapStatus(string $jiraStatus): ?string
    {
        $status = strtolower($jiraStatus);
        if (str_contains($status, 'do') || str_contains($status, 'hacer') || str_contains($status, 'backlog'))
            return 'abierto';
        if (str_contains($status, 'progress') || str_contains($status, 'curso'))
            return 'en_progreso';
        if (str_contains($status, 'review') || str_contains($status, 'revision'))
            return 'en_revision';
        if (str_contains($status, 'done') || str_contains($status, 'finaliz') || str_contains($status, 'cerr'))
            return 'cerrado';
        return null;
    }

    /** Mapeo prioridad Jira → Studio */
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

    public function handle(Request $request)
    {
        $event   = $request->input('webhookEvent');
        $issue   = $request->input('issue');
        $jiraKey = $issue['key'] ?? null;

        if (!$jiraKey) {
            return response()->json(['ok' => true]);
        }

        Log::info("Jira webhook: {$event} — {$jiraKey}");

        // Buscar bug por jira_key
        $bug = Bug::where('jira_key', $jiraKey)->first();
        if (!$bug) {
            return response()->json(['ok' => true, 'msg' => 'Bug not found']);
        }

        // ── Issue eliminado en Jira ──────────────────────────────────────────
        if ($event === 'jira:issue_deleted') {
            foreach ($bug->images as $img) {
                Storage::disk('public')->delete($img->path);
            }
            $bug->delete();
            Log::info("Jira webhook: bug {$jiraKey} eliminado en Studio");
            return response()->json(['ok' => true, 'action' => 'deleted']);
        }

        // ── Issue actualizado en Jira ────────────────────────────────────────
        if (in_array($event, ['jira:issue_updated', 'jira:issue_created'])) {
            $fields  = $issue['fields'] ?? [];
            $updates = [];

            // Status
            $jiraStatus = $fields['status']['name'] ?? null;
            if ($jiraStatus) {
                $studioStatus = $this->mapStatus($jiraStatus);
                if ($studioStatus && $studioStatus !== $bug->status) {
                    $updates['status'] = $studioStatus;
                }
            }

            // Prioridad
            $jiraPriority = $fields['priority']['name'] ?? null;
            if ($jiraPriority) {
                $studioPriority = $this->mapPriority($jiraPriority);
                if ($studioPriority && $studioPriority !== $bug->priority) {
                    $updates['priority'] = $studioPriority;
                }
            }

            // Título (summary sin el prefijo [BUG-XXXX])
            $summary = $fields['summary'] ?? null;
            if ($summary) {
                $cleanTitle = preg_replace('/^\[BUG-\d+\]\s*/', '', $summary);
                if ($cleanTitle && $cleanTitle !== $bug->title) {
                    $updates['title'] = $cleanTitle;
                }
            }

            // Descripción
            $descContent = $fields['description']['content'][0]['content'][0]['text'] ?? null;
            if ($descContent && $descContent !== $bug->description) {
                $updates['description'] = $descContent;
            }

            if (!empty($updates)) {
                $bug->update($updates);
                Log::info("Jira webhook: bug {$jiraKey} actualizado en Studio", $updates);
            }

            return response()->json(['ok' => true, 'action' => 'updated', 'changes' => $updates]);
        }

        return response()->json(['ok' => true]);
    }
}
