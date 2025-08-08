import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store } = convexAuth({
  // Clerk OIDC is configured via auth.config.ts; no direct providers here
  providers: [],
});
