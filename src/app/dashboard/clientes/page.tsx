'use client';
import React, { useState, useEffect } from 'react';
import { MoreHorizontal, PlusCircle, Loader2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';

// Importamos la conexión real y los tipos
import api from '@/lib/axios';
import { type Client, type Lead } from '@/lib/data';

export default function ClientesPage() {
  const [clientsData, setClientsData] = useState<Client[]>([]);
  const [leadsData, setLeadsData] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Hacemos las peticiones paralelas
        const [resClients, resLeads] = await Promise.all([
          api.get('/api/clients'),
          api.get('/api/leads')
        ]);

        // Manejo robusto de la respuesta (por si viene paginada o no)
        const clientsArray = resClients.data.data || resClients.data;
        const leadsArray = resLeads.data.data || resLeads.data;

        setClientsData(Array.isArray(clientsArray) ? clientsArray : []);
        setLeadsData(Array.isArray(leadsArray) ? leadsArray : []);

      } catch (err) {
        console.error("Error cargando datos:", err);
        setError("Error de conexión. Verifica que el backend esté corriendo.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (error) return <div className="p-8 text-center text-destructive">{error}</div>;

  return (
    <Tabs defaultValue="leads">
      <div className="flex items-center justify-between mb-4">
        <TabsList>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">
            <Button size="sm" className="gap-1">
                <PlusCircle className="h-4 w-4" />
                Agregar
            </Button>
        </div>
      </div>

      <TabsContent value="leads">
        <Card>
          <CardHeader>
            <CardTitle>Leads ({leadsData.length})</CardTitle>
            <CardDescription>Gestiona los leads o clientes potenciales.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div> : <LeadsTable data={leadsData} />}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="clientes">
        <Card>
          <CardHeader>
            <CardTitle>Clientes ({clientsData.length})</CardTitle>
            <CardDescription>Gestiona los clientes existentes.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div> : <ClientsTable data={clientsData} />}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

// --- Componentes de Tabla ---

function ClientsTable({ data }: { data: Client[] }) {
    if (data.length === 0) return <div className="text-center p-4 text-muted-foreground">No hay clientes registrados.</div>;

    return (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Cédula</TableHead>
              <TableHead className="hidden md:table-cell">Contacto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead><span className="sr-only">Acciones</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((client) => (
              <TableRow key={client.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={`https://ui-avatars.com/api/?name=${client.name}`} />
                      <AvatarFallback>{client.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="font-medium">{client.name}</div>
                  </div>
                </TableCell>
                <TableCell>{client.cedula}</TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="text-sm text-muted-foreground">{client.email}</div>
                  <div className="text-sm text-muted-foreground">{client.phone}</div>
                </TableCell>
                <TableCell><Badge variant="default">Activo</Badge></TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                      <DropdownMenuItem>Ver Perfil</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
    )
}

function LeadsTable({ data }: { data: Lead[] }) {
    if (data.length === 0) return <div className="text-center p-4 text-muted-foreground">No hay leads registrados.</div>;

    return (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lead</TableHead>
              <TableHead>Cédula</TableHead>
              <TableHead className="hidden md:table-cell">Contacto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead><span className="sr-only">Acciones</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((lead) => (
              <TableRow key={lead.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                        <AvatarImage src={`https://ui-avatars.com/api/?name=${lead.name}&background=random`} />
                        <AvatarFallback>{lead.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="font-medium">{lead.name}</div>
                  </div>
                </TableCell>
                <TableCell>{lead.cedula}</TableCell>
                <TableCell className="hidden md:table-cell">
                    <div className="text-sm text-muted-foreground">{lead.email}</div>
                    <div className="text-sm text-muted-foreground">{lead.phone}</div>
                </TableCell>
                <TableCell><Badge variant="outline">{lead.lead_status_id || 'Nuevo'}</Badge></TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                      <DropdownMenuItem>Convertir a Cliente</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
    );
}