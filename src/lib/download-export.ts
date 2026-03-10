import api from '@/lib/axios';
import { toastError } from '@/hooks/use-toast';

/**
 * Descarga un archivo de exportación usando axios (con auth header) y dispara la descarga en el navegador.
 * Reemplaza `window.open(url)` para rutas protegidas con auth:sanctum.
 */
export async function downloadExport(url: string, filename: string): Promise<void> {
  try {
    const res = await api.get(url, { responseType: 'blob' });
    const href = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(href);
  } catch {
    toastError('Error al generar el archivo de exportación.');
  }
}
