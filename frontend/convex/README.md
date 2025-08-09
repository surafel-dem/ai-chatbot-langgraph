# Convex Backend

This directory contains the Convex backend for the app, including schema, auth, and server-side functions.

## Credits System (Registered Users)

We introduced a simple credits system for registered users to enable budgeting and future feature gating.

### Schema Additions

The `users` table now includes optional fields:

- `credits: number` — total credits available for the user (default initialized to 100 on user creation)
- `reserved_credits: number` — credits currently reserved for in-flight operations

These fields are optional to avoid breaking existing data. New users are initialized in `users.ensureUser`.

### Functions

New functions are provided in `convex/credits.ts`:

- `credits.getUserCreditsInfo` (query): returns `{ totalCredits, availableCredits, reservedCredits }`
- `credits.reserveAvailableCredits` (mutation): reserves credits atomically, enforcing a `minAmount`
- `credits.finalizeCreditsUsage` (mutation): deducts `actualAmount` and releases the full reserved amount
- `credits.releaseReservedCredits` (mutation): releases a reservation without deducting credits

These functions do not alter existing flows unless explicitly called from the API layer.

### Initialization

`users.ensureUser` initializes default values for new users and backfills missing values for existing users:

```
credits: 100,
reserved_credits: 0,
```

## Guest Users

Guest (unauthenticated) users are supported via `users.createGuestUser` and `guest_sessions`. A guest cookie-based session helper will be added on the Next.js side to enable read-only credit banners and future gating, without impacting existing behavior.

### Anonymous Session Cookie (Frontend)

- `lib/anonymous-session-client.ts` (client) and `lib/anonymous-session-server.ts` (server) manage a readable `anonymous-session` cookie with:
  - `id: string`, `remainingCredits: number`, `createdAt: ISO string`
  - TTL: `ANONYMOUS_LIMITS.SESSION_DURATION` (24h)
- The cookie is intentionally not HttpOnly so the guest banner and sidebar can reflect live credit updates.

## Development

- Start dev server: `npx convex dev`
- Deploy: `npx convex deploy`
- Dashboard: `npx convex dashboard`

---

Below is generic Convex function usage guidance.

A query function that takes two arguments looks like:

```ts
// functions.js
import { query } from "./_generated/server";
import { v } from "convex/values";

export const myQueryFunction = query({
  // Validators for arguments.
  args: {
    first: v.number(),
    second: v.string(),
  },

  // Function implementation.
  handler: async (ctx, args) => {
    // Read the database as many times as you need here.
    // See https://docs.convex.dev/database/reading-data.
    const documents = await ctx.db.query("tablename").collect();

    // Arguments passed from the client are properties of the args object.
    console.log(args.first, args.second);

    // Write arbitrary JavaScript here: filter, aggregate, build derived data,
    // remove non-public properties, or create new objects.
    return documents;
  },
});
```

Using this query function in a React component looks like:

```ts
const data = useQuery(api.functions.myQueryFunction, {
  first: 10,
  second: "hello",
});
```

A mutation function looks like:

```ts
// functions.js
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const myMutationFunction = mutation({
  // Validators for arguments.
  args: {
    first: v.string(),
    second: v.string(),
  },

  // Function implementation.
  handler: async (ctx, args) => {
    // Insert or modify documents in the database here.
    // Mutations can also read from the database like queries.
    // See https://docs.convex.dev/database/writing-data.
    const message = { body: args.first, author: args.second };
    const id = await ctx.db.insert("messages", message);

    // Optionally, return a value from your mutation.
    return await ctx.db.get(id);
  },
});
```

Using this mutation function in a React component looks like:

```ts
const mutation = useMutation(api.functions.myMutationFunction);
function handleButtonPress() {
  // fire and forget, the most common way to use mutations
  mutation({ first: "Hello!", second: "me" });
  // OR
  // use the result once the mutation has completed
  mutation({ first: "Hello!", second: "me" }).then((result) =>
    console.log(result),
  );
}
```

Use the Convex CLI to push your functions to a deployment. See everything
the Convex CLI can do by running `npx convex -h` in your project root
directory. To learn more, launch the docs with `npx convex docs`.
