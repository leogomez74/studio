'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageCircle,
  X,
  Loader2,
  ExternalLink,
  Send,
  Hash,
  AtSign,
  CornerDownLeft,
  Archive,
  ArchiveRestore,
  Inbox,
  Users,
  Search,
  ArrowLeft,
} from 'lucide-react';

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
}

interface Mention {
  type: string;
  id: number;
  label: string;
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
function renderBody(body: string) {
  // Replace @[Name](user:id) and #[Label](type:id) with styled spans
  return body.replace(/[@#]\[([^\]]+)\]\(\w+:\d+\)/g, (_, label) => `<span class="font-semibold text-primary">${'@' + label}</span>`);
}
function truncateBody(body: string, max = 80) {
  const clean = body.replace(/[@#]\[([^\]]+)\]\(\w+:\d+\)/g, (_, l) => l);
  return clean.length <= max ? clean : clean.slice(0, max).trimEnd() + '…';
}

// ---------------------------------------------------------------------------
// Sub-component: inline compose (new comment or reply)
// ---------------------------------------------------------------------------

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
  const ref = useRef<HTMLTextAreaElement>(null);

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

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
    if (e.key === 'Escape' && onCancel) onCancel();
  };

  return (
    <div className="relative flex items-end gap-1.5">
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
  const clickInsideRef = useRef(false);

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

  // Background badge
  useEffect(() => {
    if (isOpen) return;
    const check = async () => {
      try {
        const res = await api.get('/api/comments/recent', { params: { limit: 5 } });
        const data: Comment[] = Array.isArray(res.data) ? res.data : res.data.data ?? [];
        const ago5 = Date.now() - 5 * 60 * 1000;
        setUnreadCount(data.filter((c) => c.user_id !== user?.id && new Date(c.created_at).getTime() > ago5).length);
      } catch { /* silent */ }
    };
    check();
    const iv = setInterval(check, 60_000);
    return () => clearInterval(iv);
  }, [isOpen, user?.id]);

  // Outside click / Escape
  useEffect(() => {
    if (!isOpen) return;
    const click = () => {
      if (clickInsideRef.current) { clickInsideRef.current = false; return; }
      setIsOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('mousedown', click);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', click); document.removeEventListener('keydown', esc); };
  }, [isOpen]);

  // Fetch users when panel opens
  useEffect(() => {
    if (isOpen) api.get('/api/users').then((r) => setUserList(Array.isArray(r.data) ? r.data : r.data.data ?? [])).catch(() => {});
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
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold ring-2 ring-background">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      <div
        ref={panelRef}
        onMouseDown={() => { clickInsideRef.current = true; }}
        className={cn(
          'fixed bottom-6 right-6 z-50 w-[420px]',
          'rounded-2xl border bg-card shadow-2xl flex flex-col overflow-hidden',
          'transition-all duration-300 ease-out origin-bottom-right',
          isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-2 pointer-events-none'
        )}
        style={{ maxHeight: '540px' }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30 shrink-0">
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
                  <h3 className="text-sm font-semibold leading-tight">
                    {showArchived ? 'Archivados' : 'Comentarios'}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">Actividad interna del equipo</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg shrink-0"
                title="Mensaje directo"
                onClick={() => { setDirectMode(true); setDirectUserId(null); setDirectUserName(''); }}
              >
                <Users className="h-4 w-4" />
              </Button>
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
              <div className="py-1">
                {directComments.map((comment, idx) => (
                  <div key={comment.id}>
                    {idx > 0 && <Separator className="mx-4" />}
                    <div className="px-4 py-3">
                      <div className="flex items-start gap-2.5">
                        <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                          <AvatarFallback className={cn('text-[10px] font-semibold text-white', getAvatarColor(comment.user.id))}>
                            {getInitials(comment.user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold">{comment.user.name}</span>
                            <span className="text-[11px] text-muted-foreground ml-auto shrink-0">{relativeTime(comment.created_at)}</span>
                          </div>
                          <p className="text-[13px] text-foreground/80 leading-snug mt-0.5"
                            dangerouslySetInnerHTML={{ __html: renderBody(comment.body.startsWith('[GIF]') ? '🎞 GIF' : comment.body) }}
                          />
                          {comment.body.match(/^\[GIF\]\(([^)]+)\)$/) && (
                            <img src={comment.body.match(/^\[GIF\]\(([^)]+)\)$/)?.[1]} alt="GIF" className="rounded-lg max-w-[180px] max-h-[130px] object-cover mt-1" loading="lazy" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Cargando...</span>
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 px-8">
              <div className="rounded-full bg-muted p-4">
                <MessageCircle className="h-7 w-7 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium">No hay comentarios aún</p>
              <p className="text-xs text-muted-foreground text-center">Selecciona una entidad abajo y escribe el primer comentario.</p>
            </div>
          ) : (
            <div className="py-1">
              {comments.map((comment, idx) => {
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
                            {/* Entity badge with real reference */}
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
                          {/* Body */}
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
          )}
        </div>

        {/* Compose new comment — hidden in archived view */}
        {!showArchived && <div className="border-t bg-muted/20 p-3 space-y-2 shrink-0">
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
