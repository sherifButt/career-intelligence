import { cosineDistance, desc, eq, sql } from "drizzle-orm";
import { chunks, documents, getDb, type DocType } from "@/lib/db";
import type { RetrievedChunk } from "@/lib/types";
import { embedQuery } from "./embed";

export interface RetrieveOptions {
  docType?: DocType;
  k?: number;
}

// Top-k cosine similarity over pgvector, optionally filtered by doc type.
// Scores are returned (not just used for ordering) so the API can expose
// them and the guardrail can threshold on them.
export async function retrieve(
  query: string,
  { docType, k = 6 }: RetrieveOptions = {},
): Promise<RetrievedChunk[]> {
  const queryEmbedding = await embedQuery(query);
  return retrieveByEmbedding(queryEmbedding, { docType, k });
}

// Split out so one query embedding can serve several filtered searches
// (the chat route searches resume + jobs with a single embedding call).
export async function retrieveByEmbedding(
  queryEmbedding: number[],
  { docType, k = 6 }: RetrieveOptions = {},
): Promise<RetrievedChunk[]> {
  const db = getDb();
  const similarity = sql<number>`1 - (${cosineDistance(chunks.embedding, queryEmbedding)})`;

  const rows = await db
    .select({
      chunkId: chunks.id,
      documentName: documents.name,
      docType: documents.docType,
      chunkIndex: chunks.chunkIndex,
      content: chunks.content,
      score: similarity,
    })
    .from(chunks)
    .innerJoin(documents, eq(chunks.documentId, documents.id))
    .where(docType ? eq(documents.docType, docType) : undefined)
    .orderBy((t) => desc(t.score))
    .limit(k);

  return rows.map((r) => ({ ...r, score: Number(r.score) }));
}
