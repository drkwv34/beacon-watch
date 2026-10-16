export const INCIDENT_STATUSES = ['open', 'resolved'] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const INCIDENT_ACTIONS = ['none', 'open', 'resolve'] as const;
export type IncidentAction = (typeof INCIDENT_ACTIONS)[number];

export function isIncidentStatus(value: unknown): value is IncidentStatus {
  return typeof value === 'string' && (INCIDENT_STATUSES as readonly string[]).includes(value);
}

export interface Counters {
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  hasOpenIncident: boolean;
}

export interface Thresholds {
  grace: number;
  recovery: number;
}

export interface Transition {
  counters: Counters;
  action: IncidentAction;
}

/**
 * Appendix B incident machine. Pure and total: counters reset on the opposite
 * outcome; open when failures reach grace with no open incident; resolve when
 * successes reach recovery with an open incident.
 */
export function applyCheckResult(prev: Counters, success: boolean, t: Thresholds): Transition {
  if (success) {
    const consecutiveSuccesses = prev.consecutiveSuccesses + 1;
    const consecutiveFailures = 0;
    if (prev.hasOpenIncident && consecutiveSuccesses >= t.recovery) {
      return {
        counters: { consecutiveFailures, consecutiveSuccesses, hasOpenIncident: false },
        action: 'resolve',
      };
    }
    return {
      counters: { consecutiveFailures, consecutiveSuccesses, hasOpenIncident: prev.hasOpenIncident },
      action: 'none',
    };
  }

  const consecutiveFailures = prev.consecutiveFailures + 1;
  const consecutiveSuccesses = 0;
  if (!prev.hasOpenIncident && consecutiveFailures >= t.grace) {
    return {
      counters: { consecutiveFailures, consecutiveSuccesses, hasOpenIncident: true },
      action: 'open',
    };
  }
  return {
    counters: { consecutiveFailures, consecutiveSuccesses, hasOpenIncident: prev.hasOpenIncident },
    action: 'none',
  };
}
