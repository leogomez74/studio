'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import DOMPurify from 'dompurify';
import { useRouter } from 'next/navigation';
import {
  MessageCircle,
  X,
  Loader2,
  ExternalLink,
  Send,
  Mic,
  Square,
  Hash,
  AtSign,
  CornerDownLeft,
  Archive,
  ArchiveRestore,
  Inbox,
  Users,
  Search,
  ArrowLeft,
  Smile,
  Image as ImageIcon,
  Pencil,
} from 'lucide-react';
import emojiData from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import GifPicker, { TenorImage } from 'gif-picker-react';

import api from '@/lib/axios';
import { useAuth } from '@/components/auth-guard';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Reply {
  id: number;
  body: string;
  user_id: number;
  user: { id: number; name: string };
  created_at: string;
  mentions?: any[];
}

interface Comment {
  id: number;
  body: string;
  user_id: number;
  user: { id: number; name: string };
  commentable_type: string;
  commentable_id: number;
  mentions?: any[];
  created_at: string;
  archived_at?: string | null;
  replies?: Reply[];
  entity_reference?: string;
  comment_type?: string;
  metadata?: Record<string, any> | null;
}

interface Mention {
  type: string;
  id: number;
  label: string;
}

interface WaConversation {
  phone_number: string;
  contact_name: string;
  alias: string | null;
  last_message: string;
  last_at: string | null;
  unread: number;
}

interface WaMessage {
  wa_message_id: string | null;
  body: string;
  direction: 'out' | 'in';
  wa_timestamp: string;
  message_type?: string;
  audio_url?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500',
  'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500', 'bg-pink-500', 'bg-orange-500',
];

const ENTITY_TYPE_MAP: Record<string, { label: string; route: string; color: string; apiType: string }> = {
  'App\\Models\\Credit':      { label: 'Crédito',    route: '/dashboard/creditos',     color: 'bg-emerald-100 text-emerald-700', apiType: 'credit' },
  'App\\Models\\Opportunity': { label: 'Oportunidad', route: '/dashboard/oportunidades', color: 'bg-blue-100 text-blue-700',     apiType: 'opportunity' },
  'App\\Models\\Lead':        { label: 'Lead',        route: '/dashboard/leads',         color: 'bg-violet-100 text-violet-700', apiType: 'lead' },
  'App\\Models\\Client':      { label: 'Cliente',     route: '/dashboard/clientes',      color: 'bg-amber-100 text-amber-700',   apiType: 'client' },
  'App\\Models\\Analisis':    { label: 'Análisis',    route: '/dashboard/analisis',      color: 'bg-cyan-100 text-cyan-700',     apiType: 'analisis' },
  'App\\Models\\User':        { label: 'Directo',     route: '/dashboard/comunicaciones', color: 'bg-orange-100 text-orange-700', apiType: 'direct' },
};

const ENTITY_TARGETS = [
  { key: 'credit',      label: 'Crédito' },
  { key: 'opportunity', label: 'Oportunidad' },
  { key: 'lead',        label: 'Lead' },
  { key: 'client',      label: 'Cliente' },
  { key: 'analisis',    label: 'Análisis' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}
function getAvatarColor(id: number) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}
function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (min < 1) return 'ahora';
  if (min < 60) return `${min}m`;
  if (hr < 24) return `${hr}h`;
  if (day === 1) return 'ayer';
  return `${day}d`;
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getEntityInfo(type: string) {
  // Direct match first
  if (ENTITY_TYPE_MAP[type]) return ENTITY_TYPE_MAP[type];
  // Fallback: match by apiType or partial class name (e.g. "opportunity" or "Opportunity")
  const lower = type.toLowerCase();
  const entry = Object.entries(ENTITY_TYPE_MAP).find(([k, v]) =>
    v.apiType === lower || k.toLowerCase().endsWith(lower)
  );
  return entry?.[1] ?? { label: 'Entidad', route: '/dashboard', color: 'bg-gray-100 text-gray-700', apiType: '' };
}
function isGifMessage(body: string) {
  return /^\[GIF\]\([^)]+\)$/.test(body.trim());
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
      // No reload, just refresh state
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
      "rounded-lg border p-4 text-sm w-full",
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

