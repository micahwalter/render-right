/**
 * Multi-model eval runner for render-right route classification.
 *
 * Usage:
 *   AI_GATEWAY_API_KEY=... npx tsx evals/run.ts
 *   AI_GATEWAY_API_KEY=... EVAL_MODELS=anthropic/claude-haiku-4.5,google/gemini-2.5-flash npx tsx evals/run.ts
 *
 * Default models: anthropic/claude-haiku-4.5, google/gemini-2.5-flash, meta/llama-4-scout
 * Scores recommendedStrategy against each test case. PPR and ISR are treated as
 * acceptable variance for each other.
 */

import { generateText, tool, stepCountIs } from 'ai';
import { createGateway } from '@ai-sdk/gateway';
import { z } from 'zod';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { SYSTEM_PROMPT } from '../lib/prompts';

const __dirname = dirname(fileURLToPath(import.meta.url));

const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY,
});

const DEFAULT_MODELS = [
  'anthropic/claude-haiku-4.5',
  'google/gemini-2.5-flash',
  'meta/llama-4-scout',
];

const MODELS: string[] =
  (process.env.EVAL_MODELS ?? '').trim().length > 0
    ? process.env.EVAL_MODELS!.split(',').map(s => s.trim())
    : DEFAULT_MODELS;

interface TestCase {
  id: string;
  description: string;
  code: string;
  expectedStrategy: string;
  notes: string;
}

interface EvalResult {
  id: string;
  expected: string;
  got: string;
  pass: boolean;
  acceptable: boolean;
}

// PPR and ISR are interchangeable for some patterns — both are valid
const ACCEPTABLE_VARIANCE: Record<string, string[]> = {
  PPR: ['ISR'],
  ISR: ['PPR'],
};

async function evaluateCase(tc: TestCase, model: string): Promise<EvalResult> {
  let captured: Record<string, unknown> | null = null;
  const isAnthropic = model.startsWith('anthropic/');

  await generateText({
    model: gateway(model),
    system: {
      role: 'system',
      content: SYSTEM_PROMPT,
      ...(isAnthropic && {
        providerOptions: {
          anthropic: { cacheControl: { type: 'ephemeral' } },
        },
      }),
    },
    prompt: `Analyze this Next.js route and call report_route_analysis:\n\nFile: app/test/page.tsx\n\n${tc.code}`,
    stopWhen: stepCountIs(3),
    tools: {
      list_routes: tool({
        description: 'List routes (stubbed for eval)',
        inputSchema: z.object({ owner: z.string(), repo: z.string() }),
        execute: async () => ({ files: ['app/test/page.tsx'] }),
      }),
      read_file: tool({
        description: 'Read file (stubbed for eval)',
        inputSchema: z.object({
          owner: z.string(),
          repo: z.string(),
          path: z.string(),
        }),
        execute: async () => ({ content: tc.code, path: 'app/test/page.tsx' }),
      }),
      report_route_analysis: tool({
        description: 'Report analysis',
        inputSchema: z.object({
          routePath: z.string(),
          filePath: z.string(),
          currentStrategy: z.string(),
          recommendedStrategy: z.enum(['SSG', 'ISR', 'PPR', 'SSR', 'Edge', 'Client']),
          isAlreadyOptimal: z.boolean(),
          reasoning: z.string(),
          signals: z.array(z.string()),
          costImpact: z.string(),
          performanceImpact: z.string(),
          implementationHint: z.string(),
          priority: z.string(),
        }),
        execute: async input => {
          captured = input as Record<string, unknown>;
          return input;
        },
      }),
    },
  });

  const got =
    (captured as Record<string, string> | null)?.recommendedStrategy ?? 'NO_RESULT';
  const pass = got === tc.expectedStrategy;
  const acceptable =
    pass || (ACCEPTABLE_VARIANCE[tc.expectedStrategy]?.includes(got) ?? false);

  return { id: tc.id, expected: tc.expectedStrategy, got, pass, acceptable };
}

function shortName(model: string): string {
  return model.split('/')[1] ?? model;
}

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}

async function runModel(
  cases: TestCase[],
  model: string,
): Promise<EvalResult[]> {
  console.log(`\n📦  ${model}`);
  const results: EvalResult[] = [];

  for (const tc of cases) {
    process.stdout.write(`  ${tc.id.padEnd(34)}`);
    try {
      const result = await evaluateCase(tc, model);
      results.push(result);
      if (result.pass) {
        console.log(`✅  ${result.got}`);
      } else if (result.acceptable) {
        console.log(`🟡  expected ${result.expected}, got ${result.got} (acceptable variance)`);
      } else {
        console.log(`❌  expected ${result.expected}, got ${result.got}`);
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      console.log(`💥  error: ${err}`);
      results.push({
        id: tc.id,
        expected: tc.expectedStrategy,
        got: 'ERROR',
        pass: false,
        acceptable: false,
      });
    }
  }

  const passed = results.filter(r => r.pass).length;
  const acceptable = results.filter(r => r.acceptable).length;
  const total = results.length;
  console.log(
    `\n  Results: ${passed}/${total} exact  ${acceptable}/${total} acceptable\n`,
  );

  return results;
}

function printComparison(
  cases: TestCase[],
  allResults: Map<string, EvalResult[]>,
): void {
  const models = [...allResults.keys()];
  const colW = 14;
  const labelW = 34;

  const line = '─'.repeat(labelW + models.length * (colW + 1));
  console.log(`\n📊  Model comparison (${cases.length} test cases)`);
  console.log(line);

  // Header
  const header = pad('Case', labelW) + models.map(m => pad(shortName(m), colW)).join(' ');
  console.log(header);
  console.log(line);

  // Per-case rows
  for (const tc of cases) {
    const row =
      pad(tc.id, labelW) +
      models
        .map(m => {
          const r = allResults.get(m)?.find(x => x.id === tc.id);
          if (!r) return pad('-', colW);
          if (r.pass) return pad(`✅ ${r.got}`, colW);
          if (r.acceptable) return pad(`🟡 ${r.got}`, colW);
          if (r.got === 'ERROR') return pad('💥 ERROR', colW);
          return pad(`❌ ${r.got}`, colW);
        })
        .join(' ');
    console.log(row);
  }

  console.log(line);

  // Score row
  const scoreRow =
    pad('Score (exact / acceptable)', labelW) +
    models
      .map(m => {
        const rs = allResults.get(m) ?? [];
        const p = rs.filter(r => r.pass).length;
        const a = rs.filter(r => r.acceptable).length;
        const t = cases.length;
        return pad(`${p}/${t}  ${a}/${t}`, colW);
      })
      .join(' ');
  console.log(scoreRow);
  console.log(line);
  console.log();
}

async function main() {
  const casesPath = join(__dirname, 'test-cases.json');
  const { cases }: { cases: TestCase[] } = JSON.parse(readFileSync(casesPath, 'utf-8'));

  console.log(`\n🧪  Running ${cases.length} eval cases across ${MODELS.length} model(s):`);
  MODELS.forEach(m => console.log(`    • ${m}`));

  const allResults = new Map<string, EvalResult[]>();

  for (const model of MODELS) {
    const results = await runModel(cases, model);
    allResults.set(model, results);
  }

  if (MODELS.length > 1) {
    printComparison(cases, allResults);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
