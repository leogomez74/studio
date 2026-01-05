<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// Ruta oculta para formulario de registro de leads
// Acceso: /Xk9mP2nL
Route::get('/Xk9mP2nL', function () {
    return response(file_get_contents(public_path('lead-form.html')))
        ->header('Content-Type', 'text/html');
});
