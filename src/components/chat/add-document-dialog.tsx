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
import { FilePlus2, Loader2, Upload } from "lucide-react";
import type { DocType } from "@/lib/db/schema";

// Upload = read the file's text in the browser and hand it to the existing
// /api/ingest endpoint (chunk → embed → store, idempotent by name). Only
// .md/.txt: text extraction for pdf/docx is deliberately out of scope.
const ACCEPTED = /\.(md|txt)$/i;
// Generous for text documents; stops someone feeding a novel to the
// embedding API by accident.
const MAX_CHARS = 200_000;

export function AddDocumentDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [docType, setDocType] = useState<DocType>("job");
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setFileName(null);
    setContent(null);
    setName("");
    setDocType("job");
    setDragging(false);
  }

  async function handleFile(file: File) {
    if (!ACCEPTED.test(file.name)) {
      toast.error("Only .md and .txt files are supported (PDF is future work)");
      return;
    }
    const text = await file.text();
    if (!text.trim()) {
      toast.error(`${file.name} appears to be empty`);
      return;
    }
    if (text.length > MAX_CHARS) {
      toast.error(`${file.name} is too large (max ${MAX_CHARS / 1000}k characters)`);
      return;
    }
    setFileName(file.name);
    setContent(text);
    setName(file.name);
    // Convention-based default, same rule as the seed script — still
    // user-overridable via the radio group.
    setDocType(/^(cv|resume)/i.test(file.name) ? "resume" : "job");
  }

  async function submit() {
    if (!content || !name.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), docType, content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Ingest failed (${res.status})`);
      toast.success(
        `${name.trim()} ingested — ${data.chunkCount} chunk${data.chunkCount === 1 ? "" : "s"} embedded`,
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
      <DialogTrigger render={<Button variant="outline" size="sm" className="w-full" />}>
        <FilePlus2 className="size-4" />
        Add document
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a document</DialogTitle>
          <DialogDescription>
            Upload a résumé or job description (.md or .txt). It is chunked,
            embedded, and immediately available to ask about.
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
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
          className={`flex w-full flex-col items-center gap-1.5 rounded-md border border-dashed px-4 py-6 text-sm transition-colors ${
            dragging ? "border-primary bg-primary/5" : "hover:bg-muted/50"
          }`}
        >
          <Upload className="size-5 text-muted-foreground" />
          {fileName ? (
            <span className="font-medium">{fileName}</span>
          ) : (
            <>
              <span className="font-medium">Choose a .md/.txt file</span>
              <span className="text-xs text-muted-foreground">
                or drag it here
              </span>
            </>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.txt"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />

        {content && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="doc-name">Name</Label>
              <Input
                id="doc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="job-4-acme-ai.md"
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
          <Button onClick={submit} disabled={!content || !name.trim() || submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {submitting ? "Embedding…" : "Ingest"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
