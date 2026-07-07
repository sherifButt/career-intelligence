import { NextResponse } from "next/server";
import { count, eq } from "drizzle-orm";
import { chunks, documents, getDb } from "@/lib/db";

// Backs the sidebar: which documents are in the corpus, and how many chunks
// each contributed — makes the retrieval corpus visible at a glance.
export async function GET() {
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: documents.id,
        name: documents.name,
        docType: documents.docType,
        chunkCount: count(chunks.id),
      })
      .from(documents)
      .leftJoin(chunks, eq(chunks.documentId, documents.id))
      .groupBy(documents.id)
      .orderBy(documents.name);

    return NextResponse.json({ documents: rows });
  } catch (err) {
    console.error("[documents] failed:", err);
    return NextResponse.json(
      { error: "Failed to load documents — is the database running?" },
      { status: 500 },
    );
  }
}
