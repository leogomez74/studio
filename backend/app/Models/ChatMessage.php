<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ChatMessage extends Model
{
    protected $fillable = [
        'conversation_id',
        'sender_type',
        'sender_name',
        'text',
        'message_type',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Scope para filtrar mensajes por conversación
     */
    public function scopeForConversation($query, $conversationId)
    {
        return $query->where('conversation_id', $conversationId)
                     ->orderBy('created_at', 'asc');
    }

    /**
     * Scope para filtrar mensajes por tipo
     */
    public function scopeOfType($query, $type)
    {
        return $query->where('message_type', $type);
    }
}
