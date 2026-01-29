'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/contexts/PermissionsContext';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ProtectedPageProps {
  module: string;
  children: React.ReactNode;
}

export function ProtectedPage({ module, children }: ProtectedPageProps) {
  const { canViewModule, loading } = usePermissions();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && !canViewModule(module)) {
      toast({
        title: "Acceso denegado",
        description: "No tienes permisos para acceder a esta página.",
        variant: "destructive"
      });
      router.push('/dashboard');
    }
  }, [loading, canViewModule, module, router, toast]);

  // Mostrar loading mientras se cargan los permisos
  if (loading) {
    return (
      <div className="flex h-[calc(100vh-200px)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Si no tiene permiso, no mostrar nada (se redirigirá)
  if (!canViewModule(module)) {
    return null;
  }

  // Si tiene permiso, mostrar el contenido
  return <>{children}</>;
}
