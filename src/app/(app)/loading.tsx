// A quiet skeleton in the shape of a typical page -- title, a row of summary
// tiles, two cards -- instead of a spinner, so the layout doesn't jump when
// the real page lands (2026-11-19). Shimmer is turned off for anyone who
// has asked their system for less motion.
function Bar({ className = "" }: { className?: string }) {
  return <div className={`rounded-lg bg-surface motion-safe:animate-pulse ${className}`} />;
}

export default function Loading() {
  return (
    <div className="flex flex-col gap-8" role="status" aria-label="Loading">
      <div className="flex flex-col gap-2">
        <Bar className="h-7 w-48" />
        <Bar className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-6">
            <Bar className="h-9 w-9 rounded-xl" />
            <Bar className="h-4 w-24" />
            <Bar className="h-7 w-32" />
          </div>
        ))}
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-4 rounded-2xl border border-border bg-background p-6 sm:p-8">
          <Bar className="h-5 w-40" />
          <Bar className="h-4 w-full" />
          <Bar className="h-4 w-5/6" />
          <Bar className="h-4 w-2/3" />
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}
