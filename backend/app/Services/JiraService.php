<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class JiraService
{
    private string $baseUrl;
    private string $email;
    private string $token;
    private string $projectKey;

    public function __construct()
    {
        $this->baseUrl    = rtrim(config('services.jira.url'), '/');
        $this->email      = config('services.jira.email');
        $this->token      = config('services.jira.token');
        $this->projectKey = config('services.jira.project_key');
    }

    private function client()
    {
        return Http::withBasicAuth($this->email, $this->token)
                   ->withHeaders(['Content-Type' => 'application/json', 'Accept' => 'application/json']);
    }

    /** Mapeo de prioridades Studio → Jira */
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

    /** Mapeo de estados Studio → transition name en Jira */
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

    /** Crear issue en Jira, retorna la key (ej: PJ-12) o null si falla */
    public function createIssue(string $reference, string $title, string $priority, ?string $description = null): ?string
    {
        try {
            $body = [
                'fields' => [
                    'project'     => ['key' => $this->projectKey],
                    'summary'     => "[{$reference}] {$title}",
                    'description' => [
                        'type'    => 'doc',
                        'version' => 1,
                        'content' => [[
                            'type'    => 'paragraph',
                            'content' => [[
                                'type' => 'text',
                                'text' => $description ?? $title,
                            ]],
                        ]],
                    ],
                    'issuetype' => ['name' => 'Bug'],
                    'priority'  => ['name' => $this->mapPriority($priority)],
                ],
            ];

            $response = $this->client()->post("{$this->baseUrl}/rest/api/3/issue", $body);

            if ($response->successful()) {
                return $response->json('key');
            }

            Log::warning('Jira createIssue failed', ['status' => $response->status(), 'body' => $response->body()]);
            return null;

        } catch (\Exception $e) {
            Log::error('Jira createIssue exception: ' . $e->getMessage());
            return null;
        }
    }

    /** Actualizar status de un issue en Jira */
    public function updateStatus(string $jiraKey, string $status): void
    {
        try {
            // Obtener transiciones disponibles
            $resp = $this->client()->get("{$this->baseUrl}/rest/api/3/issue/{$jiraKey}/transitions");
            if (!$resp->successful()) return;

            $targetName = $this->mapStatus($status);
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

    /** Obtener usuarios del proyecto (caché 1 hora) */
    public function getUsers(): array
    {
        return Cache::remember('jira_users', 3600, function () {
            try {
                $response = $this->client()->get("{$this->baseUrl}/rest/api/3/users/search", [
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
}
