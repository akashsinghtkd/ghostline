"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Input, Label, Spinner } from "@/components/ui";
import { ModelToggle } from "@/components/ModelToggle";
import { TagInput, TOPIC_SUGGESTIONS } from "@/components/TagInput";
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

  const [step, setStep] = useState<{
    ideas: Status;
    post: Status;
    image: Status;
    url: Status;
  }>({
    ideas: "idle",
    post: "idle",
    image: "idle",
    url: "idle",
  });
  const [error, setError] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");

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

  async function onChangeTopics(topics: string[]) {
    const r = await fetch("/api/context", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ focusTags: topics, ideaFormats: [], goals: [] }),
    });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error ?? "Failed to save topics");
      return;
    }
    setProfile(j.profile);
  }

  async function onAnalyzeUrl() {
    if (!profile || !sourceUrl.trim()) return;
    setError(null);
    setStep((s) => ({ ...s, url: "loading" }));
    try {
      const r = await fetch("/api/analyze-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: sourceUrl.trim(), profileId: profile.id, provider }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Failed to analyze URL");
      setProfile(j.profile);
      setSourceUrl("");
      setStep((s) => ({ ...s, url: "idle" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to analyze URL");
      setStep((s) => ({ ...s, url: "error" }));
    }
  }

  async function onRemoveSource(sourceId: string) {
    if (!profile) return;
    const r = await fetch("/api/analyze-url", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profileId: profile.id, sourceId }),
    });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error ?? "Failed to remove source");
      return;
    }
    setProfile(j.profile);
  }

  async function onGenerateIdeas() {
    if (!profile) return;
    if (!profile.focusTags.length) {
      setError("Add at least one topic first.");
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

  async function onDeleteIdea(id: string) {
    const r = await fetch(`/api/ideas?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j.error ?? "Failed to delete idea");
      return;
    }
    if (selectedIdea?.id === id) setSelectedIdea(null);
    if (profile) await loadIdeas(profile.id);
  }

  async function onDeletePost(id: string) {
    const r = await fetch(`/api/history?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j.error ?? "Failed to delete post");
      return;
    }
    if (post?.id === id) setPost(null);
    if (detailPost?.id === id) setDetailPost(null);
    if (profile) await refreshHistory(profile.id);
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
            AI LinkedIn ghostwriter — topics in, posts out.
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
              1. Topics
            </h2>
            {profile ? (
              <div className="space-y-6">
                <TagInput
                  label="What do you want to post about?"
                  tags={profile.focusTags ?? []}
                  suggestions={TOPIC_SUGGESTIONS}
                  placeholder="e.g. Full-stack development, Freelance projects"
                  emptyHint="Add a few topics — ideas will be generated from these."
                  onChange={onChangeTopics}
                />
                <div className="space-y-2">
                  <Label>Or analyze a URL</Label>
                  <div className="flex gap-2">
                    <Input
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          onAnalyzeUrl();
                        }
                      }}
                      placeholder="https://example.com/article"
                      className="h-9 text-sm"
                    />
                    <Button
                      size="sm"
                      onClick={onAnalyzeUrl}
                      disabled={!sourceUrl.trim() || step.url === "loading"}
                    >
                      {step.url === "loading" ? <Spinner /> : null}
                      Analyze
                    </Button>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Paste a blog post, docs page, or article. Topics from it get added to your list
                    and ideas will draw from its specifics.
                  </p>
                  {(profile.sources ?? []).length > 0 && (
                    <div className="mt-2 space-y-2">
                      {profile.sources.map((s) => (
                        <div
                          key={s.id}
                          className="group flex items-start gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-950"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <span className="truncate font-medium text-zinc-800 dark:text-zinc-100">
                                {s.title}
                              </span>
                              <a
                                href={s.url}
                                target="_blank"
                                rel="noreferrer"
                                className="shrink-0 text-blue-600 hover:underline dark:text-blue-400"
                              >
                                ↗
                              </a>
                            </div>
                            <div className="line-clamp-2 text-zinc-600 dark:text-zinc-400">
                              {s.summary}
                            </div>
                          </div>
                          <button
                            onClick={() => onRemoveSource(s.id)}
                            title="Remove source"
                            className="shrink-0 rounded p-1 text-zinc-400 opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/40"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M6 6l12 12M18 6L6 18" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Spinner />
                Loading…
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
                  : "Add at least one topic to generate ideas."}
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {ideas.map((i) => {
                  const active = selectedIdea?.id === i.id;
                  return (
                    <div
                      key={i.id}
                      className={`group relative rounded-xl border p-4 text-left transition-all ${
                        active
                          ? "border-zinc-900 bg-zinc-50 shadow-sm dark:border-white dark:bg-zinc-800"
                          : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                      }`}
                    >
                      <button
                        onClick={() => setSelectedIdea(i)}
                        className="w-full text-left"
                      >
                        <div className="mb-2 flex items-center justify-between pr-6">
                          <Badge>{i.contentType}</Badge>
                          <span className="font-mono text-xs text-zinc-500">
                            ⚡ {i.estimatedEngagement}
                          </span>
                        </div>
                        <div className="mb-1 text-sm font-semibold">{i.title}</div>
                        <div className="line-clamp-3 text-xs text-zinc-500">{i.hook}</div>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteIdea(i.id);
                        }}
                        title="Delete idea"
                        className="absolute right-2 top-2 rounded-md p-1 text-zinc-400 opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/40"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" />
                        </svg>
                      </button>
                    </div>
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
              <div className="mt-4 flex flex-wrap items-center gap-2">
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
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDeletePost(post.id)}
                  className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/40"
                >
                  Delete
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
              <div
                key={p.id}
                className="group relative rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-all hover:border-zinc-400 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
              >
                <button
                  onClick={() => setDetailPost(p)}
                  className="w-full text-left focus-visible:outline-none"
                >
                  <div className="mb-2 flex items-center justify-between pr-6 text-xs text-zinc-500">
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
                  <div className="mt-3 text-xs font-medium text-zinc-500">View details →</div>
                </button>
                <button
                  onClick={() => {
                    if (confirm("Delete this post?")) onDeletePost(p.id);
                  }}
                  title="Delete post"
                  className="absolute right-3 top-3 rounded-md p-1.5 text-zinc-400 opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/40"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <PostDetail
        post={detailPost}
        onClose={() => setDetailPost(null)}
        onDelete={onDeletePost}
      />

      <footer className="mt-16 border-t border-zinc-200 pt-6 text-xs text-zinc-500 dark:border-zinc-800">
        JSON storage in <code>/data</code>. Images in <code>/public/generated</code>. Swap in a DB
        by replacing <code>src/lib/storage.ts</code>.
      </footer>
    </div>
  );
}
