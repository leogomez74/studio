"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Check, ChevronsUpDown, FileUp, Loader2 } from "lucide-react"; // Agregados íconos útiles
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; //
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/axios";
import { type Lead, OPPORTUNITY_STATUSES, VERTICAL_OPTIONS, OPPORTUNITY_TYPES } from "@/lib/data";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

interface CreateOpportunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  leads: Lead[];
  defaultLeadId?: string;
}

const createOpportunitySchema = z.object({
  leadId: z.string().min(1, "Debes seleccionar un lead"),
  vertical: z.enum(VERTICAL_OPTIONS, {
    errorMap: () => ({ message: "Vertical no válida" })
  }),
  opportunityType: z.enum(OPPORTUNITY_TYPES, {
    errorMap: () => ({ message: "Tipo de oportunidad no válido" })
  }),
  status: z.enum(OPPORTUNITY_STATUSES, {
    errorMap: () => ({ message: "Estado no válido" })
  }),
  amount: z.coerce.number().min(0, "El monto debe ser positivo"),
  expectedCloseDate: z.string().optional().refine((date) => {
    if (!date) return true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(date) >= today;
  }, { message: "La fecha no puede ser anterior a hoy" }),
  comments: z.string().max(1000, "Máximo 1000 caracteres").optional(),
});

type CreateOpportunityFormValues = z.infer<typeof createOpportunitySchema>;

type CreateOpportunityPayload = {
  lead_cedula: string;
  vertical: (typeof VERTICAL_OPTIONS)[number];
  opportunity_type: (typeof OPPORTUNITY_TYPES)[number];
  status: (typeof OPPORTUNITY_STATUSES)[number];
  amount: number;
  expected_close_date: string | null;
  comments?: string;
  assigned_to_id?: number;
};

