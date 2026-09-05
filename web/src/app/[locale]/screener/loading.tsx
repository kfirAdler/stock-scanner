export default function ScreenerLoading() {
  return (
    <div className="page-shell max-w-[1580px]" aria-hidden="true">
      <div className="space-y-3">
        <div className="page-card-strong h-28 animate-pulse !p-4">
          <div className="h-3 w-24 rounded-full bg-surface-accent" />
          <div className="mt-3 h-5 w-48 max-w-full rounded-full bg-surface-accent" />
          <div className="mt-3 h-3 w-64 max-w-full rounded-full bg-surface-accent/70" />
        </div>
        <div className="ui-panel-subtle h-12 animate-pulse rounded-2xl" />
        <div className="ui-panel min-h-[420px] animate-pulse rounded-2xl" />
      </div>
    </div>
  );
}
