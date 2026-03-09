'use client';

import React, { useState, useEffect } from 'react';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, MoreHorizontal, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/auth-guard';
import api from '@/lib/axios';

interface Product {
  id?: number;
  name: string;
  slug?: string;
  description: string | null;
  is_default: boolean;
  order_column: number;
}

const ProductosCRUD: React.FC = () => {
  const { toast } = useToast();
  const { token } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [productForm, setProductForm] = useState<Product>({
    name: '',
    description: '',
    is_default: false,
    order_column: 0,
  });

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/products?all=true');
      setProducts(res.data);
    } catch (err) {
      console.error('Error fetching products:', err);
      toast({ title: 'Error', description: 'No se pudieron cargar los créditos.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const openCreateDialog = () => {
    setEditingProduct(null);
    setProductForm({ name: '', description: '', is_default: false, order_column: products.length + 1 });
    setIsDialogOpen(true);
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setProductForm({ ...product });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingProduct(null);
    setProductForm({ name: '', description: '', is_default: false, order_column: 0 });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim()) {
      toast({ title: 'Error', description: 'El nombre del crédito es obligatorio.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: productForm.name.trim(),
        description: productForm.description || '',
        is_default: productForm.is_default,
        order_column: productForm.order_column,
      };

      if (editingProduct) {
        await api.put(`/api/products/${editingProduct.id}`, payload);
        toast({ title: 'Actualizado', description: 'Crédito actualizado correctamente.' });
      } else {
        await api.post('/api/products', payload);
        toast({ title: 'Creado', description: 'Crédito creado correctamente.' });
      }

      closeDialog();
      fetchProducts();
    } catch (err: any) {
      console.error(err);
      const msg = err?.response?.data?.message || 'No se pudo guardar el crédito.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`¿Eliminar el crédito "${product.name}"?`)) return;

    try {
      await api.delete(`/api/products/${product.id}`);
      toast({ title: 'Eliminado', description: 'Crédito eliminado correctamente.' });
      fetchProducts();
    } catch (err) {
      console.error('Error deleting product:', err);
      toast({ title: 'Error', description: 'No se pudo eliminar el crédito.', variant: 'destructive' });
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Tipos de Créditos</CardTitle>
            <CardDescription>Gestiona los tipos de créditos y servicios ofrecidos por la empresa.</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1" onClick={openCreateDialog}>
                <PlusCircle className="h-4 w-4" />
                Nuevo Crédito
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingProduct ? 'Editar Crédito' : 'Crear Crédito'}</DialogTitle>
                <DialogDescription>Define el nombre y descripción del tipo de crédito.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="product-name">Nombre del Crédito</Label>
                  <Input
                    id="product-name"
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    placeholder="Ej: Micro Crédito"
                    required
                    disabled={saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-description">Descripción</Label>
                  <Input
                    id="product-description"
                    value={productForm.description || ''}
                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                    placeholder="Ej: Préstamos pequeños de rápida aprobación"
                    disabled={saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-order">Orden</Label>
                  <Input
                    id="product-order"
                    type="number"
                    min="1"
                    value={productForm.order_column}
                    onChange={(e) => setProductForm({ ...productForm, order_column: parseInt(e.target.value) || 1 })}
                    disabled={saving}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="product-default"
                    checked={productForm.is_default}
                    onChange={(e) => setProductForm({ ...productForm, is_default: e.target.checked })}
                    disabled={saving}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="product-default" className="text-sm font-normal">Marcar como crédito por defecto</Label>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={closeDialog} disabled={saving}>Cancelar</Button>
                  <Button type="submit" disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Guardar
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Orden</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="w-[100px]">Por Defecto</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">No hay créditos registrados.</TableCell>
                </TableRow>
              ) : (
                products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-mono">{product.order_column}</TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="text-muted-foreground">{product.description || '-'}</TableCell>
                    <TableCell>
                      {product.is_default ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">Sí</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">No</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menú</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => openEditDialog(product)}>Editar</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(product)}>Eliminar</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default ProductosCRUD;
