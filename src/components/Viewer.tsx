"use client";
import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { NormalizedEvent } from "@/lib/normalize";
import { redact } from "@/lib/normalize";

type Props = {
  fileLabel: string | null;
  events: NormalizedEvent[];
  progress?: { read: number; total?: number };
  errors?: number;
  errorSamples?: Array<{ line: number; error: string }>;
};

export default function Viewer({ fileLabel, events, progress, errors, errorSamples }: Props) {
  const [showTools, setShowTools] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const [redactOn, setRedactOn] = useState(true);
  const [virtualize, setVirtualize] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (e.type === "tool_call" || e.type === "tool_result") return showTools;
      if (e.type === "meta") return showReasoning && e.kind === "reasoning_summary";
      return true;
    });
  }, [events, showTools, showReasoning]);

  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 80,
    overscan: 10,
  });

  return (
    <div className="h-full flex flex-col">
      <div className="p-2 border-b flex items-center gap-2 text-sm">
        <div className="font-medium truncate" title={fileLabel || undefined}>{fileLabel || "No file selected"}</div>
        <div className="ml-auto flex items-center gap-3">
          <label className="inline-flex items-center gap-1">
            <input type="checkbox" checked={showTools} onChange={(e) => setShowTools(e.target.checked)} aria-label="Show tool calls" />
            <span>Show tool calls</span>
          </label>
          <label className="inline-flex items-center gap-1">
            <input type="checkbox" checked={showReasoning} onChange={(e) => setShowReasoning(e.target.checked)} aria-label="Show reasoning summaries" />
            <span>Show reasoning summaries</span>
          </label>
          <label className="inline-flex items-center gap-1">
            <input type="checkbox" checked={redactOn} onChange={(e) => setRedactOn(e.target.checked)} aria-label="Redact PII" />
            <span>Redact PII</span>
          </label>
          <label className="inline-flex items-center gap-1">
            <input type="checkbox" checked={virtualize} onChange={(e) => setVirtualize(e.target.checked)} aria-label="Use virtualization" />
            <span>Virtualize (recommended)</span>
          </label>
        </div>
      </div>
      <div className="p-2 text-xs text-gray-600 flex items-center gap-3">
        {progress ? (
          <span>Progress: {formatBytes(progress.read)}{progress.total ? ` / ${formatBytes(progress.total)}` : ""}</span>
        ) : null}
        {errors ? <span className="text-red-600">Errors: {errors}</span> : null}
      </div>
      <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        {virtualize ? (
          <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
            {rowVirtualizer.getVirtualItems().map((vi) => {
              const e = filtered[vi.index];
              return (
                <div
                  key={vi.key}
                  ref={rowVirtualizer.measureElement}
                  className="px-3 py-2"
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${vi.start}px)`, height: `${vi.size}px` }}
                >
                  <EventRow ev={e} redactOn={redactOn} />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="max-w-full">
            {filtered.map((e, i) => (
              <div key={i} className="px-3 py-2">
                <EventRow ev={e} redactOn={redactOn} />
              </div>
            ))}
          </div>
        )}
      </div>
      {errorSamples && errorSamples.length > 0 ? (
        <div className="border-t p-2 text-xs text-red-700 bg-red-50">
          <div className="font-medium mb-1">Parse errors (samples):</div>
          <ul className="list-disc ml-4">
            {errorSamples.map((s, i) => (
              <li key={i}>Line {s.line}: {s.error}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function EventRow({ ev, redactOn }: { ev: NormalizedEvent; redactOn: boolean }) {
  const ts = new Date(ev.ts);
  const time = ts.toLocaleString();
  if (ev.type === "user" || ev.type === "assistant" || ev.type === "system") {
    const color = ev.type === "user" ? "bg-blue-50" : ev.type === "assistant" ? "bg-green-50" : "bg-gray-100";
    const text = redactOn ? redact(ev.text) : ev.text;
    return (
      <div className={`rounded border ${color} p-2 max-w-full`}>
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span className="capitalize">{ev.type}</span>
          <span>{time}</span>
        </div>
        <div className="whitespace-pre-wrap break-words text-sm max-w-full" style={{ overflowWrap: 'anywhere' }}>{text}</div>
        {Array.isArray((ev as any).attachments) && (ev as any).attachments.length > 0 && (
          <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
            {(ev as any).attachments.map((att: any, idx: number) => (
              att.kind === 'image' ? (
                <img key={idx} src={att.url} alt={att.alt || `${ev.type} image`}
                     className="max-w-full h-auto rounded border bg-white object-contain" style={{ maxHeight: 320 }} />
              ) : null
            ))}
          </div>
        )}
        <div className="text-right mt-1">
          <button className="text-xs underline" onClick={() => navigator.clipboard.writeText(ev.text)}>Copy</button>
        </div>
      </div>
    );
  }
  if (ev.type === "tool_call") {
    const json = JSON.stringify(ev.args, null, 2);
    return (
      <details className="rounded border bg-yellow-50 p-2">
        <summary className="cursor-pointer text-sm">Tool call: <span className="font-mono">{ev.name}</span> <span className="text-xs text-gray-600">{time}</span></summary>
        <pre className="text-xs whitespace-pre-wrap mt-1 max-w-full overflow-x-auto">{redactOn ? redact(json) : json}</pre>
      </details>
    );
  }
  if (ev.type === "tool_result") {
    const json = JSON.stringify(ev.output, null, 2);
    return (
      <details className="rounded border bg-orange-50 p-2">
        <summary className="cursor-pointer text-sm">Tool result: <span className="font-mono">{ev.name}</span> <span className="text-xs text-gray-600">{time}</span></summary>
        <pre className="text-xs whitespace-pre-wrap mt-1 max-w-full overflow-x-auto">{redactOn ? redact(json) : json}</pre>
      </details>
    );
  }
  // meta
  if (ev.kind === "reasoning_summary") {
    return (
      <div className="rounded border bg-purple-50 p-2 max-w-full">
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>Reasoning summary</span>
          <span>{time}</span>
        </div>
        <div className="text-sm whitespace-pre-wrap break-words max-w-full" style={{ overflowWrap: 'anywhere' }}>{ev.summary}</div>
      </div>
    );
  }
  return null;
}

function formatBytes(n: number) {
  if (!Number.isFinite(n)) return "0 B";
  const units = ["B", "KB", "MB", "GB"]; let i = 0; let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}
