"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Trash2, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import api from "@/lib/axios"
import type { TaskLabel } from "@/types/tasks"

export function LabelManager() {
  const { toast } = useToast()
  const [labels, setLabels] = useState<TaskLabel[]>([])
  const [newName, setNewName] = useState("")
  const [newColor, setNewColor] = useState("#3b82f6")
  const [loading, setLoading] = useState(true)

  const fetchLabels = useCallback(async () => {
    try {
      const res = await api.get("/api/task-labels")
      setLabels(res.data)
    } catch {
      toast({ title: "Error cargando etiquetas", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchLabels() }, [fetchLabels])

  const addLabel = async () => {
    if (!newName.trim()) return
    try {
      await api.post("/api/task-labels", { name: newName.trim(), color: newColor })
      toast({ title: "Etiqueta creada" })
      setNewName("")
      setNewColor("#3b82f6")
      fetchLabels()
    } catch {
      toast({ title: "Error", variant: "destructive" })
    }
  }

  const deleteLabel = async (id: number) => {
    try {
      await api.delete(`/api/task-labels/${id}`)
      fetchLabels()
    } catch {
      toast({ title: "Error", variant: "destructive" })
    }
  }

  const updateLabel = async (id: number, updates: Partial<TaskLabel>) => {
    try {
      await api.put(`/api/task-labels/${id}`, updates)
      fetchLabels()
    } catch {
      toast({ title: "Error", variant: "destructive" })
    }
  }

  if (loading) return <div className="text-sm text-muted-foreground p-4">Cargando etiquetas...</div>

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Tag className="h-5 w-5" />
        Etiquetas de Tareas
      </h3>

      {/* Add new */}
      <div className="flex items-center gap-2">
        <Input
          type="color"
          value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
          className="w-9 h-9 p-1 flex-shrink-0"
        />
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nueva etiqueta..."
          className="h-9"
          onKeyDown={(e) => { if (e.key === "Enter") addLabel() }}
        />
        <Button size="sm" onClick={addLabel} disabled={!newName.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* List */}
      <div className="space-y-1.5">
        {labels.map((label) => (
          <div key={label.id} className="flex items-center gap-2 p-2 border rounded">
            <Input
              type="color"
              defaultValue={label.color}
              onChange={(e) => updateLabel(label.id, { color: e.target.value })}
              className="w-7 h-7 p-0.5 flex-shrink-0"
            />
            <Input
              defaultValue={label.name}
              onBlur={(e) => {
                if (e.target.value !== label.name) updateLabel(label.id, { name: e.target.value })
              }}
              className="h-7 text-sm flex-1"
            />
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: `${label.color}20`, color: label.color, border: `1px solid ${label.color}40` }}
            >
              {label.name}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteLabel(label.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}

        {labels.length === 0 && (
          <div className="text-center py-6 text-sm text-muted-foreground">No hay etiquetas creadas.</div>
        )}
      </div>
    </div>
  )
}