export function CreateOpportunityDialog({
  open,
  onOpenChange,
  onSuccess,
  leads,
  defaultLeadId,
}: CreateOpportunityDialogProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [hasDocuments, setHasDocuments] = useState(false);
  const [checkingDocs, setCheckingDocs] = useState(false);
  
  // Nuevo estado para la subida de archivos
  const [isUploading, setIsUploading] = useState(false);

  // Combobox state
  const [openVertical, setOpenVertical] = useState(false);
  const [searchVertical, setSearchVertical] = useState("");

  const form = useForm<CreateOpportunityFormValues>({
    resolver: zodResolver(createOpportunitySchema),
    defaultValues: {
      leadId: defaultLeadId || "",
      vertical: VERTICAL_OPTIONS[0],
      opportunityType: OPPORTUNITY_TYPES[0],
      status: OPPORTUNITY_STATUSES[0],
      amount: 0,
      expectedCloseDate: "",
      comments: "",
    },
  });

  // Detectar si es lead o cliente por props
  const isLeadSelectionDisabled = !!defaultLeadId;

  // Reset form cuando se abre el diálogo
  useEffect(() => {
    if (open) {
      form.reset({
        leadId: defaultLeadId || (leads.length > 0 ? String(leads[0].id) : ""),
        vertical: VERTICAL_OPTIONS[0],
        opportunityType: OPPORTUNITY_TYPES[0],
        status: OPPORTUNITY_STATUSES[0],
        amount: 0,
        expectedCloseDate: "",
        comments: "",
      });
      // Reiniciar estados
      setHasDocuments(false);
      setIsUploading(false);
    }
  }, [open, defaultLeadId, leads, form]);

  const currentLeadId = form.watch("leadId");

  const checkDocs = useCallback(async () => {
    if (!currentLeadId) {
      setHasDocuments(false);
      return;
    }

    setCheckingDocs(true);
    try {
      const selectedLead = leads.find(l => String(l.id) === currentLeadId);
      const cedula = selectedLead?.cedula || "";
      if (cedula) {
        const url = `/api/person-documents/check-cedula-folder?cedula=${cedula}`;
        const res = await api.get(url);
        setHasDocuments(!!res.data.exists);
      } else {
        setHasDocuments(false);
      }
    } catch (e) {
      setHasDocuments(false);
    } finally {
      setCheckingDocs(false);
    }
  }, [currentLeadId, leads]);

  // Verificar documentos al cambiar leadId
  useEffect(() => {
    checkDocs();
  }, [checkDocs]);

  // Manejador para subir documento directamente desde el modal
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentLeadId) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('person_id', currentLeadId);
    formData.append('file', file);

    try {
        // Usamos el endpoint existente de PersonDocumentController
        await api.post('/api/person-documents', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        toast({ title: "Documento subido", description: "El documento se ha vinculado correctamente." });
        
        // Volver a verificar documentos para habilitar el botón
        await checkDocs();
        
    } catch (error: any) {
        console.error("Upload error:", error);
        toast({ 
            title: "Error al subir", 
            description: error.response?.data?.message || "No se pudo subir el documento.", 
            variant: "destructive" 
        });
    } finally {
        setIsUploading(false);
        // Limpiar el input
        e.target.value = '';
    }
  };

  const onSubmit = async (values: CreateOpportunityFormValues) => {
      setIsSaving(true);

      try {
        const selectedLead = leads.find(l => String(l.id) === values.leadId);
        if (!selectedLead) {
            toast({ title: "Error", description: "Lead no válido.", variant: "destructive" });
            setIsSaving(false);
            return;
        }

        const body: CreateOpportunityPayload = {
            lead_cedula: selectedLead.cedula,
            vertical: values.vertical,
            opportunity_type: values.opportunityType,
            status: values.status,
            amount: values.amount || 0,
            expected_close_date: values.expectedCloseDate || null,
            comments: values.comments,
            assigned_to_id: selectedLead.assigned_to_id
        };

        await api.post('/api/opportunities', body);
        toast({ title: "Creado", description: "Oportunidad creada correctamente." });

        onOpenChange(false);
        if (onSuccess) onSuccess();
      } catch (error: any) {
          console.error("Error saving:", error);
          const errorMessage = error.response?.data?.message || "No se pudo guardar la oportunidad.";
          toast({ title: "Error", description: errorMessage, variant: "destructive" });
      } finally {
          setIsSaving(false);
      }
  };

  const availableLeadOptions = useMemo(() => {
    return leads.map((lead) => ({
      value: String(lead.id),
      label: `${lead.name}${lead.email ? ` · ${lead.email}` : ""}`,
    }));
  }, [leads]);

  const filteredVerticals = useMemo(() => {
    if (!searchVertical) return VERTICAL_OPTIONS;
    return VERTICAL_OPTIONS.filter((v) => v.toLowerCase().includes(searchVertical.toLowerCase()));
  }, [searchVertical]);

  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crear oportunidad</DialogTitle>
            <DialogDescription>Registra una nueva oportunidad.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
              <FormField
                control={form.control}
                name="leadId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lead asociado</FormLabel>
                    <Select 
                      value={field.value} 
                      onValueChange={field.onChange} 
                      disabled={isLeadSelectionDisabled}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un lead" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                          {availableLeadOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Sección de carga de documentos si no existen */}
              {!checkingDocs && !hasDocuments && currentLeadId && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-center gap-2 text-amber-800 mb-2">
                        <FileUp className="h-4 w-4" />
                        <h4 className="text-sm font-semibold">Requisito: Documento inicial</h4>
                    </div>
                    <p className="text-xs text-amber-700 mb-3">
                        Para crear una oportunidad, el expediente debe tener al menos un documento (ej. Cédula, Estado de cuenta).
                        Súbelo aquí para continuar.
                    </p>
                    <div className="flex items-center gap-3">
                        <Input 
                            type="file" 
                            onChange={handleFileUpload} 
                            disabled={isUploading}
                            className="bg-white text-sm h-9 file:text-xs"
                        />
                        {isUploading && <Loader2 className="h-4 w-4 animate-spin text-amber-600" />}
                    </div>
                </div>
              )}

              <FormField
                control={form.control}
                name="vertical"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vertical</FormLabel>
                    <Popover open={openVertical} onOpenChange={setOpenVertical} modal={true}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={openVertical}
                            className="w-full justify-between"
                          >
                            {field.value
                              ? VERTICAL_OPTIONS.find((v) => v === field.value)
                              : "Seleccionar vertical..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0 z-[200]">
                        <div className="p-2 border-b">
                            <Input 
                                placeholder="Buscar vertical..." 
                                value={searchVertical} 
                                onChange={(e) => setSearchVertical(e.target.value)}
                                className="h-8"
                            />
                        </div>
                        <div className="max-h-[300px] overflow-y-auto p-1">
                            {filteredVerticals.length === 0 ? (
                                <div className="py-6 text-center text-sm text-muted-foreground">No se encontraron resultados.</div>
                            ) : (
                                filteredVerticals.map((vertical) => (
                                    <div
                                        key={vertical}
                                        className={`relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ${field.value === vertical ? "bg-accent text-accent-foreground" : ""}`}
                                        onClick={() => {
                                            form.setValue("vertical", vertical);
                                            setOpenVertical(false);
                                            setSearchVertical("");
                                        }}
                                    >
                                        <Check
                                            className={`mr-2 h-4 w-4 ${
                                                field.value === vertical ? "opacity-100" : "opacity-0"
                                            }`}
                                        />
                                        {vertical}
                                    </div>
                                ))
                            )}
                        </div>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="opportunityType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                          {OPPORTUNITY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estado</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                              {OPPORTUNITY_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monto</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="expectedCloseDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cierre esperado</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="comments"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Comentarios</FormLabel>
                        <FormControl>
                          <Textarea rows={3} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              </div>
              <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                  {/* Se deshabilita si está guardando, verificando, subiendo archivo, o si NO hay documentos */}
                  <Button type="submit" disabled={isSaving || checkingDocs || isUploading || !hasDocuments}>
                    {isSaving
                      ? "Guardando..."
                      : checkingDocs
                        ? "Verificando..."
                        : isUploading
                            ? "Subiendo..."
                            : hasDocuments
                                ? "Guardar"
                                : "Requiere Documento"}
                  </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
  );
}