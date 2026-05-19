# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server at http://localhost:3000
npm run build        # Production build
npm run start        # Run production build
npm run lint         # ESLint (flat config, v9)
npm test             # Run Jest test suite
npm run test:watch   # Jest in watch mode
npx tsc --noEmit     # Type-check without emitting files
```

## Architecture

Next.js 16 App Router project with React 19, Tailwind CSS v4, TypeScript 5 (strict), and Jest 30.

### Data flow

1. User types an ICAO airport code in the browser.
2. The browser calls `/api/metar?id=XXXX` (Next.js Route Handler).
3. `app/api/metar/route.ts` proxies to `https://aviationweather.gov/api/data/metar?ids=XXXX&hours=0&sep=true` — avoids CORS and keeps the raw-text fetch server-side.
4. The raw METAR string is returned as JSON `{ raw: "..." }`.
5. `lib/metar-decoder.ts` parses the raw string client-side and returns a `MetarDecoded` object.
6. `app/page.tsx` renders the decoded result.

### Key files

| File | Purpose |
|------|---------|
| `app/page.tsx` | Single-page UI — search form and results display (`'use client'`) |
| `app/layout.tsx` | Root layout — metadata, Geist fonts, global CSS |
| `app/globals.css` | Tailwind v4 import, CSS custom properties, dark-mode overrides |
| `app/api/metar/route.ts` | Route Handler — proxies aviationweather.gov, validates input |
| `lib/metar-decoder.ts` | Pure METAR parser — no external dependencies |
| `__tests__/metar-decoder.test.ts` | 47 Jest unit tests covering the decoder |

---

## Next.js 16 App Router

### Server vs. Client Components

- **Default to Server Components.** Only add `'use client'` when the component uses hooks (`useState`, `useEffect`, `useRef`), browser APIs, or event handlers.
- `app/page.tsx` is `'use client'` because it manages search state and fetches data on user interaction. The layout (`app/layout.tsx`) is a Server Component.
- Never call server-only code (database, secrets, `fs`) inside a `'use client'` file.

### Route Handlers (`app/api/**/route.ts`)

- Export named async functions matching HTTP verbs: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`.
- Use `NextRequest` / `NextResponse` from `next/server`.
- Read query params via `request.nextUrl.searchParams.get('key')`.
- Set `{ next: { revalidate: 0 } }` on `fetch` calls that must always be fresh (as in `route.ts`).
- Return structured errors with appropriate HTTP status codes — never leak stack traces.

```typescript
// Correct Route Handler shape
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: '...' }, { status: 400 });
  // ...
  return NextResponse.json({ raw });
}
```

### Metadata

- Define static metadata via the `metadata` export in `layout.tsx` or `page.tsx` (Server Components only).
- For dynamic metadata use `generateMetadata()`.

---

## React 19

- Prefer `useState` + `async` event handlers for data fetching in Client Components (current pattern in `page.tsx`).
- React 19's `use()` hook can unwrap promises and context — consider it for future async data patterns.
- `useTransition` / `startTransition` wraps non-urgent state updates; useful if fetch latency causes UI jank.
- Avoid `useEffect` for data fetching — fetch inside event handlers or use Server Components instead.

---

## TypeScript

- **Strict mode is on** (`strict: true` in `tsconfig.json`). Never disable it or use `// @ts-ignore` to paper over type errors — fix them.
- Use `satisfies` to validate literal objects against a type while keeping the narrowest inferred type.
- Avoid `any`. Use `unknown` when the shape is genuinely unknown, then narrow with type guards.
- Path alias `@/*` maps to the project root — use it for imports across the app (`@/lib/metar-decoder`).
- Run `npx tsc --noEmit` before committing to catch type errors that ESLint may miss.

### Interface conventions (from `MetarDecoded`)

- Model domain concepts as interfaces with explicit optional fields (`gust?: number`).
- Use union types for constrained values: `'VFR' | 'MVFR' | 'IFR' | 'LIFR'`, `number | 'VRB' | 'CALM'`.
- Export interfaces from the module that owns them (`lib/metar-decoder.ts` exports `MetarDecoded`).

---

## Tailwind CSS v4

Tailwind v4 is **CSS-first** — configuration lives in CSS, not a `tailwind.config.js` file.

### Import syntax

```css
/* app/globals.css — correct v4 import */
@import "tailwindcss";
```

Do **not** use the old v3 `@tailwind base; @tailwind components; @tailwind utilities;` directives.

### Custom tokens

