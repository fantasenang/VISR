# VISR — Digital Exhibition

The production repository for the VISR digital flagship experience.

> Designed to disappear. Engineered to elevate.

## Current State

Repository foundation and initial visual shell. Product media and commerce integrations are introduced through controlled milestones documented in `docs/BUILD_PLAN.md`.

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Quality Checks

```bash
npm run typecheck
npm run lint
npm run build
```

## Core Documents

- `docs/EXPERIENCE_BIBLE.md`
- `docs/BUILD_PLAN.md`

## Architecture

- Next.js App Router
- React and TypeScript
- Tailwind CSS
- GSAP for cinematic timelines
- Vercel deployment, analytics, and performance monitoring
- Sanity, Neon, Midtrans, and Biteship planned as milestone integrations
Git deployment connected.
