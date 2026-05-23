/**
 * Lightweight eval runner for render-right route classification.
 *
 * Usage:  OPENAI_API_KEY=... npx tsx evals/run.ts
 *
 * Scores the agent's recommendedStrategy against each test case.
 * Acceptable variance: PPR vs ISR are both valid for some patterns.
 */

import { generateText, tool, stepCountIs } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { SYSTEM_PROMPT } from '../lib/prompts';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY_RENDER_RIGHT,
  baseURL: 'https://api.anthropic.com/v1',
});

async function evaluateCase(tc: TestCase): Promise<EvalResult> {
  let captured: Record<string, unknown> | null = null;

  await generateText({
    model: anthropic('claude-haiku-4-5-20251001'),
    system: SYSTEM_PROMPT,
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

async function main() {
  const casesPath = join(__dirname, 'test-cases.json');
  const { cases }: { cases: TestCase[] } = JSON.parse(readFileSync(casesPath, 'utf-8'));

  console.log(`\n🧪 Running ${cases.length} eval cases...\n`);

  const results: EvalResult[] = [];

  for (const tc of cases) {
    process.stdout.write(`  ${tc.id.padEnd(32)}`);
    try {
      const result = await evaluateCase(tc);
      results.push(result);
      if (result.pass) {
        console.log(`✅  ${result.got}`);
      } else if (result.acceptable) {
        console.log(
          `🟡  expected ${result.expected}, got ${result.got} (acceptable variance)`,
        );
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
    `\n📊 Results: ${passed}/${total} exact match (${Math.round((passed / total) * 100)}%)`,
  );
  console.log(
    `   Acceptable (incl. PPR/ISR variance): ${acceptable}/${total} (${Math.round((acceptable / total) * 100)}%)\n`,
  );

  const failures = results.filter(r => !r.acceptable);
  if (failures.length > 0) {
    console.log('Failures to investigate:');
    failures.forEach(f =>
      console.log(`  - ${f.id}: expected ${f.expected}, got ${f.got}`),
    );
    console.log('');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
