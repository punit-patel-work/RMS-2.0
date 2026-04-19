export default function POSLoading() {
  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="h-7 w-32 bg-muted animate-pulse rounded" />
          <div className="h-4 w-48 bg-muted animate-pulse rounded mt-2" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-4 w-16 bg-muted animate-pulse rounded" />
          <div className="h-4 w-16 bg-muted animate-pulse rounded" />
          <div className="h-10 w-28 bg-muted animate-pulse rounded-lg" />
          <div className="h-10 w-32 bg-muted animate-pulse rounded-lg" />
        </div>
      </div>

      {/* Table grid skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="border-2 border-muted rounded-lg p-3 md:p-4 space-y-3 animate-pulse"
          >
            <div className="flex items-center justify-between">
              <div className="h-6 w-16 bg-muted rounded" />
              <div className="w-3 h-3 rounded-full bg-muted" />
            </div>
            <div className="h-4 w-20 bg-muted rounded" />
            <div className="h-6 w-full bg-muted rounded" />
            <div className="grid grid-cols-2 gap-1">
              <div className="h-7 bg-muted rounded" />
              <div className="h-7 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
