import { NextResponse } from "next/server";
import { generateImage } from "ai";
import { z } from "zod";
import { promises as fs } from "node:fs";
import path from "node:path";
import { imageModelFor, resolveProvider } from "@/lib/ai";
import { storage } from "@/lib/storage";
import { uid } from "@/lib/utils";
import type { ImageStyle } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  postId: z.string(),
  style: z.enum(["professional", "casual", "minimalist", "infographic"]),
  provider: z.enum(["openai", "gemini"]).optional(),
});

const STYLE_DIRECTIVES: Record<ImageStyle, string> = {
  professional: "polished corporate photography, neutral palette, soft natural light, depth of field",
  casual: "warm candid photography, vibrant grounded colors, natural composition",
  minimalist: "minimalist editorial illustration, generous negative space, two-tone palette, geometric",
  infographic: "clean infographic with bold typography, icons, numbered callouts, flat vector style",
};

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    const posts = await storage.listPosts();
    const post = posts.find((p) => p.id === body.postId);
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    const provider = resolveProvider(body.provider);
    const model = imageModelFor(provider);
    const basePrompt = post.imagePrompt?.trim() || `LinkedIn-ready visual for: ${post.idea.title}`;
    const fullPrompt = `${basePrompt}. Style: ${STYLE_DIRECTIVES[body.style]}. Square 1024x1024, no text overlays, no watermarks, no logos.`;

    const result = await generateImage({
      model,
      prompt: fullPrompt,
      size: "1024x1024",
    });

    const image = result.image;
    if (!image?.uint8Array && !image?.base64) {
      return NextResponse.json({ error: "Image model returned no image" }, { status: 502 });
    }

    const dir = path.join(process.cwd(), "public", "generated");
    await fs.mkdir(dir, { recursive: true });
    const filename = `${uid("img")}.png`;
    const buf = image.uint8Array
      ? Buffer.from(image.uint8Array)
      : Buffer.from(image.base64, "base64");
    await fs.writeFile(path.join(dir, filename), buf);
    const imageUrl = `/generated/${filename}`;

    const updated = await storage.updatePost(post.id, {
      imageUrl,
      imageStyle: body.style,
      imagePrompt: fullPrompt,
    });
    return NextResponse.json({ post: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate image";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
