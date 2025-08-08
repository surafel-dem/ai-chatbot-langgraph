import { withAuth, withOptionalAuth } from '@/lib/api-handler';
import { ApiResponse } from '@/lib/api-response';
import { api } from "@/convex/_generated/api";
import type { ArtifactKind } from '@/components/artifact';

export const GET = withOptionalAuth(async ({ convex, userId, request }) => {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return ApiResponse.error('Parameter id is missing');
  }

  // Get document
  const document = await convex.query(api.documents.getDocumentById, { document_id: id });
  if (!document) {
    return ApiResponse.notFound('Document');
  }

  // Check access permissions
  if (!document.is_published && userId) {
    const user = await convex.query(api.users.getCurrentUser, {});
    if (!user || document.user_id !== user._id) {
      return ApiResponse.forbidden();
    }
  } else if (!document.is_published && !userId) {
    // Guest users can't access private documents
    return ApiResponse.forbidden();
  }

  return ApiResponse.json([document]);
});

export const POST = withAuth(async ({ convex, userId, request }) => {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return ApiResponse.error('Parameter id is required');
  }

  const body = await request.json();
  const { content, title, kind }: { content: string; title: string; kind: ArtifactKind } = body;

  if (!content || !title || !kind) {
    return ApiResponse.error('Missing required fields: content, title, kind');
  }

  // Get user
  const user = await convex.query(api.users.getCurrentUser, {});
  if (!user) {
    return ApiResponse.notFound('User');
  }

  // Check if document exists
  const existingDoc = await convex.query(api.documents.getDocumentById, { document_id: id });

  if (existingDoc) {
    // Update existing document
    if (existingDoc.user_id !== user._id) {
      return ApiResponse.forbidden();
    }

    await convex.mutation(api.documents.updateDocument, {
      document_id: id,
      content,
      title,
    });
  } else {
    // Create new document
    await convex.mutation(api.documents.createDocument, {
      id,
      user_id: user._id,
      title,
      content,
      kind: kind as "text" | "code" | "image" | "sheet",
    });
  }

  // Return updated document
  const document = await convex.query(api.documents.getDocumentById, { document_id: id });
  return ApiResponse.json(document);
});

export const DELETE = withAuth(async ({ convex, userId, request }) => {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return ApiResponse.error('Parameter id is required');
  }

  // Get document and verify ownership
  const document = await convex.query(api.documents.getDocumentById, { document_id: id });
  if (!document) {
    return ApiResponse.notFound('Document');
  }

  const user = await convex.query(api.users.getCurrentUser, {});
  if (!user || document.user_id !== user._id) {
    return ApiResponse.forbidden();
  }

  // Delete document
  await convex.mutation(api.documents.deleteDocument, { document_id: id });

  return ApiResponse.success('Document deleted successfully');
});