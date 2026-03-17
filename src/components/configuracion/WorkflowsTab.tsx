"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Edit2, Trash2, Workflow, GripVertical } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import api from "@/lib/axios"
import type { TaskWorkflow, TaskWorkflowStatus, TaskWorkflowTransition } from "@/types/tasks"

export function WorkflowsTab() {
  const { toast } = useToast()
  const [workflows, setWorkflows] = useState<(TaskWorkflow & { statuses_count?: number; tasks_count?: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [editingWorkflow, setEditingWorkflow] = useState<TaskWorkflow | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await api.get("/api/task-workflows")
      setWorkflows(res.data)
    } catch {
      toast({ title: "Error cargando flujos", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchWorkflows() }, [fetchWorkflows])

  const toggleActive = async (workflow: TaskWorkflow) => {
    try {
      await api.put(`/api/task-workflows/${workflow.id}`, { is_active: !workflow.is_active })
      fetchWorkflows()
    } catch {
      toast({ title: "Error", variant: "destructive" })
    }
  }

  const deleteWorkflow = async (workflow: TaskWorkflow) => {
    if (!confirm(`¿Eliminar el flujo "${workflow.name}"?`)) return
    try {
      await api.delete(`/api/task-workflows/${workflow.id}`)
      toast({ title: "Flujo eliminado" })
      fetchWorkflows()
    } catch (err: any) {
      toast({ title: err?.response?.data?.message || "Error", variant: "destructive" })
    }
  }

  if (loading) return <div className="text-sm text-muted-foreground p-4">Cargando flujos...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Workflow className="h-5 w-5" />
          Flujos de Trabajo
        </h3>
        <Button size="sm" onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo flujo
        </Button>
      </div>

      <div className="space-y-3">
        {workflows.map((wf) => (
          <Card key={wf.id} className={!wf.is_active ? "opacity-60" : ""}>
            <CardContent className="flex items-center gap-4 py-3 px-4">
              <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: wf.color || "#3b82f6" }} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{wf.name}</span>
                  {wf.is_default && <Badge variant="secondary" className="text-[10px]">Por defecto</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {wf.statuses_count || 0} estados · {wf.tasks_count || 0} tareas
                </div>
              </div>

              <Switch checked={wf.is_active} onCheckedChange={() => toggleActive(wf)} />

              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingWorkflow(wf)}>
                <Edit2 className="h-4 w-4" />
              </Button>

              {!wf.is_default && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteWorkflow(wf)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </CardContent>
          </Card>
        ))}

        {workflows.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">No hay flujos configurados.</div>
        )}
      </div>

      {/* Create Dialog */}
      <CreateWorkflowDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreated={fetchWorkflows}
      />

      {/* Edit Dialog */}
      {editingWorkflow && (
        <WorkflowEditorDialog
          workflow={editingWorkflow}
          open={!!editingWorkflow}
          onOpenChange={(open) => { if (!open) setEditingWorkflow(null) }}
          onSaved={fetchWorkflows}
        />
      )}
    </div>
  )
}

