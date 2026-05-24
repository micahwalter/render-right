'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import RouteCard, { type RouteAnalysis } from '@/components/RouteCard';
import { buildSummary } from '@/lib/summary';

const EXAMPLES = [
  { url: 'https://github.com/nextjs/saas-starter', label: 'saas-starter' },
  { url: 'https://github.com/vercel/next-app-router-playground', label: 'app-router-playground' },
  { url: 'https://github.com/timlrx/tailwind-nextjs-starter-blog', label: 'tailwind-blog' },
];

const MODELS = [
  { id: 'anthropic/claude-sonnet-4.6', label: 'Claude Sonnet 4.6' },
  { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { id: 'meta/llama-4-maverick', label: 'Llama 4 Maverick' },
  { id: 'openai/gpt-4o', label: 'GPT-4o' },
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini' },
];

const DEFAULT_MODEL = 'anthropic/claude-sonnet-4.6';

export default function Home() {
  const [repoUrl, setRepoUrl] = useState('');
  const [hasStarted, setHasStarted] = useState(false);
  const [shareStatus, setShareStatus] = useState<'idle' | 'loading' | 'copied' | 'error'>('idle');
  const [shareError, setShareError] = useState('');
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const selectedModelRef = useRef(selectedModel);

  const transport = useMemo(() => new DefaultChatTransport({
    api: '/api/analyze',
    fetch: async (url, init) => {
      const body = init?.body ? JSON.parse(init.body as string) : {};
      body.model = selectedModelRef.current;
      return globalThis.fetch(url, { ...init, body: JSON.stringify(body) });
    },
  }), []);

  const { messages, sendMessage, status, error } = useChat({ transport });

  const isLoading = status === 'submitted' || status === 'streaming';

  // Static tools come through as 'tool-{name}' parts (not 'dynamic-tool').
  // The analysis data lives in `input` (the args Claude sent to the tool).
  const analyses: RouteAnalysis[] = messages
    .flatMap(m => m.parts)
    .filter(
      p => p.type === 'tool-report_route_analysis' && (p as Record<string, unknown>).state === 'output-available',
    )
    .map(p => (p as Record<string, unknown>).input as RouteAnalysis);

  // Current assistant text: used as status while streaming, summary when done
  const assistantText = messages
    .at(-1)
    ?.parts.filter(p => p.type === 'text')
    .map(p => (p as { type: 'text'; text: string }).text)
    .join('') ?? '';


  const handleAnalyze = (url = repoUrl) => {
    const trimmed = url.trim();
    if (!trimmed || isLoading) return;
    setHasStarted(true);
    sendMessage({ text: trimmed });
  };

  const handleReset = () => {
    window.location.reload();
  };

  const handleShare = async () => {
    if (shareStatus === 'loading') return;
    setShareStatus('loading');
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analyses,
          repoUrl,
          modelLabel: MODELS.find(m => m.id === selectedModelRef.current)?.label ?? 'Claude Sonnet 4.6',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      await navigator.clipboard.writeText(`${window.location.origin}/r/${data.id}`);
      setShareStatus('copied');
      setTimeout(() => setShareStatus('idle'), 2000);
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Unknown error');
      setShareStatus('error');
      setTimeout(() => setShareStatus('idle'), 3000);
    }
  };

  const highPriority = analyses.filter(a => a.priority === 'high' && !a.isAlreadyOptimal);
  const isComplete = !isLoading && hasStarted && analyses.length > 0;

  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [assistantText]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-white/8 px-6 py-4 shrink-0">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm tracking-tight">Render Right</span>
            <span className="text-xs text-white/30 border border-white/10 rounded px-1.5 py-0.5">
              beta
            </span>
          </div>
          {hasStarted && (
            <div className="flex items-center gap-4">
              {isComplete && (
                <button
                  onClick={handleShare}
                  disabled={shareStatus === 'loading'}
                  className="text-xs text-white/40 hover:text-white/70 transition-colors cursor-pointer disabled:opacity-40"
                >
                  {shareStatus === 'loading'
                    ? 'Saving…'
                    : shareStatus === 'copied'
                      ? 'Link copied!'
                      : shareStatus === 'error'
                        ? `Failed: ${shareError}`
                        : 'Share report'}
                </button>
              )}
              <button
                onClick={handleReset}
                className="text-xs text-white/40 hover:text-white/70 transition-colors cursor-pointer"
              >
                ← New analysis
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 w-full flex-1">
        {/* Hero */}
        {!hasStarted && (
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold tracking-tight mb-4 leading-tight">
              Is your Next.js app
              <br />
              <span style={{ color: '#0070f3' }}>rendering right?</span>
            </h1>
            <p className="text-white/45 text-lg max-w-xl mx-auto leading-relaxed">
              Paste a public GitHub repo URL. An AI agent reads your routes and
              recommends the optimal rendering strategy — with cost and performance
              projections.
            </p>
          </div>
        )}

        {/* Input */}
        <div className={hasStarted ? 'mb-8' : 'mb-12'}>
          <div className="flex gap-2">
            <input
              type="url"
              value={repoUrl}
              onChange={e => setRepoUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
              placeholder="https://github.com/owner/repo"
              disabled={isLoading}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm placeholder:text-white/25 focus:outline-none focus:border-white/25 disabled:opacity-50 transition-colors"
            />
            <select
              value={selectedModel}
              onChange={e => {
                setSelectedModel(e.target.value);
                selectedModelRef.current = e.target.value;
              }}
              disabled={isLoading}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-3 text-sm text-white/60 focus:outline-none focus:border-white/25 disabled:opacity-50 transition-colors cursor-pointer appearance-none"
              aria-label="Model"
            >
              {MODELS.map(m => (
                <option key={m.id} value={m.id} className="bg-zinc-900 text-white">
                  {m.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => handleAnalyze()}
              disabled={isLoading || !repoUrl.trim()}
              className="bg-white text-black px-5 py-3 rounded-lg text-sm font-medium hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity cursor-pointer"
            >
              {isLoading ? 'Analyzing…' : 'Analyze'}
            </button>
          </div>

          {!hasStarted && (
            <div className="flex items-center gap-3 mt-3">
              <span className="text-xs text-white/25">Try:</span>
              {EXAMPLES.map(ex => (
                <button
                  key={ex.url}
                  onClick={() => {
                    setRepoUrl(ex.url);
                    handleAnalyze(ex.url);
                  }}
                  className="text-xs text-white/35 hover:text-white/60 transition-colors cursor-pointer"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Results */}
        {hasStarted && (
          <div>
            {/* Agent log — scrollable, auto-scrolls to bottom as output streams */}
            {isLoading && (
              <div className="mb-6 rounded-lg border border-white/8 bg-white/[0.02] overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
                  <span
                    className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0"
                    style={{ backgroundColor: '#0070f3' }}
                  />
                  <span className="text-xs text-white/30 font-mono">Agent working…</span>
                </div>
                <div
                  ref={logRef}
                  className="max-h-40 overflow-y-auto px-3 py-2 text-xs text-white/40 font-mono leading-relaxed whitespace-pre-wrap"
                >
                  {assistantText || 'Fetching repository…'}
                </div>
              </div>
            )}

            {/* Summary banner — shown when complete */}
            {isComplete && highPriority.length > 0 && (
              <div className="border border-orange-500/20 bg-orange-500/5 rounded-lg px-4 py-3 mb-6 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-orange-400 text-sm font-medium">
                  {highPriority.length} high-priority optimization
                  {highPriority.length > 1 ? 's' : ''} found
                </span>
                <span className="text-white/30 text-xs">
                  Addressing these could significantly reduce your compute costs and
                  improve Core Web Vitals.
                </span>
              </div>
            )}
            {isComplete && highPriority.length === 0 && (
              <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-lg px-4 py-3 mb-6">
                <span className="text-emerald-400 text-sm font-medium">
                  Rendering strategies look well-optimized across these routes.
                </span>
              </div>
            )}

            {/* Computed summary paragraph — shown when complete */}
            {isComplete && (
              <p className="text-sm text-white/50 leading-relaxed mb-6">
                {buildSummary(analyses)}
              </p>
            )}

            {/* Route cards — appear as the agent reports each one */}
            {analyses.length > 0 && (
              <div className="space-y-3">
                {analyses.map((a, i) => (
                  <RouteCard key={i} analysis={a} />
                ))}
              </div>
            )}

            {error && (
              <div className="border border-red-500/20 bg-red-500/5 rounded-lg px-4 py-3 text-red-400 text-sm mt-4">
                {error.message}
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-white/5 px-6 py-4 shrink-0">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <span className="text-xs text-white/20">Built with AI SDK</span>
          <span className="text-xs text-white/20">
            Next.js 16 · {MODELS.find(m => m.id === selectedModel)?.label ?? 'Claude Sonnet 4.6'} · Multi-step agent
          </span>
        </div>
      </footer>
    </div>
  );
}
