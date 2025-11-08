'use client';

import { useEffect } from 'react';
import { redirect } from 'next/navigation';

export default function ProyectoPage() {
  useEffect(() => {
    redirect('/backend-plan.md');
  }, []);

  return null;
}
