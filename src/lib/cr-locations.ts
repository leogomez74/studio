// Re-exporta desde costa-rica-regions.ts para mantener una sola fuente de datos.
// El page de clientes usa este formato con IDs numéricos.

import { COSTA_RICA_PROVINCES } from './costa-rica-regions';

export interface Location {
  id: string;
  name: string;
}

export interface Canton extends Location {
  districts: Location[];
}

export interface Province extends Location {
  cantons: Canton[];
}

export const PROVINCES: Province[] = COSTA_RICA_PROVINCES.map((p, pi) => ({
  id: String(pi + 1),
  name: p.name,
  cantons: p.cantons.map((c, ci) => ({
    id: `${(pi + 1) * 100 + (ci + 1)}`,
    name: c.name,
    districts: c.districts.map((d, di) => ({
      id: `${(pi + 1) * 100 + (ci + 1)}${String(di + 1).padStart(2, '0')}`,
      name: d,
    })),
  })),
}));
