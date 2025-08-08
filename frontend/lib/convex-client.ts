import { auth } from '@clerk/nextjs/server';
import { ConvexHttpClient } from 'convex/browser';

/**
 * Creates an authenticated Convex client for server-side operations
 * @throws {Error} If no auth token is available
 */
export async function createAuthenticatedClient(): Promise<ConvexHttpClient> {
  const { getToken } = await auth();
  const token = await getToken({ template: 'convex' });
  
  if (!token) {
    throw new Error('No authentication token available');
  }
  
  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  client.setAuth(token);
  return client;
}

/**
 * Creates an unauthenticated Convex client for guest operations
 */
export function createGuestClient(): ConvexHttpClient {
  return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
}

/**
 * Gets the current user ID from Clerk authentication
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}