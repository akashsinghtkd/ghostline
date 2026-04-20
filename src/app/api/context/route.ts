import { NextResponse } from "next/server";
import { z } from "zod";
import { storage } from "@/lib/storage";
import type { LinkedInProfile } from "@/lib/types";

export const runtime = "nodejs";

const CONTEXT_ID = "ctx_default";

const Body = z.object({
  focusTags: z.array(z.string().min(1).max(60)).max(20).default([]),
  ideaFormats: z.array(z.string().min(1).max(60)).max(20).default([]),
  goals: z.array(z.string().min(1).max(60)).max(10).default([]),
});

function synthesize(
  focusTags: string[],
  ideaFormats: string[],
  goals: string[] = [],
): LinkedInProfile {
  const primary = focusTags[0] ?? "Professional";
  const now = new Date().toISOString();
  return {
    id: CONTEXT_ID,
    url: "local://ghostline",
    name: "Your context",
    headline: focusTags.length ? focusTags.join(" · ") : "Untitled context",
    about: focusTags.length
      ? `A practitioner focused on ${focusTags.join(", ")}. Writes to share what works, what doesn't, and the craft behind the decisions.`
      : "An anonymous LinkedIn author.",
    experience: [],
    education: [],
    skills: focusTags,
    activity: [],
    focusTags,
    ideaFormats,
    goals,
    sources: [],
    tone: {
      voice:
        "Direct, opinionated practitioner — concrete examples over jargon, short paragraphs, first-person",
      formality: "balanced",
      themes: focusTags,
      audience: focusTags.length
        ? `peers and aspiring professionals in ${focusTags.join(" / ")}`
        : "knowledge workers",
      industry: primary,
    },
    createdAt: now,
    updatedAt: now,
  };
}

export async function GET() {
  const existing = await storage.getProfile(CONTEXT_ID);
  const profile = existing ?? (await storage.upsertProfile(synthesize([], [], [])));
  return NextResponse.json({ profile });
}

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    const focusTags = Array.from(new Set(body.focusTags.map((t) => t.trim()).filter(Boolean)));
    const ideaFormats = Array.from(new Set(body.ideaFormats.map((t) => t.trim()).filter(Boolean)));
    const goals = Array.from(new Set(body.goals.map((t) => t.trim()).filter(Boolean)));
    const existing = await storage.getProfile(CONTEXT_ID);
    const base = existing ?? synthesize(focusTags, ideaFormats, goals);
    const updated: LinkedInProfile = {
      ...base,
      focusTags,
      ideaFormats,
      goals,
      headline: focusTags.length ? focusTags.join(" · ") : base.headline,
      skills: focusTags,
      tone: {
        ...base.tone,
        themes: focusTags,
        audience: focusTags.length
          ? `peers and aspiring professionals in ${focusTags.join(" / ")}`
          : base.tone.audience,
        industry: focusTags[0] ?? base.tone.industry,
      },
      updatedAt: new Date().toISOString(),
    };
    await storage.upsertProfile(updated);
    return NextResponse.json({ profile: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update context";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
