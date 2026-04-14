import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveProvider } from "@/lib/ai";
import { extractProfile } from "@/lib/profile-extractor";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  url: z.string().url(),
  rawText: z.string().optional(),
  provider: z.enum(["openai", "gemini"]).optional(),
  refresh: z.boolean().optional(),
});

export async function GET() {
  const profiles = await storage.listProfiles();
  return NextResponse.json({ profiles });
}

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    if (!body.refresh) {
      const existing = await storage.getProfileByUrl(body.url);
      if (existing) return NextResponse.json({ profile: existing, cached: true });
    }
    const profile = await extractProfile({
      url: body.url,
      rawText: body.rawText,
      provider: resolveProvider(body.provider),
    });
    await storage.upsertProfile(profile);
    return NextResponse.json({ profile, cached: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to extract profile";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

const PatchBody = z.object({
  id: z.string(),
  focusTags: z.array(z.string().min(1).max(60)).max(20),
});

export async function PATCH(req: Request) {
  try {
    const body = PatchBody.parse(await req.json());
    const existing = await storage.getProfile(body.id);
    if (!existing) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    const updated = {
      ...existing,
      focusTags: Array.from(new Set(body.focusTags.map((t) => t.trim()).filter(Boolean))),
      updatedAt: new Date().toISOString(),
    };
    await storage.upsertProfile(updated);
    return NextResponse.json({ profile: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update profile";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
