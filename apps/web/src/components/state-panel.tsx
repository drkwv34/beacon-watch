import type { ReactNode } from 'react';

type Tone = 'neutral' | 'danger';

/** Shared empty / error container so every screen phrases non-happy states the same way. */
export function StatePanel({
  title,
  body,
  tone = 'neutral',
  action,
}: {
  title: string;
  body: string;
  tone?: Tone;
  action?: ReactNode;
}) {
  return (
    <section className={`state-panel state-panel--${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <h1>{title}</h1>
      <p>{body}</p>
      {action}
    </section>
  );
}
