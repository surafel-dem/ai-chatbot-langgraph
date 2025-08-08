import { tool, type UIMessageStreamWriter } from 'ai';
import type { AuthSession } from '@/lib/auth';
import { z } from 'zod';
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { documentHandlersByArtifactKind } from '@/lib/artifacts/server';
import type { ChatMessage } from '@/lib/types';

interface UpdateDocumentProps {
  session: AuthSession;
  dataStream: UIMessageStreamWriter<ChatMessage>;
}

export const updateDocument = ({ session, dataStream }: UpdateDocumentProps) =>
  tool({
    description: 'Update a document with the given description.',
    inputSchema: z.object({
      id: z.string().describe('The ID of the document to update'),
      description: z
        .string()
        .describe('The description of changes that need to be made'),
    }),
    execute: async ({ id, description }) => {
      const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
      const document = await convex.query(api.documents.getDocument, { document_id: id as any });

      if (!document) {
        return {
          error: 'Document not found',
        };
      }

      dataStream.write({
        type: 'data-clear',
        data: null,
        transient: true,
      });

      const documentHandler = documentHandlersByArtifactKind.find(
        (documentHandlerByArtifactKind) =>
          documentHandlerByArtifactKind.kind === document.kind,
      );

      if (!documentHandler) {
        throw new Error(`No document handler found for kind: ${document.kind}`);
      }

      await documentHandler.onUpdateDocument({
        document,
        description,
        dataStream,
        session,
      });

      dataStream.write({ type: 'data-finish', data: null, transient: true });

      return {
        id,
        title: document.title,
        kind: document.kind,
        content: 'The document has been updated successfully.',
      };
    },
  });
