"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BulkAction {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  disabled?: boolean;
  permission?: {
    module: string;
    action: string;
  };
}

export interface BulkActionsToolbarProps {
  selectedCount: number;
  onClear: () => void;
  actions: BulkAction[];
  className?: string;
}

/**
 * Toolbar that appears when items are selected in a table
 * Displays selection count and available bulk actions
 *
 * @example
 * <BulkActionsToolbar
 *   selectedCount={5}
 *   onClear={() => clearSelection()}
 *   actions={[
 *     { label: 'Eliminar', icon: Trash, onClick: handleDelete, variant: 'destructive' },
 *     { label: 'Exportar', icon: Download, onClick: handleExport, variant: 'secondary' }
 *   ]}
 * />
 */
export function BulkActionsToolbar({
  selectedCount,
  onClear,
  actions,
  className
}: BulkActionsToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mb-4",
        "animate-in slide-in-from-top-2 duration-200",
        className
      )}
    >
      {/* Selection Counter */}
      <div className="flex items-center gap-2">
        <Badge variant="default" className="bg-amber-600 hover:bg-amber-700">
          {selectedCount} {selectedCount === 1 ? 'seleccionada' : 'seleccionadas'}
        </Badge>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-1">
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <Button
              key={index}
              variant={action.variant || 'default'}
              size="sm"
              onClick={action.onClick}
              disabled={action.disabled}
              className="gap-2"
            >
              <Icon className="h-4 w-4" />
              {action.label}
            </Button>
          );
        })}
      </div>

      {/* Clear Selection Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onClear}
        className="h-8 w-8 p-0"
        aria-label="Limpiar selección"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
