"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, File, FileText, Trash2 } from "lucide-react";
import type { JobAnalysis } from "@/lib/db/schema";

export interface DocumentSummary {
  id: number;
  name: string;
  docType: "resume" | "job";
  chunkCount: number;
  sizeBytes: number;
  createdAt: string;
  analysis?: JobAnalysis | null;
}

// The retrieval corpus, visible at a glance on the right of the chat —
// résumé on top, jobs ranked by their ingest-time fit screen (match score,
// screening risk, seniority fit). Rows carry a hover-revealed delete;
// adding documents lives in the chat input (📎).
export function ContextPanel({
  documents,
  loading,
  onDocumentsChanged,
}: {
  documents: DocumentSummary[];
  loading: boolean;
  onDocumentsChanged: () => void;
}) {
  const [toDelete, setToDelete] = useState<DocumentSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const resumes = documents.filter((d) => d.docType === "resume");
  const jobs = documents.filter((d) => d.docType === "job");

  async function confirmDelete() {
    if (!toDelete || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/documents/${toDelete.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Delete failed (${res.status})`);
      toast.success(`${toDelete.name} removed from the corpus`);
      setToDelete(null);
      onDocumentsChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <aside className="hidden w-79 shrink-0 flex-col border-l bg-muted/30 lg:flex">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h2 className="text-sm font-semibold">Context</h2>
        <Badge variant="secondary" className="text-[11px]">
          {documents.length} file{documents.length === 1 ? "" : "s"}
        </Badge>
      </div>
      <ScrollArea className="min-h-0 flex-1 px-2 py-2">
        {loading ? (
          <div className="space-y-2 px-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : documents.length === 0 ? (
          <p className="px-2 text-xs text-muted-foreground">
            No documents yet. Run{" "}
            <code className="rounded bg-muted px-1 font-mono">pnpm seed</code>{" "}
            for the demo corpus, or attach a file with the 📎 in the chat box.
          </p>
        ) : (
          <div className="space-y-5">
            <section>
              <SectionHeading>Résumé</SectionHeading>
              <DocList docs={resumes} onDelete={setToDelete} />
            </section>
            <section>
              <SectionHeading hint={jobs.length > 1 ? "best match first" : undefined}>
                Jobs
              </SectionHeading>
              <DocList docs={jobs} onDelete={setToDelete} />
            </section>
          </div>
        )}
      </ScrollArea>

      <AlertDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {toDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes its {toDelete?.chunkCount} embedded chunk
              {toDelete?.chunkCount === 1 ? "" : "s"} from the corpus, so future
              answers will no longer consider it. It cannot be undone — you can
              re-upload the file later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              variant="destructive"
            >
              {deleting ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}

function SectionHeading({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="mb-1 flex items-baseline justify-between px-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {children}
      </h3>
      {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

function DocList({
  docs,
  onDelete,
}: {
  docs: DocumentSummary[];
  onDelete: (doc: DocumentSummary) => void;
}) {
  if (docs.length === 0) {
    return <p className="px-2 text-xs text-muted-foreground">None yet.</p>;
  }
  return (
    <ul className="space-y-1">
      {docs.map((doc) => (
        <li
          key={doc.id}
          className="group flex items-start gap-3 rounded-md px-2 py-2"
        >
          <DocIcon name={doc.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-normal" title={doc.name}>
              {doc.name}
            </p>
            <div className="flex flex-wrap justify-between items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
              <span>
                {formatSize(doc.sizeBytes)} · {formatWhen(doc.createdAt)}
              </span>
              {doc.analysis && (
                <>
                  {/* <span aria-hidden>·</span> */}
                  <MatchStats analysis={doc.analysis} />
                </>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="invisible size-6 shrink-0 text-muted-foreground hover:text-destructive group-hover:visible"
            onClick={() => onDelete(doc)}
            aria-label={`Delete ${doc.name}`}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </li>
      ))}
    </ul>
  );
}

// green ≥70 / amber 40–69 / red <40 — coarse on purpose; the number carries
// the precision.
function scoreColor(score: number): string {
  if (score >= 70) return "bg-green-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-red-500";
}

const RISK_LABEL = { low: "low risk", medium: "med risk", high: "high risk" };

// Risk owns the color channel (traffic light); seniority stays quiet — a
// green check when "fit", a neutral word only when it needs reading.
const RISK_CLASSES = {
  low: "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-400",
  medium:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400",
  high: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400",
};

function MatchStats({ analysis }: { analysis: JobAnalysis }) {
  return (
     <span
        className='inline-flex flex-wrap items-center gap-1.5'
        title={
          [
            analysis.mustHaves && `must-haves met: ${analysis.mustHaves}`,
            analysis.riskNote,
          ]
            .filter(Boolean)
            .join(" — ") || undefined
        }>
        <span className='flex items-center gap-1 text-xs font-normal tabular-nums text-muted-foreground'>
           <span
              className={`size-2 rounded-full ${scoreColor(analysis.matchScore)}`}
              aria-hidden
           />
           {analysis.matchScore}%
        </span>
        <Badge
           variant='outline'
           className={`px-1.5 text-[10px] font-normal `}>
           {RISK_LABEL[analysis.risk]}
        </Badge>
        {analysis.seniority === 'fit' ? (
           <span
              className='flex items-center '
              title='Seniority: fit for the level this role is pitched at'>
              <Check className='size-3.5' strokeWidth={2} />
              <span className='sr-only'>seniority: fit</span>
           </span>
        ) : (
           <Badge
              variant='outline'
              className='px-1.5 text-[10px] font-normal'
              title={`Seniority: ${analysis.seniority}-qualified for this role`}>
              {analysis.seniority}
           </Badge>
        )}
     </span>
  )
}

function DocIcon({ name }: { name: string }) {
  const Icon = /\.pdf$/i.test(name) ? File : FileText;
  return <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

// Time of day for today's uploads, date otherwise — matches how little the
// exact timestamp matters at this scale.
function formatWhen(iso: string): string {
  const date = new Date(iso);
  const today = new Date().toDateString() === date.toDateString();
  return today
    ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString();
}
