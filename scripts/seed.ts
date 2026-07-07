// Ingests every .md/.txt file in /seed. Run with `pnpm seed` (needs the
// docker postgres up and OPENAI_API_KEY in .env).
import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { ingestDocument } from "../src/lib/rag/ingest";
import type { DocType } from "../src/lib/db/schema";

const SEED_DIR = path.join(process.cwd(), "seed");

// Convention over config: files named cv-* / resume-* are the résumé,
// everything else is a job description.
function inferDocType(filename: string): DocType {
  return /^(cv|resume)/i.test(filename) ? "resume" : "job";
}

async function main() {
  const files = (await readdir(SEED_DIR)).filter((f) => /\.(md|txt)$/i.test(f));
  if (files.length === 0) {
    console.error(`No .md/.txt files found in ${SEED_DIR}`);
    process.exit(1);
  }

  for (const file of files.sort()) {
    const content = await readFile(path.join(SEED_DIR, file), "utf8");
    const docType = inferDocType(file);
    const { chunkCount } = await ingestDocument({ name: file, docType, content });
    console.log(`✓ ${file} (${docType}) → ${chunkCount} chunks`);
  }

  console.log("Seed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
