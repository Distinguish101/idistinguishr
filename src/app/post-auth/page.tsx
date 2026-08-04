import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Landing spot for OAuth redirects (which can't run client-side routing
// logic) — routes by role the same way AuthForm does for credentials.

export default async function PostAuthPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth");
  redirect(session.user.role === "TEACHER" ? "/teacher/profile" : "/dashboard");
}
