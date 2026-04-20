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

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const ok = await storage.deleteIdea(id);
  if (!ok) return NextResponse.json({ error: "Idea not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
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
    const sources = profile.sources ?? [];

    const focusBlock = focusTags.length
      ? `\n\nTopics the author wants to post about: ${focusTags.join(", ")}`
      : "";
    const formatBlock = ideaFormats.length
      ? `\n\nPreferred idea formats: ${ideaFormats.join(", ")}. Map contentType to the closest of: story, insight, how-to, opinion, listicle, case-study.`
      : "";
    const goalBlock = goals.length
      ? `\n\nAuthor's goals (every idea should advance at least one): ${goals.join(", ")}.`
      : "";
    const sourceBlock = sources.length
      ? `\n\nSource material the author wants ideas drawn from:\n${sources
          .slice(-5)
          .map(
            (s, idx) =>
              `[${idx + 1}] ${s.title} — ${s.url}\n  Summary: ${s.summary}\n  Key points: ${s.keyPoints.join("; ")}`,
          )
          .join("\n")}`
      : "";

    const { object } = await generateObject({
      model,
      schema: IdeasSchema,
      system: `You are a ghostwriter who thinks in first-person for a working practitioner. Generate ${count} LinkedIn post ideas that sound like a tired developer typing at 11pm — specific, opinionated, lived-in. Not a thought-leader spouting frameworks.

Voice rules (strict):
- Write hooks like a human would say them out loud, not like a marketer. Contractions allowed. Sentence fragments allowed.
- No AI-tells: no "elevate", "leverage", "unlock", "dive into", "in today's world", "game-changer", "seamless", "robust", "journey", "empower", "harness the power", "revolutionize", "cutting-edge", em-dashes in hooks.
- Every idea must carry a specific, concrete artifact: a real number, a named tool, a visible mistake, a pull-quote you can imagine a human actually saying.
- Vary rhythm across the ${count} ideas — mix short punchy hooks with longer confessional ones.
- If source material is supplied, ground at least half the ideas in specifics from that source (quote numbers, name the thing, reference an example).

Engagement estimate should be realistic for a small-to-medium account (mostly 30-70, occasional 80+).`,
      prompt: `Author context:\n${JSON.stringify(
        {
          headline: profile.headline,
          tone: profile.tone,
        },
        null,
        2,
      )}${focusBlock}${formatBlock}${goalBlock}${sourceBlock}`,
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
