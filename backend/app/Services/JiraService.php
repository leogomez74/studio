<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class JiraService
{
    private ?string $baseUrl;
    private ?string $email;
    private ?string $token;
    private ?string $projectKey;
    private bool $configured;

    public function __construct()
    {
        $this->baseUrl    = rtrim(config('services.jira.url', ''), '/') ?: null;
        $this->email      = config('services.jira.email') ?: null;
        $this->token      = config('services.jira.token') ?: null;
        $this->projectKey = config('services.jira.project_key', 'PJ') ?: null;
        $this->configured = $this->baseUrl && $this->email && $this->token && $this->projectKey;
    }

    public function isConfigured(): bool
    {
        return $this->configured;
    }

    private function client()
    {
        return Http::withBasicAuth($this->email, $this->token)
                   ->withHeaders(['Content-Type' => 'application/json', 'Accept' => 'application/json']);
    }

    private function mapPriority(string $priority): string
    {
        return match ($priority) {
            'critica' => 'Highest',
            'alta'    => 'High',
            'media'   => 'Medium',
            'baja'    => 'Low',
            default   => 'Medium',
        };
    }

    private function mapStatus(string $status): string
    {
        return match ($status) {
            'abierto'     => 'To Do',
            'en_progreso' => 'In Progress',
            'en_revision' => 'In Review',
            'cerrado'     => 'Done',
            default       => 'To Do',
        };
    }

    /**
     * Crear issue en Jira. Retorna la key (ej: PJ-12) o null si falla.
     */
    public function createIssue(string $reference, string $title, string $priority, ?string $description = null, ?string $assigneeAccountId = null): ?string
    {
        if (!$this->configured) return null;
        try {
            $fields = [
                'project'     => ['key' => $this->projectKey],
                'summary'     => "[{$reference}] {$title}",
                'description' => [
                    'type'    => 'doc',
                    'version' => 1,
                    'content' => [[
                        'type'    => 'paragraph',
                        'content' => [['type' => 'text', 'text' => $description ?? $title]],
                    ]],
                ],
                'issuetype' => ['name' => 'Tarea'],
                'priority'  => ['name' => $this->mapPriority($priority)],
            ];

            if ($assigneeAccountId) {
                $fields['assignee'] = ['accountId' => $assigneeAccountId];
            }

            $response = $this->client()->post("{$this->baseUrl}/rest/api/3/issue", ['fields' => $fields]);

            if ($response->successful()) {
                return $response->json('key');
            }

            Log::warning('Jira createIssue failed', [
                'status' => $response->status(),
                'body'   => $response->body(),
            ]);
            return null;

        } catch (\Exception $e) {
            Log::error('Jira createIssue exception: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Obtener subtareas de un issue.
     */
    public function getSubtasks(string $jiraKey): array
    {
        if (!$this->configured) return [];
        try {
            $resp = $this->client()->get("{$this->baseUrl}/rest/api/3/issue/{$jiraKey}", [
                'fields' => 'subtasks,summary,status,assignee',
            ]);
            if (!$resp->successful()) return [];

            return collect($resp->json('fields.subtasks', []))
                ->map(fn($s) => [
                    'key'      => $s['key'],
                    'summary'  => $s['fields']['summary'] ?? '',
                    'status'   => $s['fields']['status']['name'] ?? '',
                    'assignee' => $s['fields']['assignee']['displayName'] ?? null,
                    'url'      => "{$this->baseUrl}/browse/{$s['key']}",
                ])
                ->toArray();
        } catch (\Exception $e) {
            Log::error('Jira getSubtasks: ' . $e->getMessage());
            return [];
        }
    }

    /**
     * Crear subtarea en Jira.
     */
    public function createSubtask(string $parentKey, string $title, ?string $assigneeAccountId = null): ?string
    {
        if (!$this->configured) return null;
        try {
            $fields = [
                'project'   => ['key' => $this->projectKey],
                'parent'    => ['key' => $parentKey],
                'summary'   => $title,
                'issuetype' => ['name' => 'Subtarea'],
            ];
            if ($assigneeAccountId) {
                $fields['assignee'] = ['accountId' => $assigneeAccountId];
            }
            $resp = $this->client()->post("{$this->baseUrl}/rest/api/3/issue", ['fields' => $fields]);
            return $resp->successful() ? $resp->json('key') : null;
        } catch (\Exception $e) {
            Log::error('Jira createSubtask: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Eliminar un issue de Jira.
     */
    public function deleteIssue(string $jiraKey): void
    {
        if (!$this->configured) return;
        try {
            $this->client()->delete("{$this->baseUrl}/rest/api/3/issue/{$jiraKey}");
        } catch (\Exception $e) {
            Log::error('Jira deleteIssue exception: ' . $e->getMessage());
        }
    }

    /**
     * Adjuntar un archivo a un issue de Jira.
     */
    public function attachFile(string $jiraKey, string $filePath, string $fileName): void
    {
        if (!$this->configured) return;
        try {
            Http::withBasicAuth($this->email, $this->token)
                ->withHeaders([
                    'X-Atlassian-Token' => 'no-check',
                    'Accept'            => 'application/json',
                ])
                ->attach('file', file_get_contents($filePath), $fileName)
                ->post("{$this->baseUrl}/rest/api/3/issue/{$jiraKey}/attachments");
        } catch (\Exception $e) {
            Log::error('Jira attachFile exception: ' . $e->getMessage());
        }
    }

    /**
     * Actualizar status de un issue en Jira via transiciones.
     */
    public function updateStatus(string $jiraKey, string $status): void
    {
        if (!$this->configured) return;
        try {
            $resp = $this->client()->get("{$this->baseUrl}/rest/api/3/issue/{$jiraKey}/transitions");
            if (!$resp->successful()) return;

            $targetName   = $this->mapStatus($status);
            $transitionId = null;

            foreach ($resp->json('transitions', []) as $t) {
                if (str_contains(strtolower($t['name']), strtolower($targetName)) ||
                    str_contains(strtolower($t['to']['name'] ?? ''), strtolower($targetName))) {
                    $transitionId = $t['id'];
                    break;
                }
            }

            if (!$transitionId) return;

            $this->client()->post("{$this->baseUrl}/rest/api/3/issue/{$jiraKey}/transitions", [
                'transition' => ['id' => $transitionId],
            ]);

        } catch (\Exception $e) {
            Log::error('Jira updateStatus exception: ' . $e->getMessage());
        }
    }

    /**
     * Obtener usuarios del proyecto (caché 1 hora).
     */
    public function getUsers(): array
    {
        if (!$this->configured) return [];
        return Cache::remember('jira_users_' . $this->projectKey, 3600, function () {
            try {
                $response = $this->client()->get("{$this->baseUrl}/rest/api/3/user/assignable/search", [
                    'project'    => $this->projectKey,
                    'maxResults' => 100,
                ]);

                if (!$response->successful()) return [];

                return collect($response->json())
                    ->filter(fn($u) => ($u['accountType'] ?? '') === 'atlassian' && !empty($u['displayName']))
                    ->map(fn($u) => [
                        'accountId'   => $u['accountId'],
                        'displayName' => $u['displayName'],
                        'email'       => $u['emailAddress'] ?? null,
                        'avatar'      => $u['avatarUrls']['48x48'] ?? null,
                    ])
                    ->values()
                    ->toArray();

            } catch (\Exception $e) {
                Log::error('Jira getUsers exception: ' . $e->getMessage());
                return [];
            }
        });
    }

    /**
     * Actualizar título y/o descripción de un issue en Jira.
     */
    public function updateIssue(string $jiraKey, array $fields): void
    {
        if (!$this->configured) return;
        $update = [];
        if (isset($fields['title'])) {
            $update['summary'] = $fields['title'];
        }
        if (array_key_exists('description', $fields)) {
            $text = $fields['description'] ?? '';
            $update['description'] = [
                'type'    => 'doc',
                'version' => 1,
                'content' => [[
                    'type'    => 'paragraph',
                    'content' => [['type' => 'text', 'text' => $text ?: ' ']],
                ]],
            ];
        }
        if (empty($update)) return;
        try {
            $this->client()->put("{$this->baseUrl}/rest/api/3/issue/{$jiraKey}", ['fields' => $update]);
        } catch (\Exception $e) {
            Log::error('Jira updateIssue: ' . $e->getMessage());
        }
    }

    /**
     * Registrar (o actualizar) el webhook en Jira apuntando al APP_URL del .env
     */
    public function registerWebhook(): array
    {
        if (!$this->configured) return ['error' => 'Jira no configurado'];

        $webhookUrl = rtrim(config('app.url'), '/') . '/api/webhooks/jira';

        try {
            // Verificar si ya existe
            $existing = $this->client()->get("{$this->baseUrl}/rest/webhooks/1.0/webhook");
            $hooks = $existing->json() ?? [];
            foreach ($hooks as $hook) {
                if (str_contains($hook['url'] ?? '', '/api/webhooks/jira')) {
                    // Ya existe, actualizamos la URL por si cambió
                    $this->client()->put("{$this->baseUrl}/rest/webhooks/1.0/webhook/{$hook['self']}", [
                        'name'   => 'Studio Sync',
                        'url'    => $webhookUrl,
                        'events' => ['jira:issue_created', 'jira:issue_updated', 'jira:issue_deleted'],
                        'filters' => ['issue-related-events-section' => "project = {$this->projectKey}"],
                    ]);
                    return ['status' => 'updated', 'url' => $webhookUrl];
                }
            }

            // Crear nuevo
            $resp = $this->client()->post("{$this->baseUrl}/rest/webhooks/1.0/webhook", [
                'name'    => 'Studio Sync',
                'url'     => $webhookUrl,
                'events'  => ['jira:issue_created', 'jira:issue_updated', 'jira:issue_deleted'],
                'filters' => ['issue-related-events-section' => "project = {$this->projectKey}"],
            ]);

            if ($resp->successful()) {
                return ['status' => 'created', 'url' => $webhookUrl];
            }

            return ['error' => $resp->body(), 'url' => $webhookUrl];

        } catch (\Exception $e) {
            Log::error('Jira registerWebhook: ' . $e->getMessage());
            return ['error' => $e->getMessage()];
        }
    }
}
