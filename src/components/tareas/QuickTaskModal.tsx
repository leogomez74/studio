"use client"

import { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import api from "@/lib/axios"
import type { TaskWorkflow } from "@/types/tasks"

interface QuickTaskModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectCode?: string
  projectName?: string
  onCreated?: () => void
}

export function QuickTaskModal({ open, onOpenChange, projectCode, projectName, onCreated }: QuickTaskModalProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<{ id: number; name: string }[]>([])
  const [workflows, setWorkflows] = useState<TaskWorkflow[]>([])

  const [title, setTitle] = useState("")
  const [details, setDetails] = useState("")
  const [priority, setPriority] = useState("media")
  const [assignedTo, setAssignedTo] = useState("")
  const [workflowId, setWorkflowId] = useState("")
  const [dueDate, setDueDate] = useState("")

  useEffect(() => {
    if (!open) return
    Promise.allSettled([
      api.get("/api/users"),
      api.get("/api/task-workflows"),
    ]).then(([usersRes, workflowsRes]) => {
      if (usersRes.status === "fulfilled") setUsers(usersRes.value.data?.data || usersRes.value.data || [])
      if (workflowsRes.status === "fulfilled") {
        const wfs = workflowsRes.value.data || []
        setWorkflows(wfs)
        const defaultWf = wfs.find((w: TaskWorkflow) => w.is_default)
        if (defaultWf) setWorkflowId(String(defaultWf.id))
      }
    })
  }, [open])

  const reset = () => {
    setTitle("")
    setDetails("")
    setPriority("media")
    setAssignedTo("")
    setDueDate("")
  }

  const handleSubmit = async () => {
    if (!title.trim()) return
    setLoading(true)
    try {
      await api.post("/api/tareas", {
        title: title.trim(),
        details: details.trim() || null,
        priority,
        assigned_to: assignedTo ? parseInt(assignedTo) : null,
        workflow_id: workflowId ? parseInt(workflowId) : null,
        due_date: dueDate || null,
        project_code: projectCode || null,
        project_name: projectName || null,
      })
      toast({ title: "Tarea creada", variant: "default" })
      reset()
      onOpenChange(false)
      onCreated?.()
    } catch {
      toast({ title: "Error al crear tarea", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Nueva tarea rápida</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {projectCode && (
            <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
              Vinculada a: <span className="font-medium">{projectCode}</span>
              {projectName && ` — ${projectName}`}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="¿Qué se necesita hacer?"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Detalles</Label>
            <Textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Descripción adicional..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prioridad</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="baja">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Fecha límite</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Responsable</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {workflows.length > 1 && (
              <div className="space-y-1.5">
                <Label>Flujo</Label>
                <Select value={workflowId} onValueChange={setWorkflowId}>
                  <SelectTrigger><SelectValue placeholder="Por defecto" /></SelectTrigger>
                  <SelectContent>
                    {workflows.filter((w) => w.is_active).map((w) => (
                      <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !title.trim()}>
            {loading ? "Creando..." : "Crear tarea"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Global keyboard shortcut hook
export function useQuickTaskShortcut() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "T") {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  return { open, setOpen }
}
