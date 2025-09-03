Conversation Log Reader Web App (with Directory Listing)
======================================================

Production-ready Next.js (App Router, TypeScript, Tailwind) app to list local conversation logs and render them as a chat viewer with streaming JSONL parsing, virtualization, and a browser upload fallback.

Quick start
-----------

- Requirements: Node 18+ (tested on Node 22), pnpm (or npm/yarn)
- Install: `pnpm install`
- Set data dir (optional): copy `.env.example` to `.env.local` and adjust `DATA_DIR` (default `./data/logs`)
- Run: `pnpm dev`

Place logs in `DATA_DIR` (`./data/logs` by default). A sample file is included at `data/logs/sample.jsonl`.

Features
--------

- FS-backed API for listing directories and streaming files: `GET /api/fs/list` and `GET /api/fs/stream`
- Secure path resolution; prevents traversal outside the configured `DATA_DIR`
- Client-side upload fallback when server FS is unavailable (e.g., serverless)
- Web Worker streaming JSONL parser with batching; JSON array fallback for `.json`
- Virtualized chat view (tens of thousands of rows) powered by `@tanstack/react-virtual`
- Toggles: Show tool calls, Show reasoning summaries, Redact PII (emails, tokens, 16+ digit runs)

Acceptance Tests mapping
------------------------

- AT1: Open `data/logs/sample.jsonl` → user/assistant messages render in order; reasoning content hidden by default.
- AT2: Toggle “Show tool calls” to reveal `function_call` and `function_call_output` in collapsible blocks. Toggle “Show reasoning summaries” to show summaries only.
- AT3: Left sidebar lists directories/files. If FS is unavailable, upload area is shown and drag-and-drop works.
- AT4: JSONL parsing is done in a Web Worker with batched updates; list is virtualized for smooth scrolling on large files.
- AT5: “Redact PII” masks emails, tokens, and long digit runs; an indicator toggle is present in the viewer header.

Security notes
--------------

- No external network calls are made at runtime for parsing or listing; files are read locally or via user upload.
- API routes validate input with Zod and enforce safe paths to prevent traversal.
- Reasoning content is never rendered; only optional summaries are shown when toggled.

Scripts
-------

- `pnpm dev` — Run the app locally.
- `pnpm build` — Production build.
- `pnpm start` — Start production server.
- `pnpm test` — Run unit tests (Vitest): normalization, redaction, and path guards.

Notes
-----

- Large `.jsonl` files are streamed and decoded incrementally in a worker to avoid blocking the main thread.
- `.json` array files are parsed whole in the worker as a fallback.
- Redaction uses regex heuristics and may have false positives/negatives.


## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
