import type { DisplayStatus } from '@beacon-watch/domain';

export const STATUS_BADGE_LABELS: Record<DisplayStatus, string> = {
  up: 'Up',
  down: 'Down',
  unknown: 'Unknown',
  paused: 'Paused',
};

export const PUBLIC_STATUS_NOTICE = {
  paused: 'Monitoring is paused',
  starting: 'Monitoring starting…',
  never_succeeded: 'No successful checks yet.',
} as const;

export type PublicStatusNoticeKind = keyof typeof PUBLIC_STATUS_NOTICE;

/** FR-PUB-002 copy selection. Paused wins over empty/never-succeeded. */
export function selectPublicStatusNotice(input: {
  status: DisplayStatus;
  check_count: number;
  ever_succeeded: boolean;
}): PublicStatusNoticeKind | null {
  if (input.status === 'paused') return 'paused';
  if (input.check_count <= 0) return 'starting';
  if (!input.ever_succeeded) return 'never_succeeded';
  return null;
}
