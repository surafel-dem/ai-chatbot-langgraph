import { ConvexHttpClient } from 'convex/browser';
import { createAuthenticatedClient, createGuestClient, getCurrentUserId } from './convex-client';
import { ApiResponse } from './api-response';

type AuthenticatedHandler<T> = (context: {
  convex: ConvexHttpClient;
  userId: string;
  request: Request;
}) => Promise<T>;

type GuestHandler<T> = (context: {
  convex: ConvexHttpClient;
  request: Request;
}) => Promise<T>;

/**
 * Wraps an API handler with authentication
 */
export function withAuth<T>(
  handler: AuthenticatedHandler<T>
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    try {
      const userId = await getCurrentUserId();
      
      if (!userId) {
        return ApiResponse.unauthorized();
      }
      
      const convex = await createAuthenticatedClient();
      const result = await handler({ convex, userId, request });
      
      if (result instanceof Response) {
        return result;
      }
      
      return ApiResponse.json(result);
    } catch (error) {
      console.error('API handler error:', error);
      
      if (error instanceof Error && error.message === 'No authentication token available') {
        return ApiResponse.unauthorized();
      }
      
      return ApiResponse.serverError();
    }
  };
}

/**
 * Wraps an API handler that supports both authenticated and guest users
 */
export function withOptionalAuth<T>(
  handler: (context: {
    convex: ConvexHttpClient;
    userId: string | null;
    request: Request;
  }) => Promise<T>
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    try {
      const userId = await getCurrentUserId();
      
      const convex = userId 
        ? await createAuthenticatedClient()
        : createGuestClient();
      
      const result = await handler({ convex, userId, request });
      
      if (result instanceof Response) {
        return result;
      }
      
      return ApiResponse.json(result);
    } catch (error) {
      console.error('API handler error:', error);
      return ApiResponse.serverError();
    }
  };
}

/**
 * Wraps an API handler for guest-only operations
 */
export function withGuest<T>(
  handler: GuestHandler<T>
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    try {
      const convex = createGuestClient();
      const result = await handler({ convex, request });
      
      if (result instanceof Response) {
        return result;
      }
      
      return ApiResponse.json(result);
    } catch (error) {
      console.error('API handler error:', error);
      return ApiResponse.serverError();
    }
  };
}