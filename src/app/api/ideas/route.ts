import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";
import { resolveProvider, textModelFor } from "@/lib/ai";
import { storage } from "@/lib/storage";
import { uid } from "@/lib/utils";
import type { PostIdea } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  profileId: z.string(),
  count: z.number().min(1).max(10).optional(),
  provider: z.enum(["openai", "gemini"]).optional(),
});

const IdeasSchema = z.object({
  ideas: z.array(
    z.object({
      title: z.string(),
      hook: z.string(),
      angle: z.string(),
      contentType: z.enum(["story", "insight", "how-to", "opinion", "listicle", "case-study"]),
      targetAudience: z.string(),
      estimatedEngagement: z.number().min(0).max(100),
      reasoning: z.string(),
    }),
  ),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const profileId = searchParams.get("profileId") ?? undefined;
  const ideas = await storage.listIdeas(profileId);
  return NextResponse.json({ ideas });
}

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    const profile = await storage.getProfile(body.profileId);
    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    const provider = resolveProvider(body.provider);
    const model = textModelFor(provider);
    const count = body.count ?? 6;

    const focusTags = profile.focusTags ?? [];
    const ideaFormats = profile.ideaFormats ?? [];
    const goals = profile.goals ?? [];
    const focusBlock = focusTags.length
      ? `\n\nFocus tags (REQUIRED — every idea must clearly relate to at least one): ${focusTags.join(", ")}`
      : "";
    const formatBlock = ideaFormats.length
      ? `\n\nPreferred idea formats (distribute across the set): ${ideaFormats.join(", ")}. Map each idea's contentType field to the closest of: story, insight, how-to, opinion, listicle, case-study.`
      : "";
    const goalBlock = goals.length
      ? `\n\nUser's goals (EVERY idea must advance at least one): ${goals.join(", ")}. For each idea, 'reasoning' should explicitly name which goal(s) it serves and how.`
      : "";

    const directives = [
      focusTags.length
        ? "Anchor every idea to the user's focus tags — these define the niche they want to build in."
        : null,
      ideaFormats.length
        ? "Match the user's preferred idea formats — e.g. problem-solving pieces, user stories, comparisons, how-tos, contrarian takes."
        : null,
      goals.length
        ? "Treat the user's goals as non-negotiable: e.g. if attracting freelance clients, demonstrate tangible outcomes (revenue lifted, hours saved, bugs squashed), signal availability, and surface proof of craft; if growing reach, favor high-save / high-share formats (frameworks, contrarian takes, behind-the-scenes) that non-followers will repost."
        : null,
    ].filter(Boolean);

    const { object } = await generateObject({
      model,
      schema: IdeasSchema,
      system: `You are a senior LinkedIn content strategist. Generate ${count} distinct, scroll-stopping post ideas tailored to the user's voice, industry, and audience.
Hooks must be one or two punchy lines that earn the click. Vary content types. Estimate engagement realistically (0-100) using the user's likely reach signals.${
        directives.length ? " " + directives.join(" ") : ""
      }`,
      prompt: `Profile JSON:\n${JSON.stringify(
        {
          name: profile.name,
          headline: profile.headline,
          about: profile.about,
          experience: profile.experience.slice(0, 5),
          skills: profile.skills.slice(0, 20),
          tone: profile.tone,
        },
        null,
        2,
      )}${focusBlock}${formatBlock}${goalBlock}`,
    });

    const now = new Date().toISOString();
    const ideas: PostIdea[] = object.ideas.map((i) => ({
      ...i,
      id: uid("idea"),
      profileId: profile.id,
      createdAt: now,
    }));
    await storage.addIdeas(ideas);
    return NextResponse.json({ ideas, provider });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate ideas";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
