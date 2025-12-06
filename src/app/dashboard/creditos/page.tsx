"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MoreHorizontal, PlusCircle, Eye, RefreshCw, Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/axios";

interface LeadOption {
  id: number;
  name: string;
  email: string | null;
}

interface OpportunityOption {
  id: string;
  title: string;
  lead_id: number;
  credit?: {
    id: number;
  } | null;
}

interface CreditDocument {
  id: number;
  credit_id: number;
  name: string;
  notes: string | null;
  url?: string | null;
  path?: string | null;
  mime_type?: string | null;
  size?: number | null;
  created_at: string;
  updated_at: string;
}

interface CreditItem {
  id: number;
  reference: string;
  title: string;
  status: string | null;
  category: string | null;
  assigned_to: string | null;
  progress: number;
  opened_at: string | null;
  description: string | null;
  lead_id: number;
  opportunity_id: string | null;
  lead?: LeadOption | null;
  opportunity?: { id: string; title: string | null } | null;
  created_at?: string | null;
  updated_at?: string | null;
  documents?: CreditDocument[];
}

interface CreditFormValues {
  reference: string;
  title: string;
  status: string;
  category: string;
  progress: string;
  leadId: string;
  opportunityId: string;
  assignedTo: string;
  openedAt: string;
  description: string;
}

const CREDIT_STATUS_OPTIONS = [
  "Para redactar",
  "Presentados",
  "Auto de curso",
  "CLCC",
  "CLSC",
  "Otros",
  "Abierto",
  "En Progreso",
  "En Espera",
  "Cerrado",
  "Al día",
  "En mora",
  "Cancelado",
  "En cobro judicial"
] as const;
const CREDIT_CATEGORY_OPTIONS = ["Regular", "Micro-crédito", "Hipotecario", "Personal"] as const;

const CREDIT_STATUS_TAB_CONFIG = [
  { value: "all", label: "Todos" },
  { value: "para-redactar", label: "Para redactar" },
  { value: "presentados", label: "Presentados" },
  { value: "auto-de-curso", label: "Auto de curso" },
  { value: "clcc", label: "CLCC" },
  { value: "clsc", label: "CLSC" },
  { value: "otros", label: "Otros" },
] as const;

const TAB_STATUS_FILTERS: Record<string, string[]> = {
  "para-redactar": ["para redactar"],
  "presentados": ["presentados"],
  "auto-de-curso": ["auto de curso"],
  "clcc": ["clcc"],
  "clsc": ["clsc"],
  "otros": ["otros"],
};

const TRACKED_STATUS_SET = new Set(
  Object.values(TAB_STATUS_FILTERS)
      .flat()
      .map((status) => status.toLowerCase())
);

const normalizeStatus = (status?: string | null): string => (status ?? "").trim().toLowerCase();

