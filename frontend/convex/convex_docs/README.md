# Convex Documentation

## 📚 **Documentation Index**

This folder contains comprehensive documentation for our Convex + Clerk + Next.js implementation.

---

## 🔗 **Quick Links**

### **[📖 Main App Overview](../../docs/APP_OVERVIEW.md)**

> Application structure, flows, scripts, and environment

### **[🔐 Database & Auth Guide](../../docs/DATABASE_AUTH.md)**

> Consolidated Convex schema and Clerk integration guide (supersedes older docs)

---

## 🎯 **Quick Reference**

### **Key Environment Variables**

```bash
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_FRONTEND_API_URL=https://exotic-louse-41.clerk.accounts.dev
```

### **Essential Commands**

```bash
# Deploy Convex changes
npx convex dev

# Start development server
npm run dev

# Reset Convex deployment (if needed)
npx convex env remove --prod
```

### **Key Files**

- `convex/auth.config.ts` - Authentication configuration
- `convex/schema.ts` - Database schema definition
- `convex/users.ts`, `convex/chats.ts`, `convex/documents.ts` - Core backend functions
- `components/ConvexClientProvider.tsx` - Frontend provider setup (if present)
- `frontend/lib/convex-client.ts` - Server-side Convex client helpers
- `frontend/middleware.ts` - Route protection

---

## 🚨 **Common Issues & Quick Fixes**

| Issue                | Quick Fix                                   |
| -------------------- | ------------------------------------------- |
| "Unauthorized" error | User migration needed - sign out/in         |
| Empty chat history   | Check auth loading state                    |
| JWT validation fails | Verify `NEXT_PUBLIC_CLERK_FRONTEND_API_URL` |
| Duplicate users      | Update `createOrGetUser` migration logic    |

---

## 📊 **Current Implementation Status**

- ✅ **Authentication**: Clerk + Convex JWT validation (OIDC-only providers)
- ✅ **User Management**: Anonymous (stable guest cookie) + authenticated users
- ✅ **Data Isolation**: Per-user chat history
- ✅ **Migration**: Anonymous → authenticated seamless transition
- ✅ **Security**: Ownership verification on all queries; production auth logs removed
- ✅ **Performance**: Optimized indexing and query patterns

---

**Last Updated**: 2025-08-08  
**Maintainer**: Development Team
