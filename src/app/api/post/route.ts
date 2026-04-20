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
    const sources = profile.sources ?? [];
    const goalLine = goals.length
      ? `\n- Goals to serve: ${goals.join(", ")}. If a soft CTA fits the post, add one (e.g. "taking on 1–2 projects this month", "happy to DM about it"). Never pitch. Never sound like a sales page.`
      : "";
    const sourceLine = sources.length
      ? `\n\nSource material you can draw specifics from:\n${sources
          .slice(-3)
          .map((s) => `- ${s.title} (${s.url})\n  ${s.summary}\n  Key points: ${s.keyPoints.slice(0, 6).join("; ")}`)
          .join("\n")}`
      : "";

    const { object } = await generateObject({
      model,
      schema: PostSchema,
      system: `You are ghostwriting a LinkedIn post in first-person for a working practitioner. It must sound like a tired, opinionated human typed it — not a content marketer, not ChatGPT, not a hype man.

VOICE
- First person. Contractions. Sentence fragments allowed. Vary sentence length aggressively — one short line next to a longer one.
- Concrete over abstract. Name the tool. Name the number. Name the specific mistake. If you can't be specific, cut the line.
- Opinions, not observations. Say the thing most people won't.
- Dry humor and self-deprecation beat enthusiasm.
- No emojis unless absolutely character-defining.

HARD BANS (do not use these words or phrases, they scream AI):
elevate, leverage, unlock, harness, empower, robust, seamless, cutting-edge, game-changer, game-changing, revolutionize, in today's world, in today's fast-paced, in the ever-evolving, dive in, dive into, delve, delve into, journey, ecosystem, landscape, paradigm, synergy, best-in-class, thrilled to, excited to, humbled to, it's no secret, at the end of the day, moving forward, leverage synergies, holistic, streamline, transform, transformation, redefine, pivotal, pivotal role, a testament to, Let's unpack, tl;dr.
Also banned: opening with the word "Ever", "In the world of", "When it comes to", "Fun fact", or any rhetorical question that feels focus-grouped.

STRUCTURE
- Open with a line that sounds like something you'd actually say. Short. No setup.
- Body: 120-220 words. Short paragraphs (1-3 lines max). Use line breaks liberally.
- Pull from supplied source material when relevant — quote numbers, name tools, reference specifics.
- End with one sharp line. A real question, a confession, or a soft invitation. Not "What are your thoughts?".

${wantsHashtags ? "- 3-7 hashtags, lowercase, specific — prefer niche tags over generic ones." : "- Return an empty hashtags array."}
${wantsImage ? "- Provide a concrete image prompt tied to the post." : "- Return an empty imagePrompt string."}${goalLine}`,
      prompt: `Write the post for this idea:\n${JSON.stringify(idea, null, 2)}\n\nRecurring themes I care about: ${profile.tone.themes.join(", ")}${sourceLine}`,
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
