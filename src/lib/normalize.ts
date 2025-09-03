export type Role = "user" | "assistant" | "system";

export type NormalizedEvent =
  | { type: "user"; ts: number; text: string }
  | { type: "assistant"; ts: number; text: string }
  | { type: "system"; ts: number; text: string }
  | { type: "tool_call"; ts: number; name: string; args: unknown }
  | { type: "tool_result"; ts: number; name: string; output: unknown }
  | { type: "meta"; ts: number; kind: "reasoning_summary" | "info"; summary?: string; data?: unknown };

/** Convert various record shapes into a NormalizedEvent, or undefined to skip. */
export function normalizeRecord(record: unknown, _lineNum: number): NormalizedEvent | undefined {
  const r = (record ?? {}) as Record<string, unknown>;
  const ts = pickTimestamp(record) ?? Date.now();

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
    const content = coerceContent((message?.["content"] as unknown) ?? r["content"]);
    if (typeof content === "string" && content.length > 0) {
      return { type: role, ts, text: content } as NormalizedEvent;
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

function coerceContent(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join("\n");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
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
