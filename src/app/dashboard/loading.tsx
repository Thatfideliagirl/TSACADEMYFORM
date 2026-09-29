// Shown at once while the next page loads, so a click always feels answered.
export default function Loading() {
  return (
    <div className="flex animate-pulse flex-col gap-6" role="status" aria-label="Loading">
      <div className="h-9 w-56 rounded-xl bg-sky-deep" />
      <div className="h-5 w-80 max-w-full rounded-lg bg-sky-deep/70" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-sky-deep/60" />)}
      </div>
      <div className="h-40 rounded-2xl bg-sky-deep/50" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
