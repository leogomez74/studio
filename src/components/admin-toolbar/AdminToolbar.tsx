'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Settings2, Zap, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/components/auth-guard';
import { cn } from '@/lib/utils';
import { getModuleFromPathname } from './module-event-map';
import { useTaskAutomations } from '@/hooks/use-task-automations';
import { useDraggableWidget } from '@/hooks/use-draggable-widget';
import { AutoTasksSheet } from './AutoTasksSheet';

/**
 * Widget flotante admin arrastrable.
 * Solo visible para usuarios con full_access.
 * Mantener presionado 1.5s para activar drag libre.
 * Posición persistida en localStorage.
 */
export function AdminToolbar() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  if (!user?.role?.full_access) return null;

  const module = getModuleFromPathname(pathname);
  const eventTypeKeys = module?.eventTypes.map((e) => e.key) ?? [];

  return (
    <>
      <AdminToolbarInner
        moduleName={module?.name ?? null}
        eventTypeKeys={eventTypeKeys}
        expanded={expanded}
        onToggle={() => setExpanded((prev) => !prev)}
        onOpenSheet={() => { setSheetOpen(true); setExpanded(false); }}
      />
      {module && (
        <AutoTasksSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          module={module}
        />
      )}
    </>
  );
}

function AdminToolbarInner({
  moduleName,
  eventTypeKeys,
  expanded,
  onToggle,
  onOpenSheet,
}: {
  moduleName: string | null;
  eventTypeKeys: string[];
  expanded: boolean;
  onToggle: () => void;
  onOpenSheet: () => void;
}) {
  const { automations } = useTaskAutomations(eventTypeKeys.length > 0 ? eventTypeKeys : undefined);
  const activeCount = automations.filter((a) => a.is_active).length;
  const hasModule = moduleName !== null && eventTypeKeys.length > 0;
  const totalCount = automations.length;
  const containerRef = useRef<HTMLDivElement>(null);

  const { position, isDragging, isLongPressing, dragHandlers } = useDraggableWidget();

  // Cerrar al hacer clic fuera (solo cuando está expandido y no arrastrando)
  useEffect(() => {
    if (!expanded) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onToggle();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [expanded, onToggle]);

  // Determinar si la tarjeta debe expandirse hacia arriba o hacia abajo
  // según la posición vertical del widget en el viewport
  const expandUp = typeof window !== 'undefined' ? position.y > window.innerHeight / 2 : true;

  return (
    <div
      ref={containerRef}
      style={{ left: position.x, top: position.y }}
      className={cn(
        'fixed z-50',
        'transition-opacity duration-150',
        isDragging && 'opacity-80',
      )}
      {...dragHandlers}
    >
      {/* Pill / botón flotante — anchor fijo */}
      <button
        onClick={isDragging ? undefined : onToggle}
        className={cn(
          'flex items-center gap-2.5 rounded-full border shadow-lg px-4 py-2.5 text-sm font-medium',
          'transition-all duration-200 hover:shadow-xl',
          !isDragging && 'active:scale-95',
          expanded
            ? 'bg-primary text-primary-foreground border-primary'
            : 'bg-background text-foreground border-border hover:bg-muted',
          isLongPressing && 'ring-2 ring-primary ring-offset-2 animate-pulse',
          isDragging && 'cursor-grabbing shadow-2xl scale-105',
          !isDragging && !isLongPressing && 'cursor-pointer',
        )}
      >
        <Settings2 className="h-4 w-4 shrink-0" />
        <span>Admin</span>
        {hasModule && activeCount > 0 && !expanded && (
          <Badge
            variant="default"
            className="h-5 px-1.5 text-xs rounded-full bg-amber-500 hover:bg-amber-500 text-white border-0"
          >
            {activeCount}
          </Badge>
        )}
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 transition-transform duration-200',
            expanded && 'rotate-180'
          )}
        />
      </button>

      {/* Tarjeta expandida — absolute relativa al pill, no afecta su posición */}
      {expanded && (
        <div
          className={cn(
            'absolute right-0 w-72 rounded-xl border bg-background shadow-xl ring-1 ring-border overflow-hidden',
            expandUp ? 'bottom-full mb-2' : 'top-full mt-2',
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Settings2 className="h-3.5 w-3.5" />
              </div>
              <span className="text-sm font-semibold">Panel Admin</span>
            </div>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onToggle}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Módulo actual */}
          <div className="px-4 py-3 space-y-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Módulo activo</p>
              <p className="text-sm font-semibold">{moduleName ?? 'General'}</p>
            </div>

            {/* Auto-tareas */}
            {hasModule ? (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-xs font-medium">Auto-tareas</span>
                  </div>
                  <Badge
                    variant={activeCount > 0 ? 'default' : 'secondary'}
                    className="text-xs h-5"
                  >
                    {activeCount}/{totalCount} activas
                  </Badge>
                </div>
                <Button size="sm" className="w-full h-8 text-sm" onClick={onOpenSheet}>
                  Gestionar automatizaciones
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-3 text-center">
                <p className="text-xs text-muted-foreground">
                  Sin auto-tareas configurables<br />en este módulo
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
