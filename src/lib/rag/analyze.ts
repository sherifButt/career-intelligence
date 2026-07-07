import { asc, eq } from "drizzle-orm";
import { chunks, documents, getDb, type JobAnalysis } from "@/lib/db";
import { getLlmProvider } from "@/lib/llm/provider";
import { estimateCostUSD } from "@/lib/observability/cost";

// One recruiter-style screen per job, run at ingest time — the panel reads
// a stored result instead of paying an LLM call per view. ~$0.0004 per job
// with gpt-4o-mini.

const SYSTEM_PROMPT = `You are an experienced technical recruiter doing a first-pass screen of one candidate résumé against one job description.

Return ONLY a JSON object, no prose, exactly this shape:
{"matchScore": <integer 0-100>, "risk": "low"|"medium"|"high", "riskNote": "<one sentence, max 90 chars, naming the single biggest screening-out risk>", "seniority": "under"|"fit"|"over"}

Definitions:
- matchScore: overall skills + experience match. 100 = ideal on paper; 50 = plausible stretch; below 30 = wrong role.
- risk: likelihood an HR screen rejects the application (missing must-haves, domain mismatch, certifications).
- seniority: candidate's level relative to the level the role is pitched at ("over" = overqualified).
Judge only from the two texts. Be honest, not kind.`;

// Enough context for a screen without blowing the budget on huge documents.
const MAX_CHARS = 8000;

export async function analyzeJobFit(
  jobContent: string,
): Promise<JobAnalysis | null> {
  const resumeText = await getResumeText();
  // No résumé ingested yet → nothing to compare against.
  if (!resumeText) return null;

  const completion = await getLlmProvider().complete([
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `RÉSUMÉ:\n${resumeText.slice(0, MAX_CHARS)}\n\nJOB DESCRIPTION:\n${jobContent.slice(0, MAX_CHARS)}`,
    },
  ]);

  const analysis = parseAnalysis(completion.text);
  console.log(
    JSON.stringify({
      event: "job_analysis",
      ok: analysis !== null,
      tokensIn: completion.tokensIn,
      tokensOut: completion.tokensOut,
      estimatedCostUSD: estimateCostUSD(
        completion.model,
        completion.tokensIn,
        completion.tokensOut,
      ),
    }),
  );
  return analysis;
}

// The résumé as one text: its chunks in order. Chunk overlap duplicates a
// little text, which is harmless for a screening read.
async function getResumeText(): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select({ content: chunks.content })
    .from(chunks)
    .innerJoin(documents, eq(chunks.documentId, documents.id))
    .where(eq(documents.docType, "resume"))
    .orderBy(asc(chunks.documentId), asc(chunks.chunkIndex));
  if (rows.length === 0) return null;
  return rows.map((r) => r.content).join("\n\n");
}

function parseAnalysis(text: string): JobAnalysis | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const raw = JSON.parse(match[0]) as Record<string, unknown>;
    const matchScore = Number(raw.matchScore);
    const risk = raw.risk;
    const seniority = raw.seniority;
    if (
      !Number.isFinite(matchScore) ||
      (risk !== "low" && risk !== "medium" && risk !== "high") ||
      (seniority !== "under" && seniority !== "fit" && seniority !== "over")
    ) {
      return null;
    }
    return {
      matchScore: Math.max(0, Math.min(100, Math.round(matchScore))),
      risk,
      riskNote: typeof raw.riskNote === "string" ? raw.riskNote.slice(0, 140) : "",
      seniority,
    };
  } catch {
    return null;
  }
}
