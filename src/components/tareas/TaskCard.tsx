"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Clock, AlertTriangle, User } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { LabelBadge } from "./LabelBadge"
import type { TaskItem } from "@/types/tasks"

interface TaskCardProps {
  task: TaskItem
  onClick?: () => void
  isDragging?: boolean
}

export function TaskCard({ task, onClick, isDragging }: TaskCardProps) {
  const isOverdue = task.due_date && !task.completed_at &&
    new Date(task.due_date) < new Date()

  const priorityColors: Record<string, string> = {
    alta: "bg-red-100 text-red-700 border-red-200",
    media: "bg-blue-100 text-blue-700 border-blue-200",
    baja: "bg-green-100 text-green-700 border-green-200",
  }

  return (
    <div
      onClick={onClick}
      className={`rounded-lg border bg-card p-3 shadow-sm cursor-pointer transition-all hover:shadow-md ${
        isDragging ? "opacity-50 rotate-2 shadow-lg" : ""
      } ${isOverdue ? "border-red-300" : ""}`}
    >
      {/* Reference & Priority */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] text-muted-foreground font-mono">{task.reference}</span>
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${priorityColors[task.priority] || ""}`}>
          {task.priority}
        </Badge>
      </div>

      {/* Title */}
      <p className="text-sm font-medium leading-tight mb-2 line-clamp-2">{task.title}</p>

      {/* Labels */}
      {task.labels && task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.labels.slice(0, 3).map((label) => (
            <LabelBadge key={label.id} label={label} size="sm" />
          ))}
          {task.labels.length > 3 && (
            <span className="text-[10px] text-muted-foreground">+{task.labels.length - 3}</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1">
          {task.assignee ? (
            <>
              <User className="h-3 w-3" />
              <span className="truncate max-w-[80px]">{task.assignee.name.split(" ")[0]}</span>
            </>
          ) : (
            <span className="italic">Sin asignar</span>
          )}
        </div>

        {task.due_date && (
          <div className={`flex items-center gap-1 ${isOverdue ? "text-red-600 font-medium" : ""}`}>
            {isOverdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            <span>{new Date(task.due_date).toLocaleDateString("es-CR", { day: "2-digit", month: "short" })}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// Sortable wrapper for Kanban
export function SortableTaskCard({ task, onClick }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} onClick={onClick} isDragging={isDragging} />
    </div>
  )
}
