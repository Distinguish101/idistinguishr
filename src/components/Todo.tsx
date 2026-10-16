import { SITE_INFO, infoOrPlaceholder } from "@/lib/site-info";

// Inline value from SITE_INFO: plain text once filled in, a highlighted
// "[placeholder]" until then.
export function Info({ field, label }: { field: keyof typeof SITE_INFO; label: string }) {
  const v = infoOrPlaceholder(SITE_INFO[field] as string | null, label);
  return v.isPlaceholder ? <mark className="todo">{v.text}</mark> : <>{v.text}</>;
}

// A highlighted placeholder for something that hasn't been decided yet.
export function Todo({ children }: { children: React.ReactNode }) {
  return <mark className="todo">[{children}]</mark>;
}

// Shown at the top of legal pages until a solicitor has reviewed them
// (SITE_INFO.legalReviewedOn is set).
export function DraftNotice() {
  if (SITE_INFO.legalReviewedOn) return null;
  return (
    <p className="draft-notice" role="note">
      <strong>Draft.</strong> This page is a working draft and hasn&apos;t been reviewed by a solicitor. Parts marked in
      brackets are still to be confirmed.
    </p>
  );
}
