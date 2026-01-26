<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChatMessage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ChatMessageController extends Controller
{
    /**
     * Obtiene todos los mensajes de una conversación específica
     */
    public function index(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'conversation_id' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Conversation ID es requerido',
                'errors' => $validator->errors()
            ], 422);
        }

        $messages = ChatMessage::forConversation($request->conversation_id)->get();

        return response()->json([
            'success' => true,
            'data' => $messages,
        ], 200);
    }

    /**
     * Crea un nuevo mensaje en una conversación
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'conversation_id' => 'required|string',
            'sender_type' => 'required|in:client,agent,system',
            'sender_name' => 'nullable|string',
            'text' => 'required|string',
            'message_type' => 'nullable|string',
            'metadata' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos de validación incorrectos',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $message = ChatMessage::create($validator->validated());

            return response()->json([
                'success' => true,
                'message' => 'Mensaje enviado exitosamente',
                'data' => $message,
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al crear mensaje: ' . $e->getMessage()
            ], 500);
        }
    }
}