Define design tokens with `@theme` inside the CSS file:

```css
@theme {
  --color-brand: oklch(60% 0.2 250);
}
```

CSS custom properties defined directly (as in `globals.css`) are available globally but are not Tailwind utility classes unless added inside `@theme`.

### Dark mode

This project uses `@media (prefers-color-scheme: dark)` in `globals.css` to switch CSS variables — not Tailwind's `dark:` variant class. Keep the two approaches consistent; do not mix them.

### Utility class conventions

- Prefer Tailwind utilities over inline `style` props.
- Responsive prefixes follow mobile-first order: base → `sm:` → `md:` → `lg:`.
- The results grid uses `grid grid-cols-1 sm:grid-cols-2` — extend this pattern for any new card grids.

---

## METAR decoder (`lib/metar-decoder.ts`)

Parses the standard METAR format **token-by-token in field order**:

```
station → time → AUTO/COR → wind → visibility → RVR (skipped) → weather → clouds → temp/dewpoint → altimeter
```

### Rules when modifying the parser

- The function `decodeMETAR(raw: string): MetarDecoded` is **pure** — no side effects, no I/O. Keep it that way.
- Tokens are consumed sequentially with an index; the parser advances only when a regex matches. Preserve this contract when adding new token types.
- All regex patterns are defined as module-level constants (e.g., `WIND_TOKEN`, `CLOUD_TOKEN`). Add new patterns there, not inline.
- Negative temperatures use the `M` prefix (e.g., `M05`). The `parseTemperature` helper handles this — use it, do not re-implement.
- Supports both US format (visibility in SM, altimeter `A####`) and international (visibility in meters, altimeter `Q####`). Any new field must handle both.
- Adding a new `MetarDecoded` field requires: (1) update the interface, (2) add parsing logic, (3) update `buildSummary()` if it affects the human-readable output, (4) add unit tests.

### Unit conversions

| From | To | Helper |
|------|----|--------|
| Celsius | Fahrenheit | `toFahrenheit(c)` |
| Knots | mph | `knotsToMph(kt)` |
| Degrees | 16-point cardinal | `degreesToCardinal(deg)` |
| Cardinal abbrev. | Full name | `cardinalToFull(cardinal)` |

---

## Testing (Jest 30)

### Setup

Jest is configured via `jest.config.ts` using `next/jest.js` for proper Next.js transform support. Test environment is `node` — not `jsdom` — because `metar-decoder.ts` has no DOM dependencies.

### Running tests

```bash
npm test               # Single run
npm run test:watch     # Re-run on file save
```

### Writing tests

- Tests live in `__tests__/` and use the `.test.ts` extension.
- Import the decoder directly: `import { decodeMETAR } from '@/lib/metar-decoder'`.
- Use the `@/` alias (mapped in `jest.config.ts` via `moduleNameMapper`).
- Each describe block covers one logical aspect (wind, visibility, clouds, etc.).
- For floating-point assertions (humidity, conversions) use `toBeCloseTo(value, decimalPlaces)`.
- Every new parser feature needs tests for: the happy path, an edge case, and an international-format variant where applicable.
- Do not use `jsdom` or DOM APIs in these tests — the parser is pure logic.

### Test structure pattern

```typescript
describe('feature name', () => {
  it('describes the specific behavior', () => {
    const d = decodeMETAR('KLAX 010953Z ...');
    expect(d.field).toBe(expectedValue);
  });
});
```

---

## ESLint (v9 flat config)

Config is in `eslint.config.mjs` using the `defineConfig` helper from `eslint/config`. It extends `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`.

```bash
npm run lint     # Run linter
```

- The flat config format does **not** use `.eslintrc.*` files — do not create them.
- Add project-specific rules by appending a config object inside the `defineConfig([...])` array.
- ESLint ignores `.next/**`, `out/**`, `build/**`, and `next-env.d.ts` by default (see `globalIgnores` in config).

---

## Code conventions

- **No comments by default.** Only add one when the *why* is non-obvious (a constraint, workaround, or subtle invariant). The METAR spec reference comments in `metar-decoder.ts` are intentional — they point to domain logic that cannot be inferred from variable names alone.
- **No default exports** for non-Next.js files. `lib/metar-decoder.ts` uses named exports.
- Route Handlers and Next.js pages follow framework conventions (named exports, `default export` for pages).
- Keep `lib/metar-decoder.ts` dependency-free. Do not import third-party packages into it.
- The API route validates input with a regex before forwarding to the external service — always validate at the system boundary.
