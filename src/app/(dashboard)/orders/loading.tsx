export default function OrdersLoading() {
  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-36 bg-muted animate-pulse rounded" />
          <div className="h-4 w-52 bg-muted animate-pulse rounded mt-2" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 bg-muted animate-pulse rounded-lg" />
          <div className="h-9 w-24 bg-muted animate-pulse rounded-lg" />
        </div>
      </div>

      {/* Table rows skeleton */}
      <div className="border rounded-lg overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-6 gap-4 px-4 py-3 bg-muted/50">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-4 bg-muted animate-pulse rounded w-16" />
          ))}
        </div>
        {/* Body rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-6 gap-4 px-4 py-3 border-t"
          >
            <div className="h-4 bg-muted animate-pulse rounded w-12" />
            <div className="h-4 bg-muted animate-pulse rounded w-20" />
            <div className="h-4 bg-muted animate-pulse rounded w-16" />
            <div className="h-4 bg-muted animate-pulse rounded w-14" />
            <div className="h-6 bg-muted animate-pulse rounded-full w-16" />
            <div className="h-4 bg-muted animate-pulse rounded w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
