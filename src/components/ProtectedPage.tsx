'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/contexts/PermissionsContext';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ProtectedPageProps {
  module: string | string[];
  children: React.ReactNode;
}

export function ProtectedPage({ module, children }: ProtectedPageProps) {
  const { canViewModule, loading } = usePermissions();
  const router = useRouter();
  const { toast } = useToast();

  const hasAccess = Array.isArray(module)
    ? module.some((m) => canViewModule(m))
    : canViewModule(module);

  useEffect(() => {
    if (!loading && !hasAccess) {
      toast({
        title: "Acceso denegado",
        description: "No tienes permisos para acceder a esta página.",
        variant: "destructive"
      });
      router.push('/dashboard');
    }
  }, [loading, hasAccess, router, toast]);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-200px)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasAccess) {
    return null;
  }

  return <>{children}</>;
}
