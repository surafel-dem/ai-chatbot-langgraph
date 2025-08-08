# 🤖 AI Chatbot - Next.js + Convex + Clerk

A modern, full-stack AI chatbot application built with **Next.js 15**, **Convex** real-time database, and **Clerk** authentication. Features real-time messaging, file uploads, document management, and guest user support with automatic cleanup.

## ✨ Features

### 🔐 **Authentication**
- **Clerk Integration** - Secure authentication with social logins
- **Guest Users** - Anonymous chat sessions with 24-hour auto-cleanup
- **User Profiles** - Customizable profiles with usage statistics

### 💬 **Chat System**
- **Real-time Messaging** - Instant message delivery with Convex reactivity
- **AI Integration** - Support for OpenAI, Anthropic, and other AI SDK providers
- **Message History** - Persistent chat history for registered users
- **Streaming Responses** - Real-time AI response streaming

### 📁 **File Management**
- **Convex Storage** - Built-in file storage (up to 4GB per file)
- **File Uploads** - Drag & drop file uploads with progress indicators
- **Auto-cleanup** - Temporary files automatically removed after expiration
- **File Sharing** - Share files within chat conversations

### 📄 **Documents & Artifacts**
- **Code Editor** - Syntax-highlighted code editing with CodeMirror
- **Document Types** - Support for text, code, images, and spreadsheets
- **Version Control** - Track document changes and versions
- **Suggestions** - Collaborative editing with approval workflow
- **Publishing** - Make documents public or keep them private

### 🗳️ **Voting System**
- **Message Voting** - Upvote/downvote AI responses
- **Analytics** - Track message quality and user preferences
- **Statistics** - View voting statistics per chat

### 🧹 **Auto-cleanup**
- **Guest Data** - Automatic cleanup of guest sessions after 24 hours
- **File Expiration** - Temporary files removed automatically
- **Database Health** - Automated maintenance to prevent bloat

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Convex (real-time database + backend functions)
- **Authentication**: Clerk
- **File Storage**: Convex Storage
- **AI**: AI SDK v4 with provider support (OpenAI, Anthropic, etc.)
- **UI**: Radix UI, Shadcn/ui, Framer Motion
- **Code Editor**: CodeMirror 6
- **Package Manager**: Bun
- **Styling**: Tailwind CSS, CSS Variables for theming

## 🚀 Quick Start

### Prerequisites
- **Bun** v1.1+ (recommended) or Node.js v18+
- **Clerk** account for authentication
- **Convex** account for database (free tier available)

---

## 🆕 **First-Time Setup**

### 1. Clone and Install
```bash
git clone <your-repo-url>
cd ai-chatbot/frontend
bun install
```

### 2. Environment Setup
```bash
# Run the interactive setup (recommended)
bun run setup

# This creates .env.local with the template you need
```

**Or manually create `.env.local`:**
```bash
# Authentication (Required)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Database (Auto-populated by Convex)
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_DEPLOYMENT=dev:your-deployment

# AI Providers (Optional)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Set up Services

#### 🔐 Clerk Authentication
1. Go to [https://clerk.com/](https://clerk.com/) and create an account
2. Create a new application
3. Copy the **publishable key** and **secret key** to `.env.local`
4. In Clerk dashboard, configure allowed redirect URLs:
   - `http://localhost:3000`
   - `http://localhost:3000/*`

#### 🗄️ Convex Database Setup

**Option A: Fresh Database (Recommended)**
```bash
# Initialize and deploy schema (first time)
bunx convex dev --once
```

**Option B: If you have old data conflicts:**
```bash
# 1. Clear old database (if needed)
# Visit: https://dashboard.convex.dev (go to Data tab → Clear tables)

# 2. Deploy clean schema
bunx convex dev --once
```

### 4. 🚀 Start Development
```bash
# Start both Convex and Next.js together
bun run dev
```

**Or start services individually:**
```bash
# Terminal 1 - Backend
bun run convex:dev

# Terminal 2 - Frontend  
bun run next:dev
```

