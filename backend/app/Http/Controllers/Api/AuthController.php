<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    //REGISTRO DE USUARIO
    public function register(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8|max:20',
        ]);
        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password)
        ]);

        Auth::login($user);

        return response()->json(['message' => 'Usuario registrado exitosamente','user'=> $user], 201);
    }
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|string|email',
            'password' => 'required|string',
        ]);

        if(!Auth::attempt($request->only('email','password'))){
            throw ValidationException::withMessages([
                'email' => ['Las credenciales son incorrectas,'],
                'password' => ['por favor verifique e intente de nuevo.']
            ]);
        }
        if($request->hasSession()){
            $request->session()->regenerate();
        }

        return response()->json(['message' => 'Usuario logueado exitosamente','user'=> Auth::user()], 200);
    }

    public function logout(Request $request)
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Usuario deslogueado exitosamente'], 200);
    }
    public function me(Request $request)
    {
        return response()->json(['user' => Auth::user()], 200);
    }
}
