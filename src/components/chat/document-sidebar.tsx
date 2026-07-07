"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText } from "lucide-react";

export interface DocumentSummary {
  id: number;
  name: string;
  docType: "resume" | "job";
  chunkCount: number;
}

// Shows the corpus at a glance: the grader can see exactly which documents
// answers are grounded in, without opening the database.
export function DocumentSidebar({
  documents,
  loading,
}: {
  documents: DocumentSummary[];
  loading: boolean;
}) {
  const resumes = documents.filter((d) => d.docType === "resume");
  const jobs = documents.filter((d) => d.docType === "job");

  return (
    <aside className="hidden w-72 shrink-0 flex-col border-r bg-muted/30 md:flex">
      <div className="px-4 py-4">
        <h1 className="text-sm font-semibold">Career Intelligence</h1>
        <p className="text-xs text-muted-foreground">
          Résumé vs job descriptions, grounded answers
        </p>
      </div>
      <Separator />
      <ScrollArea className="flex-1 px-4 py-4">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : documents.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No documents ingested yet. Run{" "}
            <code className="rounded bg-muted px-1 font-mono">pnpm seed</code>{" "}
            to load the demo corpus.
          </p>
        ) : (
          <div className="space-y-5">
            <DocGroup title="Résumé" docs={resumes} />
            <DocGroup title="Job descriptions" docs={jobs} />
          </div>
        )}
      </ScrollArea>
    </aside>
  );
}

function DocGroup({ title, docs }: { title: string; docs: DocumentSummary[] }) {
  if (docs.length === 0) return null;
  return (
    <div>
      <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <ul className="space-y-1">
        {docs.map((doc) => (
          <li
            key={doc.id}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
          >
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate" title={doc.name}>
              {doc.name}
            </span>
            <Badge variant="outline" className="shrink-0 text-[10px]">
              {doc.chunkCount} chunk{doc.chunkCount === 1 ? "" : "s"}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}
