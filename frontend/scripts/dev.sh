#!/bin/bash

# AI Chatbot Development Script
# Starts Convex and Next.js in parallel with proper error handling

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_color() {
  printf "${1}${2}${NC}\n"
}

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
  print_color $BLUE "🔍 Checking prerequisites..."
  
  if ! command_exists bun; then
    print_color $RED "❌ Bun is not installed. Please install it first:"
    echo "curl -fsSL https://bun.sh/install | bash"
    exit 1
  fi
  
  if ! command_exists bunx; then
    print_color $RED "❌ bunx is not available. Please update Bun to the latest version."
    exit 1
  fi
  
  print_color $GREEN "✅ Prerequisites check passed"
}

# Function to handle cleanup on exit
cleanup() {
  print_color $YELLOW "\n🧹 Cleaning up background processes..."
  jobs -p | xargs -r kill
  exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Check environment
check_env() {
  if [[ ! -f .env.local ]]; then
    print_color $YELLOW "⚠️  .env.local not found. Running setup..."
    bun run setup:env
  fi
  
  # Check if Convex is configured
  if ! grep -q "NEXT_PUBLIC_CONVEX_URL=https" .env.local 2>/dev/null; then
    print_color $YELLOW "⚠️  Convex not configured. You may need to run 'bun run convex:dev' first."
  fi
}

# Start development servers
start_dev() {
  print_color $BLUE "🚀 Starting development environment..."
  print_color $BLUE "   - Convex backend: http://localhost:3210"
  print_color $BLUE "   - Next.js frontend: http://localhost:3000"
  print_color $BLUE "   - Press Ctrl+C to stop both servers"
  echo ""
  
  # Start Convex in background
  print_color $GREEN "🔧 Starting Convex..."
  bunx convex dev &
  CONVEX_PID=$!
  
  # Wait a moment for Convex to start
  sleep 3
  
  # Start Next.js in background
  print_color $GREEN "⚡ Starting Next.js with Turbo..."
  bunx next dev --turbo &
  NEXT_PID=$!
  
  # Wait for both processes
  wait $CONVEX_PID $NEXT_PID
}

# Main execution
main() {
  print_color $GREEN "🤖 AI Chatbot Development Environment"
  print_color $GREEN "====================================="
  echo ""
  
  check_prerequisites
  check_env
  start_dev
}

# Run main function
main