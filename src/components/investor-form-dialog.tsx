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
      });
    } else {
      setForm({
        name: '', cedula: '', email: '', phone: '',
        tipo_persona: 'Persona Física', status: 'Activo',
        cuenta_bancaria: '', banco: '', notas: '',
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
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar Inversionista' : 'Nuevo Inversionista'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Modifica los datos del inversionista.' : 'Registra un nuevo inversionista en el sistema.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input id="name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="cedula">Cédula</Label>
                <Input id="cedula" value={form.cedula} onChange={e => setForm(p => ({ ...p, cedula: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tipo_persona">Tipo de Persona</Label>
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
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input id="phone" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="banco">Banco</Label>
                <Input id="banco" value={form.banco} onChange={e => setForm(p => ({ ...p, banco: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cuenta_bancaria">Cuenta Bancaria</Label>
                <Input id="cuenta_bancaria" value={form.cuenta_bancaria} onChange={e => setForm(p => ({ ...p, cuenta_bancaria: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notas">Notas</Label>
              <Textarea id="notas" value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} rows={3} />
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
