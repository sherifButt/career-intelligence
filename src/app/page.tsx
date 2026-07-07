"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DocumentSidebar,
  type DocumentSummary,
} from "@/components/chat/document-sidebar";
import { SourcesPanel } from "@/components/chat/sources-panel";
import type { ChatResponse } from "@/lib/types";
import { SendHorizontal, ShieldAlert } from "lucide-react";

// The assignment's example queries, one click away — lets a reviewer demo
// the app without composing a question.
const QUICK_QUERIES = [
  "What skills am I missing for the Newpage FDE role?",
  "How does my experience align with Job #2?",
  "Where is my experience strongest for the AI Engineer posting?",
  "What should I prepare for the interview based on my gaps?",
];

interface UserMessage {
  role: "user";
  content: string;
}

interface AssistantMessage extends ChatResponse {
  role: "assistant";
}

type Message = UserMessage | AssistantMessage;

export default function ChatPage() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  // null = compare against all jobs; a document id = analyse that job only.
  const [jobScope, setJobScope] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const jobDocs = documents.filter((d) => d.docType === "job");

  function loadDocuments() {
    fetch("/api/documents")
      .then((res) => res.json())
      .then((data) => setDocuments(data.documents ?? []))
      .catch(() => toast.error("Could not load documents — is the DB up?"))
      .finally(() => setDocsLoading(false));
  }

  useEffect(loadDocuments, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || pending) return;
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setPending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          ...(jobScope !== null && { jobDocumentId: jobScope }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      setMessages((prev) => [...prev, { role: "assistant", ...data }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      // Drop the orphaned user message so retrying doesn't double it up.
      setMessages((prev) => prev.slice(0, -1));
      setInput(trimmed);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex h-full">
      <DocumentSidebar
        documents={documents}
        loading={docsLoading}
        onDocumentsChanged={loadDocuments}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <ScrollArea className="flex-1">
          <div className="mx-auto max-w-3xl px-4 py-8">
            {messages.length === 0 ? (
              <EmptyState onPick={ask} disabled={pending} />
            ) : (
              <div className="space-y-6">
                {messages.map((m, i) =>
                  m.role === "user" ? (
                    <div key={i} className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                        {m.content}
                      </div>
                    </div>
                  ) : (
                    <AssistantBubble key={i} message={m} />
                  ),
                )}
                {pending && (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t bg-background">
          <div className="mx-auto max-w-3xl px-4 py-3">
            {messages.length > 0 && (
              <QuickQueries onPick={ask} disabled={pending} compact />
            )}
            {jobDocs.length > 1 && (
              <JobScopeSelector
                jobs={jobDocs}
                scope={jobScope}
                onScopeChange={setJobScope}
                disabled={pending}
              />
            )}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                ask(input);
              }}
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about fit, skill gaps, or interview prep…"
                aria-label="Your question"
                disabled={pending}
              />
              <Button type="submit" disabled={pending || !input.trim()} size="icon">
                <SendHorizontal className="size-4" />
                <span className="sr-only">Send</span>
              </Button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}

function AssistantBubble({ message }: { message: AssistantMessage }) {
  return (
    <div className="max-w-[95%]">
      {message.guardrailTriggered && (
        <p className="mb-1 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-500">
          <ShieldAlert className="size-3.5" />
          Retrieval confidence too low — refused rather than guessed
        </p>
      )}
      <div className="rounded-2xl border bg-card px-4 py-3 text-sm [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5">
        <ReactMarkdown>{message.answer}</ReactMarkdown>
      </div>
      <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
        {(message.latencyMs / 1000).toFixed(1)}s · {message.tokenUsage.input}{" "}
        in / {message.tokenUsage.output} out · ~$
        {message.estimatedCostUSD.toFixed(4)}
      </p>
      {message.sources.length > 0 && <SourcesPanel sources={message.sources} />}
    </div>
  );
}

function EmptyState({
  onPick,
  disabled,
}: {
  onPick: (q: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col items-center pt-16 text-center">
      <h2 className="text-lg font-semibold">
        Ask anything about your fit for these roles
      </h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        Answers are grounded in the résumé and job descriptions in the
        sidebar — every response shows the exact excerpts it used.
      </p>
      <div className="mt-6 w-full max-w-md">
        <QuickQueries onPick={onPick} disabled={disabled} />
      </div>
    </div>
  );
}

// Scopes retrieval to one job posting: an explicit UI control instead of
// hoping the embedding similarity resolves "Job #2" from the question text.
function JobScopeSelector({
  jobs,
  scope,
  onScopeChange,
  disabled,
}: {
  jobs: DocumentSummary[];
  scope: number | null;
  onScopeChange: (scope: number | null) => void;
  disabled: boolean;
}) {
  return (
    <div
      className="mb-2 flex items-center gap-1.5 overflow-x-auto pb-1"
      role="radiogroup"
      aria-label="Job scope"
    >
      <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Analyse against
      </span>
      <Button
        variant={scope === null ? "secondary" : "ghost"}
        size="sm"
        role="radio"
        aria-checked={scope === null}
        disabled={disabled}
        onClick={() => onScopeChange(null)}
        className="h-7 shrink-0 rounded-full px-3 text-xs"
      >
        All jobs
      </Button>
      {jobs.map((job) => (
        <Button
          key={job.id}
          variant={scope === job.id ? "secondary" : "ghost"}
          size="sm"
          role="radio"
          aria-checked={scope === job.id}
          disabled={disabled}
          onClick={() => onScopeChange(scope === job.id ? null : job.id)}
          className="h-7 shrink-0 rounded-full px-3 text-xs"
          title={job.name}
        >
          {jobLabel(job.name)}
        </Button>
      ))}
    </div>
  );
}

// "job-2-senior-fullstack.md" → "job-2-senior-fullstack" is still noisy on a
// chip; shorten to the leading "Job N" when the seed naming convention
// matches, otherwise fall back to the bare filename.
function jobLabel(name: string): string {
  const match = name.match(/^job[-_ ]?(\d+)/i);
  return match ? `Job ${match[1]}` : name.replace(/\.(md|txt)$/i, "");
}

function QuickQueries({
  onPick,
  disabled,
  compact = false,
}: {
  onPick: (q: string) => void;
  disabled: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact ? "mb-2 flex gap-2 overflow-x-auto pb-1" : "grid gap-2"
      }
    >
      {QUICK_QUERIES.map((q) => (
        <Button
          key={q}
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onPick(q)}
          className={
            compact
              ? "shrink-0 text-xs font-normal"
              : "h-auto justify-start whitespace-normal py-2 text-left text-xs font-normal"
          }
        >
          {q}
        </Button>
      ))}
    </div>
  );
}
