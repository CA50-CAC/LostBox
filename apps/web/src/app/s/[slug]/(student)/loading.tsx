/** Skeleton while the gallery loads. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="flex flex-col gap-2">
        <div className="skeleton h-10 w-2/3" />
        <div className="skeleton h-5 w-1/2" />
      </div>
      <div className="flex gap-2">
        <div className="skeleton h-12 flex-1" />
        <div className="skeleton size-12" />
      </div>
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton h-11 w-28 shrink-0 rounded-full" />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i} className="card flex flex-col gap-2 p-1.5 pb-3">
            <div className="skeleton aspect-square w-full" />
            <div className="skeleton mx-2 h-4 w-3/4" />
            <div className="skeleton mx-2 h-3 w-1/2" />
          </li>
        ))}
      </ul>
    </div>
  );
}
