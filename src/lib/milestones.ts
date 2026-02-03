export const MILESTONE_NONE_VALUE = "sin_hito" as const;

export type MilestoneValue = "sin_hito" | "amparo" | "ejecutoria" | "ejecucion" | "cobro";

export const MILESTONE_OPTIONS = [
  { value: MILESTONE_NONE_VALUE, label: "Sin hito" },
  { value: "amparo", label: "Amparo" },
  { value: "ejecutoria", label: "Ejecutoria" },
  { value: "ejecucion", label: "Ejecución" },
  { value: "cobro", label: "Cobro" }
] as const;

export const MILESTONE_VALUE_SET = new Set<MilestoneValue>([
  MILESTONE_NONE_VALUE,
  "amparo",
  "ejecutoria",
  "ejecucion",
  "cobro"
]);

export const MILESTONE_LABEL_MAP: Record<MilestoneValue, string> = {
  [MILESTONE_NONE_VALUE]: "Sin hito",
  amparo: "Amparo",
  ejecutoria: "Ejecutoria",
  ejecucion: "Ejecución",
  cobro: "Cobro"
};

export const normalizeMilestoneValue = (value?: string | null): MilestoneValue => {
  if (typeof value === "string" && MILESTONE_VALUE_SET.has(value as MilestoneValue)) {
    return value as MilestoneValue;
  }
  return MILESTONE_NONE_VALUE;
};

export const getMilestoneLabel = (value?: string | null): string => {
  const normalized = normalizeMilestoneValue(value);
  return MILESTONE_LABEL_MAP[normalized] ?? MILESTONE_LABEL_MAP[MILESTONE_NONE_VALUE];
};
