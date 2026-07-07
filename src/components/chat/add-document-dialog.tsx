"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Paperclip, Upload } from "lucide-react";
import type { DocType } from "@/lib/db/schema";

// Upload = post the raw file to /api/ingest as multipart. Text extraction
// (.md/.txt passthrough, .pdf via unpdf, .docx via mammoth) happens server-
// side, then the same chunk → embed → store pipeline runs (idempotent by
// name).
const ACCEPTED = /\.(md|txt|pdf|docx)$/i;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function AddDocumentDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [docType, setDocType] = useState<DocType>("job");
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setFile(null);
    setName("");
    setDocType("job");
    setDragging(false);
  }

  function handleFile(picked: File) {
    if (!ACCEPTED.test(picked.name)) {
      toast.error("Only .md, .txt, .pdf and .docx files are supported");
      return;
    }
    if (picked.size > MAX_FILE_BYTES) {
      toast.error(`${picked.name} is too large (max 10 MB)`);
      return;
    }
    setFile(picked);
    setName(picked.name);
    // Convention-based default, same rule as the seed script — still
    // user-overridable via the radio group.
    setDocType(/^(cv|resume)/i.test(picked.name) ? "resume" : "job");
  }

  async function submit() {
    if (!file || !name.trim() || submitting) return;
    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("name", name.trim());
      form.set("docType", docType);
      const res = await fetch("/api/ingest", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Ingest failed (${res.status})`);
      toast.success(
        `${name.trim()} ingested — ${data.chunkCount} chunk${data.chunkCount === 1 ? "" : "s"} embedded`,
        {
          description: data.analysis
            ? `${data.analysis.matchScore}% match · ${data.analysis.risk} risk · seniority ${data.analysis.seniority}`
            : undefined,
        },
      );
      setOpen(false);
      reset();
      onAdded();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ingestion failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      {/* Lives inside the chat form — explicit type="button" so opening
          the dialog never submits the question form. */}
      <DialogTrigger
        render={<Button type="button" variant="ghost" size="icon" />}
      >
        <Paperclip className="size-4" />
        <span className="sr-only">Add document to the corpus</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a document</DialogTitle>
          <DialogDescription>
            Upload a résumé or job description (.md, .txt, .pdf or .docx). It
            is chunked, embedded, and immediately available to ask about.
          </DialogDescription>
        </DialogHeader>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) handleFile(dropped);
          }}
          className={`flex w-full flex-col items-center gap-1.5 rounded-md border border-dashed px-4 py-6 text-sm transition-colors ${
            dragging ? "border-primary bg-primary/5" : "hover:bg-muted/50"
          }`}
        >
          <Upload className="size-5 text-muted-foreground" />
          {file ? (
            <span className="font-medium">{file.name}</span>
          ) : (
            <>
              <span className="font-medium">
                Choose a .md, .txt, .pdf or .docx file
              </span>
              <span className="text-xs text-muted-foreground">
                or drag it here
              </span>
            </>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.txt,.pdf,.docx"
          className="hidden"
          onChange={(e) => {
            const picked = e.target.files?.[0];
            if (picked) handleFile(picked);
            e.target.value = "";
          }}
        />

        {file && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="doc-name">Name</Label>
              <Input
                id="doc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="job-4-acme-ai.pdf"
              />
              <p className="text-xs text-muted-foreground">
                Re-using an existing name replaces that document.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <RadioGroup
                value={docType}
                onValueChange={(v) => setDocType(v as DocType)}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="job" id="type-job" />
                  <Label htmlFor="type-job" className="font-normal">
                    Job description
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="resume" id="type-resume" />
                  <Label htmlFor="type-resume" className="font-normal">
                    Résumé
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!file || !name.trim() || submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {submitting ? "Processing…" : "Ingest"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
