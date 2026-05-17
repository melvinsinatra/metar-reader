# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build
npm run start    # Run production build
npm run lint     # ESLint
npx tsc --noEmit # Type-check without emitting files
```

## Architecture

This is a Next.js 16 App Router project with Tailwind CSS v4 and TypeScript.

### Data flow

1. User types an ICAO airport code in the browser.
2. The browser calls `/api/metar?id=XXXX` (the Next.js API route).
3. `app/api/metar/route.ts` proxies to `https://aviationweather.gov/api/data/metar?ids=XXXX&hours=0&sep=true` — this avoids CORS issues and keeps the raw text fetch server-side.
4. The raw METAR string is returned to the browser as JSON `{ raw: "..." }`.
5. `lib/metar-decoder.ts` parses the raw string entirely client-side and returns a `MetarDecoded` object.
6. `app/page.tsx` renders the decoded result.

### Key files

| File | Purpose |
|------|---------|
| `app/page.tsx` | Single-page UI — search form and results display |
| `app/api/metar/route.ts` | Server-side proxy to aviationweather.gov |
| `lib/metar-decoder.ts` | Pure METAR parser — no external dependencies |

### METAR decoder (`lib/metar-decoder.ts`)

Parses the standard METAR format token-by-token in field order: station → time → AUTO → wind → visibility → RVR (skipped) → weather phenomena → cloud layers → temperature/dewpoint → altimeter.

- Wind direction is converted to a 16-point cardinal via `degreesToCardinal`.
- Knots are converted to mph for display.
- Flight category (VFR/MVFR/IFR/LIFR) is derived from ceiling height and visibility.
- A human-readable `summary` string is assembled from the parsed fields.
- Supports both US (SM visibility, `A` altimeter) and international (meter visibility, `Q` altimeter) METAR formats.
