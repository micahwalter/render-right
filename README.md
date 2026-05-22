# Render Right

AI-powered rendering strategy advisor for Next.js. Paste a public GitHub repo URL and an AI agent analyzes each route — recommending SSG, ISR, PPR, SSR, or Edge runtime with cost and performance reasoning.

## What it does

- Reads your `next.config`, route files, and data-fetching patterns via the GitHub API
- Classifies each route by its current rendering strategy
- Recommends the optimal strategy with plain-English reasoning
- Flags high-priority misconfigurations (e.g. `force-dynamic` on static content)
- Shows cost impact and a one-line implementation hint per route
- Cards stream in progressively as the agent works through files

## Architecture

```
User submits GitHub URL
        ↓
Next.js App Router + AI SDK streamText
        ↓
  Multi-step agent (up to 30 steps):
  ├─ list_routes   → GitHub Trees API: find all page.tsx / config files
  ├─ read_file     → GitHub Contents API: fetch file contents
  └─ report_route_analysis → streams recommendation cards to the UI
        ↓
Streaming UI: route cards appear as the agent works
```

**Key decisions:**
- `streamText` with `stopWhen: stepCountIs(30)` handles the multi-step tool loop server-side — no client round-trips between tool calls
- `toUIMessageStreamResponse()` uses the AI SDK v6 UI message stream protocol
- GitHub API responses are cached with `next: { revalidate: 300 }` — repeated runs on the same repo are fast
- Route analysis tool `execute` returns args directly; the UI reads them from `DynamicToolUIPart` as they arrive

## Setup

```bash
npm install
cp .env.example .env.local
# Add your OPENAI_API_KEY to .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Optional: GitHub token

Without a token, GitHub allows 60 unauthenticated requests/hour. Add `GITHUB_TOKEN` to `.env.local` to raise this to 5,000/hour (no special scopes needed for public repos).

## Evals

A lightweight eval harness scores the agent's route classifications against 8 annotated test cases:

```bash
npm run eval
```

Expected output: 7–8/8 exact match. PPR/ISR variance on mixed patterns is treated as acceptable.

## Stack

- Next.js 16 (App Router)
- AI SDK v6 (`streamText`, `tool`, `useChat`, `DefaultChatTransport`)
- GPT-4o
- Tailwind CSS v4
- TypeScript
