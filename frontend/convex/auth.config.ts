export default {
  providers: [
    {
      domain: process.env.CLERK_ISSUER_URL || "https://exotic-louse-41.clerk.accounts.dev",
      applicationID: "convex",
    },
  ]
};