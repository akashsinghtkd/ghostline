import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";
import { resolveProvider, textModelFor } from "@/lib/ai";
import { storage } from "@/lib/storage";
import { uid } from "@/lib/utils";
import type { LinkedInProfile, Source } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  url: z.string().url(),
  profileId: z.string(),
  provider: z.enum(["openai", "gemini"]).optional(),
});

const AnalysisSchema = z.object({
  title: z.string().describe("A short title for this source (the page headline)."),
  summary: z.string().describe("A 2-4 sentence summary in plain human language."),
  keyPoints: z.array(z.string()).describe("5-10 concrete takeaways as short phrases."),
  topics: z
    .array(z.string())
    .describe("3-8 topic tags — what a LinkedIn post inspired by this page would be about."),
});

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    const profile = await storage.getProfile(body.profileId);
    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    let html = "";
    try {
      const res = await fetch(body.url, {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          accept: "text/html,application/xhtml+xml",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`Fetch ${res.status}`);
      html = await res.text();
    } catch (e) {
      return NextResponse.json(
        { error: `Couldn't fetch the URL: ${e instanceof Error ? e.message : "unknown"}` },
        { status: 400 },
      );
    }

    const text = stripHtml(html).slice(0, 14_000);
    if (text.length < 200) {
      return NextResponse.json({ error: "Page contents look empty or blocked" }, { status: 400 });
    }

    const provider = resolveProvider(body.provider);
    const model = textModelFor(provider);
    const { object } = await generateObject({
      model,
      schema: AnalysisSchema,
      system:
        "You extract the substance of a web page so another system can write a LinkedIn post about it. Use plain human language. No marketing fluff. Key points should be specific and concrete.",
      prompt: `Source URL: ${body.url}\n\nPage text (truncated):\n${text}`,
    });

    const source: Source = {
      id: uid("src"),
      url: body.url,
      title: object.title,
      summary: object.summary,
      keyPoints: object.keyPoints,
      topics: object.topics,
      fetchedAt: new Date().toISOString(),
    };

    const mergedTopics = Array.from(
      new Set([...(profile.focusTags ?? []), ...object.topics.map((t) => t.trim())].filter(Boolean)),
    );

    const updated: LinkedInProfile = {
      ...profile,
      focusTags: mergedTopics,
      sources: [...(profile.sources ?? []), source],
      updatedAt: new Date().toISOString(),
    };
    await storage.upsertProfile(updated);
    return NextResponse.json({ profile: updated, source });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to analyze URL";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

const DeleteBody = z.object({ profileId: z.string(), sourceId: z.string() });

export async function DELETE(req: Request) {
  try {
    const body = DeleteBody.parse(await req.json());
    const profile = await storage.getProfile(body.profileId);
    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    const sources = (profile.sources ?? []).filter((s) => s.id !== body.sourceId);
    const updated: LinkedInProfile = {
      ...profile,
      sources,
      updatedAt: new Date().toISOString(),
    };
    await storage.upsertProfile(updated);
    return NextResponse.json({ profile: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to remove source";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
