import { streamText, convertToModelMessages, tool, stepCountIs } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { listRoutes, readFile } from '@/lib/github';
import { SYSTEM_PROMPT } from '@/lib/prompts';

// Use createAnthropic with explicit config so that shell env vars injected by
// other tools (e.g. Claude Desktop sets ANTHROPIC_BASE_URL without /v1 and
// an empty ANTHROPIC_API_KEY) don't override our project settings.
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY_RENDER_RIGHT,
  baseURL: 'https://api.anthropic.com/v1',
});

export async function POST(req: Request) {
  const { messages } = await req.json();
  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: SYSTEM_PROMPT,
    messages: modelMessages,
    stopWhen: stepCountIs(30),
    tools: {
      list_routes: tool({
        description:
          'List all Next.js route and config files in the repository. Call this first.',
        inputSchema: z.object({
          owner: z.string().describe('GitHub repository owner or org name'),
          repo: z.string().describe('GitHub repository name'),
          branch: z
            .string()
            .optional()
            .describe('Branch name — omit to auto-detect main/master'),
        }),
        execute: async ({ owner, repo, branch }) => {
          return listRoutes(owner, repo, branch);
        },
      }),

      read_file: tool({
        description: 'Read the contents of a specific file from the repository.',
        inputSchema: z.object({
          owner: z.string(),
          repo: z.string(),
          path: z
            .string()
            .describe('File path relative to repo root, e.g. "app/dashboard/page.tsx"'),
          branch: z.string().optional().describe('Branch name'),
        }),
        execute: async ({ owner, repo, path, branch }) => {
          return readFile(owner, repo, path, branch ?? 'main');
        },
      }),

      report_route_analysis: tool({
        description:
          'Report the rendering strategy analysis and recommendation for a single route. Call once per route after reading the file.',
        inputSchema: z.object({
          routePath: z
            .string()
            .describe('The URL route path, e.g. "/dashboard" or "/blog/[slug]"'),
          filePath: z.string().describe('The file path in the repo'),
          currentStrategy: z.enum([
            'SSG',
            'ISR',
            'SSR',
            'PPR',
            'Edge',
            'Client',
            'Mixed',
            'Unknown',
          ]),
          recommendedStrategy: z.enum(['SSG', 'ISR', 'PPR', 'SSR', 'Edge', 'Client']),
          isAlreadyOptimal: z
            .boolean()
            .describe('True if the current strategy is already correct'),
          reasoning: z
            .string()
            .describe(
              '2-3 sentence plain-English explanation, focused on cost and performance impact',
            ),
          signals: z
            .array(z.string())
            .describe('Specific code patterns found that informed this recommendation'),
          costImpact: z.enum([
            'high-savings',
            'medium-savings',
            'low-savings',
            'no-change',
            'increased-cost',
          ]),
          performanceImpact: z
            .string()
            .describe('Expected effect on LCP, TTFB, or other metrics'),
          implementationHint: z
            .string()
            .describe(
              'One-line code change or config hint, e.g. "Add: export const revalidate = 3600"',
            ),
          priority: z.enum(['high', 'medium', 'low']),
        }),
        // Returns args directly — the UI consumes these as they stream in
        execute: async input => input,
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
