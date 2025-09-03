"use client";
import { useEffect, useMemo, useState } from "react";
import UploadDrop from "@/components/UploadDrop";

type Entry = { name: string; type: "file" | "dir"; size: number; mtime: number };

type Props = {
  onOpenFile: (relPath: string, file: Entry) => void;
  onUploadFile?: (file: File) => void;
  selectedPath?: string | null;
};

type DirState = {
  path: string; // "/"-prefixed path relative to data dir
  entries: Entry[];
};

export default function DirectoryPanel({ onOpenFile, onUploadFile, selectedPath }: Props) {
  const [fsAvailable, setFsAvailable] = useState<boolean | null>(null);
  const [sort, setSort] = useState<"name" | "date">("name");
  const [stack, setStack] = useState<string[]>(["/"]); // breadcrumb stack
  const [dir, setDir] = useState<DirState | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function fetchDir(p: string) {
      try {
        const res = await fetch(`/api/fs/list?path=${encodeURIComponent(p)}&sort=${sort}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`${res.status}`);
        const json = await res.json();
        setDir({ path: json.path, entries: json.entries });
        setFsAvailable(true);
      } catch (e) {
        setFsAvailable(false);
      }
    }
    fetchDir(stack[stack.length - 1]);
    return () => controller.abort();
  }, [stack, sort]);

  const canUp = stack.length > 1;

  const selectedDir = useMemo(() => {
    if (!selectedPath) return null;
    const idx = selectedPath.lastIndexOf("/");
    if (idx <= 0) return "/";
    return selectedPath.slice(0, idx);
  }, [selectedPath]);

  function pathToStack(p: string): string[] {
    const norm = p.startsWith("/") ? p : "/" + p;
    if (norm === "/") return ["/"];
    const parts = norm.split("/").filter(Boolean);
    const st: string[] = ["/"];
    let acc = "";
    for (const part of parts) {
      acc += "/" + part;
      st.push(acc);
    }
    return st;
  }

  function gotoPath(p: string) {
    setStack(pathToStack(p));
  }

  function formatBytes(n: number) {
    if (!Number.isFinite(n)) return "0 B";
    const units = ["B", "KB", "MB", "GB"]; let i = 0; let v = n;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
  }

  if (fsAvailable === false) {
    return (
      <div className="p-3">
        <h2 className="font-semibold mb-2">Upload a conversation log</h2>
        <UploadDrop onFile={(file) => onUploadFile?.(file)} />
        <p className="text-xs text-gray-500 mt-2">Server filesystem unavailable. Using browser-only parsing.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 p-2 border-b">
        <button
          className="px-2 py-1 text-sm rounded border disabled:opacity-50"
          onClick={() => canUp && setStack((s) => s.slice(0, -1))}
          disabled={!canUp}
          aria-label="Go up"
        >
          ↑ Up
        </button>
        <div className="text-xs text-gray-600 truncate" title={stack[stack.length - 1]}> {stack[stack.length - 1]} </div>
        <div className="ml-auto text-xs">
          <label className="mr-1">Sort:</label>
          <select
            className="border rounded px-1 py-0.5 text-xs"
            value={sort}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "name" || v === "date") setSort(v);
            }}
            aria-label="Sort entries"
          >
            <option value="name">Name</option>
            <option value="date">Date</option>
          </select>
        </div>
      </div>
      {selectedDir ? (
        <div className="px-2 py-1 text-[11px] text-gray-700 dark:text-gray-300 border-b bg-gray-50 dark:bg-white/5 flex items-center gap-2" aria-label="Current file path">
          <span className="opacity-70">Current file:</span>
          <nav className="truncate">
            <button className="underline-offset-2 hover:underline" onClick={() => gotoPath("/")}>/</button>
            {selectedDir.split("/").filter(Boolean).map((seg, i, arr) => {
              const p = "/" + arr.slice(0, i + 1).join("/");
              return (
                <span key={p}>
                  <span className="px-1">/</span>
                  <button className="underline-offset-2 hover:underline" onClick={() => gotoPath(p)}>{seg}</button>
                </span>
              );
            })}
          </nav>
          <button className="ml-auto text-[11px] underline" onClick={() => gotoPath(selectedDir)}>Open folder</button>
        </div>
      ) : null}
      <div className="flex-1 overflow-y-auto overflow-x-hidden text-sm">
        {dir?.entries?.length ? (
          <ul role="list" aria-label="Files and folders">
            {dir.entries.map((e) => {
              const currentPath = stack[stack.length - 1];
              const itemPath = `${currentPath === "/" ? "" : currentPath}/${e.name}`;
              const isSelected = e.type === "file" && selectedPath === itemPath;
              return (
                <li
                  key={e.name}
                  className={
                    `px-2 py-1 border-b cursor-pointer ` +
                    (isSelected ? "bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500" : "hover:bg-gray-50 dark:hover:bg-white/5")
                  }
                  aria-selected={isSelected || undefined}
                  onClick={() => {
                    if (e.type === "dir") setStack((s) => s.concat([itemPath]));
                    else onOpenFile(itemPath, e);
                  }}
                  title={itemPath}
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5">{e.type === "dir" ? "📁" : "📄"}</span>
                    <div className="min-w-0 max-w-full">
                      <div className="leading-snug break-words" style={{ overflowWrap: 'anywhere' }}>{e.name}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        <span>{new Date(e.mtime).toLocaleString()}</span>
                        {e.type === "file" ? <span className="ml-2">{formatBytes(e.size)}</span> : null}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="p-3 text-xs text-gray-500">{fsAvailable === null ? "Loading..." : "Empty folder"}</div>
        )}
      </div>
      <div className="p-3 border-t">
        <h3 className="font-medium mb-1">Or upload a file</h3>
        <UploadDrop onFile={(file) => onUploadFile?.(file)} />
      </div>
    </div>
  );
}
