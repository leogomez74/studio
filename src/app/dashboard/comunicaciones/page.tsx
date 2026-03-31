// Importamos los componentes e íconos necesarios para la página de comunicaciones.
// 'use client' indica que es un Componente de Cliente, lo que permite usar estado y efectos.
"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import DOMPurify from 'dompurify';
import { useRouter, useSearchParams } from "next/navigation";
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
  Hash,
  AtSign,
  CornerDownLeft,
  ExternalLink,
  Loader2,
  ArrowLeft,
  X,
  UserPlus,
  Image as ImageIcon,
} from "lucide-react";
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import GifPicker, { TenorImage } from 'gif-picker-react';
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChatMessage,
  InternalNote,
  internalNotes,
  type Lead,
} from "@/lib/data";
import { cn } from "@/lib/utils";
import Link from "next/link";
import api from "@/lib/axios";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth-guard";
import { Separator } from "@/components/ui/separator";

// ---- Comment types ----
interface CommentUser { id: number; name: string; }
interface CommentReply { id: number; body: string; user: CommentUser; created_at: string; }
interface InternalComment {
  id: number; body: string; user: CommentUser; user_id: number;
  commentable_type: string; commentable_id: number;
  entity_reference?: string; replies?: CommentReply[];
  created_at: string; archived_at?: string | null;
  comment_type?: string; metadata?: Record<string, any> | null;
}

