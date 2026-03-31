'use client';

import { usePathname } from 'next/navigation';
import { ChatBubble } from '@/components/chat-bubble';

export function ChatBubbleWrapper() {
  const pathname = usePathname();
  if (pathname === '/dashboard/comunicaciones') return null;
  return <ChatBubble />;
}
