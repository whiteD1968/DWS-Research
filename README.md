# DWS Research

DWS Research is a Next.js workspace foundation for architectural research practice: project knowledge, source material, place-based inquiry, visual boards, and curated collections.

This first milestone is intentionally small. It establishes the application shell, routing, Supabase client structure, and a restrained visual foundation before adding richer editors, ingestion, canvases, or AI workflows.

## Initial Architecture

- Next.js App Router with TypeScript.
- Shared workspace shell under `app/(workspace)`.
- Primary routes:
  - `/` Today
  - `/projects`
  - `/research`
  - `/atlas`
  - `/collections`
  - `/boards`
  - `/library`
- Responsive sidebar/top navigation.
- Persistent global actions for `+ Capture` and `Ask`.
- Supabase browser and server clients in `lib/supabase`.
- Supabase session refresh proxy in `proxy.ts` and `lib/supabase/proxy.ts`.

## Supabase

Set the following variables in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

The browser client is created in `lib/supabase/client.ts`. The server client is created in `lib/supabase/server.ts` using cookie-aware SSR helpers from `@supabase/ssr`. The root `proxy.ts` refreshes Supabase Auth sessions when environment variables are present.

No database schema, RLS policies, auth UI, or protected-route redirects are included yet.

## Development

```bash
npm install
npm run dev
```

## Deferred Packages

This milestone intentionally does not include tldraw, BlockNote, React Flow, PDF.js, Uppy, or AI packages.
