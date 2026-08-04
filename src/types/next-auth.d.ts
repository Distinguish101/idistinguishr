import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

// Extends Auth.js's built-in types with the fields our jwt/session callbacks
// attach in src/lib/auth.ts (id + role) — see AC there for how they're set.

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
  }
}

// next-auth/jwt re-exports JWT from @auth/core/jwt via `export *`, which
// doesn't merge with `declare module "next-auth/jwt"` — augment the
// original module instead.
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
  }
}
