import { NextRequest, NextResponse } from "next/server";
import { getLlmProvider } from "@/lib/llm/provider";
import { embedQuery } from "@/lib/rag/embed";
import { buildGroundedPrompt } from "@/lib/rag/prompt";
import { retrieveByEmbedding } from "@/lib/rag/retrieve";
import type { ChatResponse, ChatSource } from "@/lib/types";

// Every question this app exists for compares the résumé against jobs, so a
// single global top-k risks returning one side only (the query "my
// experience..." is naturally closer to CV text). Instead we retrieve the
// top chunks from each side with one query embedding.
const RESUME_K = 4;
const JOB_K = 4;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { question } = (body ?? {}) as Record<string, unknown>;
  if (typeof question !== "string" || !question.trim()) {
    return NextResponse.json(
      { error: "`question` must be a non-empty string" },
      { status: 400 },
    );
  }
  if (question.length > 2000) {
    return NextResponse.json(
      { error: "`question` is too long (max 2000 chars)" },
      { status: 400 },
    );
  }

  const startedAt = Date.now();
  try {
    const queryEmbedding = await embedQuery(question.trim());
    const [resumeChunks, jobChunks] = await Promise.all([
      retrieveByEmbedding(queryEmbedding, { docType: "resume", k: RESUME_K }),
      retrieveByEmbedding(queryEmbedding, { docType: "job", k: JOB_K }),
    ]);
    const retrieved = [...resumeChunks, ...jobChunks];

    if (retrieved.length === 0) {
      return NextResponse.json(
        { error: "No documents ingested yet — run `pnpm seed` first" },
        { status: 409 },
      );
    }

    const prompt = buildGroundedPrompt(question.trim(), retrieved);
    const completion = await getLlmProvider().complete([
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ]);

    const sources: ChatSource[] = retrieved.map((c, i) => ({
      label: `S${i + 1}`,
      documentName: c.documentName,
      docType: c.docType,
      chunkIndex: c.chunkIndex,
      content: c.content,
      score: c.score,
    }));

    const response: ChatResponse = {
      answer: completion.text,
      sources,
      guardrailTriggered: false,
      latencyMs: Date.now() - startedAt,
      tokenUsage: { input: completion.tokensIn, output: completion.tokensOut },
      estimatedCostUSD: 0, // wired up with the observability pass
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[chat] failed:", err);
    const message = err instanceof Error ? err.message : "Chat request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
