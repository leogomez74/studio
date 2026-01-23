// Mock fijo de empresas con sus documentos requeridos
// Fuente: documentos_empresas.txt

export interface Requirement {
  id?: number;
  name: string;
  file_extension: string;
  quantity: number;
}

export interface Empresa {
  id: number;
  business_name: string;
  requirements: Requirement[];
}

export const EMPRESAS_MOCK: Empresa[] = [
  { id: 1, business_name: '911', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'jpg', quantity: 6 }] },
  { id: 2, business_name: 'Archivo Nacional', requirements: [{ name: 'Comprobantes quincenales', file_extension: 'jpg', quantity: 6 }] },
  { id: 3, business_name: 'ASAMB L', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'jpg', quantity: 6 }] },
  { id: 4, business_name: 'AYA', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes mensuales', file_extension: 'pdf', quantity: 3 }] },
  { id: 5, business_name: 'CCSS', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'pdf', quantity: 6 }] },
  { id: 6, business_name: 'CEN CINAI', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'pdf', quantity: 6 }] },
  { id: 7, business_name: 'CNE', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'pdf', quantity: 6 }] },
  { id: 8, business_name: 'CNP', requirements: [{ name: 'Constancia y comprobantes quincenales', file_extension: 'pdf', quantity: 1 }] },
  { id: 9, business_name: 'CONAVI', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'jpg', quantity: 6 }] },
  { id: 10, business_name: 'COSEVI', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'jpg', quantity: 6 }] },
  { id: 11, business_name: 'DEFENSORIA', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'jpg', quantity: 6 }] },
  { id: 12, business_name: 'DGAC', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'jpg', quantity: 6 }] },
  { id: 13, business_name: 'DGSC', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'html', quantity: 6 }] },
  { id: 14, business_name: 'DINADECO', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'pdf', quantity: 6 }] },
  { id: 15, business_name: 'FITOSANITARIO', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'pdf', quantity: 5 }] },
  { id: 16, business_name: 'ICD', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales (un solo pdf)', file_extension: 'pdf', quantity: 6 }] },
  { id: 17, business_name: 'ICE', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'html', quantity: 6 }] },
  { id: 18, business_name: 'IMAS', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'pdf', quantity: 6 }] },
  { id: 19, business_name: 'IMPRENTA NACIONAL', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'html', quantity: 6 }] },
  { id: 20, business_name: 'INA', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes mensuales', file_extension: 'pdf', quantity: 3 }] },
  { id: 21, business_name: 'INDER', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes mensuales', file_extension: 'pdf', quantity: 3 }] },
  { id: 22, business_name: 'INVU', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'pdf', quantity: 6 }] },
  { id: 23, business_name: 'MAG', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'pdf', quantity: 6 }] },
  { id: 24, business_name: 'MCE', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'html', quantity: 6 }] },
  { id: 25, business_name: 'MCJ', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales (un solo pdf)', file_extension: 'pdf', quantity: 6 }] },
  { id: 26, business_name: 'MEIC', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'html', quantity: 6 }] },
  { id: 27, business_name: 'MEP', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'html', quantity: 6 }] },
  { id: 28, business_name: 'MGP', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'html', quantity: 6 }] },
  { id: 29, business_name: 'MH', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales (un pdf)', file_extension: 'pdf', quantity: 4 }] },
  { id: 30, business_name: 'MIDEPLAN', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'html', quantity: 6 }] },
  { id: 31, business_name: 'MIGRACION', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'html', quantity: 6 }] },
  { id: 32, business_name: 'MINAE', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'pdf', quantity: 6 }] },
  { id: 33, business_name: 'MINIST DE SALUD', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'html', quantity: 6 }] },
  { id: 34, business_name: 'MJP', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'html', quantity: 6 }] },
  { id: 35, business_name: 'MOPT', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'html', quantity: 6 }] },
  { id: 36, business_name: 'MREC', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales (un pdf)', file_extension: 'pdf', quantity: 7 }] },
  { id: 37, business_name: 'MSP', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'html', quantity: 6 }] },
  { id: 38, business_name: 'MTSS', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'html', quantity: 6 }] },
  { id: 39, business_name: 'MUN DE ASERRI', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'pdf', quantity: 6 }] },
  { id: 40, business_name: 'MUN DE DESAM', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'pdf', quantity: 6 }] },
  { id: 41, business_name: 'MUN DE GOICO', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'jpg', quantity: 6 }] },
  { id: 42, business_name: 'MUN DE OREAMU', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'pdf', quantity: 6 }] },
  { id: 43, business_name: 'MUN DE SAN P', requirements: [{ name: 'Constancia', file_extension: 'jpg', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'pdf', quantity: 6 }] },
  { id: 44, business_name: 'MUN DE SJ', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'pdf', quantity: 6 }] },
  { id: 45, business_name: 'MUN DE TIBAS', requirements: [{ name: 'Constancia', file_extension: 'jpg', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'pdf', quantity: 6 }] },
  { id: 46, business_name: 'PANI', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'pdf', quantity: 6 }] },
  { id: 47, business_name: 'PENSIONADOS PJ', requirements: [{ name: 'Constancia', file_extension: 'jpg', quantity: 1 }, { name: 'Comprobantes quincenales (un pdf)', file_extension: 'pdf', quantity: 12 }] },
  { id: 48, business_name: 'PGR', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'pdf', quantity: 6 }] },
  { id: 49, business_name: 'PODER JUDICIAL', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'pdf', quantity: 6 }] },
  { id: 50, business_name: 'RECOPE', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'pdf', quantity: 6 }] },
  { id: 51, business_name: 'RN', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'html', quantity: 6 }] },
  { id: 52, business_name: 'TSE', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'html', quantity: 6 }] },
  { id: 53, business_name: 'UCR', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes mensuales', file_extension: 'pdf', quantity: 3 }] },
  { id: 54, business_name: 'J ADMIN RN', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'pdf', quantity: 6 }] },
  { id: 55, business_name: 'TSC', requirements: [{ name: 'Constancia', file_extension: 'pdf', quantity: 1 }, { name: 'Comprobantes quincenales', file_extension: 'html', quantity: 6 }] },
];

