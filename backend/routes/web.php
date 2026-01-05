<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// Formulario público de registro de leads
// Ruta amigable para compartir en redes sociales
Route::get('/registro', function () {
    return response(file_get_contents(resource_path('lead-form.html')))
        ->header('Content-Type', 'text/html');
});
