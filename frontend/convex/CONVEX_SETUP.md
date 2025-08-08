# Convex Setup Instructions

## Step 1: Environment Variables

First, ensure you have created a `.env.local` file with at least:

```bash
# Clerk (required)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

## Step 2: Initialize Convex

Run the following command to set up Convex:

```bash
npx convex dev
```

This will:
1. Open your browser to create/select a Convex project
2. Generate the `_generated` folder with api.d.ts, dataModel.d.ts, etc.
3. Deploy your Convex functions from the `/convex` folder
4. Add NEXT_PUBLIC_CONVEX_URL to your .env.local automatically

## Step 3: Complete Setup

After running `npx convex dev`, the generated files will resolve the import errors:
- `@/convex/_generated/api`
- `@/convex/_generated/dataModel`

## Step 4: Run the Application

In a separate terminal, run:

```bash
npm run dev
```

## Notes

- Keep `npx convex dev` running in one terminal
- Run `npm run dev` in another terminal
- The Convex dashboard will open at https://dashboard.convex.dev
- All functions in the `/convex` folder will be deployed automatically

Once these steps are complete, the authentication and database integration will work properly!