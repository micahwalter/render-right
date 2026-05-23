import { put } from '@vercel/blob';
import { nanoid } from 'nanoid';

export async function POST(req: Request) {
  const body = await req.json();
  const id = nanoid(10);
  await put(`reports/${id}.json`, JSON.stringify(body), {
    access: 'public',
    contentType: 'application/json',
  });
  return Response.json({ id });
}
