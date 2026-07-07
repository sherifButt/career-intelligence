import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  vector,
} from "drizzle-orm/pg-core";

// Mirrors db/init.sql, which is the actual source of truth (it runs on first
// postgres boot). Duplicating ~20 lines of DDL was chosen over wiring a
// migration runner into the docker startup path — one less moving part.

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  docType: text("doc_type", { enum: ["resume", "job"] }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const chunks = pgTable("chunks", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  // 1536 dims = OpenAI text-embedding-3-small
  embedding: vector("embedding", { dimensions: 1536 }).notNull(),
});

export type DocType = "resume" | "job";
