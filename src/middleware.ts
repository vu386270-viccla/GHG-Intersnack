import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes — không cần auth
  if (pathname.startsWith('/login')) {
    return NextResponse.next();
  }

  const tokenCookie = request.cookies.get('local-auth-token');
  let user: any = null;

  if (tokenCookie?.value) {
    try {
      user = JSON.parse(decodeURIComponent(tokenCookie.value));
    } catch (e) {
      // ignore
    }
  }

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Chặn /input với viewer
  const role = user.user_metadata?.role;
  if (role !== 'admin' && pathname.startsWith('/input')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
