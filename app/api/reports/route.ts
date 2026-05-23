import { put } from '@vercel/blob';
import { nanoid } from 'nanoid';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const id = nanoid(10);
    await put(`reports/${id}.json`, JSON.stringify(body), {
      access: 'private',
      contentType: 'application/json',
    });
    return Response.json({ id });
  } catch (err) {
    console.error('[reports] failed to save blob:', err);
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
