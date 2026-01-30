// Importamos los componentes e íconos necesarios para la página de comunicaciones.
// 'use client' indica que es un Componente de Cliente, lo que permite usar estado y efectos.
"use client";
import React, { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PermissionButton } from "@/components/PermissionButton";
import { ProtectedPage } from "@/components/ProtectedPage";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Send,
  Search,
  PlusCircle,
  MessageSquare,
  Users,
  Inbox,
  Star,
  Archive,
  FileText,
  Clock,
  Paperclip,
  Smile,
  MessageCircle,
  MessagesSquare,
  List,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChatMessage,
  InternalNote,
  internalNotes,
  type Lead,
} from "@/lib/data"; // Importamos tipos de datos.
import { cn } from "@/lib/utils"; // Utilidad para combinar clases de Tailwind.
import Link from "next/link";
import api from "@/lib/axios";
import { useToast } from "@/hooks/use-toast";

// Tipo para representar una conversación
type Conversation = {
  id: string;
  name: string;
  avatarUrl: string;
  caseId: string;
  lastMessage: string;
  time: string;
  status: 'Abierto' | 'Resuelto';
  email?: string;
};

/**
 * Esta es la función principal que define la página de Comunicaciones.
 * Presenta un diseño de tres columnas: cajas de entrada, lista de conversaciones y el chat activo.
 */
