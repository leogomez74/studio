'use client';

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  Send,
  Trash2,
  Loader2,
  MessageSquare,
  AtSign,
  Hash,
} from 'lucide-react';

import api from '@/lib/axios';
import { useAuth } from '@/components/auth-guard';
import { useDebounce } from '@/hooks/use-debounce';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommentsPanelProps {
  commentableType: 'credit' | 'opportunity' | 'lead' | 'client' | 'analisis';
  commentableId: number;
}

interface Mention {
  type: 'user' | 'opportunity' | 'credit' | 'lead' | 'analisis' | 'client';
  id: number;
  label: string;
}

interface Comment {
  id: number;
  body: string;
  mentions: Mention[];
  user_id: number;
  user: { id: number; name: string };
  created_at: string;
}

interface UserOption {
  id: number;
  name: string;
}

type DropdownKind =
  | 'user'
  | 'oportunidad'
  | 'credito'
  | 'lead'
  | 'analisis'
  | 'cliente';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-indigo-500',
  'bg-teal-500',
  'bg-pink-500',
  'bg-orange-500',
];

const TAG_TRIGGERS: Record<string, DropdownKind> = {
  '#oportunidad': 'oportunidad',
  '#credito': 'credito',
  '#lead': 'lead',
  '#analisis': 'analisis',
  '#cliente': 'cliente',
};

const ENTITY_ROUTES: Record<string, string> = {
  opportunity: '/dashboard/oportunidades',
  credit: '/dashboard/creditos',
  lead: '/dashboard/leads',
  analisis: '/dashboard/analizados',
  client: '/dashboard/leads',
};

const DROPDOWN_KIND_TO_MENTION_TYPE: Record<DropdownKind, Mention['type']> = {
  user: 'user',
  oportunidad: 'opportunity',
  credito: 'credit',
  lead: 'lead',
  analisis: 'analisis',
  cliente: 'client',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function getAvatarColor(userId: number): string {
  return AVATAR_COLORS[userId % AVATAR_COLORS.length];
}

function relativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'ahora';
  if (diffMin === 1) return 'hace 1 min';
  if (diffMin < 60) return `hace ${diffMin} min`;
  if (diffHr === 1) return 'hace 1 hora';
  if (diffHr < 24) return `hace ${diffHr} horas`;
  if (diffDay === 1) return 'ayer';
  if (diffDay < 7) return `hace ${diffDay} dias`;
  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Parse a comment body that may contain mention placeholders such as:
 *   @[Carlos Mendez](user:5)
 *   #[26-00177-01-CRED](credit:177)
 *
 * Returns an array of segments that are either plain text or mentions.
 */
function parseBody(
  body: string,
  mentions: Mention[]
): Array<{ kind: 'text'; value: string } | { kind: 'mention'; mention: Mention }> {
  const mentionPattern = /(@|#)\[([^\]]+)\]\((\w+):(\d+)\)/g;
  const segments: Array<
    { kind: 'text'; value: string } | { kind: 'mention'; mention: Mention }
  > = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mentionPattern.exec(body)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ kind: 'text', value: body.slice(lastIndex, match.index) });
    }

    const type = match[3] as Mention['type'];
    const id = parseInt(match[4], 10);
    const label = match[2];

    // Try to find a richer mention from the mentions array
    const richMention = mentions.find((m) => m.type === type && m.id === id);
    segments.push({
      kind: 'mention',
      mention: richMention ?? { type, id, label },
    });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < body.length) {
    segments.push({ kind: 'text', value: body.slice(lastIndex) });
  }

  return segments;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MentionLink({
  mention,
  onClick,
}: {
  mention: Mention;
  onClick: () => void;
}) {
  const isUser = mention.type === 'user';
  const prefix = isUser ? '@' : '#';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-sm font-medium',
        'bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700',
        'dark:bg-blue-950/40 dark:text-blue-400 dark:hover:bg-blue-950/60',
        'transition-colors cursor-pointer'
      )}
    >
      {isUser ? (
        <AtSign className="h-3 w-3 shrink-0" />
      ) : (
        <Hash className="h-3 w-3 shrink-0" />
      )}
      <span>{mention.label}</span>
    </button>
  );
}

