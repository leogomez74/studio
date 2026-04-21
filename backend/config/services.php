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
