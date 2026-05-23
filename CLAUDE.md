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

The app uses `AI_GATEWAY_API_KEY` (Vercel AI Gateway). Both `app/api/analyze/route.ts` and `evals/run.ts` use `createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY })`. The previous `ANTHROPIC_API_KEY_RENDER_RIGHT` + `createAnthropic` setup has been replaced — do not reintroduce it.

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

## Known architectural gap

`app/api/analyze/route.ts` does not export `runtime = 'edge'`. The pitch mentions Edge Runtime, but `lib/github.ts` uses `Buffer.from(data.content, 'base64')` (Node.js-only API). To fix: replace with `atob(data.content)` + `TextDecoder` before adding the edge export.
