import { relativeTimeLabel } from '../lib/format';

export function RelativeTime({ iso }: { iso: string | null | undefined }) {
  if (!iso) return <span>Never</span>;
  return (
    <time dateTime={iso} title={iso}>
      {relativeTimeLabel(iso)}
    </time>
  );
}
