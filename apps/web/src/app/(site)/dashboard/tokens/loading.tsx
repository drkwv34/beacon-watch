export default function TokensLoading() {
  return (
    <div className="skeleton" aria-busy="true" aria-live="polite">
      <p>Loading API tokens…</p>
      <div className="skeleton-row" />
      <div className="skeleton-row" />
    </div>
  );
}
