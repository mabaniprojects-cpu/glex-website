/** Skeleton for the marketplace grid while products are fetched. */
export default function MarketplaceLoading() {
  return (
    <div className="container-glex py-16">
      <div role="status" aria-live="polite" className="sr-only">
        Loading products
      </div>

      <div className="animate-pulse lg:grid lg:grid-cols-[16rem_1fr] lg:gap-10" aria-hidden="true">
        <div className="hidden space-y-6 lg:block">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 rounded bg-glex-green-100" />
              <div className="h-11 w-full rounded-lg bg-glex-green-50" />
            </div>
          ))}
        </div>

        <div>
          <div className="h-4 w-32 rounded bg-glex-green-100" />
          <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-border-subtle">
                <div className="aspect-4/3 bg-glex-green-50" />
                <div className="space-y-3 p-5">
                  <div className="h-3 w-20 rounded bg-glex-green-100" />
                  <div className="h-4 w-full rounded bg-glex-green-100" />
                  <div className="h-3 w-4/5 rounded bg-glex-green-50" />
                  <div className="h-11 w-full rounded-lg bg-glex-green-50" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