export default function CommunicationsPage() {
  const { toast } = useToast();

  // Estados para las conversaciones
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(false);

  // Estados para los mensajes
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Estados para envío de mensajes
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  // Cargar conversaciones (leads) desde la API
  useEffect(() => {
    const fetchConversations = async () => {
      setLoadingConversations(true);
      try {
        const response = await api.get('/api/leads');
        const leadsList = Array.isArray(response.data) ? response.data : response.data.data || [];

        // Convertir leads a conversaciones
        const conversationsFromLeads: Conversation[] = leadsList.map((lead: Lead) => ({
          id: String(lead.id),
          name: lead.name || 'Sin nombre',
          avatarUrl: '',
          caseId: String(lead.id),
          lastMessage: 'Conversación con lead',
          time: 'Ahora',
          status: 'Abierto' as const,
          email: lead.email,
        }));

        setConversations(conversationsFromLeads);

        // Seleccionar la primera conversación por defecto
        if (conversationsFromLeads.length > 0 && !selectedConversation) {
          setSelectedConversation(conversationsFromLeads[0]);
        }
      } catch (error) {
        console.error('Error cargando conversaciones:', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar las conversaciones.",
          variant: "destructive",
        });
      } finally {
        setLoadingConversations(false);
      }
    };

    fetchConversations();
  }, []);

  // Cargar mensajes cuando se selecciona una conversación
  useEffect(() => {
    if (!selectedConversation) return;

    const fetchMessages = async () => {
      setLoadingMessages(true);
      try {
        const response = await api.get('/api/chat-messages', {
          params: { conversation_id: selectedConversation.id }
        });

        if (response.data.success && Array.isArray(response.data.data)) {
          const mappedMessages: ChatMessage[] = response.data.data.map((msg: any) => ({
            id: String(msg.id),
            conversationId: msg.conversation_id,
            senderType: msg.sender_type,
            senderName: msg.sender_name || 'Sistema',
            avatarUrl: '',
            text: msg.text,
            time: new Date(msg.created_at).toLocaleTimeString('es-ES', {
              hour: '2-digit',
              minute: '2-digit'
            }),
          }));
          setMessages(mappedMessages);
        }
      } catch (error) {
        console.error('Error cargando mensajes:', error);
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [selectedConversation]);

  // Enviar un nuevo mensaje
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    setSendingMessage(true);
    try {
      const response = await api.post('/api/chat-messages', {
        conversation_id: selectedConversation.id,
        sender_type: 'agent',
        sender_name: 'Agente', // TODO: Obtener del usuario actual
        text: newMessage,
        message_type: 'text',
      });

      if (response.data.success) {
        // Agregar el mensaje a la lista
        const newMsg: ChatMessage = {
          id: String(response.data.data.id),
          conversationId: selectedConversation.id,
          senderType: 'agent',
          senderName: 'Agente',
          avatarUrl: '',
          text: newMessage,
          time: new Date().toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
          }),
        };

        setMessages([...messages, newMsg]);
        setNewMessage('');

        toast({
          title: "Mensaje enviado",
          description: "El mensaje ha sido enviado correctamente.",
        });
      }
    } catch (error: any) {
      console.error('Error enviando mensaje:', error);
      toast({
        title: "Error",
        description: error?.response?.data?.message || "No se pudo enviar el mensaje.",
        variant: "destructive",
      });
    } finally {
      setSendingMessage(false);
    }
  };

  /**
   * Función para obtener la ruta correcta al detalle de un lead.
   */
  const getLeadPath = (leadId: string) => {
    return `/dashboard/leads/${leadId}`;
  };


  return (
    <ProtectedPage module="comunicaciones">
      <div className="grid grid-cols-1 md:grid-cols-[260px_340px_1fr] h-[calc(100vh-8rem)] gap-2">
      {/* Columna 1: Barra lateral de Cajas de Entrada (Inboxes) */}
      <Card className="hidden md:flex flex-col">
        <CardContent className="p-4 space-y-6">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
              <Inbox className="h-4 w-4" /> Cajas de Entrada
            </h3>
            <Button variant="ghost" className="w-full justify-start">
              <MessageSquare className="mr-2 h-4 w-4" />
              Todas las conversaciones
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              <Users className="mr-2 h-4 w-4" />
              Asignadas a mí
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              <Star className="mr-2 h-4 w-4" />
              Importantes
            </Button>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
              <Archive className="h-4 w-4" /> Archivo
            </h3>
            <Button variant="ghost" className="w-full justify-start">
              <Clock className="mr-2 h-4 w-4" />
              Pendientes
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              <FileText className="mr-2 h-4 w-4" />
              Cerradas
            </Button>
          </div>
          <PermissionButton module="comunicaciones" action="create" variant="outline" className="w-full">
            <PlusCircle className="mr-2 h-4 w-4" />
            Nueva Conversación
          </PermissionButton>
        </CardContent>
      </Card>

      {/* Columna 2: Lista de Conversaciones */}
      <Card className="flex flex-col">
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar conversación..." className="pl-8" />
          </div>
        </div>
        <CardContent className="p-0 flex-1 overflow-y-auto">
          {loadingConversations ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Cargando conversaciones...</div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">No hay conversaciones disponibles</div>
          ) : (
            <nav className="space-y-1">
              {/* Iteramos sobre las conversaciones para mostrar cada una en la lista. */}
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  className={cn(
                    "w-full text-left p-3 hover:bg-muted/50 transition-colors flex items-start gap-3",
                    selectedConversation?.id === conv.id && "bg-muted"
                  )}
                >
                  <Avatar className="h-10 w-10 border">
                    <AvatarImage src={conv.avatarUrl} />
                    <AvatarFallback>{conv.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <h4 className="font-semibold text-sm">{conv.name}</h4>
                      <span className="text-xs text-muted-foreground">
                        {conv.time}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {conv.lastMessage}
                    </p>
                  </div>
                </button>
              ))}
            </nav>
          )}
        </CardContent>
      </Card>

      {/* Columna 3: Panel del Chat Activo */}
      <Card className="flex flex-col">
        {!selectedConversation ? (
          <div className="flex-1 flex items-center justify-center p-8 text-center text-muted-foreground">
            Selecciona una conversación para comenzar
          </div>
        ) : (
          <>
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border">
                  <AvatarImage src={selectedConversation.avatarUrl} />
                  <AvatarFallback>
                    {selectedConversation.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold">
                    <Link href={getLeadPath(selectedConversation.id)} className="hover:underline">
                        {selectedConversation.name}
                    </Link>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Lead ID: {selectedConversation.caseId}
                  </p>
                </div>
              </div>
              <Badge
                variant={
                  selectedConversation.status === "Abierto"
                    ? "default"
                    : "secondary"
                }
              >
                {selectedConversation.status}
              </Badge>
            </div>
        <Tabs defaultValue="all" className="flex-1 flex flex-col">
            <TabsList className="mx-4 mt-4">
                <TabsTrigger value="all" className="gap-1">
                    <List className="h-4 w-4"/>
                    Todo
                </TabsTrigger>
                <TabsTrigger value="messages" className="gap-1">
                    <MessagesSquare className="h-4 w-4"/>
                    Mensajes
                </TabsTrigger>
                <TabsTrigger value="comments" className="gap-1">
                    <MessageCircle className="h-4 w-4"/>
                    Comentarios
                </TabsTrigger>
            </TabsList>
            {/* Pestaña para mostrar mensajes y notas combinados y ordenados. */}
            <TabsContent value="all" className="flex-1 p-4 space-y-4 overflow-y-auto">
                 {loadingMessages ? (
                   <div className="p-4 text-center text-sm text-muted-foreground">Cargando mensajes...</div>
                 ) : (
                   <CombinedChatList
                      messages={messages}
                      notes={internalNotes.filter((note: InternalNote) => note.conversationId === selectedConversation.id)}
                   />
                 )}
            </TabsContent>
            {/* Pestaña para mostrar solo los mensajes del chat. */}
            <TabsContent value="messages" className="flex-1 p-4 space-y-4 overflow-y-auto">
                 {loadingMessages ? (
                   <div className="p-4 text-center text-sm text-muted-foreground">Cargando mensajes...</div>
                 ) : (
                   <ChatMessagesList messages={messages} />
                 )}
            </TabsContent>
            {/* Pestaña para mostrar solo las notas internas. */}
            <TabsContent value="comments" className="flex-1 p-4 space-y-4 overflow-y-auto">
                 <InternalNotesList notes={internalNotes.filter((note: InternalNote) => note.conversationId === selectedConversation.id)} />
            </TabsContent>
        
            {/* Área para escribir y enviar un nuevo mensaje. */}
            <div className="p-4 border-t bg-background">
              <div className="relative">
                <Textarea
                  placeholder="Escribe tu mensaje..."
                  className="pr-20"
                  rows={2}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  disabled={sendingMessage}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !sendingMessage) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <div className="absolute bottom-2 right-2 flex items-center gap-2">
                  <Button variant="ghost" size="icon">
                    <Paperclip className="h-4 w-4" />
                    <span className="sr-only">Adjuntar</span>
                  </Button>
                  <Button variant="ghost" size="icon">
                    <Smile className="h-4 w-4" />
                    <span className="sr-only">Emoji</span>
                  </Button>
                  <Button size="icon" onClick={handleSendMessage} disabled={sendingMessage || !newMessage.trim()}>
                    <Send className="h-4 w-4" />
                    <span className="sr-only">Enviar</span>
                  </Button>
                </div>
              </div>
            </div>
        </Tabs>
          </>
        )}
      </Card>
    </div>
    </ProtectedPage>
  );
}

