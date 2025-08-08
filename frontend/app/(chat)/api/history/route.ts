import { withAuth } from '@/lib/api-handler';
import { ApiResponse } from '@/lib/api-response';
import { api } from "@/convex/_generated/api";

export const GET = withAuth(async ({ convex, userId, request }) => {
  const { searchParams } = new URL(request.url);
  
  const limit = Number.parseInt(searchParams.get('limit') || '10');
  const startingAfter = searchParams.get('starting_after');
  const endingBefore = searchParams.get('ending_before');

  if (startingAfter && endingBefore) {
    return ApiResponse.error('Only one of starting_after or ending_before can be provided');
  }

  // Get user from Convex
  const user = await convex.query(api.users.getCurrentUser, {});
  if (!user) {
    return ApiResponse.json({ chats: [], hasMore: false });
  }

  // Get user's chats
  const chats = await convex.query(api.chats.getUserChatsById, {
    user_id: user._id,
    limit,
  });

  return ApiResponse.json({
    chats,
    hasMore: false, // TODO: Implement pagination
  });
});
