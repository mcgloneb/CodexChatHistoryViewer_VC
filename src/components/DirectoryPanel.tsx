"use client";
import { useEffect, useState } from "react";
import UploadDrop from "@/components/UploadDrop";

type Entry = { name: string; type: "file" | "dir"; size: number; mtime: number };

type Props = {
  onOpenFile: (relPath: string, file: Entry) => void;
  onUploadFile?: (file: File) => void;
};

type DirState = {
  path: string; // "/"-prefixed path relative to data dir
  entries: Entry[];
};

export default function DirectoryPanel({ onOpenFile, onUploadFile }: Props) {
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
      <div className="flex-1 overflow-auto text-sm">
        {dir?.entries?.length ? (
          <ul>
            {dir.entries.map((e) => (
              <li key={e.name} className="px-2 py-1 border-b hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer" onClick={() => {
                if (e.type === "dir") setStack((s) => s.concat([`${stack[stack.length - 1] === "/" ? "" : stack[stack.length - 1]}/${e.name}`]));
                else onOpenFile(`${stack[stack.length - 1] === "/" ? "" : stack[stack.length - 1]}/${e.name}`, e);
              }}>
                <span className="mr-2">{e.type === "dir" ? "📁" : "📄"}</span>
                <span>{e.name}</span>
                {e.type === "file" ? <span className="ml-2 text-xs text-gray-500">{(e.size / 1024).toFixed(1)} KB</span> : null}
              </li>
            ))}
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
