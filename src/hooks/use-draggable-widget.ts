import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'admin-toolbar-pos';
const LONG_PRESS_MS = 1500;
const DRAG_THRESHOLD_PX = 5;

interface Position {
  x: number;
  y: number;
}

function getInitialPosition(): Position {
  if (typeof window === 'undefined') return { x: 0, y: 0 };

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Position;
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
        return clampToViewport(parsed);
      }
    }
  } catch {
    // ignorar errores de localStorage
  }

  // Posición por defecto: bottom-24 right-6 (equivalente a bottom: 96px, right: 24px)
  return {
    x: window.innerWidth - 24 - 160, // 160px = ancho estimado del pill
    y: window.innerHeight - 96 - 48, // 48px = alto estimado del pill
  };
}

function clampToViewport(pos: Position): Position {
  const margin = 12;
  return {
    x: Math.min(Math.max(pos.x, margin), window.innerWidth - margin - 160),
    y: Math.min(Math.max(pos.y, margin), window.innerHeight - margin - 48),
  };
}

export function useDraggableWidget() {
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isLongPressing, setIsLongPressing] = useState(false);

  // Inicializar posición en el cliente
  useEffect(() => {
    setPosition(getInitialPosition());
  }, []);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragActive = useRef(false);
  const startPointer = useRef<Position>({ x: 0, y: 0 });
  const startWidget = useRef<Position>({ x: 0, y: 0 });

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setIsLongPressing(false);
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Solo botón principal o touch
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      startPointer.current = { x: e.clientX, y: e.clientY };
      startWidget.current = position;
      dragActive.current = false;
      setIsLongPressing(true);

      longPressTimer.current = setTimeout(() => {
        dragActive.current = true;
        setIsDragging(true);
        setIsLongPressing(false);
        // Vibración en móvil
        if (navigator.vibrate) navigator.vibrate(50);
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      }, LONG_PRESS_MS);
    },
    [position],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const dx = e.clientX - startPointer.current.x;
      const dy = e.clientY - startPointer.current.y;

      // Si el puntero se movió demasiado antes de activarse el drag → cancelar long press
      if (!dragActive.current) {
        if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
          cancelLongPress();
        }
        return;
      }

      const newPos = clampToViewport({
        x: startWidget.current.x + dx,
        y: startWidget.current.y + dy,
      });
      setPosition(newPos);
    },
    [cancelLongPress],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      cancelLongPress();

      if (!dragActive.current) return;

      dragActive.current = false;
      setIsDragging(false);

      const finalPos = clampToViewport({
        x: startWidget.current.x + (e.clientX - startPointer.current.x),
        y: startWidget.current.y + (e.clientY - startPointer.current.y),
      });

      setPosition(finalPos);

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(finalPos));
      } catch {
        // ignorar errores de localStorage
      }
    },
    [cancelLongPress],
  );

  // Limpiar timer al desmontar
  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, []);

  return {
    position,
    isDragging,
    isLongPressing,
    dragHandlers: { onPointerDown, onPointerMove, onPointerUp },
  };
}
