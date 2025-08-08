import { auth } from '@clerk/nextjs/server';

export type UserType = 'guest' | 'regular';

export type AuthUser = {
  id: string;
  sessionId: string | null;
  type: UserType;
};

export type AuthSession = {
  user: AuthUser;
};

export async function getAuthUser(): Promise<AuthUser | null> {
  const { userId, sessionId } = await auth();

  if (!userId) {
    return null;
  }
  
  const user = {
    id: userId,
    sessionId,
    type: 'regular' as UserType,
  };
  return user;
}

export async function requireAuth() {
  const user = await getAuthUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

export { auth };