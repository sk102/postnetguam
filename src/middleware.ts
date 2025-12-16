import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: {
    signIn: '/login',
  },
});

export const config = {
  // Protect all routes except login, api/auth, api/health, and static files
  matcher: [
    /*
     * Match all request paths except:
     * - login (login page)
     * - api/auth (NextAuth.js routes)
     * - api/health (health check endpoint)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!login|api/auth|api/health|_next/static|_next/image|favicon.ico).*)',
  ],
};
