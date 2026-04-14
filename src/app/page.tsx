"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Label, Spinner } from "@/components/ui";
import { ModelToggle } from "@/components/ModelToggle";
import {
  FOCUS_TAG_SUGGESTIONS,
  GOAL_SUGGESTIONS,
  IDEA_FORMAT_SUGGESTIONS,
  TagInput,
} from "@/components/TagInput";
import { PostDetail } from "@/components/PostDetail";
import type {
  AIProvider,
  GeneratedPost,
  ImageStyle,
  LinkedInProfile,
  PostFormat,
  PostIdea,
} from "@/lib/types";

type Status = "idle" | "loading" | "error";

const FORMATS: { value: PostFormat; label: string; desc: string }[] = [
  { value: "text", label: "Text only", desc: "Pure prose, no hashtags." },
  { value: "text-with-hashtags", label: "Text + hashtags", desc: "Prose plus targeted tags." },
  { value: "text-with-image", label: "Text + image", desc: "Prose plus generated visual." },
];

const IMAGE_STYLES: { value: ImageStyle; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "minimalist", label: "Minimalist" },
  { value: "infographic", label: "Infographic" },
];

export default function Home() {
  const [provider, setProvider] = useState<AIProvider>("openai");
  const [profile, setProfile] = useState<LinkedInProfile | null>(null);

  const [ideas, setIdeas] = useState<PostIdea[]>([]);
  const [selectedIdea, setSelectedIdea] = useState<PostIdea | null>(null);
  const [format, setFormat] = useState<PostFormat>("text-with-hashtags");
  const [imageStyle, setImageStyle] = useState<ImageStyle>("professional");

  const [post, setPost] = useState<GeneratedPost | null>(null);
  const [history, setHistory] = useState<GeneratedPost[]>([]);
  const [detailPost, setDetailPost] = useState<GeneratedPost | null>(null);

  const [step, setStep] = useState<{ ideas: Status; post: Status; image: Status }>({
    ideas: "idle",
    post: "idle",
    image: "idle",
  });
  const [error, setError] = useState<string | null>(null);

  const refreshHistory = useCallback(async (profileId?: string) => {
    const qs = profileId ? `?profileId=${profileId}` : "";
    const r = await fetch(`/api/history${qs}`);
    const j = await r.json();
    setHistory(j.posts ?? []);
  }, []);

  const loadIdeas = useCallback(async (profileId: string) => {
    const r = await fetch(`/api/ideas?profileId=${profileId}`);
    const j = await r.json();
    setIdeas(j.ideas ?? []);
  }, []);

  const loadContext = useCallback(async () => {
    const r = await fetch("/api/context");
    const j = await r.json();
    setProfile(j.profile);
    if (j.profile) {
      await Promise.all([loadIdeas(j.profile.id), refreshHistory(j.profile.id)]);
    }
  }, [loadIdeas, refreshHistory]);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  async function saveContext(focusTags: string[], ideaFormats: string[], goals: string[]) {
    const r = await fetch("/api/context", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ focusTags, ideaFormats, goals }),
    });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error ?? "Failed to save context");
      return null;
    }
    setProfile(j.profile);
    return j.profile as LinkedInProfile;
  }

  async function onChangeFocusTags(tags: string[]) {
    if (!profile) return;
    await saveContext(tags, profile.ideaFormats ?? [], profile.goals ?? []);
  }

  async function onChangeIdeaFormats(tags: string[]) {
    if (!profile) return;
    await saveContext(profile.focusTags ?? [], tags, profile.goals ?? []);
  }

  async function onChangeGoals(tags: string[]) {
    if (!profile) return;
    await saveContext(profile.focusTags ?? [], profile.ideaFormats ?? [], tags);
  }

  async function onGenerateIdeas() {
    if (!profile) return;
    if (!profile.focusTags.length) {
      setError("Add at least one focus tag first.");
      return;
    }
    setError(null);
    setStep((s) => ({ ...s, ideas: "loading" }));
    try {
      const r = await fetch("/api/ideas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profileId: profile.id, provider, count: 6 }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Idea generation failed");
      await loadIdeas(profile.id);
      setStep((s) => ({ ...s, ideas: "idle" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Idea generation failed");
      setStep((s) => ({ ...s, ideas: "error" }));
    }
  }

  async function onGeneratePost() {
    if (!selectedIdea) return;
    setError(null);
    setStep((s) => ({ ...s, post: "loading" }));
    setPost(null);
    try {
      const r = await fetch("/api/post", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ideaId: selectedIdea.id, format, provider }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Post generation failed");
      setPost(j.post);
      setStep((s) => ({ ...s, post: "idle" }));
      if (profile) await refreshHistory(profile.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Post generation failed");
      setStep((s) => ({ ...s, post: "error" }));
    }
  }

  async function onGenerateImage() {
    if (!post) return;
    setError(null);
    setStep((s) => ({ ...s, image: "loading" }));
    try {
      const r = await fetch("/api/image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ postId: post.id, style: imageStyle, provider }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Image generation failed");
      setPost(j.post);
      setStep((s) => ({ ...s, image: "idle" }));
      if (profile) await refreshHistory(profile.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image generation failed");
      setStep((s) => ({ ...s, image: "error" }));
    }
  }

  const currentHistory = useMemo(
    () => (profile ? history.filter((h) => h.profileId === profile.id) : history),
    [history, profile],
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ghostline</h1>
          <p className="text-sm text-zinc-500">
            AI LinkedIn ghostwriter — tags in, posts out.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500">Model</span>
          <ModelToggle provider={provider} onChange={setProvider} />
        </div>
      </header>

      {error && (
        <Card className="mb-6 border-red-300 bg-red-50 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </Card>
      )}

      <section className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
              1. Setup
            </h2>
            {profile ? (
              <div className="space-y-6">
                <TagInput
                  label="Focus tags"
                  tags={profile.focusTags ?? []}
                  suggestions={FOCUS_TAG_SUGGESTIONS}
                  placeholder="e.g. Full-stack developer, React / Next.js"
                  emptyHint="Add what you want to post about. Required."
                  onChange={onChangeFocusTags}
                />
                <TagInput
                  label="Goals"
                  tags={profile.goals ?? []}
                  suggestions={GOAL_SUGGESTIONS}
                  placeholder="e.g. Attract freelance clients, Grow reach"
                  emptyHint="What should every post drive? Freelance leads, reach, credibility."
                  onChange={onChangeGoals}
                />
                <TagInput
                  label="Idea formats (optional)"
                  tags={profile.ideaFormats ?? []}
                  suggestions={IDEA_FORMAT_SUGGESTIONS}
                  placeholder="e.g. Problem-solving, Comparison / vs"
                  emptyHint="Shape what kinds of ideas are generated — stories, comparisons, how-tos."
                  onChange={onChangeIdeaFormats}
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Spinner />
                Loading context…
              </div>
            )}
          </Card>

          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                2. Post ideas
              </h2>
              <Button
                size="sm"
                variant="secondary"
                onClick={onGenerateIdeas}
                disabled={!profile || !profile.focusTags.length || step.ideas === "loading"}
              >
                {step.ideas === "loading" ? <Spinner /> : null}
                {ideas.length ? "Regenerate" : "Generate"} ideas
              </Button>
            </div>
            {ideas.length === 0 ? (
              <p className="text-sm text-zinc-500">
                {profile?.focusTags.length
                  ? "No ideas yet — click Generate."
                  : "Add at least one focus tag to generate ideas."}
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {ideas.map((i) => {
                  const active = selectedIdea?.id === i.id;
                  return (
                    <button
                      key={i.id}
                      onClick={() => setSelectedIdea(i)}
                      className={`rounded-xl border p-4 text-left transition-all ${
                        active
                          ? "border-zinc-900 bg-zinc-50 shadow-sm dark:border-white dark:bg-zinc-800"
                          : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <Badge>{i.contentType}</Badge>
                        <span className="font-mono text-xs text-zinc-500">
                          ⚡ {i.estimatedEngagement}
                        </span>
                      </div>
                      <div className="mb-1 text-sm font-semibold">{i.title}</div>
                      <div className="line-clamp-3 text-xs text-zinc-500">{i.hook}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
              3. Compose
            </h2>
            <div className="space-y-4">
              <div>
                <Label>Format</Label>
                <div className="mt-2 grid gap-2">
                  {FORMATS.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setFormat(f.value)}
                      className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                        format === f.value
                          ? "border-zinc-900 bg-zinc-50 dark:border-white dark:bg-zinc-800"
                          : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                      }`}
                    >
                      <div className="font-medium">{f.label}</div>
                      <div className="text-xs text-zinc-500">{f.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
              {format === "text-with-image" && (
                <div>
                  <Label>Image style</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {IMAGE_STYLES.map((s) => (
                      <button
                        key={s.value}
                        onClick={() => setImageStyle(s.value)}
                        className={`rounded-full border px-3 py-1.5 text-xs ${
                          imageStyle === s.value
                            ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                            : "border-zinc-200 dark:border-zinc-800"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <Button onClick={onGeneratePost} disabled={!selectedIdea || step.post === "loading"}>
                {step.post === "loading" ? <Spinner /> : null}
                Generate post
              </Button>
            </div>
          </Card>

          {post && (
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                  Preview
                </h2>
                <Badge>{post.provider}</Badge>
              </div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{post.content}</div>
              {post.hashtags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {post.hashtags.map((h) => (
                    <Badge
                      key={h}
                      className="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                    >
                      #{h}
                    </Badge>
                  ))}
                </div>
              )}
              {post.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.imageUrl}
                  alt="Generated"
                  className="mt-4 w-full rounded-xl border border-zinc-200 dark:border-zinc-800"
                />
              ) : post.format === "text-with-image" ? (
                <Button
                  className="mt-4"
                  variant="outline"
                  onClick={onGenerateImage}
                  disabled={step.image === "loading"}
                >
                  {step.image === "loading" ? <Spinner /> : null}
                  Generate image ({imageStyle})
                </Button>
              ) : null}
              <div className="mt-4 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    navigator.clipboard.writeText(
                      `${post.content}${
                        post.hashtags.length
                          ? "\n\n" + post.hashtags.map((h) => "#" + h).join(" ")
                          : ""
                      }`,
                    )
                  }
                >
                  Copy
                </Button>
              </div>
            </Card>
          )}
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">History</h2>
          <span className="text-xs text-zinc-500">{currentHistory.length} saved</span>
        </div>
        {currentHistory.length === 0 ? (
          <p className="text-sm text-zinc-500">No posts yet.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {currentHistory.map((p) => (
              <button
                key={p.id}
                onClick={() => setDetailPost(p)}
                className="rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-sm transition-all hover:border-zinc-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
              >
                <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
                  <span>{new Date(p.createdAt).toLocaleString()}</span>
                  <Badge>{p.provider}</Badge>
                </div>
                <div className="mb-1 text-sm font-medium">{p.idea.title}</div>
                <div className="line-clamp-4 text-xs text-zinc-600 dark:text-zinc-400">
                  {p.content}
                </div>
                {p.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imageUrl}
                    alt=""
                    className="mt-2 rounded-lg border border-zinc-200 dark:border-zinc-800"
                  />
                )}
                <div className="mt-3 text-xs font-medium text-zinc-500">
                  View details →
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <PostDetail post={detailPost} onClose={() => setDetailPost(null)} />

      <footer className="mt-16 border-t border-zinc-200 pt-6 text-xs text-zinc-500 dark:border-zinc-800">
        JSON storage in <code>/data</code>. Images in <code>/public/generated</code>. Swap in a DB
        by replacing <code>src/lib/storage.ts</code>.
      </footer>
    </div>
  );
}
