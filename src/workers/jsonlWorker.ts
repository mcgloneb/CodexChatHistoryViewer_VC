import { normalizeRecord, type NormalizedEvent } from "@/lib/normalize";

type MsgParseUrl = { type: "parse-url"; url: string };
type MsgParseFile = { type: "parse-file"; file: File };
type InMsg = MsgParseUrl | MsgParseFile;

type OutBatch = { type: "batch"; events: NormalizedEvent[] };
type OutProgress = { type: "progress"; read: number; total?: number };
type OutDone = { type: "done"; errors: number; samples: Array<{ line: number; error: string }> };
type OutErr = { type: "error"; message: string };

const BATCH_SIZE = 200;
const BATCH_MS = 50;

let batch: NormalizedEvent[] = [];
let batchTimer: number | undefined;
let errors = 0;
let errorSamples: Array<{ line: number; error: string }> = [];
let bytesRead = 0;

function flush() {
  if (batch.length > 0) {
    const payload: OutBatch = { type: "batch", events: batch };
    postMessage(payload);
    batch = [];
  }
}

function enqueue(ev: NormalizedEvent) {
  batch.push(ev);
  if (batch.length >= BATCH_SIZE) flush();
  if (batchTimer == null) {
    batchTimer = setTimeout(() => {
      flush();
      batchTimer = undefined;
    }, BATCH_MS) as unknown as number;
  }
}

async function parseStream(stream: ReadableStream<Uint8Array>, total?: number) {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");
  let { value, done } = await reader.read();
  let buf = "";
  let lineNum = 0;
  while (!done) {
    bytesRead += value?.byteLength || 0;
    postMessage({ type: "progress", read: bytesRead, total } satisfies OutProgress);

    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      lineNum++;
      if (!line.trim()) continue;
      try {
        const rec = JSON.parse(line);
        const norm = normalizeRecord(rec, lineNum);
        if (norm) enqueue(norm);
      } catch (e: unknown) {
        errors++;
        const msg = e instanceof Error ? e.message : String(e);
        if (errorSamples.length < 5) errorSamples.push({ line: lineNum, error: msg });
      }
    }
    ({ value, done } = await reader.read());
  }
  // tail
  if (buf.trim()) {
    lineNum++;
    try {
      const rec = JSON.parse(buf);
      const norm = normalizeRecord(rec, lineNum);
      if (norm) enqueue(norm);
    } catch (e: unknown) {
      errors++;
      const msg = e instanceof Error ? e.message : String(e);
      if (errorSamples.length < 5) errorSamples.push({ line: lineNum, error: msg });
    }
  }
  flush();
  postMessage({ type: "done", errors, samples: errorSamples } satisfies OutDone);
}

async function parseJsonArray(text: string) {
  let arr: unknown[] = [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) arr = parsed;
  } catch (e: unknown) {
    // If not an array, try single object
    try {
      const obj = JSON.parse(text);
      arr = [obj];
    } catch (_err) {
      // emit error and return
      postMessage({ type: "error", message: "Invalid JSON content" } satisfies OutErr);
      postMessage({ type: "done", errors: 1, samples: [{ line: 1, error: "Invalid JSON content" }] } satisfies OutDone);
      return;
    }
  }

  arr.forEach((rec, i) => {
    const norm = normalizeRecord(rec, i + 1);
    if (norm) enqueue(norm);
  });
  flush();
  postMessage({ type: "done", errors, samples: errorSamples } satisfies OutDone);
}

self.onmessage = async (e: MessageEvent<InMsg>) => {
  const msg = e.data;
  try {
    bytesRead = 0;
    errors = 0;
    errorSamples = [];
    if (msg.type === "parse-url") {
      const res = await fetch(msg.url);
      const total = Number(res.headers.get("content-length") || "0") || undefined;
      const contentType = res.headers.get("content-type") || "";
      const isText = contentType.includes("text/plain");
      // Heuristic: if response starts with '[' (JSON array), fallback to array parse
      if (isText && res.body) {
        // Peek first few bytes to decide JSONL vs JSON array
        const reader = res.body.getReader();
        const { value } = await reader.read();
        if (!value) {
          // empty
          postMessage({ type: "done", errors: 0, samples: [] } satisfies OutDone);
          return;
        }
        const dec = new TextDecoder("utf-8");
        const head = dec.decode(value);
        // no need to keep a peeked stream reference; we'll refetch as needed
        if (head.trimStart().startsWith("[")) {
          // Need full text; refetch as text
          const text = head + (await (await fetch(msg.url)).text());
          await parseJsonArray(text);
        } else {
          // JSONL stream: parse combined stream of head+rest of body (we used value already)
          // But above we closed rest after enqueuing first chunk; we need combine with remaining
          // Simpler: refetch to get full stream
          const res2 = await fetch(msg.url);
          if (!res2.body) throw new Error("No body");
          await parseStream(res2.body, total);
        }
      } else {
        throw new Error("Invalid stream");
      }
    } else if (msg.type === "parse-file") {
      const ext = msg.file.name.toLowerCase();
      if (ext.endsWith(".json")) {
        const text = await msg.file.text();
        await parseJsonArray(text);
      } else {
        const stream = msg.file.stream();
        await parseStream(stream as ReadableStream<Uint8Array>, msg.file.size);
      }
    }
  } catch (err: unknown) {
    postMessage({ type: "error", message: err instanceof Error ? err.message : String(err) } satisfies OutErr);
  } finally {
    flush();
  }
};
