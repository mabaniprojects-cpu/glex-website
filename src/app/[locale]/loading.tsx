/**
 * Route-level loading state. Purely decorative skeleton — the accessible
 * announcement is carried by the `role="status"` label, not the shapes.
 */
export default function Loading() {
  return (
    <div className="container-glex py-20">
      <div role="status" aria-live="polite" className="sr-only">
        Loading
      </div>

      <div className="animate-pulse space-y-8" aria-hidden="true">
        <div className="h-10 w-2/3 max-w-md rounded-lg bg-glex-green-100" />
        <div className="space-y-3">
          <div className="h-4 w-full max-w-2xl rounded bg-glex-green-50" />
          <div className="h-4 w-5/6 max-w-xl rounded bg-glex-green-50" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-40 rounded-xl bg-glex-green-50" />
          ))}
        </div>
      </div>
    </div>
  )
}
