'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import api from '@/lib/axios';
import type { Investor } from '@/lib/data';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investor?: Investor | null;
  onSuccess: () => void;
};

export function InvestorFormDialog({ open, onOpenChange, investor, onSuccess }: Props) {
  const isEditing = !!investor;
  const [loading, setLoading] = useState(false);
  const [cedulaFile, setCedulaFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: '',
    cedula: '',
    email: '',
    phone: '',
    tipo_persona: 'Persona Física',
    status: 'Activo',
    cuenta_bancaria: '',
    banco: '',
    notas: '',
    // Datos para contrato
    nacionalidad: '',
    estado_civil: '',
    profesion: '',
    direccion_contrato: '',
    numero_pasaporte: '',
  });

  useEffect(() => {
    if (investor) {
      setForm({
        name: investor.name || '',
        cedula: investor.cedula || '',
        email: investor.email || '',
        phone: investor.phone || '',
        tipo_persona: investor.tipo_persona || 'Persona Física',
        status: investor.status || 'Activo',
        cuenta_bancaria: investor.cuenta_bancaria || '',
        banco: investor.banco || '',
        notas: investor.notas || '',
        nacionalidad: (investor as any).nacionalidad || '',
        estado_civil: (investor as any).estado_civil || '',
        profesion: (investor as any).profesion || '',
        direccion_contrato: (investor as any).direccion_contrato || '',
        numero_pasaporte: (investor as any).numero_pasaporte || '',
      });
    } else {
      setForm({
        name: '', cedula: '', email: '', phone: '',
        tipo_persona: 'Persona Física', status: 'Activo',
        cuenta_bancaria: '', banco: '', notas: '',
        nacionalidad: '', estado_civil: '', profesion: '',
        direccion_contrato: '', numero_pasaporte: '',
      });
      setCedulaFile(null);
    }
  }, [investor, open]);

  const cedulaLabel = form.tipo_persona === 'Persona Jurídica' ? 'Cédula Jurídica' : 'Cédula / Pasaporte';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let investorId: number;
      if (isEditing) {
        await api.patch(`/api/investors/${investor!.id}`, form);
        investorId = investor!.id;
      } else {
        const res = await api.post('/api/investors', form);
        investorId = res.data.id;
      }

      // Subir cédula/pasaporte si se adjuntó
      if (!isEditing && cedulaFile) {
        const formData = new FormData();
        formData.append('file', cedulaFile);
        formData.append('investor_id', String(investorId));
        formData.append('category', 'cedula_pasaporte');
        await api.post('/api/investor-documents', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      onOpenChange(false);
      onSuccess();
    } catch (err) {
      console.error('Error saving investor:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar Inversionista' : 'Nuevo Inversionista'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Modifica los datos del inversionista.' : 'Registra un nuevo inversionista en el sistema.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre <span className="text-red-500">*</span></Label>
              <Input id="name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="cedula">Cédula / Pasaporte <span className="text-red-500">*</span></Label>
                <Input id="cedula" placeholder="Número de identificación" value={form.cedula} onChange={e => setForm(p => ({ ...p, cedula: e.target.value }))} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tipo_persona">Tipo de Persona <span className="text-red-500">*</span></Label>
                <Select value={form.tipo_persona} onValueChange={v => setForm(p => ({ ...p, tipo_persona: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Persona Física">Persona Física</SelectItem>
                    <SelectItem value="Persona Jurídica">Persona Jurídica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
                <Input id="email" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Teléfono <span className="text-red-500">*</span></Label>
                <Input id="phone" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="banco">Banco <span className="text-red-500">*</span></Label>
                <Input id="banco" value={form.banco} onChange={e => setForm(p => ({ ...p, banco: e.target.value }))} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cuenta_bancaria">Cuenta Bancaria <span className="text-red-500">*</span></Label>
                <Input id="cuenta_bancaria" value={form.cuenta_bancaria} onChange={e => setForm(p => ({ ...p, cuenta_bancaria: e.target.value }))} required />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notas">Notas</Label>
              <Textarea id="notas" value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} rows={2} />
            </div>

            {/* ── Información Personal ───────────────────────────────────── */}
            <div className="border-t pt-3 mt-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Información Personal
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="nacionalidad">Nacionalidad <span className="text-red-500">*</span></Label>
                  <Input id="nacionalidad" placeholder="Ej: costarricense" value={form.nacionalidad} onChange={e => setForm(p => ({ ...p, nacionalidad: e.target.value }))} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="estado_civil">Estado Civil <span className="text-red-500">*</span></Label>
                  <Select value={form.estado_civil} onValueChange={v => setForm(p => ({ ...p, estado_civil: v }))}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="soltero/a">Soltero/a</SelectItem>
                      <SelectItem value="casado/a">Casado/a</SelectItem>
                      <SelectItem value="divorciado/a">Divorciado/a</SelectItem>
                      <SelectItem value="viudo/a">Viudo/a</SelectItem>
                      <SelectItem value="unión libre">Unión libre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2 mt-3">
                <Label htmlFor="profesion">Profesión / Ocupación <span className="text-red-500">*</span></Label>
                <Input id="profesion" placeholder="Ej: Comerciante" value={form.profesion} onChange={e => setForm(p => ({ ...p, profesion: e.target.value }))} required />
              </div>
              <div className="grid gap-2 mt-3">
                <Label htmlFor="direccion_contrato">Dirección <span className="text-red-500">*</span></Label>
                <Textarea id="direccion_contrato" placeholder="Ej: San José, cantón Central, distrito Mata Redonda..." value={form.direccion_contrato} onChange={e => setForm(p => ({ ...p, direccion_contrato: e.target.value }))} rows={2} required />
              </div>
            </div>

            {/* Campo de cédula/pasaporte — solo al crear */}
            {!isEditing && (
              <div className="grid gap-2">
                <Label htmlFor="cedula-file" className="flex items-center gap-1">
                  {cedulaLabel}
                  <span className="text-red-500">*</span>
                  <span className="text-xs text-muted-foreground font-normal ml-1">(requerido para crear inversiones)</span>
                </Label>
                <label
                  htmlFor="cedula-file"
                  className={`flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer text-sm transition-colors ${
                    cedulaFile ? 'bg-green-50 border-green-300 text-green-700' : 'bg-background border-input hover:bg-muted'
                  }`}
                >
                  {cedulaFile ? (
                    <span className="truncate">{cedulaFile.name}</span>
                  ) : (
                    <span className="text-muted-foreground">Seleccionar archivo...</span>
                  )}
                </label>
                <input
                  ref={fileInputRef}
                  id="cedula-file"
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,image/*,application/pdf"
                  onChange={e => setCedulaFile(e.target.files?.[0] ?? null)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Crear Inversionista'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
