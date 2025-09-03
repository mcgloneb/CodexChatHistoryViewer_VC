import path from "node:path";

/**
 * Returns the absolute path to the configured data directory.
 * Defaults to ./data/logs relative to project root.
 */
export function dataDir(): string {
  const p = process.env.DATA_DIR || "./data/logs";
  return path.resolve(process.cwd(), p);
}

/**
 * Resolve a client-provided path safely within the dataDir.
 * - `"/"` or empty means the root of dataDir
 * - Throws on path traversal or attempts to escape the dataDir
 */
export function resolveSafePath(rel: string | undefined): string {
  const base = dataDir();
  // Treat "/" or undefined as root of dataDir
  const sanitized = !rel || rel === "/" ? "" : rel.replace(/^\/+/, "");
  const target = path.resolve(base, sanitized);

  // Ensure target is within base (prevents traversal)
  const baseWithSep = base.endsWith(path.sep) ? base : base + path.sep;
  if (target !== base && !target.startsWith(baseWithSep)) {
    throw new Error("Path traversal detected or outside configured data directory");
  }

  return target;
}

/**
 * Returns a path relative to the dataDir, for UI display and API params.
 */
export function toRelativeFromDataDir(absPath: string): string {
  const base = dataDir();
  const rel = path.relative(base, absPath);
  return rel === "" ? "/" : `/${rel.split(path.sep).join("/")}`;
}

