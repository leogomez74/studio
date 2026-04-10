'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserCheck, ChevronDown, Loader2 } from 'lucide-react';
import api from '@/lib/axios';

interface Agent {
  id: number;
  name: string;
}

interface ReassignButtonProps {
  currentAssigneeId: number | null;
  currentAssigneeName: string | null;
  agents: Agent[];
  endpoint: string;
  onReassigned?: (newAgentId: number, newAgentName: string) => void;
}

export function ReassignButton({
  currentAssigneeId,
  currentAssigneeName,
  agents,
  endpoint,
  onReassigned,
}: ReassignButtonProps) {
  const [saving, setSaving] = useState(false);

  const handleReassign = async (agent: Agent) => {
    if (agent.id === currentAssigneeId) return;
    setSaving(true);
    try {
      await api.patch(endpoint, { assigned_to_id: agent.id });
      onReassigned?.(agent.id, agent.name);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-8 text-xs" disabled={saving}>
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <UserCheck className="h-3.5 w-3.5" />
          )}
          {currentAssigneeName ?? 'Sin asignar'}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {agents.map((agent) => (
          <DropdownMenuItem
            key={agent.id}
            className={agent.id === currentAssigneeId ? 'font-semibold' : ''}
            onClick={() => handleReassign(agent)}
          >
            {agent.name}
            {agent.id === currentAssigneeId && ' ✓'}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
