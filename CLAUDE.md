@AGENTS.md

# Render Right — Claude guidance

## Git workflow

Always create a feature branch before making any changes. Never commit to `main` directly.

```bash
git checkout -b claude/short-description-XXXXX
```

When work is complete, push and open a PR:

```bash
git push -u origin claude/short-description-XXXXX
gh pr create --base main
```

---

## Running evals

`tsx` doesn't auto-load `.env.local`, so pass the key explicitly:

```bash
AI_GATEWAY_API_KEY=$(grep AI_GATEWAY_API_KEY .env.local | cut -d= -f2) npm run eval
```

This runs the default 3-model comparison: `anthropic/claude-haiku-4.5`, `google/gemini-2.5-flash`, `meta/llama-4-scout`. To test a custom set:

```bash
AI_GATEWAY_API_KEY=... EVAL_MODELS=anthropic/claude-haiku-4.5,anthropic/claude-sonnet-4.6 npm run eval
```

Expected for Haiku: **8/8** exact match. Other models may vary. If a test returns `NO_RESULT`, the model didn't call `report_route_analysis` — check `stopWhen` step count and tool schema constraints.

---

## Environment variables

The app uses `AI_GATEWAY_API_KEY` (Vercel AI Gateway) for all models. Both `app/api/analyze/route.ts` and `evals/run.ts` use `createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY })`.

Anthropic BYOK is configured in the Vercel dashboard (AI Gateway → Bring Your Own Key). The gateway automatically routes `anthropic/*` requests through the team's Anthropic key — no code change or extra env var needed. Do not reintroduce `createAnthropic` or a separate `ANTHROPIC_API_KEY` env var.

---

## AI SDK v6 patterns used in this project

These are the current patterns — don't revert to older AI SDK v5 APIs:

| Old (v5) | New (v6) |
|---|---|
| `parameters` in tool definition | `inputSchema` |
| `maxSteps: N` | `stopWhen: stepCountIs(N)` |
| `convertToModelMessages(messages)` (sync) | `await convertToModelMessages(messages)` |
| `import { useChat } from 'ai'` | `import { useChat } from '@ai-sdk/react'` |
| `api` prop on `useChat` | `new DefaultChatTransport({ api: '...' })` |
| `append('text')` | `sendMessage({ text: '...' })` |
| `isLoading` | `status === 'submitted' \|\| status === 'streaming'` |

### Prompt caching
Pass the system prompt as a `SystemModelMessage` to enable caching:

```typescript
system: {
  role: 'system',
  content: SYSTEM_PROMPT,
  providerOptions: {
    anthropic: { cacheControl: { type: 'ephemeral' } },
  },
},
```

Tools render before system in the Anthropic API wire format, so they are included in the cached prefix automatically.

---

## Tool result parts in the UI

Static tools defined with `tool()` produce message parts typed `'tool-{toolName}'` (e.g. `'tool-report_route_analysis'`). Analysis data is in `part.input` (the args sent to the tool), not `part.output`. See `app/page.tsx` for the filtering pattern.

---

## Models

- Main app: `claude-sonnet-4-6` (in `app/api/analyze/route.ts`)
- Evals: `claude-haiku-4-5-20251001` (in `evals/run.ts`)
- Only Claude 4.x is available on this API key — Claude 3.x returns 404

---

## Edge Runtime

`app/api/analyze/route.ts` exports `runtime = 'edge'`. `lib/github.ts` decodes base64 content with `atob` + `TextDecoder` (not `Buffer`) to stay Edge-compatible.

## Vercel deployment notes

- `maxDuration = 60` is exported from `app/api/analyze/route.ts`. Without it, Vercel cuts the streaming response after 10s. The agent can take 30–60s on large repos. Hobby cap: 60s; Pro cap: 300s.
- `proxy.ts` handles HTTP Basic Auth (active when `SITE_PASSWORD` is set). Next.js 16 renamed `middleware.ts` → `proxy.ts`; the exported function is `proxy`, not `middleware`.

## Key files

| File | Purpose |
|---|---|
| `app/api/analyze/route.ts` | Streaming AI endpoint — 3 tools: `list_routes`, `read_file`, `report_route_analysis` |
| `app/page.tsx` | Main UI — `useChat`, streaming card display, agent log |
| `components/RouteCard.tsx` | Per-route analysis card with color-coded strategy badges and copy button |
| `lib/github.ts` | GitHub Trees + Contents API — lists routes, reads files, caches 5 min |
| `lib/prompts.ts` | System prompt — all 6 strategies, signals, decision guide |
| `proxy.ts` | HTTP Basic Auth — active when `SITE_PASSWORD` env var is set |
| `evals/run.ts` | Eval harness — runs test cases across multiple models |
| `evals/test-cases.json` | 8 annotated test cases (SSG, ISR, SSR, PPR, Edge, force-dynamic) |
