import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/login(.*)',
  '/register(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/auth(.*)',
  '/ping',
]);

// Define API routes that support optional auth (guest users)
const isOptionalAuthRoute = createRouteMatcher([
  '/api/chat',
  '/api/vote',
  '/api/document',
]);

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;
  
  // Health check endpoint
  if (pathname === '/ping') {
    return new Response('pong', { status: 200 });
  }

  // Public routes - no auth required
  if (isPublicRoute(req)) {
    return;
  }

  // Optional auth routes - allow both authenticated and guest users
  if (isOptionalAuthRoute(req)) {
    return;
  }

  // All other routes require authentication
  await auth.protect();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
