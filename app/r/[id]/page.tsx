import { list } from '@vercel/blob';
import { notFound } from 'next/navigation';
import RouteCard, { type RouteAnalysis } from '@/components/RouteCard';
import { buildSummary } from '@/lib/summary';

export const revalidate = false; // reports are immutable — cache forever at the CDN edge

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { blobs } = await list({ prefix: `reports/${id}` });
  if (!blobs.length) notFound();

  const res = await fetch(blobs[0].url, {
    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
  });
  const { analyses, repoUrl, modelLabel = 'Claude Sonnet 4.6' }: { analyses: RouteAnalysis[]; repoUrl: string; modelLabel?: string } = await res.json();

  const highPriority = analyses.filter(a => a.priority === 'high' && !a.isAlreadyOptimal);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="border-b border-white/8 px-6 py-4 shrink-0">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <span className="font-semibold text-sm tracking-tight">Render Right</span>
          <span className="text-xs text-white/30 border border-white/10 rounded px-1.5 py-0.5">
            beta
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 w-full flex-1">
        <div className="mb-8">
          <p className="text-xs text-white/30 mb-1">Analysis for</p>
          <code className="text-sm text-white/70">{repoUrl}</code>
        </div>

        {highPriority.length > 0 ? (
          <div className="border border-orange-500/20 bg-orange-500/5 rounded-lg px-4 py-3 mb-6 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-orange-400 text-sm font-medium">
              {highPriority.length} high-priority optimization
              {highPriority.length > 1 ? 's' : ''} found
            </span>
            <span className="text-white/30 text-xs">
              Addressing these could significantly reduce your compute costs and improve Core Web
              Vitals.
            </span>
          </div>
        ) : (
          <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-lg px-4 py-3 mb-6">
            <span className="text-emerald-400 text-sm font-medium">
              Rendering strategies look well-optimized across these routes.
            </span>
          </div>
        )}

        <p className="text-sm text-white/50 leading-relaxed mb-6">
          {buildSummary(analyses)}
        </p>

        <div className="space-y-3">
          {analyses.map((a, i) => (
            <RouteCard key={i} analysis={a} />
          ))}
        </div>
      </main>

      <footer className="border-t border-white/5 px-6 py-4 shrink-0">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <span className="text-xs text-white/20">Built with AI SDK</span>
          <span className="text-xs text-white/20">
            Next.js 16 · {modelLabel} · Multi-step agent
          </span>
        </div>
      </footer>
    </div>
  );
}
