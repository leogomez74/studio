<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    use LogsActivity;
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
            $this->logActivity(
                'login_failed',
                'Auth',
                null,
                "Intento fallido: {$request->email}",
                [],
                $request
            );
            throw ValidationException::withMessages([
                'email' => ['Las credenciales son incorrectas,'],
                'password' => ['por favor verifique e intente de nuevo.']
            ]);
        }
        if($request->hasSession()){
            $request->session()->regenerate();
        }

        /** @var \App\Models\User $user */
        $user = Auth::user();
        $token = $user->createToken('auth_token')->plainTextToken;

        $this->logActivity('login', 'Auth', null, "Login: {$user->email}", [], $request);

        return response()->json([
            'message' => 'Usuario logueado exitosamente',
            'user' => $user,
            'token' => $token
        ], 200);
    }

    public function logout(Request $request)
    {
        $this->logActivity('logout', 'Auth', null, "Logout: {$request->user()->email ?? ''}", [], $request);

        // Revocar el token actual de Sanctum
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Usuario deslogueado exitosamente'], 200);
    }
    public function me(Request $request)
    {
        $user = Auth::user();
        $user->load('role');
        return response()->json(['user' => $user], 200);
    }
}
