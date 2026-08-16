import { Spinner } from "./Spinner";

// Rendered by each route's loading.tsx while its server component is
// fetching data — covers slow navigation/network delay, not just in-page
// button actions (see Spinner for those).
export function PageLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="page-loading">
      <Spinner size={28} />
      <p className="t-soft">{label}</p>
    </div>
  );
}