function formatDate(dateString?: string | null): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-CR", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function formatDateTime(dateString?: string | null): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-CR", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function CreditsPage() {
  const { toast } = useToast();

  const [credits, setCredits] = useState<CreditItem[]>([]);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingLeads, setIsLoadingLeads] = useState(true);
  const [isLoadingOpportunities, setIsLoadingOpportunities] = useState(true);
  const [tabValue, setTabValue] = useState("all");
  
  const [dialogState, setDialogState] = useState<"create" | "edit" | null>(null);
  const [dialogCredit, setDialogCredit] = useState<CreditItem | null>(null);
  const [formValues, setFormValues] = useState<CreditFormValues>({
    reference: "",
    title: "",
    status: CREDIT_STATUS_OPTIONS[0],
    category: CREDIT_CATEGORY_OPTIONS[0],
    progress: "0",
    leadId: "",
    opportunityId: "",
    assignedTo: "",
    openedAt: "",
    description: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [statusCredit, setStatusCredit] = useState<CreditItem | null>(null);
  const [statusForm, setStatusForm] = useState({ status: CREDIT_STATUS_OPTIONS[0] as string, progress: "0" });
  
  const [isDocumentsOpen, setIsDocumentsOpen] = useState(false);
  const [documentsCredit, setDocumentsCredit] = useState<CreditItem | null>(null);

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailCredit, setDetailCredit] = useState<CreditItem | null>(null);

  // Mock permission for now
  const canDownloadDocuments = true;

  const fetchCredits = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/api/credits');
      setCredits(response.data);
    } catch (error) {
      console.error("Error fetching credits:", error);
      toast({ title: "Error", description: "No se pudieron cargar los créditos.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const fetchLeads = useCallback(async () => {
    try {
      setIsLoadingLeads(true);
      const response = await api.get('/api/leads');
      const data = response.data.data || response.data;
      setLeads(data.map((l: any) => ({ id: l.id, name: l.name, email: l.email })));
    } catch (error) {
      console.error("Error fetching leads:", error);
    } finally {
      setIsLoadingLeads(false);
    }
  }, []);

  const fetchOpportunities = useCallback(async () => {
    try {
      setIsLoadingOpportunities(true);
      const response = await api.get('/api/opportunities');
      const data = response.data.data || response.data;
      setOpportunities(data.map((o: any) => ({ 
        id: o.id, 
        title: `${o.opportunity_type} - ${new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(o.amount)}`, 
        lead_id: o.lead?.id 
      })));
    } catch (error) {
      console.error("Error fetching opportunities:", error);
    } finally {
      setIsLoadingOpportunities(false);
    }
  }, []);

  useEffect(() => {
    fetchCredits();
    fetchLeads();
    fetchOpportunities();
  }, [fetchCredits, fetchLeads, fetchOpportunities]);

  const getCreditsForTab = useCallback(
    (value: string): CreditItem[] => {
        if (value === "all") {
            return credits;
        }
        if (value === "otros") {
            return credits.filter((item) => {
                const normalized = normalizeStatus(item.status);
                return normalized.length > 0 && !TRACKED_STATUS_SET.has(normalized);
            });
        }
        const statuses = TAB_STATUS_FILTERS[value];
        if (!statuses) {
            return credits;
        }
        return credits.filter((item) => statuses.includes(normalizeStatus(item.status)));
    },
    [credits]
  );

  const handleCreate = () => {
    setFormValues({
      reference: "",
      title: "",
      status: "Abierto",
      category: "Regular",
      progress: "0",
      leadId: "",
      opportunityId: "",
      assignedTo: "",
      openedAt: new Date().toISOString().split('T')[0],
      description: "",
    });
    setDialogCredit(null);
    setDialogState("create");
  };

  const handleEdit = (credit: CreditItem) => {
    setFormValues({
      reference: credit.reference,
      title: credit.title,
      status: credit.status || "Abierto",
      category: credit.category || "Regular",
      progress: String(credit.progress),
      leadId: String(credit.lead_id),
      opportunityId: credit.opportunity_id ? String(credit.opportunity_id) : "",
      assignedTo: credit.assigned_to || "",
      openedAt: credit.opened_at ? credit.opened_at.split('T')[0] : "",
      description: credit.description || "",
    });
    setDialogCredit(credit);
    setDialogState("edit");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const body = {
        reference: formValues.reference,
        title: formValues.title,
        status: formValues.status,
        category: formValues.category,
        progress: parseInt(formValues.progress) || 0,
        lead_id: parseInt(formValues.leadId),
        opportunity_id: formValues.opportunityId || null,
        assigned_to: formValues.assignedTo,
        opened_at: formValues.openedAt,
        description: formValues.description,
      };

      if (dialogState === "create") {
        await api.post('/api/credits', body);
      } else {
        await api.put(`/api/credits/${dialogCredit?.id}`, body);
      }

      toast({ title: "Éxito", description: "Crédito guardado correctamente." });
      setDialogState(null);
      fetchCredits();
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.message || error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!statusCredit) return;
    setIsSaving(true);
    try {
        await api.put(`/api/credits/${statusCredit.id}`, {
            status: statusForm.status,
            progress: parseInt(statusForm.progress) || 0
        });
        toast({ title: "Éxito", description: "Estado actualizado." });
        setIsStatusOpen(false);
        fetchCredits();
    } catch (error: any) {
        toast({ title: "Error", description: error.response?.data?.message || error.message, variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Créditos</h2>
          <p className="text-muted-foreground">Gestiona los créditos y sus documentos.</p>
        </div>
        <Button onClick={handleCreate}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Nuevo Crédito
        </Button>
      </div>

      <Tabs value={tabValue} onValueChange={setTabValue}>
        <TabsList className="flex flex-wrap gap-2">
            {CREDIT_STATUS_TAB_CONFIG.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="capitalize">
                    {tab.label}
                </TabsTrigger>
            ))}
        </TabsList>

        {CREDIT_STATUS_TAB_CONFIG.map((tab) => (
            <TabsContent key={tab.value} value={tab.value}>
                <Card>
                    <CardHeader>
                    <CardTitle>Listado de Créditos</CardTitle>
                    <CardDescription>Total: {getCreditsForTab(tab.value).length} registros.</CardDescription>
                    </CardHeader>
                    <CardContent>
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>Oportunidad</TableHead>
                            <TableHead>Referencia</TableHead>
                            <TableHead>Título</TableHead>
                            <TableHead>Lead</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Progreso</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {getCreditsForTab(tab.value).map((credit) => (
                            <TableRow key={credit.id}>
                            <TableCell>{credit.opportunity?.id || "-"}</TableCell>
                            <TableCell className="font-medium">{credit.reference}</TableCell>
                            <TableCell>{credit.title}</TableCell>
                            <TableCell>
                                {credit.lead ? (
                                    <div className="flex flex-col">
                                        <span>{credit.lead.name}</span>
                                        <span className="text-xs text-muted-foreground">{credit.lead.email}</span>
                                    </div>
                                ) : "-"}
                            </TableCell>
                            <TableCell><Badge variant="secondary">{credit.status}</Badge></TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <Progress value={credit.progress} className="w-[60px]" />
                                    <span className="text-xs text-muted-foreground">{credit.progress}%</span>
                                </div>
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <Button 
                                        variant="outline" 
                                        size="icon" 
                                        onClick={() => { setDetailCredit(credit); setIsDetailOpen(true); }} 
                                        title="Ver detalle"
                                        className="border-red-500 text-red-500 hover:bg-red-50 hover:text-red-600"
                                    >
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        size="icon" 
                                        onClick={() => { setStatusCredit(credit); setStatusForm({ status: credit.status || "Abierto", progress: String(credit.progress) }); setIsStatusOpen(true); }} 
                                        title="Actualizar estado"
                                        className="border-blue-500 text-blue-500 hover:bg-blue-50 hover:text-blue-600"
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={() => { setDocumentsCredit(credit); setIsDocumentsOpen(true); }}>Gestionar documentos</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleEdit(credit)}>Editar</DropdownMenuItem>
                                    </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                    </CardContent>
                </Card>
            </TabsContent>
        ))}
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={!!dialogState} onOpenChange={(open) => !open && setDialogState(null)}>
        <DialogContent className="max-w-3xl">
            <DialogHeader>
                <DialogTitle>{dialogState === 'create' ? 'Nuevo Crédito' : 'Editar Crédito'}</DialogTitle>
                <DialogDescription>Completa la información del crédito.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Referencia</Label>
                        <Input value={formValues.reference} onChange={e => setFormValues({...formValues, reference: e.target.value})} required />
                    </div>
                    <div className="space-y-2">
                        <Label>Título</Label>
                        <Input value={formValues.title} onChange={e => setFormValues({...formValues, title: e.target.value})} required />
                    </div>
                    <div className="space-y-2">
                        <Label>Estado</Label>
                        <Select value={formValues.status} onValueChange={v => setFormValues({...formValues, status: v})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {CREDIT_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Categoría</Label>
                        <Select value={formValues.category} onValueChange={v => setFormValues({...formValues, category: v})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {CREDIT_CATEGORY_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Lead</Label>
                        <Select value={formValues.leadId} onValueChange={v => setFormValues({...formValues, leadId: v})}>
                            <SelectTrigger><SelectValue placeholder="Selecciona un lead" /></SelectTrigger>
                            <SelectContent>
                                {leads.map(l => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Oportunidad (Opcional)</Label>
                        <Select value={formValues.opportunityId} onValueChange={v => setFormValues({...formValues, opportunityId: v})}>
                            <SelectTrigger><SelectValue placeholder="Selecciona una oportunidad" /></SelectTrigger>
                            <SelectContent>
                                {opportunities.filter(o => !formValues.leadId || o.lead_id === parseInt(formValues.leadId)).map(o => (
                                    <SelectItem key={o.id} value={String(o.id)}>{o.title}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Responsable</Label>
                        <Input value={formValues.assignedTo} onChange={e => setFormValues({...formValues, assignedTo: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <Label>Fecha Apertura</Label>
                        <Input type="date" value={formValues.openedAt} onChange={e => setFormValues({...formValues, openedAt: e.target.value})} />
                    </div>
                    <div className="col-span-2 space-y-2">
                        <Label>Descripción</Label>
                        <Textarea value={formValues.description} onChange={e => setFormValues({...formValues, description: e.target.value})} />
                    </div>
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setDialogState(null)}>Cancelar</Button>
                    <Button type="submit" disabled={isSaving}>{isSaving ? "Guardando..." : "Guardar"}</Button>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>

      {/* Status Dialog */}
      <Dialog open={isStatusOpen} onOpenChange={setIsStatusOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Actualizar Estado</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleStatusUpdate} className="space-y-4">
                <div className="space-y-2">
                    <Label>Estado</Label>
                    <Select value={statusForm.status} onValueChange={v => setStatusForm({...statusForm, status: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {CREDIT_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Progreso (%)</Label>
                    <Input type="number" min="0" max="100" value={statusForm.progress} onChange={e => setStatusForm({...statusForm, progress: e.target.value})} />
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsStatusOpen(false)}>Cancelar</Button>
                    <Button type="submit" disabled={isSaving}>Actualizar</Button>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>

      {/* Documents Dialog */}
      <CreditDocumentsDialog 
        isOpen={isDocumentsOpen} 
        credit={documentsCredit} 
        onClose={() => setIsDocumentsOpen(false)} 
        canDownloadDocuments={canDownloadDocuments}
      />

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl">
            <DialogHeader>
                <DialogTitle>Detalle del Crédito</DialogTitle>
            </DialogHeader>
            {detailCredit && (
                <div className="grid grid-cols-2 gap-4">
                    <div><Label className="text-muted-foreground">Referencia</Label><p>{detailCredit.reference}</p></div>
                    <div><Label className="text-muted-foreground">Título</Label><p>{detailCredit.title}</p></div>
                    <div><Label className="text-muted-foreground">Estado</Label><p>{detailCredit.status}</p></div>
                    <div><Label className="text-muted-foreground">Categoría</Label><p>{detailCredit.category}</p></div>
                    <div><Label className="text-muted-foreground">Lead</Label><p>{detailCredit.lead?.name}</p></div>
                    <div><Label className="text-muted-foreground">Responsable</Label><p>{detailCredit.assigned_to}</p></div>
                    <div className="col-span-2"><Label className="text-muted-foreground">Descripción</Label><p>{detailCredit.description}</p></div>
                </div>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreditDocumentsDialog({ isOpen, credit, onClose, canDownloadDocuments }: any) {
    const { toast } = useToast();
    const [documents, setDocuments] = useState<CreditDocument[]>([]);
    const [file, setFile] = useState<File | null>(null);
    const [name, setName] = useState("");
    const [notes, setNotes] = useState("");
    const [isUploading, setIsUploading] = useState(false);

    const fetchDocuments = useCallback(async () => {
        if (!credit) return;
        try {
            const res = await api.get(`/api/credits/${credit.id}/documents`);
            setDocuments(res.data);
        } catch (e) { console.error(e); }
    }, [credit]);

    useEffect(() => {
        if (isOpen) fetchDocuments();
    }, [isOpen, fetchDocuments]);

    const handleUpload = async (e: FormEvent) => {
        e.preventDefault();
        if (!credit || !file) return;
        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("name", name);
            formData.append("notes", notes);

            await api.post(`/api/credits/${credit.id}/documents`, formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            
            toast({ title: "Documento subido" });
            setName(""); setNotes(""); setFile(null);
            fetchDocuments();
        } catch (e) {
            toast({ title: "Error", variant: "destructive" });
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async (docId: number) => {
        if (!credit) return;
        try {
            await api.delete(`/api/credits/${credit.id}/documents/${docId}`);
            fetchDocuments();
        } catch (e) { console.error(e); }
    };

    return (
        <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
            <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>Documentos</DialogTitle></DialogHeader>
                <div className="space-y-4">
                    <form onSubmit={handleUpload} className="space-y-4 border p-4 rounded">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Nombre</Label>
                                <Input value={name} onChange={e => setName(e.target.value)} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Archivo</Label>
                                <Input type="file" onChange={e => setFile(e.target.files?.[0] || null)} required />
                            </div>
                            <div className="col-span-2 space-y-2">
                                <Label>Notas</Label>
                                <Input value={notes} onChange={e => setNotes(e.target.value)} />
                            </div>
                        </div>
                        <Button type="submit" disabled={isUploading}>{isUploading ? "Subiendo..." : "Subir Documento"}</Button>
                    </form>

                    <Table>
                        <TableHeader>
                            <TableRow><TableHead>Nombre</TableHead><TableHead>Notas</TableHead><TableHead>Acciones</TableHead></TableRow>
                        </TableHeader>
                        <TableBody>
                            {documents.map(doc => (
                                <TableRow key={doc.id}>
                                    <TableCell>
                                        {doc.url ? <a href={doc.url} target="_blank" className="text-primary hover:underline">{doc.name}</a> : doc.name}
                                    </TableCell>
                                    <TableCell>{doc.notes}</TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="sm" onClick={() => handleDelete(doc.id)} className="text-destructive">Eliminar</Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </DialogContent>
        </Dialog>
    );
}
