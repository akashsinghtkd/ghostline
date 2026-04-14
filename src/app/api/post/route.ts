import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";
import { resolveProvider, textModelFor } from "@/lib/ai";
import { storage } from "@/lib/storage";
import { uid } from "@/lib/utils";
import type { GeneratedPost, PostFormat } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  ideaId: z.string(),
  format: z.enum(["text", "text-with-hashtags", "text-with-image"]),
  provider: z.enum(["openai", "gemini"]).optional(),
});

const PostSchema = z.object({
  content: z.string().describe("The full LinkedIn post body, ready to publish, with line breaks."),
  hashtags: z.array(z.string()).describe("3-7 relevant hashtags without the # prefix."),
  imagePrompt: z.string().describe("If an image accompanies this post, a vivid prompt for it. Empty string otherwise."),
});

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    const idea = await storage.getIdea(body.ideaId);
    if (!idea) return NextResponse.json({ error: "Idea not found" }, { status: 404 });
    const profile = await storage.getProfile(idea.profileId);
    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    const provider = resolveProvider(body.provider);
    const model = textModelFor(provider);
    const wantsHashtags = body.format !== "text";
    const wantsImage = body.format === "text-with-image";
    const goals = profile.goals ?? [];
    const goalLine = goals.length
      ? `\n- Serve these author goals: ${goals.join(", ")}. Weave goal intent into the close (e.g. soft CTA for freelance leads, invitation to DM, "currently taking 1-2 projects", or question that invites saves/shares) — never read as a sales pitch.`
      : "";

    const { object } = await generateObject({
      model,
      schema: PostSchema,
      system: `You are ${profile.name}'s LinkedIn ghostwriter. Write in their voice: ${profile.tone.voice}. Formality: ${profile.tone.formality}. Industry: ${profile.tone.industry}. Audience: ${profile.tone.audience}.
Rules:
- Open with the supplied hook (rephrase only if it improves flow).
- 120-220 words. Short paragraphs, white space, scannable.
- No emojis unless the voice clearly uses them. No "I'm excited to share".
- ${wantsHashtags ? "Include 3-7 specific hashtags." : "Return an empty hashtags array."}
- ${wantsImage ? "Provide a vivid image prompt aligned with the post." : "Return an empty imagePrompt string."}${goalLine}`,
      prompt: `Idea:\n${JSON.stringify(idea, null, 2)}\n\nWriter's recurring themes: ${profile.tone.themes.join(", ")}`,
    });

    const post: GeneratedPost = {
      id: uid("post"),
      profileId: profile.id,
      ideaId: idea.id,
      idea,
      format: body.format as PostFormat,
      content: object.content,
      hashtags: wantsHashtags ? object.hashtags : [],
      imagePrompt: wantsImage ? object.imagePrompt : undefined,
      provider,
      createdAt: new Date().toISOString(),
    };
    await storage.addPost(post);
    return NextResponse.json({ post });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate post";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
