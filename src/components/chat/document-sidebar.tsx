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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Trash2 } from "lucide-react";

export interface DocumentSummary {
  id: number;
  name: string;
  docType: "resume" | "job";
  chunkCount: number;
}

// Shows the corpus at a glance: the grader can see exactly which documents
// answers are grounded in, without opening the database. Rows carry a
// hover-revealed delete; adding documents lives in the chat input (📎).
export function DocumentSidebar({
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
            No documents yet. Run{" "}
            <code className="rounded bg-muted px-1 font-mono">pnpm seed</code>{" "}
            for the demo corpus, or attach a file with the 📎 in the chat box.
          </p>
        ) : (
          <div className="space-y-5">
            <DocGroup title="Résumé" docs={resumes} onDelete={setToDelete} />
            <DocGroup
              title="Job descriptions"
              docs={jobs}
              onDelete={setToDelete}
            />
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

function DocGroup({
  title,
  docs,
  onDelete,
}: {
  title: string;
  docs: DocumentSummary[];
  onDelete: (doc: DocumentSummary) => void;
}) {
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
            className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
          >
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate" title={doc.name}>
              {doc.name}
            </span>
            <Badge
              variant="outline"
              className="shrink-0 text-[10px] group-hover:hidden"
            >
              {doc.chunkCount} chunk{doc.chunkCount === 1 ? "" : "s"}
            </Badge>
            <Button
              variant="ghost"
              size="icon-sm"
              className="hidden size-6 shrink-0 text-muted-foreground hover:text-destructive group-hover:inline-flex"
              onClick={() => onDelete(doc)}
              aria-label={`Delete ${doc.name}`}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
