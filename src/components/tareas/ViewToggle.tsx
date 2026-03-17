"use client"

import { List, LayoutGrid, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { TaskView } from "@/types/tasks"

interface ViewToggleProps {
  view: TaskView
  onChange: (view: TaskView) => void
}

const views: { value: TaskView; icon: React.ElementType; label: string }[] = [
  { value: "list", icon: List, label: "Lista" },
  { value: "board", icon: LayoutGrid, label: "Tablero" },
  { value: "calendar", icon: Calendar, label: "Calendario" },
]

export function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div className="inline-flex items-center rounded-lg border bg-muted p-1">
      {views.map((v) => (
        <Button
          key={v.value}
          variant={view === v.value ? "default" : "ghost"}
          size="sm"
          className="h-8 px-3 gap-1.5"
          onClick={() => onChange(v.value)}
        >
          <v.icon className="h-4 w-4" />
          <span className="hidden sm:inline text-xs">{v.label}</span>
        </Button>
      ))}
    </div>
  )
}
