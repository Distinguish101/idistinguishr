# IDistinguishR — Stack Decision: Next.js vs. Python Backend

## Context

Research question: which stack best serves the goal of this project — a CV-strengthening portfolio piece aimed at junior Software Engineer / Junior Software Developer / AI Engineer roles in Europe.

---

## Option A: Next.js (React + TypeScript) full-stack

### Pros
- One language (TypeScript) across frontend and backend — less context-switching, faster to build solo
- Prisma + Postgres + Next.js is one of the most common "modern stack" combos in European job postings right now
- Deploy story is trivial (Vercel, zero-config) — less DevOps overhead to learn/manage as a solo builder
- Shows full-stack range in a single coherent codebase, which reads well in a CV/portfolio review
- Type safety end-to-end (shared types between frontend and backend) is a genuinely valued skill signal

### Cons
- Doesn't touch Python at all, and Python has the highest raw job listing volume of any language across European tech postings in 2026 — so this stack doesn't directly speak to the biggest single pool of listings
- Next.js API routes are fine for an MVP but read as "less serious backend" to some interviewers vs. a dedicated backend framework — some may expect to see backend architecture reasoned about separately from frontend
- Doesn't touch the ML/AI ecosystem (TensorFlow/PyTorch/etc.), which is where a chunk of Python's volume comes from

---

## Option B: Python (Django or FastAPI) backend + React frontend

### Pros
- Aligns with the largest single-language job pool in Europe — most full-stack job descriptions require proficiency in React, Node.js, Python, PostgreSQL, and cloud platforms like AWS, so Python backend + React frontend hits multiple keywords at once
- Django in particular is a strong "serious backend" signal — ORM, admin panel, auth, migrations all built in, shows you can reason about backend architecture properly
- Positions you better if you pivot toward the AI engineer track later — Python is the shared language with ML tooling, so a future AI feature (recommendation engine, etc.) fits naturally without adding a second language
- FastAPI specifically is popular for building the kind of API you'd want if you ever add an AI/ML service alongside it

### Cons
- Two languages in one project (Python backend, TypeScript/JS frontend) — more context switching, and you're maintaining two type systems, two dependency managers, two deploy pipelines
- More setup/DevOps overhead: separate frontend and backend deploys, CORS config, etc. — more to get right as a solo builder
- Slower to stand up an MVP end-to-end compared to Next.js's batteries-included approach

---

## Recommendation: Next.js (Option A)

Two reasons, both tied to what this project is actually optimizing for — a CV project, not a production company:

1. **Solo build speed vs. team-scale concerns.** Django's advantages (admin panel, enforced structure, separation of concerns) matter most on a team, at scale. This is one person shipping an MVP — the overhead of two languages and two deploy pipelines costs more time than it earns in credibility, especially while also learning Stripe Connect, auth, and a data model from scratch in parallel.

2. **The Python argument is really an ML/AI argument, and that story is still available.** Python's job-market dominance is driven largely by the continued expansion of ML/AI engineering roles, split roughly 40% ML/data engineering and 60% backend — meaning a meaningful chunk of that volume is Python-for-ML, not Python-for-web-backend. That story can be captured later by bolting on a small Python/FastAPI microservice specifically for an AI feature (e.g., teacher-matching), which is actually a stronger CV story than "I used Python for CRUD" — it shows the ability to integrate a second stack for a specific technical reason, not just because it's what the project started with.

**Net decision:** Next.js + TypeScript + Postgres gets the MVP built faster and still hits the core keywords (React, Node.js, Postgres, cloud). The Python/AI story, if wanted, gets added deliberately later as a scoped microservice — a stronger signal than building the whole thing in Python from day one.

---

## Locked stack

| Layer | Choice |
|---|---|
| Frontend + Backend | Next.js (React + TypeScript) |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | Auth.js (NextAuth) |
| Hosting | Vercel + Neon/Supabase (Postgres) |
| Payments | Stripe Connect (Express accounts) — see separate research doc |
| Optional future addition | Python/FastAPI microservice for an AI-powered feature (e.g., teacher-matching), added as a deliberate second stack once the core MVP is live |
