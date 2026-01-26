<?php

// Configuración CORS totalmente abierta.
// ADVERTENCIA: Esto desactiva cualquier restricción de origen y deja la API expuesta.
// No usar en producción. Además, al devolver '*' para origen no se pueden usar credenciales.
// Si necesitas cookies / Authorization con credenciales, debes listar orígenes explícitos.
return [
    // Abarcar cualquier ruta (incluye api, auth, etc.)
    'paths' => ['*'],

    // Permitir cualquier método HTTP siempre  'allowed_methods' => ['*'],
    'allowed_methods' => ['*'],

    // Permitir cualquier origen siempre debe ser 'allowed_origins' => ['*'],
    'allowed_origins' => ['*'],

    'allowed_origins_patterns' => [],

    // Permitir cualquier header
    'allowed_headers' => ['*'],

    // No exponemos headers adicionales
    'exposed_headers' => [],

    'max_age' => 0,

    // Debe ser false si se usa '*' (el navegador bloquea credenciales con '*')
    'supports_credentials' => true,
];
