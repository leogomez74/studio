"use client"

import { QuickTaskModal, useQuickTaskShortcut } from "./QuickTaskModal"

export function GlobalQuickTask() {
  const { open, setOpen } = useQuickTaskShortcut()

  return <QuickTaskModal open={open} onOpenChange={setOpen} />
}
