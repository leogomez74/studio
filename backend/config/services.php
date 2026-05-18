<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'lead_alerts' => [
        'webhook_url' => env('LEAD_ALERTS_WEBHOOK_URL'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'erp' => [
        'url'            => env('ERP_API_URL', env('ERP_SERVICE_URL', '')),
        'email'          => env('ERP_API_EMAIL', ''),
        'password'       => env('ERP_API_PASSWORD', ''),
        'service_token'  => env('ERP_SERVICE_TOKEN', ''),
        'service_secret' => env('ERP_SERVICE_SECRET', ''),

        // Pacing (ms) entre asientos en importación masiva para no saturar el ERP.
        // Subir si hay 429; bajar a 0 para máxima velocidad si el ERP aguanta.
        'asiento_delay_ms' => (int) env('IMPORT_ASIENTO_DELAY_MS', 250),

        // ─── CRM Federation v1.0 F4 ─────────────────────────────────────
        // Feature flag para outbound sync Lead/Opportunity al CRM del ERP.
        // Default OFF — activar solo cuando ingestion_token está emitido +
        // company_id confirmado del lado ERP.
        //
        // El ingestion_token es un Personal Access Token de Sanctum con
        // ability `crm:ingest`. Se emite en el ERP via:
        //   php artisan crm:issue-ingestion-token
        //     --company=<slug> --source=pep --label=production
        //
        // Spec: erp2026/docs/plans/v1.0-F4-dsf-pep-spec.md
        'crm' => [
            'enabled'         => filter_var(env('ERP_CRM_SYNC_ENABLED', false), FILTER_VALIDATE_BOOLEAN),
            'ingestion_token' => env('ERP_INGESTION_TOKEN'),
            'company_id'      => env('ERP_COMPANY_ID'),
            'api_version'     => env('ERP_API_VERSION', '2026-05'),
            'source_slug'     => 'pep',
        ],
    ],

    'inversiones' => [
        'tipo_cambio_usd' => (float) env('TIPO_CAMBIO_USD', 500),
    ],

    'credid' => [
        'url' => env('CREDID_API_URL', 'https://ws.credid.net/wstest/api/reporte'),
        'token' => env('CREDID_API_TOKEN', ''),
    ],

    'dsf' => [
        'url' => env('DSF_API_URL', ''),
        'token' => env('DSF_API_TOKEN', ''),
    ],

    'evolution' => [
        'url' => env('EVOLUTION_API_URL', ''),
        'key' => env('EVOLUTION_API_KEY', ''),
        'instance' => env('EVOLUTION_INSTANCE', ''),
    ],

    'tenor' => [
        'key' => env('TENOR_API_KEY', ''),
    ],

    /*
    |--------------------------------------------------------------------------
    | SSRF Protection: Allowed Integration Domains
    |--------------------------------------------------------------------------
    |
    | Whitelist of domains that external integrations are allowed to connect to.
    | Comma-separated list in .env. If empty, only .env-sourced URLs are allowed.
    |
    */
    'allowed_integration_domains' => array_filter(
        explode(',', env('ALLOWED_INTEGRATION_DOMAINS', ''))
    ),

    'jira' => [
        'url'         => env('JIRA_URL'),
        'email'       => env('JIRA_EMAIL'),
        'token'       => env('JIRA_API_TOKEN'),
        'project_key' => env('JIRA_PROJECT_KEY', 'PJ'),
    ],

];
