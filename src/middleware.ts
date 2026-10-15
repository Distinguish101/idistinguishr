import { NextResponse, type NextRequest } from "next/server";
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE, isTheme } from "@/lib/theme";

// A shareable "try this theme" link: /anything?theme=midnight switches the
// visitor to that theme and remembers it.
//
// It does not redirect. A redirect needs an absolute URL, and behind the proxy
// the server's own idea of its origin is the pod's internal address (the same
// trap as the sign-out bug). Instead the cookie is set on the response, and
// also patched into this request's headers so the page that renders right now
// already sees the new theme.
export function middleware(req: NextRequest) {
  const theme = req.nextUrl.searchParams.get("theme");
  if (!isTheme(theme)) return NextResponse.next();

  const headers = new Headers(req.headers);
  const others = (req.headers.get("cookie") ?? "")
    .split(";")
    .map((c) => c.trim())
    .filter((c) => c && !c.startsWith(`${THEME_COOKIE}=`));
  headers.set("cookie", [...others, `${THEME_COOKIE}=${theme}`].join("; "));

  const res = NextResponse.next({ request: { headers } });
  res.cookies.set(THEME_COOKIE, theme, { path: "/", maxAge: THEME_COOKIE_MAX_AGE, sameSite: "lax" });
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