/**
 * Componente para renderizar la lista de mensajes de un chat.
 * @param {{ messages: ChatMessage[] }} props - Los mensajes a renderizar.
 */
function ChatMessagesList({ messages }: { messages: ChatMessage[] }) {
    return (
        <div className="space-y-4">
            {messages.map((msg, index) => (
                <div key={index} className={`flex items-start gap-3 ${msg.senderType === 'agent' ? 'justify-end' : ''}`}>
                    {/* Muestra el avatar a la izquierda si el remitente es el cliente. */}
                    {msg.senderType === 'client' && (
                    <Avatar className="h-9 w-9 border">
                        <AvatarImage src={msg.avatarUrl} />
                        <AvatarFallback>{msg.senderName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    )}
                    <div className={`flex flex-col ${msg.senderType === 'agent' ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-md rounded-lg px-3 py-2 ${msg.senderType === 'agent' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        <p className="text-sm">{msg.text}</p>
                    </div>
                    <span className="text-xs text-muted-foreground mt-1">{msg.time}</span>
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
 * Componente para renderizar la lista de notas internas de un chat.
 * @param {{ notes: InternalNote[] }} props - Las notas a renderizar.
 */
function InternalNotesList({ notes }: { notes: InternalNote[] }) {
    return (
        <div className="space-y-4">
            {notes.map((note, index) => (
                <div key={index} className="flex items-start gap-3">
                    <Avatar className="h-9 w-9 border">
                        <AvatarImage src={note.avatarUrl} />
                        <AvatarFallback>{note.senderName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    {/* Las notas internas tienen un fondo de color ámbar para distinguirlas. */}
                    <div className="flex-1 bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-sm font-semibold">{note.senderName}</p>
                        <p className="text-sm text-gray-700 mt-1">{note.text}</p>
                        <p className="text-xs text-muted-foreground mt-2">{note.time}</p>
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
  // Combina mensajes y notas, asignando un campo 'type' para distinguirlos
  const combined = [
    ...messages.map((msg) => ({
      ...msg,
      type: "message" as const,
      timestamp: msg.time,
    })),
    ...notes.map((note) => ({
      ...note,
      type: "note" as const,
      timestamp: note.time,
    })),
  ];

  // Ordena por timestamp (asumiendo formato HH:MM, puedes ajustar si tienes fecha completa)
  combined.sort((a, b) => {
    // Si tienes fecha completa, usa new Date(a.timestamp) - new Date(b.timestamp)
    return a.timestamp.localeCompare(b.timestamp);
  });

  return (
    <div className="space-y-4">
      {combined.map((item, index) =>
        item.type === "message" ? (
          <ChatMessagesList key={`msg-${index}`} messages={[item]} />
        ) : (
          <InternalNotesList key={`note-${index}`} notes={[item]} />
        )
      )}
    </div>
  );
}

