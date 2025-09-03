"use client";
import { useState } from "react";
import DirectoryPanel from "@/components/DirectoryPanel";
import Viewer from "@/components/Viewer";
import { useStreamParse } from "@/hooks/useStreamParse";

type Selected =
  | { kind: "fs"; relPath: string; name: string; size: number }
  | { kind: "upload"; file: File };

export default function Home() {
  const [selected, setSelected] = useState<Selected | null>(null);
  const parser = useStreamParse();

  function openFsFile(relPath: string, file: { name: string; size: number }) {
    setSelected({ kind: "fs", relPath, name: file.name, size: file.size });
    const url = `/api/fs/stream?path=${encodeURIComponent(relPath)}`;
    parser.startFromUrl(url);
  }

  return (
    <div className="min-h-screen grid" style={{ gridTemplateColumns: "320px 1fr" }}>
      <aside className="border-r overflow-y-auto">
        <DirectoryPanel
          onOpenFile={(relPath, f) => {
            if (relPath.startsWith("upload:")) {
              // Ignore; actual upload parsing happens via onUploadFile
            } else {
              openFsFile(relPath, f);
            }
          }}
          onUploadFile={(file) => {
            setSelected({ kind: "upload", file });
            parser.startFromFile(file);
          }}
          selectedPath={selected?.kind === "fs" ? selected.relPath : undefined}
        />
      </aside>
      <main className="min-h-screen flex flex-col">
        <div className="px-3 py-2 border-b text-sm">Conversation Log Reader</div>
        <div className="flex-1 grid" style={{ gridTemplateRows: "auto 1fr" }}>
          <div className="p-2 text-xs text-gray-600">
            {selected?.kind === "fs" ? (
              <span>
                Opened from data folder: <span className="font-mono">{selected.name}</span>
              </span>
            ) : selected?.kind === "upload" ? (
              <span>
                Uploaded file: <span className="font-mono">{selected.file.name}</span>
              </span>
            ) : (
              <span>Select a file from the left, or upload one.</span>
            )}
          </div>
          <Viewer
            fileLabel={selected?.kind === "fs" ? selected.name : selected?.kind === "upload" ? selected.file.name : null}
            events={parser.events}
            progress={parser.progress}
            errors={parser.errors}
            errorSamples={parser.errorSamples}
          />
        </div>
        <div className="p-2 border-t text-xs">
          Tip: Redaction hides emails, tokens, and long numbers. Toggle in the header.
        </div>
      </main>
    </div>
  );
}
