"use client";
import { useEffect } from "react";
import { Badge, Button } from "./ui";
import type { GeneratedPost } from "@/lib/types";

export function PostDetail({
  post,
  onClose,
  onDelete,
}: {
  post: GeneratedPost | null;
  onClose: () => void;
  onDelete?: (id: string) => void | Promise<void>;
}) {
  useEffect(() => {
    if (!post) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [post, onClose]);

  if (!post) return null;

  const fullText = `${post.content}${
    post.hashtags.length ? "\n\n" + post.hashtags.map((h) => "#" + h).join(" ") : ""
  }`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-100 p-5 dark:border-zinc-800">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <span>{new Date(post.createdAt).toLocaleString()}</span>
              <span>·</span>
              <Badge>{post.provider}</Badge>
              <Badge>{post.format}</Badge>
              {post.imageStyle && <Badge>{post.imageStyle}</Badge>}
            </div>
            <h3 className="truncate text-base font-semibold">{post.idea.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto p-5">
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Idea
            </h4>
            <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{post.idea.contentType}</Badge>
                <span className="font-mono text-xs text-zinc-500">
                  ⚡ {post.idea.estimatedEngagement}
                </span>
              </div>
              <div>
                <span className="text-xs font-medium text-zinc-500">Hook · </span>
                <span className="text-zinc-800 dark:text-zinc-200">{post.idea.hook}</span>
              </div>
              <div>
                <span className="text-xs font-medium text-zinc-500">Angle · </span>
                <span className="text-zinc-700 dark:text-zinc-300">{post.idea.angle}</span>
              </div>
              <div>
                <span className="text-xs font-medium text-zinc-500">Audience · </span>
                <span className="text-zinc-700 dark:text-zinc-300">{post.idea.targetAudience}</span>
              </div>
            </div>
          </section>

          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Post
            </h4>
            <div className="whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-4 text-sm leading-relaxed dark:border-zinc-800 dark:bg-zinc-950">
              {post.content}
            </div>
          </section>

          {post.hashtags.length > 0 && (
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Hashtags
              </h4>
              <div className="flex flex-wrap gap-1">
                {post.hashtags.map((h) => (
                  <Badge
                    key={h}
                    className="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                  >
                    #{h}
                  </Badge>
                ))}
              </div>
            </section>
          )}

          {post.imageUrl && (
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Image
              </h4>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.imageUrl}
                alt=""
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800"
              />
              {post.imagePrompt && (
                <p className="mt-2 text-xs text-zinc-500">Prompt: {post.imagePrompt}</p>
              )}
            </section>
          )}

          <section className="text-xs text-zinc-400">
            <div>ID: {post.id}</div>
            <div>Idea ID: {post.ideaId}</div>
          </section>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-zinc-100 p-4 dark:border-zinc-800">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigator.clipboard.writeText(fullText)}
          >
            Copy post + tags
          </Button>
          {post.imageUrl && (
            <Button size="sm" variant="outline" onClick={() => window.open(post.imageUrl, "_blank")}>
              Open image
            </Button>
          )}
          {onDelete && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (confirm("Delete this post?")) {
                  onDelete(post.id);
                }
              }}
              className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/40"
            >
              Delete
            </Button>
          )}
          <Button size="sm" onClick={onClose} className="ml-auto">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
