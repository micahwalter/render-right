import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  const password = process.env.SITE_PASSWORD;

  // Skip auth if no password is configured (local dev without env var)
  if (!password) return NextResponse.next();

  const auth = request.headers.get('authorization');
  if (auth) {
    const [, encoded] = auth.split(' ');
    const [, pwd] = atob(encoded).split(':');
    if (pwd === password) return NextResponse.next();
  }

  return new NextResponse('Access restricted', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Render Right"' },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|r/).*)'],
};