// --- Create Dialog ---
function CreateWorkflowDialog({ open, onOpenChange, onCreated }: {
  open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [color, setColor] = useState("#3b82f6")
  const [statuses, setStatuses] = useState([
    { name: "Pendiente", color: "#6b7280", is_initial: true, is_terminal: false, is_closed: false },
    { name: "En Progreso", color: "#3b82f6", is_initial: false, is_terminal: false, is_closed: false },
    { name: "Completada", color: "#22c55e", is_initial: false, is_terminal: true, is_closed: false },
  ])
  const [loading, setLoading] = useState(false)

  const addStatus = () => {
    setStatuses([...statuses, { name: "", color: "#6b7280", is_initial: false, is_terminal: false, is_closed: false }])
  }

  const removeStatus = (index: number) => {
    if (statuses.length <= 2) return
    setStatuses(statuses.filter((_, i) => i !== index))
  }

  const updateStatus = (index: number, field: string, value: any) => {
    const updated = [...statuses]
    updated[index] = { ...updated[index], [field]: value }
    // Ensure only one initial
    if (field === "is_initial" && value === true) {
      updated.forEach((s, i) => { if (i !== index) s.is_initial = false })
    }
    setStatuses(updated)
  }

  const handleCreate = async () => {
    if (!name.trim() || statuses.some(s => !s.name.trim())) return
    if (!statuses.some(s => s.is_initial)) {
      toast({ title: "Debe haber al menos un estado inicial", variant: "destructive" })
      return
    }

    setLoading(true)
    try {
      // Auto-create linear transitions
      const transitions = statuses.slice(0, -1).map((_, i) => ({
        from_index: i,
        to_index: i + 1,
        name: null,
        points_award: i === statuses.length - 2 ? 50 : 5,
        xp_award: i === statuses.length - 2 ? 25 : 5,
      }))

      await api.post("/api/task-workflows", {
        name: name.trim(),
        description: description.trim() || null,
        color,
        statuses,
        transitions,
      })

      toast({ title: "Flujo creado" })
      onOpenChange(false)
      onCreated()
      // Reset
      setName("")
      setDescription("")
      setStatuses([
        { name: "Pendiente", color: "#6b7280", is_initial: true, is_terminal: false, is_closed: false },
        { name: "En Progreso", color: "#3b82f6", is_initial: false, is_terminal: false, is_closed: false },
        { name: "Completada", color: "#22c55e", is_initial: false, is_terminal: true, is_closed: false },
      ])
    } catch (err: any) {
      toast({ title: err?.response?.data?.message || "Error", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Flujo de Trabajo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_80px] gap-3">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Proceso de Crédito" />
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 p-1" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Estados del flujo</Label>
              <Button variant="outline" size="sm" onClick={addStatus}>
                <Plus className="h-3 w-3 mr-1" /> Estado
              </Button>
            </div>

            {statuses.map((status, index) => (
              <div key={index} className="flex items-center gap-2 p-2 border rounded-lg">
                <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <Input
                  type="color"
                  value={status.color}
                  onChange={(e) => updateStatus(index, "color", e.target.value)}
                  className="w-8 h-8 p-0.5 flex-shrink-0"
                />
                <Input
                  value={status.name}
                  onChange={(e) => updateStatus(index, "name", e.target.value)}
                  placeholder="Nombre del estado"
                  className="h-8 text-sm"
                />
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <label className="flex items-center gap-1 text-[10px]">
                    <input
                      type="checkbox"
                      checked={status.is_initial}
                      onChange={(e) => updateStatus(index, "is_initial", e.target.checked)}
                      className="rounded"
                    />
                    Inicio
                  </label>
                  <label className="flex items-center gap-1 text-[10px]">
                    <input
                      type="checkbox"
                      checked={status.is_terminal}
                      onChange={(e) => updateStatus(index, "is_terminal", e.target.checked)}
                      className="rounded"
                    />
                    Final
                  </label>
                </div>
                {statuses.length > 2 && (
                  <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => removeStatus(index)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={loading || !name.trim()}>
            {loading ? "Creando..." : "Crear flujo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- Edit Dialog ---
function WorkflowEditorDialog({ workflow, open, onOpenChange, onSaved }: {
  workflow: TaskWorkflow; open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void
}) {
  const { toast } = useToast()
  const [data, setData] = useState<TaskWorkflow | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newTransition, setNewTransition] = useState({ from: "", to: "", name: "", points: "0", xp: "0" })

  useEffect(() => {
    if (!open) return
    api.get(`/api/task-workflows/${workflow.id}`)
      .then((res) => setData(res.data))
      .catch(() => toast({ title: "Error cargando flujo", variant: "destructive" }))
      .finally(() => setLoading(false))
  }, [open, workflow.id, toast])

  const addTransition = async () => {
    if (!newTransition.from || !newTransition.to) return
    try {
      await api.post(`/api/task-workflows/${workflow.id}/transitions`, {
        from_status_id: parseInt(newTransition.from),
        to_status_id: parseInt(newTransition.to),
        name: newTransition.name || null,
        points_award: parseInt(newTransition.points) || 0,
        xp_award: parseInt(newTransition.xp) || 0,
      })
      toast({ title: "Transición agregada" })
      // Refresh
      const res = await api.get(`/api/task-workflows/${workflow.id}`)
      setData(res.data)
      setNewTransition({ from: "", to: "", name: "", points: "0", xp: "0" })
    } catch (err: any) {
      toast({ title: err?.response?.data?.message || "Error", variant: "destructive" })
    }
  }

  const deleteTransition = async (transitionId: number) => {
    try {
      await api.delete(`/api/task-workflows/${workflow.id}/transitions/${transitionId}`)
      const res = await api.get(`/api/task-workflows/${workflow.id}`)
      setData(res.data)
    } catch {
      toast({ title: "Error", variant: "destructive" })
    }
  }

  const addStatus = async () => {
    try {
      await api.post(`/api/task-workflows/${workflow.id}/statuses`, {
        name: "Nuevo Estado",
        color: "#6b7280",
      })
      const res = await api.get(`/api/task-workflows/${workflow.id}`)
      setData(res.data)
    } catch {
      toast({ title: "Error", variant: "destructive" })
    }
  }

  const updateStatus = async (statusId: number, updates: Record<string, any>) => {
    try {
      await api.put(`/api/task-workflows/${workflow.id}/statuses/${statusId}`, updates)
      const res = await api.get(`/api/task-workflows/${workflow.id}`)
      setData(res.data)
    } catch (err: any) {
      toast({ title: err?.response?.data?.message || "Error", variant: "destructive" })
    }
  }

  const deleteStatus = async (statusId: number) => {
    try {
      await api.delete(`/api/task-workflows/${workflow.id}/statuses/${statusId}`)
      const res = await api.get(`/api/task-workflows/${workflow.id}`)
      setData(res.data)
    } catch (err: any) {
      toast({ title: err?.response?.data?.message || "Error", variant: "destructive" })
    }
  }

  if (loading || !data) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar: {data.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Statuses */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Estados</Label>
              <Button variant="outline" size="sm" onClick={addStatus}>
                <Plus className="h-3 w-3 mr-1" /> Estado
              </Button>
            </div>

            {data.statuses?.map((status) => (
              <div key={status.id} className="flex items-center gap-2 p-2 border rounded-lg text-sm">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: status.color }} />
                <Input
                  defaultValue={status.name}
                  onBlur={(e) => {
                    if (e.target.value !== status.name) updateStatus(status.id, { name: e.target.value })
                  }}
                  className="h-7 text-sm flex-1"
                />
                <Input
                  type="color"
                  defaultValue={status.color}
                  onChange={(e) => updateStatus(status.id, { color: e.target.value })}
                  className="w-7 h-7 p-0.5 flex-shrink-0"
                />
                <label className="flex items-center gap-1 text-[10px] whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={status.is_initial}
                    onChange={(e) => updateStatus(status.id, { is_initial: e.target.checked })}
                  />
                  Inicio
                </label>
                <label className="flex items-center gap-1 text-[10px] whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={status.is_terminal}
                    onChange={(e) => updateStatus(status.id, { is_terminal: e.target.checked })}
                  />
                  Final
                </label>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteStatus(status.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>

          {/* Transitions */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Transiciones</Label>

            {data.transitions?.map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-xs p-2 border rounded bg-muted/30">
                <Badge variant="outline" className="text-[10px]">{t.from_status?.name}</Badge>
                <span className="text-muted-foreground">→</span>
                <Badge variant="outline" className="text-[10px]">{t.to_status?.name}</Badge>
                {t.name && <span className="text-muted-foreground italic">"{t.name}"</span>}
                <span className="ml-auto text-muted-foreground">
                  {t.points_award > 0 && `${t.points_award} pts`}
                  {t.points_award > 0 && t.xp_award > 0 && " · "}
                  {t.xp_award > 0 && `${t.xp_award} xp`}
                </span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteTransition(t.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}

            {/* Add transition */}
            <div className="flex items-end gap-2 p-2 border rounded-lg border-dashed">
              <div className="space-y-1 flex-1">
                <Label className="text-[10px]">Desde</Label>
                <select
                  value={newTransition.from}
                  onChange={(e) => setNewTransition({ ...newTransition, from: e.target.value })}
                  className="w-full h-7 text-xs border rounded px-1"
                >
                  <option value="">--</option>
                  {data.statuses?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-1 flex-1">
                <Label className="text-[10px]">Hasta</Label>
                <select
                  value={newTransition.to}
                  onChange={(e) => setNewTransition({ ...newTransition, to: e.target.value })}
                  className="w-full h-7 text-xs border rounded px-1"
                >
                  <option value="">--</option>
                  {data.statuses?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-1 w-20">
                <Label className="text-[10px]">Puntos</Label>
                <Input
                  type="number"
                  value={newTransition.points}
                  onChange={(e) => setNewTransition({ ...newTransition, points: e.target.value })}
                  className="h-7 text-xs"
                />
              </div>
              <div className="space-y-1 w-20">
                <Label className="text-[10px]">XP</Label>
                <Input
                  type="number"
                  value={newTransition.xp}
                  onChange={(e) => setNewTransition({ ...newTransition, xp: e.target.value })}
                  className="h-7 text-xs"
                />
              </div>
              <Button size="sm" className="h-7" onClick={addTransition} disabled={!newTransition.from || !newTransition.to}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
