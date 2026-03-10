'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/components/auth-guard';
import { API_BASE_URL } from '@/lib/env';
import api from '@/lib/axios';

interface AutomationConfig {
  assigned_to: string;
  due_days_offset: number;
  is_active: boolean;
}

const AUTOMATION_EVENTS = [
  { key: 'lead_created', title: 'Nuevo Lead Creado', description: 'Al registrar un nuevo lead, se crea automáticamente una tarea asignada al usuario seleccionado.', defaultTitle: 'Nuevo lead creado' },
  { key: 'opportunity_created', title: 'Nueva Oportunidad Creada', description: 'Al generar una oportunidad, se crea tarea para realizar análisis, solicitar colillas y verificarlas.', defaultTitle: 'Realizar análisis, solicitar colillas y verificarlas' },
  { key: 'analisis_created', title: 'Análisis Creado', description: 'Al crear un análisis, se asigna tarea para enviar propuesta al equipo PEP, dar seguimiento y verificar estado.', defaultTitle: 'Enviar propuesta al equipo PEP, dar seguimiento y verificar estado' },
  { key: 'pep_aceptado', title: 'PEP Acepta Análisis', description: 'Al aceptar el análisis o aprobar una propuesta, se asigna tarea para informar al cliente la propuesta aceptada.', defaultTitle: 'Informar al cliente la propuesta aceptada' },
  { key: 'pep_rechazado', title: 'PEP Rechaza Análisis', description: 'Al marcar estado PEP como "Rechazado", se asigna tarea para informar al cliente que no califica para el crédito.', defaultTitle: 'Informar al cliente que no califica para el crédito' },
  { key: 'credit_created', title: 'Nuevo Crédito Creado', description: 'Al crearse un nuevo crédito, se asigna tarea para realizar entrega de pagaré, formalización, entrega de hoja de cierre.', defaultTitle: 'Nuevo crédito creado' },
];

const TareasAutomationTab: React.FC = () => {
  const { toast } = useToast();
  const { token } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [automationsLoading, setAutomationsLoading] = useState(false);
  const [configs, setConfigs] = useState<Record<string, AutomationConfig>>({});

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/users`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (res.ok) setUsers(await res.json());
    } catch (error) { console.error('Error fetching users:', error); }
  };

  const fetchAutomations = useCallback(async () => {
    setAutomationsLoading(true);
    try {
      const res = await api.get('/api/task-automations');
      const data = Array.isArray(res.data) ? res.data : [];
      const newConfigs: Record<string, AutomationConfig> = {};
      AUTOMATION_EVENTS.forEach(event => {
        const auto = data.find((a: any) => a.event_type === event.key);
        newConfigs[event.key] = {
          assigned_to: auto?.assigned_to ? String(auto.assigned_to) : '',
          due_days_offset: auto?.due_days_offset ?? 3,
          is_active: auto?.is_active ?? false,
        };
      });
      setConfigs(newConfigs);
    } catch (error) { console.error('Error fetching automations:', error); }
    finally { setAutomationsLoading(false); }
  }, []);

  useEffect(() => {
    if (token) { fetchUsers(); fetchAutomations(); }
  }, [token, fetchAutomations]);

  const saveAutomation = async (eventType: string, title: string, assignedTo: string, dueDaysOffset?: number) => {
    try {
      await api.post('/api/task-automations', {
        event_type: eventType, title, assigned_to: assignedTo ? Number(assignedTo) : null,
        priority: 'media', due_days_offset: dueDaysOffset ?? configs[eventType]?.due_days_offset ?? 3, is_active: !!assignedTo,
      });
      toast({ title: 'Guardado', description: 'Configuración actualizada.' });
    } catch (error) {
      console.error('Error saving automation:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar la configuración.' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tareas Automáticas</CardTitle>
        <CardDescription>
          Configura las tareas que se crean automáticamente al ocurrir ciertos eventos en el sistema. Selecciona &quot;Ninguno&quot; para desactivar una tarea.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {automationsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {AUTOMATION_EVENTS.map((event) => (
              <div key={event.key} className="rounded-lg border p-4">
                <h4 className="font-medium">{event.title}</h4>
                <p className="text-sm text-muted-foreground mb-3">{event.description}</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Asignar tarea a</Label>
                    <Select
                      value={configs[event.key]?.assigned_to || 'none'}
                      onValueChange={(value) => {
                        const assignedTo = value === 'none' ? '' : value;
                        setConfigs(prev => ({ ...prev, [event.key]: { ...prev[event.key], assigned_to: assignedTo, is_active: !!assignedTo } }));
                        saveAutomation(event.key, event.defaultTitle, assignedTo);
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Ninguno</SelectItem>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={String(user.id)}>{user.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Días de plazo</Label>
                    <Input
                      type="number"
                      min={0}
                      max={365}
                      value={configs[event.key]?.due_days_offset ?? 3}
                      onChange={(e) => {
                        const days = Math.max(0, Math.min(365, Number(e.target.value) || 0));
                        setConfigs(prev => ({ ...prev, [event.key]: { ...prev[event.key], due_days_offset: days } }));
                      }}
                      onBlur={() => {
                        const config = configs[event.key];
                        if (config?.assigned_to) {
                          saveAutomation(event.key, event.defaultTitle, config.assigned_to, config.due_days_offset);
                        }
                      }}
                      disabled={!configs[event.key]?.assigned_to}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TareasAutomationTab;
