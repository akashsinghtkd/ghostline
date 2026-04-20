import { promises as fs } from "node:fs";
import path from "node:path";
import type { GeneratedPost, LinkedInProfile, PostIdea } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const PROFILES_FILE = path.join(DATA_DIR, "profiles.json");
const IDEAS_FILE = path.join(DATA_DIR, "ideas.json");
const POSTS_FILE = path.join(DATA_DIR, "posts.json");

async function ensureFile<T>(file: string, fallback: T): Promise<T> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    await fs.writeFile(file, JSON.stringify(fallback, null, 2));
    return fallback;
  }
}

async function writeJson<T>(file: string, data: T) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2));
}

export const storage = {
  async listProfiles(): Promise<LinkedInProfile[]> {
    const all = await ensureFile<LinkedInProfile[]>(PROFILES_FILE, []);
    return all.map((p) => ({
      ...p,
      focusTags: p.focusTags ?? [],
      ideaFormats: p.ideaFormats ?? [],
      goals: p.goals ?? [],
      sources: p.sources ?? [],
    }));
  },
  async getProfile(id: string): Promise<LinkedInProfile | null> {
    const all = await storage.listProfiles();
    return all.find((p) => p.id === id) ?? null;
  },
  async getProfileByUrl(url: string): Promise<LinkedInProfile | null> {
    const all = await storage.listProfiles();
    return all.find((p) => p.url === url) ?? null;
  },
  async upsertProfile(profile: LinkedInProfile): Promise<LinkedInProfile> {
    const all = await storage.listProfiles();
    const idx = all.findIndex((p) => p.id === profile.id);
    if (idx >= 0) all[idx] = profile;
    else all.push(profile);
    await writeJson(PROFILES_FILE, all);
    return profile;
  },

  async listIdeas(profileId?: string): Promise<PostIdea[]> {
    const all = await ensureFile<PostIdea[]>(IDEAS_FILE, []);
    return profileId ? all.filter((i) => i.profileId === profileId) : all;
  },
  async getIdea(id: string): Promise<PostIdea | null> {
    const all = await ensureFile<PostIdea[]>(IDEAS_FILE, []);
    return all.find((i) => i.id === id) ?? null;
  },
  async addIdeas(ideas: PostIdea[]): Promise<PostIdea[]> {
    const all = await ensureFile<PostIdea[]>(IDEAS_FILE, []);
    all.push(...ideas);
    await writeJson(IDEAS_FILE, all);
    return ideas;
  },
  async deleteIdea(id: string): Promise<boolean> {
    const all = await ensureFile<PostIdea[]>(IDEAS_FILE, []);
    const next = all.filter((i) => i.id !== id);
    if (next.length === all.length) return false;
    await writeJson(IDEAS_FILE, next);
    return true;
  },

  async listPosts(profileId?: string): Promise<GeneratedPost[]> {
    const all = await ensureFile<GeneratedPost[]>(POSTS_FILE, []);
    const filtered = profileId ? all.filter((p) => p.profileId === profileId) : all;
    return filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async addPost(post: GeneratedPost): Promise<GeneratedPost> {
    const all = await ensureFile<GeneratedPost[]>(POSTS_FILE, []);
    all.push(post);
    await writeJson(POSTS_FILE, all);
    return post;
  },
  async deletePost(id: string): Promise<boolean> {
    const all = await ensureFile<GeneratedPost[]>(POSTS_FILE, []);
    const next = all.filter((p) => p.id !== id);
    if (next.length === all.length) return false;
    await writeJson(POSTS_FILE, next);
    return true;
  },
  async updatePost(id: string, patch: Partial<GeneratedPost>): Promise<GeneratedPost | null> {
    const all = await ensureFile<GeneratedPost[]>(POSTS_FILE, []);
    const idx = all.findIndex((p) => p.id === id);
    if (idx < 0) return null;
    all[idx] = { ...all[idx], ...patch };
    await writeJson(POSTS_FILE, all);
    return all[idx];
  },
};
