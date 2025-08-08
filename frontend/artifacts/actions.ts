'use server';

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export async function getSuggestions({ documentId }: { documentId: string }) {
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const suggestions = await convex.query(api.documents.getDocumentSuggestions, { document_id: documentId });
  return suggestions ?? [];
}
