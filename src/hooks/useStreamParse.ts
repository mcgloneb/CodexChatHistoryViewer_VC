"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import type { NormalizedEvent } from "@/lib/normalize";

type Status = "idle" | "loading" | "done" | "error";

export function useStreamParse() {
  const workerRef = useRef<Worker | null>(null);
  const [events, setEvents] = useState<NormalizedEvent[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState(0);
  const [errorSamples, setErrorSamples] = useState<Array<{ line: number; error: string }>>([]);
  const [progress, setProgress] = useState<{ read: number; total?: number }>({ read: 0 });

  const ensureWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const w = new Worker(new URL("../workers/jsonlWorker.ts", import.meta.url));
    w.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg?.type === "batch") {
        setEvents((prev) => prev.concat(msg.events));
      } else if (msg?.type === "progress") {
        setProgress({ read: msg.read, total: msg.total });
        setStatus("loading");
      } else if (msg?.type === "done") {
        setErrors(msg.errors || 0);
        setErrorSamples(msg.samples || []);
        setStatus("done");
      } else if (msg?.type === "error") {
        setStatus("error");
      }
    };
    workerRef.current = w;
    return w;
  }, []);

  const reset = useCallback(() => {
    setEvents([]);
    setErrors(0);
    setErrorSamples([]);
    setProgress({ read: 0 });
    setStatus("idle");
  }, []);

  const startFromUrl = useCallback((url: string) => {
    reset();
    setStatus("loading");
    const w = ensureWorker();
    w.postMessage({ type: "parse-url", url });
  }, [ensureWorker, reset]);

  const startFromFile = useCallback((file: File) => {
    reset();
    setStatus("loading");
    const w = ensureWorker();
    w.postMessage({ type: "parse-file", file });
  }, [ensureWorker, reset]);

  const api = useMemo(
    () => ({ events, status, errors, errorSamples, progress, startFromUrl, startFromFile, reset }),
    [events, status, errors, errorSamples, progress, startFromUrl, startFromFile, reset]
  );

  return api;
}

