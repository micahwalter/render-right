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
ANTHROPIC_API_KEY_RENDER_RIGHT=$(grep ANTHROPIC_API_KEY_RENDER_RIGHT .env.local | cut -d= -f2) npm run eval
```

Expected result: **8/8** exact match. If a test returns `NO_RESULT`, the model didn't call `report_route_analysis` — check `stopWhen` step count and tool schema constraints.

---

## Environment variables

Use `ANTHROPIC_API_KEY_RENDER_RIGHT` (not `ANTHROPIC_API_KEY`). Claude Desktop injects an empty `ANTHROPIC_API_KEY` and a malformed `ANTHROPIC_BASE_URL` into the shell environment, which would override `.env.local`. The project-specific name + hardcoded `baseURL: 'https://api.anthropic.com/v1'` in `createAnthropic()` bypasses the conflict.

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
