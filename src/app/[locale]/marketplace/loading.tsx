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
              <div className="bg-glex-green-100 h-4 w-24 rounded" />
              <div className="bg-glex-green-50 h-11 w-full rounded-lg" />
            </div>
          ))}
        </div>

        <div>
          <div className="bg-glex-green-100 h-4 w-32 rounded" />
          <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="border-border-subtle overflow-hidden rounded-xl border">
                <div className="bg-glex-green-50 aspect-square" />
                <div className="space-y-3 p-5">
                  <div className="bg-glex-green-100 h-3 w-20 rounded" />
                  <div className="bg-glex-green-100 h-4 w-full rounded" />
                  <div className="bg-glex-green-50 h-3 w-4/5 rounded" />
                  <div className="bg-glex-green-50 h-11 w-full rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
