import { withAuth, withOptionalAuth } from '@/lib/api-handler';
import { ApiResponse } from '@/lib/api-response';
import { api } from "@/convex/_generated/api";

export const GET = withOptionalAuth(async ({ convex, userId, request }) => {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get('chatId');

  if (!chatId) {
    return ApiResponse.error('Parameter chatId is required');
  }

  // Get chat
  const chat = await convex.query(api.chats.getChatById, { chat_id: chatId });
  if (!chat) {
    return ApiResponse.json([]);
  }

  // For authenticated users, verify ownership
  if (userId) {
    const user = await convex.query(api.users.getCurrentUser, {});
    if (user && chat.user_id !== user._id) {
      return ApiResponse.json([]);
    }
  }

  // Get vote statistics
  const voteStats = await convex.query(api.documents.getChatVoteStats, { chat_id: chatId });
  
  // TODO: Convert vote stats to the expected format
  return ApiResponse.json([]);
});

export const PATCH = withAuth(async ({ convex, userId, request }) => {
  const body = await request.json();
  const { chatId, messageId, type } = body;

  if (!chatId || !messageId || !type) {
    return ApiResponse.error('Parameters chatId, messageId, and type are required');
  }

  // Get chat and verify ownership
  const chat = await convex.query(api.chats.getChatById, { chat_id: chatId });
  if (!chat) {
    return ApiResponse.notFound('Chat');
  }

  const user = await convex.query(api.users.getCurrentUser, {});
  if (!user || chat.user_id !== user._id) {
    return ApiResponse.forbidden();
  }

  // Vote on the message
  await convex.mutation(api.documents.voteMessage, {
    message_id: messageId,
    is_upvoted: type === 'up',
  });

  return ApiResponse.success('Vote recorded');
});