function VerificationCard({
  metadata,
  type,
  onRefresh
}: {
  metadata: Record<string, any>;
  type: 'request' | 'response';
  onRefresh?: () => void;
}) {
  const [responding, setResponding] = useState(false);
  const [notes, setNotes] = useState('');
  const { toast } = useToast();

  const handleRespond = async (status: 'approved' | 'rejected') => {
    setResponding(true);
    try {
      await api.patch(`/api/payment-verifications/${metadata.verification_id}/respond`, {
        status,
        notes: notes || undefined,
      });
      toast({ 
        title: status === 'approved' ? 'Verificado' : 'Rechazado', 
        description: status === 'approved' ? 'Abono marcado como verificado.' : 'Abono marcado como no aplicado.' 
      });
      if (onRefresh) onRefresh();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Error al responder.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setResponding(false);
    }
  };

  const isApproved = metadata.status === 'approved';
  const isResponse = type === 'response';
  const isPending = metadata.status === 'pending';

  return (
    <div className={cn(
      "rounded-lg border p-4 text-sm w-full max-w-md",
      isResponse || !isPending
        ? (isApproved || metadata.status === 'approved' ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900')
        : 'bg-card border-border text-foreground'
    )}>
      <p className="font-bold mb-2 flex items-center gap-2 text-lg">
        {isResponse || !isPending 
          ? (isApproved || metadata.status === 'approved' ? '✅ Verificado' : '❌ No Aplicado') 
          : '🏦 Verificación'}
      </p>
      
      <div className="space-y-1.5 opacity-90">
        <p><span className="font-semibold text-xs opacity-70">Referencia:</span> {metadata.credit_reference}</p>
        <p><span className="font-semibold text-xs opacity-70">Tipo:</span> {metadata.payment_type_label}</p>
        <p className="font-black text-xl mt-2 border-y py-2 border-current/10">₡{Number(metadata.monto || 0).toLocaleString('es-CR')}</p>
        {metadata.client_name && <p className="text-sm mt-2 font-medium italic opacity-80">Cliente: {metadata.client_name}</p>}
        {metadata.notes && (
          <div className="mt-3 bg-black/5 p-2 rounded text-xs italic">
            <span className="font-semibold block mb-1 not-italic opacity-60 uppercase text-[10px]">Notas:</span>
            {metadata.notes}
          </div>
        )}
      </div>

      {type === 'request' && isPending && (
        <div className="mt-5 space-y-3 border-t pt-4 border-border/50">
          <textarea
            placeholder="Añadir notas de verificación..."
            className="w-full bg-background border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 min-h-[70px] resize-none"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="flex gap-3">
            <button
              onClick={() => handleRespond('approved')}
              disabled={responding}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-black py-3 rounded-md shadow-sm disabled:opacity-50 transition-all active:scale-95 text-base"
            >
              ✅ VERIFICAR
            </button>
            <button
              onClick={() => handleRespond('rejected')}
              disabled={responding}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black py-3 rounded-md shadow-sm disabled:opacity-50 transition-all active:scale-95 text-base"
            >
              ❌ RECHAZAR
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const TENOR_API_KEY = process.env.NEXT_PUBLIC_TENOR_API_KEY ?? '';

const COMMENT_ENTITY_MAP: Record<string, { label: string; route: string; color: string; apiType: string }> = {
  'App\\Models\\Credit':      { label: 'Crédito',     route: '/dashboard/creditos',      color: 'bg-emerald-100 text-emerald-700', apiType: 'credit' },
  'App\\Models\\Opportunity': { label: 'Oportunidad', route: '/dashboard/oportunidades', color: 'bg-blue-100 text-blue-700',       apiType: 'opportunity' },
  'App\\Models\\Lead':        { label: 'Lead',        route: '/dashboard/leads',          color: 'bg-violet-100 text-violet-700',  apiType: 'lead' },
  'App\\Models\\Client':      { label: 'Cliente',     route: '/dashboard/leads',          color: 'bg-amber-100 text-amber-700',    apiType: 'client' },
  'App\\Models\\Analisis':    { label: 'Análisis',    route: '/dashboard/analizados',     color: 'bg-cyan-100 text-cyan-700',      apiType: 'analisis' },
  'App\\Models\\User':        { label: 'Directo',     route: '',                          color: 'bg-orange-100 text-orange-700',  apiType: 'direct' },
};
const AVATAR_COLORS = ['bg-blue-500','bg-emerald-500','bg-violet-500','bg-amber-500','bg-rose-500','bg-cyan-500','bg-indigo-500','bg-teal-500'];
function getInitials(n: string) { return n.split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase(); }
function getAvatarColor(id: number) { return AVATAR_COLORS[id % AVATAR_COLORS.length]; }
function relativeTime(d: string) { const diff=Date.now()-new Date(d).getTime(); const m=Math.floor(diff/60000); const h=Math.floor(m/60); const dy=Math.floor(h/24); if(m<1)return'ahora'; if(m<60)return`${m}m`; if(h<24)return`${h}h`; if(dy===1)return'ayer'; return`${dy}d`; }
function getEntityInfo(t: string) { return COMMENT_ENTITY_MAP[t] ?? { label:'Entidad', route:'/dashboard', color:'bg-gray-100 text-gray-700', apiType:'' }; }
function renderBody(body: string) {
  const html = body
    .replace(/\[GIF\]\(([^)]+)\)/g, (_, url: string) => `<img src="${url}" alt="GIF" class="rounded-lg max-w-[220px] max-h-[160px] object-cover mt-1 block" loading="lazy" />`)
    .replace(/[@#]\[([^\]]+)\]\(\w+:\d+\)/g, (_, l: string) => `<span class="font-semibold text-primary">${l}</span>`);
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: ['span', 'img', 'b', 'i', 'em', 'strong', 'br'], ALLOWED_ATTR: ['class', 'src', 'alt', 'loading'] });
}

/** Clean body for preview: strip mentions, show "GIF" instead of link */
function previewBody(body: string): string {
  return body
    .replace(/\[GIF\]\([^)]+\)/g, '🎞 GIF')
    .replace(/[@#]\[([^\]]+)\]\(\w+:\d+\)/g, (_, l: string) => l);
}

const NEW_ENTITY_TARGETS = [
  { key: 'credit',      label: 'Crédito' },
  { key: 'opportunity', label: 'Oportunidad' },
  { key: 'lead',        label: 'Lead' },
  { key: 'analisis',    label: 'Análisis' },
];

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  // --- Inbox view toggle ---
  const [activeInbox, setActiveInbox] = useState<'conversations' | 'comments' | 'assigned'>('conversations');
  const [selectedAssigned, setSelectedAssigned] = useState<InternalComment | null>(null);
  const [assignedComments, setAssignedComments] = useState<InternalComment[]>([]);

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

  // --- Comentarios internos ---
  const [commentsView, setCommentsView] = useState<'active' | 'archived'>('active');
  const [allComments, setAllComments] = useState<InternalComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [selectedThread, setSelectedThread] = useState<InternalComment | null>(null);
  const [threadComments, setThreadComments] = useState<InternalComment[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [commentSearch, setCommentSearch] = useState('');

  // --- Nuevo comentario ---
  const [composingNew, setComposingNew] = useState(false);
  const [newEntity, setNewEntity] = useState<{ type: string; id: number; label: string } | null>(null);
  const [newEntityPickerOpen, setNewEntityPickerOpen] = useState(false);
  const [newEntityStep, setNewEntityStep] = useState<'type' | 'search'>('type');
  const [newEntityType, setNewEntityType] = useState('');
  const [newEntitySearch, setNewEntitySearch] = useState('');
  const [newEntityResults, setNewEntityResults] = useState<any[]>([]);
  const [newEntityLoading, setNewEntityLoading] = useState(false);
  const [newText, setNewText] = useState('');
  const [newMentions, setNewMentions] = useState<{ type: string; id: number; label: string }[]>([]);
  const [sendingNew, setSendingNew] = useState(false);
  const [userList, setUserList] = useState<any[]>([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [userFilter, setUserFilter] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const newTextRef = useRef<HTMLTextAreaElement>(null);

  // --- Mensaje directo ---
  const [composingDirect, setComposingDirect] = useState(false);
  const [directRecipient, setDirectRecipient] = useState<any>(null);
  const [directSearch, setDirectSearch] = useState('');
  const [directText, setDirectText] = useState('');
  const [sendingDirect, setSendingDirect] = useState(false);

  // --- Emoji & GIF pickers ---
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [replyShowEmoji, setReplyShowEmoji] = useState(false);
  const [replyShowGif, setReplyShowGif] = useState(false);
  const [directShowEmoji, setDirectShowEmoji] = useState(false);
  const [directShowGif, setDirectShowGif] = useState(false);
  const emojiContainerRef = useRef<HTMLDivElement>(null);
  const gifContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/api/users').then((r) => setUserList(Array.isArray(r.data) ? r.data : r.data.data ?? [])).catch(() => {});
  }, []);

  const searchNewEntities = async (type: string, query: string) => {
    setNewEntityLoading(true);
    try {
      const ep: Record<string, string> = { credit: '/api/credits', opportunity: '/api/opportunities', lead: '/api/leads', analisis: '/api/analisis' };
      const res = await api.get(ep[type] || '/api/credits', { params: { search: query, per_page: 8 } });
      setNewEntityResults(Array.isArray(res.data) ? res.data : res.data.data ?? []);
    } catch { setNewEntityResults([]); } finally { setNewEntityLoading(false); }
  };

  const selectNewEntity = (entity: any) => {
    const ref: Record<string, (e: any) => string> = {
      credit: (e) => e.reference || `#${e.id}`,
      opportunity: (e) => e.id || `#${e.id}`,
      lead: (e) => e.cedula || e.name || `#${e.id}`,
      analisis: (e) => e.reference || `#${e.id}`,
    };
    const label = (ref[newEntityType] || ((e: any) => `#${e.id}`))(entity);
    const typeLabel = NEW_ENTITY_TARGETS.find((t) => t.key === newEntityType)?.label || newEntityType;
    setNewEntity({ type: newEntityType, id: entity.id, label: `${typeLabel}: ${label}` });
    setNewEntityPickerOpen(false);
    setNewEntityStep('type');
    setNewEntitySearch('');
    setTimeout(() => newTextRef.current?.focus(), 50);
  };

  const handleNewTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNewText(val);
    const pos = e.target.selectionStart || 0;
    setCursorPos(pos);
    const before = val.slice(0, pos);
    const atMatch = before.match(/@(\w*)$/);
    if (atMatch) { setUserFilter(atMatch[1].toLowerCase()); setShowUserDropdown(true); }
    else setShowUserDropdown(false);
  };

  const selectMentionUser = (u: any) => {
    const before = newText.slice(0, cursorPos);
    const atIdx = before.lastIndexOf('@');
    const updated = newText.slice(0, atIdx) + `@[${u.name}](user:${u.id}) ` + newText.slice(cursorPos);
    setNewText(updated);
    setNewMentions((prev) => [...prev.filter((m) => m.id !== u.id), { type: 'user', id: u.id, label: u.name }]);
    setShowUserDropdown(false);
    newTextRef.current?.focus();
  };

  const handleSendNew = async () => {
    if (!newText.trim() || !newEntity) return;
    setSendingNew(true);
    try {
      await api.post('/api/comments', {
        commentable_type: newEntity.type,
        commentable_id: newEntity.id,
        body: newText,
        mentions: newMentions,
      });
      setNewText('');
      setNewEntity(null);
      setNewMentions([]);
      setComposingNew(false);
      fetchAllComments(commentsView === 'archived');
    } catch { /* silent */ } finally { setSendingNew(false); }
  };

  // --- Send direct message ---
  const handleSendDirect = async () => {
    if (!directText.trim() || !directRecipient) return;
    setSendingDirect(true);
    try {
      await api.post('/api/comments', {
        commentable_type: 'direct',
        commentable_id: directRecipient.id,
        body: directText,
        mentions: [{ type: 'user', id: directRecipient.id, label: directRecipient.name }],
      });
      setDirectText('');
      setDirectRecipient(null);
      setComposingDirect(false);
      fetchAllComments(commentsView === 'archived');
    } catch { /* silent */ } finally { setSendingDirect(false); }
  };

  // --- Send GIF in context ---
  const handleSendGif = async (gif: TenorImage, context: 'new' | 'reply' | 'direct') => {
    const gifUrl = gif.url;
    if (!gifUrl) return;
    try {
      if (context === 'new' && newEntity) {
        await api.post('/api/comments', {
          commentable_type: newEntity.type,
          commentable_id: newEntity.id,
          body: `[GIF](${gifUrl})`,
          mentions: [],
        });
        fetchAllComments(commentsView === 'archived');
      } else if (context === 'reply' && selectedThread) {
        const info = getEntityInfo(selectedThread.commentable_type);
        await api.post('/api/comments', {
          commentable_type: info.apiType || selectedThread.commentable_type,
          commentable_id: selectedThread.commentable_id,
          body: `[GIF](${gifUrl})`,
        });
        fetchThreadComments(selectedThread);
        fetchAllComments(commentsView === 'archived');
      } else if (context === 'direct' && directRecipient) {
        await api.post('/api/comments', {
          commentable_type: 'direct',
          commentable_id: directRecipient.id,
          body: `[GIF](${gifUrl})`,
          mentions: [{ type: 'user', id: directRecipient.id, label: directRecipient.name }],
        });
        fetchAllComments(commentsView === 'archived');
      }
    } catch { /* silent */ }
    setShowGifPicker(false);
    setReplyShowGif(false);
    setDirectShowGif(false);
  };

  const filteredDirectUsers = userList.filter((u: any) =>
    (u.name?.toLowerCase().includes(directSearch.toLowerCase()) || u.email?.toLowerCase().includes(directSearch.toLowerCase())) && u.id !== user?.id
  ).slice(0, 8);

  const filteredMentionUsers = userList.filter((u: any) =>
    u.name?.toLowerCase().includes(userFilter) || u.email?.toLowerCase().includes(userFilter)
  ).slice(0, 6);

  const fetchAllComments = useCallback(async (archived = false) => {
    setLoadingComments(true);
    try {
      const res = await api.get('/api/comments/recent', { params: { limit: 50, archived } });
      const data: InternalComment[] = Array.isArray(res.data) ? res.data : res.data.data ?? [];

      const directGroups = new Map<number, InternalComment>();
      const entityGroups = new Map<string, InternalComment>();

      for (const c of data) {
        if (c.commentable_type === 'App\\Models\\User') {
          // Determinar quién es la otra persona
          const contactId = c.user_id === user?.id ? Number(c.commentable_id) : c.user_id;
          if (contactId === user?.id) continue;

          const existing = directGroups.get(contactId);
          if (!existing || new Date(c.created_at) > new Date(existing.created_at)) {
            const totalReplies = (existing?.replies?.length ?? 0) + (c.replies?.length ?? 0);
            const grouped = { ...c };
            if (totalReplies > 0) grouped.replies = Array(totalReplies).fill(null) as any;
            directGroups.set(contactId, grouped);
          }
        } else {
          // Agrupar también por entidad (Crédito, Lead, etc.)
          const entityKey = `${c.commentable_type}:${c.commentable_id}`;
          const existing = entityGroups.get(entityKey);
          if (!existing || new Date(c.created_at) > new Date(existing.created_at)) {
            entityGroups.set(entityKey, c);
          }
        }
      }

      const merged = [...entityGroups.values(), ...directGroups.values()]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setAllComments(merged);
    } catch { /* silent */ } finally { setLoadingComments(false); }
  }, [user?.id]);

  const fetchThreadComments = useCallback(async (comment: InternalComment) => {
    setSelectedThread(comment);
    setLoadingThread(true);
    try {
      const info = getEntityInfo(comment.commentable_type);
      let targetId = comment.commentable_id;

      // FIX CRÍTICO: Si es directo, el targetId debe ser la OTRA persona, no necesariamente el commentable_id
      if (info.apiType === 'direct') {
        targetId = comment.user_id === user?.id ? Number(comment.commentable_id) : comment.user_id;
      }

      const res = await api.get('/api/comments', {
        params: { 
          commentable_type: info.apiType || comment.commentable_type, 
          commentable_id: targetId 
        }
      });
      const data = Array.isArray(res.data) ? res.data : res.data.data ?? [];
      setThreadComments(data);
    } catch { /* silent */ } finally { setLoadingThread(false); }
  }, [user?.id]);

  useEffect(() => {
    if (activeInbox === 'comments') fetchAllComments(commentsView === 'archived');
    if (activeInbox === 'assigned') {
      api.get('/api/comments/recent', { params: { limit: 100 } }).then(res => {
        const data: InternalComment[] = Array.isArray(res.data) ? res.data : res.data.data ?? [];
        setAssignedComments(data.filter(c => c.comment_type === 'verification_request' && c.metadata?.status === 'pending'));
      }).catch(() => {});
    }
  }, [activeInbox, commentsView, fetchAllComments]);

  // Auto-open thread from URL params (notification click)
  useEffect(() => {
    const commentId = searchParams.get('comment_id');
    const type = searchParams.get('type');
    const entityId = searchParams.get('entity_id');
    if (commentId && type && entityId) {
      setActiveInbox('comments');
      // Fetch the specific thread
      const fakeComment: InternalComment = {
        id: Number(commentId),
        body: '',
        user: { id: 0, name: '' },
        user_id: 0,
        commentable_type: COMMENT_ENTITY_MAP[type]
          ? Object.keys(COMMENT_ENTITY_MAP).find(k => COMMENT_ENTITY_MAP[k].apiType === type) || type
          : type,
        commentable_id: Number(entityId),
        created_at: '',
      };
      // Map simple type to full class name for fetching
      const typeToClass: Record<string, string> = {
        credit: 'App\\Models\\Credit',
        opportunity: 'App\\Models\\Opportunity',
        lead: 'App\\Models\\Lead',
        client: 'App\\Models\\Client',
        analisis: 'App\\Models\\Analisis',
        direct: 'App\\Models\\User',
      };
      fakeComment.commentable_type = typeToClass[type] || type;
      fetchThreadComments(fakeComment);
      // Clean URL params
      router.replace('/dashboard/comunicaciones', { scroll: false });
    }
  }, [searchParams]);

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedThread) return;
    setSendingReply(true);
    try {
      const info = getEntityInfo(selectedThread.commentable_type);
      await api.post('/api/comments', {
        commentable_type: info.apiType || selectedThread.commentable_type,
        commentable_id: selectedThread.commentable_id,
        body: replyText,
      });
      setReplyText('');
      fetchThreadComments(selectedThread);
      fetchAllComments(commentsView === 'archived');
    } catch { /* silent */ } finally { setSendingReply(false); }
  };

  // Cargar conversaciones (leads) desde la API
  useEffect(() => {
    const fetchConversations = async () => {
      setLoadingConversations(true);
      try {
        const response = await api.get('/api/leads?all=true');
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
        sender_name: user?.name || 'Agente',
        text: newMessage,
        message_type: 'text',
      });

      if (response.data.success) {
        // Agregar el mensaje a la lista
        const newMsg: ChatMessage = {
          id: String(response.data.data.id),
          conversationId: selectedConversation.id,
          senderType: 'agent',
          senderName: user?.name || 'Agente',
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
          <div className="space-y-1">
            <h3 className="text-xs font-semibold flex items-center gap-2 text-muted-foreground uppercase px-2 mb-2">
              <Inbox className="h-3.5 w-3.5" /> Cajas de Entrada
            </h3>
            <Button
              variant={activeInbox === 'conversations' ? 'secondary' : 'ghost'}
              className="w-full justify-start"
              onClick={() => { setActiveInbox('conversations'); setCommentSearch(''); }}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Conversaciones
            </Button>
            <Button
              variant={activeInbox === 'comments' ? 'secondary' : 'ghost'}
              className="w-full justify-start"
              onClick={() => { setActiveInbox('comments'); setCommentSearch(''); }}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Comentarios Internos
            </Button>
            <Button
              variant={activeInbox === 'assigned' ? 'secondary' : 'ghost'}
              className="w-full justify-start"
              onClick={() => { setActiveInbox('assigned'); setSelectedAssigned(null); }}
            >
              <Users className="mr-2 h-4 w-4" />
              Asignadas a mí
              {assignedComments.length > 0 && (
                <span className="ml-auto bg-orange-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">{assignedComments.length}</span>
              )}
            </Button>
            <Button variant="ghost" className="w-full justify-start text-muted-foreground">
              <Star className="mr-2 h-4 w-4" />
              Importantes
            </Button>
          </div>
          <Separator />
          <div className="space-y-1">
            <h3 className="text-xs font-semibold flex items-center gap-2 text-muted-foreground uppercase px-2 mb-2">
              <Archive className="h-3.5 w-3.5" /> Archivo
            </h3>
            <Button variant="ghost" className="w-full justify-start text-muted-foreground">
              <Clock className="mr-2 h-4 w-4" />
              Pendientes
            </Button>
            <Button variant="ghost" className="w-full justify-start text-muted-foreground">
              <FileText className="mr-2 h-4 w-4" />
              Cerradas
            </Button>
          </div>
          {activeInbox === 'conversations' && (
            <PermissionButton module="comunicaciones" action="create" variant="outline" className="w-full">
              <PlusCircle className="mr-2 h-4 w-4" />
              Nueva Conversación
            </PermissionButton>
          )}
        </CardContent>
      </Card>

      {/* Columna 2 */}
      <Card className="flex flex-col overflow-hidden">
        <div className="p-3 border-b space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={activeInbox === 'comments' ? 'Buscar comentario...' : activeInbox === 'assigned' ? 'Buscar verificación...' : 'Buscar conversación...'}
              className="pl-8"
              value={commentSearch}
              onChange={(e) => setCommentSearch(e.target.value)}
            />
          </div>
          {activeInbox === 'comments' && (
            <div className="space-y-2">
              <div className="flex rounded-md border overflow-hidden text-xs">
                <button
                  onClick={() => { setCommentsView('active'); setSelectedThread(null); }}
                  className={cn('flex-1 py-1.5 font-medium transition-colors', commentsView === 'active' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground')}
                >
                  Activos
                </button>
                <button
                  onClick={() => { setCommentsView('archived'); setSelectedThread(null); }}
                  className={cn('flex-1 py-1.5 font-medium transition-colors', commentsView === 'archived' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground')}
                >
                  Archivados
                </button>
              </div>
              {commentsView === 'active' && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => { setComposingNew(true); setComposingDirect(false); setSelectedThread(null); }}
                  >
                    <PlusCircle className="h-4 w-4" />
                    Nuevo comentario
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={() => { setComposingDirect(true); setComposingNew(false); setSelectedThread(null); }}
                  >
                    <UserPlus className="h-4 w-4" />
                    Mensaje directo
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
        <CardContent className="p-0 flex-1 overflow-y-auto">

          {/* ----- COMMENTS LIST ----- */}
          {activeInbox === 'comments' ? (
            loadingComments ? (
              <div className="flex justify-center items-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : allComments.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No hay comentarios todavía</div>
            ) : (
              <nav>
                {allComments
                  .filter((c) => c.comment_type !== 'verification_request')
                  .filter((c) => !commentSearch || c.body.toLowerCase().includes(commentSearch.toLowerCase()) || (c.entity_reference || '').toLowerCase().includes(commentSearch.toLowerCase()))
                  .map((comment) => {
                    const info = getEntityInfo(comment.commentable_type);
                    const isDirect = comment.commentable_type === 'App\\Models\\User';
                    const ref = comment.entity_reference || `#${comment.commentable_id}`;
                    const isSelected = selectedThread?.id === comment.id;
                    return (
                      <button
                        key={comment.id}
                        onClick={() => fetchThreadComments(comment)}
                        className={cn(
                          'w-full text-left p-3 hover:bg-muted/50 transition-colors flex items-start gap-3 border-b last:border-0',
                          isSelected && 'bg-muted'
                        )}
                      >
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarFallback className={cn('text-[11px] text-white', getAvatarColor(isDirect ? comment.commentable_id : comment.user.id))}>
                            {isDirect ? getInitials(ref) : getInitials(comment.user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 justify-between">
                            <span className="text-sm font-semibold truncate">
                              {isDirect ? ref : comment.user.name}
                            </span>
                            <span className="text-[11px] text-muted-foreground shrink-0">{relativeTime(comment.created_at)}</span>
                          </div>
                          <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0 h-[16px] rounded border-0 mt-0.5', info.color)}>
                            {isDirect ? 'Mensaje directo' : `${info.label}: ${ref}`}
                          </Badge>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {isDirect ? `${comment.user.name}: ` : ''}{previewBody(comment.body)}
                          </p>
                          {!isDirect && (comment.replies?.length ?? 0) > 0 && (
                            <span className="text-[10px] text-muted-foreground">{comment.replies!.length} respuesta{comment.replies!.length > 1 ? 's' : ''}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
              </nav>
            )
          ) : activeInbox === 'assigned' ? (

          /* ----- ASSIGNED / VERIFICATION LIST ----- */
          assignedComments.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No hay verificaciones pendientes</div>
          ) : (
            <nav>
              {assignedComments.map((comment) => {
                const meta = comment.metadata ?? {};
                const isSelected = selectedAssigned?.id === comment.id;
                return (
                  <button
                    key={comment.id}
                    onClick={() => setSelectedAssigned(comment)}
                    className={cn(
                      'w-full text-left p-3 hover:bg-muted/50 transition-colors flex items-start gap-3 border-b last:border-0',
                      isSelected && 'bg-muted'
                    )}
                  >
                    <div className="h-9 w-9 shrink-0 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-xs font-bold">🏦</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 justify-between">
                        <span className="text-sm font-semibold truncate">{meta.credit_reference ?? `#${comment.commentable_id}`}</span>
                        <span className="text-[11px] text-muted-foreground shrink-0">{relativeTime(comment.created_at)}</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-[16px] rounded border-0 mt-0.5 bg-orange-100 text-orange-700">
                        Verificación pendiente
                      </Badge>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {meta.client_name ?? ''} — ₡{Number(meta.monto || 0).toLocaleString('es-CR')}
                      </p>
                    </div>
                  </button>
                );
              })}
            </nav>
          )

          ) : (

          /* ----- CONVERSATIONS LIST ----- */
          loadingConversations ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Cargando conversaciones...</div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">No hay conversaciones disponibles</div>
          ) : (
            <nav className="space-y-1">
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
          ))}
        </CardContent>
      </Card>

      {/* Columna 3 */}
      <Card className="flex flex-col overflow-hidden">

        {/* ----- ASSIGNED VERIFICATION PANEL ----- */}
        {activeInbox === 'assigned' ? (
          selectedAssigned ? (
            <div className="flex flex-col h-full">
              <div className="p-4 border-b flex items-center justify-between shrink-0">
                <div>
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    🏦 Verificación de pago
                  </h3>
                  <p className="text-xs text-muted-foreground">{selectedAssigned.metadata?.credit_reference ?? `Comentario #${selectedAssigned.id}`}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedAssigned(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 flex items-start justify-center">
                <VerificationCard
                  metadata={selectedAssigned.metadata ?? {}}
                  type="request"
                  onRefresh={() => {
                    setSelectedAssigned(null);
                    api.get('/api/comments/recent', { params: { limit: 100 } }).then(res => {
                      const data: InternalComment[] = Array.isArray(res.data) ? res.data : res.data.data ?? [];
                      setAssignedComments(data.filter(c => c.comment_type === 'verification_request' && c.metadata?.status === 'pending'));
                    }).catch(() => {});
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              <Users className="h-10 w-10 opacity-20" />
              <p className="text-sm">Selecciona una verificación pendiente</p>
            </div>
          )
        ) : null}

        {/* ----- COMMENTS THREAD PANEL ----- */}
        {activeInbox === 'comments' ? (
          composingDirect ? (
            /* ---- DIRECT MESSAGE COMPOSE PANEL ---- */
            <div className="flex flex-col h-full">
              <div className="p-4 border-b flex items-center justify-between shrink-0">
                <div>
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-orange-500" />
                    Mensaje directo
                  </h3>
                  <p className="text-xs text-muted-foreground">Envía un mensaje a otro usuario</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setComposingDirect(false); setDirectRecipient(null); setDirectText(''); setDirectSearch(''); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                {/* Recipient selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Destinatario</label>
                  {directRecipient ? (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-sm gap-1.5 px-2 py-1 bg-orange-100 text-orange-700">
                        <UserPlus className="h-3.5 w-3.5" />
                        {directRecipient.name}
                      </Badge>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => { setDirectRecipient(null); setDirectSearch(''); }}>
                        Cambiar
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <input
                          autoFocus
                          placeholder="Buscar usuario..."
                          className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                          value={directSearch}
                          onChange={(e) => setDirectSearch(e.target.value)}
                        />
                      </div>
                      <div className="border rounded-lg max-h-48 overflow-auto">
                        {filteredDirectUsers.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">
                            {directSearch ? 'No se encontraron usuarios' : 'Escribe para buscar'}
                          </p>
                        ) : (
                          filteredDirectUsers.map((u: any) => (
                            <button
                              key={u.id}
                              className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors flex items-center gap-2.5 border-b last:border-0"
                              onClick={() => { setDirectRecipient(u); setDirectSearch(''); }}
                            >
                              <Avatar className="h-7 w-7">
                                <AvatarFallback className={cn('text-[10px] text-white', getAvatarColor(u.id))}>
                                  {getInitials(u.name || 'U')}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <span className="font-medium">{u.name}</span>
                                {u.email && <span className="text-xs text-muted-foreground ml-2">{u.email}</span>}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Message textarea */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Mensaje</label>
                  <div className="relative">
                    <textarea
                      disabled={!directRecipient}
                      placeholder={directRecipient ? 'Escribe tu mensaje...' : 'Selecciona un destinatario primero'}
                      className={cn(
                        'w-full resize-none rounded-lg border bg-background px-3 py-3 text-sm',
                        'outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary',
                        'min-h-[120px] disabled:opacity-50 disabled:cursor-not-allowed'
                      )}
                      rows={5}
                      value={directText}
                      onChange={(e) => setDirectText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); handleSendDirect(); }
                      }}
                    />
                    {/* Emoji/GIF buttons */}
                    {directRecipient && (
                      <div className="absolute bottom-2 right-2 flex gap-1">
                        <div className="relative">
                          <Button variant="ghost" size="icon" className={cn("h-7 w-7", directShowEmoji && "bg-accent")}
                            onClick={() => { setDirectShowEmoji(!directShowEmoji); setDirectShowGif(false); }}>
                            <Smile className="h-3.5 w-3.5" />
                          </Button>
                          {directShowEmoji && (
                            <div className="absolute bottom-full right-0 mb-1 z-50">
                              <Picker data={data} onEmojiSelect={(emoji: any) => {
                                if (emoji.native) setDirectText(prev => prev + emoji.native);
                                setDirectShowEmoji(false);
                              }} theme="light" locale="es" previewPosition="none" skinTonePosition="none" maxFrequentRows={2} />
                            </div>
                          )}
                        </div>
                        <div className="relative">
                          <Button variant="ghost" size="icon" className={cn("h-7 w-7", directShowGif && "bg-accent")}
                            onClick={() => { setDirectShowGif(!directShowGif); setDirectShowEmoji(false); }}>
                            <ImageIcon className="h-3.5 w-3.5" />
                          </Button>
                          {directShowGif && (
                            <div className="absolute bottom-full right-0 mb-1 z-50">
                              <GifPicker tenorApiKey={TENOR_API_KEY} onGifClick={(gif: TenorImage) => handleSendGif(gif, 'direct')} locale="es" width={320} height={400} />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">Ctrl+Enter para enviar</p>
                </div>
              </div>

              <div className="p-4 border-t bg-background shrink-0 flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setComposingDirect(false); setDirectRecipient(null); setDirectText(''); }}>
                  Cancelar
                </Button>
                <Button disabled={!directText.trim() || !directRecipient || sendingDirect} onClick={handleSendDirect} className="gap-2">
                  {sendingDirect ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Enviar mensaje
                </Button>
              </div>
            </div>
          ) : composingNew ? (
            /* ---- NEW COMMENT COMPOSE PANEL ---- */
            <div className="flex flex-col h-full">
              <div className="p-4 border-b flex items-center justify-between shrink-0">
                <div>
                  <h3 className="font-semibold text-sm">Nuevo comentario</h3>
                  <p className="text-xs text-muted-foreground">Selecciona una entidad y escribe tu comentario</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setComposingNew(false); setNewEntity(null); setNewText(''); setNewMentions([]); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                {/* Entity selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Entidad</label>
                  {newEntity ? (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-sm gap-1.5 px-2 py-1">
                        <Hash className="h-3.5 w-3.5" />
                        {newEntity.label}
                      </Badge>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setNewEntity(null)}>
                        Cambiar
                      </Button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Button variant="outline" className="gap-2 w-full justify-start" onClick={() => { setNewEntityPickerOpen(!newEntityPickerOpen); setNewEntityStep('type'); }}>
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Seleccionar entidad...</span>
                      </Button>
                      {newEntityPickerOpen && (
                        <div className="absolute top-full left-0 mt-1 w-72 bg-popover border rounded-lg shadow-xl z-50 overflow-hidden">
                          {newEntityStep === 'type' ? (
                            <div className="p-1">
                              <p className="px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase">Tipo de entidad</p>
                              {NEW_ENTITY_TARGETS.map((t) => (
                                <button key={t.key}
                                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted rounded transition-colors flex items-center gap-2"
                                  onClick={() => { setNewEntityType(t.key); setNewEntityStep('search'); setNewEntitySearch(''); setNewEntityResults([]); }}
                                >
                                  <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                                  {t.label}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div>
                              <div className="p-2 border-b flex items-center gap-2">
                                <button onClick={() => setNewEntityStep('type')} className="text-muted-foreground hover:text-foreground transition-colors">
                                  <ArrowLeft className="h-4 w-4" />
                                </button>
                                <input autoFocus
                                  placeholder={`Buscar ${NEW_ENTITY_TARGETS.find((t) => t.key === newEntityType)?.label}...`}
                                  className="flex-1 text-sm px-2 py-1 bg-background outline-none"
                                  value={newEntitySearch}
                                  onChange={(e) => { setNewEntitySearch(e.target.value); if (e.target.value.length >= 1) searchNewEntities(newEntityType, e.target.value); }}
                                />
                              </div>
                              <div className="max-h-48 overflow-auto p-1">
                                {newEntityLoading ? (
                                  <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
                                ) : newEntityResults.length === 0 ? (
                                  <p className="text-xs text-muted-foreground text-center py-4">{newEntitySearch ? 'Sin resultados' : 'Escribe para buscar'}</p>
                                ) : (
                                  newEntityResults.map((e: any) => {
                                    const display = e.reference || e.id || e.cedula || e.name || `#${e.id}`;
                                    const sub = e.name && e.apellido1 ? `${e.name} ${e.apellido1}` : (e.lead?.name || '');
                                    return (
                                      <button key={e.id}
                                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted rounded transition-colors"
                                        onClick={() => selectNewEntity(e)}
                                      >
                                        <span className="font-medium">{display}</span>
                                        {sub && <span className="text-muted-foreground ml-2 text-xs">{sub}</span>}
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Comment textarea with @mentions */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Comentario</label>
                  <div className="relative">
                    <textarea
                      ref={newTextRef}
                      disabled={!newEntity}
                      placeholder={newEntity ? 'Escribe tu comentario... Usa @ para mencionar a alguien' : 'Selecciona una entidad primero'}
                      className={cn(
                        'w-full resize-none rounded-lg border bg-background px-3 py-3 text-sm',
                        'outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary',
                        'min-h-[120px] disabled:opacity-50 disabled:cursor-not-allowed'
                      )}
                      rows={5}
                      value={newText}
                      onChange={handleNewTextChange}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); handleSendNew(); }
                        if (e.key === 'Escape') setShowUserDropdown(false);
                      }}
                    />
                    {showUserDropdown && filteredMentionUsers.length > 0 && (
                      <div className="absolute bottom-full left-0 mb-1 w-56 bg-popover border rounded-lg shadow-lg z-50 p-1">
                        <p className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                          <AtSign className="h-3 w-3" /> Mencionar usuario
                        </p>
                        <div className="max-h-48 overflow-y-auto">
                        {filteredMentionUsers.map((u: any) => (
                          <button key={u.id} onMouseDown={() => selectMentionUser(u)}
                            className="w-full text-left px-2 py-2 text-sm hover:bg-muted rounded flex items-center gap-2.5"
                          >
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className={cn('text-[9px] text-white', getAvatarColor(u.id))}>
                                {getInitials(u.name || 'U')}
                              </AvatarFallback>
                            </Avatar>
                            <span>{u.name}</span>
                          </button>
                        ))}
                        </div>
                      </div>
                    )}
                    {/* Emoji/GIF for new comment */}
                    {newEntity && (
                      <div className="absolute bottom-2 right-2 flex gap-1">
                        <div className="relative">
                          <Button variant="ghost" size="icon" className={cn("h-7 w-7", showEmojiPicker && "bg-accent")}
                            onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowGifPicker(false); }}>
                            <Smile className="h-3.5 w-3.5" />
                          </Button>
                          {showEmojiPicker && (
                            <div className="absolute bottom-full right-0 mb-1 z-50">
                              <Picker data={data} onEmojiSelect={(emoji: any) => {
                                if (emoji.native) setNewText(prev => prev + emoji.native);
                                setShowEmojiPicker(false);
                              }} theme="light" locale="es" previewPosition="none" skinTonePosition="none" maxFrequentRows={2} />
                            </div>
                          )}
                        </div>
                        <div className="relative">
                          <Button variant="ghost" size="icon" className={cn("h-7 w-7", showGifPicker && "bg-accent")}
                            onClick={() => { setShowGifPicker(!showGifPicker); setShowEmojiPicker(false); }}>
                            <ImageIcon className="h-3.5 w-3.5" />
                          </Button>
                          {showGifPicker && (
                            <div className="absolute bottom-full right-0 mb-1 z-50">
                              <GifPicker tenorApiKey={TENOR_API_KEY} onGifClick={(gif: TenorImage) => handleSendGif(gif, 'new')} locale="es" width={320} height={400} />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    <kbd className="font-mono text-[10px] border rounded px-1 py-0.5 bg-muted">@</kbd> mencionar
                    <span className="mx-1 text-muted-foreground/40">|</span>
                    <Smile className="inline h-3 w-3" /> emojis
                    <ImageIcon className="inline h-3 w-3 ml-1" /> GIFs
                    <span className="mx-1 text-muted-foreground/40">|</span>
                    Ctrl+Enter para enviar
                  </p>
                </div>

                {/* Mentions preview */}
                {newMentions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {newMentions.map((m) => (
                      <Badge key={m.id} variant="secondary" className="text-xs gap-1">
                        <AtSign className="h-2.5 w-2.5" />
                        {m.label}
                        <button onClick={() => setNewMentions((prev) => prev.filter((x) => x.id !== m.id))} className="ml-0.5 hover:text-destructive">
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 border-t bg-background shrink-0 flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setComposingNew(false); setNewEntity(null); setNewText(''); setNewMentions([]); }}>
                  Cancelar
                </Button>
                <Button disabled={!newText.trim() || !newEntity || sendingNew} onClick={handleSendNew} className="gap-2">
                  {sendingNew ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Publicar comentario
                </Button>
              </div>
            </div>
          ) : !selectedThread ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground gap-3">
              <MessageCircle className="h-10 w-10 opacity-20" />
              <p>Selecciona un comentario o crea uno nuevo</p>
              <div className="flex gap-2 mt-1">
                <Button size="sm" variant="outline" className="gap-2" onClick={() => { setComposingNew(true); setComposingDirect(false); }}>
                  <PlusCircle className="h-4 w-4" /> Comentario
                </Button>
                <Button size="sm" variant="outline" className="gap-2" onClick={() => { setComposingDirect(true); setComposingNew(false); }}>
                  <UserPlus className="h-4 w-4" /> Mensaje directo
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="p-4 border-b flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      {selectedThread.commentable_type === 'App\\Models\\User' ? (
                        <Badge variant="secondary" className="text-xs border-0 bg-orange-100 text-orange-700 gap-1">
                          <UserPlus className="h-3 w-3" />
                          Mensaje directo: {selectedThread.entity_reference || `Usuario #${selectedThread.commentable_id}`}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className={cn('text-xs border-0', getEntityInfo(selectedThread.commentable_type).color)}>
                          {getEntityInfo(selectedThread.commentable_type).label}: {selectedThread.entity_reference || `#${selectedThread.commentable_id}`}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(threadComments.length || 1)} comentario{(threadComments.length || 1) !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground hover:text-destructive"
                    title={selectedThread.archived_at ? 'Restaurar conversación' : 'Archivar conversación'}
                    onClick={async () => {
                      const endpoint = selectedThread.archived_at
                        ? `/api/comments/${selectedThread.id}/unarchive`
                        : `/api/comments/${selectedThread.id}/archive`;
                      await api.patch(endpoint);
                      setSelectedThread(null);
                      fetchAllComments(commentsView === 'archived');
                    }}
                  >
                    <Archive className="h-3.5 w-3.5" />
                    {selectedThread.archived_at ? 'Restaurar' : 'Archivar'}
                  </Button>
                  {selectedThread.commentable_type !== 'App\\Models\\User' && (
                    <Button variant="ghost" size="sm" className="gap-1 text-xs"
                      onClick={() => {
                        const info = getEntityInfo(selectedThread.commentable_type);
                        router.push(`${info.route}/${selectedThread.commentable_id}`);
                      }}
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Ver entidad
                    </Button>
                  )}
                </div>
              </div>

              {/* Thread messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                {loadingThread ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : (
                  threadComments.map((c) => (
                    <div key={c.id} className="space-y-3">
                      {/* Root comment */}
                      <div className="flex items-start gap-3">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className={cn('text-[11px] text-white', getAvatarColor(c.user.id))}>
                            {getInitials(c.user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 bg-muted/60 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{c.user.name}</span>
                            <span className="text-[11px] text-muted-foreground">{relativeTime(c.created_at)}</span>
                          </div>
                          {c.comment_type === 'verification_request' && c.metadata ? (
                            <div className="mt-2">
                              <VerificationCard 
                                metadata={c.metadata} 
                                type="request" 
                                onRefresh={() => {
                                  if (selectedThread) fetchThreadComments(selectedThread);
                                  fetchAllComments(commentsView === 'archived');
                                }} 
                              />
                            </div>
                          ) : c.comment_type === 'verification_response' && c.metadata ? (
                            <div className="mt-2">
                              <VerificationCard 
                                metadata={c.metadata} 
                                type="response" 
                                onRefresh={() => {
                                  if (selectedThread) fetchThreadComments(selectedThread);
                                  fetchAllComments(commentsView === 'archived');
                                }} 
                              />
                            </div>
                          ) : (
                            <p className="text-sm mt-0.5" dangerouslySetInnerHTML={{ __html: renderBody(c.body) }} />
                          )}
                        </div>
                      </div>
                      {/* Replies */}
                      {c.replies && c.replies.length > 0 && (
                        <div className="ml-11 space-y-2 border-l-2 border-muted pl-3">
                          {c.replies.map((r) => (
                            <div key={r.id} className="flex items-start gap-2">
                              <Avatar className="h-6 w-6 shrink-0">
                                <AvatarFallback className={cn('text-[9px] text-white', getAvatarColor(r.user.id))}>
                                  {getInitials(r.user.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 bg-muted/40 rounded-lg px-2.5 py-1.5">
                                <span className="text-xs font-semibold">{r.user.name} </span>
                                <span className="text-[10px] text-muted-foreground">{relativeTime(r.created_at)}</span>
                                <p className="text-xs mt-0.5" dangerouslySetInnerHTML={{ __html: renderBody(r.body) }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Reply compose */}
              <div className="p-3 border-t bg-background shrink-0 relative">
                {/* Reply emoji picker */}
                {replyShowEmoji && (
                  <div className="absolute bottom-full right-12 mb-1 z-50">
                    <Picker data={data} onEmojiSelect={(emoji: any) => {
                      if (emoji.native) setReplyText(prev => prev + emoji.native);
                      setReplyShowEmoji(false);
                    }} theme="light" locale="es" previewPosition="none" skinTonePosition="none" maxFrequentRows={2} />
                  </div>
                )}
                {/* Reply GIF picker */}
                {replyShowGif && (
                  <div className="absolute bottom-full right-12 mb-1 z-50">
                    <GifPicker tenorApiKey={TENOR_API_KEY} onGifClick={(gif: TenorImage) => handleSendGif(gif, 'reply')} locale="es" width={320} height={400} />
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    placeholder="Escribe un comentario..."
                    className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 min-h-[40px] max-h-[80px]"
                    rows={1}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
                  />
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button variant="ghost" size="icon" className={cn("h-8 w-8 rounded-lg", replyShowEmoji && "bg-accent")}
                      onClick={() => { setReplyShowEmoji(!replyShowEmoji); setReplyShowGif(false); }}>
                      <Smile className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className={cn("h-8 w-8 rounded-lg", replyShowGif && "bg-accent")}
                      onClick={() => { setReplyShowGif(!replyShowGif); setReplyShowEmoji(false); }}>
                      <ImageIcon className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" className="h-9 w-9 rounded-lg"
                      disabled={!replyText.trim() || sendingReply}
                      onClick={handleSendReply}
                    >
                      {sendingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )
        ) : (

        /* ----- CONVERSATIONS PANEL ----- */
        !selectedConversation ? (
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
        )
        )} {/* end conversations ternary / end activeInbox ternary */}
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

