const GITHUB_API = 'https://api.github.com';

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'render-right/1.0',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

export function parseGitHubUrl(
  url: string,
): { owner: string; repo: string; branch?: string } | null {
  try {
    const u = new URL(url.trim());
    if (!['github.com', 'www.github.com'].includes(u.hostname)) return null;
    const [, owner, repoRaw, treeKeyword, branch] = u.pathname.split('/');
    if (!owner || !repoRaw) return null;
    return {
      owner,
      repo: repoRaw.replace(/\.git$/, ''),
      branch: treeKeyword === 'tree' ? branch : undefined,
    };
  } catch {
    return null;
  }
}

type GitTreeItem = { path: string; type: string };

export async function listRoutes(owner: string, repo: string, branch?: string) {
  const branchesToTry = branch ? [branch] : ['main', 'master'];

  for (const b of branchesToTry) {
    const res = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${b}?recursive=1`,
      { headers: getHeaders(), next: { revalidate: 300 } },
    );

    if (!res.ok) {
      if (res.status === 403) {
        return {
          files: [],
          branch: b,
          error: 'GitHub rate limit exceeded. Set GITHUB_TOKEN to increase limits.',
        };
      }
      continue;
    }

    const data = await res.json();
    const tree: GitTreeItem[] = data.tree ?? [];

    const routeFiles = tree
      .filter(f => {
        if (f.type !== 'blob') return false;
        const p = f.path;
        const isConfig =
          p === 'next.config.ts' || p === 'next.config.js' || p === 'next.config.mjs';
        const isAppRoute =
          (p.startsWith('app/') || p.startsWith('src/app/')) &&
          /\/(page|layout|loading|error)\.[jt]sx?$/.test(p);
        const isPagesRoute =
          p.startsWith('pages/') &&
          /\.[jt]sx?$/.test(p) &&
          !p.includes('/_') &&
          !p.includes('/api/');
        return isConfig || isAppRoute || isPagesRoute;
      })
      .map(f => f.path)
      .slice(0, 25);

    return { files: routeFiles, branch: b, totalFiles: tree.length };
  }

  return {
    files: [],
    branch: branchesToTry[0],
    error: `Repository not found or inaccessible (tried branches: ${branchesToTry.join(', ')})`,
  };
}

export async function readFile(
  owner: string,
  repo: string,
  path: string,
  branch = 'main',
) {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
    { headers: getHeaders(), next: { revalidate: 300 } },
  );

  if (!res.ok) {
    if (res.status === 404) return { error: `File not found: ${path}`, content: null };
    if (res.status === 403) return { error: 'GitHub rate limit exceeded.', content: null };
    return { error: `Failed to read ${path} (HTTP ${res.status})`, content: null };
  }

  const data = await res.json();

  if (data.encoding === 'base64') {
    const raw = Buffer.from(data.content, 'base64').toString('utf-8');
    const truncated = raw.length > 4000;
    return {
      content: truncated
        ? raw.slice(0, 4000) + '\n\n// ... (file truncated at 4000 chars)'
        : raw,
      path: data.path,
      size: data.size,
      truncated,
    };
  }

  return { content: data.content, path: data.path, size: data.size };
}
