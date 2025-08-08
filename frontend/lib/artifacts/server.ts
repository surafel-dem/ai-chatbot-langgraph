import { codeDocumentHandler } from '@/artifacts/code/server';
import { imageDocumentHandler } from '@/artifacts/image/server';
import { sheetDocumentHandler } from '@/artifacts/sheet/server';
import { textDocumentHandler } from '@/artifacts/text/server';
import type { ArtifactKind } from '@/components/artifact';
import type { Doc } from '@/convex/_generated/dataModel';
import { api } from "@/convex/_generated/api";
import { createAuthenticatedClient, createGuestClient } from '@/lib/convex-client';
import type { AuthSession } from '@/lib/auth';
import type { UIMessageStreamWriter } from 'ai';
import type { ChatMessage } from '../types';

export interface SaveDocumentProps {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}

export interface CreateDocumentCallbackProps {
  id: string;
  title: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  session: AuthSession;
}

export interface UpdateDocumentCallbackProps {
  document: Doc<"documents">;
  description: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  session: AuthSession;
}

export interface DocumentHandler<T = ArtifactKind> {
  kind: T;
  onCreateDocument: (args: CreateDocumentCallbackProps) => Promise<void>;
  onUpdateDocument: (args: UpdateDocumentCallbackProps) => Promise<void>;
}

export function createDocumentHandler<T extends ArtifactKind>(config: {
  kind: T;
  onCreateDocument: (params: CreateDocumentCallbackProps) => Promise<string>;
  onUpdateDocument: (params: UpdateDocumentCallbackProps) => Promise<string>;
}): DocumentHandler<T> {
  return {
    kind: config.kind,
    onCreateDocument: async (args: CreateDocumentCallbackProps) => {
      console.log('🎨 Starting document creation for:', { id: args.id, title: args.title, kind: config.kind });
      
      const draftContent = await config.onCreateDocument({
        id: args.id,
        title: args.title,
        dataStream: args.dataStream,
        session: args.session,
      });

      console.log('🎨 Document content generated:', { 
        id: args.id, 
        contentLength: draftContent?.length || 0, 
        contentPreview: draftContent?.substring(0, 100) + '...',
        hasContent: !!draftContent
      });

      if (args.session?.user?.id) {
        let convex;
        let convexUserId;
        
        if (args.session.user.type === 'regular') {
          // Authenticated user
          convex = await createAuthenticatedClient();
          convexUserId = await convex.mutation(api.users.ensureUser, {});
        } else {
          // Guest user
          convex = createGuestClient();
          convexUserId = await convex.mutation(api.users.createGuestUser, { 
            guest_id: args.session.user.id 
          });
        }
        
        console.log('🎨 Saving document to Convex with content length:', draftContent?.length || 0);
        
        await convex.mutation(api.documents.createDocument, {
          id: args.id,
          user_id: convexUserId,
          title: args.title,
          content: draftContent,
          kind: config.kind,
        });
        
        console.log('🎨 Document saved to Convex successfully');
      }

      return;
    },
    onUpdateDocument: async (args: UpdateDocumentCallbackProps) => {
      const draftContent = await config.onUpdateDocument({
        document: args.document,
        description: args.description,
        dataStream: args.dataStream,
        session: args.session,
      });

      if (args.session?.user?.id) {
        let convex;
        
        if (args.session.user.type === 'regular') {
          convex = await createAuthenticatedClient();
        } else {
          convex = createGuestClient();
        }
        
        await convex.mutation(api.documents.updateDocument, {
          document_id: args.document.id,
          title: args.document.title,
          content: draftContent,
        });
      }

      return;
    },
  };
}

/*
 * Use this array to define the document handlers for each artifact kind.
 */
export const documentHandlersByArtifactKind: Array<DocumentHandler> = [
  textDocumentHandler,
  codeDocumentHandler,
  imageDocumentHandler,
  sheetDocumentHandler,
];

export const artifactKinds = ['text', 'code', 'image', 'sheet'] as const;
