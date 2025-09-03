"use client";
import { useCallback, useRef, useState } from "react";

type Props = {
  onFile: (file: File) => void;
};

export default function UploadDrop({ onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  }, [onFile]);

  const onBrowse = useCallback(() => inputRef.current?.click(), []);

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  }, [onFile]);

  return (
    <div
      role="region"
      aria-label="Upload conversation log"
      tabIndex={0}
      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer outline-none ${dragOver ? "bg-gray-100/60 dark:bg-white/5" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      onClick={onBrowse}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onBrowse(); }}
    >
      <p className="text-sm text-gray-600 dark:text-gray-300">Drag & drop a .jsonl or .json file here</p>
      <p className="text-xs text-gray-500 mt-1">or click to choose</p>
      <input
        ref={inputRef}
        type="file"
        accept=".json,.jsonl,application/json,text/plain"
        className="hidden"
        onChange={onChange}
      />
    </div>
  );
}