### 5. ✅ Verify Setup
- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Convex Dashboard**: [https://dashboard.convex.dev](https://dashboard.convex.dev)

---

## 🔄 **Continuous Development Setup**

### Daily Development
```bash
# Start everything (most common)
bun run dev

# This runs both:
# - Convex backend (port 3210)
# - Next.js frontend (port 3000)
```

### If You Get Schema Conflicts
```bash
# 1. Check if you have data conflicts
bunx convex dev --once

# 2. If conflicts, clear data in dashboard or:
# Visit: https://dashboard.convex.dev → Data → Clear tables

# 3. Re-deploy schema
bunx convex dev --once
```

### Common Commands
```bash
# View real-time logs
bunx convex logs

# Open database dashboard
bunx convex dashboard

# Deploy to production
bun run convex:deploy --prod
```

---

## 🔧 **Troubleshooting First-Time Setup**

### ❌ "Script not found" Error
```bash
# If you get script errors, reinstall:
bun install
```

### ❌ Schema Validation Failed
```bash
# Clear old data and retry:
bunx convex dashboard  # Go to Data tab → Clear all tables
bunx convex dev --once
```

### ❌ Environment Variables Missing
```bash
# Run setup again:
bun run setup

# Or manually check .env.local has all required values
```

### ❌ Clerk Auth Not Working
1. Check `.env.local` has correct Clerk keys
2. Verify redirect URLs in Clerk dashboard include `localhost:3000`
3. Restart development server: `bun run dev`

---

## ✅ **Setup Complete Checklist**

After first-time setup, you should see:
- [ ] ✅ `bun install` completed without errors
- [ ] ✅ `.env.local` created with Clerk keys
- [ ] ✅ `bunx convex dev --once` deployed schema successfully  
- [ ] ✅ `bun run dev` starts both services
- [ ] ✅ `http://localhost:3000` shows the app
- [ ] ✅ Clerk sign-in/sign-up works
- [ ] ✅ Guest mode works without sign-in

**🎉 You're ready to build!**

## 📁 Project Structure

```
frontend/
├── app/                    # Next.js app router
│   ├── (auth)/            # Authentication pages
│   ├── (chat)/            # Main chat interface
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   ├── chat.tsx          # Main chat component
│   └── ...
├── convex/               # Convex backend functions
│   ├── schema.ts         # Database schema
│   ├── chats.ts          # Chat functions
│   ├── files.ts          # File management
│   ├── users.ts          # User management
│   ├── documents.ts      # Document functions
│   ├── crons.ts          # Scheduled cleanup jobs
│   └── _generated/       # Generated types (auto)
├── lib/                  # Utility libraries
├── hooks/                # Custom React hooks
├── scripts/              # Setup and dev scripts
└── public/               # Static assets
```

## 🔧 Available Scripts

### Development
```bash
bun run dev              # Start both Convex + Next.js
bun run next:dev         # Start only Next.js
bun run convex:dev       # Start only Convex
```

### Build & Deploy
```bash
bun run build           # Build for production
bun run start           # Start production server
bun run convex:deploy   # Deploy Convex functions
```

### Database Management
```bash
bunx convex dashboard   # Open Convex dashboard
bunx convex logs        # View function logs
bunx convex dev --reset # Reset database (⚠️ destroys data)
```

### Code Quality
```bash
bun run lint            # Run ESLint + Biome
bun run lint:fix        # Fix linting issues
bun run format          # Format code with Biome
bun run typecheck       # TypeScript type checking
```

### Testing
```bash
bun test               # Run unit tests
bun run test:e2e       # Run Playwright E2E tests
```

### Utilities
```bash
bun run setup          # Interactive project setup
bun run clean          # Clean build artifacts and reinstall
```

## 🏗️ Database Schema

The Convex schema includes:

- **users** - User accounts (Clerk + guest users)
- **chats** - Chat conversations
- **messages** - Individual chat messages
- **files** - File storage references
- **documents** - Text/code/image documents
- **suggestions** - Document edit suggestions
- **votes** - Message voting system
- **streams** - Real-time streaming sessions
- **guest_sessions** - Guest user session tracking
- **usage_logs** - Analytics and usage tracking

## 🔒 Authentication Flow

### Registered Users
1. Sign up/in with Clerk
2. User record created in Convex
3. Full access to all features
4. Persistent chat history

### Guest Users
1. Automatic guest ID generation
2. Temporary session (24-hour expiration)
3. Limited feature access
4. Data automatically cleaned up

## 📂 File Storage

### Convex Storage Benefits
- **4GB file limit** (vs 5MB on Vercel Blob)
- **Built-in CDN** for fast global delivery
- **Real-time URLs** that update automatically
- **Automatic cleanup** for temporary files
- **Zero configuration** - works out of the box

### File Upload Flow
```typescript
// 1. Generate upload URL
const uploadUrl = await generateUploadUrl();

// 2. Upload file directly to Convex
const result = await fetch(uploadUrl, {
  method: 'POST',
  body: file
});

// 3. Store file reference in database
const fileId = await createFile({
  storage_id: result.storageId,
  filename: file.name,
  // ... metadata
});
```

## 🤖 AI Integration

### Supported Providers
- **OpenAI** - GPT-4, GPT-3.5-turbo
- **Anthropic** - Claude 3, Claude 2
- **Custom Providers** - Any AI SDK compatible provider

### Configuration
```typescript
// lib/ai/providers.ts
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
```

## 🧹 Auto-cleanup System

### Guest Data Cleanup
- **Hourly**: Expired guest sessions
- **Daily**: Guest users inactive 24+ hours
- **Every 6h**: Expired temporary files

### Manual Cleanup
```bash
# Trigger manual cleanup
bunx convex run crons:manualGuestCleanup

# View cleanup statistics
bunx convex run crons:getCleanupStats
```

## 🚀 Deployment

### Vercel (Recommended)
1. Connect your repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy Convex functions: `bun run convex:deploy --prod`
4. Deploy frontend: automatic on git push

### Environment Variables (Production)
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_CONVEX_URL=https://your-prod-deployment.convex.cloud
CONVEX_DEPLOYMENT=prod:your-deployment
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

## 🔍 Monitoring & Analytics

### Built-in Analytics
- User registration and activity
- Message count and AI usage
- File upload statistics
- Voting patterns and preferences

### Convex Dashboard
- Real-time function logs
- Database browser and queries
- Performance metrics
- Error tracking

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines
- Use **Bun** for package management
- Follow **TypeScript** best practices
- Add **tests** for new features
- Update **documentation** for API changes
- Run **linting** before committing

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙋‍♂️ Support

- **Documentation**: Check the `/convex` folder for detailed function documentation
- **Issues**: Open a GitHub issue for bugs or feature requests
- **Discord**: Join our community for real-time support

## 🎯 Roadmap

- [ ] **Voice Messages** - Audio message support
- [ ] **Real-time Collaboration** - Multi-user document editing
- [ ] **Plugin System** - Extensible AI tool integration
- [ ] **Mobile App** - React Native companion app
- [ ] **Advanced Analytics** - Detailed usage insights
- [ ] **Team Workspaces** - Multi-tenant support

---

Built with ❤️ using [Next.js](https://nextjs.org/), [Convex](https://convex.dev/), and [Clerk](https://clerk.com/).