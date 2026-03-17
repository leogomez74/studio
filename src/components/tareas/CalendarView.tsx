"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { TaskItem } from "@/types/tasks"

interface CalendarViewProps {
  tasks: TaskItem[]
  onTaskClick: (taskId: number) => void
}

export function CalendarView({ tasks, onTaskClick }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const monthName = currentDate.toLocaleDateString("es-CR", { month: "long", year: "numeric" })

  const tasksByDate = useMemo(() => {
    const map: Record<string, TaskItem[]> = {}
    tasks.forEach((task) => {
      if (!task.due_date) return
      const dateKey = task.due_date.split("T")[0]
      if (!map[dateKey]) map[dateKey] = []
      map[dateKey].push(task)
    })
    return map
  }, [tasks])

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))
  const today = new Date().toISOString().split("T")[0]

  const days: (number | null)[] = []
  for (let i = 0; i < firstDayOfWeek; i++) days.push(null)
  for (let d = 1; d <= daysInMonth; d++) days.push(d)

  const priorityColor: Record<string, string> = {
    alta: "bg-red-500",
    media: "bg-blue-500",
    baja: "bg-green-500",
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <Button variant="ghost" size="icon" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium capitalize">{monthName}</span>
        <Button variant="ghost" size="icon" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 border-b">
        {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((day) => (
          <div key={day} className="px-2 py-1.5 text-center text-xs font-medium text-muted-foreground border-r last:border-r-0">
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7">
        {days.map((day, index) => {
          const dateKey = day ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` : null
          const dayTasks = dateKey ? tasksByDate[dateKey] || [] : []
          const isToday = dateKey === today

          return (
            <div
              key={index}
              className={`min-h-[90px] border-r border-b last:border-r-0 p-1 ${
                !day ? "bg-muted/20" : ""
              } ${isToday ? "bg-blue-50" : ""}`}
            >
              {day && (
                <>
                  <div className={`text-xs mb-1 ${isToday ? "font-bold text-blue-600" : "text-muted-foreground"}`}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {dayTasks.slice(0, 3).map((task) => (
                      <button
                        key={task.id}
                        onClick={() => onTaskClick(task.id)}
                        className="w-full text-left"
                      >
                        <div className="flex items-center gap-1 px-1 py-0.5 rounded text-[10px] bg-card border hover:bg-accent transition-colors truncate">
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${priorityColor[task.priority]}`} />
                          <span className="truncate">{task.title}</span>
                        </div>
                      </button>
                    ))}
                    {dayTasks.length > 3 && (
                      <div className="text-[10px] text-muted-foreground pl-1">
                        +{dayTasks.length - 3} más
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
