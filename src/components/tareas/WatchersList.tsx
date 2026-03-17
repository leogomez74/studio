"use client"

import { useState } from "react"
import { Eye, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { TaskWatcher } from "@/types/tasks"

interface WatchersListProps {
  watchers: TaskWatcher[]
  users: { id: number; name: string }[]
  onAdd: (userId: number) => void
  onRemove: (userId: number) => void
  disabled?: boolean
}

export function WatchersList({ watchers, users, onAdd, onRemove, disabled }: WatchersListProps) {
  const [adding, setAdding] = useState(false)

  const availableUsers = users.filter(
    (u) => !watchers.some((w) => w.user_id === u.id)
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Eye className="h-4 w-4" />
          Observadores
        </div>
        {!disabled && availableUsers.length > 0 && (
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setAdding(!adding)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {adding && (
        <Select
          onValueChange={(value) => {
            onAdd(parseInt(value))
            setAdding(false)
          }}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Agregar observador..." />
          </SelectTrigger>
          <SelectContent>
            {availableUsers.map((u) => (
              <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {watchers.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground">Sin observadores</p>
      )}

      <div className="space-y-1">
        {watchers.map((w) => (
          <div key={w.user_id} className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1.5">
            <span>{w.user?.name || `Usuario #${w.user_id}`}</span>
            {!disabled && (
              <button onClick={() => onRemove(w.user_id)} className="text-muted-foreground hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
