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

// Cuestionario público (crédito y servicios legales)
Route::get('/publico', function () {
    return response(file_get_contents(resource_path('question-publico.html')))
        ->header('Content-Type', 'text/html');
});

// Cuestionario sector privado
Route::get('/privado', function () {
    return response(file_get_contents(resource_path('question-privado.html')))
        ->header('Content-Type', 'text/html');
});

// Cuestionario independientes / negocio propio
Route::get('/propio', function () {
    return response(file_get_contents(resource_path('question-propio.html')))
        ->header('Content-Type', 'text/html');
});

// Cuestionario pensionados
Route::get('/pensionados', function () {
    return response(file_get_contents(resource_path('question-pensionados.html')))
        ->header('Content-Type', 'text/html');
});
