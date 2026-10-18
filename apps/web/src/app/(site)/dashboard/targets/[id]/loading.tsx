export default function TargetDetailLoading() {
  return (
    <div className="skeleton" aria-busy="true" aria-live="polite">
      <p>Loading monitor…</p>
      <div className="skeleton-row" />
      <div className="skeleton-row" />
    </div>
  );
}
