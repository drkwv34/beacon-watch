export default function StatusLoading() {
  return (
    <div className="skeleton" aria-busy="true" aria-live="polite">
      <p>Loading status…</p>
      <div className="skeleton-row" />
    </div>
  );
}
