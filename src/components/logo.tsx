"use client";

import Image from "next/image";
import { useSidebar } from "@/components/ui/sidebar";
import { Building2 } from "lucide-react";

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
    <div className="flex h-16 items-center justify-center p-2">
      {isCollapsed ? (
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Building2 className="h-6 w-6" />
        </div>
      ) : (
        <Image
          src="/logopepweb.png"
          alt="Credipep Logo"
          width={227}
          height={225}
          priority
        />
      )}
    </div>
  );
}
