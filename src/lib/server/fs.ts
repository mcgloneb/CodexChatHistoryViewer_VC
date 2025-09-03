import fs from "node:fs/promises";
import path from "node:path";

export type FsEntry = {
  name: string;
  type: "file" | "dir";
  size: number;
  mtime: number; // epoch ms
};

/** List directory contents with basic metadata. */
export async function listDir(absPath: string): Promise<FsEntry[]> {
  const entries = await fs.readdir(absPath, { withFileTypes: true });
  const results: FsEntry[] = [];

  for (const dirent of entries) {
    // Exclude dotfiles/hidden by default; allow .json/.jsonl files through later in API
    if (dirent.name.startsWith(".")) continue;

    const full = path.join(absPath, dirent.name);
    try {
      const stat = await fs.stat(full);
      results.push({
        name: dirent.name,
        type: dirent.isDirectory() ? "dir" : "file",
        size: dirent.isDirectory() ? 0 : stat.size,
        mtime: stat.mtimeMs,
      });
    } catch {
      // Skip entries that error (e.g., permission issues)
    }
  }
  return results;
}

export type SortKey = "name" | "date";

export function sortEntries(entries: FsEntry[], key: SortKey = "name"): FsEntry[] {
  const sorted = [...entries];
  if (key === "name") {
    sorted.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    sorted.sort((a, b) => b.mtime - a.mtime);
  }
  // Keep directories before files for better UX
  sorted.sort((a, b) => (a.type === b.type ? 0 : a.type === "dir" ? -1 : 1));
  return sorted;
}

