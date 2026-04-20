import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const profileId = searchParams.get("profileId") ?? undefined;
  const posts = await storage.listPosts(profileId);
  return NextResponse.json({ posts });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const ok = await storage.deletePost(id);
  if (!ok) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
