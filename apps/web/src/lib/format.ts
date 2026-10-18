export function formatLatency(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—';
  return `${ms} ms`;
}

export function formatUptime(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined) return '—';
  return `${(ratio * 100).toFixed(2)}%`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function relativeTimeLabel(iso: string | null | undefined, nowMs = Date.now()): string {
  if (!iso) return 'Never';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return 'Never';
  const deltaSec = Math.round((nowMs - then) / 1000);
  const abs = Math.abs(deltaSec);
  if (abs < 10) return deltaSec >= 0 ? 'just now' : 'in a few seconds';
  if (abs < 60) return deltaSec >= 0 ? `${abs}s ago` : `in ${abs}s`;
  const minutes = Math.round(abs / 60);
  if (minutes < 60) return deltaSec >= 0 ? `${minutes}m ago` : `in ${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return deltaSec >= 0 ? `${hours}h ago` : `in ${hours}h`;
  const days = Math.round(hours / 24);
  return deltaSec >= 0 ? `${days}d ago` : `in ${days}d`;
}
