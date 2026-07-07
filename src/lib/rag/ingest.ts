import { eq } from "drizzle-orm";
import { chunks, documents, getDb, type DocType } from "@/lib/db";
import { chunkText } from "./chunk";
import { embedTexts } from "./embed";

export interface IngestInput {
  name: string;
  docType: DocType;
  content: string;
}

export interface IngestResult {
  documentId: number;
  chunkCount: number;
}

// Re-ingesting a document with the same name replaces it (delete + insert
// inside one transaction). Keeps `pnpm seed` idempotent — no stale chunks
// from a previous run.
export async function ingestDocument({
  name,
  docType,
  content,
}: IngestInput): Promise<IngestResult> {
  const pieces = chunkText(content);
  if (pieces.length === 0) {
    throw new Error(`Document "${name}" has no extractable text`);
  }

  // Embed before opening the transaction — no reason to hold a DB
  // transaction open across network calls to OpenAI.
  const embeddings = await embedTexts(pieces);

  const db = getDb();
  return db.transaction(async (tx) => {
    await tx.delete(documents).where(eq(documents.name, name));
    const [doc] = await tx
      .insert(documents)
      .values({ name, docType })
      .returning({ id: documents.id });

    await tx.insert(chunks).values(
      pieces.map((content, i) => ({
        documentId: doc.id,
        chunkIndex: i,
        content,
        embedding: embeddings[i],
      })),
    );

    return { documentId: doc.id, chunkCount: pieces.length };
  });
}
