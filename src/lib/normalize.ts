export type Role = "user" | "assistant" | "system";

export type Attachment = { kind: "image"; url: string; alt?: string };

export type NormalizedEvent =
  | { type: "user"; ts: number; text: string; attachments?: Attachment[] }
  | { type: "assistant"; ts: number; text: string; attachments?: Attachment[] }
  | { type: "system"; ts: number; text: string; attachments?: Attachment[] }
  | { type: "tool_call"; ts: number; name: string; args: unknown }
  | { type: "tool_result"; ts: number; name: string; output: unknown }
  | { type: "meta"; ts: number; kind: "reasoning_summary" | "info"; summary?: string; data?: unknown };

/** Convert various record shapes into a NormalizedEvent, or undefined to skip. */
export function normalizeRecord(record: unknown, _lineNum: number): NormalizedEvent | undefined {
  const r = (record ?? {}) as Record<string, unknown>;
  const ts = pickTimestamp(record) ?? Date.now();

  // Some logs include top-level markers for state or phases
  const recType = ((r["record_type"] ?? r["type"]) as string | undefined)?.toLowerCase();
  if (recType === "state") {
    return { type: "meta", ts, kind: "info", summary: "state" };
  }

  // Some logs encode tool calls/results via top-level `type`
  if (recType === "function_call" || recType === "tool_call") {
    const name = String((r["name"] as string | undefined) || "");
    const args = (r["arguments"] ?? r["args"]) as unknown;
    return { type: "tool_call", ts, name, args };
  }
  if (recType === "function_call_output" || recType === "tool_result" || recType === "tool_output") {
    const name = String((r["name"] as string | undefined) || "");
    const output = (r["output"] ?? r["result"] ?? r) as unknown;
    return { type: "tool_result", ts, name, output };
  }
  if (recType === "reasoning") {
    const summary = r["summary"] as unknown;
    if (typeof summary === "string" && summary.trim()) {
      return { type: "meta", ts, kind: "reasoning_summary", summary };
    }
  }

  // Reasoning summary (never include reasoning.content)
  const reasoning = r["reasoning"] as Record<string, unknown> | undefined;
  if (reasoning) {
    const summary = reasoning["summary"];
    if (typeof summary === "string" && summary.trim()) {
      return { type: "meta", ts, kind: "reasoning_summary", summary };
    }
  }

  // Tool call
  const fc = r["function_call"] as Record<string, unknown> | undefined;
  if (fc) {
    const name = String((fc["name"] as string | undefined) || "");
    const args = (fc["arguments"] ?? fc["args"]) ?? {};
    return { type: "tool_call", ts, name, args };
  }

  // Tool result
  const tOut = (r["function_call_output"] ?? r["tool_output"]) as Record<string, unknown> | undefined;
  if (tOut) {
    const name = String((tOut["name"] as string | undefined) || "");
    const output = tOut["output"] ?? tOut["result"] ?? tOut;
    return { type: "tool_result", ts, name, output };
  }

  // Standard messages
  const message = r["message"] as Record<string, unknown> | undefined;
  const role: Role | undefined = coerceRole((message?.["role"] as unknown) ?? r["role"]);
  if (role) {
    const parsed = parseContent((message?.["content"] as unknown) ?? r["content"]);
    const text = parsed.text;
    if (typeof text === "string" && text.length > 0) {
      const base: any = { type: role, ts, text };
      if (parsed.attachments.length) base.attachments = parsed.attachments;
      return base as NormalizedEvent;
    }
  }

  // If none matched, ignore line but could emit meta
  return undefined;
}

function pickTimestamp(record: unknown): number | undefined {
  const r = (record ?? {}) as Record<string, unknown>;
  const v = (r["ts"] ?? r["time"] ?? r["timestamp"]) as unknown;
  if (typeof v === "number") return normalizeEpoch(v);
  if (typeof v === "string") {
    const d = Date.parse(v);
    if (!Number.isNaN(d)) return d;
  }
  return undefined;
}

function normalizeEpoch(n: number): number {
  // Handle seconds vs ms
  return n < 1e12 ? Math.round(n * 1000) : Math.round(n);
}

function coerceRole(v: unknown): Role | undefined {
  const s = String((v as string | number | undefined) ?? "").toLowerCase();
  if (s === "user" || s === "assistant" || s === "system") return s;
  return undefined;
}

function parseContent(v: unknown): { text: string; attachments: Attachment[] } {
  const attachments: Attachment[] = [];
  if (v == null) return { text: "", attachments };
  if (typeof v === "string") return { text: v, attachments };
  if (Array.isArray(v)) {
    const parts: string[] = [];
    for (const item of v) {
      if (typeof item === "string") {
        parts.push(item);
        continue;
      }
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        const type = (obj["type"] as string | undefined)?.toLowerCase();
        if (type === "input_text" || type === "output_text" || type === "text") {
          const t = obj["text"];
          if (typeof t === "string") parts.push(t);
          else if (typeof obj["content"] === "string") parts.push(obj["content"] as string);
          else parts.push(JSON.stringify(obj));
          continue;
        }
        if (type?.includes("image")) {
          const url = sanitizeImageUrl(String(obj["image_url"] || obj["url"] || ""));
          if (url) attachments.push({ kind: "image", url, alt: typeof obj["alt"] === "string" ? (obj["alt"] as string) : undefined });
          continue;
        }
        // Unknown object, prefer its text/content if present
        if (typeof obj["text"] === "string") parts.push(obj["text"] as string);
        else if (typeof obj["content"] === "string") parts.push(obj["content"] as string);
        else parts.push(JSON.stringify(obj));
      }
    }
    return { text: parts.join("\n\n"), attachments };
  }
  if (typeof v === "object") return { text: JSON.stringify(v), attachments };
  return { text: String(v), attachments };
}

function sanitizeImageUrl(url: string): string | null {
  // Allow data: images and blob: URLs; block external http(s) by default per runtime policy
  if (!url) return null;
  const lower = url.toLowerCase();
  if (lower.startsWith("data:image/")) return url;
  if (lower.startsWith("blob:")) return url;
  // Allow same-origin absolute URLs as a compromise (optional):
  try {
    const u = new URL(url, "http://localhost"); // base ignored for absolute data/blob
    if (u.protocol === "http:" || u.protocol === "https:") {
      // Disallow external fetches by default
      return null;
    }
  } catch {
    // if URL constructor fails, reject
  }
  return null;
}

// Redaction utilities (apply on display)
export type RedactionOptions = {
  emails?: boolean;
  tokens?: boolean;
  longDigits?: boolean;
};

const EMAIL_RE = /([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
const TOKEN_RE = /\b[A-Za-z0-9_-]{20,}\b/g; // heuristic for API keys/tokens
const LONG_DIGITS_RE = /\b\d{16,}\b/g; // 16+ digits (credit-card-ish)

export function redact(text: string, opts: RedactionOptions = { emails: true, tokens: true, longDigits: true }): string {
  let t = text;
  if (opts.emails !== false) t = t.replace(EMAIL_RE, "***@***");
  if (opts.tokens !== false) t = t.replace(TOKEN_RE, "[REDACTED_TOKEN]");
  if (opts.longDigits !== false) t = t.replace(LONG_DIGITS_RE, (m) => "[REDACTED_" + m.length + "D]");
  return t;
}
