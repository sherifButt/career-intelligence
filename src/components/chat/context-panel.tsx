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
import { File, FileText, Trash2 } from "lucide-react";

export interface DocumentSummary {
  id: number;
  name: string;
  docType: "resume" | "job";
  chunkCount: number;
  sizeBytes: number;
  createdAt: string;
}

// The retrieval corpus, visible at a glance on the right of the chat. Rows
// carry a hover-revealed delete; adding documents lives in the chat
// input (📎).
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
    <aside className="hidden w-72 shrink-0 flex-col border-l bg-muted/30 lg:flex">
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
          <ul className="space-y-1">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="group flex items-start gap-3 rounded-md px-2 py-2"
              >
                <DocIcon name={doc.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={doc.name}>
                    {doc.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {doc.docType} · {formatSize(doc.sizeBytes)} ·{" "}
                    {formatWhen(doc.createdAt)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="invisible size-6 shrink-0 text-muted-foreground hover:text-destructive group-hover:visible"
                  onClick={() => setToDelete(doc)}
                  aria-label={`Delete ${doc.name}`}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
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
