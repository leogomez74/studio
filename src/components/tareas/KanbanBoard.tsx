"use client"

import { useState, useCallback } from "react"
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { useDroppable } from "@dnd-kit/core"
import { ScrollArea } from "@/components/ui/scroll-area"
import { TaskCard, SortableTaskCard } from "./TaskCard"
import type { BoardColumn, TaskItem } from "@/types/tasks"

interface KanbanBoardProps {
  columns: BoardColumn[]
  onTransition: (taskId: number, toStatusId: number) => void
  onTaskClick: (taskId: number) => void
}

function KanbanColumn({
  column,
  onTaskClick,
}: {
  column: BoardColumn
  onTaskClick: (taskId: number) => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${column.status.id}`,
    data: { statusId: column.status.id },
  })

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-w-[280px] max-w-[320px] rounded-lg border bg-muted/30 transition-colors ${
        isOver ? "ring-2 ring-primary/50 bg-primary/5" : ""
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: column.status.color }} />
        <span className="text-sm font-medium">{column.status.name}</span>
        <span className="ml-auto text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
          {column.tasks.length}
        </span>
      </div>

      {/* Tasks */}
      <ScrollArea className="flex-1 max-h-[calc(100vh-280px)]">
        <div className="p-2 space-y-2">
          <SortableContext
            items={column.tasks.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            {column.tasks.map((task) => (
              <SortableTaskCard
                key={task.id}
                task={task}
                onClick={() => onTaskClick(task.id)}
              />
            ))}
          </SortableContext>

          {column.tasks.length === 0 && (
            <div className="text-center py-8 text-xs text-muted-foreground">
              Sin tareas
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

export function KanbanBoard({ columns, onTransition, onTaskClick }: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<TaskItem | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = event.active.data.current?.task as TaskItem | undefined
    if (task) setActiveTask(task)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveTask(null)
      const { active, over } = event
      if (!over) return

      const task = active.data.current?.task as TaskItem | undefined
      if (!task) return

      // Determine target column
      let targetStatusId: number | null = null

      if (over.id.toString().startsWith("column-")) {
        targetStatusId = parseInt(over.id.toString().replace("column-", ""))
      } else {
        // Dropped on another task — find its column
        const targetTask = columns
          .flatMap((c) => c.tasks)
          .find((t) => t.id === over.id)
        if (targetTask) {
          targetStatusId = targetTask.workflow_status_id
        }
      }

      if (targetStatusId && targetStatusId !== task.workflow_status_id) {
        onTransition(task.id, targetStatusId)
      }
    },
    [columns, onTransition]
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((column) => (
          <KanbanColumn
            key={column.status.id}
            column={column}
            onTaskClick={onTaskClick}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask ? <TaskCard task={activeTask} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  )
}
