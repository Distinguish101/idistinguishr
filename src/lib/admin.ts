// Deliberately not a Role enum value (see .env's ADMIN_EMAILS comment) —
// an email allowlist keeps admin access orthogonal to the STUDENT/TEACHER
// redirects already sprinkled through the app, with no migration needed.
export function isAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  const allowlist = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.toLowerCase());
}
