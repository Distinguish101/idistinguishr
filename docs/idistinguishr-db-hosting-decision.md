# IDistinguishR — Database Hosting Decision: Neon vs. Supabase

## Recommendation: Neon

## Why it edges out Supabase for this project

For a Next.js app, Neon is the stronger Postgres-only choice — it has a first-class Vercel integration, which matches the locked stack (Next.js + Vercel hosting).

The bigger reason: Supabase's main advantage is bundled auth, storage, and realtime — but this project already decided on **Auth.js** for authentication, not Supabase Auth (see `idistinguishr-stack-decision.md`). Supabase is the better choice if you want a full backend platform with auth, storage, edge functions, and real-time built in — since none of that is needed here, choosing Supabase would mean paying for/carrying complexity the project doesn't use. Neon gives exactly what the stack calls for: pure Postgres, nothing else bundled in.

There's also a practical cost/dev-experience angle for a project worked on in bursts (evenings/weekends) rather than run under constant traffic: Neon gives 100 CU-hours/month compute with scale-to-zero, and suspends compute automatically after a configurable idle timeout (as short as 5 minutes), resuming on the next query in under 500ms — versus Supabase's free tier, where inactive projects are paused after roughly one week of no activity and take longer to wake back up. For a project picked up intermittently, Neon's faster resume matters day-to-day.

One more plus for a portfolio piece: **database branching**. Neon offers pure Postgres with autoscaling, branching, and scale-to-zero — being able to create instant branches for testing schema changes (e.g. trying a migration before committing it) is a good habit to build and a good thing to be able to talk about in an interview.

## Bottom line

**Neon** — matches the Vercel deployment target, doesn't duplicate the Auth.js decision already made, and its scale-to-zero behavior suits intermittent solo dev sessions rather than sustained traffic.

## Setup

1. Create a project at [neon.tech](https://neon.tech)
2. Copy the connection string into `.env` as `DATABASE_URL`
3. Run `npx prisma migrate dev --name init` to apply the schema

## Source note

Comparison based on multiple independent Neon vs. Supabase reviews current as of mid-2026. Pricing and feature details on both platforms change periodically — worth a quick re-check at build time if this doc is read much later.
