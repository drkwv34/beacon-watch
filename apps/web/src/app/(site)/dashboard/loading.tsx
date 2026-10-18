export default function DashboardLoading() {
  return (
    <div className="skeleton" aria-busy="true" aria-live="polite">
      <p>Loading monitors…</p>
      <div className="skeleton-row" />
      <div className="skeleton-row" />
      <div className="skeleton-row" />
    </div>
  );
}
