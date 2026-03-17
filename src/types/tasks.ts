export interface TaskWorkflow {
  id: number
  name: string
  slug: string
  description: string | null
  color: string | null
  is_default: boolean
  is_active: boolean
  statuses?: TaskWorkflowStatus[]
  transitions?: TaskWorkflowTransition[]
  statuses_count?: number
  tasks_count?: number
}

export interface TaskWorkflowStatus {
  id: number
  workflow_id: number
  name: string
  slug: string
  color: string
  icon: string | null
  sort_order: number
  is_initial: boolean
  is_terminal: boolean
  is_closed: boolean
}

export interface TaskWorkflowTransition {
  id: number
  workflow_id: number
  from_status_id: number
  to_status_id: number
  name: string | null
  points_award: number
  xp_award: number
  from_status?: TaskWorkflowStatus
  to_status?: TaskWorkflowStatus
}

export interface TaskLabel {
  id: number
  name: string
  color: string
}

export interface TaskWatcher {
  id: number
  task_id: number
  user_id: number
  user: { id: number; name: string; email: string }
}

export interface AvailableTransition {
  id: number
  name: string | null
  to_status: TaskWorkflowStatus
  points_award: number
  xp_award: number
}

export interface TaskItem {
  id: number
  reference: string
  project_code: string | null
  project_name: string | null
  title: string
  details: string | null
  status: 'pendiente' | 'en_progreso' | 'completada' | 'archivada' | 'deleted'
  priority: 'alta' | 'media' | 'baja'
  assigned_to: number | null
  assignee: { id: number; name: string; email: string } | null
  created_by: number | null
  creator?: { id: number; name: string; email: string } | null
  workflow_id: number | null
  workflow_status_id: number | null
  workflow_status: TaskWorkflowStatus | null
  workflow: { id: number; name: string; slug: string; color: string | null } | null
  labels: TaskLabel[]
  watchers?: TaskWatcher[]
  available_transitions?: AvailableTransition[]
  start_date: string | null
  due_date: string | null
  completed_at: string | null
  estimated_hours: number | null
  actual_hours: number | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface BoardColumn {
  status: TaskWorkflowStatus
  tasks: TaskItem[]
}

export interface BoardData {
  workflow: TaskWorkflow
  columns: BoardColumn[]
}

export type TaskView = 'list' | 'board' | 'calendar'
