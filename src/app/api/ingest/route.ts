import { NextRequest, NextResponse } from "next/server";
import { ingestDocument } from "@/lib/rag/ingest";

// Accepts pre-extracted text as JSON. File upload (pdf/docx parsing) is
// deliberately out of scope — the seed script covers the demo corpus, and
// parsing is noted as future work in the README.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, docType, content } = (body ?? {}) as Record<string, unknown>;

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "`name` is required" }, { status: 400 });
  }
  if (docType !== "resume" && docType !== "job") {
    return NextResponse.json(
      { error: '`docType` must be "resume" or "job"' },
      { status: 400 },
    );
  }
  if (typeof content !== "string" || !content.trim()) {
    return NextResponse.json(
      { error: "`content` must be non-empty text" },
      { status: 400 },
    );
  }
  // Mirrors the client-side cap; the server is the one that pays the
  // embedding bill, so it enforces the limit too.
  if (content.length > 200_000) {
    return NextResponse.json(
      { error: "`content` is too large (max 200k characters)" },
      { status: 400 },
    );
  }

  try {
    const result = await ingestDocument({ name: name.trim(), docType, content });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[ingest] failed:", err);
    const message = err instanceof Error ? err.message : "Ingestion failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
