'use client';

import { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { DynamicToolUIPart } from 'ai';
import RouteCard, { type RouteAnalysis } from '@/components/RouteCard';

const EXAMPLES = [
  { url: 'https://github.com/vercel/next-learn', label: 'next-learn' },
  { url: 'https://github.com/leerob/leerob.io', label: 'leerob.io' },
  { url: 'https://github.com/shadcn-ui/ui', label: 'shadcn/ui' },
];

export default function Home() {
  const [repoUrl, setRepoUrl] = useState('');
  const [hasStarted, setHasStarted] = useState(false);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: '/api/analyze' }),
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  // Extract route analyses from dynamic tool parts in assistant messages
  const analyses: RouteAnalysis[] = messages
    .flatMap(m => m.parts)
    .filter(
      (p): p is DynamicToolUIPart & { state: 'output-available'; output: RouteAnalysis } =>
        p.type === 'dynamic-tool' &&
        (p as DynamicToolUIPart).toolName === 'report_route_analysis' &&
        (p as DynamicToolUIPart).state === 'output-available',
    )
    .map(p => p.output);

  // Latest assistant text for the status indicator
  const statusText =
    messages
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

  const highPriority = analyses.filter(a => a.priority === 'high' && !a.isAlreadyOptimal);
  const isComplete = !isLoading && hasStarted && analyses.length > 0;

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
            <button
              onClick={handleReset}
              className="text-xs text-white/40 hover:text-white/70 transition-colors cursor-pointer"
            >
              ← New analysis
            </button>
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
            {/* Status pulse */}
            {isLoading && (
              <div className="flex items-center gap-3 mb-6 text-white/40 text-sm">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse"
                  style={{ backgroundColor: '#0070f3' }}
                />
                <span className="truncate">
                  {statusText ? statusText.slice(-120).trim() : 'Fetching repository…'}
                </span>
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
          <span className="text-xs text-white/20">Next.js 16 · GPT-4o · Multi-step agent</span>
        </div>
      </footer>
    </div>
  );
}
