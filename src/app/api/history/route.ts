import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const profileId = searchParams.get("profileId") ?? undefined;
  const posts = await storage.listPosts(profileId);
  return NextResponse.json({ posts });
}