/**
 * Busca una empresa por nombre (case-insensitive, partial match)
 */
export function findEmpresaByName(institucion: string | null | undefined): Empresa | undefined {
  if (!institucion) return undefined;

  const normalizedInput = institucion.toLowerCase().trim();

  // Primero intenta match exacto
  const exactMatch = EMPRESAS_MOCK.find(
    e => e.business_name.toLowerCase() === normalizedInput
  );
  if (exactMatch) return exactMatch;

  // Luego intenta match parcial
  return EMPRESAS_MOCK.find(
    e => normalizedInput.includes(e.business_name.toLowerCase()) ||
         e.business_name.toLowerCase().includes(normalizedInput)
  );
}

/**
 * Obtiene la extensión de un archivo
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

/**
 * Verifica si un nombre de archivo coincide con un requisito
 */
export function matchesRequirement(filename: string, requirementName: string): boolean {
  const normalizedFilename = filename.toLowerCase();
  const normalizedReq = requirementName.toLowerCase();

  // Keywords específicos para cada tipo de documento
  // El orden importa: más específico primero
  const documentTypes: Array<{ requirement: string; keywords: string[]; excludeKeywords?: string[] }> = [
    {
      // Comprobantes de pago (quincenales, mensuales)
      requirement: 'comprobante',
      keywords: ['comprobante', 'colilla', 'coletilla', 'recibo de pago', 'quincena', 'quincenal', 'mensual', 'boleta'],
      excludeKeywords: [] // No excluir nada
    },
    {
      // Constancia salarial - debe tener "constancia" explícitamente
      requirement: 'constancia',
      keywords: ['constancia salarial', 'constancia de salario', 'cert salarial', 'certificacion salarial'],
      excludeKeywords: ['colilla', 'coletilla', 'comprobante', 'quincena', 'quincenal'] // Excluir comprobantes
    }
  ];

  // Verificar cada tipo de documento
  for (const docType of documentTypes) {
    if (normalizedReq.includes(docType.requirement)) {
      // Primero verificar exclusiones
      if (docType.excludeKeywords?.some(exclude => normalizedFilename.includes(exclude))) {
        continue; // Este archivo no es de este tipo
      }

      // Verificar si el archivo tiene alguno de los keywords
      if (docType.keywords.some(keyword => normalizedFilename.includes(keyword))) {
        return true;
      }
    }
  }

  // Fallback: verificar si el nombre del archivo contiene palabras del requisito (>4 chars)
  const reqWords = normalizedReq.split(' ').filter(w => w.length > 4);
  for (const word of reqWords) {
    if (normalizedFilename.includes(word)) {
      return true;
    }
  }

  return false;
}
