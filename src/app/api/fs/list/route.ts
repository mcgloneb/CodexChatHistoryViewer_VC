import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import path from "node:path";
import { dataDir, resolveSafePath, toRelativeFromDataDir } from "@/lib/server/path";
import { listDir, sortEntries } from "@/lib/server/fs";

const QuerySchema = z.object({
  path: z.string().optional(),
  sort: z.enum(["name", "date"]).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      path: url.searchParams.get("path") || undefined,
      sort: (url.searchParams.get("sort")) || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query" }, { status: 400 });
    }

    const { path: relPath, sort } = parsed.data;
    const safePath = resolveSafePath(relPath);

    const base = dataDir();
    // Ensure base exists
    // If base doesn't exist, return a 503 so client can fallback to upload
    try {
      await listDir(base);
    } catch {
      return NextResponse.json({ error: "Data directory unavailable" }, { status: 503 });
    }

    // If target is a file, list its directory instead (or respond with error?)
    const contents = await listDir(safePath);

    // Filter to only directories and .json/.jsonl files
    const filtered = contents.filter((e) =>
      e.type === "dir" || [".json", ".jsonl"].includes(path.extname(e.name).toLowerCase())
    );

    const sorted = sortEntries(filtered, sort);

    return NextResponse.json({
      path: toRelativeFromDataDir(safePath),
      entries: sorted,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
