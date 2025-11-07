// 'use client' indica que es un Componente de Cliente, lo que permite el uso de interactividad y estado.
'use client';

import React from 'react';
import {
  List,
  MessageCircle,
  MessagesSquare,
  Paperclip,
  Send,
  Smile,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  chatMessages,
  internalNotes,
  type ChatMessage,
  type InternalNote,
} from '@/lib/data'; // Importamos los datos de ejemplo.

/**
 * Componente para renderizar la lista de mensajes de un chat.
 * @param {{ messages: ChatMessage[] }} props - Los mensajes a renderizar.
 */
function ChatMessagesList({ messages }: { messages: ChatMessage[] }) {
  // Si no hay mensajes, muestra un mensaje indicándolo.
  if (messages.length === 0) {
    return <div className="p-4 text-center text-sm text-muted-foreground">No hay mensajes en esta conversación.</div>
  }
  return (
    <div className="space-y-4">
      {messages.map((msg, index) => (
        <div
          key={index}
          className={`flex items-start gap-3 ${
            msg.senderType === 'agent' ? 'justify-end' : '' // Alinea a la derecha si el mensaje es de un agente.
          }`}
        >
          {/* Muestra el avatar a la izquierda si el remitente es el cliente. */}
          {msg.senderType === 'client' && (
            <Avatar className="h-9 w-9 border">
              <AvatarImage src={msg.avatarUrl} />
              <AvatarFallback>{msg.senderName.charAt(0)}</AvatarFallback>
            </Avatar>
          )}
          <div
            className={`flex flex-col ${
              msg.senderType === 'agent' ? 'items-end' : 'items-start'
            }`}
          >
            <div
              className={`max-w-md rounded-lg px-3 py-2 ${
                msg.senderType === 'agent'
                  ? 'bg-primary text-primary-foreground' // Estilo para mensajes de agente.
                  : 'bg-muted' // Estilo para mensajes de cliente.
              }`}
            >
              <p className="text-sm">{msg.text}</p>
            </div>
            <span className="mt-1 text-xs text-muted-foreground">
              {msg.time}
            </span>
          </div>
          {/* Muestra el avatar a la derecha si el remitente es el agente. */}
          {msg.senderType === 'agent' && (
            <Avatar className="h-9 w-9 border">
              <AvatarImage src={msg.avatarUrl} />
              <AvatarFallback>{msg.senderName.charAt(0)}</AvatarFallback>
            </Avatar>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Componente para renderizar la lista de notas internas de una conversación.
 * @param {{ notes: InternalNote[] }} props - Las notas a renderizar.
 */
function InternalNotesList({ notes }: { notes: InternalNote[] }) {
   if (notes.length === 0) {
    return <div className="p-4 text-center text-sm text-muted-foreground">No hay comentarios en esta conversación.</div>
  }
  return (
    <div className="space-y-4">
      {notes.map((note, index) => (
        <div key={index} className="flex items-start gap-3">
          <Avatar className="h-9 w-9 border">
            <AvatarImage src={note.avatarUrl} />
            <AvatarFallback>{note.senderName.charAt(0)}</AvatarFallback>
          </Avatar>
          {/* Las notas internas tienen un estilo distintivo para diferenciarlas de los mensajes. */}
          <div className="flex-1 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-semibold">{note.senderName}</p>
            <p className="mt-1 text-sm text-gray-700">{note.text}</p>
            <p className="mt-2 text-xs text-muted-foreground">{note.time}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Componente que combina mensajes de chat y notas internas, y los muestra en orden cronológico.
 * @param {{ messages: ChatMessage[], notes: InternalNote[] }} props - Los mensajes y notas.
 */
function CombinedChatList({
  messages,
  notes,
}: {
  messages: ChatMessage[];
  notes: InternalNote[];
}) {
  // Función auxiliar para convertir una cadena de tiempo (ej: "10:15 AM") en un objeto Date para poder ordenar.
  const parseTime = (timeStr: string) => {
    const today = new Date();
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);

    if (hours === 12) {
      hours = modifier === 'AM' ? 0 : 12;
    } else {
      hours = modifier === 'PM' ? hours + 12 : hours;
    }

    return new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      hours,
      minutes
    );
  };

  // Combinamos los arrays de mensajes y notas, añadiendo un campo 'type' y un objeto 'date' para ordenar.
  const combined = [
    ...messages.map((m) => ({ ...m, type: 'message', date: parseTime(m.time) })),
    ...notes.map((n) => ({ ...n, type: 'note', date: parseTime(n.time) })),
  ];

  // Ordenamos el array combinado por fecha/hora.
  combined.sort((a, b) => a.date.getTime() - b.date.getTime());

  if (combined.length === 0) {
    return <div className="p-4 text-center text-sm text-muted-foreground">No hay actividad en esta conversación.</div>
  }

  return (
    <div className="space-y-4">
      {/* Iteramos sobre el array combinado y renderizamos cada item según su tipo. */}
      {combined.map((item, index) => {
        if (item.type === 'message') {
          const msg = item as ChatMessage & { date: Date };
          return <ChatMessagesList key={`msg-${index}`} messages={[msg]} />;
        } else {
          const note = item as InternalNote & { date: Date };
          return <InternalNotesList key={`note-${index}`} notes={[note]} />;
        }
      })}
    </div>
  );
}

/**
 * Componente principal del panel de chat de un caso.
 * Filtra los mensajes y notas relevantes y los muestra en pestañas.
 * @param {{ conversationId: string }} props - El ID de la conversación a mostrar.
 */
export function CaseChat({ conversationId }: { conversationId: string }) {
  // Filtramos los mensajes y notas que pertenecen a la conversación actual.
  const relevantMessages = chatMessages.filter(
    (msg) => msg.conversationId === conversationId
  );
  const relevantNotes = internalNotes.filter(
    (note) => note.conversationId === conversationId
  );

  return (
    <div className="flex h-full flex-col p-2">
        <Tabs defaultValue="all" className="flex flex-1 flex-col">
          {/* Lista de pestañas para cambiar entre vistas. */}
          <TabsList className="mx-2 mt-2">
            <TabsTrigger value="all" className="gap-1">
              <List className="h-4 w-4" />
              Todo
            </TabsTrigger>
            <TabsTrigger value="messages" className="gap-1">
              <MessagesSquare className="h-4 w-4" />
              Mensajes
            </TabsTrigger>
            <TabsTrigger value="comments" className="gap-1">
              <MessageCircle className="h-4 w-4" />
              Comentarios
            </TabsTrigger>
          </TabsList>
          {/* Contenido de la pestaña "Todo". */}
          <TabsContent
            value="all"
            className="flex-1 space-y-4 overflow-y-auto p-4"
          >
            <CombinedChatList
              messages={relevantMessages}
              notes={relevantNotes}
            />
          </TabsContent>
          {/* Contenido de la pestaña "Mensajes". */}
          <TabsContent
            value="messages"
            className="flex-1 space-y-4 overflow-y-auto p-4"
          >
            <ChatMessagesList messages={relevantMessages} />
          </TabsContent>
          {/* Contenido de la pestaña "Comentarios". */}
          <TabsContent
            value="comments"
            className="flex-1 space-y-4 overflow-y-auto p-4"
          >
            <InternalNotesList notes={relevantNotes} />
          </TabsContent>

          {/* Área para escribir y enviar un nuevo mensaje. */}
          <div className="border-t bg-background p-2">
            <div className="relative">
              <Textarea
                placeholder="Escribe tu mensaje..."
                className="pr-20"
                rows={2}
              />
              <div className="absolute bottom-2 right-2 flex items-center gap-1">
                <Button variant="ghost" size="icon">
                  <Paperclip className="h-4 w-4" />
                  <span className="sr-only">Adjuntar</span>
                </Button>
                <Button variant="ghost" size="icon">
                  <Smile className="h-4 w-4" />
                  <span className="sr-only">Emoji</span>
                </Button>
                <Button size="icon">
                  <Send className="h-4 w-4" />
                  <span className="sr-only">Enviar</span>
                </Button>
              </div>
            </div>
          </div>
        </Tabs>
    </div>
  );
}
