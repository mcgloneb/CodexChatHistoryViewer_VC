import { NextRequest } from "next/server";
import { z } from "zod";
import { resolveSafePath } from "@/lib/server/path";
import fs from "node:fs";
import path from "node:path";

const QuerySchema = z.object({
  path: z.string(),
});

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({ path: url.searchParams.get("path") });
  if (!parsed.success) {
    return new Response("Invalid query", { status: 400 });
  }

  try {
    const safePath = resolveSafePath(parsed.data.path);
    const ext = path.extname(safePath).toLowerCase();
    if (ext !== ".jsonl" && ext !== ".json") {
      return new Response("Unsupported file type", { status: 415 });
    }

    await fs.promises.access(safePath, fs.constants.R_OK);

    const stream = fs.createReadStream(safePath, { encoding: "utf8" });
    const body = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk: string | Buffer) => {
          if (typeof chunk === "string") controller.enqueue(new TextEncoder().encode(chunk));
          else controller.enqueue(new Uint8Array(chunk));
        });
        stream.on("end", () => controller.close());
        stream.on("error", (err) => controller.error(err));
      },
      cancel() {
        stream.close();
      },
    });

    return new Response(body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unable to stream file";
    return new Response(message, { status: 400 });
  }
}
