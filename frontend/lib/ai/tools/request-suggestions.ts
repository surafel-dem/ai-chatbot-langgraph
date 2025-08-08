import { z } from 'zod';
import type { AuthSession } from '@/lib/auth';
import { streamObject, tool, type UIMessageStreamWriter } from 'ai';
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { generateUUID } from '@/lib/utils';
import { myProvider } from '../providers';
import type { ChatMessage } from '@/lib/types';

interface RequestSuggestionsProps {
  session: AuthSession;
  dataStream: UIMessageStreamWriter<ChatMessage>;
}

export const requestSuggestions = ({
  session,
  dataStream,
}: RequestSuggestionsProps) =>
  tool({
    description: 'Request suggestions for a document',
    inputSchema: z.object({
      documentId: z
        .string()
        .describe('The ID of the document to request edits'),
    }),
    execute: async ({ documentId }) => {
      const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
      const document = await convex.query(api.documents.getDocument, { document_id: documentId });

      if (!document || !document.content) {
        return {
          error: 'Document not found',
        };
      }

      const suggestions: Array<{
        originalText: string;
        suggestedText: string;
        description: string;
        id: string;
        documentId: string;
        isResolved: boolean;
      }> = [];

      const { elementStream } = streamObject({
        model: myProvider.languageModel('artifact-model'),
        system:
          'You are a help writing assistant. Given a piece of writing, please offer suggestions to improve the piece of writing and describe the change. It is very important for the edits to contain full sentences instead of just words. Max 5 suggestions.',
        prompt: document.content,
        output: 'array',
        schema: z.object({
          originalSentence: z.string().describe('The original sentence'),
          suggestedSentence: z.string().describe('The suggested sentence'),
          description: z.string().describe('The description of the suggestion'),
        }),
      });

      for await (const element of elementStream) {
        const suggestion = {
          originalText: element.originalSentence,
          suggestedText: element.suggestedSentence,
          description: element.description,
          id: generateUUID(),
          documentId: documentId,
          isResolved: false,
        };

        dataStream.write({
          type: 'data-suggestion',
          data: suggestion,
          transient: true,
        });

        suggestions.push(suggestion);
      }

      // Save suggestions to Convex
      for (const suggestion of suggestions) {
        await convex.mutation(api.documents.createSuggestion, {
          document_id: documentId,
          original_text: suggestion.originalText,
          suggested_text: suggestion.suggestedText,
          description: suggestion.description,
        });
      }

      return {
        id: documentId,
        title: document.title,
        kind: document.kind,
        message: 'Suggestions have been added to the document',
      };
    },
  });