function CommentBubble({
  comment,
  isOwn,
  onDelete,
  onMentionClick,
}: {
  comment: Comment;
  isOwn: boolean;
  onDelete: (id: number) => void;
  onMentionClick: (mention: Mention) => void;
}) {
  const [showDelete, setShowDelete] = useState(false);
  const segments = useMemo(
    () => parseBody(comment.body, comment.mentions ?? []),
    [comment.body, comment.mentions]
  );

  return (
    <div
      className={cn(
        'group relative flex items-start gap-3 rounded-lg px-3 py-2.5',
        'transition-colors duration-150',
        'hover:bg-muted/50'
      )}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
    >
      {/* Avatar */}
      <Avatar className="h-8 w-8 shrink-0 mt-0.5">
        <AvatarFallback
          className={cn(
            'text-xs font-semibold text-white',
            getAvatarColor(comment.user.id)
          )}
        >
          {getInitials(comment.user.name)}
        </AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground truncate">
            {comment.user.name}
          </span>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {relativeTime(comment.created_at)}
          </span>
        </div>
        <div className="mt-0.5 text-sm text-foreground/90 leading-relaxed break-words">
          {segments.map((seg, i) =>
            seg.kind === 'text' ? (
              <span key={i}>{seg.value}</span>
            ) : (
              <MentionLink
                key={i}
                mention={seg.mention}
                onClick={() => onMentionClick(seg.mention)}
              />
            )
          )}
        </div>
      </div>

      {/* Delete button */}
      {isOwn && showDelete && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(comment.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Eliminar comentario</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

function DropdownItem({
  label,
  sublabel,
  isHighlighted,
  onSelect,
  onMouseEnter,
}: {
  label: string;
  sublabel?: string;
  isHighlighted: boolean;
  onSelect: () => void;
  onMouseEnter: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
        isHighlighted
          ? 'bg-accent text-accent-foreground'
          : 'text-foreground hover:bg-accent/50'
      )}
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
    >
      <span className="font-medium truncate">{label}</span>
      {sublabel && (
        <span className="ml-auto text-xs text-muted-foreground truncate">
          {sublabel}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CommentsPanel({
  commentableType,
  commentableId,
}: CommentsPanelProps) {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  // ---- State: comments ----
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);

  // ---- State: input ----
  const [body, setBody] = useState('');
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [isSending, setIsSending] = useState(false);

  // ---- State: dropdown ----
  const [dropdownKind, setDropdownKind] = useState<DropdownKind | null>(null);
  const [dropdownQuery, setDropdownQuery] = useState('');
  const [dropdownItems, setDropdownItems] = useState<
    Array<{ id: number; label: string; sublabel?: string }>
  >([]);
  const [dropdownIndex, setDropdownIndex] = useState(0);
  const [isDropdownLoading, setIsDropdownLoading] = useState(false);
  const [triggerStart, setTriggerStart] = useState<number | null>(null);

  const debouncedQuery = useDebounce(dropdownQuery, 250);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  // ---- Fetch comments ----
  const fetchComments = useCallback(async () => {
    try {
      const res = await api.get('/api/comments', {
        params: {
          commentable_type: commentableType,
          commentable_id: commentableId,
        },
      });
      const data: Comment[] = Array.isArray(res.data)
        ? res.data
        : res.data.data ?? [];
      setComments(data);
    } catch (err) {
      console.error('Error loading comments:', err);
    } finally {
      setIsLoading(false);
    }
  }, [commentableType, commentableId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Auto-scroll to bottom when new comments arrive
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  // ---- Create comment ----
  const handleSend = useCallback(async () => {
    const trimmed = body.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    try {
      await api.post('/api/comments', {
        commentable_type: commentableType,
        commentable_id: commentableId,
        body: trimmed,
        mentions,
      });
      setBody('');
      setMentions([]);
      await fetchComments();
    } catch (err) {
      console.error('Error creating comment:', err);
      toast({
        title: 'Error',
        description: 'No se pudo enviar el comentario.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  }, [body, mentions, commentableType, commentableId, isSending, fetchComments, toast]);

  // ---- Delete comment ----
  const handleDelete = useCallback(
    async (id: number) => {
      setIsDeleting(id);
      try {
        await api.delete(`/api/comments/${id}`);
        setComments((prev) => prev.filter((c) => c.id !== id));
      } catch (err) {
        console.error('Error deleting comment:', err);
        toast({
          title: 'Error',
          description: 'No se pudo eliminar el comentario.',
          variant: 'destructive',
        });
      } finally {
        setIsDeleting(null);
      }
    },
    [toast]
  );

  // ---- Mention click navigation ----
  const handleMentionClick = useCallback(
    (mention: Mention) => {
      const route = ENTITY_ROUTES[mention.type];
      if (route) {
        router.push(`${route}/${mention.id}`);
      }
    },
    [router]
  );

  // ---- Dropdown: detect trigger ----
  const detectTrigger = useCallback(
    (value: string, cursorPos: number) => {
      const textUpToCursor = value.slice(0, cursorPos);

      // Check for @mention
      const atMatch = textUpToCursor.match(/@(\w*)$/);
      if (atMatch) {
        setDropdownKind('user');
        setDropdownQuery(atMatch[1]);
        setTriggerStart(cursorPos - atMatch[0].length);
        setDropdownIndex(0);
        return;
      }

      // Check for #tag triggers
      for (const [trigger, kind] of Object.entries(TAG_TRIGGERS)) {
        // Match patterns like #credito, #credito:, #credito:searchterm
        const escapedTrigger = trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`${escapedTrigger}(?::?(\\S*))?$`);
        const tagMatch = textUpToCursor.match(regex);
        if (tagMatch) {
          setDropdownKind(kind);
          setDropdownQuery(tagMatch[1] ?? '');
          setTriggerStart(cursorPos - tagMatch[0].length);
          setDropdownIndex(0);
          return;
        }
      }

      // No trigger found
      setDropdownKind(null);
      setDropdownQuery('');
      setTriggerStart(null);
    },
    []
  );

  // ---- Dropdown: fetch items ----
  useEffect(() => {
    if (!dropdownKind) {
      setDropdownItems([]);
      return;
    }

    let cancelled = false;

    const fetchItems = async () => {
      setIsDropdownLoading(true);
      try {
        let items: Array<{ id: number; label: string; sublabel?: string }> = [];

        if (dropdownKind === 'user') {
          const res = await api.get('/api/users');
          const users: UserOption[] = Array.isArray(res.data)
            ? res.data
            : res.data.data ?? [];
          items = users
            .filter((u) =>
              u.name.toLowerCase().includes(debouncedQuery.toLowerCase())
            )
            .map((u) => ({ id: u.id, label: u.name }));
        } else {
          let endpoint = '';
          const params: Record<string, string> = {};

          switch (dropdownKind) {
            case 'oportunidad':
              endpoint = '/api/opportunities';
              if (debouncedQuery) params.search = debouncedQuery;
              break;
            case 'credito':
              endpoint = '/api/credits';
              if (debouncedQuery) params.search = debouncedQuery;
              break;
            case 'lead':
              endpoint = '/api/leads';
              if (debouncedQuery) params.search = debouncedQuery;
              break;
            case 'analisis':
              endpoint = '/api/analisis';
              if (debouncedQuery) params.search = debouncedQuery;
              break;
            case 'cliente':
              endpoint = '/api/leads';
              params.type = 'client';
              if (debouncedQuery) params.search = debouncedQuery;
              break;
          }

          if (endpoint) {
            const res = await api.get(endpoint, { params });
            const data = Array.isArray(res.data)
              ? res.data
              : res.data.data ?? [];
            items = data.slice(0, 10).map((item: any) => {
              const reference =
                item.custom_id ?? item.reference ?? item.cedula ?? `#${item.id}`;
              const name = item.name ?? item.full_name ?? item.nombre ?? '';
              return {
                id: item.id,
                label: String(reference),
                sublabel: name ? String(name) : undefined,
              };
            });
          }
        }

        if (!cancelled) {
          setDropdownItems(items);
          setDropdownIndex(0);
        }
      } catch (err) {
        console.error('Error fetching dropdown items:', err);
        if (!cancelled) setDropdownItems([]);
      } finally {
        if (!cancelled) setIsDropdownLoading(false);
      }
    };

    fetchItems();
    return () => {
      cancelled = true;
    };
  }, [dropdownKind, debouncedQuery]);

  // ---- Dropdown: select item ----
  const selectDropdownItem = useCallback(
    (item: { id: number; label: string; sublabel?: string }) => {
      if (triggerStart === null || !dropdownKind) return;

      const mentionType = DROPDOWN_KIND_TO_MENTION_TYPE[dropdownKind];
      const isUser = dropdownKind === 'user';
      const prefix = isUser ? '@' : '#';
      const placeholder = `${prefix}[${item.label}](${mentionType}:${item.id})`;

      // Replace the trigger text with the placeholder
      const before = body.slice(0, triggerStart);
      const textarea = textareaRef.current;
      const cursorPos = textarea?.selectionStart ?? body.length;
      const after = body.slice(cursorPos);

      const newBody = `${before}${placeholder} ${after}`;
      setBody(newBody);

      // Track the mention
      setMentions((prev) => [
        ...prev,
        { type: mentionType, id: item.id, label: item.label },
      ]);

      // Close dropdown
      setDropdownKind(null);
      setDropdownQuery('');
      setTriggerStart(null);

      // Refocus textarea
      requestAnimationFrame(() => {
        const newCursorPos = before.length + placeholder.length + 1;
        textarea?.focus();
        textarea?.setSelectionRange(newCursorPos, newCursorPos);
      });
    },
    [body, triggerStart, dropdownKind]
  );

  // ---- Input handlers ----
  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setBody(value);
      detectTrigger(value, e.target.selectionStart ?? value.length);
    },
    [detectTrigger]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Dropdown navigation
      if (dropdownKind && dropdownItems.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setDropdownIndex((prev) =>
            prev < dropdownItems.length - 1 ? prev + 1 : 0
          );
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setDropdownIndex((prev) =>
            prev > 0 ? prev - 1 : dropdownItems.length - 1
          );
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          selectDropdownItem(dropdownItems[dropdownIndex]);
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setDropdownKind(null);
          setDropdownQuery('');
          setTriggerStart(null);
          return;
        }
      }

      // Send on Enter (without Shift)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [dropdownKind, dropdownItems, dropdownIndex, selectDropdownItem, handleSend]
  );

  // ---- Auto-resize textarea ----
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [body]);

  // ---- Close dropdown on outside click ----
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setDropdownKind(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ---- Render ----
  return (
    <div className="flex flex-col h-full rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Comentarios</h3>
        {!isLoading && (
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {comments.length}
          </span>
        )}
      </div>

      {/* Comments list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="py-2">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Cargando comentarios...
              </span>
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 px-4">
              <div className="rounded-full bg-muted p-3">
                <MessageSquare className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  No hay comentarios aun.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Se el primero en comentar.
                </p>
              </div>
            </div>
          ) : (
            <>
              {comments.map((comment, idx) => (
                <div key={comment.id}>
                  {idx > 0 && <Separator className="mx-3 my-0.5" />}
                  <div
                    className={cn(
                      isDeleting === comment.id && 'opacity-50 pointer-events-none'
                    )}
                  >
                    <CommentBubble
                      comment={comment}
                      isOwn={user?.id === comment.user_id}
                      onDelete={handleDelete}
                      onMentionClick={handleMentionClick}
                    />
                  </div>
                </div>
              ))}
              <div ref={scrollEndRef} />
            </>
          )}
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="border-t bg-background p-3 relative">
        {/* Dropdown */}
        {dropdownKind && (
          <div
            ref={dropdownRef}
            className={cn(
              'absolute bottom-full left-3 right-3 mb-1 z-50',
              'rounded-lg border bg-popover shadow-lg',
              'max-h-52 overflow-hidden'
            )}
          >
            <div className="px-3 py-2 border-b">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {dropdownKind === 'user' && 'Usuarios'}
                {dropdownKind === 'oportunidad' && 'Oportunidades'}
                {dropdownKind === 'credito' && 'Creditos'}
                {dropdownKind === 'lead' && 'Leads'}
                {dropdownKind === 'analisis' && 'Analisis'}
                {dropdownKind === 'cliente' && 'Clientes'}
              </span>
            </div>
            <ScrollArea className="max-h-40">
              {isDropdownLoading ? (
                <div className="flex items-center justify-center py-4 gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Buscando...</span>
                </div>
              ) : dropdownItems.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  Sin resultados
                </div>
              ) : (
                dropdownItems.map((item, idx) => (
                  <DropdownItem
                    key={item.id}
                    label={item.label}
                    sublabel={item.sublabel}
                    isHighlighted={idx === dropdownIndex}
                    onSelect={() => selectDropdownItem(item)}
                    onMouseEnter={() => setDropdownIndex(idx)}
                  />
                ))
              )}
            </ScrollArea>
          </div>
        )}

        {/* Textarea + Send */}
        <div className="flex items-end gap-2">
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              value={body}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Escribe un comentario... Usa @ para mencionar o # para enlazar"
              disabled={isSending}
              rows={1}
              className={cn(
                'flex w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm',
                'ring-offset-background placeholder:text-muted-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'resize-none overflow-hidden transition-all',
                'min-h-[40px] max-h-[160px]'
              )}
            />
          </div>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  className="h-10 w-10 shrink-0 rounded-lg"
                  onClick={handleSend}
                  disabled={!body.trim() || isSending}
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Enviar <kbd className="ml-1 text-xs opacity-60">Enter</kbd>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Help text */}
        <p className="mt-1.5 text-[11px] text-muted-foreground/70 leading-tight">
          <kbd className="font-mono text-[10px] border rounded px-1 py-0.5 bg-muted">@</kbd>{' '}
          mencionar usuario{' '}
          <span className="mx-1 text-muted-foreground/40">|</span>
          <kbd className="font-mono text-[10px] border rounded px-1 py-0.5 bg-muted">#credito</kbd>{' '}
          <kbd className="font-mono text-[10px] border rounded px-1 py-0.5 bg-muted">#oportunidad</kbd>{' '}
          <kbd className="font-mono text-[10px] border rounded px-1 py-0.5 bg-muted">#lead</kbd>{' '}
          enlazar entidades
        </p>
      </div>
    </div>
  );
}
