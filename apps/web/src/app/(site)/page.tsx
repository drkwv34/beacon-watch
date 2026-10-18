import { StatePanel } from '../../components/state-panel';

export default function HomePage() {
  return (
    <StatePanel
      tone="neutral"
      title="beacon-watch"
      body="Sign in to add HTTP monitors, or open a public status page at /s/{slug}."
      action={
        <span className="cta-row">
          <a className="button" href="/login">
            Sign in
          </a>
          <a className="button button--ghost" href="/register">
            Register
          </a>
        </span>
      }
    />
  );
}
