"use client"

// Inspired by react-hot-toast library
import * as React from "react"
import { CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react"

import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 5000 // 5 seconds default

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
  duration?: number
}

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type ActionType = typeof actionTypes

type Action =
  | {
      type: ActionType["ADD_TOAST"]
      toast: ToasterToast
    }
  | {
      type: ActionType["UPDATE_TOAST"]
      toast: Partial<ToasterToast>
    }
  | {
      type: ActionType["DISMISS_TOAST"]
      toastId?: ToasterToast["id"]
    }
  | {
      type: ActionType["REMOVE_TOAST"]
      toastId?: ToasterToast["id"]
    }

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const addToRemoveQueue = (toastId: string, duration?: number) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    })
  }, duration || TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        const toast = state.toasts.find((t) => t.id === toastId)
        addToRemoveQueue(toastId, toast?.duration)
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id, toast.duration)
        })
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      }
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

const listeners: Array<(state: State) => void> = []

let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

type Toast = Omit<ToasterToast, "id">

function toast({ ...props }: Toast) {
  const id = genId()

  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    })
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  return {
    id: id,
    dismiss,
    update,
  }
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  }
}

// Helper types for toast actions
type ToastActionConfig = {
  label: string
  onClick: () => void
}

type ToastHelperOptions = {
  duration?: number
  action?: ToastActionConfig
}

// Helper functions with smart defaults and icons
function toastSuccess(
  title: string,
  description?: string,
  options?: ToastHelperOptions
) {
  return toast({
    title: (
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5" />
        <span>{title}</span>
      </div>
    ),
    description,
    variant: "default",
    duration: options?.duration ?? 3000, // 3 seconds for success
    action: options?.action
      ? {
          altText: options.action.label,
          children: options.action.label,
          onClick: options.action.onClick,
        } as ToastActionElement
      : undefined,
    className: "border-green-500 bg-green-50 text-green-900",
  })
}

function toastError(
  title: string,
  description?: string,
  options?: ToastHelperOptions
) {
  return toast({
    title: (
      <div className="flex items-center gap-2">
        <XCircle className="h-5 w-5" />
        <span>{title}</span>
      </div>
    ),
    description,
    variant: "destructive",
    duration: options?.duration ?? 8000, // 8 seconds for errors
    action: options?.action
      ? {
          altText: options.action.label,
          children: options.action.label,
          onClick: options.action.onClick,
        } as ToastActionElement
      : undefined,
  })
}

function toastWarning(
  title: string,
  description?: string,
  options?: ToastHelperOptions
) {
  return toast({
    title: (
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5" />
        <span>{title}</span>
      </div>
    ),
    description,
    variant: "default",
    duration: options?.duration ?? 6000, // 6 seconds for warnings
    action: options?.action
      ? {
          altText: options.action.label,
          children: options.action.label,
          onClick: options.action.onClick,
        } as ToastActionElement
      : undefined,
    className: "border-yellow-500 bg-yellow-50 text-yellow-900",
  })
}

function toastInfo(
  title: string,
  description?: string,
  options?: ToastHelperOptions
) {
  return toast({
    title: (
      <div className="flex items-center gap-2">
        <Info className="h-5 w-5" />
        <span>{title}</span>
      </div>
    ),
    description,
    variant: "default",
    duration: options?.duration ?? 4000, // 4 seconds for info
    action: options?.action
      ? {
          altText: options.action.label,
          children: options.action.label,
          onClick: options.action.onClick,
        } as ToastActionElement
      : undefined,
    className: "border-blue-500 bg-blue-50 text-blue-900",
  })
}

export { useToast, toast, toastSuccess, toastError, toastWarning, toastInfo }
export type { ToastActionConfig, ToastHelperOptions }
