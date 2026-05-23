'use client';

import { useState } from 'react';

const STRATEGY = {
  SSG: {
    bg: 'bg-emerald-950',
    text: 'text-emerald-400',
    border: 'border-emerald-800',
  },
  ISR: { bg: 'bg-cyan-950', text: 'text-cyan-400', border: 'border-cyan-800' },
  PPR: {
    bg: 'bg-violet-950',
    text: 'text-violet-400',
    border: 'border-violet-800',
  },
  SSR: {
    bg: 'bg-orange-950',
    text: 'text-orange-400',
    border: 'border-orange-800',
  },
  Edge: { bg: 'bg-blue-950', text: 'text-blue-400', border: 'border-blue-800' },
  Client: {
    bg: 'bg-yellow-950',
    text: 'text-yellow-400',
    border: 'border-yellow-800',
  },
  Mixed: { bg: 'bg-zinc-900', text: 'text-zinc-400', border: 'border-zinc-700' },
  Unknown: {
    bg: 'bg-zinc-900',
    text: 'text-zinc-400',
    border: 'border-zinc-700',
  },
} as const;

const COST = {
  'high-savings': { symbol: '↓↓', label: 'High savings', color: 'text-emerald-400' },
  'medium-savings': { symbol: '↓', label: 'Some savings', color: 'text-emerald-500' },
  'low-savings': { symbol: '↓', label: 'Minor savings', color: 'text-emerald-600' },
  'no-change': { symbol: '→', label: 'No change', color: 'text-zinc-500' },
  'increased-cost': { symbol: '↑', label: 'Higher cost', color: 'text-orange-400' },
} as const;

export interface RouteAnalysis {
  routePath: string;
  filePath: string;
  currentStrategy: keyof typeof STRATEGY;
  recommendedStrategy: keyof typeof STRATEGY;
  isAlreadyOptimal: boolean;
  reasoning: string;
  signals: string[];
  costImpact: keyof typeof COST;
  performanceImpact: string;
  implementationHint: string;
  priority: 'high' | 'medium' | 'low';
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className="shrink-0 text-white/20 hover:text-white/50 transition-colors cursor-pointer"
      aria-label="Copy to clipboard"
    >
      {copied ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-emerald-400"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="9" y="2" width="6" height="4" rx="1" />
          <path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" />
        </svg>
      )}
    </button>
  );
}

export default function RouteCard({ analysis }: { analysis: RouteAnalysis }) {
  const current = STRATEGY[analysis.currentStrategy] ?? STRATEGY.Unknown;
  const recommended = STRATEGY[analysis.recommendedStrategy] ?? STRATEGY.Unknown;
  const cost = COST[analysis.costImpact] ?? COST['no-change'];
  const optimal = analysis.isAlreadyOptimal;

  return (
    <div
      className={`rounded-lg border p-4 transition-all ${
        optimal
          ? 'border-white/10 bg-white/[0.03]'
          : analysis.priority === 'high'
            ? 'border-orange-500/25 bg-orange-500/[0.04]'
            : 'border-white/12 bg-white/[0.04]'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <code className="text-sm font-mono text-white/80 truncate">
            {analysis.routePath}
          </code>
          {analysis.priority === 'high' && !optimal && (
            <span className="shrink-0 text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded px-1.5 py-0.5">
              high priority
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-xs font-mono">
          {!optimal ? (
            <>
              <span
                className={`${current.bg} ${current.text} border ${current.border} rounded px-2 py-0.5`}
              >
                {analysis.currentStrategy}
              </span>
              <span className="text-white/30">→</span>
              <span
                className={`${recommended.bg} ${recommended.text} border ${recommended.border} rounded px-2 py-0.5 font-semibold`}
              >
                {analysis.recommendedStrategy}
              </span>
            </>
          ) : (
            <>
              <span
                className={`${recommended.bg} ${recommended.text} border ${recommended.border} rounded px-2 py-0.5`}
              >
                {analysis.recommendedStrategy}
              </span>
              <span className="text-emerald-500 text-xs ml-1">✓ optimal</span>
            </>
          )}
        </div>
      </div>

      {/* Reasoning */}
      <p className="text-sm text-white/55 mb-3 leading-relaxed">{analysis.reasoning}</p>

      {/* Signals */}
      {analysis.signals && analysis.signals.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {analysis.signals.map((s, i) => (
            <code
              key={i}
              className="text-xs bg-white/5 text-white/35 rounded px-2 py-0.5 font-mono"
            >
              {s}
            </code>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-white/5 gap-4">
        <div className="flex items-center gap-4 text-xs">
          <span className={`font-mono ${cost.color}`}>
            {cost.symbol} {cost.label}
          </span>
          {analysis.performanceImpact && (
            <span className="text-white/30 hidden sm:block">
              {analysis.performanceImpact}
            </span>
          )}
        </div>
        {!optimal && analysis.implementationHint && (
          <div className="flex items-center gap-1.5 min-w-0">
            <code className="text-xs text-[#0070f3]/60 font-mono truncate max-w-xs">
              {analysis.implementationHint}
            </code>
            <CopyButton text={analysis.implementationHint} />
          </div>
        )}
      </div>
    </div>
  );
}
