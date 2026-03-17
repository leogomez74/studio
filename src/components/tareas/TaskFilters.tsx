"use client"

import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import type { TaskWorkflow, TaskLabel } from "@/types/tasks"

interface TaskFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  status: string
  onStatusChange: (value: string) => void
  priority: string
  onPriorityChange: (value: string) => void
  assignedTo: string
  onAssignedToChange: (value: string) => void
  workflowId: string
  onWorkflowChange: (value: string) => void
  labelId: string
  onLabelChange: (value: string) => void
  users: { id: number; name: string }[]
  workflows: TaskWorkflow[]
  labels: TaskLabel[]
  onClear: () => void
}

export function TaskFilters({
  search, onSearchChange,
  status, onStatusChange,
  priority, onPriorityChange,
  assignedTo, onAssignedToChange,
  workflowId, onWorkflowChange,
  labelId, onLabelChange,
  users, workflows, labels,
  onClear,
}: TaskFiltersProps) {
  const hasFilters = search || status || priority || assignedTo || workflowId || labelId

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar tareas..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className="w-[140px] h-9">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="pendiente">Pendiente</SelectItem>
          <SelectItem value="en_progreso">En Progreso</SelectItem>
          <SelectItem value="completada">Completada</SelectItem>
          <SelectItem value="archivada">Archivada</SelectItem>
        </SelectContent>
      </Select>

      <Select value={priority} onValueChange={onPriorityChange}>
        <SelectTrigger className="w-[130px] h-9">
          <SelectValue placeholder="Prioridad" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          <SelectItem value="alta">Alta</SelectItem>
          <SelectItem value="media">Media</SelectItem>
          <SelectItem value="baja">Baja</SelectItem>
        </SelectContent>
      </Select>

      <Select value={assignedTo} onValueChange={onAssignedToChange}>
        <SelectTrigger className="w-[160px] h-9">
          <SelectValue placeholder="Responsable" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {users.map((u) => (
            <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {workflows.length > 1 && (
        <Select value={workflowId} onValueChange={onWorkflowChange}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Flujo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {workflows.map((w) => (
              <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {labels.length > 0 && (
        <Select value={labelId} onValueChange={onLabelChange}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="Etiqueta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {labels.map((l) => (
              <SelectItem key={l.id} value={String(l.id)}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                  {l.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onClear} className="h-9 px-2">
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
