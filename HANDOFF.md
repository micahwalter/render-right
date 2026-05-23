# Render Right — Session Handoff

## What this project is

AI-powered Next.js rendering strategy advisor. Paste a public GitHub repo URL, an AI agent reads every route file via the GitHub API, and streams back per-route analysis cards recommending SSG / ISR / PPR / SSR / Edge / Client — with cost and performance reasoning.

**Stack:** Next.js 16 · AI SDK v6 · Claude Sonnet 4.6 · Tailwind CSS v4 · TypeScript

---

## Current state

The app is **live on Vercel** and working end-to-end.

### What works
- Route analysis streams route cards progressively as the agent reads each file
- Scrollable agent log shows full Claude output while it's working
- Summary text from Claude is shown below cards after analysis completes
- Three working example repos in the UI (saas-starter, app-router-playground, tailwind-blog)
- HTTP Basic Auth proxy (`proxy.ts`) — active when `SITE_PASSWORD` env var is set
- Eval suite (`npm run eval`) — 8 test cases, **8/8 pass rate** (exact match)
- Prompt caching on system prompt — cuts latency on warm requests (2048-token min met by `lib/prompts.ts`)

### Environment variables (Vercel + local)

| Variable | Notes |
|---|---|
| `ANTHROPIC_API_KEY_RENDER_RIGHT` | Anthropic API key — project-specific name avoids Claude Desktop conflicts |
| `GITHUB_TOKEN` | Optional — raises GitHub rate limit from 60 to 5,000 req/hr |
| `SITE_PASSWORD` | Password for HTTP Basic Auth; leave unset to skip auth |

---

## Critical technical details

### Why `ANTHROPIC_API_KEY_RENDER_RIGHT` (not `ANTHROPIC_API_KEY`)
Claude Desktop injects `ANTHROPIC_BASE_URL=https://api.anthropic.com` (missing `/v1`) and an empty `ANTHROPIC_API_KEY=` into the shell environment, which overrides `.env.local`. Using a project-specific var name + hardcoded `baseURL` in `createAnthropic()` avoids the conflict entirely. See `app/api/analyze/route.ts` and `evals/run.ts`.

### `maxDuration = 60` on the analyze route
`app/api/analyze/route.ts` exports `maxDuration = 60`. Without this, Vercel cuts off the streaming response after 10s (the platform default). The AI agent can take 30–60s to read a full repo. Vercel Hobby supports up to 60s; Pro supports up to 300s.

### Prompt caching
Both `app/api/analyze/route.ts` and `evals/run.ts` pass the system prompt as a `SystemModelMessage` with `providerOptions.anthropic.cacheControl: { type: 'ephemeral' }`. This caches the tools + system prefix together (tools render before system in the Anthropic API wire format). Minimum cache threshold: 2048 tokens for Sonnet 4.6, 4096 for Haiku 4.5. The system prompt in `lib/prompts.ts` is ~900 tokens, but tools push the total well past both thresholds.

### `proxy.ts` (was `middleware.ts`)
Next.js 16 deprecated the `middleware` file convention in favour of `proxy`. The file was migrated with the official codemod (`npx @next/codemod middleware-to-proxy`) — the exported function is now named `proxy` instead of `middleware`. Functionally identical.

### AI SDK v6 breaking changes (already applied)
- Tool definitions use `inputSchema` not `parameters`
- `maxSteps` → `stopWhen: stepCountIs(N)`
- `convertToModelMessages` returns a Promise — must `await` it
- `useChat` is in `@ai-sdk/react`, not `ai`
- Transport: `new DefaultChatTransport({ api: '/api/analyze' })` (no `api` prop on `useChat`)
- `append()` → `sendMessage({ text: '...' })`
- `isLoading` → `status === 'submitted' || status === 'streaming'`
- System prompt caching: pass `{ role: 'system', content: SYSTEM_PROMPT, providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } } }` — the `SystemModelMessage` type

### Why tool parts filter on `'tool-report_route_analysis'` (not `'dynamic-tool'`)
Static tools defined with `tool()` produce message parts typed `'tool-{toolName}'`. The code originally filtered for `'dynamic-tool'` which never matched, so cards never appeared. Analysis data lives in `input` (args the model sent to the tool), not `output`. See `app/page.tsx` lines ~26–31.

### Edge Runtime — not yet on the analyze route
The original pitch mentioned Edge Runtime for lower cold-start latency. `app/api/analyze/route.ts` does **not** currently export `runtime = 'edge'`. Reason: `lib/github.ts` uses `Buffer.from(data.content, 'base64')` which is Node.js-only. To enable Edge Runtime, replace with `atob(data.content)` + `TextDecoder`. Noted as a future improvement.

### Models available on this API key
Only Claude 4.x — `claude-sonnet-4-6` (main app), `claude-haiku-4-5-20251001` (evals). Claude 3.x models return 404.

### Secret safety
`ANTHROPIC_API_KEY_RENDER_RIGHT` and `GITHUB_TOKEN` are only read in server-side code (`app/api/analyze/route.ts`, `lib/github.ts`). Neither has a `NEXT_PUBLIC_` prefix, so Next.js never bundles them into the browser.

---

## Key files

| File | Purpose |
|---|---|
| `app/api/analyze/route.ts` | Streaming AI endpoint — 3 tools: `list_routes`, `read_file`, `report_route_analysis` |
| `app/page.tsx` | Main UI — `useChat`, streaming card display, agent log |
| `components/RouteCard.tsx` | Per-route analysis card with color-coded strategy badges |
| `lib/github.ts` | GitHub Trees + Contents API — lists routes, reads files, caches 5 min |
| `lib/prompts.ts` | System prompt for Claude — all 6 strategies, signals, decision guide |
| `proxy.ts` | HTTP Basic Auth — active when `SITE_PASSWORD` env var is set |
| `evals/run.ts` | Eval harness — runs 8 test cases against Haiku |
| `evals/test-cases.json` | 8 annotated test cases (SSG, ISR, SSR, PPR, Edge, force-dynamic) |
| `.env.local` | Local secrets — gitignored |
| `.env.example` | Documents required env vars |

---

## Local development

```bash
cd /Users/micah/Code/github.com/micahwalter/render-right
npm run dev        # http://localhost:3000

# Run evals (tsx doesn't auto-load .env.local — pass the key explicitly)
ANTHROPIC_API_KEY_RENDER_RIGHT=$(grep ANTHROPIC_API_KEY_RENDER_RIGHT .env.local | cut -d= -f2) npm run eval
```

---

## Git workflow

Always work on a feature branch. Never commit directly to `main`.

```bash
git checkout -b claude/short-description-XXXXX
# ... make changes ...
git push -u origin claude/short-description-XXXXX
gh pr create --base main
```

---

## Possible next steps

- Enable Edge Runtime on `/api/analyze` — swap `Buffer.from` → `atob` + `TextDecoder` in `lib/github.ts`
- Add a copy-to-clipboard button on `implementationHint` code snippets
- Consider streaming the agent log even after completion (currently hides when done)
- Add more eval test cases to improve coverage of PPR vs ISR edge cases
- Set a `SITE_PASSWORD` in Vercel env vars to lock down the deployed site
