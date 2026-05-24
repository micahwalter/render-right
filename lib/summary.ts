import type { RouteAnalysis } from '@/components/RouteCard';

export function buildSummary(analyses: RouteAnalysis[]): string {
  const total = analyses.length;
  const needsWork = analyses.filter(a => !a.isAlreadyOptimal);
  const optimal = total - needsWork.length;
  const highPri = needsWork.filter(a => a.priority === 'high');
  const hasSavings = needsWork.some(
    a => a.costImpact === 'high-savings' || a.costImpact === 'medium-savings',
  );

  if (needsWork.length === 0) {
    return `Analyzed ${total} route${total !== 1 ? 's' : ''}. All are already using optimal rendering strategies.`;
  }

  const parts: string[] = [`Analyzed ${total} route${total !== 1 ? 's' : ''}.`];

  if (highPri.length > 0) {
    const named = highPri.slice(0, 2).map(a => a.routePath).join(' and ');
    parts.push(
      highPri.length === 1
        ? `${named} is the top priority.`
        : `${highPri.length} routes need immediate attention, including ${named}.`,
    );
  }

  if (hasSavings) {
    parts.push(
      `Addressing ${needsWork.length === 1 ? 'it' : 'these'} could reduce server compute costs noticeably.`,
    );
  }

  if (optimal > 0) {
    parts.push(`${optimal} route${optimal !== 1 ? 's are' : ' is'} already well-optimized.`);
  }

  return parts.join(' ');
}
