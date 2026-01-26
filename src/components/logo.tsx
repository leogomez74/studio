"use client";

import Image from "next/image";
import { useSidebar } from "@/components/ui/sidebar";

export function Logo() {
  // Try to get sidebar context, but don't fail if it's not available
  let isCollapsed = false;
  try {
    const { state } = useSidebar();
    isCollapsed = state === "collapsed";
  } catch (error) {
    // SidebarProvider not available (e.g., during SSR/build)
    // Default to expanded state
  }

  return (
    <div className="flex items-center justify-center py-4 px-2">
      {isCollapsed ? (
        <div className="flex h-10 w-10 items-center justify-center">
          <Image
            src="/logopepweb.png"
            alt="Credipep Logo"
            width={36}
            height={36}
            priority
            className="object-contain"
          />
        </div>
      ) : (
        <div className="flex items-center gap-3 px-2">
          <Image
            src="/logopepweb.png"
            alt="Credipep Logo"
            width={140}
            height={40}
            priority
            className="object-contain"
          />
        </div>
      )}
    </div>
  );
}
