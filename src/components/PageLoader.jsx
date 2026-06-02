export default function PageLoader() {
  return (
    <div
      role="status"
      aria-label="Loading page"
      className="min-h-[60vh] flex items-center justify-center"
    >
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      <span className="sr-only">Loading...</span>
    </div>
  )
}