function renderBody(body: string) {
  // GIF messages → just show label
  if (isGifMessage(body)) return '🎞 GIF';
  // Replace @[Name](user:id) and #[Label](type:id) with styled spans
  const html = body.replace(/[@#]\[([^\]]+)\]\(\w+:\d+\)/g, (_, label) => `<span class="font-semibold text-primary">${'@' + label}</span>`);
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: ['span', 'b', 'i', 'em', 'strong', 'br'], ALLOWED_ATTR: ['class'] });
}
function truncateBody(body: string, max = 80) {
  // GIF messages → just show label
  if (isGifMessage(body)) return '🎞 GIF';
  const clean = body.replace(/[@#]\[([^\]]+)\]\(\w+:\d+\)/g, (_, l) => l);
  return clean.length <= max ? clean : clean.slice(0, max).trimEnd() + '…';
}
function extractGifUrl(body: string): string | null {
  const m = body.trim().match(/^\[GIF\]\(([^)]+)\)$/);
  return m ? m[1] : null;
}

/** Group direct messages by contact — keeps only the latest message per conversation partner */
function groupDirectsByContact(comments: Comment[], myId: number | undefined): Comment[] {
  const map = new Map<number, Comment>();
  for (const c of comments) {
    const info = getEntityInfo(c.commentable_type);
    if (info.apiType !== 'direct') continue;
    // The "contact" is the other user: if I sent it, it's commentable_id; if they sent it, it's user_id
    const contactId = c.user_id === myId ? c.commentable_id : c.user_id;
    if (!map.has(contactId)) map.set(contactId, c);
  }
  return Array.from(map.values());
}

/** Group entity comments by entity — keeps only the latest comment per entity */
function groupByEntity(comments: Comment[]): Comment[] {
  const map = new Map<string, Comment>();
  for (const c of comments) {
    const info = getEntityInfo(c.commentable_type);
    if (info.apiType === 'direct') continue;
    const key = `${c.commentable_type}:${c.commentable_id}`;
    if (!map.has(key)) map.set(key, c);
  }
  return Array.from(map.values());
}

// ---------------------------------------------------------------------------
// Sub-component: inline compose (new comment or reply)
// ---------------------------------------------------------------------------

const TENOR_API_KEY = process.env.NEXT_PUBLIC_TENOR_API_KEY ?? '';

interface ComposeProps {
  placeholder: string;
  disabled?: boolean;
  onSend: (body: string, mentions: Mention[]) => Promise<void>;
  userList: any[];
  autoFocus?: boolean;
  onCancel?: () => void;
}

function Compose({ placeholder, disabled, onSend, userList, autoFocus, onCancel }: ComposeProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [showUsers, setShowUsers] = useState(false);
  const [userFilter, setUserFilter] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const gifRef = useRef<HTMLDivElement>(null);

  // Close pickers on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setShowEmoji(false);
      if (gifRef.current && !gifRef.current.contains(e.target as Node)) setShowGif(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    const pos = e.target.selectionStart || 0;
    setCursorPos(pos);
    const before = val.slice(0, pos);
    const atMatch = before.match(/@(\w*)$/);
    if (atMatch) { setUserFilter(atMatch[1].toLowerCase()); setShowUsers(true); }
    else setShowUsers(false);
  };

  const filteredUsers = userList.filter((u: any) =>
    u.name?.toLowerCase().includes(userFilter) || u.email?.toLowerCase().includes(userFilter)
  );

  const selectUser = (u: any) => {
    const before = text.slice(0, cursorPos);
    const atIdx = before.lastIndexOf('@');
    const newText = text.slice(0, atIdx) + `@[${u.name}](user:${u.id}) ` + text.slice(cursorPos);
    setText(newText);
    setMentions((prev) => [...prev.filter((m) => m.id !== u.id), { type: 'user', id: u.id, label: u.name }]);
    setShowUsers(false);
    ref.current?.focus();
  };

  const submit = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await onSend(text, mentions);
      setText('');
      setMentions([]);
    } catch {
      // Error already handled by caller — don't clear text
    } finally {
      setSending(false);
    }
  };

  const handleEmojiSelect = (emoji: any) => {
    const native = emoji.native;
    if (!native) return;
    const pos = ref.current?.selectionStart ?? text.length;
    const newText = text.slice(0, pos) + native + text.slice(pos);
    setText(newText);
    setShowEmoji(false);
    requestAnimationFrame(() => {
      const newPos = pos + native.length;
      ref.current?.focus();
      ref.current?.setSelectionRange(newPos, newPos);
    });
  };

  const handleGifSelect = async (gif: TenorImage) => {
    const gifUrl = gif.url;
    if (!gifUrl) return;
    setSending(true);
    try {
      await onSend(`[GIF](${gifUrl})`, []);
      setText('');
    } catch { /* handled by caller */ }
    finally { setSending(false); setShowGif(false); }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
    if (e.key === 'Escape' && onCancel) onCancel();
  };

  return (
    <div className="relative space-y-1">
      {/* Emoji Picker */}
      {showEmoji && (
        <div ref={emojiRef} className="absolute bottom-full right-0 mb-1 z-50">
          <Picker
            data={emojiData}
            onEmojiSelect={handleEmojiSelect}
            theme="light"
            locale="es"
            previewPosition="none"
            skinTonePosition="none"
            maxFrequentRows={2}
          />
        </div>
      )}
      {/* GIF Picker — solo si hay API key configurada */}
      {showGif && TENOR_API_KEY && (
        <div ref={gifRef} className="absolute bottom-full right-0 mb-1 z-50">
          <GifPicker
            tenorApiKey={TENOR_API_KEY}
            onGifClick={handleGifSelect}
            locale="es"
            width={300}
            height={360}
          />
        </div>
      )}

      {/* Textarea + Send */}
      <div className="flex items-end gap-1.5">
        <div className="flex-1 relative">
          <textarea
            ref={ref}
            disabled={disabled}
            placeholder={placeholder}
            className={cn(
              'w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm',
              'outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary',
              'min-h-[36px] max-h-[80px] disabled:opacity-40 disabled:cursor-not-allowed leading-snug'
            )}
            rows={1}
            value={text}
            onChange={handleChange}
            onKeyDown={onKey}
          />
          {showUsers && filteredUsers.length > 0 && (
            <div
              className="absolute bottom-full left-0 mb-1 w-52 bg-popover border rounded-lg shadow-lg z-50 p-1 max-h-48 overflow-y-auto"
            >
              <p className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                <AtSign className="h-3 w-3" /> Mencionar
              </p>
              {filteredUsers.map((u: any) => (
                <button key={u.id} onMouseDown={() => selectUser(u)}
                  className="w-full text-left px-2 py-1.5 text-sm hover:bg-muted rounded flex items-center gap-2"
                >
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className={cn('text-[9px] text-white', getAvatarColor(u.id))}>
                      {getInitials(u.name || 'U')}
                    </AvatarFallback>
                  </Avatar>
                  <span>{u.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {onCancel && (
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground" onClick={onCancel}>
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button size="icon" className="h-8 w-8 shrink-0 rounded-lg" disabled={!text.trim() || sending} onClick={submit}>
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* Emoji / GIF toolbar */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground transition-colors',
            'hover:bg-muted hover:text-foreground',
            showEmoji && 'bg-accent text-accent-foreground',
            (disabled || sending) && 'opacity-40 pointer-events-none'
          )}
          onClick={() => { setShowEmoji(!showEmoji); setShowGif(false); }}
          disabled={disabled || sending}
        >
          <Smile className="h-3.5 w-3.5" />
          <span>Emoji</span>
        </button>
        {TENOR_API_KEY && (
          <button
            type="button"
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground transition-colors',
              'hover:bg-muted hover:text-foreground',
              showGif && 'bg-accent text-accent-foreground',
              (disabled || sending) && 'opacity-40 pointer-events-none'
            )}
            onClick={() => { setShowGif(!showGif); setShowEmoji(false); }}
            disabled={disabled || sending}
          >
            <ImageIcon className="h-3.5 w-3.5" />
            <span>GIF</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audio message bubble — carga el audio desde el backend la primera vez
// ---------------------------------------------------------------------------

// Caché a nivel de módulo: persiste mientras el componente padre se recarga
// pero NO entre navegaciones de página. Evita refetch y corte de reproducción.
const waAudioCache = new Map<string, string>();

function WaMessageBubble({
  msg,
  onAudioLoaded,
}: {
  msg: WaMessage;
  onAudioLoaded: (waId: string, url: string) => void;
}) {
  const isAudio = msg.message_type === 'audio' || msg.body === '🎤 Audio';

  // Resolver URL: prioridad msg.audio_url → caché → null (pendiente de fetch)
  const audioSrc = msg.audio_url
    ?? (msg.wa_message_id ? waAudioCache.get(msg.wa_message_id) : undefined)
    ?? null;

  useEffect(() => {
    if (!isAudio || audioSrc || !msg.wa_message_id) return;
    let cancelled = false;
    api.get(`/api/whatsapp/media/${msg.wa_message_id}`, { responseType: 'blob' })
      .then(res => {
        if (cancelled) return;
        const url = URL.createObjectURL(res.data as Blob);
        waAudioCache.set(msg.wa_message_id!, url);
        onAudioLoaded(msg.wa_message_id!, url);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [msg.wa_message_id, audioSrc, isAudio, onAudioLoaded]);

  return (
    <div className={cn('flex', msg.direction === 'out' ? 'justify-end' : 'justify-start')}>
      <div className={cn(
        'max-w-[75%] rounded-lg text-xs',
        msg.direction === 'out' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
        isAudio ? 'px-2 py-1.5' : 'px-3 py-1.5',
      )}>
        {isAudio ? (
          audioSrc
            ? <audio controls src={audioSrc} className="h-8 w-52 max-w-full" />
            : <div className="flex items-center gap-1.5 w-52"><Loader2 className="h-3 w-3 animate-spin shrink-0" /><span className="text-xs opacity-70">Cargando audio...</span></div>
        ) : (
          msg.body
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ChatBubble() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const hasWhatsapp = !!user?.evolution_instance?.id;
  const [activeTab, setActiveTab] = useState<'whatsapp' | 'directos' | 'comentarios'>(
    hasWhatsapp ? 'whatsapp' : 'directos'
  );

  // WhatsApp state
  const [waConversations, setWaConversations] = useState<WaConversation[]>([]);
  const [waMessages, setWaMessages]           = useState<WaMessage[]>([]);
  const [waPhone, setWaPhone]                 = useState<string | null>(null);
  const [waContactName, setWaContactName]     = useState('');
  const [waInput, setWaInput]                 = useState('');
  const [waSending, setWaSending]             = useState(false);
  const [waNewPhone, setWaNewPhone]           = useState('');
  const [waShowNewChat, setWaShowNewChat]     = useState(false);
  const [waOffset, setWaOffset]               = useState(0);
  const [waHasMore, setWaHasMore]             = useState(false);
  const [waLoadingMore, setWaLoadingMore]     = useState(false);
  const [waSyncing, setWaSyncing]             = useState(false);
  const [waLoadingMessages, setWaLoadingMessages] = useState(false);
  const [waUnreadCount, setWaUnreadCount]     = useState(0);
  const [waSearch, setWaSearch]               = useState('');
  const [waAlias, setWaAlias]                 = useState<string | null>(null);
  const [waEditingAlias, setWaEditingAlias]   = useState(false);
  const [waAliasInput, setWaAliasInput]       = useState('');
  const [waSavingAlias, setWaSavingAlias]     = useState(false);
  const [waShowEmoji, setWaShowEmoji]         = useState(false);
  const [waRecording, setWaRecording]         = useState(false);
  const [waRecordedBlob, setWaRecordedBlob]   = useState<Blob | null>(null);
  const [waRecordedUrl, setWaRecordedUrl]     = useState<string | null>(null);
  const [waRecordingSeconds, setWaRecordingSeconds] = useState(0);
  // Edición de alias desde la lista (sin abrir el chat)
  const [waListEditPhone, setWaListEditPhone] = useState<string | null>(null);
  const [waListEditInput, setWaListEditInput] = useState('');
  const lastWaOpenedAtRef                     = useRef<number>(Date.now());
  const waInputRef                            = useRef<HTMLInputElement>(null);
  const waEmojiRef                            = useRef<HTMLDivElement>(null);
  const waMediaRecorderRef                    = useRef<MediaRecorder | null>(null);
  const waMediaStreamRef                      = useRef<MediaStream | null>(null);
  const waRecordingTimerRef                   = useRef<ReturnType<typeof setInterval> | null>(null);
  const waAudioChunksRef                      = useRef<Blob[]>([]);
  const WA_LIMIT = 20;

  // Entity selector state
  const [selectedEntity, setSelectedEntity] = useState<{ type: string; id: number; label: string } | null>(null);
  const [entitySearch, setEntitySearch] = useState('');
  const [entityResults, setEntityResults] = useState<any[]>([]);
  const [entitySearchLoading, setEntitySearchLoading] = useState(false);
  const [showEntityPicker, setShowEntityPicker] = useState(false);
  const [pickerStep, setPickerStep] = useState<'type' | 'search'>('type');
  const [pickerType, setPickerType] = useState('');

  const [userList, setUserList] = useState<any[]>([]);

  // Direct message state
  const [directMode, setDirectMode] = useState(false);
  const [directUserId, setDirectUserId] = useState<number | null>(null);
  const [directUserName, setDirectUserName] = useState('');
  const [directSearch, setDirectSearch] = useState('');
  const [directComments, setDirectComments] = useState<Comment[]>([]);
  const [isLoadingDirect, setIsLoadingDirect] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const hasSyncedChatsRef = useRef(false);

  // ---- WhatsApp functions ----
  const fetchWaConversations = useCallback(async () => {
    if (!hasWhatsapp) return;
    try {
      const res = await api.get('/api/whatsapp/conversations');
      setWaConversations(Array.isArray(res.data) ? res.data : []);
    } catch { /* silencioso */ }
  }, [hasWhatsapp]);

  const fetchWaMessages = useCallback(async (phone: string, silent = false) => {
    if (!silent) setWaLoadingMessages(true);
    try {
      const res = await api.get('/api/whatsapp/messages', {
        params: { phone, limit: WA_LIMIT, offset: 0 },
      });
      setWaMessages(res.data.messages ?? []);
      setWaHasMore(res.data.has_more ?? false);
      setWaOffset(WA_LIMIT);
    } catch { /* silencioso */ } finally {
      if (!silent) setWaLoadingMessages(false);
    }
  }, [WA_LIMIT]);

  const loadMoreWaMessages = async () => {
    if (!waPhone || waLoadingMore || !waHasMore) return;
    setWaLoadingMore(true);
    try {
      const res = await api.get('/api/whatsapp/messages', {
        params: { phone: waPhone, limit: WA_LIMIT, offset: waOffset },
      });
      setWaMessages(prev => [...(res.data.messages ?? []), ...prev]);
      setWaHasMore(res.data.has_more ?? false);
      setWaOffset(prev => prev + WA_LIMIT);
    } catch { /* silencioso */ } finally {
      setWaLoadingMore(false);
    }
  };

  const handleWaSend = async () => {
    if (!waInput.trim() || !waPhone) return;
    try {
      setWaSending(true);
      const res = await api.post('/api/whatsapp/send', {
        phone: waPhone,
        body: waInput.trim(),
        contact_name: waContactName,
      });
      setWaInput('');
      setWaMessages(prev => [...prev, res.data]);
      fetchWaConversations();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast({ title: 'Error al enviar', description: error.response?.data?.message, variant: 'destructive' });
    } finally {
      setWaSending(false);
    }
  };

  const handleWaSendAudio = async () => {
    if (!waRecordedBlob || !waPhone) return;
    try {
      setWaSending(true);
      const formData = new FormData();
      formData.append('phone', waPhone);
      // Usar extensión acorde al mimeType grabado por el navegador
      const ext = waRecordedBlob.type.includes('ogg') ? 'ogg'
        : waRecordedBlob.type.includes('mp4') ? 'mp4'
        : 'webm';
      formData.append('audio', waRecordedBlob, `audio.${ext}`);

      const res = await api.post('/api/whatsapp/send-audio', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // URL independiente para el player del mensaje (resetWaRecordedAudio revoca la de preview)
      const messageAudioUrl = URL.createObjectURL(waRecordedBlob);
      resetWaRecordedAudio();
      setWaMessages(prev => [...prev, { ...res.data, audio_url: messageAudioUrl }]);
      fetchWaConversations();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast({ title: 'Error al enviar audio', description: error.response?.data?.message, variant: 'destructive' });
    } finally {
      setWaSending(false);
    }
  };

  const handleWaEmojiSelect = (emoji: any) => {
    const native = emoji?.native;
    if (!native) return;

    const input = waInputRef.current;
    const start = input?.selectionStart ?? waInput.length;
    const end = input?.selectionEnd ?? waInput.length;
    const nextValue = waInput.slice(0, start) + native + waInput.slice(end);

    setWaInput(nextValue);
    setWaShowEmoji(false);

    requestAnimationFrame(() => {
      const newPos = start + native.length;
      waInputRef.current?.focus();
      waInputRef.current?.setSelectionRange(newPos, newPos);
    });
  };

  const clearWaRecordingTimer = useCallback(() => {
    if (waRecordingTimerRef.current) {
      clearInterval(waRecordingTimerRef.current);
      waRecordingTimerRef.current = null;
    }
  }, []);

  const stopWaMediaStream = useCallback(() => {
    waMediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    waMediaStreamRef.current = null;
  }, []);

  const resetWaRecordedAudio = useCallback(() => {
    if (waRecordedUrl) {
      URL.revokeObjectURL(waRecordedUrl);
    }

    setWaRecordedBlob(null);
    setWaRecordedUrl(null);
    setWaRecordingSeconds(0);
  }, [waRecordedUrl]);

  const cancelWaRecording = useCallback(() => {
    clearWaRecordingTimer();

    if (waMediaRecorderRef.current && waMediaRecorderRef.current.state !== 'inactive') {
      waMediaRecorderRef.current.onstop = null;
      waMediaRecorderRef.current.stop();
    }

    waMediaRecorderRef.current = null;
    waAudioChunksRef.current = [];
    stopWaMediaStream();
    setWaRecording(false);
    resetWaRecordedAudio();
    requestAnimationFrame(() => waInputRef.current?.focus());
  }, [clearWaRecordingTimer, resetWaRecordedAudio, stopWaMediaStream]);

  const stopWaRecording = useCallback(() => {
    clearWaRecordingTimer();

    if (!waMediaRecorderRef.current || waMediaRecorderRef.current.state === 'inactive') {
      setWaRecording(false);
      stopWaMediaStream();
      return;
    }

    waMediaRecorderRef.current.stop();
  }, [clearWaRecordingTimer, stopWaMediaStream]);

  const startWaRecording = async () => {
    if (waSending || waRecording || waRecordedBlob) return;

    try {
      setWaShowEmoji(false);
      resetWaRecordedAudio();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);

      waMediaStreamRef.current = stream;
      waMediaRecorderRef.current = recorder;
      waAudioChunksRef.current = [];
      setWaRecording(true);
      setWaRecordingSeconds(0);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          waAudioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const chunks = waAudioChunksRef.current;
        waAudioChunksRef.current = [];
        waMediaRecorderRef.current = null;
        stopWaMediaStream();
        setWaRecording(false);

        if (chunks.length === 0) {
          return;
        }

        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setWaRecordedBlob(blob);
        setWaRecordedUrl(url);
      };

      recorder.start();

      waRecordingTimerRef.current = setInterval(() => {
        setWaRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch {
      stopWaMediaStream();
      setWaRecording(false);
      resetWaRecordedAudio();
      toast({
        title: 'Micrófono no disponible',
        description: 'No se pudo iniciar la grabación de audio en este navegador.',
        variant: 'destructive',
      });
    }
  };

  const openWaConversation = (phone: string, name: string, alias?: string | null) => {
    setWaPhone(phone);
    setWaContactName(name);
    setWaAlias(alias ?? null);
    setWaAliasInput(alias ?? '');
    setWaEditingAlias(false);
    setWaShowNewChat(false);
    setWaMessages([]);
    setWaOffset(0);
    setWaSearch('');
    fetchWaMessages(phone);
  };

  // Guarda alias para cualquier número — usado desde el header y desde la lista
  const saveAlias = async (phone: string, aliasValue: string): Promise<boolean> => {
    const phoneStr = String(phone); // defensa: evitar que llegue como número al JSON
    try {
      if (aliasValue.trim()) {
        await api.post('/api/whatsapp/contacts', { phone: phoneStr, alias: aliasValue.trim() });
      } else {
        await api.delete(`/api/whatsapp/contacts/${phoneStr}`);
      }
      return true;
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Error al guardar alias';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
      return false;
    }
  };

  const handleSaveAlias = async () => {
    if (!waPhone) return;
    setWaSavingAlias(true);
    const ok = await saveAlias(waPhone, waAliasInput);
    if (ok) {
      const newAlias = waAliasInput.trim() || null;
      setWaAlias(newAlias);
      if (newAlias) setWaContactName(newAlias);
      setWaEditingAlias(false);
      fetchWaConversations();
    }
    setWaSavingAlias(false);
  };

  const handleSaveListAlias = async () => {
    if (!waListEditPhone) return;
    setWaSavingAlias(true);
    const ok = await saveAlias(waListEditPhone, waListEditInput);
    if (ok) {
      setWaListEditPhone(null);
      setWaListEditInput('');
      fetchWaConversations();
    }
    setWaSavingAlias(false);
  };

  // ---- Fetch ----
  const fetchComments = useCallback(async (archived = false) => {
    setIsLoading(true);
    try {
      const res = await api.get('/api/comments/recent', { params: { limit: 30, archived } });
      const data: Comment[] = Array.isArray(res.data) ? res.data : res.data.data ?? [];
      setComments(data);
      setHasFetched(true);
      if (!archived) setUnreadCount(0);
    } catch { /* silent */ } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { if (isOpen && !hasFetched) fetchComments(showArchived); }, [isOpen, hasFetched, fetchComments, showArchived]);
  // Refresh when panel opens or tab changes
  useEffect(() => { if (isOpen) fetchComments(showArchived); }, [isOpen, showArchived]); // eslint-disable-line
  useEffect(() => {
    if (!isOpen || !hasWhatsapp) return;
    // Resetear unread y marcar momento de apertura del tab WhatsApp
    lastWaOpenedAtRef.current = Date.now();
    setWaUnreadCount(0);
    if (!hasSyncedChatsRef.current) {
      // Primera apertura en la sesión: sync desde Evolution API, luego carga
      setWaSyncing(true);
      api.post('/api/whatsapp/sync-chats').finally(() => {
        hasSyncedChatsRef.current = true;
        setWaSyncing(false);
        fetchWaConversations();
      });
    } else {
      fetchWaConversations();
    }
  }, [isOpen, hasWhatsapp, fetchWaConversations]); // eslint-disable-line

  // Polling WhatsApp: refresca mensajes cada 5s si hay conversación abierta, conversaciones cada 15s
  useEffect(() => {
    if (!isOpen || !hasWhatsapp) return;
    const iv = setInterval(() => {
      if (waPhone) {
        fetchWaMessages(waPhone, true); // silent: no spinner en polling
      } else {
        fetchWaConversations();
      }
    }, 5_000);
    return () => clearInterval(iv);
  }, [isOpen, hasWhatsapp, waPhone, fetchWaMessages, fetchWaConversations]); // eslint-disable-line

  // Polling cada 15s cuando el panel está abierto
  useEffect(() => {
    if (!isOpen) return;
    const iv = setInterval(() => fetchComments(showArchived), 15_000);
    return () => clearInterval(iv);
  }, [isOpen, showArchived, fetchComments]);

  // Background badge (comentarios + WhatsApp)
  useEffect(() => {
    if (isOpen) return;
    const check = async () => {
      try {
        const res = await api.get('/api/comments/recent', { params: { limit: 5 } });
        const data: Comment[] = Array.isArray(res.data) ? res.data : res.data.data ?? [];
        const ago5 = Date.now() - 5 * 60 * 1000;
        setUnreadCount(data.filter((c) => c.user_id !== user?.id && new Date(c.created_at).getTime() > ago5).length);
      } catch { /* silent */ }
      // Badge WhatsApp: contar conversaciones con mensajes nuevos desde última apertura
      if (hasWhatsapp) {
        try {
          const waRes = await api.get('/api/whatsapp/conversations');
          const convs: WaConversation[] = Array.isArray(waRes.data) ? waRes.data : [];
          const newCount = convs.filter(c =>
            c.last_message && c.last_at &&
            new Date(c.last_at).getTime() > lastWaOpenedAtRef.current
          ).length;
          setWaUnreadCount(newCount);
        } catch { /* silent */ }
      }
    };
    check();
    const iv = setInterval(check, 60_000);
    return () => clearInterval(iv);
  }, [isOpen, user?.id, hasWhatsapp]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [isOpen]);

  // Fetch users when panel opens (uses /api/agents — accessible to all authenticated users)
  useEffect(() => {
    if (isOpen) api.get('/api/agents').then((r) => setUserList(Array.isArray(r.data) ? r.data : r.data.data ?? [])).catch(() => {});
  }, [isOpen]);

  // ---- Entity search ----
  const searchEntities = async (type: string, query: string) => {
    setEntitySearchLoading(true);
    try {
      const endpoints: Record<string, string> = {
        credit: '/api/credits', opportunity: '/api/opportunities', lead: '/api/leads', client: '/api/clients', analisis: '/api/analisis',
      };
      const res = await api.get(endpoints[type] || '/api/credits', { params: { search: query, per_page: 8 } });
      setEntityResults(Array.isArray(res.data) ? res.data : res.data.data ?? []);
    } catch { setEntityResults([]); } finally { setEntitySearchLoading(false); }
  };

  const selectEntityTarget = (entity: any) => {
    const refLabel: Record<string, (e: any) => string> = {
      credit:      (e) => e.reference || `#${e.id}`,
      opportunity: (e) => e.id || `#${e.id}`,
      lead:        (e) => e.cedula || e.name || `#${e.id}`,
      client:      (e) => e.cedula || e.name || `#${e.id}`,
      analisis:    (e) => e.reference || `#${e.id}`,
    };
    const ref = (refLabel[pickerType] || ((e: any) => `#${e.id}`))(entity);
    const typeLabel = ENTITY_TARGETS.find((t) => t.key === pickerType)?.label || pickerType;
    setSelectedEntity({ type: pickerType, id: entity.id, label: `${typeLabel}: ${ref}` });
    setShowEntityPicker(false);
    setPickerStep('type');
    setEntitySearch('');
  };

  // ---- Send new comment ----
  const handleSend = async (body: string, mentions: Mention[]) => {
    if (!selectedEntity) return;
    try {
      await api.post('/api/comments', {
        commentable_type: selectedEntity.type,
        commentable_id: selectedEntity.id,
        body,
        mentions,
      });
      fetchComments(showArchived);
      setSelectedEntity(null);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Error al enviar comentario';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
      throw err; // Re-throw so Compose doesn't clear the text
    }
  };

  // ---- Send reply ----
  const handleReply = async (parentId: number, body: string, mentions: Mention[]) => {
    const parent = comments.find((c) => c.id === parentId);
    if (!parent) return;
    await api.post('/api/comments', {
      commentable_type: getEntityInfo(parent.commentable_type).apiType || parent.commentable_type,
      commentable_id: parent.commentable_id,
      body,
      mentions,
      parent_id: parentId,
    });
    setReplyingTo(null);
    fetchComments(showArchived);
  };

  // ---- Archive / Unarchive ----
  const handleArchive = async (id: number) => {
    await api.patch(`/api/comments/${id}/archive`).catch(() => {});
    fetchComments(showArchived);
  };

  const handleUnarchive = async (id: number) => {
    await api.patch(`/api/comments/${id}/unarchive`).catch(() => {});
    fetchComments(showArchived);
  };

  // ---- Direct message: fetch thread ----
  const fetchDirectThread = useCallback(async (userId: number) => {
    setIsLoadingDirect(true);
    try {
      const res = await api.get('/api/comments', {
        params: { commentable_type: 'direct', commentable_id: userId },
      });
      const data: Comment[] = Array.isArray(res.data) ? res.data : res.data.data ?? [];
      setDirectComments(data);
    } catch { setDirectComments([]); }
    finally { setIsLoadingDirect(false); }
  }, []);

  useEffect(() => {
    if (directMode && directUserId) fetchDirectThread(directUserId);
  }, [directMode, directUserId, fetchDirectThread]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (waEmojiRef.current && !waEmojiRef.current.contains(e.target as Node)) {
        setWaShowEmoji(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    return () => {
      clearWaRecordingTimer();
      stopWaMediaStream();
      if (waRecordedUrl) {
        URL.revokeObjectURL(waRecordedUrl);
      }
    };
  }, [clearWaRecordingTimer, stopWaMediaStream, waRecordedUrl]);

  // ---- Send direct message ----
  const handleSendDirect = async (body: string, mentions: Mention[]) => {
    if (!directUserId) return;
    try {
      await api.post('/api/comments', {
        commentable_type: 'direct',
        commentable_id: directUserId,
        body,
        mentions,
      });
      fetchDirectThread(directUserId);
      fetchComments(showArchived); // Actualizar lista de conversaciones
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Error al enviar mensaje';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
      throw err;
    }
  };

  const handleCommentClick = useCallback((comment: Comment) => {
    const info = getEntityInfo(comment.commentable_type);
    if (info.apiType === 'direct') {
      // Open direct message thread
      setDirectMode(true);
      setDirectUserId(comment.commentable_id);
      setDirectUserName(comment.entity_reference || `Usuario #${comment.commentable_id}`);
      return;
    }
    router.push(`${info.route}/${comment.commentable_id}`);
    setIsOpen(false);
  }, [router]);

  return (
    <>
      {/* Floating button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((p) => !p)}
        aria-label="Comentarios"
        className={cn(
          'fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full',
          'bg-primary text-primary-foreground shadow-lg',
          'flex items-center justify-center transition-all duration-200',
          'hover:scale-110 hover:shadow-xl active:scale-95',
          isOpen && 'scale-0 opacity-0 pointer-events-none'
        )}
      >
        <MessageCircle className="h-6 w-6" />
        {(unreadCount + waUnreadCount) > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold ring-2 ring-background">
            {(unreadCount + waUnreadCount) > 9 ? '9+' : (unreadCount + waUnreadCount)}
          </span>
        )}
      </button>

      {/* Backdrop — closes panel on click outside */}
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}

      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          'fixed bottom-6 right-6 z-50 w-[500px]',
          'rounded-2xl border bg-card shadow-2xl flex flex-col',
          'transition-all duration-300 ease-out origin-bottom-right',
          isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-2 pointer-events-none'
        )}
        style={{ height: '680px', maxHeight: 'calc(100vh - 48px)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30 shrink-0 rounded-t-2xl overflow-hidden">
          {directMode ? (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg shrink-0"
                onClick={() => { setDirectMode(false); setDirectUserId(null); setDirectUserName(''); setDirectComments([]); setDirectSearch(''); }}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold leading-tight truncate">
                  {directUserId ? `Mensaje a ${directUserName}` : 'Mensaje directo'}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {directUserId ? 'Conversación privada' : 'Selecciona un usuario'}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 shrink-0">
                  <MessageCircle className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold leading-tight">Comunicaciones</h3>
                  <p className="text-[11px] text-muted-foreground">Actividad interna del equipo</p>
                </div>
              </div>
              <Button
                variant={showArchived ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8 rounded-lg shrink-0"
                title={showArchived ? 'Ver activos' : 'Ver archivados'}
                onClick={() => setShowArchived((p) => !p)}
              >
                {showArchived ? <Inbox className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg shrink-0" onClick={() => setIsOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Tabs — only visible in main feed (not inside a thread) */}
        {!directMode && (
          <div className="flex border-b shrink-0">
            {/* Tab WhatsApp — solo si el usuario tiene instancia asignada */}
            {hasWhatsapp && (
              <button
                type="button"
                className={cn(
                  'flex-1 py-2 text-xs font-semibold text-center transition-colors relative',
                  activeTab === 'whatsapp'
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={() => setActiveTab('whatsapp')}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5" />
                  WhatsApp
                </div>
                {activeTab === 'whatsapp' && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />}
              </button>
            )}
            <button
              type="button"
              className={cn(
                'flex-1 py-2 text-xs font-semibold text-center transition-colors relative',
                activeTab === 'directos'
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setActiveTab('directos')}
            >
              <div className="flex items-center justify-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Directos
              </div>
              {activeTab === 'directos' && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />}
            </button>
            <button
              type="button"
              className={cn(
                'flex-1 py-2 text-xs font-semibold text-center transition-colors relative',
                activeTab === 'comentarios'
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setActiveTab('comentarios')}
            >
              <div className="flex items-center justify-center gap-1.5">
                <Hash className="h-3.5 w-3.5" />
                Comentarios
              </div>
              {activeTab === 'comentarios' && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />}
            </button>
          </div>
        )}

        {/* Direct mode: user picker */}
        {directMode && !directUserId && (
          <div className="border-b shrink-0">
            <div className="px-3 py-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  autoFocus
                  value={directSearch}
                  onChange={(e) => setDirectSearch(e.target.value)}
                  placeholder="Buscar usuario..."
                  className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-1.5 text-sm placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {userList
                .filter((u) => u.id !== user?.id && u.name?.toLowerCase().includes(directSearch.toLowerCase()))
                .map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-accent/50 transition-colors"
                    onClick={() => { setDirectUserId(u.id); setDirectUserName(u.name); setDirectSearch(''); }}
                  >
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback className={cn('text-xs font-semibold text-white', getAvatarColor(u.id))}>
                        {getInitials(u.name || 'U')}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium truncate">{u.name}</span>
                  </button>
                ))
              }
            </div>
          </div>
        )}

        {/* Comments list */}
        <div
          className="flex-1 min-h-0 overflow-y-auto cursor-grab active:cursor-grabbing [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).closest('button, a, input, textarea')) return;
            e.preventDefault();
            const el = e.currentTarget;
            const startY = e.pageY;
            const scrollT = el.scrollTop;
            el.style.cursor = 'grabbing';
            const onMove = (ev: MouseEvent) => { ev.preventDefault(); el.scrollTop = scrollT - (ev.pageY - startY); };
            const onUp = () => { el.style.cursor = ''; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
          }}
        >
          {/* Direct mode: user picker placeholder or thread */}
          {directMode && !directUserId ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 px-8">
              <div className="rounded-full bg-muted p-4">
                <Users className="h-7 w-7 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium">Mensaje directo</p>
              <p className="text-xs text-muted-foreground text-center">Selecciona un usuario para iniciar una conversación.</p>
            </div>
          ) : directMode && directUserId ? (
            isLoadingDirect ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Cargando...</span>
              </div>
            ) : directComments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 px-8">
                <div className="rounded-full bg-muted p-4">
                  <MessageCircle className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium">Sin mensajes aún</p>
                <p className="text-xs text-muted-foreground text-center">Envía el primer mensaje a {directUserName}.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1 px-3 py-2">
                {directComments.map((comment) => {
                  const isMe = comment.user_id === user?.id;
                  const gifUrl = extractGifUrl(comment.body);
                  const isVerification = comment.comment_type?.startsWith('verification_');

                  return (
                    <div key={comment.id} className={cn('flex', isMe ? 'justify-end' : 'justify-start')}>
                      <div className={cn(
                        'rounded-2xl px-3 py-2 text-[13px] leading-snug',
                        isVerification ? 'max-w-[85%] w-full' : 'max-w-[75%]',
                        isMe
                          ? 'bg-primary text-primary-foreground rounded-br-md'
                          : 'bg-muted rounded-bl-md'
                      )}>
                        {!isMe && (
                          <p className="text-[10px] font-semibold mb-0.5 opacity-70">{comment.user.name}</p>
                        )}
                        {comment.comment_type === 'verification_request' && comment.metadata ? (
                          <VerificationCard 
                            metadata={comment.metadata} 
                            type="request" 
                            onRefresh={() => fetchDirectThread(directUserId!)} 
                          />
                        ) : comment.comment_type === 'verification_response' && comment.metadata ? (
                          <VerificationCard 
                            metadata={comment.metadata} 
                            type="response" 
                            onRefresh={() => fetchDirectThread(directUserId!)} 
                          />
                        ) : gifUrl ? (
                          <img src={gifUrl} alt="GIF" className="rounded-lg max-w-[200px] max-h-[150px] object-cover" loading="lazy" />
                        ) : (
                          <p dangerouslySetInnerHTML={{ __html: renderBody(comment.body) }} />
                        )}
                        <p className={cn('text-[10px] mt-1', isMe ? 'text-primary-foreground/60 text-right' : 'text-muted-foreground')}>
                          {relativeTime(comment.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : activeTab === 'whatsapp' && hasWhatsapp ? (
            /* ========== TAB: WHATSAPP ========== */
            <div className="flex flex-col h-full">
              {waPhone ? (
                <>
                  {/* Header de la conversación */}
                  <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0">
                    <button onClick={() => { setWaPhone(null); setWaMessages([]); setWaEditingAlias(false); }} className="text-muted-foreground hover:text-foreground">
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <div className="flex-1 min-w-0">
                      {waEditingAlias ? (
                        <div className="flex items-center gap-1">
                          <input
                            autoFocus
                            className="flex-1 h-6 rounded border border-input bg-background px-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            placeholder="Alias (deja vacío para quitar)"
                            value={waAliasInput}
                            onChange={e => setWaAliasInput(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleSaveAlias();
                              if (e.key === 'Escape') setWaEditingAlias(false);
                            }}
                          />
                          <button
                            onClick={handleSaveAlias}
                            disabled={waSavingAlias}
                            className="text-xs text-primary hover:underline disabled:opacity-50 shrink-0"
                          >
                            {waSavingAlias ? <Loader2 className="h-3 w-3 animate-spin inline" /> : 'Guardar'}
                          </button>
                          <button onClick={() => setWaEditingAlias(false)} className="text-xs text-muted-foreground hover:text-foreground shrink-0">✕</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 group">
                          <div className="text-xs font-semibold truncate">{waAlias || waContactName || waPhone}</div>
                          <button
                            onClick={() => { setWaAliasInput(waAlias ?? ''); setWaEditingAlias(true); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground shrink-0"
                            title="Editar alias"
                          >
                            <AtSign className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">{waPhone}</div>
                    </div>
                  </div>
                  {/* Mensajes */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {waLoadingMessages ? (
                      <div className="flex flex-col items-center justify-center h-full gap-2 py-12">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Cargando mensajes...</span>
                      </div>
                    ) : waMessages.length === 0 ? (
                      <div className="flex items-center justify-center h-full py-12">
                        <span className="text-xs text-muted-foreground">Sin mensajes</span>
                      </div>
                    ) : (
                      <>
                        {waHasMore && (
                          <div className="flex justify-center py-1">
                            <button
                              onClick={loadMoreWaMessages}
                              disabled={waLoadingMore}
                              className="text-xs text-muted-foreground hover:text-foreground"
                            >
                              {waLoadingMore
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin inline" />
                                : 'Cargar mensajes anteriores'}
                            </button>
                          </div>
                        )}
                        {waMessages.map((msg, i) => (
                          <WaMessageBubble
                            key={msg.wa_message_id ?? i}
                            msg={msg}
                            onAudioLoaded={(waId, url) =>
                              setWaMessages(prev => prev.map(m =>
                                m.wa_message_id === waId ? { ...m, audio_url: url } : m
                              ))
                            }
                          />
                        ))}
                      </>
                    )}
                  </div>
                  {/* Input de envío */}
                  <div className="flex items-center gap-2 p-2 border-t shrink-0">
                    <div ref={waEmojiRef} className="relative shrink-0">
                      {waShowEmoji && (
                        <div className="absolute bottom-full left-0 mb-2 z-50">
                          <Picker
                            data={emojiData}
                            onEmojiSelect={handleWaEmojiSelect}
                            theme="light"
                            locale="es"
                            previewPosition="none"
                            skinTonePosition="none"
                            maxFrequentRows={2}
                          />
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn('h-8 w-8 shrink-0', waShowEmoji && 'bg-accent text-accent-foreground')}
                        onClick={() => setWaShowEmoji((prev) => !prev)}
                        disabled={waSending || waRecording || !!waRecordedBlob}
                      >
                        <Smile className="h-4 w-4" />
                      </Button>
                    </div>
                    {waRecording ? (
                      <div className="flex-1 flex items-center justify-between gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-1.5 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-destructive animate-pulse shrink-0" />
                          <span className="font-medium text-destructive">Grabando audio...</span>
                          <span className="text-muted-foreground tabular-nums">{formatDuration(waRecordingSeconds)}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={cancelWaRecording}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                          <Button type="button" size="icon" className="h-7 w-7" onClick={stopWaRecording}>
                            <Square className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ) : waRecordedBlob && waRecordedUrl ? (
                      <div className="flex-1 flex items-center gap-2 rounded-md border border-input bg-muted/30 px-2 py-1">
                        <audio className="flex-1 h-8" controls src={waRecordedUrl} />
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={cancelWaRecording}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={handleWaSendAudio}
                          disabled={waSending}
                        >
                          {waSending
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Send className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    ) : (
                      <>
                        <input
                          ref={waInputRef}
                          className="flex-1 h-8 rounded-md border border-input bg-background px-3 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          placeholder="Escribe un mensaje..."
                          value={waInput}
                          onChange={e => setWaInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleWaSend()}
                          disabled={waSending}
                        />
                        <Button
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={waInput.trim() ? handleWaSend : startWaRecording}
                          disabled={waSending}
                        >
                          {waSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : waInput.trim() ? <Send className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                        </Button>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Lista de conversaciones */}
                  <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
                    <span className="text-xs text-muted-foreground">Conversaciones</span>
                    <button
                      className="text-xs text-primary hover:underline"
                      onClick={() => setWaShowNewChat(v => !v)}
                    >
                      + Nuevo
                    </button>
                  </div>
                  {/* Buscador */}
                  <div className="px-3 py-1.5 border-b shrink-0">
                    <input
                      className="w-full h-7 rounded-md border border-input bg-background px-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder="Buscar nombre o número..."
                      value={waSearch}
                      onChange={e => setWaSearch(e.target.value)}
                    />
                  </div>
                  {/* Banner de carga inicial */}
                  {waSyncing && (
                    <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground bg-muted/40 border-b shrink-0">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Cargando historial...
                    </div>
                  )}
                  {waShowNewChat && (
                    <div className="px-3 py-2 border-b space-y-1 shrink-0">
                      <input
                        className="w-full h-7 rounded-md border border-input bg-background px-3 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        placeholder="Número (ej: 50661234567)"
                        value={waNewPhone}
                        onChange={e => setWaNewPhone(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && waNewPhone.trim()) {
                            openWaConversation(waNewPhone.trim(), '');
                            setWaNewPhone('');
                          }
                        }}
                      />
                      <p className="text-xs text-muted-foreground">Presiona Enter para abrir la conversación</p>
                    </div>
                  )}
                  <div className="flex-1 overflow-y-auto">
                    {(() => {
                      const filtered = waSearch.trim()
                        ? waConversations.filter(c =>
                            c.phone_number.includes(waSearch) ||
                            c.contact_name.toLowerCase().includes(waSearch.toLowerCase()) ||
                            (c.alias && c.alias.toLowerCase().includes(waSearch.toLowerCase()))
                          )
                        : waConversations;
                      return filtered.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <div className="rounded-full bg-muted p-4">
                          <MessageCircle className="h-7 w-7 text-muted-foreground/50" />
                        </div>
                        <p className="text-sm font-medium">{waSearch ? 'Sin resultados' : 'Sin conversaciones'}</p>
                        <p className="text-xs text-muted-foreground text-center">{waSearch ? 'Intenta con otro nombre o número' : 'Presiona "+ Nuevo" para iniciar un chat'}</p>
                      </div>
                    ) : (
                      filtered.map(conv => {
                        const isEditingThis = waListEditPhone === conv.phone_number;
                        const displayName = conv.alias || conv.contact_name;

                        return isEditingThis ? (
                          // ── Fila en modo edición de alias ──
                          <div
                            key={conv.phone_number}
                            className="px-3 py-2 border-b bg-muted/30"
                            onClick={e => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              <div className="h-6 w-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                                <MessageCircle className="h-3 w-3 text-green-600" />
                              </div>
                              <span className="text-[10px] text-muted-foreground truncate">{conv.phone_number}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <input
                                autoFocus
                                className="flex-1 h-6 rounded border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                placeholder="Alias del contacto..."
                                value={waListEditInput}
                                onChange={e => setWaListEditInput(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleSaveListAlias();
                                  if (e.key === 'Escape') { setWaListEditPhone(null); setWaListEditInput(''); }
                                }}
                              />
                              <button
                                onClick={handleSaveListAlias}
                                disabled={waSavingAlias}
                                className="text-xs text-primary font-medium hover:underline disabled:opacity-50 shrink-0"
                              >
                                {waSavingAlias ? <Loader2 className="h-3 w-3 animate-spin inline" /> : 'OK'}
                              </button>
                              <button
                                onClick={() => { setWaListEditPhone(null); setWaListEditInput(''); }}
                                className="text-xs text-muted-foreground hover:text-foreground shrink-0"
                              >✕</button>
                            </div>
                          </div>
                        ) : (
                          // ── Fila normal con lápiz al hacer hover ──
                          <div
                            key={conv.phone_number}
                            className="group flex items-center gap-2 px-3 py-2.5 hover:bg-muted/50 border-b last:border-b-0"
                          >
                            <button
                              className="flex items-center gap-2 flex-1 min-w-0 text-left"
                              onClick={() => openWaConversation(conv.phone_number, conv.contact_name, conv.alias)}
                            >
                              <div className="h-7 w-7 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                                <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium truncate">
                                  {displayName}
                                  {conv.alias && (
                                    <span className="ml-1 text-[10px] text-muted-foreground font-normal">@</span>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">{conv.last_message}</div>
                              </div>
                              {conv.unread > 0 && (
                                <span className="text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 shrink-0">{conv.unread}</span>
                              )}
                            </button>
                            {/* Lápiz visible en hover */}
                            <button
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground shrink-0 p-0.5 rounded"
                              title="Editar alias"
                              onClick={e => {
                                e.stopPropagation();
                                setWaListEditPhone(conv.phone_number);
                                setWaListEditInput(conv.alias ?? '');
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      })
                    );
                    })()}
                  </div>
                </>
              )}
            </div>
          ) : isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Cargando...</span>
            </div>
          ) : activeTab === 'directos' ? (
            /* ========== TAB: DIRECTOS (WhatsApp-style contact list) ========== */
            (() => {
              const grouped = groupDirectsByContact(comments, user?.id);
              return grouped.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 px-8">
                  <div className="rounded-full bg-muted p-4">
                    <Users className="h-7 w-7 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium">Sin conversaciones</p>
                  <p className="text-xs text-muted-foreground text-center">Inicia un mensaje directo con el botón de abajo.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1.5 mt-1"
                    onClick={() => { setDirectMode(true); setDirectUserId(null); setDirectUserName(''); }}
                  >
                    <Users className="h-3.5 w-3.5" />
                    Nuevo mensaje
                  </Button>
                </div>
              ) : (
                <div className="py-1">
                  {/* New message button */}
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-accent/40 transition-colors"
                    onClick={() => { setDirectMode(true); setDirectUserId(null); setDirectUserName(''); }}
                  >
                    <div className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/10 shrink-0">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm font-medium text-primary">Nuevo mensaje</span>
                  </button>
                  <Separator className="mx-4" />
                  {grouped.map((comment, idx) => {
                    const isMe = comment.user_id === user?.id;
                    const contactId = isMe ? comment.commentable_id : comment.user_id;
                    const contactName = isMe
                      ? (comment.entity_reference || userList.find((u) => u.id === contactId)?.name || `Usuario #${contactId}`)
                      : comment.user.name;
                    return (
                      <div key={comment.id}>
                        {idx > 0 && <Separator className="mx-4" />}
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/40 transition-colors"
                          onClick={() => {
                            setDirectMode(true);
                            setDirectUserId(contactId);
                            setDirectUserName(contactName);
                          }}
                        >
                          <Avatar className="h-10 w-10 shrink-0">
                            <AvatarFallback className={cn('text-xs font-semibold text-white', getAvatarColor(contactId))}>
                              {getInitials(contactName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold truncate">{contactName}</span>
                              <span className="text-[11px] text-muted-foreground ml-auto shrink-0">{relativeTime(comment.created_at)}</span>
                            </div>
                            <p className="text-[12px] text-muted-foreground truncate mt-0.5">
                              {isMe ? 'Tú: ' : ''}{truncateBody(comment.body, 55)}
                            </p>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          ) : (
            /* ========== TAB: COMENTARIOS (grouped by entity) ========== */
            (() => {
              const grouped = groupByEntity(comments);
              return grouped.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 px-8">
                  <div className="rounded-full bg-muted p-4">
                    <MessageCircle className="h-7 w-7 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium">No hay comentarios aún</p>
                  <p className="text-xs text-muted-foreground text-center">Selecciona una entidad abajo y escribe el primer comentario.</p>
                </div>
              ) : (
                <div className="py-1">
                  {grouped.map((comment, idx) => {
                    const info = getEntityInfo(comment.commentable_type);
                    const isReplying = replyingTo === comment.id;
                    const isMe = comment.user_id === user?.id;
                    const ref = comment.entity_reference || `#${comment.commentable_id}`;

                    return (
                      <div key={comment.id}>
                        {idx > 0 && <Separator className="mx-4" />}
                        <div className="px-4 py-3 space-y-1.5">
                          {/* Header row */}
                          <div className="flex items-start gap-2.5">
                            <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                              <AvatarFallback className={cn('text-[10px] font-semibold text-white', getAvatarColor(comment.user.id))}>
                                {getInitials(comment.user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-semibold">{comment.user.name}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCommentClick(comment)}
                                  className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
                                >
                                  <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0 h-[17px] rounded border-0 cursor-pointer', info.color)}>
                                    {info.label}: {ref}
                                  </Badge>
                                  <ExternalLink className="h-3 w-3 text-muted-foreground/60" />
                                </button>
                                <span className="text-[11px] text-muted-foreground ml-auto shrink-0">{relativeTime(comment.created_at)}</span>
                              </div>
                              <p
                                className="text-[13px] text-foreground/80 leading-snug mt-0.5"
                                dangerouslySetInnerHTML={{ __html: renderBody(truncateBody(comment.body)) }}
                              />
                            </div>
                          </div>

                          {/* Replies */}
                          {comment.replies && comment.replies.length > 0 && (
                            <div className="ml-9 space-y-1.5 border-l-2 border-muted pl-3">
                              {comment.replies.map((reply) => (
                                <div key={reply.id} className="flex items-start gap-2">
                                  <Avatar className="h-5 w-5 shrink-0 mt-0.5">
                                    <AvatarFallback className={cn('text-[8px] text-white', getAvatarColor(reply.user.id))}>
                                      {getInitials(reply.user.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <span className="text-xs font-semibold">{reply.user.name} </span>
                                    <span className="text-[11px] text-muted-foreground">{relativeTime(reply.created_at)}</span>
                                    <p
                                      className="text-[12px] text-foreground/80 leading-snug"
                                      dangerouslySetInnerHTML={{ __html: renderBody(reply.body) }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Reply input */}
                          {isReplying && (
                            <div className="ml-9">
                              <Compose
                                placeholder="Responder... Usa @ para mencionar"
                                onSend={(body, mentions) => handleReply(comment.id, body, mentions)}
                                userList={userList}
                                autoFocus
                                onCancel={() => setReplyingTo(null)}
                              />
                            </div>
                          )}

                          {/* Actions */}
                          <div className="ml-9 flex items-center gap-1">
                            {!isReplying && (
                              <button
                                type="button"
                                onClick={() => setReplyingTo(comment.id)}
                                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted"
                              >
                                <CornerDownLeft className="h-3 w-3" />
                                Responder
                              </button>
                            )}
                            {isMe && !showArchived && (
                              <button
                                type="button"
                                onClick={() => handleArchive(comment.id)}
                                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted"
                              >
                                <Archive className="h-3 w-3" />
                                Archivar
                              </button>
                            )}
                            {showArchived && (
                              <button
                                type="button"
                                onClick={() => handleUnarchive(comment.id)}
                                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted"
                              >
                                <ArchiveRestore className="h-3 w-3" />
                                Desarchivar
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )}
        </div>

        {/* Compose new comment — hidden in archived view and directos tab (when not in thread) */}
        {!showArchived && (directMode || activeTab === 'comentarios') && <div className="border-t bg-muted/20 p-3 space-y-2 shrink-0 rounded-b-2xl overflow-visible relative">
          {directMode ? (
            /* Direct message compose */
            <Compose
              placeholder={directUserId ? `Mensaje a ${directUserName}...` : 'Selecciona un usuario...'}
              disabled={!directUserId}
              onSend={handleSendDirect}
              userList={userList}
            />
          ) : (
            <>
              {/* Entity selector */}
              <div className="flex items-center gap-2">
                {selectedEntity ? (
                  <Badge variant="secondary" className="text-xs gap-1 pr-1">
                    <Hash className="h-3 w-3" />
                    {selectedEntity.label}
                    <button onClick={() => setSelectedEntity(null)} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ) : (
                  <div className="relative">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => { setShowEntityPicker(!showEntityPicker); setPickerStep('type'); }}
                    >
                      <Hash className="h-3 w-3" /> Seleccionar entidad
                    </Button>

                    {showEntityPicker && (
                      <div
                        className="absolute bottom-full left-0 mb-1 w-60 bg-popover border rounded-lg shadow-lg z-50 overflow-hidden"
                      >
                        {pickerStep === 'type' ? (
                          <div className="p-1">
                            <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase">Tipo</p>
                            {ENTITY_TARGETS.map((t) => (
                              <button key={t.key}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded transition-colors"
                                onClick={() => { setPickerType(t.key); setPickerStep('search'); setEntitySearch(''); setEntityResults([]); }}
                              >
                                {t.label}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div>
                            <div className="p-2 border-b">
                              <input autoFocus
                                placeholder={`Buscar ${ENTITY_TARGETS.find((t) => t.key === pickerType)?.label}...`}
                                className="w-full text-sm px-2 py-1.5 border rounded bg-background outline-none focus:ring-1 focus:ring-primary"
                                value={entitySearch}
                                onChange={(e) => { setEntitySearch(e.target.value); if (e.target.value.length >= 1) searchEntities(pickerType, e.target.value); }}
                              />
                            </div>
                            <div className="max-h-40 overflow-auto p-1">
                              {entitySearchLoading ? (
                                <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin" /></div>
                              ) : entityResults.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-3">{entitySearch ? 'Sin resultados' : 'Escribe para buscar'}</p>
                              ) : (
                                entityResults.map((e: any) => {
                                  const display = e.reference || e.id || e.cedula || e.name || `#${e.id}`;
                                  const sub = e.lead?.name || (e.name && e.apellido1 ? `${e.name} ${e.apellido1}` : '');
                                  return (
                                    <button key={e.id}
                                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded transition-colors"
                                      onClick={() => selectEntityTarget(e)}
                                    >
                                      <span className="font-medium">{display}</span>
                                      {sub && <span className="text-muted-foreground ml-1.5 text-xs">{sub}</span>}
                                    </button>
                                  );
                                })
                              )}
                            </div>
                            <div className="border-t p-1">
                              <button className="w-full text-xs text-muted-foreground px-3 py-1.5 hover:bg-muted rounded"
                                onClick={() => setPickerStep('type')}>
                                ← Cambiar tipo
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Compose
                placeholder={selectedEntity ? 'Escribe tu comentario... Usa @ para mencionar' : 'Selecciona una entidad primero…'}
                disabled={!selectedEntity}
                onSend={handleSend}
                userList={userList}
              />
            </>
          )}
        </div>}
      </div>
    </>
  );
}
