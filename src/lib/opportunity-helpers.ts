import type { Opportunity } from "@/lib/data";

/**
 * Statuses that are considered "finalized" — the opportunity is no longer active.
 * Only when ALL opportunities have one of these statuses (or none exist) can a new one be created.
 */
const INACTIVE_STATUSES = ["Analizada", "Cerrada"];

/**
 * Returns true if there is at least one opportunity with an active status
 * (i.e. not "Analizada" or "Cerrada").
 *
 * Use this to DISABLE the "Create Opportunity" button:
 *   disabled={hasActiveOpportunity(opportunities)}
 */
export function hasActiveOpportunity(
  opportunities: Pick<Opportunity, "status">[] | undefined | null
): boolean {
  if (!opportunities || opportunities.length === 0) return false;
  return opportunities.some((o) => !INACTIVE_STATUSES.includes(o.status));
}

/**
 * Returns a user-facing message explaining why creation is blocked.
 * Returns null if creation is allowed.
 */
export function getActiveOpportunityMessage(
  opportunities: Pick<Opportunity, "status">[] | undefined | null
): string | null {
  if (!hasActiveOpportunity(opportunities)) return null;
  return "Ya existe una oportunidad activa. Debe estar en estado \"Analizada\" o \"Cerrada\" para crear una nueva.";
}
