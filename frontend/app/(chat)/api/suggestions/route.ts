import { withAuth } from '@/lib/api-handler';
import { ApiResponse } from '@/lib/api-response';
import { api } from "@/convex/_generated/api";

export const GET = withAuth(async ({ convex, userId, request }) => {
  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get('documentId');

  if (!documentId) {
    return ApiResponse.error('Parameter documentId is required.');
  }

  // Get user to verify ownership
  const user = await convex.query(api.users.getCurrentUser, {});
  if (!user) {
    return ApiResponse.notFound('User');
  }

  // Get document
  const document = await convex.query(api.documents.getDocument, { 
    document_id: documentId 
  });
  
  if (!document) {
    return ApiResponse.notFound('Document');
  }

  // Verify ownership
  if (document.user_id !== user._id) {
    return ApiResponse.forbidden();
  }

  // Get suggestions
  const suggestions = await convex.query(api.documents.getDocumentSuggestions, {
    document_id: documentId,
  });

  return ApiResponse.json(suggestions);
});