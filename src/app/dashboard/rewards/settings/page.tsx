"use client";

import { useState, useEffect, useCallback } from "react";
import api from "@/lib/axios";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Settings,
  Star,
  Medal,
  Target,
  Gift,
  Plus,
  Pencil,
  Trash2,
  Save,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Zap,
  Award,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ADMIN_BASE = "/api/admin/gamification";

const rarityColors: Record<string, string> = {
  common: "bg-gray-500",
  uncommon: "bg-green-500",
  rare: "bg-blue-500",
  epic: "bg-purple-500",
  legendary: "bg-amber-500",
};

const rarityLabels: Record<string, string> = {
  common: "Común",
  uncommon: "Poco común",
  rare: "Raro",
  epic: "Épico",
  legendary: "Legendario",
};

const categoryLabels: Record<string, string> = {
  digital: "Digital",
  physical: "Físico",
  experience: "Experiencia",
  discount: "Descuento",
  general: "General",
};

// ─── Points Config Tab ──────────────────────────────────────────

function PointsConfigTab() {
  const { toast } = useToast();
  const [actions, setActions] = useState<Array<{
    key: string;
    description: string;
    points: number;
    xp: number;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      const { data } = await api.get(`${ADMIN_BASE}/config`);
      if (data.success) {
        const actionsConfig = data.data.actions || {};
        setActions(
          Object.entries(actionsConfig).map(([key, val]: [string, any]) => ({
            key,
            description: val.description || key,
            points: val.points || 0,
            xp: val.xp || 0,
          }))
        );
      }
    } catch {
      toast({ title: "Error", description: "No se pudo cargar la configuración", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`${ADMIN_BASE}/config`, {
        levels_config: { base_xp: 100, multiplier: 1.5 },
      });
      toast({ title: "Guardado", description: "Configuración actualizada correctamente" });
    } catch {
      toast({ title: "Error", description: "No se pudo guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Puntos por Acción de Negocio
          </CardTitle>
          <CardDescription>
            Puntos y XP que otorga cada acción del CRM (configurados en gamification.php)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Acción</TableHead>
                <TableHead>Código</TableHead>
                <TableHead className="w-24 text-center">Puntos</TableHead>
                <TableHead className="w-24 text-center">XP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {actions.map((action) => (
                <TableRow key={action.key}>
                  <TableCell className="font-medium">{action.description}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded">{action.key}</code>
                  </TableCell>
                  <TableCell className="text-center font-mono">{action.points}</TableCell>
                  <TableCell className="text-center font-mono">{action.xp}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {actions.length === 0 && (
            <p className="text-center text-muted-foreground py-6">
              No hay acciones configuradas. Verifica config/gamification.php
            </p>
          )}
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar Cambios
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Multiplicadores de Racha
          </CardTitle>
          <CardDescription>
            Bonificaciones por días consecutivos (configurado en gamification.php)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Los multiplicadores de racha se configuran directamente en <code className="bg-muted px-1 rounded">config/gamification.php</code> bajo la clave <code className="bg-muted px-1 rounded">streaks.bonuses</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Levels Config Tab ──────────────────────────────────────────

function LevelsConfigTab() {
  const { toast } = useToast();
  const [config, setConfig] = useState({ base_xp: 100, multiplier: 1.5 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`${ADMIN_BASE}/config`)
      .then(({ data }) => {
        if (data.success && data.data.levels_config) {
          setConfig(data.data.levels_config);
        }
      })
      .catch(() => toast({ title: "Error", description: "No se pudo cargar", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [toast]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`${ADMIN_BASE}/config`, { levels_config: config });
      toast({ title: "Guardado", description: "Configuración de niveles actualizada" });
    } catch {
      toast({ title: "Error", description: "No se pudo guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;

  const levels = Array.from({ length: 10 }, (_, i) => {
    const level = i + 1;
    const xp = Math.round(config.base_xp * Math.pow(config.multiplier, level - 1));
    return { level, xp };
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Sistema de Niveles
          </CardTitle>
          <CardDescription>
            Fórmula: XP requerido = base_xp * (multiplicador ^ (nivel - 1))
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>XP Base (nivel 1)</Label>
              <Input
                type="number"
                value={config.base_xp}
                onChange={(e) => setConfig({ ...config, base_xp: parseInt(e.target.value) || 100 })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Multiplicador</Label>
              <Input
                type="number"
                step="0.1"
                value={config.multiplier}
                onChange={(e) => setConfig({ ...config, multiplier: parseFloat(e.target.value) || 1.5 })}
                className="mt-1"
              />
            </div>
          </div>
          <div className="mt-4">
            <Label className="text-sm text-muted-foreground">Vista previa de niveles</Label>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Nivel</TableHead>
                  <TableHead>XP Requerida</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {levels.map((l) => (
                  <TableRow key={l.level}>
                    <TableCell>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white font-bold text-sm">
                        {l.level}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">{l.xp.toLocaleString()} XP</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar Cambios
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

// ─── Badges Config Tab ──────────────────────────────────────────

interface BadgeItem {
  id: number;
  name: string;
  slug: string;
  description: string;
  icon: string;
  rarity: string;
  points_reward: number;
  xp_reward: number;
  is_active: boolean;
  is_secret: boolean;
  category?: { id: number; name: string } | null;
}

const emptyBadge = {
  name: "",
  description: "",
  icon: "award",
  rarity: "common",
  points_reward: 100,
  xp_reward: 50,
  is_secret: false,
  is_active: true,
};

function BadgesConfigTab() {
  const { toast } = useToast();
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBadge, setEditingBadge] = useState<BadgeItem | null>(null);
  const [form, setForm] = useState(emptyBadge);
  const [submitting, setSubmitting] = useState(false);

  const fetchBadges = useCallback(async () => {
    try {
      const { data } = await api.get(`${ADMIN_BASE}/badges`);
      if (data.success) setBadges(data.data);
    } catch {
      toast({ title: "Error", description: "No se pudieron cargar los badges", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchBadges(); }, [fetchBadges]);

  const openCreate = () => {
    setEditingBadge(null);
    setForm(emptyBadge);
    setDialogOpen(true);
  };

  const openEdit = (badge: BadgeItem) => {
    setEditingBadge(badge);
    setForm({
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      rarity: badge.rarity,
      points_reward: badge.points_reward,
      xp_reward: badge.xp_reward,
      is_secret: badge.is_secret,
      is_active: badge.is_active,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.description) {
      toast({ title: "Error", description: "Nombre y descripción son requeridos", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      if (editingBadge) {
        await api.put(`${ADMIN_BASE}/badges/${editingBadge.id}`, form);
        toast({ title: "Actualizado", description: `Badge "${form.name}" actualizado` });
      } else {
        await api.post(`${ADMIN_BASE}/badges`, form);
        toast({ title: "Creado", description: `Badge "${form.name}" creado exitosamente` });
      }
      setDialogOpen(false);
      fetchBadges();
    } catch (err: any) {
      const msg = err.response?.data?.message || "Error al guardar";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (badge: BadgeItem) => {
    if (!confirm(`¿Eliminar badge "${badge.name}"?`)) return;
    try {
      await api.delete(`${ADMIN_BASE}/badges/${badge.id}`);
      toast({ title: "Eliminado", description: `Badge "${badge.name}" eliminado` });
      fetchBadges();
    } catch (err: any) {
      const msg = err.response?.data?.message || "Error al eliminar";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const toggleActive = async (badge: BadgeItem) => {
    try {
      await api.put(`${ADMIN_BASE}/badges/${badge.id}`, { is_active: !badge.is_active });
      fetchBadges();
    } catch {
      toast({ title: "Error", description: "No se pudo cambiar el estado", variant: "destructive" });
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Medal className="h-5 w-5" />
                Gestión de Badges
              </CardTitle>
              <CardDescription>Administra las insignias disponibles en el sistema</CardDescription>
            </div>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Badge
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {badges.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Medal className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay badges creados aún.</p>
              <Button className="mt-4" variant="outline" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Crear primer badge
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Badge</TableHead>
                  <TableHead>Rareza</TableHead>
                  <TableHead className="text-center">Puntos</TableHead>
                  <TableHead className="text-center">XP</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="w-24">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {badges.map((badge) => (
                  <TableRow key={badge.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{badge.name}</span>
                        <p className="text-xs text-muted-foreground">{badge.description}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-white", rarityColors[badge.rarity])}>
                        {rarityLabels[badge.rarity] || badge.rarity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-mono">{badge.points_reward}</TableCell>
                    <TableCell className="text-center font-mono">{badge.xp_reward}</TableCell>
                    <TableCell className="text-center">
                      <Switch checked={badge.is_active} onCheckedChange={() => toggleActive(badge)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(badge)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(badge)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBadge ? "Editar Badge" : "Crear Nuevo Badge"}</DialogTitle>
            <DialogDescription>
              {editingBadge ? "Modifica los detalles del badge" : "Define los detalles del nuevo badge"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Nombre *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Super Vendedor" className="mt-1" />
            </div>
            <div>
              <Label>Descripción *</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción del badge..." className="mt-1" />
            </div>
            <div>
              <Label>Rareza</Label>
              <Select value={form.rarity} onValueChange={(v) => setForm({ ...form, rarity: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(rarityLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Puntos de recompensa</Label>
                <Input type="number" value={form.points_reward} onChange={(e) => setForm({ ...form, points_reward: parseInt(e.target.value) || 0 })} className="mt-1" />
              </div>
              <div>
                <Label>XP de recompensa</Label>
                <Input type="number" value={form.xp_reward} onChange={(e) => setForm({ ...form, xp_reward: parseInt(e.target.value) || 0 })} className="mt-1" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={form.is_secret} onCheckedChange={(v) => setForm({ ...form, is_secret: v })} />
                <Label>Badge secreto</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label>Activo</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingBadge ? "Guardar" : "Crear Badge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Challenges Config Tab ──────────────────────────────────────

interface ChallengeItem {
  id: number;
  name: string;
  slug: string;
  description: string;
  type: string;
  difficulty: string;
  objectives: Array<{ key: string; name: string; target: number; type?: string | undefined }>;
  points_reward: number;
  xp_reward: number;
  max_participants: number | null;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  is_featured: boolean;
  participations_count?: number;
}

const emptyChallenge = {
  name: "",
  description: "",
  type: "individual",
  difficulty: "medium",
  objectives: [{ key: "objective_1", name: "", target: 1, type: "count" }],
  points_reward: 100,
  xp_reward: 50,
  max_participants: null as number | null,
  starts_at: "",
  ends_at: "",
  is_active: true,
  is_featured: false,
};

function ChallengesConfigTab() {
  const { toast } = useToast();
  const [challenges, setChallenges] = useState<ChallengeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<ChallengeItem | null>(null);
  const [form, setForm] = useState(emptyChallenge);
  const [submitting, setSubmitting] = useState(false);

  const fetchChallenges = useCallback(async () => {
    try {
      const { data } = await api.get(`${ADMIN_BASE}/challenges`);
      if (data.success) setChallenges(data.data);
    } catch {
      toast({ title: "Error", description: "No se pudieron cargar los challenges", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchChallenges(); }, [fetchChallenges]);

  const openCreate = () => {
    setEditingChallenge(null);
    setForm({
      ...emptyChallenge,
      starts_at: new Date().toISOString().split("T")[0],
      ends_at: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
    });
    setDialogOpen(true);
  };

  const openEdit = (ch: ChallengeItem) => {
    setEditingChallenge(ch);
    setForm({
      name: ch.name,
      description: ch.description,
      type: ch.type,
      difficulty: ch.difficulty,
      objectives: ch.objectives.map(o => ({ ...o, type: o.type ?? "count" })),
      points_reward: ch.points_reward,
      xp_reward: ch.xp_reward,
      max_participants: ch.max_participants,
      starts_at: ch.starts_at?.split("T")[0] || "",
      ends_at: ch.ends_at?.split("T")[0] || "",
      is_active: ch.is_active,
      is_featured: ch.is_featured,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.description || !form.starts_at || !form.ends_at) {
      toast({ title: "Error", description: "Complete los campos requeridos", variant: "destructive" });
      return;
    }
    if (!form.objectives.every(o => o.name && o.target > 0)) {
      toast({ title: "Error", description: "Cada objetivo necesita nombre y meta > 0", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      if (editingChallenge) {
        await api.put(`${ADMIN_BASE}/challenges/${editingChallenge.id}`, form);
        toast({ title: "Actualizado", description: `Challenge "${form.name}" actualizado` });
      } else {
        await api.post(`${ADMIN_BASE}/challenges`, form);
        toast({ title: "Creado", description: `Challenge "${form.name}" creado exitosamente` });
      }
      setDialogOpen(false);
      fetchChallenges();
    } catch (err: any) {
      const msg = err.response?.data?.message || "Error al guardar";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (ch: ChallengeItem) => {
    if (!confirm(`¿Eliminar challenge "${ch.name}"?`)) return;
    try {
      await api.delete(`${ADMIN_BASE}/challenges/${ch.id}`);
      toast({ title: "Eliminado", description: `Challenge "${ch.name}" eliminado` });
      fetchChallenges();
    } catch (err: any) {
      const msg = err.response?.data?.message || "Error al eliminar";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const addObjective = () => {
    setForm({
      ...form,
      objectives: [
        ...form.objectives,
        { key: `objective_${form.objectives.length + 1}`, name: "", target: 1, type: "count" },
      ],
    });
  };

  const updateObjective = (index: number, field: string, value: any) => {
    const updated = [...form.objectives];
    updated[index] = { ...updated[index], [field]: value };
    if (field === "name") {
      updated[index].key = value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    }
    setForm({ ...form, objectives: updated });
  };

  const removeObjective = (index: number) => {
    if (form.objectives.length <= 1) return;
    setForm({ ...form, objectives: form.objectives.filter((_, i) => i !== index) });
  };

  if (loading) return <LoadingState />;

  const getStatus = (ch: ChallengeItem) => {
    const now = new Date();
    const start = new Date(ch.starts_at);
    const end = new Date(ch.ends_at);
    if (!ch.is_active) return { label: "Inactivo", variant: "secondary" as const };
    if (now < start) return { label: "Programado", variant: "secondary" as const };
    if (now > end) return { label: "Finalizado", variant: "outline" as const };
    return { label: "Activo", variant: "default" as const };
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Gestión de Challenges
              </CardTitle>
              <CardDescription>Crea y administra los desafíos del sistema</CardDescription>
            </div>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Challenge
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {challenges.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay challenges creados aún.</p>
              <Button className="mt-4" variant="outline" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Crear primer challenge
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-center">Recompensa</TableHead>
                  <TableHead className="text-right">Participantes</TableHead>
                  <TableHead className="w-24">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {challenges.map((ch) => {
                  const status = getStatus(ch);
                  return (
                    <TableRow key={ch.id}>
                      <TableCell>
                        <div>
                          <span className="font-medium">{ch.name}</span>
                          <p className="text-xs text-muted-foreground truncate max-w-xs">{ch.description}</p>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{ch.type}</Badge></TableCell>
                      <TableCell>
                        <Badge variant={status.variant} className={cn(status.label === "Activo" && "bg-green-500 text-white")}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-mono">{ch.points_reward}pts / {ch.xp_reward}xp</TableCell>
                      <TableCell className="text-right">{ch.participations_count ?? 0}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(ch)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(ch)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingChallenge ? "Editar Challenge" : "Crear Nuevo Challenge"}</DialogTitle>
            <DialogDescription>
              {editingChallenge ? "Modifica los detalles del challenge" : "Define los detalles del nuevo challenge"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nombre *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Sprint Semanal" className="mt-1" />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="team">Equipo</SelectItem>
                    <SelectItem value="daily">Diario</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensual</SelectItem>
                    <SelectItem value="special">Especial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Descripción *</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción del challenge..." className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fecha inicio *</Label>
                <Input type="date" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Fecha fin *</Label>
                <Input type="date" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Puntos recompensa</Label>
                <Input type="number" value={form.points_reward} onChange={(e) => setForm({ ...form, points_reward: parseInt(e.target.value) || 0 })} className="mt-1" />
              </div>
              <div>
                <Label>XP recompensa</Label>
                <Input type="number" value={form.xp_reward} onChange={(e) => setForm({ ...form, xp_reward: parseInt(e.target.value) || 0 })} className="mt-1" />
              </div>
              <div>
                <Label>Máx. participantes</Label>
                <Input type="number" value={form.max_participants || ""} onChange={(e) => setForm({ ...form, max_participants: e.target.value ? parseInt(e.target.value) : null })} placeholder="Sin límite" className="mt-1" />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Objetivos *</Label>
                <Button variant="outline" size="sm" onClick={addObjective}>
                  <Plus className="h-3 w-3 mr-1" /> Agregar
                </Button>
              </div>
              {form.objectives.map((obj, i) => (
                <div key={i} className="flex gap-2 mb-2 items-end">
                  <div className="flex-1">
                    <Input value={obj.name} onChange={(e) => updateObjective(i, "name", e.target.value)} placeholder="Nombre del objetivo" />
                  </div>
                  <div className="w-24">
                    <Input type="number" value={obj.target} onChange={(e) => updateObjective(i, "target", parseInt(e.target.value) || 1)} placeholder="Meta" />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeObjective(i)} disabled={form.objectives.length <= 1}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingChallenge ? "Guardar" : "Crear Challenge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Catalog Config Tab ─────────────────────────────────────────

interface CatalogItemData {
  id: number;
  name: string;
  slug: string;
  description: string;
  category: string;
  points_cost: number;
  stock: number;
  max_per_user: number | null;
  icon: string | null;
  image_url: string | null;
  is_active: boolean;
  is_featured: boolean;
  available_from: string | null;
  available_until: string | null;
}

const emptyCatalogItem = {
  name: "",
  description: "",
  category: "digital",
  points_cost: 100,
  stock: -1,
  max_per_user: null as number | null,
  icon: "",
  image_url: "",
  is_active: true,
  is_featured: false,
  available_from: "",
  available_until: "",
};

function CatalogConfigTab() {
  const { toast } = useToast();
  const [items, setItems] = useState<CatalogItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItemData | null>(null);
  const [form, setForm] = useState(emptyCatalogItem);
  const [submitting, setSubmitting] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      const { data } = await api.get(`${ADMIN_BASE}/catalog`);
      if (data.success) setItems(data.data);
    } catch {
      toast({ title: "Error", description: "No se pudieron cargar los items del catálogo", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const openCreate = () => {
    setEditingItem(null);
    setForm(emptyCatalogItem);
    setDialogOpen(true);
  };

  const openEdit = (item: CatalogItemData) => {
    setEditingItem(item);
    setForm({
      name: item.name,
      description: item.description,
      category: item.category,
      points_cost: item.points_cost,
      stock: item.stock,
      max_per_user: item.max_per_user,
      icon: item.icon || "",
      image_url: item.image_url || "",
      is_active: item.is_active,
      is_featured: item.is_featured,
      available_from: item.available_from?.split("T")[0] || "",
      available_until: item.available_until?.split("T")[0] || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.description) {
      toast({ title: "Error", description: "Nombre y descripción son requeridos", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const payload = {
      ...form,
      available_from: form.available_from || null,
      available_until: form.available_until || null,
      icon: form.icon || null,
      image_url: form.image_url || null,
    };
    try {
      if (editingItem) {
        await api.put(`${ADMIN_BASE}/catalog/${editingItem.id}`, payload);
        toast({ title: "Actualizado", description: `Item "${form.name}" actualizado` });
      } else {
        await api.post(`${ADMIN_BASE}/catalog`, payload);
        toast({ title: "Creado", description: `Item "${form.name}" creado exitosamente` });
      }
      setDialogOpen(false);
      fetchItems();
    } catch (err: any) {
      const msg = err.response?.data?.message || "Error al guardar";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item: CatalogItemData) => {
    if (!confirm(`¿Eliminar item "${item.name}"?`)) return;
    try {
      await api.delete(`${ADMIN_BASE}/catalog/${item.id}`);
      toast({ title: "Eliminado", description: `Item "${item.name}" eliminado` });
      fetchItems();
    } catch (err: any) {
      const msg = err.response?.data?.message || "Error al eliminar";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const toggleActive = async (item: CatalogItemData) => {
    try {
      await api.put(`${ADMIN_BASE}/catalog/${item.id}`, { is_active: !item.is_active });
      fetchItems();
    } catch {
      toast({ title: "Error", description: "No se pudo cambiar el estado", variant: "destructive" });
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5" />
                Catálogo de Recompensas
              </CardTitle>
              <CardDescription>Gestiona los items disponibles para canje con puntos</CardDescription>
            </div>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Gift className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>El catálogo de recompensas está vacío.</p>
              <p className="text-sm mt-1">Agrega gift cards, merchandise, experiencias y más.</p>
              <Button className="mt-4" variant="outline" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Agregar primer item
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-center">Costo (pts)</TableHead>
                  <TableHead className="text-center">Stock</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="w-24">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{item.name}</span>
                        {item.is_featured && <Badge className="ml-2 bg-amber-500 text-white text-[10px]">Destacado</Badge>}
                        <p className="text-xs text-muted-foreground truncate max-w-xs">{item.description}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{categoryLabels[item.category] || item.category}</Badge>
                    </TableCell>
                    <TableCell className="text-center font-mono">{item.points_cost.toLocaleString()}</TableCell>
                    <TableCell className="text-center">
                      {item.stock === -1 ? <span className="text-muted-foreground">Ilimitado</span> : item.stock}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch checked={item.is_active} onCheckedChange={() => toggleActive(item)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(item)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Item" : "Nuevo Item de Catálogo"}</DialogTitle>
            <DialogDescription>
              {editingItem ? "Modifica los detalles del item" : "Agrega un nuevo item al catálogo de recompensas"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nombre *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Gift Card $25" className="mt-1" />
              </div>
              <div>
                <Label>Categoría</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Descripción *</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción del item..." className="mt-1" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Costo en puntos *</Label>
                <Input type="number" value={form.points_cost} onChange={(e) => setForm({ ...form, points_cost: parseInt(e.target.value) || 0 })} className="mt-1" />
              </div>
              <div>
                <Label>Stock</Label>
                <Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value) })} className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">-1 = Ilimitado</p>
              </div>
              <div>
                <Label>Máx. por usuario</Label>
                <Input type="number" value={form.max_per_user || ""} onChange={(e) => setForm({ ...form, max_per_user: e.target.value ? parseInt(e.target.value) : null })} placeholder="Sin límite" className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>URL de imagen</Label>
                <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." className="mt-1" />
              </div>
              <div>
                <Label>Icono</Label>
                <Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="Ej: gift, star" className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Disponible desde</Label>
                <Input type="date" value={form.available_from} onChange={(e) => setForm({ ...form, available_from: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Disponible hasta</Label>
                <Input type="date" value={form.available_until} onChange={(e) => setForm({ ...form, available_until: e.target.value })} className="mt-1" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label>Activo</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_featured} onCheckedChange={(v) => setForm({ ...form, is_featured: v })} />
                <Label>Destacado</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingItem ? "Guardar" : "Crear Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Loading State ──────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Configuración de Gamificación
        </h2>
        <p className="text-sm text-muted-foreground">
          Administra todos los aspectos del sistema de recompensas
        </p>
      </div>

      <Tabs defaultValue="catalog" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="catalog" className="flex items-center gap-2">
            <Gift className="h-4 w-4" />
            <span className="hidden sm:inline">Catálogo</span>
          </TabsTrigger>
          <TabsTrigger value="badges" className="flex items-center gap-2">
            <Medal className="h-4 w-4" />
            <span className="hidden sm:inline">Badges</span>
          </TabsTrigger>
          <TabsTrigger value="challenges" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Challenges</span>
          </TabsTrigger>
          <TabsTrigger value="points" className="flex items-center gap-2">
            <Star className="h-4 w-4" />
            <span className="hidden sm:inline">Puntos</span>
          </TabsTrigger>
          <TabsTrigger value="levels" className="flex items-center gap-2">
            <Award className="h-4 w-4" />
            <span className="hidden sm:inline">Niveles</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalog">
          <CatalogConfigTab />
        </TabsContent>

        <TabsContent value="badges">
          <BadgesConfigTab />
        </TabsContent>

        <TabsContent value="challenges">
          <ChallengesConfigTab />
        </TabsContent>

        <TabsContent value="points">
          <PointsConfigTab />
        </TabsContent>

        <TabsContent value="levels">
          <LevelsConfigTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
